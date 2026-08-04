import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const certificatesRouter = Router();

// Apply tenant middleware to ALL routes
certificatesRouter.use(injectTenant);
certificatesRouter.use(requireTenant);

// Templates
certificatesRouter.get('/templates', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM certificate_templates WHERE is_active = 1 ORDER BY name').all();
  res.json(templates);
});

certificatesRouter.post('/templates', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, type, content, header, footer } = req.body;
  if (!name || !content) { res.status(400).json({ error: 'Name and content are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO certificate_templates (id, name, type, content, header, footer) VALUES (?, ?, ?, ?, ?, ?)`).run(id, name, type || 'custom', content, header || null, footer || null);
  res.status(201).json({ id, message: 'Template created' });
});

certificatesRouter.put('/templates/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, type, content, header, footer, is_active } = req.body;
  const db = getDatabase();
  db.prepare(`UPDATE certificate_templates SET name = COALESCE(?, name), type = COALESCE(?, type), content = COALESCE(?, content), header = COALESCE(?, header), footer = COALESCE(?, footer), is_active = COALESCE(?, is_active) WHERE id = ?`).run(name, type, content, header, footer, is_active, id);
  res.json({ message: 'Template updated' });
});

// Generate Certificate
certificatesRouter.post('/generate', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { template_id, student_id, issued_date, content } = req.body;
  if (!template_id || !student_id || !issued_date) {
    res.status(400).json({ error: 'Template, student and issue date are required' });
    return;
  }
  const db = getDatabase();
  const template = db.prepare('SELECT * FROM certificate_templates WHERE id = ?').get(template_id) as any;
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

  const student = db.prepare(`
    SELECT s.*, c.name as class_name, sec.name as section_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE s.id = ?
  `).get(student_id) as any;
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  const id = generateId();
  const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}`;

  let finalContent = content || template.content;
  finalContent = finalContent
    .replace(/\{\{student_name\}\}/g, `${student.first_name} ${student.last_name}`)
    .replace(/\{\{admission_number\}\}/g, student.admission_number || '')
    .replace(/\{\{class\}\}/g, student.class_name || '')
    .replace(/\{\{section\}\}/g, student.section_name || '')
    .replace(/\{\{date\}\}/g, issued_date)
    .replace(/\{\{certificate_number\}\}/g, certNumber);

  db.prepare(`INSERT INTO certificates (id, template_id, student_id, certificate_number, issued_date, content, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, template_id, student_id, certNumber, issued_date, finalContent, req.user?.id || null);
  res.status(201).json({ id, certificate_number: certNumber, message: 'Certificate generated' });
});

// List Certificates
certificatesRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', student_id, type } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (student_id) { where += ' AND c.student_id = ?'; params.push(student_id); }
  if (type) { where += ' AND ct.type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM certificates c LEFT JOIN certificate_templates ct ON c.template_id = ct.id ${where}`).get(...params) as any;
  const certs = db.prepare(`
    SELECT c.*, ct.name as template_name, ct.type as template_type,
      s.first_name, s.last_name, s.admission_number
    FROM certificates c
    LEFT JOIN certificate_templates ct ON c.template_id = ct.id
    LEFT JOIN students s ON c.student_id = s.id
    ${where} ORDER BY c.issued_date DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: certs, total: total.count, page: parseInt(page), limit: lim });
});

certificatesRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const cert = db.prepare(`
    SELECT c.*, ct.name as template_name, ct.type as template_type, ct.header, ct.footer,
      s.first_name, s.last_name, s.admission_number, s.photo,
      cl.name as class_name, sec.name as section_name
    FROM certificates c
    LEFT JOIN certificate_templates ct ON c.template_id = ct.id
    LEFT JOIN students s ON c.student_id = s.id
    LEFT JOIN classes cl ON s.class_id = cl.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE c.id = ?
  `).get(id);
  if (!cert) { res.status(404).json({ error: 'Certificate not found' }); return; }

  const institution = db.prepare('SELECT * FROM institutions LIMIT 1').get();
  res.json({ certificate: cert, institution });
});

// ID Card Templates
certificatesRouter.get('/id-cards/templates', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM id_card_templates WHERE is_active = 1 ORDER BY name').all();
  res.json(templates);
});

certificatesRouter.post('/id-cards/templates', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, type, layout, background_color } = req.body;
  if (!name || !layout) { res.status(400).json({ error: 'Name and layout are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO id_card_templates (id, name, type, layout, background_color) VALUES (?, ?, ?, ?, ?)`).run(id, name, type || 'student', layout, background_color || '#ffffff');
  res.status(201).json({ id, message: 'ID card template created' });
});

// Generate ID Card data
certificatesRouter.get('/id-cards/student/:studentId', (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
  const db = getDatabase();
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, sec.name as section_name, b.branch_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE s.id = ?
  `).get(studentId) as any;
  if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

  const institution = db.prepare('SELECT * FROM institutions LIMIT 1').get();
  const parent = db.prepare(`
    SELECT p.* FROM parents p
    JOIN student_parents sp ON p.id = sp.parent_id
    WHERE sp.student_id = ? LIMIT 1
  `).get(studentId);

  res.json({ student, institution, parent });
});
