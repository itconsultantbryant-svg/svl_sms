import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const resultsRouter = Router();

// Apply tenant middleware to ALL results routes
resultsRouter.use(injectTenant);
resultsRouter.use(requireTenant);

resultsRouter.post('/generate/:examId', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { examId } = req.params;
  const { class_id, section_id } = req.body;

  if (!class_id) {
    res.status(400).json({ error: 'Class is required' });
    return;
  }

  const db = getDatabase();

  // TENANT ISOLATION: Filter exam by institution_id
  const exam = db.prepare(`
    SELECT e.*, s.id as sess_id, t.id as trm_id
    FROM exams e
    LEFT JOIN academic_sessions s ON e.session_id = s.id
    LEFT JOIN terms t ON e.term_id = t.id
    WHERE e.id = ? AND e.institution_id = ?
  `).get(examId, req.institution_id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Exam not found' });
    return;
  }

  // TENANT ISOLATION: Filter grade scale by institution_id
  const gradeScale = db.prepare(`
    SELECT gse.* FROM grade_scale_entries gse
    JOIN grade_scales gs ON gse.grade_scale_id = gs.id
    WHERE gs.institution_id = ? AND gs.is_default = 1
    ORDER BY gse.min_percentage DESC
  `).all(req.institution_id) as any[];

  // TENANT ISOLATION: Filter students by institution_id
  const students = db.prepare(`
    SELECT id FROM students WHERE institution_id = ? AND class_id = ? AND (? IS NULL OR section_id = ?) AND status = 'active'
  `).all(req.institution_id, class_id, section_id || null, section_id || null) as any[];

  const transaction = db.transaction(() => {
    for (const student of students) {
      const studentMarks = db.prepare(`
        SELECT m.marks_obtained, m.is_absent, es.max_marks, es.pass_marks
        FROM marks m
        JOIN exam_schedules es ON m.exam_schedule_id = es.id
        WHERE m.student_id = ? AND es.exam_id = ? AND es.class_id = ?
      `).all(student.id, examId, class_id) as any[];

      if (studentMarks.length === 0) continue;

      const totalMarks = studentMarks.reduce((sum, m) => sum + m.max_marks, 0);
      const totalObtained = studentMarks.reduce((sum, m) => sum + (m.marks_obtained || 0), 0);
      const percentage = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;

      let grade = '';
      let gradePoint = 0;
      let status = 'pass';

      for (const g of gradeScale) {
        if (percentage >= g.min_percentage && percentage <= g.max_percentage) {
          grade = g.grade;
          gradePoint = g.grade_point;
          break;
        }
      }

      const hasFailed = studentMarks.some(m => !m.is_absent && (m.marks_obtained || 0) < m.pass_marks);
      if (hasFailed || percentage < 40) status = 'fail';

      db.prepare(`
        INSERT INTO results (id, student_id, exam_id, class_id, section_id, session_id, term_id,
        total_marks, total_obtained, percentage, grade, grade_point, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, exam_id) DO UPDATE SET
        total_marks = excluded.total_marks, total_obtained = excluded.total_obtained,
        percentage = excluded.percentage, grade = excluded.grade, grade_point = excluded.grade_point,
        status = excluded.status, updated_at = datetime('now')
      `).run(
        generateId(), student.id, examId, class_id, section_id || null,
        exam.sess_id, exam.trm_id, totalMarks, totalObtained,
        Math.round(percentage * 100) / 100, grade, gradePoint, status
      );
    }

    // Calculate ranks
    const results = db.prepare(`
      SELECT id, percentage FROM results
      WHERE exam_id = ? AND class_id = ? AND (? IS NULL OR section_id = ?)
      ORDER BY percentage DESC
    `).all(examId, class_id, section_id || null, section_id || null) as any[];

    const updateRank = db.prepare('UPDATE results SET rank = ? WHERE id = ?');
    results.forEach((r, i) => updateRank.run(i + 1, r.id));
  });

  transaction();
  res.json({ message: `Results generated for ${students.length} students` });
});

resultsRouter.get('/exam/:examId', (req: AuthRequest, res: Response) => {
  const { examId } = req.params;
  const { class_id, section_id } = req.query as any;

  const db = getDatabase();
  let where = 'WHERE r.exam_id = ?';
  const params: any[] = [examId];

  if (class_id) { where += ' AND r.class_id = ?'; params.push(class_id); }
  if (section_id) { where += ' AND r.section_id = ?'; params.push(section_id); }

  // TENANT ISOLATION: Filter by institution_id
  const results = db.prepare(`
    SELECT r.*, s.admission_number, s.first_name, s.last_name, s.photo,
           c.name as class_name, sec.name as section_name
    FROM results r
    JOIN students s ON r.student_id = s.id
    LEFT JOIN classes c ON r.class_id = c.id
    LEFT JOIN sections sec ON r.section_id = sec.id
    ${where} AND s.institution_id = ?
    ORDER BY r.rank
  `).all(...params, req.institution_id);

  res.json(results);
});

