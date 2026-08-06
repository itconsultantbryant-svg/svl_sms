import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const examinationsRouter = Router();

// Apply tenant middleware to ALL routes
examinationsRouter.use(injectTenant);
examinationsRouter.use(requireTenant);

// Exam Types
examinationsRouter.get('/types', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id (null for platform admins = see all)
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const types = db.prepare(`SELECT * FROM exam_types WHERE ${institutionFilter} AND is_active = 1 ORDER BY name`).all();
  res.json(types);
});

examinationsRouter.post('/types', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, description, percentage } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  // TENANT ISOLATION: Include institution_id in INSERT
  db.prepare('INSERT INTO exam_types (id, institution_id, name, description, percentage) VALUES (?, ?, ?, ?, ?)').run(id, req.institution_id, name, description || null, percentage || 0);
  res.status(201).json({ id, message: 'Exam type created successfully' });
});

// Grade Scales
examinationsRouter.get('/grade-scales', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id (null for platform admins = see all)
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const scales = db.prepare(`SELECT * FROM grade_scales WHERE ${institutionFilter} ORDER BY name`).all();
  res.json(scales);
});

examinationsRouter.get('/grade-scales/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id (null for platform admins = see all)
  const institutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const scale = db.prepare(`SELECT * FROM grade_scales WHERE id = ? ${institutionFilter}`).get(id);
  if (!scale) { res.status(404).json({ error: 'Grade scale not found' }); return; }
  const entries = db.prepare('SELECT * FROM grade_scale_entries WHERE grade_scale_id = ? ORDER BY min_percentage DESC').all(id);
  res.json({ ...(scale as any), entries });
});

