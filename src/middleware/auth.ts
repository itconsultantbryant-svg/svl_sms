import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init';

const JWT_SECRET = process.env.JWT_SECRET || 'svl-sms-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role_id: string;
    role_name: string;
    role_code: string;
    user_type: string;
    institution_id: string | null;
    branch_id: string | null;
  };
  institution_id?: string | null;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = getDatabase();
    const user = db.prepare(`
      SELECT
        u.id, u.username, u.email, u.role_id, u.user_type,
        u.institution_id, u.branch_id,
        r.role_code, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId) as any;

    if (!user) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role_code)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}
