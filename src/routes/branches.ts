import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const branchesRouter = Router();

// Apply tenant middleware to ALL routes
branchesRouter.use(injectTenant);
branchesRouter.use(requireTenant);

branchesRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  const branches = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM students s WHERE s.branch_id = b.id AND s.status = 'active') as student_count,
      (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.is_active = 1) as employee_count
    FROM branches b
    WHERE b.institution_id = ? AND b.is_active = 1
    ORDER BY b.is_main DESC, b.branch_name
  `).all(req.institution_id);
  res.json(branches);
});

branchesRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND institution_id = ?').get(id, req.institution_id);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  res.json(branch);
});

branchesRouter.post('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, code, address, phone, email, is_main, institution_id } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Branch name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  const instId = institution_id || db.prepare('SELECT id FROM institutions LIMIT 1').get() as any;

  db.prepare(`
    INSERT INTO branches (id, institution_id, name, code, address, phone, email, is_main)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, instId?.id || instId, name, code || null, address || null, phone || null, email || null, is_main ? 1 : 0);

  res.status(201).json({ id, message: 'Branch created successfully' });
});

branchesRouter.put('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, address, phone, email, is_main, is_active } = req.body;

  const db = getDatabase();
  const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(id);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }

  db.prepare(`
    UPDATE branches SET name = COALESCE(?, name), code = COALESCE(?, code),
    address = COALESCE(?, address), phone = COALESCE(?, phone), email = COALESCE(?, email),
    is_main = COALESCE(?, is_main), is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(name, code, address, phone, email, is_main, is_active, id);

  res.json({ message: 'Branch updated successfully' });
});

branchesRouter.delete('/:id', authorize('platform_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare(`UPDATE branches SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ message: 'Branch deactivated successfully' });
});