examinationsRouter.post('/grade-scales', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, is_default, entries } = req.body;
  if (!name || !entries || !Array.isArray(entries)) {
    res.status(400).json({ error: 'Name and grade entries are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  const transaction = db.transaction(() => {
    if (is_default) {
      // TENANT ISOLATION: Only update within institution
      db.prepare('UPDATE grade_scales SET is_default = 0 WHERE institution_id = ?').run(req.institution_id);
    }
    // TENANT ISOLATION: Include institution_id in INSERT
    db.prepare('INSERT INTO grade_scales (id, institution_id, name, is_default) VALUES (?, ?, ?, ?)').run(id, req.institution_id, name, is_default ? 1 : 0);

    const insertEntry = db.prepare(`
      INSERT INTO grade_scale_entries (id, institution_id, grade_scale_id, grade, min_percentage, max_percentage, grade_point, remark, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach((e: any, i: number) => {
      insertEntry.run(generateId(), req.institution_id, id, e.grade, e.min_percentage, e.max_percentage, e.grade_point || 0, e.remark || null, i);
    });
  });

  transaction();
  res.status(201).json({ id, message: 'Grade scale created successfully' });
});

// Exams
examinationsRouter.get('/exams', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { session_id, term_id, status } = req.query as any;

  // TENANT ISOLATION: Always filter by institution_id (null for platform admins = see all)
  const institutionFilter = req.institution_id ? `e.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${institutionFilter}`;
  const params: any[] = [];
  if (session_id) { where += ' AND e.session_id = ?'; params.push(session_id); }
  if (term_id) { where += ' AND e.term_id = ?'; params.push(term_id); }
  if (status) { where += ' AND e.status = ?'; params.push(status); }

  const exams = db.prepare(`
    SELECT e.*, et.name as exam_type_name, s.name as session_name, t.name as term_name,
      (SELECT COUNT(DISTINCT es.class_id) FROM exam_schedules es WHERE es.exam_id = e.id) as class_count,
      (SELECT COUNT(*) FROM exam_schedules es WHERE es.exam_id = e.id) as schedule_count
    FROM exams e
    LEFT JOIN exam_types et ON e.exam_type_id = et.id
    LEFT JOIN academic_sessions s ON e.session_id = s.id
    LEFT JOIN terms t ON e.term_id = t.id
    ${where}
    ORDER BY e.start_date DESC
  `).all(...params);

  res.json(exams);
});

examinationsRouter.get('/exams/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id (null for platform admins = see all)
  const institutionFilter = req.institution_id ? `AND e.institution_id = '${req.institution_id}'` : '';
  const exam = db.prepare(`
    SELECT e.*, et.name as exam_type_name, s.name as session_name, t.name as term_name
    FROM exams e
    LEFT JOIN exam_types et ON e.exam_type_id = et.id
    LEFT JOIN academic_sessions s ON e.session_id = s.id
    LEFT JOIN terms t ON e.term_id = t.id
    WHERE e.id = ? ${institutionFilter}
  `).get(id);

  if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

  // TENANT ISOLATION: Filter schedules through exam (null for platform admins = see all)
  const schedulesInstitutionFilter = req.institution_id ? `AND es.institution_id = '${req.institution_id}'` : '';
  const schedules = db.prepare(`
    SELECT es.*, c.name as class_name, sec.name as section_name, sub.name as subject_name
    FROM exam_schedules es
    LEFT JOIN classes c ON es.class_id = c.id
    LEFT JOIN sections sec ON es.section_id = sec.id
    LEFT JOIN subjects sub ON es.subject_id = sub.id
    WHERE es.exam_id = ? ${schedulesInstitutionFilter}
    ORDER BY es.date, es.start_time
  `).all(id);

  res.json({ ...(exam as any), schedules });
});

examinationsRouter.post('/exams', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { name, exam_type_id, session_id, term_id, start_date, end_date, description } = req.body;

  if (!name || !session_id) {
    res.status(400).json({ error: 'Name and session are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  // TENANT ISOLATION: Include institution_id in INSERT
  db.prepare(`
    INSERT INTO exams (id, institution_id, name, exam_type_id, session_id, term_id, start_date, end_date, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.institution_id, name, exam_type_id || null, session_id, term_id || null, start_date || null, end_date || null, description || null);

  res.status(201).json({ id, message: 'Exam created successfully' });
});

examinationsRouter.put('/exams/:id', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, exam_type_id, start_date, end_date, status, description } = req.body;

  const db = getDatabase();
  // TENANT ISOLATION: Check exam belongs to this institution (null for platform admins = see all)
  const ownershipFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const exam = db.prepare(`SELECT id FROM exams WHERE id = ? ${ownershipFilter}`).get(id);
  if (!exam) {
    res.status(404).json({ error: 'Exam not found' });
    return;
  }

  db.prepare(`
    UPDATE exams SET name = COALESCE(?, name), exam_type_id = COALESCE(?, exam_type_id),
    start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
    status = COALESCE(?, status), description = COALESCE(?, description), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, exam_type_id, start_date, end_date, status, description, id);

  res.json({ message: 'Exam updated successfully' });
});

// Exam Schedules
examinationsRouter.post('/exams/:id/schedules', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { schedules } = req.body;

  if (!schedules || !Array.isArray(schedules)) {
    res.status(400).json({ error: 'Schedules array is required' });
    return;
  }

  const db = getDatabase();
  // TENANT ISOLATION: Include institution_id in INSERT
  const insert = db.prepare(`
    INSERT INTO exam_schedules (id, institution_id, exam_id, class_id, section_id, subject_id, date, start_time, end_time, room, max_marks, pass_marks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const s of schedules) {
      insert.run(
        generateId(), req.institution_id, id, s.class_id, s.section_id || null, s.subject_id,
        s.date, s.start_time || null, s.end_time || null, s.room || null,
        s.max_marks || 100, s.pass_marks || 40
      );
    }
  });

  transaction();
  res.status(201).json({ message: 'Exam schedules created successfully' });
});

examinationsRouter.delete('/schedules/:scheduleId', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { scheduleId } = req.params;
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id before deleting (null for platform admins = see all)
  const deleteInstitutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  db.prepare(`DELETE FROM exam_schedules WHERE id = ? ${deleteInstitutionFilter}`).run(scheduleId);
  res.json({ message: 'Schedule removed successfully' });
});
