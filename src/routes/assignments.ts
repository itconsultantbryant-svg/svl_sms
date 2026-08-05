import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';

export const assignmentsRouter = Router();

// Apply tenant middleware
assignmentsRouter.use(injectTenant);
assignmentsRouter.use(requireTenant);

// ============================================
// TEACHER - CREATE & MANAGE ASSIGNMENTS
// ============================================

// Create assignment (Teachers only)
assignmentsRouter.post('/', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can create assignments' });
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
    title, description, type, class_id, section_id, subject_id,
    session_id, term_id, max_marks, assigned_date, due_date,
    attachment_url, attachment_name
  } = req.body;

  if (!title || !type || !class_id || !subject_id || !session_id || !due_date) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['title', 'type', 'class_id', 'subject_id', 'session_id', 'due_date']
    });
    return;
  }

  // Verify teacher is assigned to this class/subject
  const assignment = db.prepare(`
    SELECT id FROM teacher_assignments
    WHERE employee_id = ? AND institution_id = ? AND class_id = ? AND subject_id = ?
    ${section_id ? 'AND section_id = ?' : ''}
  `).get(
    section_id ? [teacher.id, req.institution_id, class_id, subject_id, section_id] :
    [teacher.id, req.institution_id, class_id, subject_id]
  );

  if (!assignment) {
    res.status(403).json({ error: 'You are not assigned to this class/subject' });
    return;
  }

  const id = generateId();

  try {
    db.prepare(`
      INSERT INTO assignments (
        id, institution_id, title, description, type, class_id, section_id,
        subject_id, session_id, term_id, teacher_id, max_marks,
        assigned_date, due_date, attachment_url, attachment_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.institution_id, title, description, type, class_id, section_id || null,
      subject_id, session_id, term_id || null, teacher.id, max_marks || 100,
      assigned_date || new Date().toISOString().split('T')[0], due_date,
      attachment_url || null, attachment_name || null
    );

    // Create notification for students in this class
    const students = db.prepare(`
      SELECT id FROM students
      WHERE institution_id = ? AND class_id = ? AND is_active = 1
      ${section_id ? 'AND section_id = ?' : ''}
    `).all(section_id ? [req.institution_id, class_id, section_id] : [req.institution_id, class_id]);

    const notifStmt = db.prepare(`
      INSERT INTO notifications (
        id, institution_id, user_id, title, message, type,
        related_entity_type, related_entity_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const student of students as any[]) {
      // Get student's user_id
      const studentUser = db.prepare(`
        SELECT user_id FROM students WHERE id = ?
      `).get(student.id) as any;

      if (studentUser?.user_id) {
        notifStmt.run(
          generateId(), req.institution_id, studentUser.user_id,
          `New ${type}: ${title}`,
          `Due date: ${due_date}`,
          'assignment',
          'assignment', id
        );
      }
    }

    res.status(201).json({ id, message: 'Assignment created successfully' });
  } catch (error: any) {
    console.error('Assignment creation error:', error);
    res.status(500).json({ error: 'Failed to create assignment', details: error.message });
  }
});

// List assignments (Teacher or Student)
assignmentsRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { class_id, section_id, subject_id, status, page = '1', limit = '20' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE a.institution_id = ? AND a.is_active = 1';
  const params: any[] = [req.institution_id];

  // If teacher, filter by their assignments
  if (req.user?.user_type === 'teacher') {
    const teacher = db.prepare(`
      SELECT id FROM employees
      WHERE user_id = ? AND institution_id = ? AND is_teacher = 1
    `).get(req.user.id, req.institution_id) as any;

    if (teacher) {
      where += ' AND a.teacher_id = ?';
      params.push(teacher.id);
    }
  }

  // If student, filter by their class
  if (req.user?.user_type === 'student') {
    const student = db.prepare(`
      SELECT class_id, section_id FROM students
      WHERE user_id = ? AND institution_id = ? AND is_active = 1
    `).get(req.user.id, req.institution_id) as any;

    if (student) {
      where += ' AND a.class_id = ?';
      params.push(student.class_id);
      if (student.section_id) {
        where += ' AND (a.section_id IS NULL OR a.section_id = ?)';
        params.push(student.section_id);
      }
    }
  }

  if (class_id) { where += ' AND a.class_id = ?'; params.push(class_id); }
  if (section_id) { where += ' AND a.section_id = ?'; params.push(section_id); }
  if (subject_id) { where += ' AND a.subject_id = ?'; params.push(subject_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM assignments a ${where}`).get(...params) as any;

  const assignments = db.prepare(`
    SELECT
      a.*,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name,
      (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as submission_count,
      (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'submitted') as pending_count
    FROM assignments a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN sections sec ON a.section_id = sec.id
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    ${where}
    ORDER BY a.due_date DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: assignments, total: total.count, page: parseInt(page), limit: lim });
});

