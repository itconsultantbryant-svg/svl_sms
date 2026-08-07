import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init';
import { isExpired, getDaysRemaining } from '../utils/licensing';

// CRITICAL: Must match the secret in routes/auth.ts!
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role_id: string | null;
    role_name: string | null;
    role_code: string | null;
    user_type: string;
    institution_id: string | null;
    branch_id: string | null;
    // License fields
    license_mode?: string;
    license_expiry?: string;
    license_tier?: string;
    days_remaining?: number;
    license_id?: string;
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
        u.id, u.username, u.email, u.first_name, u.last_name,
        u.role_id, u.user_type,
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

    // Platform superadmin manages the whole system — never gated by school licenses
    if (user.user_type === 'platform_admin') {
      user.license_mode = 'production';
      user.license_tier = 'enterprise';
      user.days_remaining = null;
      req.user = user;
      console.log('✅ Auth successful (platform admin):', user.username);
      next();
      return;
    }

    // Check license status after user is authenticated
    const license = db
      .prepare(
        `
        SELECT * FROM licenses
        WHERE institution_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(user.institution_id) as any;

    if (license) {
      const expiryDate = new Date(license.expiry_date);
      const expired = isExpired(expiryDate);

      // Attach license info to user object
      user.license_mode = license.mode;
      user.license_expiry = license.expiry_date;
      user.license_tier = license.plan_tier;
      user.days_remaining = expired ? 0 : getDaysRemaining(expiryDate);
      user.license_id = license.id;

      // Check if license is expired
      if (expired) {
        if (license.mode === 'demo') {
          console.log('❌ Demo license expired');
          res.status(403).json({
            error: 'Demo expired',
            redirect: '/setup',
            expiry: license.expiry_date,
          });
          return;
        } else {
          console.log('❌ Production license expired');
          res.status(403).json({
            error: 'License expired',
            redirect: '/setup',
            expiry: license.expiry_date,
          });
          return;
        }
      }
    } else {
      console.log('❌ No license found for institution');
      res.status(403).json({
        error: 'License required',
        redirect: '/setup',
      });
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
    if (roles.length > 0) {
      const userRoleCode = req.user.role_code || '';
      const userType = req.user.user_type || '';
      if (!roles.includes(userRoleCode) && !roles.includes(userType)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }
    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Permission-based authorization
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Platform admins and institution admins have all permissions
    if (req.user.user_type === 'platform_admin' || req.user.user_type === 'institution_admin') {
      next();
      return;
    }

    // Get user's role permissions
    if (!req.user.role_id) {
      res.status(403).json({ error: 'No role assigned' });
      return;
    }

    const db = getDatabase();
    const role = db.prepare(`
      SELECT permissions FROM roles WHERE id = ?
    `).get(req.user.role_id) as any;

    if (!role || !role.permissions) {
      res.status(403).json({ error: 'No permissions found' });
      return;
    }

    const userPermissions = JSON.parse(role.permissions) as string[];

    // Check if user has any of the required permissions
    const hasPermission = permissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        message: 'You do not have permission to perform this action'
      });
      return;
    }

    next();
  };
}

// Check if user has specific permission (for conditional logic)
export function hasPermission(req: AuthRequest, permission: string): boolean {
  if (!req.user) return false;

  // Platform admins and institution admins have all permissions
  if (req.user.user_type === 'platform_admin' || req.user.user_type === 'institution_admin') {
    return true;
  }

  if (!req.user.role_id) return false;

  const db = getDatabase();
  const role = db.prepare(`
    SELECT permissions FROM roles WHERE id = ?
  `).get(req.user.role_id) as any;

  if (!role || !role.permissions) return false;

  const userPermissions = JSON.parse(role.permissions) as string[];
  return userPermissions.includes(permission);
}
