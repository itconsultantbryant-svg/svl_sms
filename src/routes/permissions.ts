import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant, institutionAdminOrHigher } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const permissionsRouter = Router();

// Apply tenant middleware (my-permissions is open to all authenticated users)
permissionsRouter.use(injectTenant);

// ============================================
// SYSTEM PERMISSIONS (Read-only reference)
// ============================================

const SYSTEM_PERMISSIONS = {
  // Dashboard
  'dashboard.view': { module: 'dashboard', name: 'View Dashboard', description: 'Access dashboard' },

  // Students
  'students.view': { module: 'students', name: 'View Students', description: 'View student list and details' },
  'students.create': { module: 'students', name: 'Create Students', description: 'Add new students' },
  'students.edit': { module: 'students', name: 'Edit Students', description: 'Update student information' },
  'students.delete': { module: 'students', name: 'Delete Students', description: 'Remove students' },

  // Teachers
  'teachers.view': { module: 'teachers', name: 'View Teachers', description: 'View teacher list and details' },
  'teachers.create': { module: 'teachers', name: 'Create Teachers', description: 'Add new teachers' },
  'teachers.edit': { module: 'teachers', name: 'Edit Teachers', description: 'Update teacher information' },
  'teachers.delete': { module: 'teachers', name: 'Delete Teachers', description: 'Remove teachers' },
  'teachers.assign': { module: 'teachers', name: 'Assign Teachers', description: 'Assign teachers to classes' },

  // Attendance
  'attendance.view': { module: 'attendance', name: 'View Attendance', description: 'View attendance records' },
  'attendance.mark': { module: 'attendance', name: 'Mark Attendance', description: 'Mark student attendance' },
  'attendance.edit': { module: 'attendance', name: 'Edit Attendance', description: 'Modify attendance records' },

  // Assignments
  'assignments.view': { module: 'assignments', name: 'View Assignments', description: 'View assignments' },
  'assignments.create': { module: 'assignments', name: 'Create Assignments', description: 'Create homework/assignments' },
  'assignments.edit': { module: 'assignments', name: 'Edit Assignments', description: 'Modify assignments' },
  'assignments.delete': { module: 'assignments', name: 'Delete Assignments', description: 'Remove assignments' },
  'assignments.grade': { module: 'assignments', name: 'Grade Assignments', description: 'Grade student submissions' },

  // Exams & Marks
  'exams.view': { module: 'exams', name: 'View Exams', description: 'View exam schedules' },
  'exams.create': { module: 'exams', name: 'Create Exams', description: 'Create exam schedules' },
  'exams.edit': { module: 'exams', name: 'Edit Exams', description: 'Modify exam schedules' },
  'marks.view': { module: 'marks', name: 'View Marks', description: 'View student marks' },
  'marks.enter': { module: 'marks', name: 'Enter Marks', description: 'Enter student marks' },
  'marks.edit': { module: 'marks', name: 'Edit Marks', description: 'Modify student marks' },

  // Grades & Results
  'grades.view': { module: 'grades', name: 'View Grades', description: 'View student grades' },
  'grades.submit': { module: 'grades', name: 'Submit Grades', description: 'Submit grades for approval' },
  'grades.approve': { module: 'grades', name: 'Approve Grades', description: 'Approve/reject grade submissions' },
  'results.view': { module: 'results', name: 'View Results', description: 'View student results' },
  'results.publish': { module: 'results', name: 'Publish Results', description: 'Publish results to students' },

  // Fees & Finance
  'fees.view': { module: 'fees', name: 'View Fees', description: 'View fee records' },
  'fees.create': { module: 'fees', name: 'Create Fees', description: 'Create fee structures' },
  'fees.collect': { module: 'fees', name: 'Collect Fees', description: 'Collect fee payments' },
  'accounts.view': { module: 'accounts', name: 'View Accounts', description: 'View financial accounts' },
  'accounts.manage': { module: 'accounts', name: 'Manage Accounts', description: 'Manage income/expenses' },

  // Timetable
  'timetable.view': { module: 'timetable', name: 'View Timetable', description: 'View class timetables' },
  'timetable.create': { module: 'timetable', name: 'Create Timetable', description: 'Create timetable entries' },
  'timetable.edit': { module: 'timetable', name: 'Edit Timetable', description: 'Modify timetable entries' },

  // Communication
  'communication.send': { module: 'communication', name: 'Send Messages', description: 'Send messages/notifications' },
  'communication.view': { module: 'communication', name: 'View Messages', description: 'View message history' },

  // Reports
  'reports.view': { module: 'reports', name: 'View Reports', description: 'View system reports' },
  'reports.generate': { module: 'reports', name: 'Generate Reports', description: 'Generate custom reports' },
  'reports.export': { module: 'reports', name: 'Export Reports', description: 'Export reports as PDF/Excel' },

  // Library
  'library.view': { module: 'library', name: 'View Library', description: 'View library books' },
  'library.manage': { module: 'library', name: 'Manage Library', description: 'Manage library resources' },
  'library.issue': { module: 'library', name: 'Issue Books', description: 'Issue books to students' },

  // Transport
  'transport.view': { module: 'transport', name: 'View Transport', description: 'View transport routes' },
  'transport.manage': { module: 'transport', name: 'Manage Transport', description: 'Manage transport system' },

  // Settings & Administration
  'settings.view': { module: 'settings', name: 'View Settings', description: 'View system settings' },
  'settings.edit': { module: 'settings', name: 'Edit Settings', description: 'Modify system settings' },
  'users.view': { module: 'users', name: 'View Users', description: 'View user list' },
  'users.create': { module: 'users', name: 'Create Users', description: 'Create new users' },
  'users.edit': { module: 'users', name: 'Edit Users', description: 'Modify user accounts' },
  'users.delete': { module: 'users', name: 'Delete Users', description: 'Remove users' },
  'roles.view': { module: 'roles', name: 'View Roles', description: 'View roles and permissions' },
  'roles.manage': { module: 'roles', name: 'Manage Roles', description: 'Create/edit roles and permissions' },
};

