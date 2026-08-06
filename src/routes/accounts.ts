import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const accountsRouter = Router();

// Apply tenant middleware to ALL routes
accountsRouter.use(injectTenant);
accountsRouter.use(requireTenant);

// Income Categories
accountsRouter.get('/income-categories', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const categories = db.prepare(`SELECT * FROM income_categories WHERE ${institutionFilter} AND is_active = 1 ORDER BY name`).all();
  res.json(categories);
});

accountsRouter.post('/income-categories', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO income_categories (id, institution_id, name, description) VALUES (?, ?, ?, ?)').run(id, req.institution_id, name, description || null);
  res.status(201).json({ id, message: 'Category created successfully' });
});

// Expense Categories
accountsRouter.get('/expense-categories', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const categories = db.prepare(`SELECT * FROM expense_categories WHERE ${institutionFilter} AND is_active = 1 ORDER BY name`).all();
  res.json(categories);
});

accountsRouter.post('/expense-categories', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO expense_categories (id, institution_id, name, description) VALUES (?, ?, ?, ?)').run(id, req.institution_id, name, description || null);
  res.status(201).json({ id, message: 'Category created successfully' });
});

// Income
accountsRouter.get('/income', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', category_id, start_date, end_date } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE i.institution_id = ?';
  const params: any[] = [req.institution_id];
  if (category_id) { where += ' AND i.category_id = ?'; params.push(category_id); }
  if (start_date) { where += ' AND i.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND i.date <= ?'; params.push(end_date); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM income i ${where}`).get(...params) as any;

  const income = db.prepare(`
    SELECT i.*, ic.name as category_name, b.branch_name,
           u.first_name || ' ' || u.last_name as received_by_name
    FROM income i
    LEFT JOIN income_categories ic ON i.category_id = ic.id
    LEFT JOIN branches b ON i.branch_id = b.id
    LEFT JOIN users u ON i.received_by = u.id
    ${where}
    ORDER BY i.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: income, total: total.count, page: parseInt(page), limit: lim });
});

accountsRouter.post('/income', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { category_id, branch_id, amount, date, description, reference, payment_method } = req.body;
  if (!amount || !date) { res.status(400).json({ error: 'Amount and date are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO income (id, institution_id, category_id, branch_id, amount, date, description, reference, payment_method, received_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, category_id || null, branch_id || null, amount, date, description || null, reference || null, payment_method || 'cash', req.user?.id || null);
  res.status(201).json({ id, message: 'Income recorded successfully' });
});

// Expenses
accountsRouter.get('/expenses', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', category_id, start_date, end_date } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE e.institution_id = ?';
  const params: any[] = [req.institution_id];
  if (category_id) { where += ' AND e.category_id = ?'; params.push(category_id); }
  if (start_date) { where += ' AND e.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND e.date <= ?'; params.push(end_date); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM expenses e ${where}`).get(...params) as any;

  const expenses = db.prepare(`
    SELECT e.*, ec.name as category_name, b.branch_name,
           u.first_name || ' ' || u.last_name as approved_by_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN users u ON e.approved_by = u.id
    ${where}
    ORDER BY e.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: expenses, total: total.count, page: parseInt(page), limit: lim });
});

