import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, UserCircle, Building2,
  BookOpen, Settings, X, ClipboardCheck, Clock, ClipboardList,
  DollarSign, Library, Package, Bus, Award, Briefcase,
  Send, BarChart3, Shield, CheckSquare,
  TrendingUp, UserCheck, BookMarked, Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
}

// Complete navigation structure with permissions
const ALL_NAVIGATION: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'student', 'parent', 'staff']
  },

  // Platform Admin Only
  {
    name: 'Platform Admin',
    href: '/platform-admin',
    icon: Shield,
    userTypes: ['platform_admin']
  },

  // Students
  {
    name: 'Students',
    href: '/students',
    icon: GraduationCap,
    permission: 'students.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },

  // Parents
  {
    name: 'Parents',
    href: '/parents',
    icon: Users,
    permission: 'students.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },

  // Teachers
  {
    name: 'Teachers',
    href: '/teachers',
    icon: UserCircle,
    permission: 'teachers.view',
    userTypes: ['platform_admin', 'institution_admin']
  },

  // Teacher-specific: My Classes
  {
    name: 'My Classes',
    href: '/teacher/classes',
    icon: BookMarked,
    userTypes: ['teacher']
  },

  // Teacher-specific: My Students
  {
    name: 'My Students',
    href: '/teacher/students',
    icon: UserCheck,
    userTypes: ['teacher']
  },

  // Student-specific: My Grades
  {
    name: 'My Grades',
    href: '/student/grades',
    icon: TrendingUp,
    userTypes: ['student']
  },

  // Student-specific: My Assignments
  {
    name: 'My Assignments',
    href: '/student/assignments',
    icon: CheckSquare,
    userTypes: ['student']
  },

  // Parent-specific: My Children
  {
    name: 'My Children',
    href: '/parent/children',
    icon: Users,
    userTypes: ['parent']
  },

  // Academics
  {
    name: 'Academics',
    icon: BookOpen,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
    children: [
      { name: 'Sessions', href: '/academics/sessions', permission: 'settings.view' },
      { name: 'Classes', href: '/academics/classes', permission: 'dashboard.view' },
      { name: 'Subjects', href: '/academics/subjects', permission: 'dashboard.view' },
    ]
  },

  // Attendance
  {
    name: 'Attendance',
    href: '/attendance',
    icon: ClipboardCheck,
    permission: 'attendance.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },

  // Student Attendance View
  {
    name: 'My Attendance',
    href: '/student/attendance',
    icon: Calendar,
    userTypes: ['student']
  },

  // Assignments (for admins/teachers)
  {
    name: 'Assignments',
    href: '/assignments',
    icon: CheckSquare,
    permission: 'assignments.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher']
  },

  // Timetable
  {
    name: 'Timetable',
    href: '/timetable',
    icon: Clock,
    permission: 'timetable.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'student', 'staff']
  },

  // Examinations
  {
    name: 'Examinations',
    href: '/examinations',
    icon: ClipboardList,
    permission: 'exams.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher']
  },

  // Grades & Results
  {
    name: 'Grades & Results',
    icon: Award,
    permission: 'grades.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher'],
    children: [
      { name: 'Mark Entry', href: '/marks', permission: 'marks.enter' },
      { name: 'Grade Approval', href: '/grades/approval', permission: 'grades.approve' },
      { name: 'Results', href: '/results', permission: 'results.view' },
    ]
  },

  // Finance
  {
    name: 'Finance',
    icon: DollarSign,
    permission: 'fees.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff'],
    children: [
      { name: 'Fee Setup', href: '/fees', permission: 'fees.create' },
      { name: 'Invoices', href: '/fees/invoices', permission: 'fees.view' },
      { name: 'Payments', href: '/fees/payments', permission: 'fees.collect' },
      { name: 'Accounts', href: '/accounts', permission: 'accounts.view' },
    ]
  },

  // Library
  {
    name: 'Library',
    href: '/library',
    icon: Library,
    permission: 'library.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },

  // Inventory
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },

  // Transport
  {
    name: 'Transport',
    href: '/transport',
    icon: Bus,
    permission: 'transport.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },

  // HR & Payroll
  {
    name: 'HR & Payroll',
    href: '/payroll',
    icon: Briefcase,
    permission: 'users.view',
    userTypes: ['platform_admin', 'institution_admin']
  },

  // Communication
  {
    name: 'Communication',
    href: '/communication',
    icon: Send,
    permission: 'communication.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },

  // Reports
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'reports.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },

  // Branches
  {
    name: 'Branches',
    href: '/branches',
    icon: Building2,
    permission: 'settings.view',
    userTypes: ['platform_admin', 'institution_admin']
  },

  // Settings
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings.view',
    userTypes: ['platform_admin', 'institution_admin']
  },

  // Roles & Permissions
  {
    name: 'Roles & Permissions',
    href: '/permissions/roles',
    icon: Shield,
    permission: 'roles.view',
    userTypes: ['platform_admin', 'institution_admin']
  },
];

export default function DynamicSidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/permissions/my-permissions');
      setPermissions(response.data.permissions || []);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    if (!user) return false;

    // Platform admins and institution admins have all permissions
    if (user.user_type === 'platform_admin' || user.user_type === 'institution_admin') {
      return true;
    }

    return permissions.includes(permission);
  };

  const hasUserType = (userTypes?: string[]): boolean => {
    if (!userTypes || userTypes.length === 0) return true;
    if (!user) return false;
    return userTypes.includes(user.user_type);
  };

  const shouldShowItem = (item: MenuItem): boolean => {
    return hasUserType(item.userTypes) && hasPermission(item.permission);
  };

  const filteredNavigation = ALL_NAVIGATION.filter(item => {
    if (!shouldShowItem(item)) return false;

    // If item has children, filter them too
    if (item.children) {
      item.children = item.children.filter(child =>
        hasPermission(child.permission)
      );
      // Don't show parent if no children are visible
      return item.children.length > 0;
    }

    return true;
  });

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-primary-900 text-white flex flex-col z-30">
      <div className="flex items-center justify-between h-16 px-4 border-b border-primary-800">
        <div>
          <h1 className="text-sm font-bold tracking-wide">SOFTWAREVALA LIBERIA</h1>
          <p className="text-[10px] text-primary-300 tracking-wider">SCHOOL MANAGEMENT SYSTEM</p>
        </div>
        <button onClick={onClose} className="lg:hidden text-primary-300 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-4 py-3 bg-primary-800 border-b border-primary-700">
          <p className="text-sm font-medium text-white">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-primary-300 capitalize">
            {user.user_type?.replace('_', ' ')}
          </p>
        </div>
      )}

      <nav className="flex-1 py-4 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-primary-300 text-sm">
            Loading menu...
          </div>
        ) : filteredNavigation.length === 0 ? (
          <div className="px-4 py-8 text-center text-primary-300 text-sm">
            No menu items available
          </div>
        ) : (
          filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.href ? (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-800 text-white border-r-4 border-white'
                        : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.name}
                </NavLink>
              ) : (
                <div>
                  <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary-300 font-medium uppercase tracking-wider mt-4">
                    <item.icon size={18} />
                    {item.name}
                  </div>
                  {item.children?.map((child) => (
                    <NavLink
                      key={child.href}
                      to={child.href}
                      className={({ isActive }) =>
                        `flex items-center gap-3 pl-11 pr-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-primary-800 text-white'
                            : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                        }`
                      }
                    >
                      {child.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="p-4 border-t border-primary-800">
        <p className="text-[10px] text-primary-400 text-center">
          &copy; 2026 Softwarevala Liberia
        </p>
      </div>
    </aside>
  );
}