// Predefined role templates
const ROLE_TEMPLATES = {
  teacher: [
    'dashboard.view',
    'students.view',
    'attendance.view', 'attendance.mark',
    'assignments.view', 'assignments.create', 'assignments.edit', 'assignments.grade',
    'exams.view',
    'marks.view', 'marks.enter', 'marks.edit',
    'grades.view', 'grades.submit',
    'timetable.view',
    'communication.send', 'communication.view',
    'reports.view'
  ],
  staff: [
    'dashboard.view',
    'students.view',
    'attendance.view',
    'timetable.view',
    'reports.view'
  ],
  accountant: [
    'dashboard.view',
    'students.view',
    'fees.view', 'fees.create', 'fees.collect',
    'accounts.view', 'accounts.manage',
    'reports.view', 'reports.generate', 'reports.export'
  ],
  librarian: [
    'dashboard.view',
    'students.view',
    'library.view', 'library.manage', 'library.issue',
    'reports.view'
  ],
  receptionist: [
    'dashboard.view',
    'students.view',
    'communication.send', 'communication.view'
  ]
};

// ============================================
// LIST ALL SYSTEM PERMISSIONS
// ============================================

// Apply stricter middleware to admin-only routes below
permissionsRouter.use('/system-permissions', requireTenant, institutionAdminOrHigher);
permissionsRouter.use('/roles', requireTenant, institutionAdminOrHigher);
permissionsRouter.use('/role-templates', requireTenant, institutionAdminOrHigher);

permissionsRouter.get('/system-permissions', (req: AuthRequest, res: Response) => {
  // Group by module
  const grouped: any = {};

  Object.entries(SYSTEM_PERMISSIONS).forEach(([code, perm]) => {
    if (!grouped[perm.module]) {
      grouped[perm.module] = [];
    }
    grouped[perm.module].push({ code, ...perm });
  });

  res.json({ permissions: grouped });
});

// ============================================
// ROLE MANAGEMENT
// ============================================

// List all roles
permissionsRouter.get('/roles', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '50' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  const where = 'WHERE institution_id = ? AND is_active = 1';
  const params: any[] = [req.institution_id];

  const total = db.prepare(`SELECT COUNT(*) as count FROM roles ${where}`).get(...params) as any;

  const roles = db.prepare(`
    SELECT
      id, role_code, role_name, description, role_level,
      is_system_role, permissions, created_at
    FROM roles
    ${where}
    ORDER BY
      CASE role_level
        WHEN 'institution' THEN 1
        WHEN 'branch' THEN 2
        WHEN 'department' THEN 3
        ELSE 4
      END,
      role_name
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  // Parse permissions JSON for each role
  const rolesWithPermissions = roles.map((role: any) => ({
    ...role,
    permissions: role.permissions ? JSON.parse(role.permissions) : []
  }));

  res.json({ data: rolesWithPermissions, total: total.count, page: parseInt(page), limit: lim });
});

// Get single role details
permissionsRouter.get('/roles/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const role = db.prepare(`
    SELECT * FROM roles
    WHERE id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }

  // Parse permissions
  role.permissions = role.permissions ? JSON.parse(role.permissions) : [];

  // Get user count
  const userCount = db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE role_id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  res.json({ ...role, user_count: userCount.count });
});

