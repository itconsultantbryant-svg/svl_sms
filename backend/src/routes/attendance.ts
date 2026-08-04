import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const attendanceRouter = Router();

// Apply tenant middleware to ALL routes
attendanceRouter.use(injectTenant);
attendanceRouter.use(requireTenant);

attendanceRouter.get('/sessions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { class_id, section_id, date, term_id } = req.query as any;

  // TENANT ISOLATION: Always filter by institution_id
  let where = 'WHERE a.institution_id = ?';
  const params: any[] = [req.institution_id];

  if (class_id) { where += ' AND a.class_id = ?'; params.push(class_id); }
  if (section_id) { where += ' AND a.section_id = ?'; params.push(section_id); }
  if (date) { where += ' AND a.date = ?'; params.push(date); }
  if (term_id) { where += ' AND a.term_id = ?'; params.push(term_id); }

  const sessions = db.prepare(`
    SELECT a.*, c.name as class_name, sec.name as section_name,
           sub.name as subject_name, e.first_name || ' ' || e.last_name as teacher_name,
           (SELECT COUNT(*) FROM student_attendance sa WHERE sa.attendance_session_id = a.id AND sa.status = 'present') as present_count,
           (SELECT COUNT(*) FROM student_attendance sa WHERE sa.attendance_session_id = a.id AND sa.status = 'absent') as absent_count,
           (SELECT COUNT(*) FROM student_attendance sa WHERE sa.attendance_session_id = a.id AND sa.status = 'late') as late_count,
           (SELECT COUNT(*) FROM student_attendance sa WHERE sa.attendance_session_id = a.id) as total_count
    FROM attendance_sessions a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN sections sec ON a.section_id = sec.id
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    ${where}
    ORDER BY a.date DESC, a.created_at DESC
    LIMIT 50
  `).all(...params);

  res.json(sessions);
});

attendanceRouter.get('/sessions/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id
  const session = db.prepare(`
    SELECT a.*, c.name as class_name, sec.name as section_name,
           sub.name as subject_name, e.first_name || ' ' || e.last_name as teacher_name
    FROM attendance_sessions a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN sections sec ON a.section_id = sec.id
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    WHERE a.id = ? AND a.institution_id = ?
  `).get(id, req.institution_id);

  if (!session) {
    res.status(404).json({ error: 'Attendance session not found' });
    return;
  }

  // TENANT ISOLATION: Filter related students
  const records = db.prepare(`
    SELECT sa.*, s.admission_number, s.first_name, s.last_name, s.photo
    FROM student_attendance sa
    JOIN students s ON sa.student_id = s.id
    WHERE sa.attendance_session_id = ? AND s.institution_id = ?
    ORDER BY s.first_name, s.last_name
  `).all(id, req.institution_id);

  res.json({ ...(session as any), records });
});

attendanceRouter.post('/take', (req: AuthRequest, res: Response) => {
  const { class_id, section_id, subject_id, session_id, term_id, date, type, records } = req.body;

  if (!class_id || !date || !records || !Array.isArray(records)) {
    res.status(400).json({ error: 'Class, date, and attendance records are required' });
    return;
  }

  const db = getDatabase();
  const attendanceSessionId = generateId();

  const transaction = db.transaction(() => {
    // TENANT ISOLATION: Include institution_id in INSERT
    db.prepare(`
      INSERT INTO attendance_sessions (id, institution_id, class_id, section_id, subject_id, session_id, term_id, teacher_id, date, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attendanceSessionId, req.institution_id, class_id, section_id || null, subject_id || null,
      session_id || null, term_id || null, req.user?.id || null, date, type || 'class'
    );

    const insertRecord = db.prepare(`
      INSERT INTO student_attendance (id, attendance_session_id, student_id, status, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const record of records) {
      insertRecord.run(generateId(), attendanceSessionId, record.student_id, record.status, record.remarks || null);
    }
  });

  transaction();
  res.status(201).json({ id: attendanceSessionId, message: 'Attendance recorded successfully' });
});

attendanceRouter.put('/sessions/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    res.status(400).json({ error: 'Attendance records are required' });
    return;
  }

  const db = getDatabase();

  // TENANT ISOLATION: Verify session belongs to this institution
  const session = db.prepare('SELECT id FROM attendance_sessions WHERE id = ? AND institution_id = ?').get(id, req.institution_id);
  if (!session) {
    res.status(404).json({ error: 'Attendance session not found' });
    return;
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM student_attendance WHERE attendance_session_id = ?').run(id);

    const insertRecord = db.prepare(`
      INSERT INTO student_attendance (id, attendance_session_id, student_id, status, remarks)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const record of records) {
      insertRecord.run(generateId(), id, record.student_id, record.status, record.remarks || null);
    }
  });

  transaction();
  res.json({ message: 'Attendance updated successfully' });
});

attendanceRouter.get('/student/:studentId', (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
  const { term_id, session_id, month } = req.query as any;

  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  let where = 'WHERE sa.student_id = ? AND a.institution_id = ?';
  const params: any[] = [studentId, req.institution_id];

  if (term_id) { where += ' AND a.term_id = ?'; params.push(term_id); }
  if (session_id) { where += ' AND a.session_id = ?'; params.push(session_id); }
  if (month) { where += " AND strftime('%Y-%m', a.date) = ?"; params.push(month); }

  const records = db.prepare(`
    SELECT sa.status, sa.remarks, a.date, a.type, sub.name as subject_name
    FROM student_attendance sa
    JOIN attendance_sessions a ON sa.attendance_session_id = a.id
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    ${where}
    ORDER BY a.date DESC
  `).all(...params);

  const summary = db.prepare(`
    SELECT sa.status, COUNT(*) as count
    FROM student_attendance sa
    JOIN attendance_sessions a ON sa.attendance_session_id = a.id
    ${where}
    GROUP BY sa.status
  `).all(...params);

  res.json({ records, summary });
});

attendanceRouter.get('/report', (req: AuthRequest, res: Response) => {
  const { class_id, section_id, term_id, session_id, start_date, end_date } = req.query as any;

  if (!class_id) {
    res.status(400).json({ error: 'Class is required' });
    return;
  }

  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  let dateFilter = ' AND a.institution_id = ?';
  const params: any[] = [class_id, req.institution_id];

  if (section_id) { dateFilter += ' AND a.section_id = ?'; params.push(section_id); }
  if (term_id) { dateFilter += ' AND a.term_id = ?'; params.push(term_id); }
  if (session_id) { dateFilter += ' AND a.session_id = ?'; params.push(session_id); }
  if (start_date) { dateFilter += ' AND a.date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND a.date <= ?'; params.push(end_date); }

  const report = db.prepare(`
    SELECT s.id, s.admission_number, s.first_name, s.last_name,
      COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_days,
      COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_days,
      COUNT(CASE WHEN sa.status = 'late' THEN 1 END) as late_days,
      COUNT(CASE WHEN sa.status = 'excused' THEN 1 END) as excused_days,
      COUNT(sa.id) as total_days,
      ROUND(COUNT(CASE WHEN sa.status = 'present' THEN 1 END) * 100.0 / MAX(COUNT(sa.id), 1), 1) as attendance_percentage
    FROM students s
    LEFT JOIN student_attendance sa ON sa.student_id = s.id
    LEFT JOIN attendance_sessions a ON sa.attendance_session_id = a.id AND a.class_id = ? ${dateFilter}
    WHERE s.class_id = ? AND s.institution_id = ? AND s.status = 'active'
    GROUP BY s.id
    ORDER BY s.first_name, s.last_name
  `).all(...params, class_id, req.institution_id);

  res.json(report);
});