accountsRouter.post('/expenses', authorize('platform_admin', 'institution_admin', 'accountant'), (req: AuthRequest, res: Response) => {
  const { category_id, branch_id, amount, date, description, reference, vendor, payment_method } = req.body;
  if (!amount || !date) { res.status(400).json({ error: 'Amount and date are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO expenses (id, institution_id, category_id, branch_id, amount, date, description, reference, vendor, payment_method, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.institution_id, category_id || null, branch_id || null, amount, date, description || null, reference || null, vendor || null, payment_method || 'cash', req.user?.id || null);
  res.status(201).json({ id, message: 'Expense recorded successfully' });
});

// Financial Reports
accountsRouter.get('/report', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { start_date, end_date, branch_id } = req.query as any;

  let dateFilter = '';
  const params: any[] = [req.institution_id];
  if (start_date) { dateFilter += ' AND date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND date <= ?'; params.push(end_date); }

  const branchFilter = branch_id ? ' AND branch_id = ?' : '';
  const branchParams = branch_id ? [branch_id] : [];

  const totalIncome = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE institution_id = ? ${dateFilter} ${branchFilter}`).get(...params, ...branchParams) as any;
  const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE institution_id = ? ${dateFilter} ${branchFilter}`).get(...params, ...branchParams) as any;

  const feeCollections = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE institution_id = ? AND status = 'completed' ${dateFilter.replace(/date/g, 'payment_date')}`).get(req.institution_id, ...params.slice(1)) as any;

  const incomeByCategory = db.prepare(`
    SELECT ic.name as category, COALESCE(SUM(i.amount), 0) as total
    FROM income i LEFT JOIN income_categories ic ON i.category_id = ic.id
    WHERE i.institution_id = ? ${dateFilter.replace(/date/g, 'i.date')} ${branchFilter.replace('branch_id', 'i.branch_id')}
    GROUP BY ic.name ORDER BY total DESC
  `).all(...params, ...branchParams);

  const expenseByCategory = db.prepare(`
    SELECT ec.name as category, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.institution_id = ? ${dateFilter.replace(/date/g, 'e.date')} ${branchFilter.replace('branch_id', 'e.branch_id')}
    GROUP BY ec.name ORDER BY total DESC
  `).all(...params, ...branchParams);

  const monthlyIncome = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total
    FROM income WHERE institution_id = ? ${dateFilter} ${branchFilter}
    GROUP BY month ORDER BY month
  `).all(...params, ...branchParams);

  const monthlyExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE institution_id = ? ${dateFilter} ${branchFilter}
    GROUP BY month ORDER BY month
  `).all(...params, ...branchParams);

  res.json({
    total_income: totalIncome.total,
    total_expenses: totalExpenses.total,
    fee_collections: feeCollections.total,
    net_income: totalIncome.total + feeCollections.total - totalExpenses.total,
    income_by_category: incomeByCategory,
    expense_by_category: expenseByCategory,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
  });
});

// Ledger
accountsRouter.get('/ledger', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { start_date, end_date, page = '1', limit = '50' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let dateFilter = '';
  const params: any[] = [];
  if (start_date) { dateFilter += ' AND date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND date <= ?'; params.push(end_date); }

  const entries = db.prepare(`
    SELECT * FROM (
      SELECT i.date, 'income' as type, ic.name as category, i.description, i.amount as credit, 0 as debit, i.payment_method, i.reference
      FROM income i LEFT JOIN income_categories ic ON i.category_id = ic.id
      WHERE 1=1 ${dateFilter.replace(/date/g, 'i.date')}
      UNION ALL
      SELECT e.date, 'expense' as type, ec.name as category, e.description, 0 as credit, e.amount as debit, e.payment_method, e.reference
      FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE 1=1 ${dateFilter.replace(/date/g, 'e.date')}
      UNION ALL
      SELECT p.payment_date as date, 'fee_payment' as type, 'Fee Collection' as category, 'Payment: ' || p.payment_number as description, p.amount as credit, 0 as debit, p.payment_method, p.reference_number as reference
      FROM payments p WHERE p.status = 'completed' ${dateFilter.replace(/date/g, 'p.payment_date')}
    ) ORDER BY date DESC
    LIMIT ? OFFSET ?
  `).all(...params, ...params, ...params, lim, offset);

  const totals = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM income WHERE 1=1 ${dateFilter.replace(/date/g, 'date')}) +
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' ${dateFilter.replace(/date/g, 'payment_date')}) as total_credit,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE 1=1 ${dateFilter.replace(/date/g, 'date')}) as total_debit
  `).get(...params, ...params, ...params) as any;

  res.json({ entries, totals });
});
