import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

function mapUserResponse(user: any) {
  return {
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
    institution_logo: user.logo,
    institution_website: user.website,
    institution_motto: user.motto,
    primary_color: user.primary_color,
    secondary_color: user.secondary_color,
    accent_color: user.accent_color,
    role: {
      id: user.role_id,
      code: user.role_code,
      name: user.role_name,
      display_name: user.role_name,
    },
    branch: user.branch_id
      ? {
          id: user.branch_id,
          name: user.branch_name,
        }
      : null,
  };
}

const USER_SELECT = `
  SELECT u.*,
         r.role_code, r.role_name,
         i.institution_name, i.institution_code, i.logo, i.website, i.motto,
         i.primary_color, i.secondary_color, i.accent_color,
         b.branch_name
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN institutions i ON u.institution_id = i.id
  LEFT JOIN branches b ON u.branch_id = b.id
`;

// Public: school branding for login page (by institution code)
authRouter.get('/branding', (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) {
      res.json({ branding: null });
      return;
    }

    const db = getDatabase();
    const branding = db.prepare(`
      SELECT institution_name, institution_code, logo, website, motto,
             primary_color, secondary_color, accent_color
      FROM institutions
      WHERE LOWER(institution_code) = LOWER(?) AND is_active = 1
      LIMIT 1
    `).get(code);

    res.json({ branding: branding || null });
  } catch (error: any) {
    console.error('Branding lookup error:', error);
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();
    const identifier = (username || '').trim().toLowerCase();
    const user = db.prepare(`
      ${USER_SELECT}
      WHERE u.is_active = 1
        AND (LOWER(u.username) = ? OR LOWER(u.email) = ?)
      LIMIT 1
    `).get(identifier, identifier) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: mapUserResponse(user),
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = getDatabase();

    const user = db.prepare(`
      ${USER_SELECT}
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId) as any;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json(mapUserResponse(user));
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});