// Get assignment details with submissions (Teacher only)
assignmentsRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const assignment = db.prepare(`
    SELECT
      a.*,
      c.name as class_name,
      sec.name as section_name,
      sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name
    FROM assignments a
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN sections sec ON a.section_id = sec.id
    LEFT JOIN subjects sub ON a.subject_id = sub.id
    LEFT JOIN employees e ON a.teacher_id = e.id
    WHERE a.id = ? AND a.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  // If teacher, include submissions
  if (req.user?.user_type === 'teacher') {
    const submissions = db.prepare(`
      SELECT
        asub.*,
        s.admission_number,
        s.first_name || ' ' || s.last_name as student_name,
        s.photo as student_photo
      FROM assignment_submissions asub
      INNER JOIN students s ON asub.student_id = s.id
      WHERE asub.assignment_id = ? AND asub.institution_id = ?
      ORDER BY asub.submitted_at DESC
    `).all(id, req.institution_id);

    res.json({ ...assignment, submissions });
  } else {
    res.json(assignment);
  }
});

// Update assignment (Teacher only)
assignmentsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can update assignments' });
    return;
  }

  const { id } = req.params;
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

  // Verify ownership
  const assignment = db.prepare(`
    SELECT id FROM assignments
    WHERE id = ? AND institution_id = ? AND teacher_id = ?
  `).get(id, req.institution_id, teacher.id);

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found or access denied' });
    return;
  }

  const {
    title, description, due_date, max_marks, attachment_url, attachment_name, is_active
  } = req.body;

  db.prepare(`
    UPDATE assignments SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      due_date = COALESCE(?, due_date),
      max_marks = COALESCE(?, max_marks),
      attachment_url = COALESCE(?, attachment_url),
      attachment_name = COALESCE(?, attachment_name),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, due_date, max_marks, attachment_url, attachment_name, is_active, id);

  res.json({ message: 'Assignment updated successfully' });
});

