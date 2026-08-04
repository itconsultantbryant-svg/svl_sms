export const schemaPhase4 = `
-- Library: Categories
CREATE TABLE IF NOT EXISTS book_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Library: Books
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  isbn TEXT,
  author TEXT,
  publisher TEXT,
  category_id TEXT REFERENCES book_categories(id),
  branch_id TEXT REFERENCES branches(id),
  edition TEXT,
  year INTEGER,
  quantity INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  rack_number TEXT,
  price REAL DEFAULT 0,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Library: Book Issues
CREATE TABLE IF NOT EXISTS book_issues (
  id TEXT PRIMARY KEY,
  book_id TEXT REFERENCES books(id),
  issued_to TEXT NOT NULL,
  issued_to_type TEXT DEFAULT 'student' CHECK(issued_to_type IN ('student', 'employee')),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  return_date TEXT,
  status TEXT DEFAULT 'issued' CHECK(status IN ('issued', 'returned', 'lost', 'damaged')),
  fine_amount REAL DEFAULT 0,
  issued_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Inventory: Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Inventory: Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES inventory_categories(id),
  branch_id TEXT REFERENCES branches(id),
  sku TEXT,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'piece',
  unit_price REAL DEFAULT 0,
  location TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Inventory: Stock Transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id),
  type TEXT NOT NULL CHECK(type IN ('purchase', 'issue', 'return', 'adjustment')),
  quantity INTEGER NOT NULL,
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  reference TEXT,
  vendor TEXT,
  date TEXT NOT NULL,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Transport: Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  model TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  driver_license TEXT,
  capacity INTEGER DEFAULT 0,
  branch_id TEXT REFERENCES branches(id),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'maintenance', 'inactive')),
  insurance_expiry TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Transport: Routes
CREATE TABLE IF NOT EXISTS transport_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vehicle_id TEXT REFERENCES vehicles(id),
  branch_id TEXT REFERENCES branches(id),
  fare REAL DEFAULT 0,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Transport: Route Stops
CREATE TABLE IF NOT EXISTS route_stops (
  id TEXT PRIMARY KEY,
  route_id TEXT REFERENCES transport_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pickup_time TEXT,
  drop_time TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Transport: Student Assignments
CREATE TABLE IF NOT EXISTS student_transport (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id),
  route_id TEXT REFERENCES transport_routes(id),
  stop_id TEXT REFERENCES route_stops(id),
  session_id TEXT REFERENCES academic_sessions(id),
  pickup INTEGER DEFAULT 1,
  dropoff INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, session_id)
);

-- Reception: Visitors
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  purpose TEXT,
  to_meet TEXT,
  id_type TEXT,
  id_number TEXT,
  branch_id TEXT REFERENCES branches(id),
  check_in TEXT NOT NULL,
  check_out TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Reception: Phone Calls
CREATE TABLE IF NOT EXISTS phone_calls (
  id TEXT PRIMARY KEY,
  call_type TEXT DEFAULT 'incoming' CHECK(call_type IN ('incoming', 'outgoing')),
  caller_name TEXT,
  phone TEXT,
  purpose TEXT,
  date TEXT NOT NULL,
  duration TEXT,
  follow_up INTEGER DEFAULT 0,
  notes TEXT,
  branch_id TEXT REFERENCES branches(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Reception: Postal/Courier
CREATE TABLE IF NOT EXISTS postal_records (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'incoming' CHECK(type IN ('incoming', 'outgoing')),
  reference_number TEXT,
  from_to TEXT,
  date TEXT NOT NULL,
  description TEXT,
  branch_id TEXT REFERENCES branches(id),
  received_by TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Certificate Templates
CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'custom' CHECK(type IN ('transfer', 'character', 'bonafide', 'completion', 'custom')),
  content TEXT NOT NULL,
  header TEXT,
  footer TEXT,
  background_image TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Generated Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES certificate_templates(id),
  student_id TEXT REFERENCES students(id),
  certificate_number TEXT UNIQUE NOT NULL,
  issued_date TEXT NOT NULL,
  content TEXT,
  generated_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ID Card Templates
CREATE TABLE IF NOT EXISTS id_card_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'student' CHECK(type IN ('student', 'employee')),
  layout TEXT NOT NULL,
  background_color TEXT DEFAULT '#ffffff',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_branch ON books(branch_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_book ON book_issues(book_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_status ON book_issues(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item ON stock_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_vehicle ON transport_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport(student_id);
CREATE INDEX IF NOT EXISTS idx_visitors_branch ON visitors(branch_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
`;
