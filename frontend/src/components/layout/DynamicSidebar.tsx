import { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, Building2,
  BookOpen, Settings, X, ClipboardCheck, ClipboardList,
  DollarSign, Library, Package, Bus, Award, Briefcase,
  Send, BarChart3, Shield, CheckSquare,
  TrendingUp, UserCheck, BookMarked, Calendar,
  ChevronDown, ChevronRight, Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBrand } from '../../contexts/BrandContext';
import { getRoleHomePath, isFinanceRole, isRegistrarRole } from '../../utils/roleHome';
import api from '../../utils/api';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface MenuItem {
  name: string;
  href?: string;
  icon: any;
  permission?: string;
  children?: { name: string; href: string; permission?: string }[];
  userTypes?: string[];
  roleCodes?: string[];
  excludeRoleCodes?: string[];
}

function buildNavigation(homePath: string): MenuItem[] {
  return [
    {
      name: 'Dashboard',
      href: homePath,
      icon: LayoutDashboard,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'student', 'parent', 'staff', 'branch_admin'],
    },
    {
      name: 'Platform Admin',
      icon: Shield,
      userTypes: ['platform_admin'],
      children: [
        { name: 'Dashboard', href: '/platform-admin' },
        { name: 'Institutions', href: '/platform-admin/institutions' },
        { name: 'License Keys', href: '/platform-admin/licenses' },
        { name: 'Activations', href: '/platform-admin/activations' },
        { name: 'Users', href: '/platform-admin/users' },
      ],
    },
    {
      name: 'Finance',
      icon: DollarSign,
      roleCodes: ['accountant', 'finance_officer', 'finance'],
      children: [
        { name: 'Dashboard', href: '/finance/dashboard' },
        { name: 'Fee Setup', href: '/fees' },
        { name: 'Invoices', href: '/fees/invoices' },
        { name: 'Payments', href: '/fees/payments' },
        { name: 'Accounts', href: '/accounts' },
        { name: 'Reports', href: '/reports' },
      ],
    },
    {
      name: 'Admission',
      icon: ClipboardCheck,
      roleCodes: ['registrar', 'admission_officer', 'admission'],
      children: [
        { name: 'Dashboard', href: '/admission' },
        { name: 'Enquiries', href: '/admission/enquiries' },
        { name: 'Applications', href: '/admission/applications' },
        { name: 'New Student', href: '/students/new' },
        { name: 'Students', href: '/students' },
      ],
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: Package,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
    },
    {
      name: 'Branch',
      href: '/branches',
      icon: Building2,
      userTypes: ['platform_admin', 'institution_admin'],
    },
    {
      name: 'Reception',
      href: '/reception',
      icon: Users,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
    },
    {
      name: 'Admission',
      icon: ClipboardCheck,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
      children: [
        { name: 'Dashboard', href: '/admission' },
        { name: 'Enquiries', href: '/admission/enquiries' },
        { name: 'Applications', href: '/admission/applications' },
        { name: 'New Student', href: '/students/new' },
      ],
    },
    {
      name: 'Student Details',
      href: '/students',
      icon: GraduationCap,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance'],
    },
    {
      name: 'Parents',
      href: '/parents',
      icon: Users,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance'],
    },
    {
      name: 'Employee',
      icon: Briefcase,
      userTypes: ['platform_admin', 'institution_admin'],
      children: [
        { name: 'Teachers', href: '/teachers' },
        { name: 'Payroll', href: '/payroll' },
      ],
    },
    {
      name: 'Academics',
      icon: BookOpen,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
      children: [
        { name: 'Sessions', href: '/academics/sessions' },
        { name: 'Classes', href: '/academics/classes' },
        { name: 'Subjects', href: '/academics/subjects' },
        { name: 'Timetable', href: '/timetable' },
      ],
    },
    {
      name: 'Attendance',
      href: '/attendance',
      icon: Calendar,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance'],
    },
    {
      name: 'Examinations',
      href: '/examinations',
      icon: ClipboardList,
      userTypes: ['platform_admin', 'institution_admin', 'teacher'],
    },
    {
      name: 'Assignments',
      href: '/assignments',
      icon: CheckSquare,
      userTypes: ['platform_admin', 'institution_admin', 'teacher'],
    },
    {
      name: 'Finance',
      icon: DollarSign,
      permission: 'fees.view',
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
      children: [
        { name: 'Fee Setup', href: '/fees', permission: 'fees.create' },
        { name: 'Invoices', href: '/fees/invoices', permission: 'fees.view' },
        { name: 'Payments', href: '/fees/payments', permission: 'fees.collect' },
        { name: 'Accounts', href: '/accounts', permission: 'accounts.view' },
      ],
    },
    {
      name: 'Library',
      href: '/library',
      icon: Library,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
    },
    {
      name: 'Transport',
      href: '/transport',
      icon: Bus,
      userTypes: ['platform_admin', 'institution_admin', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance', 'registrar', 'admission_officer'],
    },
    {
      name: 'Communication',
      href: '/communication',
      icon: Send,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
    },
    {
      name: 'Certificate',
      href: '/certificates',
      icon: Award,
      userTypes: ['platform_admin', 'institution_admin'],
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
      userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
      excludeRoleCodes: ['accountant', 'finance_officer', 'finance'],
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      userTypes: ['platform_admin', 'institution_admin'],
    },
    {
      name: 'Roles & Permissions',
      href: '/permissions/roles',
      icon: Shield,
      userTypes: ['platform_admin', 'institution_admin'],
    },
    { name: 'My Classes', href: '/teacher/classes', icon: BookMarked, userTypes: ['teacher'] },
    { name: 'My Students', href: '/teacher/students', icon: UserCheck, userTypes: ['teacher'] },
    { name: 'My Grades', href: '/student/grades', icon: TrendingUp, userTypes: ['student'] },
    { name: 'My Assignments', href: '/student/assignments', icon: CheckSquare, userTypes: ['student'] },
    { name: 'My Attendance', href: '/student/attendance', icon: Calendar, userTypes: ['student'] },
    { name: 'My Children', href: '/parent/children', icon: Users, userTypes: ['parent'] },
  ];
}

