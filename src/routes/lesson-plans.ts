import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const lessonPlansRouter = Router();

lessonPlansRouter.use(injectTenant);
lessonPlansRouter.use(requireTenant);

function getTeacherEmployeeId(req: AuthRequest): string | null {
  const db = getDatabase();
  const inst = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const teacher = db.prepare(`
    SELECT id FROM employees WHERE user_id = ? ${inst} AND is_teacher = 1
  `).get(req.user!.id) as any;
  return teacher?.id || null;
}

lessonPlansRouter.get('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '50' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const inst = req.institution_id ? `lp.institution_id = '${req.institution_id}'` : '1=1';

  const total = db.prepare(`SELECT COUNT(*) as count FROM lesson_plans lp WHERE ${inst}`).get() as any;
  const rows = db.prepare(`
    SELECT lp.*,
      c.name as class_name, sub.name as subject_name,
      u.first_name || ' ' || u.last_name as created_by_name,
      (SELECT COUNT(*) FROM lesson_plan_recipients r WHERE r.lesson_plan_id = lp.id) as recipient_count
    FROM lesson_plans lp
    LEFT JOIN classes c ON c.id = lp.class_id
    LEFT JOIN subjects sub ON sub.id = lp.subject_id
    LEFT JOIN users u ON u.id = lp.created_by
    WHERE ${inst}
    ORDER BY lp.created_at DESC
    LIMIT ? OFFSET ?
  `).all(lim, offset);

  res.json({ data: rows, total: total.count, page: parseInt(page), limit: lim });
});

lessonPlansRouter.get('/mine', authorize('teacher', 'platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const teacherId = getTeacherEmployeeId(req);
  if (!teacherId) {
    res.json({ data: [] });
    return;
  }
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT lp.*, r.sent_at, r.seen_at,
      c.name as class_name, sub.name as subject_name
    FROM lesson_plan_recipients r
    JOIN lesson_plans lp ON lp.id = r.lesson_plan_id
    LEFT JOIN classes c ON c.id = lp.class_id
    LEFT JOIN subjects sub ON sub.id = lp.subject_id
    WHERE r.teacher_id = ?
    ORDER BY r.sent_at DESC
  `).all(teacherId);
  res.json({ data: rows });
});

lessonPlansRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const inst = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const plan = db.prepare(`SELECT * FROM lesson_plans WHERE id = ? ${inst}`).get(req.params.id) as any;
  if (!plan) {
    res.status(404).json({ error: 'Lesson plan not found' });
    return;
  }

  if (req.user?.user_type === 'teacher') {
    const teacherId = getTeacherEmployeeId(req);
    const recip = db.prepare(`
      SELECT * FROM lesson_plan_recipients WHERE lesson_plan_id = ? AND teacher_id = ?
    `).get(plan.id, teacherId);
    if (!recip) {
      res.status(403).json({ error: 'Not assigned this lesson plan' });
      return;
    }
  }

  const recipients = db.prepare(`
    SELECT r.*, e.first_name || ' ' || e.last_name as teacher_name, e.employee_id
    FROM lesson_plan_recipients r
    JOIN employees e ON e.id = r.teacher_id
    WHERE r.lesson_plan_id = ?
  `).all(plan.id);

  res.json({ ...plan, recipients });
});

lessonPlansRouter.post('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const {
    title, description, class_id, subject_id, session_id, term_id,
    file_data, file_name, mime_type, teacher_ids
  } = req.body;

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const hasRecipients = Array.isArray(teacher_ids) && teacher_ids.length > 0;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO lesson_plans (
        id, institution_id, title, description, class_id, subject_id, session_id, term_id,
        file_data, file_name, mime_type, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.institution_id, title, description || null,
      class_id || null, subject_id || null, session_id || null, term_id || null,
      file_data || null, file_name || null, mime_type || null,
      req.user!.id, hasRecipients ? 'sent' : 'draft'
    );

    if (hasRecipients) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO lesson_plan_recipients (id, lesson_plan_id, teacher_id, sent_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      for (const tid of teacher_ids) {
        insert.run(generateId(), id, tid);
      }
    }
  });
  try {
    tx();
  } catch (err: any) {
    console.error('Lesson plan create error:', err);
    res.status(500).json({ error: 'Failed to create lesson plan', details: err.message });
    return;
  }

  res.status(201).json({ id, message: 'Lesson plan created', status: hasRecipients ? 'sent' : 'draft' });
});

lessonPlansRouter.put('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const plan = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!plan || (req.institution_id && plan.institution_id !== req.institution_id)) {
    res.status(404).json({ error: 'Lesson plan not found' });
    return;
  }

  const {
    title, description, class_id, subject_id, session_id, term_id,
    file_data, file_name, mime_type
  } = req.body;

  db.prepare(`
    UPDATE lesson_plans SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      class_id = COALESCE(?, class_id),
      subject_id = COALESCE(?, subject_id),
      session_id = COALESCE(?, session_id),
      term_id = COALESCE(?, term_id),
      file_data = COALESCE(?, file_data),
      file_name = COALESCE(?, file_name),
      mime_type = COALESCE(?, mime_type),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title, description, class_id, subject_id, session_id, term_id,
    file_data, file_name, mime_type, plan.id
  );

  res.json({ message: 'Lesson plan updated' });
});

