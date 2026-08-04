export const schema = `
-- NOTE: This schema is being migrated to multi-tenant architecture
-- The institutions table is now in schema-multitenant.ts
-- This file is kept for backward compatibility during migration
-- All tables now require institution_id for tenant isolation

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  key TEXT NOT NULL,
  value TEXT,
  category TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, key)
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_main INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users & Authentication
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  role_id TEXT REFERENCES roles(id),
  branch_id TEXT REFERENCES branches(id),
  is_active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Academic Structure
CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  numeric_name INTEGER,
  description TEXT,
  capacity INTEGER,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  type TEXT DEFAULT 'theory',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES academic_sessions(id),
  UNIQUE(class_id, subject_id, session_id)
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  admission_number TEXT UNIQUE NOT NULL,
  registration_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  nationality TEXT DEFAULT 'Liberian',
  county TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  photo TEXT,
  blood_group TEXT,
  medical_info TEXT,
  previous_school TEXT,
  previous_class TEXT,
  admission_date TEXT,
  branch_id TEXT REFERENCES branches(id),
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  session_id TEXT REFERENCES academic_sessions(id),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'graduated', 'transferred', 'withdrawn', 'suspended', 'deceased')),
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_documents (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_name TEXT,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Parents & Guardians
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT CHECK(relationship IN ('father', 'mother', 'guardian', 'other')),
  phone TEXT,
  email TEXT,
  address TEXT,
  occupation TEXT,
  workplace TEXT,
  photo TEXT,
  is_emergency_contact INTEGER DEFAULT 0,
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_parents (
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES parents(id) ON DELETE CASCADE,
  is_primary INTEGER DEFAULT 0,
  PRIMARY KEY (student_id, parent_id)
);

-- Teachers & Employees
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  description TEXT,
  head_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS designations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  date_of_birth TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  photo TEXT,
  department_id TEXT REFERENCES departments(id),
  designation_id TEXT REFERENCES designations(id),
  branch_id TEXT REFERENCES branches(id),
  qualification TEXT,
  experience TEXT,
  employment_date TEXT,
  employment_type TEXT DEFAULT 'full-time' CHECK(employment_type IN ('full-time', 'part-time', 'contract', 'temporary')),
  basic_salary REAL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  is_teacher INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  session_id TEXT REFERENCES academic_sessions(id),
  is_class_teacher INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, class_id, section_id, subject_id, session_id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_employee ON teacher_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
`;
