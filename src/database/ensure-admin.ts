import { getDatabase } from './init';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SUPERADMIN_USERNAME = 'superadmin';
const SUPERADMIN_PASSWORD = 'SuperAdmin2024!';
const SUPERADMIN_EMAIL = 'admin@softwarevala.com';

/**
 * Ensure the developer platform superadmin exists with full access.
 * Idempotent: creates or updates password/role on every boot.
 */
export function ensureAdminUser() {
  const db = getDatabase();

  try {
    let platformAdminRole = db
      .prepare("SELECT id FROM roles WHERE role_code = 'platform_admin' LIMIT 1")
      .get() as any;

    if (!platformAdminRole) {
      const roleId = uuidv4();
      db.prepare(`
        INSERT INTO roles (
          id, institution_id, role_code, role_name, description,
          is_system_role, is_platform_role, role_level, permissions, is_active
        ) VALUES (?, NULL, 'platform_admin', 'Platform Administrator',
                  'Full system access across all institutions',
                  1, 1, 'platform', '[]', 1)
      `).run(roleId);
      platformAdminRole = { id: roleId };
      console.log('✓ Created platform_admin role');
    }

    const hashedPassword = bcrypt.hashSync(SUPERADMIN_PASSWORD, 10);
    const existing = db
      .prepare('SELECT id, username FROM users WHERE username = ?')
      .get(SUPERADMIN_USERNAME) as any;

    if (existing) {
      db.prepare(`
        UPDATE users
        SET password_hash = ?,
            email = ?,
            first_name = 'Platform',
            last_name = 'Superadmin',
            role_id = ?,
            user_type = 'platform_admin',
            institution_id = NULL,
            is_active = 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(hashedPassword, SUPERADMIN_EMAIL, platformAdminRole.id, existing.id);
      console.log('✓ Superadmin ensured');
      console.log(`  Username: ${SUPERADMIN_USERNAME}`);
      return;
    }

    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (
        id, institution_id, branch_id, username, email, password_hash,
        first_name, last_name, role_id, user_type, is_active, email_verified
      ) VALUES (?, NULL, NULL, ?, ?, ?, 'Platform', 'Superadmin', ?, 'platform_admin', 1, 1)
    `).run(userId, SUPERADMIN_USERNAME, SUPERADMIN_EMAIL, hashedPassword, platformAdminRole.id);

    console.log('✓ Superadmin user created');
    console.log(`  Username: ${SUPERADMIN_USERNAME}`);
    console.log('  Password: SuperAdmin2024!');
  } catch (error) {
    console.error('Error ensuring superadmin user:', error);
  }
}
