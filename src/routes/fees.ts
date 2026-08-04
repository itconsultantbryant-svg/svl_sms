import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const feesRouter = Router();

// Apply tenant middleware to ALL fee routes
feesRouter.use(injectTenant);
feesRouter.use(requireTenant);

// Fee Types
feesRouter.get('/types', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const types = db.prepare('SELECT * FROM fee_types WHERE institution_id = ? AND is_active = 1 ORDER BY name').all(req.institution_id);
  res.json(types);
});

feesRouter.post('/types', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { name, code, description, is_recurring } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO fee_types (id, institution_id, name, code, description, is_recurring) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.institution_id, name, code || null, description || null, is_recurring ? 1 : 0);
  res.status(201).json({ id, message: 'Fee type created successfully' });
});

feesRouter.put('/types/:id', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, description, is_recurring, is_active } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE fee_types SET name = COALESCE(?, name), code = COALESCE(?, code), description = COALESCE(?, description), is_recurring = COALESCE(?, is_recurring), is_active = COALESCE(?, is_active) WHERE id = ? AND institution_id = ?`).run(name, code, description, is_recurring, is_active, id, req.institution_id);
  res.json({ message: 'Fee type updated successfully' });
});

// Fee Structures
feesRouter.get('/structures', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { session_id, class_id, branch_id } = req.query as any;
  let where = 'WHERE fs.institution_id = ? AND fs.is_active = 1';
  const params: any[] = [req.institution_id];
  if (session_id) { where += ' AND fs.session_id = ?'; params.push(session_id); }
  if (class_id) { where += ' AND fs.class_id = ?'; params.push(class_id); }
  if (branch_id) { where += ' AND fs.branch_id = ?'; params.push(branch_id); }

  const structures = db.prepare(`
    SELECT fs.*, ft.name as fee_type_name, c.name as class_name, s.name as session_name, t.name as term_name, b.branch_name as branch_name
    FROM fee_structures fs
    LEFT JOIN fee_types ft ON fs.fee_type_id = ft.id
    LEFT JOIN classes c ON fs.class_id = c.id
    LEFT JOIN academic_sessions s ON fs.session_id = s.id
    LEFT JOIN terms t ON fs.term_id = t.id
    LEFT JOIN branches b ON fs.branch_id = b.id
    ${where}
    ORDER BY c.sort_order, ft.name
  `).all(...params);

  res.json(structures);
});

feesRouter.post('/structures', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { fee_type_id, session_id, term_id, branch_id, class_id, amount, due_date } = req.body;
  if (!fee_type_id || !session_id || !class_id || !amount) {
    res.status(400).json({ error: 'Fee type, session, class, and amount are required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO fee_structures (id, institution_id, fee_type_id, session_id, term_id, branch_id, class_id, amount, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, fee_type_id, session_id, term_id || null, branch_id || null, class_id, amount, due_date || null);
  res.status(201).json({ id, message: 'Fee structure created successfully' });
});

feesRouter.put('/structures/:id', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, due_date, is_active } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE fee_structures SET amount = COALESCE(?, amount), due_date = COALESCE(?, due_date), is_active = COALESCE(?, is_active), updated_at = datetime('now') WHERE id = ? AND institution_id = ?`).run(amount, due_date, is_active, id, req.institution_id);
  res.json({ message: 'Fee structure updated successfully' });
});

// Discounts
feesRouter.get('/discounts', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const discounts = db.prepare('SELECT * FROM fee_discounts WHERE institution_id = ? AND is_active = 1 ORDER BY name').all(req.institution_id);
  res.json(discounts);
});

feesRouter.post('/discounts', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { name, type, value, description } = req.body;
  if (!name || !value) { res.status(400).json({ error: 'Name and value are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO fee_discounts (id, institution_id, name, type, value, description) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.institution_id, name, type || 'percentage', value, description || null);
  res.status(201).json({ id, message: 'Discount created successfully' });
});

// Invoices
feesRouter.get('/invoices', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', student_id, status, session_id, class_id } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE i.institution_id = ?';
  const params: any[] = [req.institution_id];
  if (student_id) { where += ' AND i.student_id = ?'; params.push(student_id); }
  if (status) { where += ' AND i.status = ?'; params.push(status); }
  if (session_id) { where += ' AND i.session_id = ?'; params.push(session_id); }
  if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN students s ON i.student_id = s.id ${where}`).get(...params) as any;

  const invoices = db.prepare(`
    SELECT i.*, s.first_name, s.last_name, s.admission_number, c.name as class_name, sec.name as section_name, ses.name as session_name, t.name as term_name
    FROM invoices i
    LEFT JOIN students s ON i.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN academic_sessions ses ON i.session_id = ses.id
    LEFT JOIN terms t ON i.term_id = t.id
    ${where}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: invoices, total: total.count, page: parseInt(page), limit: lim });
});