resultsRouter.get('/student/:studentId', (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
  const { session_id } = req.query as any;

  const db = getDatabase();
  let where = 'WHERE r.student_id = ?';
  const params: any[] = [studentId];
  if (session_id) { where += ' AND r.session_id = ?'; params.push(session_id); }

  const results = db.prepare(`
    SELECT r.*, e.name as exam_name, et.name as exam_type_name
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    LEFT JOIN exam_types et ON e.exam_type_id = et.id
    ${where}
    ORDER BY e.start_date DESC
  `).all(...params);

  res.json(results);
});

resultsRouter.put('/:id/comments', authorize('platform_admin', 'institution_admin', 'principal', 'teacher'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { teacher_comment, principal_comment } = req.body;

  const db = getDatabase();
  db.prepare(`
    UPDATE results SET teacher_comment = COALESCE(?, teacher_comment),
    principal_comment = COALESCE(?, principal_comment), updated_at = datetime('now')
    WHERE id = ?
  `).run(teacher_comment, principal_comment, id);

  res.json({ message: 'Comments updated successfully' });
});

resultsRouter.put('/publish/:examId', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { examId } = req.params;
  const { class_id, section_id } = req.body;

  const db = getDatabase();
  let where = 'WHERE exam_id = ?';
  const params: any[] = [examId];
  if (class_id) { where += ' AND class_id = ?'; params.push(class_id); }
  if (section_id) { where += ' AND section_id = ?'; params.push(section_id); }

  db.prepare(`UPDATE results SET is_published = 1, updated_at = datetime('now') ${where}`).run(...params);
  res.json({ message: 'Results published successfully' });
});

// Report Card data
resultsRouter.get('/report-card/:studentId/:examId', (req: AuthRequest, res: Response) => {
  const { studentId, examId } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter student by institution_id
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, sec.name as section_name, b.name as branch_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE s.id = ? AND s.institution_id = ?
  `).get(studentId, req.institution_id) as any;

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const result = db.prepare(`
    SELECT r.*, e.name as exam_name, et.name as exam_type_name
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    LEFT JOIN exam_types et ON e.exam_type_id = et.id
    WHERE r.student_id = ? AND r.exam_id = ?
  `).get(studentId, examId) as any;

  const subjectMarks = db.prepare(`
    SELECT m.marks_obtained, m.is_absent, es.max_marks, es.pass_marks,
           sub.name as subject_name, sub.code as subject_code
    FROM marks m
    JOIN exam_schedules es ON m.exam_schedule_id = es.id
    JOIN subjects sub ON es.subject_id = sub.id
    WHERE m.student_id = ? AND es.exam_id = ?
    ORDER BY sub.name
  `).all(studentId, examId) as any[];

  // TENANT ISOLATION: Filter grade scale by institution_id
  const gradeScale = db.prepare(`
    SELECT gse.* FROM grade_scale_entries gse
    JOIN grade_scales gs ON gse.grade_scale_id = gs.id
    WHERE gs.institution_id = ? AND gs.is_default = 1
    ORDER BY gse.min_percentage DESC
  `).all(req.institution_id) as any[];

  const subjectsWithGrades = subjectMarks.map(sm => {
    const pct = sm.max_marks > 0 ? (sm.marks_obtained / sm.max_marks) * 100 : 0;
    let grade = '';
    let remark = '';
    for (const g of gradeScale) {
      if (pct >= g.min_percentage && pct <= g.max_percentage) {
        grade = g.grade;
        remark = g.remark || '';
        break;
      }
    }
    return { ...sm, percentage: Math.round(pct * 10) / 10, grade, remark };
  });

  // TENANT ISOLATION: Get current institution
  const institution = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.institution_id);

  // Attendance summary for the term
  const attendanceSummary = result?.term_id ? db.prepare(`
    SELECT
      COUNT(CASE WHEN sa.status = 'present' THEN 1 END) as present_days,
      COUNT(CASE WHEN sa.status = 'absent' THEN 1 END) as absent_days,
      COUNT(sa.id) as total_days
    FROM student_attendance sa
    JOIN attendance_sessions ats ON sa.attendance_session_id = ats.id
    WHERE sa.student_id = ? AND ats.term_id = ?
  `).get(studentId, result.term_id) : null;

  res.json({
    institution,
    student,
    result,
    subjects: subjectsWithGrades,
    gradeScale,
    attendance: attendanceSummary,
  });
});
