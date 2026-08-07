import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Users,
  UserCheck,
  Eye,
  Pencil,
  Trash2,
  KeyRound,
  RefreshCw,
  X,
  Shield,
} from 'lucide-react';
import api from '../../utils/api';

interface InstitutionOption {
  id: string;
  institution_code: string;
  institution_name: string;
}

interface PlatformUser {
  id: string;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  user_type: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
  institution_id: string | null;
  institution_name: string | null;
  institution_code: string | null;
  role_id: string | null;
  role_code: string | null;
  role_name: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
}

const USER_TYPE_OPTIONS = [
  { value: 'institution_admin', label: 'Institution Admin' },
  { value: 'branch_admin', label: 'Branch Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'parent', label: 'Parent' },
  { value: 'student', label: 'Student' },
  { value: 'platform_admin', label: 'Platform Admin' },
];

const USER_TYPE_BADGES: Record<string, string> = {
  platform_admin: 'bg-purple-100 text-purple-800',
  institution_admin: 'bg-blue-100 text-blue-800',
  branch_admin: 'bg-cyan-100 text-cyan-800',
  staff: 'bg-gray-100 text-gray-800',
  teacher: 'bg-green-100 text-green-800',
  parent: 'bg-yellow-100 text-yellow-800',
  student: 'bg-indigo-100 text-indigo-800',
};

const USER_TYPE_LABELS: Record<string, string> = {
  platform_admin: 'Platform Admin',
  institution_admin: 'Institution Admin',
  branch_admin: 'Branch Admin',
  staff: 'Staff',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
};

export default function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [viewUser, setViewUser] = useState<PlatformUser | null>(null);
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [search, userTypeFilter, institutionFilter, statusFilter, page]);

  const fetchInstitutions = async () => {
    try {
      const res = await api.get('/platform-admin/institutions/list');
      setInstitutions(res.data || []);
    } catch (error) {
      console.error('Failed to load institutions', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/platform-admin/users', {
        params: {
          page,
          limit,
          search: search || undefined,
          user_type: userTypeFilter || undefined,
          institution_id: institutionFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      setUsers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      console.error('Failed to load users', error);
      toast.error(error.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: PlatformUser) => {
    if (user.user_type === 'platform_admin' && user.username === 'superadmin') {
      toast.error('The superadmin account cannot be deactivated');
      return;
    }
    const ok = window.confirm(
      `Deactivate user "${user.first_name} ${user.last_name}" (${user.username})? They will no longer be able to log in.`
    );
    if (!ok) return;

    try {
      await api.delete(`/platform-admin/users/${user.id}`);
      toast.success('User deactivated');
      if (viewUser?.id === user.id) setViewUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setResetting(true);
      await api.post(`/platform-admin/users/${resetTarget.id}/reset-password`, {
        new_password: newPassword,
      });
      toast.success('Password reset successfully');
      setResetTarget(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const statusClass = (active: number) =>
    active
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';

  const userTypeBadge = (type: string) => USER_TYPE_BADGES[type] || 'bg-gray-100 text-gray-800';

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all users across all institutions — students, parents, teachers, staff and more
          </p>
        </div>
        <Link
          to="/platform-admin/users/new"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, username or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <select
            value={userTypeFilter}
            onChange={(e) => { setUserTypeFilter(e.target.value); setPage(1); }}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">All user types</option>
            {USER_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={institutionFilter}
            onChange={(e) => { setInstitutionFilter(e.target.value); setPage(1); }}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">All institutions</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.institution_name} ({inst.institution_code})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="button"
              onClick={fetchUsers}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    <Users className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    No users found. Try adjusting your filters or add a new user.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          {user.user_type === 'platform_admin' ? (
                            <Shield size={16} className="text-purple-600" />
                          ) : (
                            <UserCheck size={16} className="text-primary-600" />
                          )}
                        </div>
                        <div className="ml-3 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            @{user.username}
                            {user.email ? ` · ${user.email}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${userTypeBadge(user.user_type)}`}>
                        {USER_TYPE_LABELS[user.user_type] || user.user_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium">{user.institution_name || 'Platform'}</div>
                      {user.institution_code && (
                        <div className="text-xs text-gray-400">{user.institution_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user.role_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(user.is_active)}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setViewUser(user)}
                        className="inline-flex items-center text-gray-500 hover:text-gray-700 text-sm mr-3"
                        title="View"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                      <Link
                        to={`/platform-admin/users/${user.id}/edit`}
                        className="inline-flex items-center text-primary-600 hover:text-primary-800 text-sm mr-3"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setResetTarget(user)}
                        className="inline-flex items-center text-yellow-600 hover:text-yellow-800 text-sm mr-3"
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Reset
                      </button>
                      <button
                        type="button"
                        disabled={user.user_type === 'platform_admin' && user.username === 'superadmin'}
                        onClick={() => handleDelete(user)}
                        className="inline-flex items-center text-red-600 hover:text-red-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Deactivate"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> users
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page * limit >= total}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">User Details</h3>
              <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{viewUser.first_name} {viewUser.last_name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Username</span>
                <span className="font-medium text-gray-900">@{viewUser.username}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{viewUser.email || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-900">{viewUser.phone || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Type</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${userTypeBadge(viewUser.user_type)}`}>
                  {USER_TYPE_LABELS[viewUser.user_type] || viewUser.user_type}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Institution</span>
                <span className="font-medium text-gray-900">{viewUser.institution_name || 'Platform'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Role</span>
                <span className="font-medium text-gray-900">{viewUser.role_name || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(viewUser.is_active)}`}>
                  {viewUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Last Login</span>
                <span className="font-medium text-gray-900">{formatDate(viewUser.last_login)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium text-gray-900">{formatDate(viewUser.created_at)}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setViewUser(null); setResetTarget(viewUser); }}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-600"
              >
                Reset Password
              </button>
              <Link
                to={`/platform-admin/users/${viewUser.id}/edit`}
                className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 text-center"
              >
                Edit User
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-sm shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Reset Password</h3>
              <button onClick={() => { setResetTarget(null); setNewPassword(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set a new password for <span className="font-medium">{resetTarget.first_name} {resetTarget.last_name}</span> (@{resetTarget.username}).
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                autoFocus
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setResetTarget(null); setNewPassword(''); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
