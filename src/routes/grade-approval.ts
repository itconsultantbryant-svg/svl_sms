import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant, institutionAdminOrHigher } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const gradeApprovalRouter = Router();

// Apply tenant middleware
gradeApprovalRouter.use(injectTenant);
gradeApprovalRouter.use(requireTenant);

// ============================================
// TEACHER - SUBMIT GRADES FOR APPROVAL
// ============================================

gradeApprovalRouter.post('/submit', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can submit grades' });
    return;
  }

  const db = getDatabase();

  // Get teacher's employee ID
  const teacher = db.prepare(`
    SELECT id FROM employees
    WHERE user_id = ? AND institution_id = ? AND is_teacher = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!teacher) {
    res.status(404).json({ error: 'Teacher record not found' });
    return;
  }

  const {
    exam_id, class_id, section_id, subject_id, session_id, term_id
  } = req.body;

  if (!exam_id || !class_id || !subject_id || !session_id) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['exam_id', 'class_id', 'subject_id', 'session_id']
    });
    return;
  }

  // Verify teacher is assigned to this class/subject
  const assignment = db.prepare(`
    SELECT id FROM teacher_assignments
    WHERE employee_id = ? AND institution_id = ? AND class_id = ? AND subject_id = ? AND session_id = ?
    ${section_id ? 'AND section_id = ?' : ''}
  `).get(
    section_id ? [teacher.id, req.institution_id, class_id, subject_id, session_id, section_id] :
    [teacher.id, req.institution_id, class_id, subject_id, session_id]
  );

  if (!assignment) {
    res.status(403).json({ error: 'You are not assigned to this class/subject' });
    return;
  }

  // Count students who have marks entered
  const studentCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM marks m
    INNER JOIN exam_schedules es ON m.exam_schedule_id = es.id
    WHERE es.exam_id = ? AND es.class_id = ? AND es.subject_id = ?
    ${section_id ? 'AND es.section_id = ?' : ''}
  `).get(
    section_id ? [exam_id, class_id, subject_id, section_id] :
    [exam_id, class_id, subject_id]
  ) as any;

  if (studentCount.count === 0) {
    res.status(400).json({ error: 'No marks entered for this exam/class/subject' });
    return;
  }

  const id = generateId();

  try {
    db.prepare(`
      INSERT INTO grade_submissions (
        id, institution_id, exam_id, class_id, section_id, subject_id,
        session_id, term_id, teacher_id, submitted_at, student_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      id, req.institution_id, exam_id, class_id, section_id || null, subject_id,
      session_id, term_id || null, teacher.id, studentCount.count
    );

    // Notify admins
    const admins = db.prepare(`
      SELECT id FROM users
      WHERE institution_id = ? AND user_type IN ('platform_admin', 'institution_admin') AND is_active = 1
    `).all(req.institution_id);

    const notifStmt = db.prepare(`
      INSERT INTO notifications (
        id, institution_id, user_id, title, message, type,
        related_entity_type, related_entity_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const admin of admins as any[]) {
      notifStmt.run(
        generateId(), req.institution_id, admin.id,
        'Grade Approval Required',
        `${req.user.first_name} ${req.user.last_name} submitted grades for approval`,
        'approval',
        'grade_submission', id
      );
    }

    res.status(201).json({ id, message: 'Grades submitted for approval successfully' });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Grades already submitted for this exam/class/subject' });
    } else {
      console.error('Grade submission error:', error);
      res.status(500).json({ error: 'Failed to submit grades', details: error.message });
    }
  }
});

// ============================================
// TEACHER - VIEW MY SUBMISSIONS
// ============================================

gradeApprovalRouter.get('/my-submissions', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can view submissions' });
    return;
  }

  const db = getDatabase();
  const { page = '1', limit = '20', status } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  const teacher = db.prepare(`
    SELECT id FROM employees
    WHERE user_id = ? AND institution_id = ? AND is_teacher = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!teacher) {
    res.status(404).json({ error: 'Teacher record not found' });
    return;
  }

  let where = 'WHERE gs.institution_id = ? AND gs.teacher_id = ?';
  const params: any[] = [req.institution_id, teacher.id];

  if (status) {
    where += ' AND gs.approval_status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM grade_submissions gs ${where}`).get(...params) as any;

  const submissions = db.prepare(`
    SELECT
      gs.*,
      e.name as exam_name,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      sess.name as session_name,
      u.first_name || ' ' || u.last_name as approved_by_name
    FROM grade_submissions gs
    LEFT JOIN exams e ON gs.exam_id = e.id
    LEFT JOIN classes c ON gs.class_id = c.id
    LEFT JOIN sections sec ON gs.section_id = sec.id
    LEFT JOIN subjects sub ON gs.subject_id = sub.id
    LEFT JOIN academic_sessions sess ON gs.session_id = sess.id
    LEFT JOIN users u ON gs.approved_by = u.id
    ${where}
    ORDER BY gs.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: submissions, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// ADMIN - VIEW PENDING APPROVALS
// ============================================

gradeApprovalRouter.get('/pending', institutionAdminOrHigher, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  const where = 'WHERE gs.institution_id = ? AND gs.approval_status = ?';
  const params: any[] = [req.institution_id, 'pending'];

  const total = db.prepare(`SELECT COUNT(*) as count FROM grade_submissions gs ${where}`).get(...params) as any;

  const pending = db.prepare(`
    SELECT
      gs.*,
      e.name as exam_name,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      sess.name as session_name,
      t.first_name || ' ' || t.last_name as teacher_name
    FROM grade_submissions gs
    LEFT JOIN exams e ON gs.exam_id = e.id
    LEFT JOIN classes c ON gs.class_id = c.id
    LEFT JOIN sections sec ON gs.section_id = sec.id
    LEFT JOIN subjects sub ON gs.subject_id = sub.id
    LEFT JOIN academic_sessions sess ON gs.session_id = sess.id
    LEFT JOIN employees t ON gs.teacher_id = t.id
    ${where}
    ORDER BY gs.submitted_at ASC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: pending, total: total.count, page: parseInt(page), limit: lim });
});

