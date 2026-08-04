export const schemaPhase3 = `
-- Fee Types
CREATE TABLE IF NOT EXISTS fee_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  is_recurring INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
  id TEXT PRIMARY KEY,
  fee_type_id TEXT REFERENCES fee_types(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  branch_id TEXT REFERENCES branches(id),
  class_id TEXT REFERENCES classes(id),
  amount REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Student Fee Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  student_id TEXT REFERENCES students(id),
  session_id TEXT REFERENCES academic_sessions(id),
  term_id TEXT REFERENCES terms(id),
  total_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  due_date TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  fee_type_id TEXT REFERENCES fee_types(id),
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_number TEXT UNIQUE NOT NULL,
  invoice_id TEXT REFERENCES invoices(id),
  student_id TEXT REFERENCES students(id),
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'bank', 'mobile_money', 'card', 'cheque', 'other')),
  payment_date TEXT NOT NULL,
  reference_number TEXT,
  received_by TEXT REFERENCES users(id),
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'pending', 'refunded', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Discounts
CREATE TABLE IF NOT EXISTS fee_discounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'percentage' CHECK(type IN ('percentage', 'fixed')),
  value REAL NOT NULL DEFAULT 0,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Student Discounts
CREATE TABLE IF NOT EXISTS student_discounts (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id),
  discount_id TEXT REFERENCES fee_discounts(id),
  session_id TEXT REFERENCES academic_sessions(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, discount_id, session_id)
);

-- Income Categories
CREATE TABLE IF NOT EXISTS income_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Income
CREATE TABLE IF NOT EXISTS income (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES income_categories(id),
  branch_id TEXT REFERENCES branches(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  reference TEXT,
  payment_method TEXT DEFAULT 'cash',
  received_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES expense_categories(id),
  branch_id TEXT REFERENCES branches(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  reference TEXT,
  vendor TEXT,
  payment_method TEXT DEFAULT 'cash',
  approved_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fee_structures_class ON fee_structures(class_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_session ON fee_structures(session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_session ON invoices(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_income_category ON income(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
`;
