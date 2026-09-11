export const gradebookLessonPermsSchema = `
-- ============================================
-- Gradebook (weighted columns + approval)
-- ============================================

CREATE TABLE IF NOT EXISTS gradebooks (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  teacher_id TEXT NOT NULL REFERENCES employees(id),
  status TEXT DEFAULT 'open' CHECK(status IN ('draft', 'open', 'submitted', 'approved', 'rejected')),
  generated_by TEXT REFERENCES users(id),
  submitted_at TEXT,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  rejection_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, session_id, term_id, class_id, section_id, subject_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS gradebook_columns (
  id TEXT PRIMARY KEY,
  gradebook_id TEXT NOT NULL REFERENCES gradebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 100,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gradebook_entries (
  id TEXT PRIMARY KEY,
  gradebook_id TEXT NOT NULL REFERENCES gradebooks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES gradebook_columns(id) ON DELETE CASCADE,
  score REAL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(gradebook_id, student_id, column_id)
);

CREATE TABLE IF NOT EXISTS gradebook_totals (
  id TEXT PRIMARY KEY,
  gradebook_id TEXT NOT NULL REFERENCES gradebooks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  computed_percent REAL DEFAULT 0,
  letter_grade TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(gradebook_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_gradebooks_institution ON gradebooks(institution_id);
CREATE INDEX IF NOT EXISTS idx_gradebooks_teacher ON gradebooks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_gradebooks_status ON gradebooks(status);
CREATE INDEX IF NOT EXISTS idx_gradebook_entries_gb ON gradebook_entries(gradebook_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_totals_gb ON gradebook_totals(gradebook_id);

-- ============================================
-- Lesson Plans
-- ============================================

CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  class_id TEXT REFERENCES classes(id),
  subject_id TEXT REFERENCES subjects(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  file_data TEXT,
  file_name TEXT,
  mime_type TEXT,
  created_by TEXT REFERENCES users(id),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_plan_recipients (
  id TEXT PRIMARY KEY,
  lesson_plan_id TEXT NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sent_at TEXT DEFAULT (datetime('now')),
  seen_at TEXT,
  UNIQUE(lesson_plan_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_institution ON lesson_plans(institution_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_recipients_teacher ON lesson_plan_recipients(teacher_id);

-- ============================================
-- Multi-role assignment
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ============================================
-- Password change requests (students need admin approval)
-- ============================================

CREATE TABLE IF NOT EXISTS password_change_requests (
  id TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  requested_at TEXT DEFAULT (datetime('now')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_change_user ON password_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_change_status ON password_change_requests(status);
`;
