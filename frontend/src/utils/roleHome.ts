/** Resolve post-login / home dashboard path from user type + merged role codes */
export function getRoleHomePath(user: {
  user_type?: string;
  role?: { code?: string; name?: string; display_name?: string };
  role_codes?: string[];
  roles?: Array<{ code?: string | null }>;
} | null | undefined): string {
  if (!user) return '/login';

  const type = user.user_type || '';
  const codes = getMergedRoleCodes(user);

  if (type === 'platform_admin') return '/platform-admin';
  if (type === 'institution_admin' || type === 'branch_admin' || codes.includes('institution_admin') || codes.includes('branch_admin')) {
    return '/dashboard';
  }
  if (codes.some((c) => ['accountant', 'finance_officer', 'finance'].includes(c))) {
    return '/finance/dashboard';
  }
  if (codes.some((c) => ['registrar', 'admission_officer', 'admission'].includes(c))) {
    return '/admission';
  }
  if (type === 'teacher' || codes.includes('teacher')) return '/teacher/dashboard';
  if (type === 'staff' || codes.some((c) => ['staff', 'receptionist', 'librarian', 'hr_manager'].includes(c))) {
    return '/staff/dashboard';
  }
  if (type === 'parent' || codes.includes('parent')) return '/parent/dashboard';
  if (type === 'student' || codes.includes('student')) return '/student/dashboard';

  return '/dashboard';
}

export function getRoleCode(user: { role?: { code?: string } } | null | undefined): string {
  return (user?.role?.code || '').toLowerCase();
}

export function getMergedRoleCodes(user: {
  role?: { code?: string };
  role_codes?: string[];
  roles?: Array<{ code?: string | null }>;
} | null | undefined): string[] {
  const codes = [
    (user?.role?.code || '').toLowerCase(),
    ...(user?.role_codes || []).map((c) => c.toLowerCase()),
    ...(user?.roles || []).map((r) => (r.code || '').toLowerCase()),
  ].filter(Boolean);
  return Array.from(new Set(codes));
}

export function isFinanceRole(user: {
  user_type?: string;
  role?: { code?: string };
  role_codes?: string[];
  roles?: Array<{ code?: string | null }>;
} | null | undefined): boolean {
  return getMergedRoleCodes(user).some((c) =>
    ['accountant', 'finance_officer', 'finance'].includes(c)
  );
}

export function isRegistrarRole(user: {
  user_type?: string;
  role?: { code?: string };
  role_codes?: string[];
  roles?: Array<{ code?: string | null }>;
} | null | undefined): boolean {
  return getMergedRoleCodes(user).some((c) =>
    ['registrar', 'admission_officer', 'admission'].includes(c)
  );
}
