import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getDatabase } from '../database/init';
import {
  validateLicenseKey,
  getDaysRemaining,
  isExpired,
} from '../utils/licensing';
import { issueLicenseKey } from '../utils/license-issuer';

export const licensingRouter = Router();

/**
 * GET /api/licensing/status
 * Backend/desktop license status — no auth required.
 * The Electron main process calls this for the get-license-status IPC.
 * Optional scoping: X-Institution-ID header or ?institution_id= query.
 */
licensingRouter.get('/status', (req: AuthRequest, res: Response): void => {
  try {
    const db = getDatabase();
    const institution_id =
      (req.query.institution_id as string) ||
      (typeof req.headers['x-institution-id'] === 'string'
        ? (req.headers['x-institution-id'] as string)
        : undefined);

    // Institution-scoped status (most useful for a logged-in school)
    if (institution_id) {
      const license = db
        .prepare(
          `
          SELECT * FROM licenses
          WHERE institution_id = ? AND status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `
        )
        .get(institution_id) as any;

      if (!license) {
        res.json({ status: 'unlicensed', message: 'No active license for this institution' });
        return;
      }

      const expiryDate = new Date(license.expiry_date);
      const expired = isExpired(expiryDate);
      const daysRemaining = getDaysRemaining(expiryDate);

      res.json({
        status: expired ? 'expired' : 'active',
        message: expired ? 'License has expired' : 'License is active',
        mode: license.mode,
        planTier: license.plan_tier,
        expiry: license.expiry_date,
        expiresAt: license.expiry_date,
        daysRemaining: expired ? 0 : daysRemaining,
        licenseId: license.id,
      });
      return;
    }

    // Global summary — the backend itself is reachable
    const active = db
      .prepare(`SELECT COUNT(*) as count FROM licenses WHERE status = 'active'`)
      .get() as any;

    res.json({
      status: 'online',
      message: 'Backend is online',
      licensed: active.count > 0,
      totalActiveLicenses: active.count,
    });
  } catch (error: any) {
    console.error('License status error:', error);
    res.status(500).json({ error: 'Status check failed', message: error.message });
  }
});

/**
 * POST /api/licensing/activate
 * Activate a license on a specific machine
 * No authentication required for initial activation
 */
