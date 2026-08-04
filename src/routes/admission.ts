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

// Dashboard stats
admissionRouter.get('/dashboard/stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();

  const stats = {
    pending_enquiries: db.prepare(`SELECT COUNT(*) as count FROM admission_enquiries WHERE institution_id = ? AND status = 'new'`).get(req.institution_id) as any,
    converted_enquiries: db.prepare(`SELECT COUNT(*) as count FROM admission_enquiries WHERE institution_id = ? AND converted_to_application_id IS NOT NULL`).get(req.institution_id) as any,
    pending_applications: db.prepare(`SELECT COUNT(*) as count FROM admission_applications WHERE institution_id = ? AND status = 'pending'`).get(req.institution_id) as any,
    review_applications: db.prepare(`SELECT COUNT(*) as count FROM admission_applications WHERE institution_id = ? AND status = 'under_review'`).get(req.institution_id) as any,
    approved_applications: db.prepare(`SELECT COUNT(*) as count FROM admission_applications WHERE institution_id = ? AND status = 'approved'`).get(req.institution_id) as any,
    rejected_applications: db.prepare(`SELECT COUNT(*) as count FROM admission_applications WHERE institution_id = ? AND status = 'rejected'`).get(req.institution_id) as any,
    admitted_applications: db.prepare(`SELECT COUNT(*) as count FROM admission_applications WHERE institution_id = ? AND status = 'admitted'`).get(req.institution_id) as any
  };

  res.json({
    pending_enquiries: stats.pending_enquiries.count,
    converted_enquiries: stats.converted_enquiries.count,
    pending_applications: stats.pending_applications.count,
    review_applications: stats.review_applications.count,
    approved_applications: stats.approved_applications.count,
    rejected_applications: stats.rejected_applications.count,
    admitted_applications: stats.admitted_applications.count
  });
});

// List all enquiries
admissionRouter.get('/enquiries', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', search = '', status = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = `WHERE e.institution_id = ?`;
  const params: any[] = [req.institution_id];

  if (search) {
    where += ` AND (e.student_first_name LIKE ? OR e.student_last_name LIKE ? OR e.parent_phone LIKE ? OR e.enquiry_number LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    where += ' AND e.status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM admission_enquiries e ${where}`).get(...params) as any;

  const enquiries = db.prepare(`
    SELECT
      e.*,
      b.branch_name,
      c.name as class_name,
      u.first_name || ' ' || u.last_name as assigned_to_name
    FROM admission_enquiries e
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN classes c ON e.desired_class_id = c.id
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
    LEFT JOIN classes c ON e.desired_class_id = c.id
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
    student_middle_name,
    student_dob,
    student_gender,
    parent_name,
    parent_phone,
    parent_email,
    parent_address,
    parent_occupation,
    desired_class_id,
    previous_school,
    previous_class,
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
      student_first_name, student_middle_name, student_last_name, student_dob, student_gender,
      desired_class_id, previous_school, previous_class,
      parent_name, parent_phone, parent_email, parent_address, parent_occupation,
      status, notes, assigned_to, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
  `).run(
    id, req.institution_id, req.user?.branch_id || null, enquiryNumber,
    new Date().toISOString().split('T')[0], enquiry_source || 'walk_in',
    student_first_name, student_middle_name || null, student_last_name,
    student_dob || null, student_gender ? student_gender.toLowerCase() : null,
    desired_class_id || null, previous_school || null, previous_class || null,
    parent_name, parent_phone, parent_email || null, parent_address || null,
    parent_occupation || null, notes || null, assigned_to || null, req.user?.id
  );

  res.status(201).json({ id, enquiry_number: enquiryNumber, message: 'Enquiry created successfully' });
});

