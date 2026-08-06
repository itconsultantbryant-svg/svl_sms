import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { getDatabase } from '../database/init';

/**
 * Tenant Middleware - Injects institution_id into requests
 *
 * This middleware ensures proper tenant isolation by:
 * 1. Platform admins can specify institution via X-Institution-ID header
 * 2. Institution admins are auto-scoped to their institution
 * 3. Prevents cross-tenant data access
 */
export const injectTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Platform admin can specify institution via header (for multi-institution management)
  if (user.user_type === 'platform_admin') {
    const headerInstitutionId = req.headers['x-institution-id'] as string;

    if (headerInstitutionId) {
      req.institution_id = headerInstitutionId;
    } else {
      // Auto-select first institution so routes work without explicit selection
      try {
        const db = getDatabase();
        const first = db.prepare('SELECT id FROM institutions WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1').get() as any;
        req.institution_id = first?.id || null;
      } catch (e) {
        req.institution_id = null;
      }
    }
  } else {
    // All other users are scoped to their institution
    req.institution_id = user.institution_id;

    if (!req.institution_id) {
      return res.status(403).json({
        error: 'No institution access',
        message: 'Your account is not associated with any institution'
      });
    }
  }

  next();
};

/**
 * Require Tenant Context - Ensures institution_id is present
 * Platform admins are allowed through without a tenant (they get aggregate data)
 */
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.institution_id && req.user?.user_type !== 'platform_admin') {
    return res.status(400).json({
      error: 'Institution context required',
      message: 'Please specify an institution using X-Institution-ID header'
    });
  }
  next();
};

/**
 * Platform Admin Only - Restricts access to platform administrators
 */
export const platformAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.user_type !== 'platform_admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This operation requires platform administrator privileges'
    });
  }
  next();
};

/**
 * Institution Admin or Higher - Allows institution admins and platform admins
 */
export const institutionAdminOrHigher = (req: AuthRequest, res: Response, next: NextFunction) => {
  const userType = req.user?.user_type;

  if (userType !== 'platform_admin' && userType !== 'institution_admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This operation requires institution administrator privileges'
    });
  }
  next();
};

/**
 * Helper function to build WHERE clause with institution filter
 */
export const withInstitutionFilter = (baseWhere: string, institutionId: string | null): string => {
  if (!institutionId) {
    // No institution filter for platform-level queries
    return baseWhere;
  }

  if (baseWhere.trim().toUpperCase().includes('WHERE')) {
    return `${baseWhere} AND institution_id = '${institutionId}'`;
  } else {
    return `${baseWhere} WHERE institution_id = '${institutionId}'`;
  }
};