licensingRouter.post('/activate', (req: AuthRequest, res: Response): void => {
  try {
    const { license_key: lk1, key: lk2, machine_id: mid, institution_id } = req.body;
    const license_key = lk1 || lk2;

    if (!license_key) {
      res.status(400).json({
        error: 'Missing required field: license_key',
      });
      return;
    }

    // Auto-generate machine_id if not provided (for web deployments)
    const machine_id = mid || `web-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

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

    // Look up the license locally first.
    let license = db
      .prepare(
        `
      SELECT * FROM licenses
      WHERE license_key = ? AND (status = 'active' OR status = 'inactive')
    `
      )
      .get(license_key) as any;

    // Offline auto-activation: a key issued elsewhere (online platform admin or
    // the CLI tool) is not in the local desktop database. The key format is
    // validated above; if it isn't in the local DB, create a local production
    // license on the fly so the desktop can activate and run offline — the
    // documented offline-first behavior (see LICENSING_COMPLETE_GUIDE.md).
    // Online check-ins can reconcile against the server in a future release.
    let offlineActivated = false;
    if (!license) {
      // Desktop-only path. The Electron backend is spawned with
      // ELECTRON_MODE=true (electron/main.ts spawnBackend); the online
      // deployment never sets it. On the web, an unknown key must keep
      // returning 404 so platform-admin-issued keys remain the only way to
      // license a school.
      if (process.env.ELECTRON_MODE !== 'true') {
        res.status(404).json({ error: 'License not found' });
        return;
      }

      // First-run offline activation: a fresh desktop install has no logged-in
      // user and no institution row yet, so the school can't supply an
      // institution_id. Auto-create a default offline institution to bind the
      // license to a real tenant (licenses.institution_id is a NOT NULL FK).
      // The frontend persists the returned institution_id for later calls.
      let resolvedInstitutionId = institution_id;

      if (!resolvedInstitutionId) {
        const existing = db
          .prepare("SELECT id FROM institutions WHERE institution_code = 'OFFLINE' LIMIT 1")
          .get() as any;
        if (existing) {
          resolvedInstitutionId = existing.id;
        } else {
          const { v4: uuidv4 } = require('uuid');
          const newInstId = uuidv4();
          db.prepare(
            `
            INSERT INTO institutions
            (id, institution_code, institution_name, institution_type, country, currency, currency_symbol, setup_completed)
            VALUES (?, 'OFFLINE', 'Offline School', 'other', 'Liberia', 'USD', '$', 1)
          `
          ).run(newInstId);
          resolvedInstitutionId = newInstId;
          console.log('💾 Offline activation: created default OFFLINE institution', newInstId);
        }
      } else {
        // Verify the institution exists (licenses.institution_id is a NOT NULL FK)
        const institution = db
          .prepare('SELECT id FROM institutions WHERE id = ?')
          .get(resolvedInstitutionId) as any;

        if (!institution) {
          res.status(404).json({ error: 'Institution not found' });
          return;
        }
      }

      const offlineLicenseId = `lic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // Honor the SIGNED key's plan tier and expiry. validateLicenseKey already
      // verified the signature, so validation.expiry / planTier are trustworthy.
      const offlineExpiry = validation.expiry || new Date(Date.now() + 365 * 86400000);
      const offlineTier = validation.planTier || 'standard';

      db.prepare(
        `
        INSERT INTO licenses
        (id, institution_id, license_key, mode, plan_tier, expiry_date, status, machine_fingerprint, created_at, updated_at)
        VALUES (?, ?, ?, 'production', ?, ?, 'active', ?, ?, ?)
      `
      ).run(
        offlineLicenseId,
        resolvedInstitutionId,
        license_key,
        offlineTier,
        offlineExpiry.toISOString(),
        machine_id,
        now,
        now
      );

      license = db
        .prepare('SELECT * FROM licenses WHERE id = ?')
        .get(offlineLicenseId) as any;
      offlineActivated = true;

      console.log('💾 Offline activation: key not in local DB — created local license', {
        licenseId: offlineLicenseId,
        institution_id: resolvedInstitutionId,
        planTier: offlineTier,
        expiry: offlineExpiry.toISOString(),
      });
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
      institutionId: license.institution_id,
      offlineActivated,
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

      // Update last check-in. Self-heal: if this machine has no activation row
      // yet (e.g. a license auto-created offline on another machine), create
      // one instead of silently no-op'ing the UPDATE.
      const now = new Date().toISOString();
      const ipAddress = req.ip || 'unknown';

      const existingActivation = db
        .prepare(
          `
          SELECT id FROM license_activations
          WHERE license_id = ? AND machine_id = ?
        `
        )
        .get(license.id, machine_id) as any;

      if (existingActivation) {
        db.prepare(
          `
          UPDATE license_activations
          SET last_check_in = ?, ip_address = ?, updated_at = ?
          WHERE license_id = ? AND machine_id = ?
        `
        ).run(now, ipAddress, now, license.id, machine_id);
      } else {
        db.prepare(
          `
          INSERT INTO license_activations
          (id, institution_id, license_id, machine_id, activated_at, last_check_in, ip_address, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          `la_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          institutionId,
          license.id,
          machine_id,
          now,
          now,
          ipAddress,
          now,
          now
        );
      }

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
 * GET /api/licensing/keys
 * Platform admin: list all license keys
 */
licensingRouter.get(
  '/keys',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      if (req.user?.user_type !== 'platform_admin') {
        res.status(403).json({ error: 'Only platform admins can view license keys' });
        return;
      }

      const db = getDatabase();
      const { search = '', status = '', mode = '' } = req.query as any;

      let where = 'WHERE 1=1';
      const params: any[] = [];

      if (search) {
        where += ` AND (
          l.license_key LIKE ? OR
          i.institution_name LIKE ? OR
          i.institution_code LIKE ?
        )`;
        const q = `%${search}%`;
        params.push(q, q, q);
      }

      if (status) {
        where += ' AND l.status = ?';
        params.push(status);
      }

      if (mode) {
        where += ' AND l.mode = ?';
        params.push(mode);
      }

      const licenses = db
        .prepare(
          `
        SELECT
          l.id,
          l.license_key,
          l.institution_id,
          l.mode,
          l.plan_tier,
          l.expiry_date,
          l.status,
          l.machine_fingerprint,
          l.activated_at,
          l.created_at,
          l.updated_at,
          i.institution_name,
          i.institution_code,
          (
            SELECT COUNT(*) FROM license_activations a WHERE a.license_id = l.id
          ) as activation_count
        FROM licenses l
        LEFT JOIN institutions i ON i.id = l.institution_id
        ${where}
        ORDER BY l.created_at DESC
      `
        )
        .all(...params);

      res.json({ data: licenses, total: licenses.length });
    } catch (error: any) {
      console.error('List licenses error:', error);
      res.status(500).json({ error: 'Failed to list licenses', message: error.message });
    }
  }
);

// Activations older than this without a check-in are considered "never reported"
// (activated fully offline and have not yet phoned home).
const OFFLINE_STALE_DAYS = 30;

/**
 * GET /api/licensing/activations
 * Platform admin: list every license key with its machine-level activations.
 * This is the superadmin monitoring view — which schools/machines activated,
 * when, their last check-in, and whether they've reconciled with the server.
 */
licensingRouter.get(
  '/activations',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      if (req.user?.user_type !== 'platform_admin') {
        res.status(403).json({ error: 'Only platform admins can view activations' });
        return;
      }

      const db = getDatabase();
      const { search = '', status = '' } = req.query as any;

      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (search) {
        where += ` AND (
          l.license_key LIKE ? OR
          i.institution_name LIKE ? OR
          i.institution_code LIKE ? OR
          a.machine_id LIKE ?
        )`;
        const q = `%${search}%`;
        params.push(q, q, q, q);
      }
      if (status) {
        where += ' AND l.status = ?';
        params.push(status);
      }

      const rows = db
        .prepare(
          `
        SELECT
          l.id               AS license_id,
          l.license_key,
          l.mode,
          l.plan_tier,
          l.expiry_date,
          l.status           AS license_status,
          l.activated_at    AS license_activated_at,
          l.created_at       AS license_created_at,
          i.id               AS institution_id,
          i.institution_name,
          i.institution_code,
          a.id               AS activation_id,
          a.machine_id,
          a.activated_at,
          a.last_check_in,
          a.ip_address,
          CASE
            WHEN a.last_check_in IS NULL
                 AND a.activated_at < datetime('now', '-' || ? || ' days')
              THEN 1
            ELSE 0
          END AS never_reported
        FROM licenses l
        LEFT JOIN institutions i ON i.id = l.institution_id
        LEFT JOIN license_activations a ON a.license_id = l.id
        ${where}
        ORDER BY l.created_at DESC, a.activated_at DESC
      `
        )
        .all(OFFLINE_STALE_DAYS, ...params) as any[];

      // Group activations under their license key.
      const byKey = new Map<string, any>();
      let totalMachines = 0;
      for (const row of rows) {
        if (!byKey.has(row.license_id)) {
          byKey.set(row.license_id, {
            licenseId: row.license_id,
            licenseKey: row.license_key,
            mode: row.mode,
            planTier: row.plan_tier,
            expiryDate: row.expiry_date,
            licenseStatus: row.license_status,
            institutionId: row.institution_id,
            institutionName: row.institution_name,
            institutionCode: row.institution_code,
            activations: [],
          });
        }
        const entry = byKey.get(row.license_id);
        if (row.activation_id) {
          totalMachines++;
          entry.activations.push({
            activationId: row.activation_id,
            machineId: row.machine_id,
            activatedAt: row.activated_at,
            lastCheckIn: row.last_check_in,
            ipAddress: row.ip_address,
            neverReported: !!row.never_reported,
          });
        }
      }

      const data = Array.from(byKey.values());
      res.json({
        data,
        total: data.length,
        totalMachines,
        staleDays: OFFLINE_STALE_DAYS,
      });
    } catch (error: any) {
      console.error('List activations error:', error);
      res.status(500).json({ error: 'Failed to list activations', message: error.message });
    }
  }
);

