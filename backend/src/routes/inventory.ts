import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const inventoryRouter = Router();

// Apply tenant middleware to ALL routes
inventoryRouter.use(injectTenant);
inventoryRouter.use(requireTenant);

// Categories
inventoryRouter.get('/categories', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const categories = db.prepare('SELECT * FROM inventory_categories WHERE is_active = 1 ORDER BY name').all();
  res.json(categories);
});

inventoryRouter.post('/categories', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO inventory_categories (id, name, description) VALUES (?, ?, ?)').run(id, name, description || null);
  res.status(201).json({ id, message: 'Category created' });
});

// Items
inventoryRouter.get('/items', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search, category_id, low_stock } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE i.is_active = 1';
  const params: any[] = [];
  if (search) { where += ' AND (i.name LIKE ? OR i.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (category_id) { where += ' AND i.category_id = ?'; params.push(category_id); }
  if (low_stock === '1') { where += ' AND i.quantity <= i.min_quantity'; }

  const total = db.prepare(`SELECT COUNT(*) as count FROM inventory_items i ${where}`).get(...params) as any;
  const items = db.prepare(`
    SELECT i.*, ic.name as category_name FROM inventory_items i
    LEFT JOIN inventory_categories ic ON i.category_id = ic.id
    ${where} ORDER BY i.name LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: items, total: total.count, page: parseInt(page), limit: lim });
});

inventoryRouter.post('/items', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, category_id, branch_id, sku, quantity, min_quantity, unit, unit_price, location, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO inventory_items (id, name, category_id, branch_id, sku, quantity, min_quantity, unit, unit_price, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, category_id || null, branch_id || null, sku || null, quantity || 0, min_quantity || 0, unit || 'piece', unit_price || 0, location || null, description || null);
  res.status(201).json({ id, message: 'Item added' });
});

inventoryRouter.put('/items/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, category_id, sku, min_quantity, unit, unit_price, location, description } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE inventory_items SET name = COALESCE(?, name), category_id = COALESCE(?, category_id), sku = COALESCE(?, sku), min_quantity = COALESCE(?, min_quantity), unit = COALESCE(?, unit), unit_price = COALESCE(?, unit_price), location = COALESCE(?, location), description = COALESCE(?, description), updated_at = datetime('now') WHERE id = ?`).run(name, category_id, sku, min_quantity, unit, unit_price, location, description, id);
  res.json({ message: 'Item updated' });
});

// Stock Transactions
inventoryRouter.get('/transactions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', item_id, type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (item_id) { where += ' AND st.item_id = ?'; params.push(item_id); }
  if (type) { where += ' AND st.type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM stock_transactions st ${where}`).get(...params) as any;
  const transactions = db.prepare(`
    SELECT st.*, ii.name as item_name, u.first_name || ' ' || u.last_name as created_by_name
    FROM stock_transactions st
    LEFT JOIN inventory_items ii ON st.item_id = ii.id
    LEFT JOIN users u ON st.created_by = u.id
    ${where} ORDER BY st.date DESC, st.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: transactions, total: total.count, page: parseInt(page), limit: lim });
});

inventoryRouter.post('/transactions', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { item_id, type, quantity, unit_price, reference, vendor, date, notes } = req.body;
  if (!item_id || !type || !quantity || !date) {
    res.status(400).json({ error: 'Item, type, quantity and date are required' });
    return;
  }
  const db = getDatabase();
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id) as any;
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  const qty = parseInt(quantity);
  if (type === 'issue' && item.quantity < qty) {
    res.status(400).json({ error: 'Insufficient stock' });
    return;
  }

  const id = generateId();
  const totalPrice = (unit_price || item.unit_price) * qty;
  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO stock_transactions (id, item_id, type, quantity, unit_price, total_price, reference, vendor, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, item_id, type, qty, unit_price || item.unit_price, totalPrice, reference || null, vendor || null, date, notes || null, req.user?.id || null);

    let newQty = item.quantity;
    if (type === 'purchase' || type === 'return') newQty += qty;
    else if (type === 'issue') newQty -= qty;
    else newQty = qty; // adjustment sets absolute value

    db.prepare('UPDATE inventory_items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, item_id);
  });
  transaction();
  res.status(201).json({ id, message: 'Transaction recorded' });
});
