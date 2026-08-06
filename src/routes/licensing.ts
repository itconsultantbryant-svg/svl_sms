import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getDatabase } from '../database/init';
import {
  generateLicenseKey,
  validateLicenseKey,
  generateMachineFingerprint,
  getDaysRemaining,
  isExpired,
} from '../utils/licensing';

export const licensingRouter = Router();

/**
 * POST /api/licensing/activate
 * Activate a license on a specific machine
 * No authentication required for initial activation
 */
licensingRouter.post('/activate', (req: AuthRequest, res: Response): void => {
  try {
    const { license_key, machine_id, institution_id } = req.body;

    if (!license_key || !machine_id) {
      res.status(400).json({
        error: 'Missing required fields: license_key, machine_id',
      });
      return;
    }

    const db = getDatabase();

    // Validate the license key format
    const validation = validateLicenseKey(license_key);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid license key format',
        expected: 'SVL-XXXX-XXXX-XXXX-XXXX',
      });
      return;
    }

    // Look up the license
    const license = db
      .prepare(
        `
      SELECT * FROM licenses
      WHERE license_key = ? AND (status = 'active' OR status = 'inactive')
    `
      )
      .get(license_key) as any;

    if (!license) {
      res.status(404).json({
        error: 'License not found or invalid',
      });
      return;
    }

    // Check if license is expired
    const expiryDate = new Date(license.expiry_date);
    if (isExpired(expiryDate)) {
      res.status(403).json({
        error: 'License has expired',
        expiry: license.expiry_date,
      });
      return;
    }

    // For production licenses, check machine fingerprint match
    if (license.mode === 'production' && license.machine_fingerprint) {
      if (license.machine_fingerprint !== machine_id) {
        res.status(403).json({
          error: 'Machine ID does not match license binding',
        });
        return;
      }
    }

    // Check for existing activation
    const existingActivation = db
      .prepare(
        `
      SELECT * FROM license_activations
      WHERE license_id = ? AND machine_id = ?
    `
      )
      .get(license.id, machine_id) as any;

    let activation;
    if (existingActivation) {
      // Update existing activation
      const now = new Date().toISOString();
      db.prepare(
        `
        UPDATE license_activations
        SET last_check_in = ?, updated_at = ?
        WHERE license_id = ? AND machine_id = ?
      `
      ).run(now, now, license.id, machine_id);

      activation = db
        .prepare(
          `
        SELECT * FROM license_activations
        WHERE license_id = ? AND machine_id = ?
      `
        )
        .get(license.id, machine_id);
    } else {
      // Create new activation
      const activationId = `la_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const ipAddress = req.ip || 'unknown';

      db.prepare(
        `
        INSERT INTO license_activations
        (id, institution_id, license_id, machine_id, activated_at, last_check_in, ip_address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        activationId,
        license.institution_id,
        license.id,
        machine_id,
        now,
        now,
        ipAddress,
        now,
        now
      );

      activation = db
        .prepare(
          `
        SELECT * FROM license_activations
        WHERE id = ?
      `
        )
        .get(activationId);
    }

    // Update license status if needed
    if (license.status === 'inactive') {
      db.prepare(
        `
        UPDATE licenses
        SET status = 'active', activated_at = ?
        WHERE id = ?
      `
      ).run(new Date().toISOString(), license.id);
    }

    res.json({
      status: 'activated',
      mode: license.mode,
      planTier: license.plan_tier,
      expiry: license.expiry_date,
      daysRemaining: getDaysRemaining(expiryDate),
      machineId: machine_id,
      licenseId: license.id,
    });
  } catch (error: any) {
    console.error('License activation error:', error);
    res.status(500).json({
      error: 'Activation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/licensing/check
 * Check current license status
 * Requires authentication
 */
licensingRouter.get(
  '/check',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      if (!req.user || !req.user.institution_id) {
        res.status(401).json({ error: 'Not authenticated or no institution' });
        return;
      }

      const db = getDatabase();
      const institutionId = req.user.institution_id;

      // Get the active license for this institution
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
        res.status(404).json({
          error: 'No active license found',
          status: 'unlicensed',
        });
        return;
      }

      const expiryDate = new Date(license.expiry_date);
      const daysRemaining = getDaysRemaining(expiryDate);
      const expired = isExpired(expiryDate);

      // Get demo mode settings if applicable
      let demoSettings = null;
      if (license.mode === 'demo') {
        demoSettings = db
          .prepare(
            `
          SELECT max_students FROM demo_mode_settings
          WHERE institution_id = ?
        `
          )
          .get(institutionId) as any;
      }

      res.json({
        mode: license.mode,
        status: expired ? 'expired' : 'active',
        planTier: license.plan_tier,
        expiry: license.expiry_date,
        daysRemaining: expired ? 0 : daysRemaining,
        licenseId: license.id,
        demoMaxStudents: demoSettings?.max_students || null,
      });
    } catch (error: any) {
      console.error('License check error:', error);
      res.status(500).json({
        error: 'Check failed',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/licensing/check-in
 * Periodic license check-in for validation and sync
 * Hybrid: works offline but stores check-in for server validation
 */
licensingRouter.post(
  '/check-in',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      if (!req.user || !req.user.institution_id) {
        res.status(401).json({ error: 'Not authenticated or no institution' });
        return;
      }

      const { machine_id } = req.body;

      if (!machine_id) {
        res.status(400).json({
          error: 'Missing required field: machine_id',
        });
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
        res.status(404).json({
          error: 'No active license found',
          valid: false,
        });
        return;
      }

      const expiryDate = new Date(license.expiry_date);
      const expired = isExpired(expiryDate);

      if (expired) {
        res.status(403).json({
          error: 'License has expired',
          valid: false,
          expiry: license.expiry_date,
        });
        return;
      }

      // Update last check-in
      const now = new Date().toISOString();
      const ipAddress = req.ip || 'unknown';

      db.prepare(
        `
        UPDATE license_activations
        SET last_check_in = ?, ip_address = ?, updated_at = ?
        WHERE license_id = ? AND machine_id = ?
      `
      ).run(now, ipAddress, now, license.id, machine_id);

      res.json({
        valid: true,
        mode: license.mode,
        planTier: license.plan_tier,
        expiry: license.expiry_date,
        daysRemaining: getDaysRemaining(expiryDate),
        checkedInAt: now,
      });
    } catch (error: any) {
      console.error('License check-in error:', error);
      res.status(500).json({
        error: 'Check-in failed',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/licensing/generate-key
 * Admin endpoint to generate a new license key (for testing/admin only)
 * Requires authentication and admin privileges
 */
licensingRouter.post(
  '/generate-key',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      // Only platform admins can generate keys
      if (req.user?.user_type !== 'platform_admin') {
        res.status(403).json({
          error: 'Only platform admins can generate license keys',
        });
        return;
      }

      const {
        institution_id,
        plan_tier = 'basic',
        mode = 'demo',
        expiry_days = 30,
      } = req.body;

      if (!institution_id) {
        res.status(400).json({
          error: 'Missing required field: institution_id',
        });
        return;
      }

      const db = getDatabase();

      // Verify institution exists
      const institution = db
        .prepare('SELECT id FROM institutions WHERE id = ?')
        .get(institution_id) as any;

      if (!institution) {
        res.status(404).json({
          error: 'Institution not found',
        });
        return;
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiry_days);

      // Generate the license key
      const licenseKey = generateLicenseKey({
        institution: institution_id,
        expiryDate: expiryDate,
        planTier: plan_tier,
      });

      // Save to database
      const licenseId = `lic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      db.prepare(
        `
        INSERT INTO licenses
        (id, institution_id, license_key, mode, plan_tier, expiry_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'inactive', ?, ?)
      `
      ).run(
        licenseId,
        institution_id,
        licenseKey,
        mode,
        plan_tier,
        expiryDate.toISOString(),
        now,
        now
      );

      res.json({
        licenseKey,
        mode,
        planTier: plan_tier,
        expiryDate: expiryDate.toISOString(),
        daysValid: expiry_days,
      });
    } catch (error: any) {
      console.error('License key generation error:', error);
      res.status(500).json({
        error: 'Key generation failed',
        message: error.message,
      });
    }
  }
);
