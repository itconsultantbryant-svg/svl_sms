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

    // Return credentials so superadmin can share with institution admin
    res.status(201).json({
      id: institutionId,
      institution_code,
      institution_name,
      admin_user_id: adminUserId,
      admin_credentials: {
        username: admin_user.username,
        password: admin_user.password || 'admin123',
        email: admin_user.email
      },
      message: 'Institution created successfully. Share these credentials with the institution administrator.'
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

// ============================================
// USER MANAGEMENT (ALL INSTITUTIONS)
// ============================================

// List all roles (optionally filtered by institution) for dropdowns
platformAdminRouter.get('/roles/list', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { institution_id = '' } = req.query as any;

  let where = 'WHERE is_active = 1';
  const params: any[] = [];

  if (institution_id) {
    where += ' AND (institution_id = ? OR is_platform_role = 1)';
    params.push(institution_id);
  }

  const roles = db.prepare(`
    SELECT id, role_code, role_name, role_level, is_platform_role, is_system_role, institution_id
    FROM roles ${where}
    ORDER BY role_level, role_name
  `).all(...params);

  res.json(roles);
});

// List all users across all institutions
platformAdminRouter.get('/users', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', user_type = '', institution_id = '', status = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['u.first_name', 'u.last_name', 'u.username', 'u.email'],
    search
  );

  let where = 'WHERE 1=1 ' + searchClause;
  const params: any[] = [...searchParams];

  if (user_type) { where += ' AND u.user_type = ?'; params.push(user_type); }
  if (institution_id) { where += ' AND u.institution_id = ?'; params.push(institution_id); }
  if (status) { where += ' AND u.is_active = ?'; params.push(status === 'active' ? 1 : 0); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${where}`).get(...params) as any;

  const users = db.prepare(`
    SELECT
      u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar,
      u.user_type, u.is_active, u.last_login, u.created_at,
      u.institution_id, u.linked_entity_type, u.linked_entity_id,
      i.institution_name, i.institution_code,
      r.id as role_id, r.role_code, r.role_name
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    LEFT JOIN roles r ON u.role_id = r.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: users, total: total.count, page: parseInt(page), limit: lim });
});

