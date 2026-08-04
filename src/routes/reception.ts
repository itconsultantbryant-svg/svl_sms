import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const receptionRouter = Router();

// Apply tenant middleware to ALL routes
receptionRouter.use(injectTenant);
receptionRouter.use(requireTenant);

// Visitors
receptionRouter.get('/visitors', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', date, checked_out } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (date) { where += ' AND DATE(v.check_in) = ?'; params.push(date); }
  if (checked_out === '0') { where += ' AND v.check_out IS NULL'; }

  const total = db.prepare(`SELECT COUNT(*) as count FROM visitors v ${where}`).get(...params) as any;
  const visitors = db.prepare(`
    SELECT v.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM visitors v
    LEFT JOIN users u ON v.created_by = u.id
    ${where} ORDER BY v.check_in DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: visitors, total: total.count, page: parseInt(page), limit: lim });
});

receptionRouter.post('/visitors', (req: AuthRequest, res: Response) => {
  const { name, phone, purpose, to_meet, id_type, id_number, branch_id, check_in, notes } = req.body;
  if (!name || !check_in) { res.status(400).json({ error: 'Name and check-in time are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO visitors (id, name, phone, purpose, to_meet, id_type, id_number, branch_id, check_in, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, phone || null, purpose || null, to_meet || null, id_type || null, id_number || null, branch_id || null, check_in, notes || null, req.user?.id || null);
  res.status(201).json({ id, message: 'Visitor checked in' });
});

receptionRouter.put('/visitors/:id/checkout', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { check_out } = req.body;
  const db = getDatabase();
  db.prepare('UPDATE visitors SET check_out = ? WHERE id = ?').run(check_out || new Date().toISOString(), id);
  res.json({ message: 'Visitor checked out' });
});

// Phone Calls
receptionRouter.get('/calls', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', date, call_type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (date) { where += ' AND pc.date = ?'; params.push(date); }
  if (call_type) { where += ' AND pc.call_type = ?'; params.push(call_type); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM phone_calls pc ${where}`).get(...params) as any;
  const calls = db.prepare(`
    SELECT pc.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM phone_calls pc
    LEFT JOIN users u ON pc.created_by = u.id
    ${where} ORDER BY pc.date DESC, pc.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: calls, total: total.count, page: parseInt(page), limit: lim });
});

receptionRouter.post('/calls', (req: AuthRequest, res: Response) => {
  const { call_type, caller_name, phone, purpose, date, duration, follow_up, notes, branch_id } = req.body;
  if (!date) { res.status(400).json({ error: 'Date is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO phone_calls (id, call_type, caller_name, phone, purpose, date, duration, follow_up, notes, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, call_type || 'incoming', caller_name || null, phone || null, purpose || null, date, duration || null, follow_up ? 1 : 0, notes || null, branch_id || null, req.user?.id || null);
  res.status(201).json({ id, message: 'Call logged' });
});

// Postal Records
receptionRouter.get('/postal', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (type) { where += ' AND pr.type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM postal_records pr ${where}`).get(...params) as any;
  const records = db.prepare(`
    SELECT pr.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM postal_records pr
    LEFT JOIN users u ON pr.created_by = u.id
    ${where} ORDER BY pr.date DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: records, total: total.count, page: parseInt(page), limit: lim });
});

receptionRouter.post('/postal', (req: AuthRequest, res: Response) => {
  const { type, reference_number, from_to, date, description, branch_id, received_by, notes } = req.body;
  if (!date) { res.status(400).json({ error: 'Date is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO postal_records (id, type, reference_number, from_to, date, description, branch_id, received_by, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, type || 'incoming', reference_number || null, from_to || null, date, description || null, branch_id || null, received_by || null, notes || null, req.user?.id || null);
  res.status(201).json({ id, message: 'Record added' });
});
