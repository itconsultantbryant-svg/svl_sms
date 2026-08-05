import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';

export const teacherDashboardRouter = Router();

// Apply tenant middleware
teacherDashboardRouter.use(injectTenant);
teacherDashboardRouter.use(requireTenant);

// Middleware to verify user is a teacher and get their employee ID
function getTeacherEmployee(req: AuthRequest, res: Response, next: any) {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Access denied. Teachers only.' });
    return;
  }

  const db = getDatabase();
  const employee = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, phone, department_id, branch_id
    FROM employees
    WHERE user_id = ? AND institution_id = ? AND is_teacher = 1 AND is_active = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!employee) {
    res.status(404).json({ error: 'Teacher employee record not found' });
    return;
  }

  (req as any).teacherEmployee = employee;
  next();
}

teacherDashboardRouter.use(getTeacherEmployee);

// ============================================
// TEACHER DASHBOARD - OVERVIEW
// ============================================

teacherDashboardRouter.get('/overview', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const teacherId = (req as any).teacherEmployee.id;

  // Get current session
  const currentSession = db.prepare(`
    SELECT id, name FROM academic_sessions
    WHERE institution_id = ? AND is_current = 1
  `).get(req.institution_id) as any;

  if (!currentSession) {
    res.status(404).json({ error: 'No active academic session found' });
    return;
  }

  // Count assigned classes
  const classCount = db.prepare(`
    SELECT COUNT(DISTINCT CONCAT(class_id, '-', COALESCE(section_id, ''))) as count
    FROM teacher_assignments
    WHERE employee_id = ? AND institution_id = ? AND session_id = ?
  `).get(teacherId, req.institution_id, currentSession.id) as any;

  // Count total students across all assigned classes
  const studentCount = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as count
    FROM students s
    INNER JOIN teacher_assignments ta ON (
      s.class_id = ta.class_id AND
      (ta.section_id IS NULL OR s.section_id = ta.section_id)
    )
    WHERE ta.employee_id = ? AND ta.institution_id = ? AND s.is_active = 1
  `).get(teacherId, req.institution_id) as any;

  // Count pending assignments to grade
  const pendingGrades = db.prepare(`
    SELECT COUNT(*) as count
    FROM assignment_submissions asub
    INNER JOIN assignments a ON asub.assignment_id = a.id
    WHERE a.teacher_id = ? AND a.institution_id = ? AND asub.status = 'submitted'
  `).get(teacherId, req.institution_id) as any;

  // Upcoming classes today (from timetable)
  const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
  const upcomingClasses = db.prepare(`
    SELECT
      te.*,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      tp.name as period_name,
      tp.start_time,
      tp.end_time
    FROM timetable_entries te
    INNER JOIN timetable_periods tp ON te.period_id = tp.id
    LEFT JOIN classes c ON te.class_id = c.id
    LEFT JOIN sections sec ON te.section_id = sec.id
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    WHERE te.teacher_id = ? AND te.institution_id = ? AND te.day_of_week = ?
    ORDER BY tp.start_time ASC
    LIMIT 5
  `).all(teacherId, req.institution_id, today);

  res.json({
    session: currentSession,
    stats: {
      total_classes: classCount.count,
      total_students: studentCount.count,
      pending_grades: pendingGrades.count
    },
    upcoming_classes: upcomingClasses
  });
});

// ============================================
// MY CLASSES & SUBJECTS
// ============================================

teacherDashboardRouter.get('/my-classes', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const teacherId = (req as any).teacherEmployee.id;
  const { session_id } = req.query;

  // Get current or specified session
  let sessionFilter = 'sess.is_current = 1';
  const params: any[] = [teacherId, req.institution_id];

  if (session_id) {
    sessionFilter = 'sess.id = ?';
    params.push(session_id);
  }

  const classes = db.prepare(`
    SELECT
      ta.id as assignment_id,
      ta.is_class_teacher,
      c.id as class_id,
      c.name as class_name,
      sec.id as section_id,
      sec.name as section_name,
      sub.id as subject_id,
      sub.name as subject_name,
      sub.code as subject_code,
      sess.id as session_id,
      sess.name as session_name,
      (SELECT COUNT(*) FROM students WHERE class_id = c.id AND (section_id IS NULL OR section_id = sec.id) AND is_active = 1) as student_count
    FROM teacher_assignments ta
    INNER JOIN classes c ON ta.class_id = c.id
    LEFT JOIN sections sec ON ta.section_id = sec.id
    INNER JOIN subjects sub ON ta.subject_id = sub.id
    INNER JOIN academic_sessions sess ON ta.session_id = sess.id
    WHERE ta.employee_id = ? AND ta.institution_id = ? AND ${sessionFilter}
    ORDER BY c.name, sec.name, sub.name
  `).all(...params);

  res.json({ data: classes });
});

// ============================================
// STUDENTS IN MY CLASSES
// ============================================

teacherDashboardRouter.get('/my-students', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const teacherId = (req as any).teacherEmployee.id;
  const { class_id, section_id, page = '1', limit = '50', search = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['s.first_name', 's.last_name', 's.admission_number'],
    search
  );

  if (!class_id) {
    res.status(400).json({ error: 'class_id is required' });
    return;
  }

  // Verify teacher is assigned to this class
  const assignment = db.prepare(`
    SELECT id FROM teacher_assignments
    WHERE employee_id = ? AND institution_id = ? AND class_id = ?
    ${section_id ? 'AND section_id = ?' : ''}
  `).get(section_id ? [teacherId, req.institution_id, class_id, section_id] : [teacherId, req.institution_id, class_id]);

  if (!assignment) {
    res.status(403).json({ error: 'You are not assigned to this class' });
    return;
  }

  let where = 'WHERE s.institution_id = ? AND s.class_id = ? AND s.is_active = 1 ' + searchClause;
  const params: any[] = [req.institution_id, class_id, ...searchParams];

  if (section_id) {
    where += ' AND s.section_id = ?';
    params.push(section_id);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM students s ${where}`).get(...params) as any;

  const students = db.prepare(`
    SELECT
      s.id,
      s.admission_number,
      s.first_name,
      s.last_name,
      s.photo,
      s.email,
      s.phone,
      s.gender,
      s.date_of_birth,
      c.name as class_name,
      sec.name as section_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    ${where}
    ORDER BY s.first_name, s.last_name
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: students, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// ATTENDANCE - MARK ATTENDANCE
// ============================================

teacherDashboardRouter.post('/attendance', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const teacherId = (req as any).teacherEmployee.id;
  const { class_id, section_id, subject_id, date, attendance_records } = req.body;

  // attendance_records format: [{ student_id, status, remarks }]

  if (!class_id || !date || !Array.isArray(attendance_records)) {
    res.status(400).json({ error: 'class_id, date, and attendance_records array are required' });
    return;
  }

  // Verify teacher assignment
  const assignment = db.prepare(`
    SELECT id, session_id, subject_id FROM teacher_assignments
    WHERE employee_id = ? AND institution_id = ? AND class_id = ?
    ${section_id ? 'AND section_id = ?' : ''}
    ${subject_id ? 'AND subject_id = ?' : ''}
  `).get(
    section_id && subject_id ? [teacherId, req.institution_id, class_id, section_id, subject_id] :
    section_id ? [teacherId, req.institution_id, class_id, section_id] :
    subject_id ? [teacherId, req.institution_id, class_id, subject_id] :
    [teacherId, req.institution_id, class_id]
  ) as any;

  if (!assignment) {
    res.status(403).json({ error: 'You are not assigned to this class/subject' });
    return;
  }

  const sessionId = generateId();

  const transaction = db.transaction(() => {
    // 1. Create attendance session
    db.prepare(`
      INSERT INTO attendance_sessions (
        id, institution_id, class_id, section_id, subject_id,
        session_id, teacher_id, date, type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, req.institution_id, class_id, section_id || null, subject_id || null,
      assignment.session_id, teacherId, date, subject_id ? 'subject' : 'class'
    );

    // 2. Insert attendance records
    const stmt = db.prepare(`
      INSERT INTO student_attendance (
        id, institution_id, attendance_session_id, student_id, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const record of attendance_records) {
      stmt.run(
        generateId(),
        req.institution_id,
        sessionId,
        record.student_id,
        record.status,
        record.remarks || null
      );
    }
  });

  try {
    transaction();
    res.status(201).json({ id: sessionId, message: 'Attendance marked successfully' });
  } catch (error: any) {
    console.error('Attendance marking error:', error);
    res.status(500).json({ error: 'Failed to mark attendance', details: error.message });
  }
});

// Get attendance history
teacherDashboardRouter.get('/attendance', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const teacherId = (req as any).teacherEmployee.id;
  const { class_id, section_id, subject_id, start_date, end_date, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE asess.institution_id = ? AND asess.teacher_id = ?';
  const params: any[] = [req.institution_id, teacherId];

  if (class_id) { where += ' AND asess.class_id = ?'; params.push(class_id); }
  if (section_id) { where += ' AND asess.section_id = ?'; params.push(section_id); }
  if (subject_id) { where += ' AND asess.subject_id = ?'; params.push(subject_id); }
  if (start_date) { where += ' AND asess.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND asess.date <= ?'; params.push(end_date); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM attendance_sessions asess ${where}`).get(...params) as any;

  const sessions = db.prepare(`
    SELECT
      asess.*,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      (SELECT COUNT(*) FROM student_attendance WHERE attendance_session_id = asess.id) as total_students,
      (SELECT COUNT(*) FROM student_attendance WHERE attendance_session_id = asess.id AND status = 'present') as present_count,
      (SELECT COUNT(*) FROM student_attendance WHERE attendance_session_id = asess.id AND status = 'absent') as absent_count
    FROM attendance_sessions asess
    LEFT JOIN classes c ON asess.class_id = c.id
    LEFT JOIN sections sec ON asess.section_id = sec.id
    LEFT JOIN subjects sub ON asess.subject_id = sub.id
    ${where}
    ORDER BY asess.date DESC, asess.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: sessions, total: total.count, page: parseInt(page), limit: lim });
});

export default teacherDashboardRouter;
