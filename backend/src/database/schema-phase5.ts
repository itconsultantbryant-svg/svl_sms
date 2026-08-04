export const schemaPhase5 = `
-- Salary Structures
CREATE TABLE IF NOT EXISTS salary_structures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Salary Components (earnings & deductions)
CREATE TABLE IF NOT EXISTS salary_components (
  id TEXT PRIMARY KEY,
  structure_id TEXT REFERENCES salary_structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earning', 'deduction')),
  calculation_type TEXT DEFAULT 'fixed' CHECK(calculation_type IN ('fixed', 'percentage')),
  amount REAL DEFAULT 0,
  percentage_of TEXT,
  is_taxable INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Employee Salary Assignments
CREATE TABLE IF NOT EXISTS employee_salaries (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  structure_id TEXT REFERENCES salary_structures(id),
  basic_salary REAL NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, is_active)
);

-- Payroll Runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'processing', 'completed', 'cancelled')),
  total_earnings REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  total_net REAL DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  processed_by TEXT REFERENCES users(id),
  processed_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  payroll_id TEXT REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id),
  basic_salary REAL DEFAULT 0,
  total_earnings REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  net_salary REAL DEFAULT 0,
  status TEXT DEFAULT 'generated' CHECK(status IN ('generated', 'paid', 'cancelled')),
  payment_method TEXT DEFAULT 'bank_transfer',
  payment_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Payslip Items (breakdown)
CREATE TABLE IF NOT EXISTS payslip_items (
  id TEXT PRIMARY KEY,
  payslip_id TEXT REFERENCES payslips(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earning', 'deduction')),
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  days_allowed INTEGER DEFAULT 0,
  is_paid INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Leave Applications
CREATE TABLE IF NOT EXISTS leave_applications (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  leave_type_id TEXT REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Employee Loans/Advances
CREATE TABLE IF NOT EXISTS employee_loans (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  amount REAL NOT NULL,
  monthly_deduction REAL NOT NULL,
  total_paid REAL DEFAULT 0,
  balance REAL NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  reason TEXT,
  approved_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee ON employee_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month ON payroll_runs(month, year);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll ON payslips(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee ON employee_loans(employee_id);
`;
