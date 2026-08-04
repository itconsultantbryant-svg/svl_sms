import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const libraryRouter = Router();

// Apply tenant middleware to ALL library routes
libraryRouter.use(injectTenant);
libraryRouter.use(requireTenant);

// Book Categories
libraryRouter.get('/categories', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  const categories = db.prepare('SELECT * FROM book_categories WHERE institution_id = ? AND is_active = 1 ORDER BY name').all(req.institution_id);
  res.json(categories);
});

libraryRouter.post('/categories', authorize('platform_admin', 'institution_admin', 'librarian'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  // TENANT ISOLATION: Include institution_id
  db.prepare('INSERT INTO book_categories (id, institution_id, name, description) VALUES (?, ?, ?, ?)').run(id, req.institution_id, name, description || null);
  res.status(201).json({ id, message: 'Category created' });
});

// Books
libraryRouter.get('/books', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search, category_id, available } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  // TENANT ISOLATION: Always filter by institution_id
  let where = 'WHERE b.institution_id = ? AND b.is_active = 1';
  const params: any[] = [req.institution_id];
  if (search) { where += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category_id) { where += ' AND b.category_id = ?'; params.push(category_id); }
  if (available === '1') { where += ' AND b.available > 0'; }

  const total = db.prepare(`SELECT COUNT(*) as count FROM books b ${where}`).get(...params) as any;
  const books = db.prepare(`
    SELECT b.*, bc.name as category_name FROM books b
    LEFT JOIN book_categories bc ON b.category_id = bc.id
    ${where} ORDER BY b.title LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: books, total: total.count, page: parseInt(page), limit: lim });
});

libraryRouter.post('/books', authorize('platform_admin', 'institution_admin', 'librarian'), (req: AuthRequest, res: Response) => {
  const { title, isbn, author, publisher, category_id, branch_id, edition, year, quantity, rack_number, price, description } = req.body;
  if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  const qty = quantity || 1;
  // TENANT ISOLATION: Include institution_id
  db.prepare(`INSERT INTO books (id, institution_id, title, isbn, author, publisher, category_id, branch_id, edition, year, quantity, available, rack_number, price, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, title, isbn || null, author || null, publisher || null, category_id || null, branch_id || null, edition || null, year || null, qty, qty, rack_number || null, price || 0, description || null);
  res.status(201).json({ id, message: 'Book added' });
});

libraryRouter.put('/books/:id', authorize('platform_admin', 'institution_admin', 'librarian'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, isbn, author, publisher, category_id, edition, year, quantity, rack_number, price, description } = req.body;
  const db = getDatabase();
  // TENANT ISOLATION: Check book belongs to this institution
  const book = db.prepare('SELECT * FROM books WHERE id = ? AND institution_id = ?').get(id, req.institution_id) as any;
  if (!book) { res.status(404).json({ error: 'Book not found' }); return; }

  const newQty = quantity !== undefined ? quantity : book.quantity;
  const diff = newQty - book.quantity;
  const newAvailable = Math.max(0, book.available + diff);

  db.prepare(`UPDATE books SET title = COALESCE(?, title), isbn = COALESCE(?, isbn), author = COALESCE(?, author), publisher = COALESCE(?, publisher), category_id = COALESCE(?, category_id), edition = COALESCE(?, edition), year = COALESCE(?, year), quantity = ?, available = ?, rack_number = COALESCE(?, rack_number), price = COALESCE(?, price), description = COALESCE(?, description) WHERE id = ?`).run(title, isbn, author, publisher, category_id, edition, year, newQty, newAvailable, rack_number, price, description, id);
  res.json({ message: 'Book updated' });
});

// Issue Book
libraryRouter.post('/issue', authorize('platform_admin', 'institution_admin', 'librarian'), (req: AuthRequest, res: Response) => {
  const { book_id, issued_to, issued_to_type, issue_date, due_date, notes } = req.body;
  if (!book_id || !issued_to || !issue_date || !due_date) {
    res.status(400).json({ error: 'Book, member, issue date and due date are required' });
    return;
  }
  const db = getDatabase();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id) as any;
  if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
  if (book.available <= 0) { res.status(400).json({ error: 'No copies available' }); return; }

  const id = generateId();
  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO book_issues (id, institution_id, book_id, issued_to, issued_to_type, issue_date, due_date, issued_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, book_id, issued_to, issued_to_type || 'student', issue_date, due_date, req.user?.id || null, notes || null);
    db.prepare('UPDATE books SET available = available - 1 WHERE id = ?').run(book_id);
  });
  transaction();
  res.status(201).json({ id, message: 'Book issued' });
});

// Return Book
libraryRouter.post('/return/:id', authorize('platform_admin', 'institution_admin', 'librarian'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { return_date, status, fine_amount } = req.body;
  const db = getDatabase();
  const issue = db.prepare('SELECT * FROM book_issues WHERE id = ?').get(id) as any;
  if (!issue) { res.status(404).json({ error: 'Issue record not found' }); return; }
  if (issue.status !== 'issued') { res.status(400).json({ error: 'Book already returned' }); return; }

  const finalStatus = status || 'returned';
  const transaction = db.transaction(() => {
    db.prepare(`UPDATE book_issues SET return_date = ?, status = ?, fine_amount = ? WHERE id = ?`).run(return_date || new Date().toISOString().split('T')[0], finalStatus, fine_amount || 0, id);
    if (finalStatus !== 'lost') {
      db.prepare('UPDATE books SET available = available + 1 WHERE id = ?').run(issue.book_id);
    }
  });
  transaction();
  res.json({ message: 'Book returned' });
});

// Issues list
libraryRouter.get('/issues', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', status, issued_to, book_id } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND bi.status = ?'; params.push(status); }
  if (issued_to) { where += ' AND bi.issued_to = ?'; params.push(issued_to); }
  if (book_id) { where += ' AND bi.book_id = ?'; params.push(book_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM book_issues bi ${where}`).get(...params) as any;
  const issues = db.prepare(`
    SELECT bi.*, b.title as book_title, b.isbn,
      CASE bi.issued_to_type
        WHEN 'student' THEN (SELECT first_name || ' ' || last_name FROM students WHERE id = bi.issued_to)
        ELSE (SELECT first_name || ' ' || last_name FROM employees WHERE id = bi.issued_to)
      END as member_name
    FROM book_issues bi
    LEFT JOIN books b ON bi.book_id = b.id
    ${where} ORDER BY bi.issue_date DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: issues, total: total.count, page: parseInt(page), limit: lim });
});