// Update enquiry
admissionRouter.put('/enquiries/:id', authorize('platform_admin', 'institution_admin', 'principal', 'receptionist'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    student_first_name,
    student_last_name,
    student_middle_name,
    student_dob,
    student_gender,
    parent_name,
    parent_phone,
    parent_email,
    parent_address,
    parent_occupation,
    desired_class_id,
    previous_school,
    previous_class,
    enquiry_source,
    status,
    notes,
    assigned_to,
    next_follow_up_date
  } = req.body;

  const db = getDatabase();

  db.prepare(`
    UPDATE admission_enquiries
    SET student_first_name = ?, student_middle_name = ?, student_last_name = ?,
        student_dob = ?, student_gender = ?, parent_name = ?, parent_phone = ?,
        parent_email = ?, parent_address = ?, parent_occupation = ?,
        desired_class_id = ?, previous_school = ?, previous_class = ?,
        enquiry_source = ?, status = ?, notes = ?, assigned_to = ?,
        next_follow_up_date = ?, updated_at = datetime('now')
    WHERE id = ? AND institution_id = ?
  `).run(
    student_first_name, student_middle_name || null, student_last_name,
    student_dob || null, student_gender ? student_gender.toLowerCase() : null,
    parent_name, parent_phone, parent_email || null, parent_address || null,
    parent_occupation || null, desired_class_id || null, previous_school || null,
    previous_class || null, enquiry_source, status, notes || null, assigned_to || null,
    next_follow_up_date || null, id, req.institution_id
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

  if (enquiry.converted_to_application_id) {
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
        enquiry_id, first_name, middle_name, last_name, date_of_birth, gender,
        class_id, previous_school, previous_class,
        parent_name, parent_phone, parent_email, parent_address, parent_occupation,
        status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      applicationId, req.institution_id, enquiry.branch_id, applicationNumber,
      new Date().toISOString().split('T')[0], id,
      enquiry.student_first_name, enquiry.student_middle_name, enquiry.student_last_name,
      enquiry.student_dob, enquiry.student_gender, enquiry.desired_class_id,
      enquiry.previous_school, enquiry.previous_class,
      enquiry.parent_name, enquiry.parent_phone, enquiry.parent_email,
      enquiry.parent_address, enquiry.parent_occupation, req.user?.id
    );

    // Update enquiry status
    db.prepare(`
      UPDATE admission_enquiries
      SET converted_to_application_id = ?, converted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND institution_id = ?
    `).run(applicationId, id, req.institution_id);
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
  const { page = '1', limit = '20', search = '', status = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = `WHERE a.institution_id = ?`;
  const params: any[] = [req.institution_id];

  if (search) {
    where += ` AND (a.first_name LIKE ? OR a.last_name LIKE ? OR a.phone LIKE ? OR a.application_number LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    where += ' AND a.status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM admission_applications a ${where}`).get(...params) as any;

  const applications = db.prepare(`
    SELECT
      a.*,
      b.branch_name,
      c.name as class_name
    FROM admission_applications a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN classes c ON a.desired_class_id = c.id
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
    LEFT JOIN classes c ON a.desired_class_id = c.id
    LEFT JOIN academic_sessions s ON a.session_id = s.id
    WHERE a.id = ? AND a.institution_id = ?
  `).get(id, req.institution_id) as any;

  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.json(application);
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
    address,
    class_id,
    branch_id,
    session_id,
    previous_school,
    previous_class,
    parent_name,
    parent_phone,
    parent_email,
    parent_address,
    parent_occupation,
    guardian_name,
    guardian_phone,
    guardian_relationship,
    medical_conditions,
    remarks
  } = req.body;

  if (!first_name || !last_name || !date_of_birth || !class_id || !parent_name || !parent_phone) {
    res.status(400).json({
      error: 'Required fields missing',
      required: ['first_name', 'last_name', 'date_of_birth', 'class_id', 'parent_name', 'parent_phone']
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
      phone, email, nationality, address, class_id, session_id,
      previous_school, previous_class,
      parent_name, parent_phone, parent_email, parent_address, parent_occupation,
      guardian_name, guardian_phone, guardian_relationship,
      medical_conditions, status, remarks, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id, req.institution_id, branch_id || req.user?.branch_id || null,
    applicationNumber, new Date().toISOString().split('T')[0],
    first_name, middle_name || null, last_name, date_of_birth,
    gender ? gender.toLowerCase() : null, phone || null, email || null,
    nationality || 'Liberian', address || null, class_id, session_id || null,
    previous_school || null, previous_class || null,
    parent_name, parent_phone, parent_email || null, parent_address || null,
    parent_occupation || null, guardian_name || null, guardian_phone || null,
    guardian_relationship || null, medical_conditions || null, remarks || null,
    req.user?.id
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

export default admissionRouter;
