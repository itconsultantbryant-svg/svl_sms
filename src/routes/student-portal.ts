import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { paginate } from '../utils/helpers';

export const studentPortalRouter = Router();

// Apply tenant middleware
studentPortalRouter.use(injectTenant);
studentPortalRouter.use(requireTenant);

// Middleware to verify user is a student and get their record
function getStudentRecord(req: AuthRequest, res: Response, next: any) {
  if (req.user?.user_type !== 'student') {
    res.status(403).json({ error: 'Access denied. Students only.' });
    return;
  }

  const db = getDatabase();
  const student = db.prepare(`
    SELECT
      s.*,
      c.name as class_name,
      sec.name as section_name,
      b.branch_name,
      sess.name as session_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    LEFT JOIN academic_sessions sess ON s.session_id = sess.id
    WHERE s.user_id = ? AND s.institution_id = ? AND s.is_active = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!student) {
    res.status(404).json({ error: 'Student record not found' });
    return;
  }

  (req as any).student = student;
  next();
}

studentPortalRouter.use(getStudentRecord);

// ============================================
// STUDENT DASHBOARD - OVERVIEW
// ============================================

studentPortalRouter.get('/dashboard', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const student = (req as any).student;

  // Get current session
  const currentSession = db.prepare(`
    SELECT id, name FROM academic_sessions
    WHERE institution_id = ? AND is_current = 1
  `).get(req.institution_id) as any;

  // Count assignments
  const assignmentCount = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN asub.id IS NULL THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN asub.status = 'graded' THEN 1 ELSE 0 END) as graded
    FROM assignments a
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = ?
    WHERE a.institution_id = ? AND a.class_id = ? AND a.is_active = 1
    ${student.section_id ? 'AND (a.section_id IS NULL OR a.section_id = ?)' : ''}
  `).get(
    student.section_id ? [student.id, req.institution_id, student.class_id, student.section_id] :
    [student.id, req.institution_id, student.class_id]
  ) as any;

  // Get attendance stats (last 30 days)
  const attendanceStats = db.prepare(`
    SELECT
      COUNT(*) as total_days,
      SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
      SUM(CASE WHEN sa.status = 'late' THEN 1 ELSE 0 END) as late_days
    FROM student_attendance sa
    INNER JOIN attendance_sessions asess ON sa.attendance_session_id = asess.id
    WHERE sa.student_id = ? AND sa.institution_id = ?
    AND asess.date >= date('now', '-30 days')
  `).get(student.id, req.institution_id) as any;

  // Get latest results
  const latestResult = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    WHERE r.student_id = ? AND r.institution_id = ? AND r.is_published = 1
    ORDER BY r.created_at DESC
    LIMIT 1
  `).get(student.id, req.institution_id) as any;

  res.json({
    student: {
      id: student.id,
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      photo: student.photo,
      class_name: student.class_name,
      section_name: student.section_name,
      session_name: student.session_name
    },
    session: currentSession,
    stats: {
      assignments: {
        total: assignmentCount.total || 0,
        pending: assignmentCount.pending || 0,
        graded: assignmentCount.graded || 0
      },
      attendance: {
        total_days: attendanceStats?.total_days || 0,
        present_days: attendanceStats?.present_days || 0,
        absent_days: attendanceStats?.absent_days || 0,
        late_days: attendanceStats?.late_days || 0,
        attendance_percentage: attendanceStats?.total_days > 0 ?
          Math.round((attendanceStats.present_days / attendanceStats.total_days) * 100) : 0
      },
      latest_result: latestResult
    }
  });
});

// ============================================
// MY GRADES
// ============================================

studentPortalRouter.get('/grades', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const student = (req as any).student;
  const { session_id, exam_id, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE r.student_id = ? AND r.institution_id = ? AND r.is_published = 1';
  const params: any[] = [student.id, req.institution_id];

  if (session_id) { where += ' AND r.session_id = ?'; params.push(session_id); }
  if (exam_id) { where += ' AND r.exam_id = ?'; params.push(exam_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM results r ${where}`).get(...params) as any;

  const grades = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name,
      e.exam_type_id,
      et.name as exam_type_name,
      c.name as class_name,
      sec.name as section_name,
      sess.name as session_name,
      t.name as term_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    LEFT JOIN exam_types et ON e.exam_type_id = et.id
    LEFT JOIN classes c ON r.class_id = c.id
    LEFT JOIN sections sec ON r.section_id = sec.id
    LEFT JOIN academic_sessions sess ON r.session_id = sess.id
    LEFT JOIN terms t ON r.term_id = t.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: grades, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// DETAILED GRADESHEET FOR EXAM
// ============================================

