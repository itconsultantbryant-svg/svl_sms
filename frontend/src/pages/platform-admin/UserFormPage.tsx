import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, UserPlus, Save, Loader2 } from 'lucide-react';
import api from '../../utils/api';

interface InstitutionOption {
  id: string;
  institution_code: string;
  institution_name: string;
}

interface RoleOption {
  id: string;
  role_code: string;
  role_name: string;
  role_level: string;
  is_platform_role: number;
}

interface EntityOption {
  id: string;
  label: string;
  sub: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  user_type: string;
  institution_id: string;
  role_id: string;
  branch_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  is_active: boolean;
}

const USER_TYPES = [
  { value: 'institution_admin', label: 'Institution Admin', description: 'Full control over an institution' },
  { value: 'branch_admin', label: 'Branch Admin', description: 'Administrator of a single branch' },
  { value: 'staff', label: 'Staff', description: 'General staff / support personnel' },
  { value: 'teacher', label: 'Teacher', description: 'Teaching staff' },
  { value: 'parent', label: 'Parent', description: 'Parent / guardian' },
  { value: 'student', label: 'Student', description: 'Student account' },
  { value: 'platform_admin', label: 'Platform Admin', description: 'Superadmin — full system access (rare)' },
];

const emptyForm: UserFormData = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  user_type: 'institution_admin',
  institution_id: '',
  role_id: '',
  branch_id: '',
  linked_entity_type: '',
  linked_entity_id: '',
  is_active: true,
};

