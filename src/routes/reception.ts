import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const receptionRouter = Router();

receptionRouter.use(injectTenant);
receptionRouter.use(requireTenant);

function schoolId(req: AuthRequest, res: Response): string | null {
  if (!req.institution_id) {
    res.status(400).json({ error: 'Select a school before using reception' });
    return null;
  }
  return req.institution_id;
}

function dbError(res: Response, err: any, fallback: string) {
  console.error(fallback, err);
  res.status(500).json({ error: fallback, details: err?.message || 'Internal server error' });
}

function empty(value: any) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function direction(value: any) {
  return value === 'outgoing' ? 'outgoing' : 'incoming';
}

// Visitors
receptionRouter.get('/visitors', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const db = getDatabase();
  const { page = '1', limit = '20', date, checked_out } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE v.institution_id = ?';
  const params: any[] = [institutionId];
  if (date) { where += ' AND DATE(v.check_in) = ?'; params.push(date); }
  if (checked_out === '0') { where += ' AND v.check_out IS NULL'; }

  try {
    const total = db.prepare(`SELECT COUNT(*) as count FROM visitors v ${where}`).get(...params) as any;
    const visitors = db.prepare(`
      SELECT v.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM visitors v
      LEFT JOIN users u ON v.created_by = u.id
      ${where} ORDER BY v.check_in DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);
    res.json({ data: visitors, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    dbError(res, err, 'Failed to load visitors');
  }
});

receptionRouter.post('/visitors', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const { name, phone, purpose, to_meet, id_type, id_number, branch_id, check_in, notes } = req.body;
  if (!name) { res.status(400).json({ error: 'Visitor name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  const checkedIn = empty(check_in) || new Date().toISOString();
  try {
    db.prepare(`INSERT INTO visitors (id, institution_id, name, phone, purpose, to_meet, id_type, id_number, branch_id, check_in, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, institutionId, name, empty(phone), empty(purpose), empty(to_meet), empty(id_type), empty(id_number), empty(branch_id), checkedIn, empty(notes), req.user?.id || null
    );
    res.status(201).json({ id, message: 'Visitor checked in' });
  } catch (err: any) {
    dbError(res, err, 'Failed to check in visitor');
  }
});

receptionRouter.put('/visitors/:id/checkout', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const { id } = req.params;
  const { check_out } = req.body;
  const db = getDatabase();
  const result = db.prepare('UPDATE visitors SET check_out = ? WHERE id = ? AND institution_id = ?').run(check_out || new Date().toISOString(), id, institutionId);
  if (!result.changes) { res.status(404).json({ error: 'Visitor not found' }); return; }
  res.json({ message: 'Visitor checked out' });
});

// Phone Calls
receptionRouter.get('/calls', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const db = getDatabase();
  const { page = '1', limit = '20', date, call_type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE pc.institution_id = ?';
  const params: any[] = [institutionId];
  if (date) { where += ' AND pc.date = ?'; params.push(date); }
  if (call_type) { where += ' AND pc.call_type = ?'; params.push(call_type); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as count FROM phone_calls pc ${where}`).get(...params) as any;
    const calls = db.prepare(`
      SELECT pc.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM phone_calls pc
      LEFT JOIN users u ON pc.created_by = u.id
      ${where} ORDER BY pc.date DESC, pc.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);
    res.json({ data: calls, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    dbError(res, err, 'Failed to load calls');
  }
});

receptionRouter.post('/calls', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const { call_type, caller_name, phone, purpose, date, duration, follow_up, notes, branch_id } = req.body;
  if (!date) { res.status(400).json({ error: 'Date is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  try {
    db.prepare(`INSERT INTO phone_calls (id, institution_id, call_type, caller_name, phone, purpose, date, duration, follow_up, notes, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, institutionId, direction(call_type), empty(caller_name), empty(phone), empty(purpose), date, empty(duration), follow_up ? 1 : 0, empty(notes), empty(branch_id), req.user?.id || null
    );
    res.status(201).json({ id, message: 'Call logged' });
  } catch (err: any) {
    dbError(res, err, 'Failed to log call');
  }
});

// Postal Records
receptionRouter.get('/postal', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const db = getDatabase();
  const { page = '1', limit = '20', type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE pr.institution_id = ?';
  const params: any[] = [institutionId];
  if (type) { where += ' AND pr.type = ?'; params.push(type); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as count FROM postal_records pr ${where}`).get(...params) as any;
    const records = db.prepare(`
      SELECT pr.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM postal_records pr
      LEFT JOIN users u ON pr.created_by = u.id
      ${where} ORDER BY pr.date DESC LIMIT ? OFFSET ?
    `).all(...params, lim, offset);
    res.json({ data: records, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    dbError(res, err, 'Failed to load postal records');
  }
});

receptionRouter.post('/postal', (req: AuthRequest, res: Response) => {
  const institutionId = schoolId(req, res);
  if (!institutionId) return;
  const { type, reference_number, from_to, date, description, branch_id, received_by, notes } = req.body;
  if (!date) { res.status(400).json({ error: 'Date is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  try {
    db.prepare(`INSERT INTO postal_records (id, institution_id, type, reference_number, from_to, date, description, branch_id, received_by, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, institutionId, direction(type), empty(reference_number), empty(from_to), date, empty(description), empty(branch_id), empty(received_by), empty(notes), req.user?.id || null
    );
    res.status(201).json({ id, message: 'Record added' });
  } catch (err: any) {
    dbError(res, err, 'Failed to add postal record');
  }
});
