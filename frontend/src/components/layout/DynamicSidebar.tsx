import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, UserCircle, Building2,
  BookOpen, Settings, X, ClipboardCheck, Clock, ClipboardList,
  DollarSign, Library, Package, Bus, Award, Briefcase,
  Send, BarChart3, Shield, CheckSquare, KeyRound,
  TrendingUp, UserCheck, BookMarked, Calendar,
  ChevronDown, ChevronRight, Search
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

const ALL_NAVIGATION: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'student', 'parent', 'staff']
  },
  {
    name: 'Platform Admin',
    icon: Shield,
    userTypes: ['platform_admin'],
    children: [
      { name: 'Dashboard', href: '/platform-admin' },
      { name: 'Institutions', href: '/platform-admin/institutions' },
      { name: 'License Keys', href: '/platform-admin/licenses' },
      { name: 'Users', href: '/platform-admin/users' },
    ],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },
  {
    name: 'Branch',
    href: '/branches',
    icon: Building2,
    permission: 'settings.view',
    userTypes: ['platform_admin', 'institution_admin']
  },
  {
    name: 'Reception',
    href: '/reception',
    icon: Users,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },
  {
    name: 'Admission',
    icon: ClipboardCheck,
    permission: 'students.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff'],
    children: [
      { name: 'New Admission', href: '/students/new', permission: 'students.create' },
      { name: 'All Applications', href: '/admission/applications', permission: 'students.view' },
    ]
  },
  {
    name: 'Student Details',
    href: '/students',
    icon: GraduationCap,
    permission: 'students.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },
  {
    name: 'Parents',
    href: '/parents',
    icon: Users,
    permission: 'students.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },
  {
    name: 'Employee',
    icon: Briefcase,
    permission: 'users.view',
    userTypes: ['platform_admin', 'institution_admin'],
    children: [
      { name: 'Teachers', href: '/teachers', permission: 'teachers.view' },
      { name: 'Payroll', href: '/payroll', permission: 'users.view' },
    ]
  },
  {
    name: 'Academics',
    icon: BookOpen,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff'],
    children: [
      { name: 'Sessions', href: '/academics/sessions', permission: 'settings.view' },
      { name: 'Classes', href: '/academics/classes', permission: 'dashboard.view' },
      { name: 'Subjects', href: '/academics/subjects', permission: 'dashboard.view' },
      { name: 'Timetable', href: '/timetable', permission: 'timetable.view' },
    ]
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: Calendar,
    permission: 'attendance.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },
  {
    name: 'Examinations',
    href: '/examinations',
    icon: ClipboardList,
    permission: 'exams.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher']
  },
  {
    name: 'Assignments',
    href: '/assignments',
    icon: CheckSquare,
    permission: 'assignments.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher']
  },
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
  {
    name: 'Library',
    href: '/library',
    icon: Library,
    permission: 'library.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },
  {
    name: 'Transport',
    href: '/transport',
    icon: Bus,
    permission: 'transport.view',
    userTypes: ['platform_admin', 'institution_admin', 'staff']
  },
  {
    name: 'Communication',
    href: '/communication',
    icon: Send,
    permission: 'communication.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },
  {
    name: 'Certificate',
    href: '/certificates',
    icon: Award,
    permission: 'dashboard.view',
    userTypes: ['platform_admin', 'institution_admin']
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'reports.view',
    userTypes: ['platform_admin', 'institution_admin', 'teacher', 'staff']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings.view',
    userTypes: ['platform_admin', 'institution_admin']
  },
  {
    name: 'Roles & Permissions',
    href: '/permissions/roles',
    icon: Shield,
    permission: 'roles.view',
    userTypes: ['platform_admin', 'institution_admin']
  },
  // Teacher-specific
  {
    name: 'My Classes',
    href: '/teacher/classes',
    icon: BookMarked,
    userTypes: ['teacher']
  },
  {
    name: 'My Students',
    href: '/teacher/students',
    icon: UserCheck,
    userTypes: ['teacher']
  },
  // Student-specific
  {
    name: 'My Grades',
    href: '/student/grades',
    icon: TrendingUp,
    userTypes: ['student']
  },
  {
    name: 'My Assignments',
    href: '/student/assignments',
    icon: CheckSquare,
    userTypes: ['student']
  },
  {
    name: 'My Attendance',
    href: '/student/attendance',
    icon: Calendar,
    userTypes: ['student']
  },
  // Parent-specific
  {
    name: 'My Children',
    href: '/parent/children',
    icon: Users,
    userTypes: ['parent']
  },
];

export default function DynamicSidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const filteredNavigation = ALL_NAVIGATION.filter(item => {
    if (!shouldShowItem(item)) return false;
    if (item.children) {
      item.children = item.children.filter(child => hasPermission(child.permission));
      return item.children.length > 0;
    }
    return true;
  });

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30 shadow-sm">
      {/* Logo / Brand */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <div>
            <h1 className="text-xs font-bold text-gray-900 tracking-wide">SVL-SMS</h1>
            <p className="text-[9px] text-gray-500">School Management</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Section Label */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Main</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            Loading menu...
          </div>
        ) : filteredNavigation.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No menu items available
          </div>
        ) : (
          filteredNavigation.map((item) => (
            <div key={item.name}>
              {item.href ? (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-3 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-l-[3px] border-yellow-400 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 border-l-[3px] border-transparent'
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
                  {expandedItems.includes(item.name) && item.children?.map((child) => (
                    <NavLink
                      key={child.href}
                      to={child.href}
                      className={({ isActive }) =>
                        `flex items-center gap-3 pl-11 pr-4 py-2 text-sm transition-colors ${
                          isActive
                            ? 'text-blue-700 bg-blue-50 font-medium'
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

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 text-center">
          &copy; 2026 Softwarevala Liberia
        </p>
      </div>
    </aside>
  );
}
