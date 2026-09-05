import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const settingsRouter = Router();

settingsRouter.use(injectTenant);
settingsRouter.use(requireTenant);

settingsRouter.get('/institution', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institution = db.prepare(`
    SELECT id, institution_code, institution_name, institution_type,
           email, phone, mobile, website, address, county, city, postal_code, country,
           logo, favicon, motto, primary_color, secondary_color, accent_color,
           currency, currency_symbol, timezone, date_format,
           subscription_plan, subscription_status, max_students, max_staff, is_active
    FROM institutions
    WHERE id = ?
  `).get(req.institution_id);

  if (!institution) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  res.json(institution);
});

settingsRouter.get('/branding', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const branding = db.prepare(`
    SELECT institution_name, institution_code, logo, website, motto,
           primary_color, secondary_color, accent_color
    FROM institutions
    WHERE id = ?
  `).get(req.institution_id);

  res.json(branding || {});
});

settingsRouter.put('/institution', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const {
    institution_name,
    institution_code,
    name,
    code,
    logo,
    mobile,
    phone,
    address,
    email,
    website,
    country,
    currency,
    currency_symbol,
    timezone,
    motto,
    primary_color,
    secondary_color,
    accent_color,
    favicon,
  } = req.body;

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM institutions WHERE id = ?').get(req.institution_id) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  const resolvedName = institution_name ?? name;
  const resolvedCode = institution_code ?? code;

  db.prepare(`
    UPDATE institutions SET
      institution_name = COALESCE(?, institution_name),
      institution_code = COALESCE(?, institution_code),
      logo = COALESCE(?, logo),
      favicon = COALESCE(?, favicon),
      mobile = COALESCE(?, mobile),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      email = COALESCE(?, email),
      website = COALESCE(?, website),
      country = COALESCE(?, country),
      currency = COALESCE(?, currency),
      currency_symbol = COALESCE(?, currency_symbol),
      timezone = COALESCE(?, timezone),
      motto = COALESCE(?, motto),
      primary_color = COALESCE(?, primary_color),
      secondary_color = COALESCE(?, secondary_color),
      accent_color = COALESCE(?, accent_color),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    resolvedName ?? null,
    resolvedCode ?? null,
    logo ?? null,
    favicon ?? null,
    mobile ?? null,
    phone ?? null,
    address ?? null,
    email ?? null,
    website ?? null,
    country ?? null,
    currency ?? null,
    currency_symbol ?? null,
    timezone ?? null,
    motto ?? null,
    primary_color ?? null,
    secondary_color ?? null,
    accent_color ?? null,
    existing.id
  );

  const updated = db.prepare('SELECT * FROM institutions WHERE id = ?').get(existing.id);
  res.json({ message: 'Institution settings updated successfully', institution: updated });
});

settingsRouter.get('/general', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const settings = db.prepare(
    'SELECT key, value, category FROM system_settings WHERE institution_id = ? OR institution_id IS NULL'
  ).all(req.institution_id);
  const grouped: Record<string, Record<string, string>> = {};
  (settings as any[]).forEach((s) => {
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
  const instId = req.institution_id;

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
    FROM roles r
    WHERE r.institution_id = ? AND r.is_active = 1
    ORDER BY r.role_name
  `).all(req.institution_id);
  res.json(roles);
});

settingsRouter.get('/permissions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  try {
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, permission_name').all();
    res.json(permissions);
  } catch {
    res.json([]);
  }
});
