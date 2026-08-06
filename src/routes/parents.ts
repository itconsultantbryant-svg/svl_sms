import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';

export const parentsRouter = Router();

// Apply tenant middleware to ALL routes
parentsRouter.use(injectTenant);
parentsRouter.use(requireTenant);

parentsRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['p.first_name', 'p.last_name', 'p.phone', 'p.email'],
    search
  );

  // TENANT ISOLATION: Always filter by institution_id (platform admins see all)
  const institutionFilter = req.institution_id ? `p.institution_id = '${req.institution_id}'` : '1=1';
  const where = `WHERE ${institutionFilter} ` + searchClause;
  const params: any[] = [...searchParams];
  const total = db.prepare(`SELECT COUNT(*) as count FROM parents p ${where}`).get(...params) as any;

  const parents = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM student_parents sp WHERE sp.parent_id = p.id) as children_count
    FROM parents p
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: parents, total: total.count, page: parseInt(page), limit: lim });
});

parentsRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id (platform admins see all)
  const institutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const parent = db.prepare(`SELECT * FROM parents WHERE id = ? ${institutionFilter}`).get(id) as any;
  if (!parent) {
    res.status(404).json({ error: 'Parent not found' });
    return;
  }

  // TENANT ISOLATION: Filter related students (platform admins see all)
  const childInstitutionFilter = req.institution_id ? `AND s.institution_id = '${req.institution_id}'` : '';
  const children = db.prepare(`
    SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo, s.status,
           c.name as class_name, sec.name as section_name
    FROM students s
    JOIN student_parents sp ON s.id = sp.student_id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE sp.parent_id = ? ${childInstitutionFilter}
  `).all(id);

  res.json({ ...parent, children });
});

parentsRouter.post('/', (req: AuthRequest, res: Response) => {
  const { first_name, last_name, relationship, phone, email, address, occupation, workplace, student_id } = req.body;

  if (!first_name || !last_name) {
    res.status(400).json({ error: 'First name and last name are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  const transaction = db.transaction(() => {
    // TENANT ISOLATION: Include institution_id in INSERT
    db.prepare(`
      INSERT INTO parents (id, institution_id, first_name, last_name, relationship, phone, email, address, occupation, workplace)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.institution_id, first_name, last_name, relationship || 'guardian', phone || null, email || null, address || null, occupation || null, workplace || null);

    if (student_id) {
      db.prepare('INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, 0)').run(student_id, id);
    }
  });

  transaction();
  res.status(201).json({ id, message: 'Parent created successfully' });
});

parentsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { first_name, last_name, relationship, phone, email, address, occupation, workplace } = req.body;

  const db = getDatabase();
  // TENANT ISOLATION: Check parent belongs to this institution (platform admins see all)
  const putInstitutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const parent = db.prepare(`SELECT id FROM parents WHERE id = ? ${putInstitutionFilter}`).get(id);
  if (!parent) {
    res.status(404).json({ error: 'Parent not found' });
    return;
  }

  db.prepare(`
    UPDATE parents SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
    relationship = COALESCE(?, relationship), phone = COALESCE(?, phone),
    email = COALESCE(?, email), address = COALESCE(?, address),
    occupation = COALESCE(?, occupation), workplace = COALESCE(?, workplace),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(first_name, last_name, relationship, phone, email, address, occupation, workplace, id);

  res.json({ message: 'Parent updated successfully' });
});

parentsRouter.post('/:id/link-student', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { student_id, is_primary } = req.body;

  if (!student_id) {
    res.status(400).json({ error: 'Student ID is required' });
    return;
  }

  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, ?)').run(student_id, id, is_primary ? 1 : 0);
  res.json({ message: 'Student linked to parent successfully' });
});