/**
 * POST /api/licensing/keys/:id/revoke
 * Platform admin: revoke a license key
 */
licensingRouter.post(
  '/keys/:id/revoke',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    try {
      if (req.user?.user_type !== 'platform_admin') {
        res.status(403).json({ error: 'Only platform admins can revoke license keys' });
        return;
      }

      const db = getDatabase();
      const license = db
        .prepare('SELECT * FROM licenses WHERE id = ?')
        .get(req.params.id) as any;

      if (!license) {
        res.status(404).json({ error: 'License not found' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `
        UPDATE licenses
        SET status = 'revoked', updated_at = ?
        WHERE id = ?
      `
      ).run(now, req.params.id);

      res.json({ success: true, id: req.params.id, status: 'revoked' });
    } catch (error: any) {
      console.error('Revoke license error:', error);
      res.status(500).json({ error: 'Failed to revoke license', message: error.message });
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
        plan_tier = 'standard',
        mode = 'production',
        expiry_days = 365,
      } = req.body;

      if (!institution_id) {
        res.status(400).json({
          error: 'Missing required field: institution_id',
        });
        return;
      }

      const allowedTiers = ['free', 'basic', 'standard', 'premium', 'enterprise'];
      if (!allowedTiers.includes(plan_tier)) {
        res.status(400).json({
          error: `Invalid plan_tier. Allowed: ${allowedTiers.join(', ')}`,
        });
        return;
      }

      if (!['demo', 'production'].includes(mode)) {
        res.status(400).json({ error: 'Invalid mode. Allowed: demo, production' });
        return;
      }

      const db = getDatabase();

      // Verify institution exists
      const institution = db
        .prepare('SELECT id, institution_name FROM institutions WHERE id = ?')
        .get(institution_id) as any;

      if (!institution) {
        res.status(404).json({
          error: 'Institution not found',
        });
        return;
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + Number(expiry_days || 365));

      // Issue a cryptographically signed key (server-side private key).
      const issued = issueLicenseKey({
        planTier: plan_tier,
        expiryDays: Number(expiry_days || 365),
      });

      // Save to database — active so schools can activate immediately
      const licenseId = `lic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      db.prepare(
        `
        INSERT INTO licenses
        (id, institution_id, license_key, mode, plan_tier, expiry_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `
      ).run(
        licenseId,
        institution_id,
        issued.key,
        mode,
        plan_tier,
        issued.expiry.toISOString(),
        now,
        now
      );

      res.json({
        id: licenseId,
        licenseKey: issued.key,
        mode,
        planTier: plan_tier,
        expiryDate: expiryDate.toISOString(),
        daysValid: Number(expiry_days || 365),
        institution_id,
        institution_name: institution.institution_name,
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
