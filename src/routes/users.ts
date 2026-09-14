import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { purgeUser } from '../utils/purgeRecords';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, generateDefaultPassword, paginate, buildSearchQuery } from '../utils/helpers';
import { ensureUserRole, getMergedAccessForUser, setUserRoles, setUserExtraPermissions } from '../utils/userAccess';

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

  const institutionFilter = req.institution_id ? `u.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${institutionFilter} ` + searchClause;
  const params: any[] = [...searchParams];

  if (role) { where += ' AND r.role_name = ?'; params.push(role); }
  if (branch) { where += ' AND u.branch_id = ?'; params.push(branch); }

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ${where}
  `).get(...params) as any;

  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar,
           u.user_type, u.is_active, u.last_login, u.created_at, u.role_id,
           r.role_name as role_name, r.role_code as role_code,
           b.branch_name as branch_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN branches b ON u.branch_id = b.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  const withRoles = users.map((u: any) => {
    const access = getMergedAccessForUser(u.id, u.role_id);
    return { ...u, roles: access.roles, permissions: access.permissions, role_codes: access.role_codes };
  });

  res.json({ data: withRoles, total: total.count, page: parseInt(page), limit: lim });
});

usersRouter.get('/roles', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const inst = req.institution_id
    ? `WHERE institution_id = '${req.institution_id}' OR institution_id IS NULL OR is_platform_role = 1`
    : '';
  const roles = db.prepare(`
    SELECT id, role_code, role_name, description, permissions, role_level, institution_id
    FROM roles ${inst}
    ORDER BY role_name
  `).all();
  res.json(roles);
});

usersRouter.get('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar,
           u.user_type, u.is_active, u.role_id, u.institution_id, u.branch_id
    FROM users u WHERE u.id = ?
  `).get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const access = getMergedAccessForUser(user.id, user.role_id);
  res.json({ ...user, roles: access.roles, permissions: access.permissions, role_codes: access.role_codes });
});

usersRouter.post('/', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const {
    username, email, password, first_name, last_name, phone, role_id, role_ids,
    branch_id, user_type, avatar, extra_permissions
  } = req.body;

  if (!username || !first_name || !last_name || (!role_id && !(Array.isArray(role_ids) && role_ids.length))) {
    res.status(400).json({ error: 'Required fields: username, first_name, last_name, role_id or role_ids' });
    return;
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }
  if (email) {
    const emailTaken = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (emailTaken) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
  }

  const id = generateId();
  const temporary_password = password || generateDefaultPassword();
  const password_hash = bcrypt.hashSync(temporary_password, 10);
  const rolesToSet: string[] = Array.isArray(role_ids) && role_ids.length
    ? role_ids
    : [role_id];
  const primaryRole = rolesToSet[0];
  const resolvedType = user_type || 'staff';

  db.prepare(`
    INSERT INTO users (
      id, institution_id, username, email, password_hash, first_name, last_name,
      phone, avatar, role_id, branch_id, user_type, is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.institution_id,
    username,
    email || null,
    password_hash,
    first_name,
    last_name,
    phone || null,
    avatar || null,
    primaryRole,
    branch_id || null,
    resolvedType
  );

  setUserRoles(id, rolesToSet);
  if (Array.isArray(extra_permissions)) setUserExtraPermissions(id, extra_permissions);
  if (Array.isArray(extra_permissions)) setUserExtraPermissions(id, extra_permissions);

  res.status(201).json({
    id,
    username,
    temporary_password,
    message: 'User created successfully',
  });
});

usersRouter.put('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { email, first_name, last_name, phone, role_id, role_ids, branch_id, is_active, avatar, user_type, extra_permissions } = req.body;

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
    is_active = COALESCE(?, is_active), avatar = COALESCE(?, avatar),
    user_type = COALESCE(?, user_type), updated_at = datetime('now')
    WHERE id = ?
  `).run(email, first_name, last_name, phone, role_id, branch_id, is_active, avatar, user_type, id);

  if (Array.isArray(role_ids)) {
    setUserRoles(id, role_ids);
  } else if (role_id) {
    ensureUserRole(id, role_id, true);
  }
  if (Array.isArray(extra_permissions)) setUserExtraPermissions(id, extra_permissions);

  res.json({ message: 'User updated successfully' });
});

usersRouter.put('/:id/roles', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { role_ids } = req.body;
  if (!Array.isArray(role_ids) || role_ids.length === 0) {
    res.status(400).json({ error: 'role_ids[] required' });
    return;
  }
  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  setUserRoles(req.params.id, role_ids);
  const access = getMergedAccessForUser(req.params.id, role_ids[0]);
  res.json({ message: 'Roles updated', roles: access.roles, permissions: access.permissions });
});

usersRouter.delete('/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user?.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id, institution_id, user_type, username FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.username === 'superadmin' || user.user_type === 'platform_admin') {
    res.status(400).json({ error: 'This account cannot be deleted' });
    return;
  }
  if (req.user?.user_type !== 'platform_admin' && user.institution_id !== req.institution_id) {
    res.status(403).json({ error: 'You can only delete users in your school' });
    return;
  }

  try {
    purgeUser(db, id);
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});
