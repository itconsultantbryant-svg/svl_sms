import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';

export const usersRouter = Router();

// Apply tenant middleware to ALL routes
usersRouter.use(injectTenant);
usersRouter.use(requireTenant);

usersRouter.get('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', role = '', branch = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['u.first_name', 'u.last_name', 'u.username', 'u.email'],
    search
  );

  let where = 'WHERE 1=1 ' + searchClause;
  const params: any[] = [...searchParams];

  if (role) { where += ' AND r.name = ?'; params.push(role); }
  if (branch) { where += ' AND u.branch_id = ?'; params.push(branch); }

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id ${where}
  `).get(...params) as any;

  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar, u.is_active, u.last_login, u.created_at,
           r.name as role_name, r.display_name as role_display_name,
           b.name as branch_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN branches b ON u.branch_id = b.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: users, total: total.count, page: parseInt(page), limit: lim });
});

usersRouter.post('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { username, email, password, first_name, last_name, phone, role_id, branch_id } = req.body;

  if (!username || !password || !first_name || !last_name || !role_id) {
    res.status(400).json({ error: 'Required fields: username, password, first_name, last_name, role_id' });
    return;
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
  if (existing) {
    res.status(409).json({ error: 'Username or email already exists' });
    return;
  }

  const id = generateId();
  const password_hash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, role_id, branch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email || null, password_hash, first_name, last_name, phone || null, role_id, branch_id || null);

  res.status(201).json({ id, message: 'User created successfully' });
});

usersRouter.put('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { email, first_name, last_name, phone, role_id, branch_id, is_active } = req.body;

  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.prepare(`
    UPDATE users SET email = COALESCE(?, email), first_name = COALESCE(?, first_name),
    last_name = COALESCE(?, last_name), phone = COALESCE(?, phone),
    role_id = COALESCE(?, role_id), branch_id = COALESCE(?, branch_id),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ?
  `).run(email, first_name, last_name, phone, role_id, branch_id, is_active, id);

  res.json({ message: 'User updated successfully' });
});

usersRouter.delete('/:id', authorize('platform_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare(`UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ message: 'User deactivated successfully' });
});

usersRouter.get('/roles', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const roles = db.prepare('SELECT * FROM roles ORDER BY name').all();
  res.json(roles);
});