// Get single user detail
platformAdminRouter.get('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const user = db.prepare(`
    SELECT
      u.id, u.username, u.email, u.first_name, u.last_name, u.phone, u.avatar,
      u.user_type, u.is_active, u.last_login, u.created_at, u.updated_at,
      u.institution_id, u.branch_id, u.linked_entity_type, u.linked_entity_id,
      u.email_verified, u.force_password_change, u.failed_login_attempts,
      i.institution_name, i.institution_code,
      b.branch_name,
      r.id as role_id, r.role_code, r.role_name, r.role_level
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    LEFT JOIN branches b ON u.branch_id = b.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// Map a user_type to a default role code for that institution
const DEFAULT_ROLE_BY_USER_TYPE: Record<string, { code: string; name: string; level: string }> = {
  institution_admin: { code: 'institution_admin', name: 'Institution Administrator', level: 'institution' },
  branch_admin: { code: 'branch_admin', name: 'Branch Administrator', level: 'branch' },
  staff: { code: 'staff', name: 'Staff', level: 'institution' },
  teacher: { code: 'teacher', name: 'Teacher', level: 'institution' },
  parent: { code: 'parent', name: 'Parent', level: 'institution' },
  student: { code: 'student', name: 'Student', level: 'institution' },
};

// Find an appropriate role for a user; create a default one if missing
function resolveUserRole(db: any, userType: string, institutionId: string | null, requestedRoleId?: string): string {
  // Explicit role wins
  if (requestedRoleId) return requestedRoleId;

  // Platform admins use the platform role
  if (userType === 'platform_admin') {
    const platformRole = db.prepare("SELECT id FROM roles WHERE role_code = 'platform_admin' AND is_platform_role = 1 LIMIT 1").get();
    if (platformRole) return platformRole.id;
    const roleId = generateId();
    db.prepare(`
      INSERT INTO roles (id, institution_id, role_code, role_name, description, is_system_role, is_platform_role, role_level, permissions, is_active)
      VALUES (?, NULL, 'platform_admin', 'Platform Administrator', 'Full system access across all institutions', 1, 1, 'platform', '[]', 1)
    `).run(roleId);
    return roleId;
  }

  const defaults = DEFAULT_ROLE_BY_USER_TYPE[userType];
  const roleCode = defaults?.code || userType;

  // Look for an existing role for this institution
  const existing = db.prepare('SELECT id FROM roles WHERE institution_id = ? AND role_code = ? LIMIT 1').get(institutionId, roleCode);
  if (existing) return existing.id;

  // Create a default role for the institution
  const roleId = generateId();
  db.prepare(`
    INSERT INTO roles (
      id, institution_id, role_code, role_name, description,
      is_system_role, is_platform_role, role_level, permissions, is_active
    ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, '[]', 1)
  `).run(
    roleId,
    institutionId,
    roleCode,
    defaults?.name || roleCode,
    `Default ${roleCode} role`,
    defaults?.level || 'institution'
  );

  return roleId;
}

// Create a user (any type, any institution)
platformAdminRouter.post('/users', (req: AuthRequest, res: Response) => {
  const {
    username, email, password, first_name, last_name, phone,
    user_type, institution_id, branch_id, role_id,
    linked_entity_type, linked_entity_id, is_active,
  } = req.body;

  if (!username || !password || !first_name || !last_name || !user_type) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['username', 'password', 'first_name', 'last_name', 'user_type'],
    });
    return;
  }

  const db = getDatabase();

  // Validate user_type
  const validTypes = ['platform_admin', 'institution_admin', 'branch_admin', 'staff', 'teacher', 'parent', 'student'];
  if (!validTypes.includes(user_type)) {
    res.status(400).json({ error: `Invalid user_type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Platform admins don't belong to an institution
  const resolvedInstitutionId = user_type === 'platform_admin' ? null : (institution_id || null);
  if (user_type !== 'platform_admin' && !resolvedInstitutionId) {
    res.status(400).json({ error: 'institution_id is required for this user type' });
    return;
  }

  // Validate institution exists
  if (resolvedInstitutionId) {
    const inst = db.prepare('SELECT id FROM institutions WHERE id = ?').get(resolvedInstitutionId);
    if (!inst) {
      res.status(400).json({ error: 'Institution not found' });
      return;
    }
  }

  // Check unique username / email
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email || '');
  if (existing) {
    res.status(409).json({ error: 'Username or email already exists' });
    return;
  }

  const roleId = resolveUserRole(db, user_type, resolvedInstitutionId, role_id);
  const passwordHash = bcrypt.hashSync(password, 10);
  const id = generateId();

  db.prepare(`
    INSERT INTO users (
      id, institution_id, branch_id, username, email, password_hash,
      first_name, last_name, phone, role_id, user_type,
      linked_entity_type, linked_entity_id, is_active, email_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    resolvedInstitutionId,
    branch_id || null,
    username,
    email || null,
    passwordHash,
    first_name,
    last_name,
    phone || null,
    roleId,
    user_type,
    linked_entity_type || null,
    linked_entity_id || null,
    is_active === undefined ? 1 : (is_active ? 1 : 0)
  );

  res.status(201).json({
    id,
    message: 'User created successfully',
    credentials: {
      username,
      password,
      email: email || null,
    },
  });
});

// Update a user
platformAdminRouter.put('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    username, email, first_name, last_name, phone,
    user_type, institution_id, branch_id, role_id,
    is_active,
  } = req.body;

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Prevent superadmin from being demoted/deactivated via this route
  if (user.username === 'superadmin' && (user_type && user_type !== 'platform_admin')) {
    res.status(400).json({ error: 'The superadmin account cannot change user type' });
    return;
  }

  // If username changed, ensure uniqueness
  if (username && username !== user.username) {
    const clash = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
    if (clash) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
  }

  const resolvedUserType = user_type || user.user_type;
  const resolvedInstitutionId =
    resolvedUserType === 'platform_admin'
      ? null
      : (institution_id !== undefined ? institution_id : user.institution_id);

  const resolvedRoleId = resolveUserRole(db, resolvedUserType, resolvedInstitutionId, role_id || user.role_id);

  db.prepare(`
    UPDATE users SET
      username = COALESCE(?, username),
      email = COALESCE(?, email),
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      phone = COALESCE(?, phone),
      user_type = ?,
      institution_id = ?,
      branch_id = COALESCE(?, branch_id),
      role_id = ?,
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    username, email, first_name, last_name, phone,
    resolvedUserType, resolvedInstitutionId, branch_id, resolvedRoleId,
    is_active === undefined ? undefined : (is_active ? 1 : 0),
    id
  );

  res.json({ message: 'User updated successfully' });
});

// Deactivate a user (soft delete)
platformAdminRouter.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.username === 'superadmin') {
    res.status(400).json({ error: 'The superadmin account cannot be deactivated' });
    return;
  }

  db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);

  res.json({ message: 'User deactivated successfully' });
});

// Reset a user's password
platformAdminRouter.post('/users/:id/reset-password', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const passwordHash = bcrypt.hashSync(new_password, 10);
  db.prepare(`
    UPDATE users SET
      password_hash = ?,
      force_password_change = 1,
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(passwordHash, id);

  res.json({ message: 'Password reset successfully' });
});
