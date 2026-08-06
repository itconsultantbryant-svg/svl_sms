import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getDatabase } from '../database/init';
import { isExpired, getDaysRemaining } from '../utils/licensing';

export const demoModeRouter = Router();

/**
 * Middleware to check demo mode status and apply restrictions
 */
export function checkDemoMode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user || !req.user.institution_id) {
      next();
      return;
    }

    const db = getDatabase();
    const institutionId = req.user.institution_id;

    // Get the active license
    const license = db
      .prepare(
        `
      SELECT * FROM licenses
      WHERE institution_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(institutionId) as any;

    if (!license) {
      // No license found - deny access
      res.status(403).json({
        error: 'License required',
        redirect: '/setup',
      });
      return;
    }

    const expiryDate = new Date(license.expiry_date);

    // Check if license is expired
    if (isExpired(expiryDate)) {
      if (license.mode === 'demo') {
        res.status(403).json({
          error: 'Demo expired',
          redirect: '/setup',
          expiry: license.expiry_date,
        });
        return;
      } else {
        res.status(403).json({
          error: 'License expired',
          redirect: '/setup',
          expiry: license.expiry_date,
        });
        return;
      }
    }

    // Attach license info to request
    req.user.license_mode = license.mode;
    req.user.license_expiry = license.expiry_date;
    req.user.license_tier = license.plan_tier;
    req.user.days_remaining = getDaysRemaining(expiryDate);
    req.user.license_id = license.id;

    next();
  } catch (error) {
    console.error('Demo mode check error:', error);
    next();
  }
}

/**
 * Middleware to add demo watermark to responses
 */
export function addDemoWatermark(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (
    req.user?.license_mode === 'demo' &&
    res.json &&
    typeof res.json === 'function'
  ) {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      if (typeof data === 'object' && data !== null) {
        data._demo_watermark = true;
        data._demo_expiry = req.user?.license_expiry;
      }
      return originalJson(data);
    };
  }

  next();
}

/**
 * Middleware to block exports/reports in demo mode
 */
export function blockDemoExports(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.license_mode === 'demo') {
    // Check if this is an export/report endpoint
    const exportEndpoints = [
      '/export',
      '/download',
      '/report',
      '/pdf',
      '/excel',
      '/csv',
    ];

    if (
      exportEndpoints.some((endpoint) =>
        req.path.toLowerCase().includes(endpoint)
      )
    ) {
      res.status(403).json({
        error: 'Exports not available in demo mode',
        message: 'Please upgrade to a production license to enable exports',
      });
      return;
    }
  }

  next();
}

/**
 * Middleware to cap student count in demo mode
 */
export function capDemoStudentCount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (
    req.user?.license_mode === 'demo' &&
    req.path === '/api/dashboard/stats' &&
    req.method === 'GET'
  ) {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      if (typeof data === 'object' && data !== null && data.stats) {
        // Cap student count at 50
        if (data.stats.total_students !== undefined) {
          data.stats.total_students = Math.min(data.stats.total_students, 50);
          data.stats._capped_demo = true;
          data.stats._max_students_demo = 50;
        }
      }
      return originalJson(data);
    };
  }

  next();
}

/**
 * GET /api/demo-mode/status
 * Check demo mode status for current institution
 */
demoModeRouter.get('/status', (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user || !req.user.institution_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDatabase();

    // Get license info
    const license = db
      .prepare(
        `
      SELECT * FROM licenses
      WHERE institution_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(req.user.institution_id) as any;

    if (!license) {
      res.json({
        isDemo: false,
        hasLicense: false,
      });
      return;
    }

    const expiryDate = new Date(license.expiry_date);

    res.json({
      isDemo: license.mode === 'demo',
      hasLicense: true,
      mode: license.mode,
      planTier: license.plan_tier,
      expired: isExpired(expiryDate),
      expiry: license.expiry_date,
      daysRemaining: getDaysRemaining(expiryDate),
    });
  } catch (error: any) {
    console.error('Demo mode status error:', error);
    res.status(500).json({
      error: 'Failed to get demo mode status',
      message: error.message,
    });
  }
});

/**
 * POST /api/demo-mode/setup
 * Setup demo mode for a new institution
 * Creates a demo license and settings
 */
demoModeRouter.post('/setup', (req: AuthRequest, res: Response): void => {
  try {
    if (!req.user || !req.user.institution_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Only institution admins can setup demo mode
    if (req.user.user_type !== 'institution_admin') {
      res.status(403).json({
        error: 'Only institution admins can setup demo mode',
      });
      return;
    }

    const db = getDatabase();
    const institutionId = req.user.institution_id;

    // Check if already has an active license
    const existingLicense = db
      .prepare(
        `
      SELECT * FROM licenses
      WHERE institution_id = ? AND status IN ('active', 'inactive')
      LIMIT 1
    `
      )
      .get(institutionId) as any;

    if (existingLicense) {
      res.status(409).json({
        error: 'Institution already has a license',
      });
      return;
    }

    // Create demo license (30 days)
    const demoExpiry = new Date();
    demoExpiry.setDate(demoExpiry.getDate() + 30);

    const licenseId = `lic_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const licenseKey = `SVL-DEMO-${institutionId.substring(0, 8).toUpperCase()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO licenses
      (id, institution_id, license_key, mode, plan_tier, expiry_date, status, created_at, updated_at)
      VALUES (?, ?, ?, 'demo', 'free', ?, 'active', ?, ?)
    `
    ).run(licenseId, institutionId, licenseKey, demoExpiry.toISOString(), now, now);

    // Create demo mode settings
    const demoSettingsId = `dms_${Date.now()}`;
    db.prepare(
      `
      INSERT INTO demo_mode_settings
      (id, institution_id, max_students, expiry_date, created_at, updated_at)
      VALUES (?, ?, 50, ?, ?, ?)
    `
    ).run(demoSettingsId, institutionId, demoExpiry.toISOString(), now, now);

    res.status(201).json({
      message: 'Demo mode setup successful',
      mode: 'demo',
      planTier: 'free',
      maxStudents: 50,
      expiryDate: demoExpiry.toISOString(),
      daysValid: 30,
    });
  } catch (error: any) {
    console.error('Demo mode setup error:', error);
    res.status(500).json({
      error: 'Failed to setup demo mode',
      message: error.message,
    });
  }
});
