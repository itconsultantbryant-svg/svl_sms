export const schemaAdmission = `
-- ============================================
-- ADMISSION MODULE
-- Complete admission workflow from enquiry to student
-- ============================================

-- ============================================
-- 1. ADMISSION ENQUIRIES
-- ============================================
CREATE TABLE IF NOT EXISTS admission_enquiries (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),

  -- Enquiry Details
  enquiry_number TEXT UNIQUE NOT NULL,
  enquiry_date TEXT DEFAULT (date('now')),
  enquiry_source TEXT CHECK(enquiry_source IN ('walk_in', 'phone', 'email', 'website', 'social_media', 'referral', 'advertisement', 'other')),

  -- Prospective Student
  student_first_name TEXT NOT NULL,
  student_middle_name TEXT,
  student_last_name TEXT NOT NULL,
  student_dob TEXT,
  student_gender TEXT CHECK(student_gender IN ('male', 'female', 'other')),

  -- Academic Interest
  desired_class_id TEXT REFERENCES classes(id),
  desired_session_id TEXT REFERENCES academic_sessions(id),
  previous_school TEXT,
  previous_class TEXT,

  -- Parent/Guardian
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  parent_address TEXT,
  parent_occupation TEXT,

  -- Status & Follow-up
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'follow_up', 'scheduled', 'converted', 'rejected', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),

  -- Follow-up
  next_follow_up_date TEXT,
  follow_up_count INTEGER DEFAULT 0,
  notes TEXT,

  -- Conversion
  converted_to_application_id TEXT,
  converted_at TEXT,

  -- Assignment
  assigned_to TEXT REFERENCES users(id),

  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 2. ENQUIRY FOLLOW-UPS
-- ============================================
CREATE TABLE IF NOT EXISTS enquiry_followups (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES admission_enquiries(id) ON DELETE CASCADE,

  followup_date TEXT NOT NULL,
  followup_type TEXT CHECK(followup_type IN ('call', 'email', 'sms', 'visit', 'other')),
  notes TEXT,
  outcome TEXT,

  next_action_date TEXT,
  next_action TEXT,

  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 3. ADMISSION APPLICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS admission_applications (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),

  -- Application Details
  application_number TEXT UNIQUE NOT NULL,
  application_date TEXT DEFAULT (date('now')),
  enquiry_id TEXT REFERENCES admission_enquiries(id),

  -- Student Information
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  nationality TEXT DEFAULT 'Liberian',
  religion TEXT,
  blood_group TEXT,

  -- Address
  address TEXT,
  county TEXT,
  city TEXT,
  postal_code TEXT,

  -- Contact
  phone TEXT,
  email TEXT,

  -- Academic Background
  previous_school TEXT,
  previous_class TEXT,
  previous_percentage REAL,
  previous_board TEXT,
  previous_year INTEGER,
  transfer_certificate_number TEXT,

  -- Medical Information
  medical_conditions TEXT,
  allergies TEXT,
  special_needs TEXT,

  -- Applied For
  desired_class_id TEXT REFERENCES classes(id),
  desired_section_id TEXT REFERENCES sections(id),
  desired_session_id TEXT REFERENCES academic_sessions(id),

  -- Application Status
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'interview_scheduled', 'test_scheduled', 'approved', 'rejected', 'waitlisted', 'cancelled')),

  -- Workflow
  submitted_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,

  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  approval_notes TEXT,

  rejected_by TEXT REFERENCES users(id),
  rejected_at TEXT,
  rejection_reason TEXT,

  -- Conversion
  converted_to_student_id TEXT,
  converted_at TEXT,

  -- Fees
  application_fee REAL DEFAULT 0,
  application_fee_paid INTEGER DEFAULT 0,
  payment_reference TEXT,

  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 4. PARENT/GUARDIAN INFORMATION (from application)
-- ============================================
CREATE TABLE IF NOT EXISTS application_parents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,

  relationship TEXT CHECK(relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary INTEGER DEFAULT 0,

  -- Personal Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  occupation TEXT,
  employer TEXT,
  annual_income TEXT,

  -- Address (if different)
  address TEXT,

  -- Emergency Contact
  is_emergency_contact INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 5. APPLICATION DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  is_verified INTEGER DEFAULT 0,
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  verification_notes TEXT,

  uploaded_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 6. ADMISSION TESTS (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS admission_tests (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  test_name TEXT NOT NULL,
  test_date TEXT NOT NULL,
  test_time TEXT,
  duration_minutes INTEGER,
  venue TEXT,

  for_class_id TEXT REFERENCES classes(id),
  for_session_id TEXT REFERENCES academic_sessions(id),

  total_marks REAL,
  passing_marks REAL,

  instructions TEXT,

  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS application_test_results (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
  test_id TEXT REFERENCES admission_tests(id),

  test_date TEXT,
  marks_obtained REAL,
  total_marks REAL,
  percentage REAL,
  result TEXT CHECK(result IN ('pass', 'fail', 'absent')),

  remarks TEXT,

  evaluated_by TEXT REFERENCES users(id),
  evaluated_at TEXT,

  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 7. ADMISSION INTERVIEWS (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS admission_interviews (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,

  interview_date TEXT NOT NULL,
  interview_time TEXT,
  venue TEXT,

  interviewer_id TEXT REFERENCES users(id),
  panel_members TEXT,

  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),

  -- Interview Assessment
  communication_rating INTEGER CHECK(communication_rating BETWEEN 1 AND 5),
  knowledge_rating INTEGER CHECK(knowledge_rating BETWEEN 1 AND 5),
  behavior_rating INTEGER CHECK(behavior_rating BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),

  comments TEXT,
  recommendation TEXT CHECK(recommendation IN ('strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'strongly_not_recommend')),

  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 8. ADMISSION DECISIONS
-- ============================================
CREATE TABLE IF NOT EXISTS admission_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,

  decision TEXT NOT NULL CHECK(decision IN ('approved', 'rejected', 'waitlisted', 'conditional')),
  decision_date TEXT DEFAULT (date('now')),

  -- Approved Details
  assigned_class_id TEXT REFERENCES classes(id),
  assigned_section_id TEXT REFERENCES sections(id),
  assigned_session_id TEXT REFERENCES academic_sessions(id),
  admission_date TEXT,

  -- Conditions (if conditional approval)
  conditions TEXT,

  -- Communication
  notification_sent INTEGER DEFAULT 0,
  notification_date TEXT,

  -- Response from Applicant
  applicant_response TEXT CHECK(applicant_response IN ('accepted', 'declined', 'pending')),
  response_date TEXT,

  decided_by TEXT REFERENCES users(id),
  remarks TEXT,

  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 9. ADMISSION CAMPAIGNS (Marketing)
-- ============================================
CREATE TABLE IF NOT EXISTS admission_campaigns (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  campaign_name TEXT NOT NULL,
  campaign_type TEXT,

  start_date TEXT,
  end_date TEXT,

  target_audience TEXT,
  budget REAL,

  -- Results
  enquiries_generated INTEGER DEFAULT 0,
  applications_received INTEGER DEFAULT 0,
  admissions_confirmed INTEGER DEFAULT 0,

  status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'completed', 'cancelled')),

  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_enquiries_institution ON admission_enquiries(institution_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON admission_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_date ON admission_enquiries(enquiry_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned ON admission_enquiries(assigned_to);

CREATE INDEX IF NOT EXISTS idx_applications_institution ON admission_applications(institution_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON admission_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_date ON admission_applications(application_date);
CREATE INDEX IF NOT EXISTS idx_applications_enquiry ON admission_applications(enquiry_id);

CREATE INDEX IF NOT EXISTS idx_app_parents_application ON application_parents(application_id);
CREATE INDEX IF NOT EXISTS idx_app_documents_application ON application_documents(application_id);

CREATE INDEX IF NOT EXISTS idx_admission_tests_institution ON admission_tests(institution_id);
CREATE INDEX IF NOT EXISTS idx_test_results_application ON application_test_results(application_id);

CREATE INDEX IF NOT EXISTS idx_interviews_application ON admission_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_decisions_application ON admission_decisions(application_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_institution ON admission_campaigns(institution_id);
`;
