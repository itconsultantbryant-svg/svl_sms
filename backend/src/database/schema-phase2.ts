export const schemaPhase2 = `
-- Attendance
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  teacher_id TEXT REFERENCES employees(id),
  date TEXT NOT NULL,
  type TEXT DEFAULT 'class' CHECK(type IN ('class', 'subject')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_attendance (
  id TEXT PRIMARY KEY,
  attendance_session_id TEXT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id),
  status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Timetable
CREATE TABLE IF NOT EXISTS timetable_periods (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_break INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  teacher_id TEXT REFERENCES employees(id),
  period_id TEXT REFERENCES timetable_periods(id),
  session_id TEXT REFERENCES academic_sessions(id),
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  room TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(class_id, section_id, period_id, day_of_week, session_id)
);

-- Examinations
CREATE TABLE IF NOT EXISTS exam_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  percentage REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exam_type_id TEXT REFERENCES exam_types(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_schedules (
  id TEXT PRIMARY KEY,
  exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  subject_id TEXT REFERENCES subjects(id),
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  room TEXT,
  max_marks REAL DEFAULT 100,
  pass_marks REAL DEFAULT 40,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Grade Scales
CREATE TABLE IF NOT EXISTS grade_scales (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grade_scale_entries (
  id TEXT PRIMARY KEY,
  grade_scale_id TEXT REFERENCES grade_scales(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  min_percentage REAL NOT NULL,
  max_percentage REAL NOT NULL,
  grade_point REAL DEFAULT 0,
  remark TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Marks
CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  exam_schedule_id TEXT REFERENCES exam_schedules(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id),
  marks_obtained REAL,
  is_absent INTEGER DEFAULT 0,
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(exam_schedule_id, student_id)
);

-- Results
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id),
  exam_id TEXT REFERENCES exams(id),
  class_id TEXT REFERENCES classes(id),
  section_id TEXT REFERENCES sections(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  total_marks REAL DEFAULT 0,
  total_obtained REAL DEFAULT 0,
  percentage REAL DEFAULT 0,
  grade TEXT,
  grade_point REAL DEFAULT 0,
  rank INTEGER,
  status TEXT DEFAULT 'pass' CHECK(status IN ('pass', 'fail', 'withheld')),
  teacher_comment TEXT,
  principal_comment TEXT,
  is_published INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, exam_id)
);

-- Indexes for Phase 2
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class ON timetable_entries(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_schedule ON marks(exam_schedule_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON results(exam_id);
`;
