import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, generateEmployeeId, paginate, buildSearchQuery } from '../utils/helpers';
import bcrypt from 'bcryptjs';

export const teachersRouter = Router();

// Apply tenant middleware to ALL routes
teachersRouter.use(injectTenant);
teachersRouter.use(requireTenant);

teachersRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', branch = '', department = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['e.first_name', 'e.last_name', 'e.employee_id', 'e.email'],
    search
  );

  // TENANT ISOLATION: Always filter by institution_id
  let where = 'WHERE e.institution_id = ? AND e.is_teacher = 1 AND e.is_active = 1 ' + searchClause;
  const params: any[] = [req.institution_id, ...searchParams];

  if (branch) { where += ' AND e.branch_id = ?'; params.push(branch); }
  if (department) { where += ' AND e.department_id = ?'; params.push(department); }
  if (req.user?.branch_id) { where += ' AND e.branch_id = ?'; params.push(req.user.branch_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM employees e ${where}`).get(...params) as any;

  const teachers = db.prepare(`
    SELECT e.*, d.name as department_name, des.name as designation_name, b.branch_name as branch_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN branches b ON e.branch_id = b.id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: teachers, total: total.count, page: parseInt(page), limit: lim });
});

teachersRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id
  const teacher = db.prepare(`
    SELECT e.*, d.name as department_name, des.name as designation_name, b.branch_name as branch_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.id = ? AND e.institution_id = ? AND e.is_teacher = 1
  `).get(id, req.institution_id) as any;

  if (!teacher) {
    res.status(404).json({ error: 'Teacher not found' });
    return;
  }

  // TENANT ISOLATION: Filter assignments through employee
  const assignments = db.prepare(`
    SELECT ta.*, c.name as class_name, sec.name as section_name, sub.name as subject_name,
           ses.name as session_name
    FROM teacher_assignments ta
    LEFT JOIN classes c ON ta.class_id = c.id
    LEFT JOIN sections sec ON ta.section_id = sec.id
    LEFT JOIN subjects sub ON ta.subject_id = sub.id
    LEFT JOIN academic_sessions ses ON ta.session_id = ses.id
    WHERE ta.employee_id = ? AND ta.institution_id = ?
  `).all(id, req.institution_id);

  res.json({ ...teacher, assignments });
});

