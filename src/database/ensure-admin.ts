import { getDatabase } from './init';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export function ensureAdminUser() {
  const db = getDatabase();

  try {
    // Check if admin user exists
    const adminUser = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin') as any;

    if (adminUser) {
      console.log('✓ Admin user already exists:', adminUser.username);
      return;
    }

    // Get platform_admin role
    let platformAdminRole = db.prepare("SELECT id FROM roles WHERE code = 'platform_admin'").get() as any;

    if (!platformAdminRole) {
      console.log('Creating platform_admin role...');
      const roleId = uuidv4();
      db.prepare(`
        INSERT INTO roles (id, code, name, description, level)
        VALUES (?, 'platform_admin', 'Platform Administrator', 'Full system access across all institutions', 1)
      `).run(roleId);
      platformAdminRole = { id: roleId };
    }

    // Get or create default institution
    let institution = db.prepare('SELECT id FROM institutions LIMIT 1').get() as any;

    if (!institution) {
      console.log('Creating default institution...');
      const instId = uuidv4();
      db.prepare(`
        INSERT INTO institutions (id, name, code, email, phone, address, is_active)
        VALUES (?, 'Victory High School Liberia', 'DEMO001', 'admin@victoryhighschool.lr', '+231777000000', 'Monrovia, Liberia', 1)
      `).run(instId);
      institution = { id: instId };
    }

    // Create admin user
    console.log('Creating admin user...');
    const userId = uuidv4();
    const hashedPassword = bcrypt.hashSync('admin123', 10);

    db.prepare(`
      INSERT INTO users (id, username, password, email, first_name, last_name, role_id, user_type, institution_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      userId,
      'admin',
      hashedPassword,
      'admin@victoryhighschool.lr',
      'System',
      'Administrator',
      platformAdminRole.id,
      'platform_admin',
      institution.id
    );

    console.log('✓ Admin user created successfully');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Email: admin@victoryhighschool.lr');

  } catch (error) {
    console.error('Error ensuring admin user:', error);
  }
}
