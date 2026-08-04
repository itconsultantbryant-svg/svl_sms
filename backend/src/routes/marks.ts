import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const marksRouter = Router();

// Apply tenant middleware to ALL marks routes
marksRouter.use(injectTenant);
marksRouter.use(requireTenant);

marksRouter.get('/schedule/:scheduleId', (req: AuthRequest, res: Response) => {
  const { scheduleId } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id
  const schedule = db.prepare(`
    SELECT es.*, e.name as exam_name, c.name as class_name, sec.name as section_name, sub.name as subject_name
    FROM exam_schedules es
    JOIN exams e ON es.exam_id = e.id
    LEFT JOIN classes c ON es.class_id = c.id
    LEFT JOIN sections sec ON es.section_id = sec.id
    LEFT JOIN subjects sub ON es.subject_id = sub.id
    WHERE es.id = ? AND es.institution_id = ?
  `).get(scheduleId, req.institution_id) as any;

  if (!schedule) {
    res.status(404).json({ error: 'Exam schedule not found' });
    return;
  }

  // TENANT ISOLATION: Filter students by institution_id
  const students = db.prepare(`
    SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo,
           m.id as mark_id, m.marks_obtained, m.is_absent, m.remarks
    FROM students s
    LEFT JOIN marks m ON m.student_id = s.id AND m.exam_schedule_id = ?
    WHERE s.institution_id = ? AND s.class_id = ? AND (? IS NULL OR s.section_id = ?) AND s.status = 'active'
    ORDER BY s.first_name, s.last_name
  `).all(scheduleId, req.institution_id, schedule.class_id, schedule.section_id, schedule.section_id);

  res.json({ schedule, students });
});

marksRouter.post('/schedule/:scheduleId', (req: AuthRequest, res: Response) => {
  const { scheduleId } = req.params;
  const { marks } = req.body;

  if (!marks || !Array.isArray(marks)) {
    res.status(400).json({ error: 'Marks array is required' });
    return;
  }

  const db = getDatabase();

  const upsert = db.prepare(`
    INSERT INTO marks (id, exam_schedule_id, student_id, marks_obtained, is_absent, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(exam_schedule_id, student_id)
    DO UPDATE SET marks_obtained = excluded.marks_obtained, is_absent = excluded.is_absent,
    remarks = excluded.remarks, updated_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    for (const m of marks) {
      upsert.run(
        generateId(), scheduleId, m.student_id,
        m.is_absent ? null : (m.marks_obtained ?? null),
        m.is_absent ? 1 : 0, m.remarks || null
      );
    }
  });

  transaction();
  res.json({ message: 'Marks saved successfully' });
});

marksRouter.get('/student/:studentId/exam/:examId', (req: AuthRequest, res: Response) => {
  const { studentId, examId } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id
  const marks = db.prepare(`
    SELECT m.*, es.max_marks, es.pass_marks, sub.name as subject_name, sub.code as subject_code
    FROM marks m
    JOIN exam_schedules es ON m.exam_schedule_id = es.id
    JOIN subjects sub ON es.subject_id = sub.id
    WHERE m.student_id = ? AND es.exam_id = ? AND es.institution_id = ?
    ORDER BY sub.name
  `).all(studentId, examId, req.institution_id);

  res.json(marks);
});
