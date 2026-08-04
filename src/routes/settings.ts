import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const settingsRouter = Router();

// Apply tenant middleware to ALL routes
settingsRouter.use(injectTenant);
settingsRouter.use(requireTenant);

settingsRouter.get('/institution', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institution = db.prepare('SELECT * FROM institutions LIMIT 1').get();
  res.json(institution || {});
});

settingsRouter.put('/institution', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const {
    name, code, logo, mobile, address, email, website,
    country, currency, currency_symbol, timezone, motto
  } = req.body;

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM institutions LIMIT 1').get() as any;

  if (existing) {
    db.prepare(`
      UPDATE institutions SET name = COALESCE(?, name), code = COALESCE(?, code),
      logo = COALESCE(?, logo), mobile = COALESCE(?, mobile), address = COALESCE(?, address),
      email = COALESCE(?, email), website = COALESCE(?, website), country = COALESCE(?, country),
      currency = COALESCE(?, currency), currency_symbol = COALESCE(?, currency_symbol),
      timezone = COALESCE(?, timezone), motto = COALESCE(?, motto), updated_at = datetime('now')
      WHERE id = ?
    `).run(name, code, logo, mobile, address, email, website, country, currency, currency_symbol, timezone, motto, existing.id);
  } else {
    const id = generateId();
    db.prepare(`
      INSERT INTO institutions (id, name, code, logo, mobile, address, email, website, country, currency, currency_symbol, timezone, motto)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name || 'Softwarevala Liberia Academy', code || 'SVLA', logo, mobile, address, email, website, country || 'Liberia', currency || 'USD', currency_symbol || '$', timezone || 'Africa/Monrovia', motto);
  }

  res.json({ message: 'Institution settings updated successfully' });
});

settingsRouter.get('/general', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const settings = db.prepare('SELECT key, value, category FROM system_settings').all();
  const grouped: Record<string, Record<string, string>> = {};
  (settings as any[]).forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = {};
    grouped[s.category][s.key] = s.value;
  });
  res.json(grouped);
});

settingsRouter.put('/general', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { settings } = req.body;
  if (!settings || !Array.isArray(settings)) {
    res.status(400).json({ error: 'Settings array is required' });
    return;
  }

  const db = getDatabase();
  const inst = db.prepare('SELECT id FROM institutions LIMIT 1').get() as any;
  const instId = inst?.id || null;

  const upsert = db.prepare(`
    INSERT INTO system_settings (id, institution_id, key, value, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(institution_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    for (const setting of settings) {
      upsert.run(generateId(), instId, setting.key, setting.value, setting.category || 'general');
    }
  });
  transaction();

  res.json({ message: 'Settings updated successfully' });
});

settingsRouter.get('/roles', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const roles = db.prepare(`
    SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
    FROM roles r ORDER BY r.name
  `).all();
  res.json(roles);
});

settingsRouter.get('/permissions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, name').all();
  res.json(permissions);
});

settingsRouter.get('/roles/:roleId/permissions', (req: AuthRequest, res: Response) => {
  const { roleId } = req.params;
  const db = getDatabase();
  const permissions = db.prepare(`
    SELECT p.* FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.module, p.name
  `).all(roleId);
  res.json(permissions);
});

settingsRouter.put('/roles/:roleId/permissions', authorize('platform_admin'), (req: AuthRequest, res: Response) => {
  const { roleId } = req.params;
  const { permission_ids } = req.body;

  if (!Array.isArray(permission_ids)) {
    res.status(400).json({ error: 'Permission IDs array is required' });
    return;
  }

  const db = getDatabase();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const insert = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const permId of permission_ids) {
      insert.run(roleId, permId);
    }
  });
  transaction();

  res.json({ message: 'Role permissions updated successfully' });
});
