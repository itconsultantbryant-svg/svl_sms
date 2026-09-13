import type Database from 'better-sqlite3';

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function userTables(db: Database.Database): string[] {
  return (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as Array<{ name: string }>)
    .map((row) => row.name);
}

/** Remove a user and every row that points at them. */
export function purgeUser(db: Database.Database, userId: string): void {
  for (const name of userTables(db)) {
    if (name === 'users') continue;
    let refs: Array<{ from: string; on_delete: string; table: string }> = [];
    try {
      refs = db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all() as any[];
    } catch {
      continue;
    }
    for (const ref of refs) {
      if (ref.table !== 'users') continue;
      const col = quote(ref.from);
      if (String(ref.on_delete || '').toUpperCase() === 'CASCADE') {
        db.prepare(`DELETE FROM ${quote(name)} WHERE ${col} = ?`).run(userId);
      } else {
        try {
          db.prepare(`UPDATE ${quote(name)} SET ${col} = NULL WHERE ${col} = ?`).run(userId);
        } catch {
          db.prepare(`DELETE FROM ${quote(name)} WHERE ${col} = ?`).run(userId);
        }
      }
    }
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  if (result.changes === 0) {
    throw new Error('User not found');
  }
}

/** Remove an institution, its users, and every tenant row. */
export function purgeInstitution(db: Database.Database, institutionId: string): void {
  const previous = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    const users = db.prepare('SELECT id FROM users WHERE institution_id = ?').all(institutionId) as Array<{ id: string }>;
    for (const user of users) {
      purgeUser(db, user.id);
    }

    for (const name of userTables(db)) {
      if (name === 'institutions' || name === 'users') continue;
      const cols = db.prepare(`PRAGMA table_info(${quote(name)})`).all() as Array<{ name: string }>;
      if (!cols.some((col) => col.name === 'institution_id')) continue;
      db.prepare(`DELETE FROM ${quote(name)} WHERE institution_id = ?`).run(institutionId);
    }

    const result = db.prepare('DELETE FROM institutions WHERE id = ?').run(institutionId);
    if (result.changes === 0) {
      throw new Error('Institution not found');
    }
  } finally {
    db.pragma(previous ? 'foreign_keys = ON' : 'foreign_keys = OFF');
  }
}
