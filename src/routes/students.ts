import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, generateAdmissionNumber, generateDefaultPassword, paginate, buildSearchQuery } from '../utils/helpers';
import { ensureUserRole, ensurePortalRole } from '../utils/userAccess';

export const studentsRouter = Router();

// Apply tenant middleware to ALL student routes
studentsRouter.use(injectTenant);
studentsRouter.use(requireTenant);

studentsRouter.get('/', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', branch = '', class: classId = '', section = '', status = '', session = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['s.first_name', 's.last_name', 's.admission_number'],
    search
  );

  // TENANT ISOLATION: Always filter by institution_id (platform admins see all)
  const institutionFilter = req.institution_id ? `s.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${institutionFilter} ` + searchClause;
  const params: any[] = [...searchParams];

  if (branch) { where += ' AND s.branch_id = ?'; params.push(branch); }
  if (classId) { where += ' AND s.class_id = ?'; params.push(classId); }
  if (section) { where += ' AND s.section_id = ?'; params.push(section); }
  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (session) { where += ' AND s.session_id = ?'; params.push(session); }

  if (req.user?.branch_id) {
    where += ' AND s.branch_id = ?';
    params.push(req.user.branch_id);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM students s ${where}`).get(...params) as any;

  const students = db.prepare(`
    SELECT s.*, c.name as class_name, sec.name as section_name, b.branch_name as branch_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: students, total: total.count, page: parseInt(page), limit: lim });
});

studentsRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // TENANT ISOLATION: Filter by institution_id (platform admins see all)
  const institutionFilter = req.institution_id ? `AND s.institution_id = '${req.institution_id}'` : '';
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, sec.name as section_name, b.branch_name as branch_name,
           ses.name as session_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    LEFT JOIN branches b ON s.branch_id = b.id
    LEFT JOIN academic_sessions ses ON s.session_id = ses.id
    WHERE s.id = ? ${institutionFilter}
  `).get(id) as any;

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  // TENANT ISOLATION: Filter related data (platform admins see all)
  const parentInstitutionFilter = req.institution_id ? `AND p.institution_id = '${req.institution_id}'` : '';
  const parents = db.prepare(`
    SELECT p.*, sp.is_primary
    FROM parents p
    JOIN student_parents sp ON p.id = sp.parent_id
    WHERE sp.student_id = ? ${parentInstitutionFilter}
  `).all(id);

  const docInstitutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const documents = db.prepare(
    `SELECT * FROM student_documents WHERE student_id = ? ${docInstitutionFilter}`
  ).all(id);

  res.json({ ...student, parents, documents });
});

function emptyToNull(value: any) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

studentsRouter.post('/', (req: AuthRequest, res: Response) => {
  const {
    first_name, middle_name, last_name, date_of_birth, gender, nationality,
    county, address, phone, email, photo, blood_group, medical_info,
    previous_school, previous_class, admission_date, branch_id, class_id,
    section_id, session_id, parent
  } = req.body;

  if (!first_name || !last_name) {
    res.status(400).json({ error: 'First name and last name are required' });
    return;
  }
  if (!req.institution_id) {
    res.status(400).json({ error: 'Select a school before admitting a student' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const admission_number = generateAdmissionNumber();
  const temporary_password = generateDefaultPassword();
  const userId = generateId();
  let parentCredentials: { username: string; temporary_password: string } | null = null;

  // TENANT ISOLATION: Include institution_id in INSERT
  const insertStudent = db.prepare(`
    INSERT INTO students (
      id, institution_id, branch_id, admission_number,
      first_name, middle_name, last_name, date_of_birth,
      gender, nationality, county, address, phone, email, photo, blood_group, medical_info,
      previous_school, previous_class, admission_date, class_id, section_id, session_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertStudent.run(
      id,
      req.institution_id, // TENANT ISOLATION
      emptyToNull(branch_id) || emptyToNull(req.user?.branch_id),
      admission_number,
      first_name,
      emptyToNull(middle_name),
      last_name,
      emptyToNull(date_of_birth),
      ['male', 'female', 'other'].includes(String(gender || '').toLowerCase()) ? String(gender).toLowerCase() : null,
      nationality || 'Liberian',
      emptyToNull(county),
      emptyToNull(address),
      emptyToNull(phone),
      emptyToNull(email),
      emptyToNull(photo),
      emptyToNull(blood_group),
      emptyToNull(medical_info),
      emptyToNull(previous_school),
      emptyToNull(previous_class),
      admission_date || new Date().toISOString().split('T')[0],
      emptyToNull(class_id),
      emptyToNull(section_id),
      emptyToNull(session_id)
    );

    // Login user: Student ID (admission_number) + default password
    const studentRoleId = ensurePortalRole(req.institution_id, 'student', 'Student');

    const passwordHash = bcrypt.hashSync(temporary_password, 10);
    const loginEmail = emptyToNull(email) || `${admission_number.toLowerCase()}@student.local`;
    db.prepare(`
      INSERT INTO users (
        id, institution_id, branch_id, username, email, password_hash,
        first_name, last_name, phone, avatar, role_id, user_type,
        linked_entity_type, linked_entity_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 'student', ?, 1)
    `).run(
      userId,
      req.institution_id,
      emptyToNull(branch_id) || emptyToNull(req.user?.branch_id),
      admission_number,
      loginEmail,
      passwordHash,
      first_name,
      last_name,
      emptyToNull(phone),
      emptyToNull(photo),
      studentRoleId,
      id
    );
    ensureUserRole(userId, studentRoleId, true);
    db.prepare(`UPDATE students SET user_id = ? WHERE id = ?`).run(userId, id);

    const relationship = ['father', 'mother', 'guardian', 'other'].includes(String(parent?.relationship || '').toLowerCase())
      ? String(parent.relationship).toLowerCase()
      : 'guardian';
    if (parent?.first_name && parent?.last_name) {
      const parentId = generateId();
      const parentUserId = generateId();
      const parentPassword = generateDefaultPassword();
      // TENANT ISOLATION: Include institution_id for parent
      db.prepare(`
        INSERT INTO parents (id, institution_id, first_name, last_name, relationship, phone, email, address, occupation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parentId,
        req.institution_id, // TENANT ISOLATION
        parent.first_name,
        parent.last_name,
        relationship,
        emptyToNull(parent.phone),
        emptyToNull(parent.email),
        parent.address || null,
        parent.occupation || null
      );
      db.prepare('INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, 1)').run(id, parentId);
      db.prepare('UPDATE parents SET user_id = ? WHERE id = ?').run(parentUserId, parentId);

      let parentRoleId = ensurePortalRole(req.institution_id, 'parent', 'Parent');

      const parentUsername = parent.email
        ? String(parent.email).split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '')
        : `parent.${parent.first_name}.${parent.last_name}`.toLowerCase().replace(/\s+/g, '');
      let finalParentUsername = parentUsername || `parent${Date.now()}`;
      const existingParentUser = db.prepare('SELECT id FROM users WHERE username = ?').get(finalParentUsername);
      if (existingParentUser) finalParentUsername = `${finalParentUsername}${Math.floor(Math.random() * 1000)}`;

      db.prepare(`
        INSERT INTO users (
          id, institution_id, branch_id, username, email, password_hash,
          first_name, last_name, phone, role_id, user_type,
          linked_entity_type, linked_entity_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parent', 'parent', ?, 1)
      `).run(
        parentUserId,
        req.institution_id,
        emptyToNull(branch_id) || emptyToNull(req.user?.branch_id),
        finalParentUsername,
        parent.email || `${finalParentUsername}@parent.local`,
        bcrypt.hashSync(parentPassword, 10),
        parent.first_name,
        parent.last_name,
        parent.phone || null,
        parentRoleId,
        parentId
      );
      ensureUserRole(parentUserId, parentRoleId, true);

      db.prepare(`
        INSERT INTO parent_students (id, institution_id, parent_id, student_id, relationship, is_primary)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(generateId(), req.institution_id, parentUserId, id, relationship);

      parentCredentials = {
        username: finalParentUsername,
        temporary_password: parentPassword,
      };
    }
  });

  try {
    transaction();
  } catch (error: any) {
    console.error('Student creation error:', error);
    const message = String(error?.message || '');
    if (message.includes('UNIQUE') && message.toLowerCase().includes('email')) {
      res.status(409).json({ error: 'That email is already used by another account' });
      return;
    }
    if (message.includes('CHECK')) {
      res.status(400).json({ error: 'A student field is invalid. Check gender and parent relationship.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create student', details: message });
    return;
  }

  res.status(201).json({
    id,
    admission_number,
    username: admission_number,
    temporary_password,
    parent_credentials: parentCredentials,
    message: 'Student admitted successfully',
  });
});

studentsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    first_name, middle_name, last_name, date_of_birth, gender, nationality,
    county, address, phone, email, photo, blood_group, medical_info,
    class_id, section_id, session_id, status
  } = req.body;

  const db = getDatabase();

  // TENANT ISOLATION: Check student belongs to this institution (platform admins see all)
  const institutionFilter = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const student = db.prepare(
    `SELECT id FROM students WHERE id = ? ${institutionFilter}`
  ).get(id);

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  db.prepare(`
    UPDATE students SET
    first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name),
    last_name = COALESCE(?, last_name), date_of_birth = COALESCE(?, date_of_birth),
    gender = COALESCE(?, gender), nationality = COALESCE(?, nationality),
    county = COALESCE(?, county), address = COALESCE(?, address),
    phone = COALESCE(?, phone), email = COALESCE(?, email),
    photo = COALESCE(?, photo), blood_group = COALESCE(?, blood_group),
    medical_info = COALESCE(?, medical_info), class_id = COALESCE(?, class_id),
    section_id = COALESCE(?, section_id), session_id = COALESCE(?, session_id),
    status = COALESCE(?, status), updated_at = datetime('now')
    WHERE id = ?
  `).run(
    first_name, middle_name, last_name, date_of_birth, gender, nationality,
    county, address, phone, email, photo, blood_group, medical_info,
    class_id, section_id, session_id, status, id
  );

  // Keep linked user avatar/name in sync when photo/name changes
  if (photo || first_name || last_name) {
    db.prepare(`
      UPDATE users SET
        avatar = COALESCE(?, avatar),
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        updated_at = datetime('now')
      WHERE linked_entity_type = 'student' AND linked_entity_id = ?
    `).run(photo || null, first_name || null, last_name || null, id);
  }

  res.json({ message: 'Student updated successfully' });
});

studentsRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare("UPDATE students SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ message: 'Student deactivated successfully' });
});
