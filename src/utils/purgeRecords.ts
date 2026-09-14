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

const OWNED_CHILDREN: Record<string, string[]> = {
  students: ['invoices', 'payments', 'student_parents', 'parent_students', 'student_documents', 'attendance_records', 'gradebook_entries', 'assignment_submissions'],
  employees: ['teacher_assignments', 'payslips', 'employee_salaries', 'employee_leaves', 'employee_loans'],
  parents: ['parent_students', 'student_parents'],
  classes: ['class_subjects', 'sections', 'timetable_entries', 'fee_structures'],
  subjects: ['class_subjects', 'teacher_assignments'],
  academic_sessions: ['terms'],
  exams: ['exam_schedules', 'marks', 'results'],
  attendance_sessions: ['attendance_records'],
  invoices: ['invoice_items', 'payments'],
  payroll_runs: ['payslips'],
  payslips: ['payslip_items'],
  gradebooks: ['gradebook_columns', 'gradebook_entries', 'gradebook_totals'],
  lesson_plans: ['lesson_plan_recipients'],
  timetable_periods: ['timetable_entries'],
  fee_structures: ['invoice_items'],
};

function tableHasId(db: Database.Database, table: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string }>;
  return cols.some((col) => col.name === 'id');
}

function columnInfo(db: Database.Database, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string; notnull: number }>;
  return cols.find((col) => col.name === column);
}

function removeDependents(db: Database.Database, table: string, id: string, seen: Set<string>): void {
  const key = `${table}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);

  const owned = new Set(OWNED_CHILDREN[table] || []);
  for (const name of userTables(db)) {
    if (name === table || name === 'institutions' || name === 'users') continue;
    let refs: Array<{ from: string; table: string; on_delete: string }> = [];
    try {
      refs = db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all() as any[];
    } catch {
      continue;
    }
    for (const ref of refs) {
      if (ref.table !== table) continue;
      const col = columnInfo(db, name, ref.from);
      if (!col) continue;
      const cascade = String(ref.on_delete || '').toUpperCase() === 'CASCADE';
      const dropChild = cascade || col.notnull === 1 || owned.has(name);
      if (!dropChild) {
        try {
          db.prepare(`UPDATE ${quote(name)} SET ${quote(ref.from)} = NULL WHERE ${quote(ref.from)} = ?`).run(id);
        } catch {
          db.prepare(`DELETE FROM ${quote(name)} WHERE ${quote(ref.from)} = ?`).run(id);
        }
        continue;
      }
      if (tableHasId(db, name)) {
        const children = db.prepare(`SELECT id FROM ${quote(name)} WHERE ${quote(ref.from)} = ?`).all(id) as Array<{ id: string }>;
        for (const child of children) {
          if (child.id) removeDependents(db, name, child.id, seen);
        }
      }
      db.prepare(`DELETE FROM ${quote(name)} WHERE ${quote(ref.from)} = ?`).run(id);
    }
  }
}

/** Hard-delete one row and the records that belong to it. Nullable links are cleared so the row disappears without wiping unrelated people. */
export function purgeRow(db: Database.Database, table: string, id: string): number {
  const previous = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    removeDependents(db, table, id, new Set());
    const result = db.prepare(`DELETE FROM ${quote(table)} WHERE id = ?`).run(id);
    return result.changes;
  } finally {
    db.pragma(previous ? 'foreign_keys = ON' : 'foreign_keys = OFF');
  }
}

function linkedUserIds(db: Database.Database, table: string, id: string, userColumn?: string): string[] {
  const ids = new Set<string>();
  if (userColumn) {
    try {
      const row = db.prepare(`SELECT ${quote(userColumn)} as uid FROM ${quote(table)} WHERE id = ?`).get(id) as { uid?: string } | undefined;
      if (row?.uid) ids.add(row.uid);
    } catch {
      // column may not exist on older databases
    }
  }
  try {
    const linked = db.prepare('SELECT id FROM users WHERE linked_entity_id = ?').all(id) as Array<{ id: string }>;
    for (const user of linked) ids.add(user.id);
  } catch {
    // ignore
  }
  return [...ids];
}

/** Delete a tenant-owned record, then remove login accounts that only existed for it. */
export function deleteSchoolRecord(
  db: Database.Database,
  table: string,
  id: string,
  institutionId: string,
  options?: { userColumn?: string }
): void {
  const owned = db.prepare(`SELECT id FROM ${quote(table)} WHERE id = ? AND institution_id = ?`).get(id, institutionId) as { id: string } | undefined;
  if (!owned) {
    throw new Error('Record not found');
  }
  const userIds = linkedUserIds(db, table, id, options?.userColumn);
  const removed = purgeRow(db, table, id);
  if (!removed) {
    throw new Error('Record not found');
  }
  for (const userId of userIds) {
    try {
      purgeUser(db, userId);
    } catch {
      // login may already have been removed with the record
    }
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
