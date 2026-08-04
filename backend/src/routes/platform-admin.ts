import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { platformAdminOnly } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';
import bcrypt from 'bcryptjs';

export const platformAdminRouter = Router();

// Apply platform admin restriction to ALL routes
platformAdminRouter.use(platformAdminOnly);

// ============================================
// INSTITUTION MANAGEMENT
// ============================================

// Lightweight institutions list (for dropdown)
platformAdminRouter.get('/institutions/list', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutions = db.prepare(`
    SELECT id, institution_code, institution_name
    FROM institutions
    WHERE is_active = 1
    ORDER BY institution_name ASC
  `).all();
  res.json(institutions);
});

// List all institutions (paginated)
platformAdminRouter.get('/institutions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', status = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['institution_name', 'institution_code', 'email'],
    search
  );

  let where = 'WHERE 1=1 ' + searchClause;
  const params: any[] = [...searchParams];

  if (status) {
    where += ' AND is_active = ?';
    params.push(status === 'active' ? 1 : 0);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM institutions ${where}`).get(...params) as any;

  const institutions = db.prepare(`
    SELECT
      id, institution_code, institution_name, institution_type,
      email, phone, county, city, country,
      subscription_plan, subscription_status,
      subscription_start_date, subscription_end_date,
      max_students, max_staff, is_active, setup_completed,
      created_at
    FROM institutions
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  // Get counts for each institution
  const institutionsWithCounts = institutions.map((inst: any) => {
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM students WHERE institution_id = ?) as student_count,
        (SELECT COUNT(*) FROM users WHERE institution_id = ? AND user_type != 'platform_admin') as user_count,
        (SELECT COUNT(*) FROM branches WHERE institution_id = ?) as branch_count
    `).get(inst.id, inst.id, inst.id) as any;

    return { ...inst, ...counts };
  });

  res.json({ data: institutionsWithCounts, total: total.count, page: parseInt(page), limit: lim });
});

// Get single institution details
platformAdminRouter.get('/institutions/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const institution = db.prepare('SELECT * FROM institutions WHERE id = ?').get(id) as any;

  if (!institution) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  // Get branches
  const branches = db.prepare(`
    SELECT id, branch_code, branch_name, email, phone, address, county, city,
           is_main, is_active, student_capacity, staff_capacity
    FROM branches WHERE institution_id = ?
  `).all(id);

  // Get admins
  const admins = db.prepare(`
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
           u.is_active, u.last_login, r.role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.institution_id = ? AND u.user_type = 'institution_admin'
  `).all(id);

  // Get statistics
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE institution_id = ?) as total_students,
      (SELECT COUNT(*) FROM students WHERE institution_id = ? AND status = 'active') as active_students,
      (SELECT COUNT(*) FROM users WHERE institution_id = ?) as total_users,
      (SELECT COUNT(*) FROM classes WHERE institution_id = ?) as total_classes
  `).get(id, id, id, id) as any;

  res.json({
    ...institution,
    branches,
    admins,
    stats
  });
});