// ============================================
// ADMIN - APPROVE GRADES
// ============================================

gradeApprovalRouter.post('/:id/approve', institutionAdminOrHigher, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const submission = db.prepare(`
    SELECT id, exam_id, class_id, section_id, subject_id, approval_status
    FROM grade_submissions
    WHERE id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!submission) {
    res.status(404).json({ error: 'Grade submission not found' });
    return;
  }

  if (submission.approval_status !== 'pending') {
    res.status(400).json({ error: 'Grades already processed', status: submission.approval_status });
    return;
  }

  try {
    const transaction = db.transaction(() => {
      // 1. Update submission status
      db.prepare(`
        UPDATE grade_submissions SET
          approval_status = 'approved',
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(req.user!.id, id);

      // 2. Update all related results to published
      db.prepare(`
        UPDATE results SET
          is_published = 1,
          updated_at = datetime('now')
        WHERE exam_id = ? AND class_id = ? AND institution_id = ?
        ${submission.section_id ? 'AND section_id = ?' : ''}
      `).run(
        submission.section_id ?
        [submission.exam_id, submission.class_id, req.institution_id, submission.section_id] :
        [submission.exam_id, submission.class_id, req.institution_id]
      );

      // 3. Notify students
      const students = db.prepare(`
        SELECT DISTINCT s.user_id
        FROM students s
        INNER JOIN results r ON s.id = r.student_id
        WHERE r.exam_id = ? AND r.class_id = ? AND r.institution_id = ? AND s.user_id IS NOT NULL
        ${submission.section_id ? 'AND r.section_id = ?' : ''}
      `).all(
        submission.section_id ?
        [submission.exam_id, submission.class_id, req.institution_id, submission.section_id] :
        [submission.exam_id, submission.class_id, req.institution_id]
      );

      const notifStmt = db.prepare(`
        INSERT INTO notifications (
          id, institution_id, user_id, title, message, type,
          related_entity_type, related_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const student of students as any[]) {
        notifStmt.run(
          generateId(), req.institution_id, student.user_id,
          'Grades Published',
          'Your exam results are now available',
          'grade',
          'result', null
        );
      }
    });

    transaction();
    res.json({ message: 'Grades approved and published successfully' });
  } catch (error: any) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve grades', details: error.message });
  }
});

// ============================================
// ADMIN - REJECT GRADES
// ============================================

gradeApprovalRouter.post('/:id/reject', institutionAdminOrHigher, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;
  const db = getDatabase();

  if (!rejection_reason) {
    res.status(400).json({ error: 'rejection_reason is required' });
    return;
  }

  const submission = db.prepare(`
    SELECT id, teacher_id, approval_status FROM grade_submissions
    WHERE id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!submission) {
    res.status(404).json({ error: 'Grade submission not found' });
    return;
  }

  if (submission.approval_status !== 'pending') {
    res.status(400).json({ error: 'Grades already processed', status: submission.approval_status });
    return;
  }

  try {
    db.prepare(`
      UPDATE grade_submissions SET
        approval_status = 'rejected',
        approved_by = ?,
        approved_at = datetime('now'),
        rejection_reason = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.user!.id, rejection_reason, id);

    // Notify teacher
    const teacherUser = db.prepare(`
      SELECT user_id FROM employees WHERE id = ?
    `).get(submission.teacher_id) as any;

    if (teacherUser?.user_id) {
      db.prepare(`
        INSERT INTO notifications (
          id, institution_id, user_id, title, message, type,
          related_entity_type, related_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(), req.institution_id, teacherUser.user_id,
        'Grade Submission Rejected',
        `Reason: ${rejection_reason}`,
        'approval',
        'grade_submission', id
      );
    }

    res.json({ message: 'Grades rejected successfully' });
  } catch (error: any) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject grades', details: error.message });
  }
});

// ============================================
// ADMIN - VIEW ALL SUBMISSIONS
// ============================================

gradeApprovalRouter.get('/all', institutionAdminOrHigher, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', status, exam_id, class_id } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE gs.institution_id = ?';
  const params: any[] = [req.institution_id];

  if (status) { where += ' AND gs.approval_status = ?'; params.push(status); }
  if (exam_id) { where += ' AND gs.exam_id = ?'; params.push(exam_id); }
  if (class_id) { where += ' AND gs.class_id = ?'; params.push(class_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM grade_submissions gs ${where}`).get(...params) as any;

  const submissions = db.prepare(`
    SELECT
      gs.*,
      e.name as exam_name,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      sess.name as session_name,
      t.first_name || ' ' || t.last_name as teacher_name,
      u.first_name || ' ' || u.last_name as approved_by_name
    FROM grade_submissions gs
    LEFT JOIN exams e ON gs.exam_id = e.id
    LEFT JOIN classes c ON gs.class_id = c.id
    LEFT JOIN sections sec ON gs.section_id = sec.id
    LEFT JOIN subjects sub ON gs.subject_id = sub.id
    LEFT JOIN academic_sessions sess ON gs.session_id = sess.id
    LEFT JOIN employees t ON gs.teacher_id = t.id
    LEFT JOIN users u ON gs.approved_by = u.id
    ${where}
    ORDER BY gs.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: submissions, total: total.count, page: parseInt(page), limit: lim });
});

export default gradeApprovalRouter;