export default function DynamicSidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { branding } = useBrand();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const homePath = getRoleHomePath(user);
  const roleCode = (user?.role?.code || '').toLowerCase();
  const navigation = useMemo(() => buildNavigation(homePath), [homePath]);

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/permissions/my-permissions');
      setPermissions(response.data.permissions || []);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    if (!user) return false;
    if (user.user_type === 'platform_admin' || user.user_type === 'institution_admin') return true;
    if (permissions.includes(permission)) return true;
    // soft match: module.* style
    const module = permission.split('.')[0];
    return permissions.some((p) => p === `${module}.*` || p.startsWith(`${module}.`));
  };

  const shouldShowItem = (item: MenuItem): boolean => {
    if (!user) return false;

    if (item.excludeRoleCodes?.includes(roleCode)) return false;

    if (item.roleCodes?.length) {
      return item.roleCodes.includes(roleCode) && hasPermission(item.permission);
    }

    if (item.userTypes?.length && !item.userTypes.includes(user.user_type)) {
      // Finance/registrar staff may have user_type staff but role-specific menus already handled
      return false;
    }

    return hasPermission(item.permission);
  };

  const filteredNavigation = useMemo(() => {
    const q = search.trim().toLowerCase();
    return navigation
      .filter(shouldShowItem)
      .map((item) => {
        if (!item.children) return item;
        const children = item.children.filter((child) => hasPermission(child.permission));
        return { ...item, children };
      })
      .filter((item) => !item.children || item.children.length > 0)
      .filter((item) => {
        if (!q) return true;
        if (item.name.toLowerCase().includes(q)) return true;
        return item.children?.some((c) => c.name.toLowerCase().includes(q));
      });
  }, [navigation, permissions, user, roleCode, search]);

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  if (!open) return null;

  const brandName = branding?.institution_name || 'SVL-SMS';
  const brandLetter = brandName.charAt(0).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          {branding?.logo ? (
            <img src={branding.logo} alt="" className="w-8 h-8 rounded object-contain shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <span className="text-white text-xs font-bold">{brandLetter}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-gray-900 tracking-wide truncate">{brandName}</h1>
            <p className="text-[9px] text-gray-500 truncate">
              {isFinanceRole(user) ? 'Finance Portal' : isRegistrarRole(user) ? 'Admissions Portal' : 'School Management'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="px-3 py-3 border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Main</p>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading menu...</div>
        ) : filteredNavigation.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No menu items available</div>
        ) : (
          filteredNavigation.map((item) => (
            <div key={`${item.name}-${item.href || 'group'}`}>
              {item.href ? (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-[3px] ${
                      isActive
                        ? 'bg-[rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary)] border-[var(--brand-accent)] font-medium'
                        : 'text-gray-700 hover:bg-gray-50 border-transparent'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ) : (
                <div>
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-l-[3px] border-transparent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {expandedItems.includes(item.name) ? (
                      <ChevronDown size={14} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400" />
                    )}
                  </button>
                  {expandedItems.includes(item.name) &&
                    item.children?.map((child) => (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-11 pr-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'text-[var(--brand-primary)] bg-[rgba(var(--brand-primary-rgb),0.08)] font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                        {child.name}
                      </NavLink>
                    ))}
                </div>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 text-center">&copy; 2026 Softwarevala Liberia</p>
      </div>
    </aside>
  );
}
