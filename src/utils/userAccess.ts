import { getDatabase } from '../database/init';

export interface RoleInfo {
  id: string;
  code: string | null;
  name: string | null;
  user_type_hint?: string | null;
}

export interface MergedAccess {
  roles: RoleInfo[];
  role_ids: string[];
  permissions: string[];
  role_codes: string[];
  primary_role_id: string | null;
}

function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Load all roles for a user (user_roles + fallback to users.role_id) and merge permissions. */
export function getMergedAccessForUser(userId: string, primaryRoleId?: string | null): MergedAccess {
  const db = getDatabase();

  let rows = db.prepare(`
    SELECT r.id, r.role_code as code, r.role_name as name, r.permissions, ur.is_primary
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ?
  `).all(userId) as any[];

  if (rows.length === 0 && primaryRoleId) {
    const role = db.prepare(`
      SELECT id, role_code as code, role_name as name, permissions, 1 as is_primary
      FROM roles WHERE id = ?
    `).get(primaryRoleId) as any;
    if (role) rows = [role];
  }

  // Also merge role_permissions junction if present
  const permSet = new Set<string>();
  const roles: RoleInfo[] = [];
  const role_codes: string[] = [];
  let primary_role_id: string | null = primaryRoleId || null;

  for (const row of rows) {
    roles.push({ id: row.id, code: row.code, name: row.name });
    if (row.code) role_codes.push(row.code);
    if (row.is_primary) primary_role_id = row.id;
    for (const p of parsePermissions(row.permissions)) permSet.add(p);

    const junction = db.prepare(`
      SELECT p.permission_code as code
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `).all(row.id) as Array<{ code: string }>;
    for (const j of junction) {
      if (j.code) permSet.add(j.code);
    }
  }

  if (!primary_role_id && roles.length > 0) {
    primary_role_id = roles[0].id;
  }

  return {
    roles,
    role_ids: roles.map((r) => r.id),
    permissions: Array.from(permSet),
    role_codes: Array.from(new Set(role_codes)),
    primary_role_id,
  };
}

/** Replace all roles for a user; first role becomes primary and syncs users.role_id. */
export function setUserRoles(userId: string, roleIds: string[]): void {
  const db = getDatabase();
  const unique = Array.from(new Set(roleIds.filter(Boolean)));

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    const insert = db.prepare(`
      INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (?, ?, ?)
    `);
    unique.forEach((roleId, index) => {
      insert.run(userId, roleId, index === 0 ? 1 : 0);
    });
    if (unique.length > 0) {
      db.prepare('UPDATE users SET role_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(unique[0], userId);
    } else {
      db.prepare('UPDATE users SET role_id = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(userId);
    }
  });
  tx();
}

export function ensureUserRole(userId: string, roleId: string, primary = true): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id, is_primary) VALUES (?, ?, ?)
  `).run(userId, roleId, primary ? 1 : 0);
  if (primary) {
    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(roleId, userId);
  }
}

export function userHasAnyPermission(
  userId: string,
  userType: string | null | undefined,
  primaryRoleId: string | null | undefined,
  required: string[]
): boolean {
  if (userType === 'platform_admin' || userType === 'institution_admin') return true;
  const access = getMergedAccessForUser(userId, primaryRoleId);
  return required.some((p) => access.permissions.includes(p));
}

/** Map role codes / user_types to dashboard home priority (lower = higher priority). */
export const DASHBOARD_PRIORITY: Record<string, number> = {
  platform_admin: 1,
  institution_admin: 2,
  branch_admin: 3,
  accountant: 4,
  finance_officer: 4,
  finance: 4,
  registrar: 5,
  admission_officer: 5,
  admission: 5,
  teacher: 6,
  staff: 7,
  parent: 8,
  student: 9,
};

export function pickBestHomeFromRoles(
  userType: string,
  roleCodes: string[],
  getPath: (type: string, codes: string[]) => string
): string {
  const candidates = [userType, ...roleCodes].filter(Boolean);
  let best = userType;
  let bestScore = DASHBOARD_PRIORITY[userType] ?? 100;
  for (const c of candidates) {
    const score = DASHBOARD_PRIORITY[c] ?? 100;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // Prefer user_type semantics for home when best is a user_type; else pass role codes
  if (['platform_admin', 'institution_admin', 'branch_admin', 'teacher', 'student', 'parent', 'staff'].includes(best)) {
    return getPath(best, roleCodes);
  }
  return getPath(userType, roleCodes);
}
