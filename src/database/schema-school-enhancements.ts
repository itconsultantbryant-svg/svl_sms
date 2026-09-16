import { getDatabase } from './init';

function ensureColumn(database: ReturnType<typeof getDatabase>, table: string, column: string, definition: string): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.length || cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const schoolEnhancementsSchema = `
CREATE TABLE IF NOT EXISTS institution_signatures (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL CHECK(role_key IN ('registrar', 'principal', 'board_chair')),
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL,
  signature_image TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, role_key)
);

CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TEXT DEFAULT (datetime('now')),
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS student_prior_records (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK(record_type IN ('previous_gradesheet', 'transfer_transcript', 'prior_class', 'other')),
  title TEXT,
  school_name TEXT,
  class_name TEXT,
  session_name TEXT,
  notes TEXT,
  file_data TEXT,
  file_name TEXT,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_institution_signatures_inst ON institution_signatures(institution_id);
CREATE INDEX IF NOT EXISTS idx_announcement_ack_user ON announcement_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_student_prior_student ON student_prior_records(student_id);
`;

const MONEY_TABLES = [
  'fee_structures', 'invoices', 'invoice_items', 'payments',
  'income', 'expenses', 'payslips', 'payroll_runs', 'employee_salaries',
];

export function migrateSchoolEnhancements(): void {
  const db = getDatabase();
  db.exec(schoolEnhancementsSchema);

  ensureColumn(db, 'institutions', 'secondary_currency', "TEXT DEFAULT 'LRD'");
  ensureColumn(db, 'institutions', 'secondary_currency_symbol', "TEXT DEFAULT 'L$'");
  ensureColumn(db, 'institutions', 'allowed_currencies', "TEXT DEFAULT 'USD,LRD'");

  for (const table of MONEY_TABLES) {
    ensureColumn(db, table, 'currency_code', "TEXT DEFAULT 'USD'");
  }

  ensureColumn(db, 'notifications', 'is_acknowledged', 'INTEGER DEFAULT 0');
  ensureColumn(db, 'notifications', 'acknowledged_at', 'TEXT');
  ensureColumn(db, 'announcements', 'require_ack', 'INTEGER DEFAULT 1');

  // Backfill money rows from institution primary currency where blank.
  try {
    for (const table of MONEY_TABLES) {
      db.prepare(`
        UPDATE ${table} SET currency_code = COALESCE(
          (SELECT currency FROM institutions WHERE institutions.id = ${table}.institution_id),
          'USD'
        )
        WHERE currency_code IS NULL OR currency_code = ''
      `).run();
    }
  } catch {
    // Older DBs without institution_id on some money tables are fine.
  }

  console.log('✓ Dual currency, signatures, prior records, and acknowledgements ready');
}
