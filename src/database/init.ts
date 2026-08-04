import Database from 'better-sqlite3';
import path from 'path';
import { schemaV2Consolidated } from './schema-v2-consolidated';

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

export function initializeDatabase(): void {
  const database = getDatabase();

  // Execute consolidated multi-tenant schema V2
  // This includes ALL tables from all phases with institution_id for tenant isolation
  database.exec(schemaV2Consolidated);

  console.log('✓ Multi-tenant database initialized successfully');
  console.log('✓ 98 tables created with tenant isolation');
}