feesRouter.get('/invoices/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const invoice = db.prepare(`
    SELECT i.*, s.first_name, s.last_name, s.admission_number, s.photo, c.name as class_name, sec.name as section_name
    FROM invoices i
    LEFT JOIN students s ON i.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE i.id = ? AND i.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const items = db.prepare(`
    SELECT ii.*, ft.name as fee_type_name FROM invoice_items ii
    LEFT JOIN fee_types ft ON ii.fee_type_id = ft.id
    WHERE ii.invoice_id = ?
  `).all(id);

  const payments = db.prepare(`
    SELECT * FROM payments WHERE invoice_id = ? AND status = 'completed' ORDER BY payment_date DESC
  `).all(id);

  res.json({ ...invoice, items, payments });
});

feesRouter.post('/invoices/generate', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  try {
    const { student_id, session_id, term_id, due_date } = req.body;
    if (!student_id || !session_id) {
      res.status(400).json({ error: 'Student and session are required' });
      return;
    }

    const db = getDatabase();
    const student = db.prepare('SELECT id, class_id, branch_id FROM students WHERE id = ? AND institution_id = ?').get(student_id, req.institution_id) as any;
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    let structureWhere = 'WHERE fs.institution_id = ? AND fs.session_id = ? AND fs.class_id = ? AND fs.is_active = 1';
    const structureParams: any[] = [req.institution_id, session_id, student.class_id];
    if (term_id) { structureWhere += ' AND (fs.term_id = ? OR fs.term_id IS NULL)'; structureParams.push(term_id); }

    const structures = db.prepare(`
      SELECT fs.*, ft.name as fee_type_name FROM fee_structures fs
      JOIN fee_types ft ON fs.fee_type_id = ft.id
      ${structureWhere}
    `).all(...structureParams) as any[];

    if (structures.length === 0) {
      res.status(400).json({ error: 'No fee structures found for this student class/session' });
      return;
    }

    const discounts = db.prepare(`
      SELECT fd.* FROM fee_discounts fd
      JOIN student_discounts sd ON fd.id = sd.discount_id
      WHERE sd.student_id = ? AND sd.session_id = ? AND fd.institution_id = ?
    `).all(student_id, session_id, req.institution_id) as any[];

    const invoiceId = generateId();
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    const transaction = db.transaction(() => {
      let totalAmount = 0;
      let totalDiscount = 0;

      const items: { id: string; feeTypeId: string; desc: string; amount: number; discount: number; net: number }[] = [];
      for (const fs of structures) {
        let itemDiscount = 0;
        for (const d of discounts) {
          if (d.type === 'percentage') itemDiscount += (fs.amount * d.value / 100);
          else itemDiscount += d.value;
        }
        itemDiscount = Math.min(itemDiscount, fs.amount);
        const netAmount = fs.amount - itemDiscount;
        totalAmount += fs.amount;
        totalDiscount += itemDiscount;
        items.push({ id: generateId(), feeTypeId: fs.fee_type_id, desc: fs.fee_type_name, amount: fs.amount, discount: itemDiscount, net: netAmount });
      }

      const balance = totalAmount - totalDiscount;
      db.prepare(`
        INSERT INTO invoices (id, institution_id, invoice_number, student_id, session_id, term_id, total_amount, discount_amount, paid_amount, balance, due_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(invoiceId, req.institution_id, invoiceNumber, student_id, session_id, term_id || null, totalAmount, totalDiscount, balance, due_date || null, req.user?.id || null);

      const insertItem = db.prepare(`INSERT INTO invoice_items (id, institution_id, invoice_id, fee_type_id, description, amount, discount, net_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const item of items) {
        insertItem.run(item.id, req.institution_id, invoiceId, item.feeTypeId, item.desc, item.amount, item.discount, item.net);
      }
    });

    transaction();
    res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, message: 'Invoice generated successfully' });
  } catch (err: any) {
    console.error('Invoice generation error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Payments
feesRouter.get('/payments', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', student_id, start_date, end_date, method } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = "WHERE p.institution_id = ? AND p.status = 'completed'";
  const params: any[] = [req.institution_id];
  if (student_id) { where += ' AND p.student_id = ?'; params.push(student_id); }
  if (start_date) { where += ' AND p.payment_date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND p.payment_date <= ?'; params.push(end_date); }
  if (method) { where += ' AND p.payment_method = ?'; params.push(method); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM payments p ${where}`).get(...params) as any;

  const payments = db.prepare(`
    SELECT p.*, s.first_name, s.last_name, s.admission_number, i.invoice_number
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: payments, total: total.count, page: parseInt(page), limit: lim });
});

