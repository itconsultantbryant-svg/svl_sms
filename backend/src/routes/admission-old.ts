import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate, buildSearchQuery } from '../utils/helpers';

export const admissionRouter = Router();

// Apply tenant middleware to ALL admission routes
admissionRouter.use(injectTenant);
admissionRouter.use(requireTenant);

// ============================================
// ADMISSION ENQUIRIES
// ============================================

// List all enquiries
admissionRouter.get('/enquiries', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', status = '', from_date = '', to_date = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['name', 'phone', 'email'],
    search
  );

  let where = `WHERE institution_id = ? ${searchClause}`;
  const params: any[] = [req.institution_id, ...searchParams];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  if (from_date) {
    where += ' AND date >= ?';
    params.push(from_date);
  }

  if (to_date) {
    where += ' AND date <= ?';
    params.push(to_date);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM admission_enquiries ${where}`).get(...params) as any;

  const enquiries = db.prepare(`
    SELECT
      e.*,
      b.branch_name,
      c.name as class_name,
      u.first_name || ' ' || u.last_name as assigned_to_name
    FROM admission_enquiries e
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN classes c ON e.class_id = c.id
    LEFT JOIN users u ON e.assigned_to = u.id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: enquiries, total: total.count, page: parseInt(page), limit: lim });
});

// Get single enquiry
admissionRouter.get('/enquiries/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const enquiry = db.prepare(`
    SELECT
      e.*,
      b.branch_name,
      c.name as class_name,
      u.first_name || ' ' || u.last_name as assigned_to_name
    FROM admission_enquiries e
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN classes c ON e.class_id = c.id
    LEFT JOIN users u ON e.assigned_to = u.id
    WHERE e.id = ? AND e.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!enquiry) {
    res.status(404).json({ error: 'Enquiry not found' });
    return;
  }

  res.json(enquiry);
});

// Create new enquiry
admissionRouter.post('/enquiries', (req: AuthRequest, res: Response) => {
  const {
    student_first_name,
    student_last_name,
    student_dob,
    student_gender,
    parent_name,
    parent_phone,
    parent_email,
    parent_address,
    parent_occupation,
    desired_class_id,
    enquiry_source,
    notes,
    assigned_to
  } = req.body;

  if (!student_first_name || !student_last_name || !parent_name || !parent_phone) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['student_first_name', 'student_last_name', 'parent_name', 'parent_phone']
    });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const enquiryNumber = `ENQ-${Date.now()}`;

  db.prepare(`
    INSERT INTO admission_enquiries (
      id, institution_id, branch_id, enquiry_number, enquiry_date, enquiry_source,
      student_first_name, student_last_name, student_dob, student_gender,
      desired_class_id, parent_name, parent_phone, parent_email,
      parent_address, parent_occupation, status, notes, assigned_to, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
  `).run(
    id, req.institution_id, req.user?.branch_id || null, enquiryNumber,
    new Date().toISOString().split('T')[0], enquiry_source || 'walk-in',
    student_first_name, student_last_name, student_dob || null, student_gender || null,
    desired_class_id || null, parent_name, parent_phone, parent_email || null,
    parent_address || null, parent_occupation || null, notes || null,
    assigned_to || null, req.user?.id
  );

  res.status(201).json({ id, enquiry_number: enquiryNumber, message: 'Enquiry created successfully' });
});

// Update enquiry
admissionRouter.put('/enquiries/:id', authorize('platform_admin', 'institution_admin', 'principal', 'receptionist'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    name,
    phone,
    email,
    date,
    class_id,
    branch_id,
    parent_name,
    parent_phone,
    parent_email,
    address,
    county,
    city,
    source,
    status,
    remarks,
    assigned_to,
    follow_up_date,
    follow_up_remarks
  } = req.body;

  const db = getDatabase();

  // Check if enquiry exists and belongs to institution
  const existing = db.prepare('SELECT id FROM admission_enquiries WHERE id = ? AND institution_id = ?').get(id, req.institution_id);
  if (!existing) {
    res.status(404).json({ error: 'Enquiry not found' });
    return;
  }

  db.prepare(`
    UPDATE admission_enquiries SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      date = COALESCE(?, date),
      class_id = COALESCE(?, class_id),
      branch_id = COALESCE(?, branch_id),
      parent_name = COALESCE(?, parent_name),
      parent_phone = COALESCE(?, parent_phone),
      parent_email = COALESCE(?, parent_email),
      address = COALESCE(?, address),
      county = COALESCE(?, county),
      city = COALESCE(?, city),
      source = COALESCE(?, source),
      status = COALESCE(?, status),
      remarks = COALESCE(?, remarks),
      assigned_to = COALESCE(?, assigned_to),
      follow_up_date = COALESCE(?, follow_up_date),
      follow_up_remarks = COALESCE(?, follow_up_remarks),
      updated_at = datetime('now')
    WHERE id = ? AND institution_id = ?
  `).run(
    name, phone, email, date, class_id, branch_id,
    parent_name, parent_phone, parent_email, address, county, city,
    source, status, remarks, assigned_to, follow_up_date, follow_up_remarks,
    id, req.institution_id
  );

  res.json({ message: 'Enquiry updated successfully' });
});

