import Database from 'better-sqlite3';
import path from 'path';
import { schemaV2Consolidated } from './schema-v2-consolidated';
import { homeworkAssignmentsSchema } from './schema-homework-assignments';

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
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateInstitutionBranding(database: Database.Database): void {
  ensureColumn(database, 'institutions', 'primary_color', "TEXT DEFAULT '#1e40af'");
  ensureColumn(database, 'institutions', 'secondary_color', "TEXT DEFAULT '#3b82f6'");
  ensureColumn(database, 'institutions', 'accent_color', "TEXT DEFAULT '#f59e0b'");
}

export function initializeDatabase(): void {
  const database = getDatabase();

  // Execute consolidated multi-tenant schema V2
  // This includes ALL tables from all phases with institution_id for tenant isolation
  database.exec(schemaV2Consolidated);

  // Execute homework & assignments schema
  database.exec(homeworkAssignmentsSchema);

  // Additive migrations for existing DBs
  migrateInstitutionBranding(database);

  console.log('✓ Multi-tenant database initialized successfully');
  console.log('✓ Database schema with homework/assignments system created');
}
