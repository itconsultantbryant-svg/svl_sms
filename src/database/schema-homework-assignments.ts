export const homeworkAssignmentsSchema = `
-- ============================================
-- HOMEWORK & ASSIGNMENTS MANAGEMENT
-- Teacher creates assignments, students submit, teacher grades
-- ============================================

-- Assignments/Homework created by teachers
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  -- Assignment Details
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('homework', 'assignment', 'project', 'classwork')),

  -- Assignment For
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),

  -- Created By
  teacher_id TEXT REFERENCES employees(id),

  -- Grading
  max_marks REAL NOT NULL DEFAULT 100,

  -- Dates
  assigned_date TEXT NOT NULL,
  due_date TEXT NOT NULL,

  -- Attachments
  attachment_url TEXT,
  attachment_name TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Student Submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id),

  -- Submission Content
  submission_text TEXT,
  attachment_url TEXT,
  attachment_name TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'late', 'graded', 'returned')),
  submitted_at TEXT,

  -- Grading
  marks_obtained REAL,
  feedback TEXT,
  graded_at TEXT,
  graded_by TEXT REFERENCES employees(id),

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(assignment_id, student_id)
);

-- Grade Approval Workflow
-- Adding approval status to results table
-- This will be handled as an ALTER TABLE in migration

-- Track grade submission and approval workflow
CREATE TABLE IF NOT EXISTS grade_submissions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  -- What is being submitted
  exam_id TEXT REFERENCES exams(id),
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),

  -- Submitted by teacher
  teacher_id TEXT REFERENCES employees(id),
  submitted_at TEXT,

  -- Approval workflow
  approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  rejection_reason TEXT,

  -- Student count for this submission
  student_count INTEGER DEFAULT 0,

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(exam_id, class_id, section_id, subject_id, session_id, term_id, teacher_id)
);

-- Parent-Student Links (if not already exists)
CREATE TABLE IF NOT EXISTS parent_students (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT CHECK(relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary INTEGER DEFAULT 0,
  can_access_records INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(parent_id, student_id)
);

-- Notifications for real-time updates
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  -- Recipient
  user_id TEXT REFERENCES users(id),
  user_type TEXT,

  -- Notification Details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK(type IN ('assignment', 'grade', 'attendance', 'fee', 'announcement', 'approval', 'general')),

  -- Related Entity
  related_entity_type TEXT,
  related_entity_id TEXT,

  -- Status
  is_read INTEGER DEFAULT 0,
  read_at TEXT,

  -- Audit
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_institution ON assignments(institution_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_institution ON assignment_submissions(institution_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);

CREATE INDEX IF NOT EXISTS idx_grade_submissions_institution ON grade_submissions(institution_id);
CREATE INDEX IF NOT EXISTS idx_grade_submissions_teacher ON grade_submissions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_grade_submissions_status ON grade_submissions(approval_status);
CREATE INDEX IF NOT EXISTS idx_grade_submissions_exam ON grade_submissions(exam_id);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
`;