// Delete enquiry
admissionRouter.delete('/enquiries/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  db.prepare('DELETE FROM admission_enquiries WHERE id = ? AND institution_id = ?').run(id, req.institution_id);
  res.json({ message: 'Enquiry deleted successfully' });
});

// Convert enquiry to application
admissionRouter.post('/enquiries/:id/convert', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  // Get enquiry details
  const enquiry = db.prepare('SELECT * FROM admission_enquiries WHERE id = ? AND institution_id = ?').get(id, req.institution_id) as any;

  if (!enquiry) {
    res.status(404).json({ error: 'Enquiry not found' });
    return;
  }

  if (enquiry.status === 'converted') {
    res.status(400).json({ error: 'Enquiry already converted to application' });
    return;
  }

  // Create application
  const applicationId = generateId();
  const applicationNumber = `APP-${Date.now()}`;

  const transaction = db.transaction(() => {
    // Insert application
    db.prepare(`
      INSERT INTO admission_applications (
        id, institution_id, branch_id, application_number, application_date,
        enquiry_id, first_name, last_name, phone, email, date_of_birth,
        gender, class_id, previous_school, address, county, city,
        parent_name, parent_phone, parent_email, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      applicationId, req.institution_id, enquiry.branch_id, applicationNumber,
      new Date().toISOString().split('T')[0], id, enquiry.name, enquiry.phone,
      enquiry.email, enquiry.class_id, enquiry.address, enquiry.county, enquiry.city,
      enquiry.parent_name, enquiry.parent_phone, enquiry.parent_email, req.user?.id
    );

    // Update enquiry status
    db.prepare(`
      UPDATE admission_enquiries
      SET status = 'converted', updated_at = datetime('now')
      WHERE id = ? AND institution_id = ?
    `).run(id, req.institution_id);
  });

  transaction();

  res.status(201).json({
    application_id: applicationId,
    application_number: applicationNumber,
    message: 'Enquiry converted to application successfully'
  });
});

// ============================================
// ADMISSION APPLICATIONS
// ============================================

// List all applications
admissionRouter.get('/applications', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', status = '', from_date = '', to_date = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));
  const { clause: searchClause, params: searchParams } = buildSearchQuery(
    ['first_name', 'last_name', 'phone', 'email', 'application_number'],
    search
  );

  let where = `WHERE a.institution_id = ? ${searchClause}`;
  const params: any[] = [req.institution_id, ...searchParams];

  if (status) {
    where += ' AND a.status = ?';
    params.push(status);
  }

  if (from_date) {
    where += ' AND a.application_date >= ?';
    params.push(from_date);
  }

  if (to_date) {
    where += ' AND a.application_date <= ?';
    params.push(to_date);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM admission_applications a ${where}`).get(...params) as any;

  const applications = db.prepare(`
    SELECT
      a.*,
      b.branch_name,
      c.name as class_name,
      s.name as session_name
    FROM admission_applications a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN academic_sessions s ON a.session_id = s.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: applications, total: total.count, page: parseInt(page), limit: lim });
});

// Get single application
admissionRouter.get('/applications/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();

  const application = db.prepare(`
    SELECT
      a.*,
      b.branch_name,
      c.name as class_name,
      s.name as session_name
    FROM admission_applications a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN classes c ON a.class_id = c.id
    LEFT JOIN academic_sessions s ON a.session_id = s.id
    WHERE a.id = ? AND a.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  // Get documents
  const documents = db.prepare(`
    SELECT * FROM application_documents
    WHERE application_id = ?
    ORDER BY created_at DESC
  `).all(id);

  res.json({ ...application, documents });
});

// Create new application
admissionRouter.post('/applications', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const {
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    phone,
    email,
    nationality,
    county,
    city,
    address,
    class_id,
    branch_id,
    session_id,
    previous_school,
    previous_class,
    parent_name,
    parent_phone,
    parent_email,
    parent_occupation,
    guardian_name,
    guardian_phone,
    guardian_relationship,
    emergency_contact,
    emergency_phone,
    medical_conditions,
    remarks
  } = req.body;

  if (!first_name || !last_name || !date_of_birth || !class_id) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['first_name', 'last_name', 'date_of_birth', 'class_id']
    });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const applicationNumber = `APP-${Date.now()}`;

  db.prepare(`
    INSERT INTO admission_applications (
      id, institution_id, branch_id, application_number, application_date,
      first_name, middle_name, last_name, date_of_birth, gender,
      phone, email, nationality, county, city, address,
      class_id, session_id, previous_school, previous_class,
      parent_name, parent_phone, parent_email, parent_occupation,
      guardian_name, guardian_phone, guardian_relationship,
      emergency_contact, emergency_phone, medical_conditions,
      status, remarks, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id, req.institution_id, branch_id || null, applicationNumber,
    new Date().toISOString().split('T')[0],
    first_name, middle_name || null, last_name, date_of_birth, gender || null,
    phone || null, email || null, nationality || 'Liberian', county || null, city || null, address || null,
    class_id, session_id || null, previous_school || null, previous_class || null,
    parent_name || null, parent_phone || null, parent_email || null, parent_occupation || null,
    guardian_name || null, guardian_phone || null, guardian_relationship || null,
    emergency_contact || null, emergency_phone || null, medical_conditions || null,
    remarks || null, req.user?.id
  );

  res.status(201).json({ id, application_number: applicationNumber, message: 'Application created successfully' });
});

// Update application status
admissionRouter.put('/applications/:id/status', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status || !['pending', 'under_review', 'approved', 'rejected', 'admitted'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const db = getDatabase();

  db.prepare(`
    UPDATE admission_applications
    SET status = ?,
        status_remarks = ?,
        status_updated_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ? AND institution_id = ?
  `).run(status, remarks || null, id, req.institution_id);

  res.json({ message: 'Application status updated successfully' });
});

// Convert application to student
admissionRouter.post('/applications/:id/admit', authorize('platform_admin', 'institution_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { section_id, session_id, admission_date } = req.body;

  const db = getDatabase();

  // Get application details
  const application = db.prepare('SELECT * FROM admission_applications WHERE id = ? AND institution_id = ?').get(id, req.institution_id) as any;

  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (application.status === 'admitted') {
    res.status(400).json({ error: 'Application already admitted' });
    return;
  }

  // Generate admission number
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as count FROM students WHERE institution_id = ?').get(req.institution_id) as any;
  const admissionNumber = `STU-${year}-${String(count.count + 1).padStart(5, '0')}`;

  const studentId = generateId();

  const transaction = db.transaction(() => {
    // Create student
    db.prepare(`
      INSERT INTO students (
        id, institution_id, branch_id, admission_number, first_name, middle_name, last_name,
        date_of_birth, gender, phone, email, nationality, county, city, address,
        class_id, section_id, session_id, previous_school, previous_class,
        admission_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      studentId, req.institution_id, application.branch_id, admissionNumber,
      application.first_name, application.middle_name, application.last_name,
      application.date_of_birth, application.gender, application.phone, application.email,
      application.nationality, application.county, application.city, application.address,
      application.class_id, section_id || null, session_id || application.session_id,
      application.previous_school, application.previous_class,
      admission_date || new Date().toISOString().split('T')[0], req.user?.id
    );

    // Create parent if data provided
    if (application.parent_name && application.parent_phone) {
      const parentId = generateId();
      db.prepare(`
        INSERT INTO parents (
          id, institution_id, first_name, last_name, phone, email, occupation, created_by
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?)
      `).run(
        parentId, req.institution_id, application.parent_name, application.parent_phone,
        application.parent_email, application.parent_occupation, req.user?.id
      );

      // Link parent to student
      db.prepare(`
        INSERT INTO student_parents (id, student_id, parent_id, relationship, is_primary)
        VALUES (?, ?, ?, 'parent', 1)
      `).run(generateId(), studentId, parentId);
    }

    // Update application status
    db.prepare(`
      UPDATE admission_applications
      SET status = 'admitted',
          student_id = ?,
          updated_at = datetime('now')
      WHERE id = ? AND institution_id = ?
    `).run(studentId, id, req.institution_id);
  });

  transaction();

  res.status(201).json({
    student_id: studentId,
    admission_number: admissionNumber,
    message: 'Application admitted successfully'
  });
});

// Admission dashboard statistics
admissionRouter.get('/dashboard/stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM admission_enquiries WHERE institution_id = ? AND status = 'pending') as pending_enquiries,
      (SELECT COUNT(*) FROM admission_enquiries WHERE institution_id = ? AND status = 'converted') as converted_enquiries,
      (SELECT COUNT(*) FROM admission_applications WHERE institution_id = ? AND status = 'pending') as pending_applications,
      (SELECT COUNT(*) FROM admission_applications WHERE institution_id = ? AND status = 'under_review') as review_applications,
      (SELECT COUNT(*) FROM admission_applications WHERE institution_id = ? AND status = 'approved') as approved_applications,
      (SELECT COUNT(*) FROM admission_applications WHERE institution_id = ? AND status = 'rejected') as rejected_applications,
      (SELECT COUNT(*) FROM admission_applications WHERE institution_id = ? AND status = 'admitted') as admitted_applications
  `).get(
    req.institution_id, req.institution_id, req.institution_id, req.institution_id,
    req.institution_id, req.institution_id, req.institution_id
  );

  res.json(stats);
});

export default admissionRouter;
