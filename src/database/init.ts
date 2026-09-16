import Database from 'better-sqlite3';
import path from 'path';
import { schemaV2Consolidated } from './schema-v2-consolidated';
import { homeworkAssignmentsSchema } from './schema-homework-assignments';
import { gradebookLessonPermsSchema } from './schema-gradebook-lesson-perms';
import { migrateSchoolEnhancements } from './schema-school-enhancements';
import { ensurePortalRole } from '../utils/userAccess';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/svl-sms.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.length || cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

const TENANT_TABLES = [
  'salary_structures', 'salary_components', 'employee_salaries', 'payroll_runs',
  'payslips', 'payslip_items', 'leave_types', 'leave_applications', 'employee_loans',
  'inventory_categories', 'inventory_items', 'stock_transactions',
  'visitors', 'phone_calls', 'postal_records',
  'timetable_periods', 'timetable_entries',
  'expense_categories', 'income_categories', 'expenses', 'income',
  'academic_sessions', 'terms', 'classes', 'subjects', 'parents',
];

function ensureTenantColumns(database: Database.Database): void {
  for (const table of TENANT_TABLES) {
    ensureColumn(database, table, 'institution_id', 'TEXT');
  }
  ensureColumn(database, 'visitors', 'created_by', 'TEXT');
  ensureColumn(database, 'phone_calls', 'created_by', 'TEXT');
  ensureColumn(database, 'postal_records', 'created_by', 'TEXT');
  ensureColumn(database, 'expense_categories', 'is_active', 'INTEGER DEFAULT 1');
  ensureColumn(database, 'income_categories', 'is_active', 'INTEGER DEFAULT 1');
}

export function migrateInstitutionBranding(database?: Database.Database): void {
  const target = database || getDatabase();
  ensureColumn(target, 'institutions', 'primary_color', "TEXT DEFAULT '#1e40af'");
  ensureColumn(target, 'institutions', 'secondary_color', "TEXT DEFAULT '#3b82f6'");
  ensureColumn(target, 'institutions', 'accent_color', "TEXT DEFAULT '#f59e0b'");
  ensureColumn(target, 'users', 'extra_permissions', 'TEXT');
  ensureColumn(target, 'students', 'is_active', 'INTEGER DEFAULT 1');
  ensureColumn(target, 'invoice_items', 'fee_structure_id', 'TEXT');
  try {
    target.prepare(`UPDATE students SET is_active = CASE WHEN status IS NULL OR status = 'active' THEN 1 ELSE 0 END`).run();
  } catch {
    // status column may be missing on older rows; default is_active is enough
  }
}

export function initializeDatabase(): void {
  const database = getDatabase();

  database.exec(schemaV2Consolidated);
  database.exec(homeworkAssignmentsSchema);
  database.exec(gradebookLessonPermsSchema);
  ensureTenantColumns(database);
  migrateInstitutionBranding(database);
  migrateSchoolEnhancements();
  backfillUserRoles(database);

  console.log('✓ Multi-tenant database initialized successfully');
  console.log('✓ Database schema with homework/assignments system created');
  console.log('✓ Gradebook, lesson plans, multi-role, password-request tables ready');
}

/** Ensure existing users with role_id appear in user_roles for multi-role merge. */
function backfillUserRoles(database: Database.Database): void {
  database.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id, is_primary)
    SELECT id, role_id, 1 FROM users WHERE role_id IS NOT NULL
  `).run();

  const institutions = database.prepare('SELECT id FROM institutions').all() as Array<{ id: string }>;
  for (const inst of institutions) {
    ensurePortalRole(inst.id, 'student', 'Student');
    ensurePortalRole(inst.id, 'parent', 'Parent');
    ensurePortalRole(inst.id, 'teacher', 'Teacher');
  }
}