lessonPlansRouter.post('/:id/send', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { teacher_ids } = req.body;
  if (!Array.isArray(teacher_ids) || teacher_ids.length === 0) {
    res.status(400).json({ error: 'teacher_ids[] required' });
    return;
  }

  const db = getDatabase();
  const plan = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!plan || (req.institution_id && plan.institution_id !== req.institution_id)) {
    res.status(404).json({ error: 'Lesson plan not found' });
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO lesson_plan_recipients (id, lesson_plan_id, teacher_id, sent_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const tx = db.transaction(() => {
    for (const tid of teacher_ids) {
      insert.run(generateId(), plan.id, tid);
    }
    db.prepare(`UPDATE lesson_plans SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(plan.id);
  });
  tx();

  res.json({ message: 'Lesson plan sent to teachers' });
});

lessonPlansRouter.post('/:id/seen', authorize('teacher'), (req: AuthRequest, res: Response) => {
  const teacherId = getTeacherEmployeeId(req);
  if (!teacherId) {
    res.status(404).json({ error: 'Teacher record not found' });
    return;
  }
  const db = getDatabase();
  db.prepare(`
    UPDATE lesson_plan_recipients SET seen_at = datetime('now')
    WHERE lesson_plan_id = ? AND teacher_id = ?
  `).run(req.params.id, teacherId);
  res.json({ message: 'Marked as seen' });
});

lessonPlansRouter.post('/import', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows) || !rows.length) {
    res.status(400).json({ error: 'rows[] is required' });
    return;
  }
  const db = getDatabase();
  const created: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const title = row.title;
    if (!title) {
      errors.push('A row is missing a title');
      continue;
    }
    const classId = row.class || row.class_name
      ? (db.prepare(`SELECT id FROM classes WHERE institution_id = ? AND LOWER(name) = LOWER(?)`).get(req.institution_id, row.class || row.class_name) as any)?.id
      : null;
    const subjectId = row.subject || row.subject_name
      ? (db.prepare(`SELECT id FROM subjects WHERE institution_id = ? AND LOWER(name) = LOWER(?)`).get(req.institution_id, row.subject || row.subject_name) as any)?.id
      : null;
    const teacherNames = String(row.teachers || row.teacher || '').split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
    const teacherIds: string[] = [];
    for (const name of teacherNames) {
      const teacher = db.prepare(`
        SELECT id FROM employees
        WHERE institution_id = ? AND is_teacher = 1
          AND (LOWER(first_name || ' ' || last_name) = LOWER(?) OR LOWER(employee_id) = LOWER(?))
        LIMIT 1
      `).get(req.institution_id, name, name) as any;
      if (teacher) teacherIds.push(teacher.id);
      else errors.push(`Teacher not found: ${name}`);
    }

    const id = generateId();
    db.prepare(`
      INSERT INTO lesson_plans (
        id, institution_id, title, description, class_id, subject_id, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.institution_id, title, row.description || null,
      classId || null, subjectId || null, req.user!.id,
      teacherIds.length ? 'sent' : 'draft'
    );
    const insert = db.prepare(`
      INSERT OR IGNORE INTO lesson_plan_recipients (id, lesson_plan_id, teacher_id, sent_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    for (const tid of teacherIds) insert.run(generateId(), id, tid);
    created.push(id);
  }

  res.status(created.length ? 201 : 400).json({ created, errors });
});

lessonPlansRouter.delete('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const plan = db.prepare(`SELECT * FROM lesson_plans WHERE id = ?`).get(req.params.id) as any;
  if (!plan || (req.institution_id && plan.institution_id !== req.institution_id)) {
    res.status(404).json({ error: 'Lesson plan not found' });
    return;
  }
  db.prepare(`UPDATE lesson_plans SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).run(plan.id);
  res.json({ message: 'Lesson plan archived' });
});