studentPortalRouter.get('/gradesheet/:examId', (req: AuthRequest, res: Response) => {
  const { examId } = req.params;
  const db = getDatabase();
  const student = (req as any).student;

  // Get result
  const result = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name,
      e.start_date,
      e.end_date,
      c.name as class_name,
      sec.name as section_name,
      sess.name as session_name,
      t.name as term_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    LEFT JOIN classes c ON r.class_id = c.id
    LEFT JOIN sections sec ON r.section_id = sec.id
    LEFT JOIN academic_sessions sess ON r.session_id = sess.id
    LEFT JOIN terms t ON r.term_id = t.id
    WHERE r.student_id = ? AND r.exam_id = ? AND r.institution_id = ? AND r.is_published = 1
  `).get(student.id, examId, req.institution_id) as any;

  if (!result) {
    res.status(404).json({ error: 'Gradesheet not found or not published' });
    return;
  }

  // Get subject-wise marks
  const marks = db.prepare(`
    SELECT
      m.*,
      es.full_marks,
      es.pass_marks,
      sub.name as subject_name,
      sub.code as subject_code
    FROM marks m
    INNER JOIN exam_schedules es ON m.exam_schedule_id = es.id
    INNER JOIN subjects sub ON es.subject_id = sub.id
    WHERE es.exam_id = ? AND m.student_id = ? AND es.institution_id = ?
    ORDER BY sub.name
  `).all(examId, student.id, req.institution_id);

  res.json({
    result,
    marks,
    student: {
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      photo: student.photo,
      class_name: student.class_name,
      section_name: student.section_name
    }
  });
});

// ============================================
// MY ASSIGNMENTS
// ============================================

studentPortalRouter.get('/assignments', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const student = (req as any).student;
  const { status, subject_id, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = `WHERE a.institution_id = ? AND a.class_id = ? AND a.is_active = 1
    ${student.section_id ? 'AND (a.section_id IS NULL OR a.section_id = ?)' : ''}`;
  const params: any[] = student.section_id ?
    [req.institution_id, student.class_id, student.section_id] :
    [req.institution_id, student.class_id];

  if (subject_id) { where += ' AND a.subject_id = ?'; params.push(subject_id); }

  // Filter by submission status
  if (status === 'pending') {
    where += ' AND asub.id IS NULL';
  } else if (status === 'submitted') {
    where += ' AND asub.status IN (\'submitted\', \'late\')';
  } else if (status === 'graded') {
    where += ' AND asub.status = \'graded\'';
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM assignments a
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = ?
    ${where}
  `).get(student.id, ...params) as any;

  const assignments = db.prepare(`
    SELECT
      a.*,
      sub.name as subject_name,
      sub.code as subject_code,
      e.first_name || ' ' || e.last_name as teacher_name,
      asub.id as submission_id,
      asub.status as submission_status,
      asub.submitted_at,
      asub.marks_obtained,
      asub.feedback,
      asub.graded_at
    FROM assignments a
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = ?
    ${where}
    ORDER BY a.due_date ASC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(student.id, ...params, lim, offset);

  res.json({ data: assignments, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// MY ATTENDANCE
// ============================================

studentPortalRouter.get('/attendance', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const student = (req as any).student;
  const { start_date, end_date, page = '1', limit = '50' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE sa.student_id = ? AND sa.institution_id = ?';
  const params: any[] = [student.id, req.institution_id];

  if (start_date) { where += ' AND asess.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND asess.date <= ?'; params.push(end_date); }

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM student_attendance sa
    INNER JOIN attendance_sessions asess ON sa.attendance_session_id = asess.id
    ${where}
  `).get(...params) as any;

  const attendance = db.prepare(`
    SELECT
      sa.*,
      asess.date,
      asess.type,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name
    FROM student_attendance sa
    INNER JOIN attendance_sessions asess ON sa.attendance_session_id = asess.id
    LEFT JOIN classes c ON asess.class_id = c.id
    LEFT JOIN sections sec ON asess.section_id = sec.id
    LEFT JOIN subjects sub ON asess.subject_id = sub.id
    LEFT JOIN employees e ON asess.teacher_id = e.id
    ${where}
    ORDER BY asess.date DESC, asess.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: attendance, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// MY NOTIFICATIONS
// ============================================

studentPortalRouter.get('/notifications', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', unread_only } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE n.user_id = ? AND n.institution_id = ?';
  const params: any[] = [req.user!.id, req.institution_id];

  if (unread_only === 'true') {
    where += ' AND n.is_read = 0';
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM notifications n ${where}`).get(...params) as any;

  const notifications = db.prepare(`
    SELECT * FROM notifications
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: notifications, total: total.count, page: parseInt(page), limit: lim });
});

// Mark notification as read
studentPortalRouter.patch('/notifications/:id/read', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const result = db.prepare(`
    UPDATE notifications SET
      is_read = 1,
      read_at = datetime('now')
    WHERE id = ? AND user_id = ? AND institution_id = ?
  `).run(id, req.user!.id, req.institution_id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  res.json({ message: 'Notification marked as read' });
});

export default studentPortalRouter;
