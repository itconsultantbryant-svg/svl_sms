import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const academicsRouter = Router();

// Apply tenant middleware to ALL academics routes
academicsRouter.use(injectTenant);
academicsRouter.use(requireTenant);

// Academic Sessions
academicsRouter.get('/sessions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const sessions = db.prepare(`SELECT * FROM academic_sessions WHERE ${institutionFilter} ORDER BY start_date DESC`).all();
  res.json(sessions);
});

academicsRouter.post('/sessions', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, start_date, end_date, is_current } = req.body;
  if (!name || !start_date || !end_date) {
    res.status(400).json({ error: 'Name, start date, and end date are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  // TENANT ISOLATION: Update only current institution's sessions
  if (is_current) {
    db.prepare('UPDATE academic_sessions SET is_current = 0 WHERE institution_id = ?').run(req.institution_id);
  }

  // TENANT ISOLATION: Insert with institution_id
  db.prepare(`
    INSERT INTO academic_sessions (id, institution_id, name, start_date, end_date, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.institution_id, name, start_date, end_date, is_current ? 1 : 0);

  res.status(201).json({ id, message: 'Session created successfully' });
});

academicsRouter.put('/sessions/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, start_date, end_date, is_current } = req.body;

  const db = getDatabase();
  // TENANT ISOLATION: Update only current institution's sessions
  if (is_current) {
    db.prepare('UPDATE academic_sessions SET is_current = 0 WHERE institution_id = ?').run(req.institution_id);
  }

  // TENANT ISOLATION: Update with institution_id filter
  db.prepare(`
    UPDATE academic_sessions SET name = COALESCE(?, name), start_date = COALESCE(?, start_date),
    end_date = COALESCE(?, end_date), is_current = COALESCE(?, is_current), updated_at = datetime('now')
    WHERE id = ? AND institution_id = ?
  `).run(name, start_date, end_date, is_current, id, req.institution_id);

  res.json({ message: 'Session updated successfully' });
});

// Terms
academicsRouter.get('/terms', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { session_id } = req.query as any;
  let query = 'SELECT t.*, s.name as session_name FROM terms t JOIN academic_sessions s ON t.session_id = s.id';
  if (session_id) {
    const terms = db.prepare(query + ' WHERE t.session_id = ? ORDER BY t.start_date').all(session_id);
    res.json(terms);
  } else {
    const terms = db.prepare(query + ' ORDER BY t.start_date DESC').all();
    res.json(terms);
  }
});

academicsRouter.post('/terms', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { session_id, name, start_date, end_date, is_current } = req.body;
  if (!session_id || !name || !start_date || !end_date) {
    res.status(400).json({ error: 'Session, name, start date, and end date are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  if (is_current) {
    db.prepare('UPDATE terms SET is_current = 0 WHERE session_id = ?').run(session_id);
  }

  db.prepare(`
    INSERT INTO terms (id, session_id, name, start_date, end_date, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, session_id, name, start_date, end_date, is_current ? 1 : 0);

  res.status(201).json({ id, message: 'Term created successfully' });
});

// Classes
academicsRouter.get('/classes', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { branch_id } = req.query as any;
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = req.institution_id ? `c.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${institutionFilter} AND c.is_active = 1`;
  const params: any[] = [];

  if (branch_id) { where += ' AND c.branch_id = ?'; params.push(branch_id); }
  if (req.user?.branch_id) { where += ' AND c.branch_id = ?'; params.push(req.user.branch_id); }

  const classes = db.prepare(`
    SELECT c.*, b.branch_name as branch_name,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'active') as student_count
    FROM classes c
    LEFT JOIN branches b ON c.branch_id = b.id
    ${where}
    ORDER BY c.sort_order, c.name
  `).all(...params);

  res.json(classes);
});

academicsRouter.post('/classes', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, numeric_name, description, capacity, branch_id, sort_order } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Class name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  db.prepare(`
    INSERT INTO classes (id, branch_id, name, numeric_name, description, capacity, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, branch_id || req.user?.branch_id || null, name, numeric_name || null, description || null, capacity || null, sort_order || 0);

  res.status(201).json({ id, message: 'Class created successfully' });
});

academicsRouter.put('/classes/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, numeric_name, description, capacity, sort_order, is_active } = req.body;

  const db = getDatabase();
  db.prepare(`
    UPDATE classes SET name = COALESCE(?, name), numeric_name = COALESCE(?, numeric_name),
    description = COALESCE(?, description), capacity = COALESCE(?, capacity),
    sort_order = COALESCE(?, sort_order), is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(name, numeric_name, description, capacity, sort_order, is_active, id);

  res.json({ message: 'Class updated successfully' });
});