// Delete assignment (Teacher only)
assignmentsRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can delete assignments' });
    return;
  }

  const { id } = req.params;
  const db = getDatabase();

  const teacher = db.prepare(`
    SELECT id FROM employees
    WHERE user_id = ? AND institution_id = ? AND is_teacher = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!teacher) {
    res.status(404).json({ error: 'Teacher record not found' });
    return;
  }

  const result = db.prepare(`
    DELETE FROM assignments
    WHERE id = ? AND institution_id = ? AND teacher_id = ?
  `).run(id, req.institution_id, teacher.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Assignment not found or access denied' });
    return;
  }

  res.json({ message: 'Assignment deleted successfully' });
});

// ============================================
// STUDENT - SUBMIT ASSIGNMENT
// ============================================

assignmentsRouter.post('/:id/submit', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'student') {
    res.status(403).json({ error: 'Only students can submit assignments' });
    return;
  }

  const { id } = req.params;
  const { submission_text, attachment_url, attachment_name } = req.body;
  const db = getDatabase();

  // Get student's record
  const student = db.prepare(`
    SELECT id, class_id, section_id FROM students
    WHERE user_id = ? AND institution_id = ? AND is_active = 1
  `).get(req.user.id, req.institution_id) as any;

  if (!student) {
    res.status(404).json({ error: 'Student record not found' });
    return;
  }

  // Verify assignment exists and is for student's class
  const assignment = db.prepare(`
    SELECT id, teacher_id, due_date FROM assignments
    WHERE id = ? AND institution_id = ? AND class_id = ? AND is_active = 1
    ${student.section_id ? 'AND (section_id IS NULL OR section_id = ?)' : ''}
  `).get(
    student.section_id ? [id, req.institution_id, student.class_id, student.section_id] :
    [id, req.institution_id, student.class_id]
  ) as any;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found or not assigned to your class' });
    return;
  }

  // Check if already submitted
  const existing = db.prepare(`
    SELECT id FROM assignment_submissions
    WHERE assignment_id = ? AND student_id = ?
  `).get(id, student.id);

  const submissionId = existing ? (existing as any).id : generateId();
  const now = new Date().toISOString();
  const isLate = now > assignment.due_date;

  try {
    if (existing) {
      // Update existing submission
      db.prepare(`
        UPDATE assignment_submissions SET
          submission_text = ?,
          attachment_url = ?,
          attachment_name = ?,
          status = ?,
          submitted_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        submission_text,
        attachment_url || null,
        attachment_name || null,
        isLate ? 'late' : 'submitted',
        now,
        submissionId
      );
    } else {
      // Create new submission
      db.prepare(`
        INSERT INTO assignment_submissions (
          id, institution_id, assignment_id, student_id,
          submission_text, attachment_url, attachment_name,
          status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        submissionId, req.institution_id, id, student.id,
        submission_text, attachment_url || null, attachment_name || null,
        isLate ? 'late' : 'submitted', now
      );
    }

    // Notify teacher
    const teacherUser = db.prepare(`
      SELECT user_id FROM employees WHERE id = ?
    `).get(assignment.teacher_id) as any;

    if (teacherUser?.user_id) {
      db.prepare(`
        INSERT INTO notifications (
          id, institution_id, user_id, title, message, type,
          related_entity_type, related_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(), req.institution_id, teacherUser.user_id,
        'New Assignment Submission',
        `${req.user.first_name} ${req.user.last_name} submitted an assignment`,
        'assignment',
        'assignment_submission', submissionId
      );
    }

    res.status(existing ? 200 : 201).json({
      id: submissionId,
      status: isLate ? 'late' : 'submitted',
      message: existing ? 'Submission updated successfully' : 'Assignment submitted successfully'
    });
  } catch (error: any) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Failed to submit assignment', details: error.message });
  }
});

// ============================================
// TEACHER - GRADE SUBMISSION
// ============================================

assignmentsRouter.post('/:assignmentId/submissions/:submissionId/grade', (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'teacher') {
    res.status(403).json({ error: 'Only teachers can grade submissions' });
    return;
  }

  const { assignmentId, submissionId } = req.params;
  const { marks_obtained, feedback } = req.body;
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

  // Verify teacher owns this assignment
  const assignment = db.prepare(`
    SELECT id, max_marks FROM assignments
    WHERE id = ? AND institution_id = ? AND teacher_id = ?
  `).get(assignmentId, req.institution_id, teacher.id) as any;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found or access denied' });
    return;
  }

  // Verify submission exists
  const submission = db.prepare(`
    SELECT id, student_id FROM assignment_submissions
    WHERE id = ? AND assignment_id = ? AND institution_id = ?
  `).get(submissionId, assignmentId, req.institution_id) as any;

  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  if (marks_obtained < 0 || marks_obtained > assignment.max_marks) {
    res.status(400).json({
      error: 'Invalid marks',
      message: `Marks must be between 0 and ${assignment.max_marks}`
    });
    return;
  }

  try {
    db.prepare(`
      UPDATE assignment_submissions SET
        marks_obtained = ?,
        feedback = ?,
        status = 'graded',
        graded_at = datetime('now'),
        graded_by = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(marks_obtained, feedback, teacher.id, submissionId);

    // Notify student
    const studentUser = db.prepare(`
      SELECT user_id FROM students WHERE id = ?
    `).get(submission.student_id) as any;

    if (studentUser?.user_id) {
      db.prepare(`
        INSERT INTO notifications (
          id, institution_id, user_id, title, message, type,
          related_entity_type, related_entity_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(), req.institution_id, studentUser.user_id,
        'Assignment Graded',
        `You scored ${marks_obtained}/${assignment.max_marks}`,
        'assignment',
        'assignment_submission', submissionId
      );
    }

    res.json({ message: 'Submission graded successfully' });
  } catch (error: any) {
    console.error('Grading error:', error);
    res.status(500).json({ error: 'Failed to grade submission', details: error.message });
  }
});

export default assignmentsRouter;
