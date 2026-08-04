-- Fix Admin User for Production

-- Check current admin
SELECT 'Current admin user:' as info;
SELECT u.username, u.email, u.user_type, r.code as role_code, r.name as role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.username = 'admin';

-- Ensure platform_admin role exists
INSERT OR IGNORE INTO roles (id, code, name, description, level)
VALUES ('platform-admin-role-id', 'platform_admin', 'Platform Administrator', 'Full system access', 1);

-- Update admin user to have platform_admin role
UPDATE users
SET user_type = 'platform_admin',
    role_id = (SELECT id FROM roles WHERE code = 'platform_admin' LIMIT 1)
WHERE username = 'admin';

-- Verify the fix
SELECT 'After fix:' as info;
SELECT u.username, u.email, u.user_type, r.code as role_code, r.name as role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.username = 'admin';