teachersRouter.post('/', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const {
    first_name, middle_name, last_name, gender, date_of_birth, phone, email,
    address, photo, department_id, designation_id, branch_id, qualification,
    experience, employment_date, employment_type, basic_salary, bank_name, bank_account,
    // User credentials
    username, password, generate_credentials
  } = req.body;

  if (!first_name || !last_name) {
    res.status(400).json({ error: 'First name and last name are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const userId = generateId();
  const roleId = generateId();
  const employee_id = generateEmployeeId('TCH');

  // Generate credentials if requested or not provided
  let finalUsername = username;
  let finalPassword = password;

  if (generate_credentials || !username) {
    finalUsername = `${first_name.toLowerCase()}.${last_name.toLowerCase()}`.replace(/\s+/g, '');
    const usernameCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE username LIKE ?')
      .get(`${finalUsername}%`) as any;
    if (usernameCount.count > 0) {
      finalUsername = `${finalUsername}${usernameCount.count + 1}`;
    }
  }

  if (generate_credentials || !password) {
    // Generate password: FirstnameYYYY (e.g., John2024)
    finalPassword = `${first_name}${new Date().getFullYear()}`;
  }

  // Check username uniqueness
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(finalUsername);
  if (existingUser) {
    res.status(409).json({ error: 'Username already exists', username: finalUsername });
    return;
  }

  const transaction = db.transaction(() => {
    // 1. Create employee record
    db.prepare(`
      INSERT INTO employees (id, institution_id, employee_id, first_name, middle_name, last_name, gender,
      date_of_birth, phone, email, address, photo, department_id, designation_id, branch_id,
      qualification, experience, employment_date, employment_type, basic_salary, bank_name,
      bank_account, is_teacher, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id, req.institution_id, employee_id, first_name, middle_name || null, last_name, gender || null,
      date_of_birth || null, phone || null, email || null, address || null, photo || null,
      department_id || null, designation_id || null, branch_id || req.user?.branch_id || null,
      qualification || null, experience || null, employment_date || null,
      employment_type || 'full-time', basic_salary || 0, bank_name || null, bank_account || null,
      userId
    );

    // 2. Create or get teacher role
    let teacherRole = db.prepare(
      'SELECT id FROM roles WHERE institution_id = ? AND role_code = ?'
    ).get(req.institution_id, 'teacher') as any;

    if (!teacherRole) {
      db.prepare(`
        INSERT INTO roles (
          id, institution_id, role_code, role_name, description, role_level, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(roleId, req.institution_id, 'teacher', 'Teacher', 'Faculty member', 'institution');
      teacherRole = { id: roleId };
    }

    // 3. Create user account
    const passwordHash = bcrypt.hashSync(finalPassword, 10);
    db.prepare(`
      INSERT INTO users (
        id, institution_id, branch_id, username, email, password_hash,
        first_name, last_name, phone, role_id, user_type,
        linked_entity_type, linked_entity_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      userId, req.institution_id, branch_id || req.user?.branch_id, finalUsername, email, passwordHash,
      first_name, last_name, phone, teacherRole.id, 'teacher',
      'employee', id
    );
  });

  try {
    transaction();

    // Return credentials to admin
    res.status(201).json({
      id,
      employee_id,
      user_id: userId,
      credentials: {
        username: finalUsername,
        password: finalPassword,
        email: email || null
      },
      message: 'Teacher created successfully. Share these credentials with the teacher.'
    });
  } catch (error: any) {
    console.error('Teacher creation error:', error);
    res.status(500).json({ error: 'Failed to create teacher', details: error.message });
  }
});

teachersRouter.put('/:id', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    first_name, middle_name, last_name, gender, date_of_birth, phone, email,
    address, photo, department_id, designation_id, qualification, experience,
    employment_type, basic_salary, bank_name, bank_account, is_active
  } = req.body;

  const db = getDatabase();
  // TENANT ISOLATION: Check teacher belongs to this institution
  const teacher = db.prepare('SELECT id FROM employees WHERE id = ? AND institution_id = ? AND is_teacher = 1').get(id, req.institution_id);
  if (!teacher) {
    res.status(404).json({ error: 'Teacher not found' });
    return;
  }

  db.prepare(`
    UPDATE employees SET
    first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name),
    last_name = COALESCE(?, last_name), gender = COALESCE(?, gender),
    date_of_birth = COALESCE(?, date_of_birth), phone = COALESCE(?, phone),
    email = COALESCE(?, email), address = COALESCE(?, address),
    photo = COALESCE(?, photo), department_id = COALESCE(?, department_id),
    designation_id = COALESCE(?, designation_id), qualification = COALESCE(?, qualification),
    experience = COALESCE(?, experience), employment_type = COALESCE(?, employment_type),
    basic_salary = COALESCE(?, basic_salary), bank_name = COALESCE(?, bank_name),
    bank_account = COALESCE(?, bank_account), is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ?
  `).run(
    first_name, middle_name, last_name, gender, date_of_birth, phone, email,
    address, photo, department_id, designation_id, qualification, experience,
    employment_type, basic_salary, bank_name, bank_account, is_active, id
  );

  res.json({ message: 'Teacher updated successfully' });
});

teachersRouter.post('/:id/assignments', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { class_id, section_id, subject_id, session_id, is_class_teacher } = req.body;

  if (!class_id || !subject_id || !session_id) {
    res.status(400).json({ error: 'Class, subject, and session are required' });
    return;
  }

  const db = getDatabase();
  const assignId = generateId();

  // TENANT ISOLATION: Include institution_id in INSERT
  db.prepare(`
    INSERT OR IGNORE INTO teacher_assignments (id, institution_id, employee_id, class_id, section_id, subject_id, session_id, is_class_teacher)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(assignId, req.institution_id, id, class_id, section_id || null, subject_id, session_id, is_class_teacher ? 1 : 0);

  res.status(201).json({ id: assignId, message: 'Assignment created successfully' });
});

teachersRouter.delete('/:id/assignments/:assignmentId', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { assignmentId } = req.params;
  const db = getDatabase();
  // TENANT ISOLATION: Verify ownership before delete
  db.prepare('DELETE FROM teacher_assignments WHERE id = ? AND institution_id = ?').run(assignmentId, req.institution_id);
  res.json({ message: 'Assignment removed successfully' });
});
