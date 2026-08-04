import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init';

// CRITICAL: Must match the secret in routes/auth.ts!
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role_id: string | null;
    role_name: string | null;
    role_code: string | null;
    user_type: string;
    institution_id: string | null;
    branch_id: string | null;
  };
  institution_id?: string | null;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  console.log('🔐 Authenticate middleware:', {
    hasAuth: !!authHeader,
    authPreview: authHeader?.substring(0, 30) + '...'
  });

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No auth header or invalid format');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('✅ Token verified, userId:', decoded.userId);

    const db = getDatabase();
    // LEFT JOIN because role_id might be NULL
    const user = db.prepare(`
      SELECT
        u.id, u.username, u.email, u.role_id, u.user_type,
        u.institution_id, u.branch_id,
        r.role_code, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId) as any;

    console.log('User lookup result:', { found: !!user, userId: decoded.userId });

    if (!user) {
      console.log('❌ User not found or inactive');
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    console.log('✅ Auth successful:', user.username);
    next();
  } catch (error: any) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role_code || '')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}
