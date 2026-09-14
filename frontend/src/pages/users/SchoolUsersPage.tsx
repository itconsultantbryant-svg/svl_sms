import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import RecordView from '../../components/common/RecordView';

export default function SchoolUsersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    user_type: 'staff',
    role_ids: [] as string[],
    extra_permissions: [] as string[],
  });
  const [created, setCreated] = useState<{ username: string; temporary_password: string } | null>(null);
  const [viewUser, setViewUser] = useState<any>(null);

  const { data: usersData } = useQuery({
    queryKey: ['school-users'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }).then((r) => r.data),
  });
  const { data: roles } = useQuery({
    queryKey: ['user-roles-list'],
    queryFn: () => api.get('/users/roles').then((r) => r.data),
  });
  const { data: permCatalog } = useQuery({
    queryKey: ['system-permissions'],
    queryFn: () => api.get('/permissions/system-permissions').then((r) => r.data),
  });

  const grouped = permCatalog?.permissions || {};
  const permissions: Array<{ code: string; name: string }> = Object.values(grouped).flatMap((list: any) =>
    Array.isArray(list) ? list : []
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.role_ids.length) {
      toast.error('Select at least one role');
      return;
    }
    const username = form.username || `${form.first_name}.${form.last_name}`.toLowerCase().replace(/\s+/g, '');
    try {
      const res = await api.post('/users', { ...form, username });
      setCreated({ username: res.data.username || username, temporary_password: res.data.temporary_password });
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['school-users'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const saveRoles = async (userId: string, role_ids: string[], extra_permissions: string[]) => {
    try {
      await api.put(`/users/${userId}`, { role_ids, extra_permissions });
      toast.success('Access updated');
      qc.invalidateQueries({ queryKey: ['school-users'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500 mt-1">Create users and assign roles and permissions. Sidebar and dashboard follow those grants.</p>
      </div>

      {created && (
        <div className="card">
          <p className="text-sm">Username: <span className="font-mono font-semibold">{created.username}</span></p>
          <p className="text-sm">Temporary password: <span className="font-mono font-semibold">{created.temporary_password}</span></p>
        </div>
      )}

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="font-semibold">New user</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input-field" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input className="input-field" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <input className="input-field" placeholder="Username (optional)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="input-field" value={form.user_type} onChange={(e) => setForm({ ...form, user_type: e.target.value })}>
            <option value="staff">Staff</option>
            <option value="teacher">Teacher</option>
            <option value="institution_admin">Institution admin</option>
            <option value="branch_admin">Branch admin</option>
            <option value="parent">Parent</option>
            <option value="student">Student</option>
          </select>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Roles</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {(roles || []).map((role: any) => (
              <label key={role.id} className="text-sm flex gap-2 items-center border rounded p-2">
                <input
                  type="checkbox"
                  checked={form.role_ids.includes(role.id)}
                  onChange={() => setForm((prev) => ({
                    ...prev,
                    role_ids: prev.role_ids.includes(role.id)
                      ? prev.role_ids.filter((id) => id !== role.id)
                      : [...prev.role_ids, role.id],
                  }))}
                />
                {role.role_name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Extra permissions</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
            {permissions.slice(0, 80).map((p) => (
              <label key={p.code} className="text-xs flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={form.extra_permissions.includes(p.code)}
                  onChange={() => setForm((prev) => ({
                    ...prev,
                    extra_permissions: prev.extra_permissions.includes(p.code)
                      ? prev.extra_permissions.filter((c) => c !== p.code)
                      : [...prev.extra_permissions, p.code],
                  }))}
                />
                {p.name || p.code}
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary" type="submit">Create user</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Permissions</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(usersData?.data || []).map((u: any) => (
              <tr key={u.id} className="border-b border-gray-50">
                <td className="py-2 pr-3">{u.first_name} {u.last_name}</td>
                <td className="py-2 pr-3">{u.username}</td>
                <td className="py-2 pr-3">{u.user_type}</td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    className="text-primary-600 text-xs"
                    onClick={() => {
                      const ids = (u.roles || []).map((r: any) => r.id);
                      saveRoles(u.id, ids.length ? ids : (u.role_id ? [u.role_id] : []), u.permissions || []);
                    }}
                  >
                    {(u.roles || []).map((r: any) => r.name).join(', ') || 'Assign via form'}
                  </button>
                </td>
                <td className="py-2 text-right space-x-3">
                  <button type="button" className="text-primary-600 text-xs" onClick={() => setViewUser(u)}>View</button>
                  {u.user_type !== 'platform_admin' && (
                    <button
                      type="button"
                      className="text-red-600 text-xs"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${u.username}? They will no longer be able to sign in.`)) return;
                        try {
                          await api.delete(`/users/${u.id}`);
                          toast.success('User deleted');
                          qc.invalidateQueries({ queryKey: ['school-users'] });
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || 'Failed to delete user');
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewUser && (
        <RecordView
          title={`${viewUser.first_name || ''} ${viewUser.last_name || ''}`.trim() || 'User'}
          onClose={() => setViewUser(null)}
          fields={[
            { label: 'Username', value: viewUser.username },
            { label: 'Email', value: viewUser.email },
            { label: 'Phone', value: viewUser.phone },
            { label: 'Type', value: viewUser.user_type },
            { label: 'Roles', value: (viewUser.roles || []).map((r: any) => r.name || r.role_name) },
            { label: 'Status', value: viewUser.is_active ? 'Active' : 'Inactive' },
          ]}
        />
      )}
    </div>
  );
}
