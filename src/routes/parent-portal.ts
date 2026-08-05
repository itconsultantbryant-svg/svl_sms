import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { paginate } from '../utils/helpers';

export const parentPortalRouter = Router();

// Apply tenant middleware
parentPortalRouter.use(injectTenant);
parentPortalRouter.use(requireTenant);

// Middleware to verify user is a parent
function verifyParent(req: AuthRequest, res: Response, next: any) {
  if (req.user?.user_type !== 'parent') {
    res.status(403).json({ error: 'Access denied. Parents only.' });
    return;
  }
  next();
}

parentPortalRouter.use(verifyParent);

// ============================================
// MY CHILDREN
// ============================================

parentPortalRouter.get('/children', (req: AuthRequest, res: Response) => {
  const db = getDatabase();

  const children = db.prepare(`
    SELECT
      s.id,
      s.admission_number,
      s.first_name,
      s.last_name,
      s.photo,
      s.date_of_birth,
      s.gender,
      s.email,
      s.phone,
      c.name as class_name,
      sec.name as section_name,
      b.branch_name,
      sess.name as session_name,
      ps.relationship,
      ps.is_primary
    FROM parent_students ps
    INNER JOIN students s ON ps.student_id = s.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    LEFT JOIN academic_sessions sess ON s.session_id = sess.id
    WHERE ps.parent_id = ? AND ps.institution_id = ? AND s.is_active = 1
    ORDER BY ps.is_primary DESC, s.first_name
  `).all(req.user!.id, req.institution_id);

  res.json({ data: children });
});

// ============================================
// CHILD DASHBOARD
// ============================================

parentPortalRouter.get('/children/:childId/dashboard', (req: AuthRequest, res: Response) => {
  const { childId } = req.params;
  const db = getDatabase();

  // Verify parent has access to this child
  const link = db.prepare(`
    SELECT id, can_access_records FROM parent_students
    WHERE parent_id = ? AND student_id = ? AND institution_id = ?
  `).get(req.user!.id, childId, req.institution_id) as any;

  if (!link || !link.can_access_records) {
    res.status(403).json({ error: 'Access denied to this child\'s records' });
    return;
  }

  // Get student info
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
    WHERE s.id = ? AND s.institution_id = ?
  `).get(childId, req.institution_id) as any;

  if (!student) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  // Get stats
  const assignmentCount = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN asub.id IS NULL THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN asub.status = 'graded' THEN 1 ELSE 0 END) as graded
    FROM assignments a
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = ?
    WHERE a.institution_id = ? AND a.class_id = ? AND a.is_active = 1
  `).get(childId, req.institution_id, student.class_id) as any;

  const attendanceStats = db.prepare(`
    SELECT
      COUNT(*) as total_days,
      SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) as present_days,
      SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) as absent_days
    FROM student_attendance sa
    INNER JOIN attendance_sessions asess ON sa.attendance_session_id = asess.id
    WHERE sa.student_id = ? AND sa.institution_id = ?
    AND asess.date >= date('now', '-30 days')
  `).get(childId, req.institution_id) as any;

  const latestResult = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    WHERE r.student_id = ? AND r.institution_id = ? AND r.is_published = 1
    ORDER BY r.created_at DESC
    LIMIT 1
  `).get(childId, req.institution_id) as any;

  res.json({
    student: {
      id: student.id,
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      photo: student.photo,
      class_name: student.class_name,
      section_name: student.section_name
    },
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
        attendance_percentage: attendanceStats?.total_days > 0 ?
          Math.round((attendanceStats.present_days / attendanceStats.total_days) * 100) : 0
      },
      latest_result: latestResult
    }
  });
});

// ============================================
// CHILD GRADES
// ============================================

parentPortalRouter.get('/children/:childId/grades', (req: AuthRequest, res: Response) => {
  const { childId } = req.params;
  const db = getDatabase();

  // Verify parent has access
  const link = db.prepare(`
    SELECT id, can_access_records FROM parent_students
    WHERE parent_id = ? AND student_id = ? AND institution_id = ?
  `).get(req.user!.id, childId, req.institution_id) as any;

  if (!link || !link.can_access_records) {
    res.status(403).json({ error: 'Access denied to this child\'s records' });
    return;
  }

  const { session_id, exam_id, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE r.student_id = ? AND r.institution_id = ? AND r.is_published = 1';
  const params: any[] = [childId, req.institution_id];

  if (session_id) { where += ' AND r.session_id = ?'; params.push(session_id); }
  if (exam_id) { where += ' AND r.exam_id = ?'; params.push(exam_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM results r ${where}`).get(...params) as any;

  const grades = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name,
      c.name as class_name,
      sess.name as session_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    LEFT JOIN classes c ON r.class_id = c.id
    LEFT JOIN academic_sessions sess ON r.session_id = sess.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: grades, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// CHILD GRADESHEET
