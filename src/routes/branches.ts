import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const branchesRouter = Router();

branchesRouter.use(injectTenant);
branchesRouter.use(requireTenant);

function mapBranch(row: any) {
  if (!row) return row;
  return {
    ...row,
    name: row.branch_name ?? row.name,
    code: row.branch_code ?? row.code,
  };
}

branchesRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const branches = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM students s WHERE s.branch_id = b.id AND s.status = 'active') as student_count,
      (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.is_active = 1) as employee_count
    FROM branches b
    WHERE b.institution_id = ? AND b.is_active = 1
    ORDER BY b.is_main DESC, b.branch_name
  `).all(req.institution_id);
  res.json((branches as any[]).map(mapBranch));
});

branchesRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND institution_id = ?').get(id, req.institution_id);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  res.json(mapBranch(branch));
});

branchesRouter.post('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, code, branch_name, branch_code, address, phone, email, is_main } = req.body;
  const resolvedName = branch_name || name;
  const resolvedCode = branch_code || code;

  if (!resolvedName) {
    res.status(400).json({ error: 'Branch name is required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();

  db.prepare(`
    INSERT INTO branches (id, institution_id, branch_name, branch_code, address, phone, email, is_main, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.institution_id,
    resolvedName,
    resolvedCode || `BR-${Date.now().toString(36).toUpperCase()}`,
    address || null,
    phone || null,
    email || null,
    is_main ? 1 : 0
  );

  res.status(201).json({ id, message: 'Branch created successfully' });
});

branchesRouter.put('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, branch_name, branch_code, address, phone, email, is_main, is_active } = req.body;

  const db = getDatabase();
  const branch = db.prepare('SELECT id FROM branches WHERE id = ? AND institution_id = ?').get(id, req.institution_id);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }

  const resolvedName = branch_name ?? name;
  const resolvedCode = branch_code ?? code;

  db.prepare(`
    UPDATE branches SET
      branch_name = COALESCE(?, branch_name),
      branch_code = COALESCE(?, branch_code),
      address = COALESCE(?, address),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      is_main = COALESCE(?, is_main),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ? AND institution_id = ?
  `).run(
    resolvedName ?? null,
    resolvedCode ?? null,
    address ?? null,
    phone ?? null,
    email ?? null,
    is_main === undefined ? null : (is_main ? 1 : 0),
    is_active === undefined ? null : (is_active ? 1 : 0),
    id,
    req.institution_id
  );

  res.json({ message: 'Branch updated successfully' });
});

branchesRouter.delete('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare(`UPDATE branches SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND institution_id = ?`)
    .run(id, req.institution_id);
  res.json({ message: 'Branch deactivated successfully' });
});
