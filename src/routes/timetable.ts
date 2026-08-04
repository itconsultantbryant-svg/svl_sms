import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const timetableRouter = Router();

// Apply tenant middleware to ALL routes
timetableRouter.use(injectTenant);
timetableRouter.use(requireTenant);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Periods
timetableRouter.get('/periods', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { branch_id } = req.query as any;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (branch_id) { where += ' AND branch_id = ?'; params.push(branch_id); }

  const periods = db.prepare(`SELECT * FROM timetable_periods ${where} ORDER BY sort_order, start_time`).all(...params);
  res.json(periods);
});

timetableRouter.post('/periods', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, start_time, end_time, is_break, branch_id, sort_order } = req.body;

  if (!name || !start_time || !end_time) {
    res.status(400).json({ error: 'Name, start time, and end time are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  db.prepare(`
    INSERT INTO timetable_periods (id, branch_id, name, start_time, end_time, is_break, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, branch_id || null, name, start_time, end_time, is_break ? 1 : 0, sort_order || 0);

  res.status(201).json({ id, message: 'Period created successfully' });
});

timetableRouter.put('/periods/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, start_time, end_time, is_break, sort_order } = req.body;

  const db = getDatabase();
  db.prepare(`
    UPDATE timetable_periods SET name = COALESCE(?, name), start_time = COALESCE(?, start_time),
    end_time = COALESCE(?, end_time), is_break = COALESCE(?, is_break), sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name, start_time, end_time, is_break, sort_order, id);

  res.json({ message: 'Period updated successfully' });
});

timetableRouter.delete('/periods/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM timetable_periods WHERE id = ?').run(id);
  res.json({ message: 'Period deleted successfully' });
});

// Timetable entries
timetableRouter.get('/class/:classId', (req: AuthRequest, res: Response) => {
  const { classId } = req.params;
  const { section_id, session_id } = req.query as any;

  const db = getDatabase();
  let where = 'WHERE te.class_id = ?';
  const params: any[] = [classId];

  if (section_id) { where += ' AND te.section_id = ?'; params.push(section_id); }
  if (session_id) { where += ' AND te.session_id = ?'; params.push(session_id); }

  const entries = db.prepare(`
    SELECT te.*, sub.name as subject_name, sub.code as subject_code,
           e.first_name || ' ' || e.last_name as teacher_name,
           tp.name as period_name, tp.start_time, tp.end_time, tp.is_break
    FROM timetable_entries te
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    LEFT JOIN employees e ON te.teacher_id = e.id
    LEFT JOIN timetable_periods tp ON te.period_id = tp.id
    ${where}
    ORDER BY te.day_of_week, tp.sort_order
  `).all(...params);

  const grouped: Record<number, any[]> = {};
  for (let i = 0; i < 7; i++) grouped[i] = [];
  (entries as any[]).forEach(e => grouped[e.day_of_week].push(e));

  res.json({ entries, byDay: grouped, days: DAYS });
});

timetableRouter.get('/teacher/:teacherId', (req: AuthRequest, res: Response) => {
  const { teacherId } = req.params;
  const { session_id } = req.query as any;

  const db = getDatabase();
  let where = 'WHERE te.teacher_id = ?';
  const params: any[] = [teacherId];
  if (session_id) { where += ' AND te.session_id = ?'; params.push(session_id); }

  const entries = db.prepare(`
    SELECT te.*, sub.name as subject_name, c.name as class_name, sec.name as section_name,
           tp.name as period_name, tp.start_time, tp.end_time
    FROM timetable_entries te
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    LEFT JOIN classes c ON te.class_id = c.id
    LEFT JOIN sections sec ON te.section_id = sec.id
    LEFT JOIN timetable_periods tp ON te.period_id = tp.id
    ${where}
    ORDER BY te.day_of_week, tp.sort_order
  `).all(...params);

  res.json(entries);
});

timetableRouter.post('/entries', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { class_id, section_id, subject_id, teacher_id, period_id, session_id, day_of_week, room } = req.body;

  if (!class_id || !period_id || day_of_week === undefined || !session_id) {
    res.status(400).json({ error: 'Class, period, day, and session are required' });
    return;
  }

  const db = getDatabase();

  // Check for conflicts
  const conflict = db.prepare(`
    SELECT te.id, sub.name as subject_name, c.name as class_name
    FROM timetable_entries te
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    LEFT JOIN classes c ON te.class_id = c.id
    WHERE te.teacher_id = ? AND te.period_id = ? AND te.day_of_week = ? AND te.session_id = ?
    AND te.class_id != ?
  `).get(teacher_id, period_id, day_of_week, session_id, class_id) as any;

  if (conflict) {
    res.status(409).json({
      error: `Teacher is already assigned to ${conflict.class_name} (${conflict.subject_name}) at this time`
    });
    return;
  }

  const id = generateId();
  db.prepare(`
    INSERT OR REPLACE INTO timetable_entries (id, class_id, section_id, subject_id, teacher_id, period_id, session_id, day_of_week, room)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, class_id, section_id || null, subject_id || null, teacher_id || null, period_id, session_id, day_of_week, room || null);

  res.status(201).json({ id, message: 'Timetable entry created successfully' });
});

timetableRouter.delete('/entries/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM timetable_entries WHERE id = ?').run(id);
  res.json({ message: 'Entry removed successfully' });
});