// Sections
academicsRouter.get('/sections', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { class_id } = req.query as any;

  if (class_id) {
    const sections = db.prepare(`
      SELECT sec.*, c.name as class_name,
        (SELECT COUNT(*) FROM students s WHERE s.section_id = sec.id AND s.status = 'active') as student_count
      FROM sections sec
      JOIN classes c ON sec.class_id = c.id
      WHERE sec.class_id = ? AND sec.is_active = 1
      ORDER BY sec.name
    `).all(class_id);
    res.json(sections);
  } else {
    const sections = db.prepare(`
      SELECT sec.*, c.name as class_name
      FROM sections sec
      JOIN classes c ON sec.class_id = c.id
      WHERE sec.is_active = 1
      ORDER BY c.sort_order, c.name, sec.name
    `).all();
    res.json(sections);
  }
});

academicsRouter.post('/sections', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { class_id, name, capacity } = req.body;
  if (!class_id || !name) {
    res.status(400).json({ error: 'Class and section name are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO sections (id, class_id, name, capacity) VALUES (?, ?, ?, ?)').run(id, class_id, name, capacity || null);
  res.status(201).json({ id, message: 'Section created successfully' });
});

// Subjects
academicsRouter.get('/subjects', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { branch_id } = req.query as any;
  const institutionFilter = req.institution_id ? `s.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${institutionFilter} AND s.is_active = 1`;
  const params: any[] = [];

  if (branch_id) { where += ' AND s.branch_id = ?'; params.push(branch_id); }

  const subjects = db.prepare(`
    SELECT s.*, b.branch_name
    FROM subjects s
    LEFT JOIN branches b ON s.branch_id = b.id
    ${where}
    ORDER BY s.name
  `).all(...params);

  res.json(subjects);
});

academicsRouter.post('/subjects', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, code, description, type, branch_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Subject name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  db.prepare(`
    INSERT INTO subjects (id, institution_id, branch_id, name, code, description, type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.institution_id, branch_id || null, name, code || null, description || null, type || 'theory');

  res.status(201).json({ id, message: 'Subject created successfully' });
});

academicsRouter.put('/subjects/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, description, type, is_active } = req.body;

  const db = getDatabase();
  db.prepare(`
    UPDATE subjects SET name = COALESCE(?, name), code = COALESCE(?, code),
    description = COALESCE(?, description), type = COALESCE(?, type),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, code, description, type, is_active, id);

  res.json({ message: 'Subject updated successfully' });
});

// Class-Subject mapping
academicsRouter.post('/class-subjects', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { class_id, subject_ids, session_id } = req.body;
  if (!class_id || !subject_ids || !session_id) {
    res.status(400).json({ error: 'Class, subjects, and session are required' });
    return;
  }

  const db = getDatabase();
  const insert = db.prepare('INSERT OR IGNORE INTO class_subjects (id, class_id, subject_id, session_id) VALUES (?, ?, ?, ?)');
  const transaction = db.transaction(() => {
    for (const subjectId of subject_ids) {
      insert.run(generateId(), class_id, subjectId, session_id);
    }
  });
  transaction();

  res.status(201).json({ message: 'Subjects assigned to class successfully' });
});

// Departments
academicsRouter.get('/departments', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = req.institution_id ? `d.institution_id = '${req.institution_id}'` : '1=1';
  const departments = db.prepare(`
    SELECT d.*, b.branch_name,
      (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active = 1) as employee_count
    FROM departments d
    LEFT JOIN branches b ON d.branch_id = b.id
    WHERE ${institutionFilter} AND d.is_active = 1
    ORDER BY d.name
  `).all();
  res.json(departments);
});

academicsRouter.post('/departments', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, description, branch_id, head_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Department name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO departments (id, institution_id, branch_id, name, description, head_id) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.institution_id, branch_id || null, name, description || null, head_id || null);
  res.status(201).json({ id, message: 'Department created successfully' });
});

// Designations
academicsRouter.get('/designations', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = req.institution_id ? `institution_id = '${req.institution_id}'` : '1=1';
  const designations = db.prepare(`SELECT * FROM designations WHERE ${institutionFilter} ORDER BY name`).all();
  res.json(designations);
});

academicsRouter.post('/designations', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Designation name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO designations (id, institution_id, name, description) VALUES (?, ?, ?, ?)').run(id, req.institution_id, name, description || null);
  res.status(201).json({ id, message: 'Designation created successfully' });
});
