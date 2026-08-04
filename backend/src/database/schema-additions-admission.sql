-- Admission Enquiries Table
CREATE TABLE IF NOT EXISTS admission_enquiries (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  branch_id TEXT,
  enquiry_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date TEXT NOT NULL,
  class_id TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  address TEXT,
  county TEXT,
  city TEXT,
  source TEXT DEFAULT 'walk-in',
  status TEXT DEFAULT 'pending',
  remarks TEXT,
  assigned_to TEXT,
  follow_up_date TEXT,
  follow_up_remarks TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (institution_id) REFERENCES institutions(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Admission Applications Table
CREATE TABLE IF NOT EXISTS admission_applications (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  branch_id TEXT,
  application_number TEXT UNIQUE NOT NULL,
  application_date TEXT NOT NULL,
  enquiry_id TEXT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  nationality TEXT DEFAULT 'Liberian',
  county TEXT,
  city TEXT,
  address TEXT,
  class_id TEXT NOT NULL,
  section_id TEXT,
  session_id TEXT,
  previous_school TEXT,
  previous_class TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  parent_occupation TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_relationship TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  medical_conditions TEXT,
  status TEXT DEFAULT 'pending',
  status_remarks TEXT,
  status_updated_at TEXT,
  student_id TEXT,
  remarks TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (institution_id) REFERENCES institutions(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (enquiry_id) REFERENCES admission_enquiries(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (section_id) REFERENCES sections(id),
  FOREIGN KEY (session_id) REFERENCES academic_sessions(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Application Documents Table
CREATE TABLE IF NOT EXISTS application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES admission_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enquiries_institution ON admission_enquiries(institution_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON admission_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_date ON admission_enquiries(date);
CREATE INDEX IF NOT EXISTS idx_applications_institution ON admission_applications(institution_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON admission_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_date ON admission_applications(application_date);
CREATE INDEX IF NOT EXISTS idx_app_docs_application ON application_documents(application_id);