feesRouter.post('/payments', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { invoice_id, amount, payment_method, payment_date, reference_number, notes } = req.body;
  if (!invoice_id || !amount || !payment_date) {
    res.status(400).json({ error: 'Invoice, amount, and payment date are required' });
    return;
  }

  const db = getDatabase();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND institution_id = ?').get(invoice_id, req.institution_id) as any;
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (amount > invoice.balance) { res.status(400).json({ error: 'Payment amount exceeds balance' }); return; }

  const paymentId = generateId();
  const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO payments (id, institution_id, payment_number, invoice_id, student_id, amount, payment_method, payment_date, reference_number, received_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, req.institution_id, paymentNumber, invoice_id, invoice.student_id, amount, payment_method || 'cash', payment_date, reference_number || null, req.user?.id || null, notes || null);

    const newPaid = invoice.paid_amount + amount;
    const newBalance = invoice.total_amount - invoice.discount_amount - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    db.prepare(`UPDATE invoices SET paid_amount = ?, balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(newPaid, Math.max(0, newBalance), newStatus, invoice_id);
  });

  transaction();
  res.status(201).json({ id: paymentId, payment_number: paymentNumber, message: 'Payment recorded successfully' });
});

feesRouter.get('/payments/:id/receipt', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const payment = db.prepare(`
    SELECT p.*, s.first_name, s.last_name, s.admission_number, s.photo,
           c.name as class_name, sec.name as section_name,
           i.invoice_number, i.total_amount, i.balance,
           u.first_name as received_first, u.last_name as received_last
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    LEFT JOIN users u ON p.received_by = u.id
    WHERE p.id = ? AND p.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

  const institution = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.institution_id);
  res.json({ payment, institution });
});

// Due fees report
feesRouter.get('/due', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { class_id, session_id } = req.query as any;

  let where = "WHERE i.status IN ('unpaid', 'partial', 'overdue')";
  const params: any[] = [];
  if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }
  if (session_id) { where += ' AND i.session_id = ?'; params.push(session_id); }

  const dues = db.prepare(`
    SELECT s.id as student_id, s.admission_number, s.first_name, s.last_name,
           c.name as class_name, sec.name as section_name,
           SUM(i.balance) as total_due, COUNT(i.id) as invoice_count
    FROM invoices i
    JOIN students s ON i.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    ${where}
    GROUP BY s.id
    ORDER BY total_due DESC
  `).all(...params);

  res.json(dues);
});

// Fee collection summary
feesRouter.get('/summary', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { session_id, term_id, start_date, end_date } = req.query as any;

  let paymentWhere = "WHERE p.status = 'completed'";
  const params: any[] = [];
  if (start_date) { paymentWhere += ' AND p.payment_date >= ?'; params.push(start_date); }
  if (end_date) { paymentWhere += ' AND p.payment_date <= ?'; params.push(end_date); }

  const totalCollected = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments p ${paymentWhere}`).get(...params) as any;

  let invoiceWhere = 'WHERE 1=1';
  const invoiceParams: any[] = [];
  if (session_id) { invoiceWhere += ' AND session_id = ?'; invoiceParams.push(session_id); }

  const invoiceStats = db.prepare(`
    SELECT
      COALESCE(SUM(total_amount), 0) as total_billed,
      COALESCE(SUM(discount_amount), 0) as total_discounts,
      COALESCE(SUM(paid_amount), 0) as total_paid,
      COALESCE(SUM(balance), 0) as total_outstanding
    FROM invoices ${invoiceWhere}
  `).get(...invoiceParams) as any;

  const byMethod = db.prepare(`
    SELECT payment_method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM payments p ${paymentWhere} GROUP BY payment_method
  `).all(...params);

  res.json({ total_collected: totalCollected.total, ...invoiceStats, by_method: byMethod });
});
