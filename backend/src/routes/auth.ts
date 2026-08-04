import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';
import { generateId } from '../utils/helpers';

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const db = getDatabase();
    const user = db.prepare(`
      SELECT
        u.*,
        r.role_code as role_code,
        r.role_name as role_name,
        b.branch_name as branch_name,
        i.institution_name as institution_name,
        i.institution_code as institution_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
    `).get(username, username) as any;

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    db.prepare(`UPDATE users SET last_login = datetime('now'), last_login_ip = ? WHERE id = ?`)
      .run(req.ip || req.connection.remoteAddress, user.id);

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar,
        user_type: user.user_type,
        institution_id: user.institution_id,
        institution_name: user.institution_name,
        institution_code: user.institution_code,
        role: {
          id: user.role_id,
          code: user.role_code,
          name: user.role_name,
        },
        branch: user.branch_id ? {
          id: user.branch_id,
          name: user.branch_name,
        } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT
      u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar,
      u.user_type, u.institution_id,
      r.id as role_id, r.role_code as role_code, r.role_name as role_name,
      b.id as branch_id, b.branch_name as branch_name,
      i.institution_name, i.institution_code
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN branches b ON u.branch_id = b.id
    LEFT JOIN institutions i ON u.institution_id = i.id
    WHERE u.id = ?
  `).get(req.user!.id) as any;

  const permissions = db.prepare(`
    SELECT p.permission_code FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `).all(user.role_id).map((p: any) => p.permission_code);

  res.json({
    ...user,
    role: { id: user.role_id, name: user.role_name, display_name: user.role_display_name },
    branch: user.branch_id ? { id: user.branch_id, name: user.branch_name } : null,
    permissions,
  });
});

authRouter.post('/change-password', authenticate, (req: AuthRequest, res: Response) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Current and new password are required' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as any;

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user!.id);

  res.json({ message: 'Password changed successfully' });
});