export default function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string; email: string | null } | null>(null);

  const isPlatformType = form.user_type === 'platform_admin';

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    if (isEdit && id) fetchUser();
  }, [id, isEdit]);

  useEffect(() => {
    if (form.institution_id) fetchRoles(form.institution_id);
    else if (isPlatformType) fetchPlatformRoles();
  }, [form.institution_id, isPlatformType]);

  useEffect(() => {
    if (isEdit) return;
    // Reset linked entity when type changes
    setForm((f) => ({ ...f, linked_entity_type: '', linked_entity_id: '' }));
    if (form.user_type !== 'platform_admin' && form.institution_id) {
      fetchEntities(form.user_type, form.institution_id);
    } else {
      setEntities([]);
    }
  }, [form.user_type, form.institution_id, isEdit]);

  const fetchInstitutions = async () => {
    try {
      const res = await api.get('/platform-admin/institutions/list');
      setInstitutions(res.data || []);
    } catch (error) {
      console.error('Failed to load institutions', error);
    }
  };

  const fetchRoles = async (institutionId: string) => {
    try {
      const res = await api.get('/platform-admin/roles/list', {
        params: { institution_id: institutionId },
      });
      setRoles(res.data || []);
    } catch (error) {
      console.error('Failed to load roles', error);
      setRoles([]);
    }
  };

  const fetchPlatformRoles = async () => {
    try {
      const res = await api.get('/platform-admin/roles/list');
      const platformRoles = (res.data || []).filter((r: RoleOption) => r.is_platform_role);
      setRoles(platformRoles);
    } catch (error) {
      console.error('Failed to load platform roles', error);
      setRoles([]);
    }
  };

  const fetchEntities = async (userType: string, institutionId: string) => {
    setLoadingEntities(true);
    setEntities([]);
    try {
      // Pass X-Institution-ID to scope results to the form's selected institution
      const tenantHeaders = { 'X-Institution-ID': institutionId };
      if (userType === 'student') {
        const res = await api.get('/students', { params: { limit: 100 }, headers: tenantHeaders });
        const list = (res.data.data || []).map((s: any) => ({
          id: s.id,
          label: `${s.first_name} ${s.last_name}`,
          sub: s.admission_number ? `Adm: ${s.admission_number}` : '',
        }));
        setEntities(list);
        setForm((f) => ({ ...f, linked_entity_type: 'student' }));
      } else if (userType === 'parent') {
        const res = await api.get('/parents', { params: { limit: 100 }, headers: tenantHeaders });
        const list = (res.data.data || []).map((p: any) => ({
          id: p.id,
          label: `${p.first_name} ${p.last_name}`,
          sub: p.phone || p.email || '',
        }));
        setEntities(list);
        setForm((f) => ({ ...f, linked_entity_type: 'parent' }));
      } else if (userType === 'teacher' || userType === 'staff') {
        const res = await api.get('/teachers', { params: { limit: 100 }, headers: tenantHeaders });
        const list = (res.data.data || []).map((e: any) => ({
          id: e.id,
          label: `${e.first_name} ${e.last_name}`,
          sub: e.employee_id || e.designation_name || '',
        }));
        setEntities(list);
        setForm((f) => ({ ...f, linked_entity_type: 'employee' }));
      } else {
        setEntities([]);
      }
    } catch (error) {
      console.error('Failed to load linked entities', error);
      setEntities([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/platform-admin/users/${id}`);
      const u = res.data;
      setForm({
        username: u.username || '',
        email: u.email || '',
        password: '',
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        phone: u.phone || '',
        user_type: u.user_type || 'institution_admin',
        institution_id: u.institution_id || '',
        role_id: u.role_id || '',
        branch_id: u.branch_id || '',
        linked_entity_type: u.linked_entity_type || '',
        linked_entity_id: u.linked_entity_id || '',
        is_active: !!u.is_active,
      });
      // Load roles for the user's institution
      if (u.institution_id) {
        fetchRoles(u.institution_id);
      } else if (u.user_type === 'platform_admin') {
        fetchPlatformRoles();
      }
    } catch (error: any) {
      console.error('Failed to load user', error);
      toast.error(error.response?.data?.error || 'Failed to load user');
      navigate('/platform-admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.username) {
      toast.error('First name, last name and username are required');
      return;
    }
    if (!isPlatformType && !form.institution_id) {
      toast.error('Select an institution');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for a new user');
      return;
    }
    if (!isEdit && form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/platform-admin/users/${id}`, {
          username: form.username,
          email: form.email || null,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
          user_type: form.user_type,
          institution_id: isPlatformType ? null : form.institution_id,
          role_id: form.role_id || undefined,
          branch_id: form.branch_id || null,
          is_active: form.is_active,
        });
        toast.success('User updated successfully');
        navigate('/platform-admin/users');
      } else {
        const res = await api.post('/platform-admin/users', {
          username: form.username,
          email: form.email || null,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
          user_type: form.user_type,
          institution_id: isPlatformType ? null : form.institution_id,
          role_id: form.role_id || undefined,
          branch_id: form.branch_id || null,
          linked_entity_type: form.linked_entity_id ? form.linked_entity_type : undefined,
          linked_entity_id: form.linked_entity_id || undefined,
          is_active: form.is_active,
        });
        setCredentials(res.data.credentials);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/platform-admin/users" className="p-2 hover:bg-gray-100 rounded-md">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? 'Update user account details' : 'Create a user account for any institution or role'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account / Identity */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-600" />
            Account Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="off"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              {!isEdit && <p className="mt-1 text-xs text-gray-400">Minimum 6 characters</p>}
            </div>
          </div>
        </div>

        {/* Role & Institution */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Role & Institution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Type *</label>
              <select
                name="user_type"
                value={form.user_type}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                {USER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {USER_TYPES.find((t) => t.value === form.user_type)?.description}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
              <select
                name="institution_id"
                value={form.institution_id}
                onChange={handleChange}
                disabled={isPlatformType}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {isPlatformType ? 'Platform (no institution)' : 'Select institution'}
                </option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.institution_name} ({inst.institution_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role_id"
                value={form.role_id}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Auto (default role for this type)</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link to {form.user_type === 'student' ? 'Student' : form.user_type === 'parent' ? 'Parent' : (form.user_type === 'teacher' || form.user_type === 'staff') ? 'Employee' : 'record'}
              </label>
              <select
                name="linked_entity_id"
                value={form.linked_entity_id}
                onChange={handleChange}
                disabled={!form.institution_id || isPlatformType || loadingEntities}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {loadingEntities ? 'Loading…' : entities.length === 0 ? 'No record (create standalone login)' : 'Select record to link'}
                </option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.label} {ent.sub ? `— ${ent.sub}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                {isPlatformType || !form.institution_id
                  ? 'Select an institution to link an existing record'
                  : 'Optionally link this account to an existing record'}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Active (user can log in)
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            to="/platform-admin/users"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>

      {/* Credentials Modal */}
      {credentials && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-sm shadow-lg rounded-md bg-white">
            <h3 className="text-lg leading-6 font-medium text-gray-900 text-center mt-4">
              User Created Successfully!
            </h3>
            <div className="mt-4 px-7 py-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 font-semibold mb-2">
                Share these credentials with the user:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Username:</span>
                  <span className="font-mono font-semibold">{credentials.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Password:</span>
                  <span className="font-mono font-semibold">{credentials.password}</span>
                </div>
                {credentials.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-mono font-semibold text-xs">{credentials.email}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-yellow-700 mt-3">
                ⚠️ Save these credentials now! They won't be shown again.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Username: ${credentials.username}\nPassword: ${credentials.password}\nEmail: ${credentials.email || ''}`
                  );
                  toast.success('Credentials copied to clipboard!');
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600"
              >
                Copy Credentials
              </button>
              <button
                onClick={() => navigate('/platform-admin/users')}
                className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