// Create new role
permissionsRouter.post('/roles', (req: AuthRequest, res: Response) => {
  const {
    role_code, role_name, description, role_level, permissions, use_template
  } = req.body;

  if (!role_code || !role_name) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['role_code', 'role_name']
    });
    return;
  }

  const db = getDatabase();

  // Check if role code already exists
  const existing = db.prepare(`
    SELECT id FROM roles
    WHERE institution_id = ? AND role_code = ?
  `).get(req.institution_id, role_code);

  if (existing) {
    res.status(409).json({ error: 'Role code already exists' });
    return;
  }

  const id = generateId();

  // Get permissions from template if specified
  let finalPermissions = permissions || [];
  if (use_template && ROLE_TEMPLATES[use_template as keyof typeof ROLE_TEMPLATES]) {
    finalPermissions = ROLE_TEMPLATES[use_template as keyof typeof ROLE_TEMPLATES];
  }

  try {
    db.prepare(`
      INSERT INTO roles (
        id, institution_id, role_code, role_name, description,
        role_level, permissions, is_system_role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(
      id, req.institution_id, role_code, role_name, description || null,
      role_level || 'institution', JSON.stringify(finalPermissions)
    );

    res.status(201).json({
      id,
      message: 'Role created successfully',
      permissions: finalPermissions
    });
  } catch (error: any) {
    console.error('Role creation error:', error);
    res.status(500).json({ error: 'Failed to create role', details: error.message });
  }
});

// Update role
permissionsRouter.put('/roles/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role_name, description, permissions } = req.body;
  const db = getDatabase();

  // Verify role exists and is not a system role
  const role = db.prepare(`
    SELECT id, is_system_role FROM roles
    WHERE id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }

  if (role.is_system_role) {
    res.status(403).json({ error: 'Cannot modify system roles' });
    return;
  }

  try {
    db.prepare(`
      UPDATE roles SET
        role_name = COALESCE(?, role_name),
        description = COALESCE(?, description),
        permissions = COALESCE(?, permissions),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      role_name,
      description,
      permissions ? JSON.stringify(permissions) : null,
      id
    );

    res.json({ message: 'Role updated successfully' });
  } catch (error: any) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Failed to update role', details: error.message });
  }
});

// Delete role
permissionsRouter.delete('/roles/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // Verify role exists and is not a system role
  const role = db.prepare(`
    SELECT id, is_system_role FROM roles
    WHERE id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }

  if (role.is_system_role) {
    res.status(403).json({ error: 'Cannot delete system roles' });
    return;
  }

  // Check if role is assigned to any users
  const userCount = db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE role_id = ? AND institution_id = ?
  `).get(id, req.institution_id) as any;

  if (userCount.count > 0) {
    res.status(400).json({
      error: 'Cannot delete role',
      message: `This role is assigned to ${userCount.count} user(s). Reassign them first.`
    });
    return;
  }

  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  res.json({ message: 'Role deleted successfully' });
});

// Get role templates
permissionsRouter.get('/role-templates', (req: AuthRequest, res: Response) => {
  const templates = Object.entries(ROLE_TEMPLATES).map(([key, permissions]) => ({
    template_code: key,
    template_name: key.charAt(0).toUpperCase() + key.slice(1),
    permissions: permissions,
    permission_count: permissions.length
  }));

  res.json({ templates });
});

// ============================================
// USER PERMISSIONS
// ============================================

// Get user's effective permissions
permissionsRouter.get('/my-permissions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();

  // Platform admins and institution admins have all permissions
  if (req.user?.user_type === 'platform_admin' || req.user?.user_type === 'institution_admin') {
    res.json({
      user_type: req.user.user_type,
      has_all_permissions: true,
      permissions: Object.keys(SYSTEM_PERMISSIONS)
    });
    return;
  }

  // Get user's role
  if (!req.user?.role_id) {
    res.json({
      user_type: req.user?.user_type,
      has_all_permissions: false,
      permissions: []
    });
    return;
  }

  const role = db.prepare(`
    SELECT permissions FROM roles WHERE id = ?
  `).get(req.user.role_id) as any;

  if (!role || !role.permissions) {
    res.json({
      user_type: req.user?.user_type,
      has_all_permissions: false,
      permissions: []
    });
    return;
  }

  const permissions = JSON.parse(role.permissions);

  res.json({
    user_type: req.user?.user_type,
    role_id: req.user.role_id,
    has_all_permissions: false,
    permissions
  });
});

export default permissionsRouter;