// ============================================

parentPortalRouter.get('/children/:childId/gradesheet/:examId', (req: AuthRequest, res: Response) => {
  const { childId, examId } = req.params;
  const db = getDatabase();

  // Verify parent has access
  const link = db.prepare(`
    SELECT id, can_access_records FROM parent_students
    WHERE parent_id = ? AND student_id = ? AND institution_id = ?
  `).get(req.user!.id, childId, req.institution_id) as any;

  if (!link || !link.can_access_records) {
    res.status(403).json({ error: 'Access denied to this child\'s records' });
    return;
  }

  // Get result
  const result = db.prepare(`
    SELECT
      r.*,
      e.name as exam_name,
      c.name as class_name,
      sess.name as session_name
    FROM results r
    INNER JOIN exams e ON r.exam_id = e.id
    LEFT JOIN classes c ON r.class_id = c.id
    LEFT JOIN academic_sessions sess ON r.session_id = sess.id
    WHERE r.student_id = ? AND r.exam_id = ? AND r.institution_id = ? AND r.is_published = 1
  `).get(childId, examId, req.institution_id) as any;

  if (!result) {
    res.status(404).json({ error: 'Gradesheet not found or not published' });
    return;
  }

  // Get marks
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
  `).all(examId, childId, req.institution_id);

  // Get student info
  const student = db.prepare(`
    SELECT admission_number, first_name, last_name, photo
    FROM students WHERE id = ?
  `).get(childId) as any;

  res.json({ result, marks, student });
});

// ============================================
// CHILD ASSIGNMENTS
// ============================================

parentPortalRouter.get('/children/:childId/assignments', (req: AuthRequest, res: Response) => {
  const { childId } = req.params;
  const db = getDatabase();

  // Verify parent has access
  const link = db.prepare(`
    SELECT id, can_access_records FROM parent_students
    WHERE parent_id = ? AND student_id = ? AND institution_id = ?
  `).get(req.user!.id, childId, req.institution_id) as any;

  if (!link || !link.can_access_records) {
    res.status(403).json({ error: 'Access denied to this child\'s records' });
    return;
  }

  const { status, subject_id, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  // Get student's class
  const student = db.prepare(`
    SELECT class_id, section_id FROM students WHERE id = ? AND institution_id = ?
  `).get(childId, req.institution_id) as any;

  if (!student) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  let where = `WHERE a.institution_id = ? AND a.class_id = ? AND a.is_active = 1`;
  const params: any[] = [req.institution_id, student.class_id];

  if (subject_id) { where += ' AND a.subject_id = ?'; params.push(subject_id); }

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
  `).get(childId, ...params) as any;

  const assignments = db.prepare(`
    SELECT
      a.*,
      sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name,
      asub.status as submission_status,
      asub.submitted_at,
      asub.marks_obtained,
      asub.graded_at
    FROM assignments a
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = ?
    ${where}
    ORDER BY a.due_date ASC
    LIMIT ? OFFSET ?
  `).all(childId, ...params, lim, offset);

  res.json({ data: assignments, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// CHILD ATTENDANCE
// ============================================

parentPortalRouter.get('/children/:childId/attendance', (req: AuthRequest, res: Response) => {
  const { childId } = req.params;
  const db = getDatabase();

  // Verify parent has access
  const link = db.prepare(`
    SELECT id, can_access_records FROM parent_students
    WHERE parent_id = ? AND student_id = ? AND institution_id = ?
  `).get(req.user!.id, childId, req.institution_id) as any;

  if (!link || !link.can_access_records) {
    res.status(403).json({ error: 'Access denied to this child\'s records' });
    return;
  }

  const { start_date, end_date, page = '1', limit = '50' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE sa.student_id = ? AND sa.institution_id = ?';
  const params: any[] = [childId, req.institution_id];

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
      sub.name as subject_name
    FROM student_attendance sa
    INNER JOIN attendance_sessions asess ON sa.attendance_session_id = asess.id
    LEFT JOIN subjects sub ON asess.subject_id = sub.id
    ${where}
    ORDER BY asess.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: attendance, total: total.count, page: parseInt(page), limit: lim });
});

export default parentPortalRouter;