// Create new institution
platformAdminRouter.post('/institutions', (req: AuthRequest, res: Response) => {
  const {
    institution_code,
    institution_name,
    institution_type,
    email,
    phone,
    mobile,
    website,
    address,
    county,
    city,
    postal_code,
    country,
    motto,
    currency,
    timezone,
    subscription_plan,
    max_students,
    max_staff,
    admin_user // { username, email, first_name, last_name, password }
  } = req.body;

  if (!institution_code || !institution_name || !admin_user) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['institution_code', 'institution_name', 'admin_user']
    });
    return;
  }

  const db = getDatabase();

  // Check if code already exists
  const existing = db.prepare('SELECT id FROM institutions WHERE institution_code = ?').get(institution_code);
  if (existing) {
    res.status(409).json({ error: 'Institution code already exists' });
    return;
  }

  const institutionId = generateId();
  const mainBranchId = generateId();
  const adminUserId = generateId();
  const institutionAdminRoleId = generateId();

  const transaction = db.transaction(() => {
    // 1. Create institution
    db.prepare(`
      INSERT INTO institutions (
        id, institution_code, institution_name, institution_type,
        email, phone, mobile, website, address, county, city, postal_code, country,
        motto, currency, currency_symbol, timezone,
        subscription_plan, subscription_status, subscription_start_date,
        max_students, max_staff, is_active, setup_completed, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
    `).run(
      institutionId,
      institution_code,
      institution_name,
      institution_type || 'secondary',
      email,
      phone,
      mobile,
      website || null,
      address || null,
      county || null,
      city || null,
      postal_code || null,
      country || 'Liberia',
      motto || null,
      currency || 'USD',
      '$',
      timezone || 'Africa/Monrovia',
      subscription_plan || 'trial',
      'active',
      new Date().toISOString().split('T')[0],
      max_students || 500,
      max_staff || 30,
      req.user!.id
    );

    // 2. Create main branch
    db.prepare(`
      INSERT INTO branches (
        id, institution_id, branch_code, branch_name,
        email, phone, is_main, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      mainBranchId,
      institutionId,
      'MAIN',
      'Main Campus',
      email,
      phone
    );

    // 3. Create institution admin role
    db.prepare(`
      INSERT INTO roles (
        id, institution_id, role_code, role_name, description,
        is_system_role, is_platform_role, role_level, is_active
      ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, 1)
    `).run(
      institutionAdminRoleId,
      institutionId,
      'institution_admin',
      'Institution Administrator',
      'Full control over institution',
      'institution'
    );

    // 4. Create admin user
    const passwordHash = bcrypt.hashSync(admin_user.password || 'admin123', 10);
    db.prepare(`
      INSERT INTO users (
        id, institution_id, branch_id, username, email, password_hash,
        first_name, last_name, phone, role_id, user_type, is_active, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      adminUserId,
      institutionId,
      mainBranchId,
      admin_user.username,
      admin_user.email,
      passwordHash,
      admin_user.first_name,
      admin_user.last_name,
      admin_user.phone || null,
      institutionAdminRoleId,
      'institution_admin'
    );

    // 5. Create current academic session
    const currentYear = new Date().getFullYear();
    const sessionId = generateId();
    db.prepare(`
      INSERT INTO academic_sessions (
        id, institution_id, name, start_date, end_date, is_current
      ) VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      sessionId,
      institutionId,
      `${currentYear}/${currentYear + 1}`,
      `${currentYear}-09-01`,
      `${currentYear + 1}-07-31`
    );
  });

  try {
    transaction();

    res.status(201).json({
      id: institutionId,
      institution_code,
      institution_name,
      admin_user_id: adminUserId,
      message: 'Institution created successfully'
    });
  } catch (error: any) {
    console.error('Institution creation error:', error);
    res.status(500).json({ error: 'Failed to create institution', details: error.message });
  }
});

// Update institution
platformAdminRouter.put('/institutions/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    institution_name,
    institution_type,
    email,
    phone,
    mobile,
    website,
    address,
    county,
    city,
    postal_code,
    motto,
    currency,
    timezone,
    max_students,
    max_staff,
    is_active
  } = req.body;

  const db = getDatabase();
  const institution = db.prepare('SELECT id FROM institutions WHERE id = ?').get(id);

  if (!institution) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  db.prepare(`
    UPDATE institutions SET
      institution_name = COALESCE(?, institution_name),
      institution_type = COALESCE(?, institution_type),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      mobile = COALESCE(?, mobile),
      website = COALESCE(?, website),
      address = COALESCE(?, address),
      county = COALESCE(?, county),
      city = COALESCE(?, city),
      postal_code = COALESCE(?, postal_code),
      motto = COALESCE(?, motto),
      currency = COALESCE(?, currency),
      timezone = COALESCE(?, timezone),
      max_students = COALESCE(?, max_students),
      max_staff = COALESCE(?, max_staff),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    institution_name, institution_type, email, phone, mobile, website,
    address, county, city, postal_code, motto, currency, timezone,
    max_students, max_staff, is_active, id
  );

  res.json({ message: 'Institution updated successfully' });
});

// Update subscription
platformAdminRouter.put('/institutions/:id/subscription', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { subscription_plan, subscription_status, subscription_end_date, max_students, max_staff } = req.body;

  const db = getDatabase();
  const institution = db.prepare('SELECT id FROM institutions WHERE id = ?').get(id);

  if (!institution) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  db.prepare(`
    UPDATE institutions SET
      subscription_plan = COALESCE(?, subscription_plan),
      subscription_status = COALESCE(?, subscription_status),
      subscription_end_date = COALESCE(?, subscription_end_date),
      max_students = COALESCE(?, max_students),
      max_staff = COALESCE(?, max_staff),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(subscription_plan, subscription_status, subscription_end_date, max_students, max_staff, id);

  res.json({ message: 'Subscription updated successfully' });
});

// Activate/Deactivate institution
platformAdminRouter.patch('/institutions/:id/status', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const db = getDatabase();
  const institution = db.prepare('SELECT id FROM institutions WHERE id = ?').get(id);

  if (!institution) {
    res.status(404).json({ error: 'Institution not found' });
    return;
  }

  db.prepare('UPDATE institutions SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(is_active ? 1 : 0, id);

  res.json({ message: `Institution ${is_active ? 'activated' : 'deactivated'} successfully` });
});

// ============================================
// PLATFORM STATISTICS
// ============================================

platformAdminRouter.get('/dashboard/stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM institutions) as total_institutions,
      (SELECT COUNT(*) FROM institutions WHERE is_active = 1) as active_institutions,
      (SELECT COUNT(*) FROM students) as total_students,
      (SELECT COUNT(*) FROM users WHERE user_type != 'platform_admin') as total_users,
      (SELECT COUNT(*) FROM branches) as total_branches
  `).get() as any;

  // Institutions by subscription status
  const subscriptionStats = db.prepare(`
    SELECT subscription_status, COUNT(*) as count
    FROM institutions
    GROUP BY subscription_status
  `).all();

  // Recent institutions
  const recentInstitutions = db.prepare(`
    SELECT id, institution_code, institution_name, created_at, subscription_status
    FROM institutions
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  // Subscription expiring soon (within 30 days)
  const expiringSoon = db.prepare(`
    SELECT id, institution_code, institution_name, subscription_end_date
    FROM institutions
    WHERE subscription_end_date IS NOT NULL
    AND DATE(subscription_end_date) <= DATE('now', '+30 days')
    AND subscription_status = 'active'
    ORDER BY subscription_end_date ASC
  `).all();

  res.json({
    stats,
    subscription_breakdown: subscriptionStats,
    recent_institutions: recentInstitutions,
    expiring_soon: expiringSoon
  });
});

// ============================================
// SYSTEM AUDIT LOGS
// ============================================

platformAdminRouter.get('/audit-logs', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '50', institution_id = '', action = '', user_type = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (institution_id) {
    where += ' AND institution_id = ?';
    params.push(institution_id);
  }

  if (action) {
    where += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  if (user_type) {
    where += ' AND user_type = ?';
    params.push(user_type);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...params) as any;

  const logs = db.prepare(`
    SELECT *
    FROM audit_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: logs, total: total.count, page: parseInt(page), limit: lim });
});
