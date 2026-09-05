/** Resolve post-login / home dashboard path from user type + role code */
export function getRoleHomePath(user: {
  user_type?: string;
  role?: { code?: string; name?: string; display_name?: string };
} | null | undefined): string {
  if (!user) return '/login';
  if (user.user_type === 'platform_admin') return '/platform-admin';

  const roleCode = (user.role?.code || '').toLowerCase();

  if (user.user_type === 'teacher' || roleCode === 'teacher') return '/teacher/dashboard';
  if (user.user_type === 'student') return '/student/dashboard';
  if (user.user_type === 'parent') return '/parent/dashboard';

  if (['accountant', 'finance_officer', 'finance'].includes(roleCode)) {
    return '/finance/dashboard';
  }
  if (['registrar', 'admission_officer', 'admission'].includes(roleCode)) {
    return '/admission';
  }
  if (user.user_type === 'staff' || ['staff', 'receptionist', 'librarian', 'hr_manager'].includes(roleCode)) {
    return '/staff/dashboard';
  }

  // institution_admin, branch_admin, principal
  return '/dashboard';
}

export function getRoleCode(user: { role?: { code?: string } } | null | undefined): string {
  return (user?.role?.code || '').toLowerCase();
}

export function isFinanceRole(user: { user_type?: string; role?: { code?: string } } | null | undefined): boolean {
  return ['accountant', 'finance_officer', 'finance'].includes(getRoleCode(user));
}

export function isRegistrarRole(user: { user_type?: string; role?: { code?: string } } | null | undefined): boolean {
  return ['registrar', 'admission_officer', 'admission'].includes(getRoleCode(user));
}
