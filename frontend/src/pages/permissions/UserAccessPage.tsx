import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function UserAccessPage() {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users-access', search],
    queryFn: () => api.get('/users', { params: { limit: 100, search } }).then((r) => r.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['user-roles-list'],
    queryFn: () => api.get('/users/roles').then((r) => r.data),
  });

  const users = usersData?.data || [];
  const selected = users.find((u: any) => u.id === selectedUserId);

  useEffect(() => {
    if (selected) {
      setSelectedRoles((selected.roles || []).map((r: any) => r.id));
    }
  }, [selectedUserId, selected]);

  const previewPermissions = useMemo(() => {
    const set = new Set<string>();
    for (const role of roles || []) {
      if (!selectedRoles.includes(role.id)) continue;
      try {
        const perms = JSON.parse(role.permissions || '[]');
        if (Array.isArray(perms)) perms.forEach((p: string) => set.add(p));
      } catch { /* ignore */ }
    }
    return Array.from(set).sort();
  }, [roles, selectedRoles]);

  const save = async () => {
    if (!selectedUserId || !selectedRoles.length) {
      toast.error('Select a user and at least one role');
      return;
    }
    try {
      await api.put(`/users/${selectedUserId}/roles`, { role_ids: selectedRoles });
      toast.success('Roles updated — user access refreshes in real time');
      qc.invalidateQueries({ queryKey: ['users-access'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Access</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign multiple roles — permissions and sidebar items merge (union) in real time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1 space-y-3">
          <input
            className="input-field"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[28rem] overflow-y-auto divide-y">
            {users.map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={`w-full text-left p-3 text-sm ${selectedUserId === u.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                <div className="font-medium">{u.first_name} {u.last_name}</div>
                <div className="text-xs text-gray-500">{u.username} · {u.user_type}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {(u.roles || []).map((r: any) => r.name || r.code).join(', ') || u.role_name || 'No roles'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2 space-y-4">
          {!selectedUserId ? (
            <p className="text-gray-400">Select a user to manage roles</p>
          ) : (
            <>
              <div>
                <h2 className="font-semibold text-lg">
                  {selected?.first_name} {selected?.last_name}
                </h2>
                <p className="text-sm text-gray-500">{selected?.username}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Roles (multi-select)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {(roles || []).map((role: any) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm border rounded-lg p-2">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => {
                          setSelectedRoles((prev) =>
                            prev.includes(role.id)
                              ? prev.filter((id) => id !== role.id)
                              : [...prev, role.id]
                          );
                        }}
                      />
                      <span>
                        <span className="font-medium">{role.role_name}</span>
                        <span className="text-gray-400 ml-1">({role.role_code})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Merged permissions preview ({previewPermissions.length})</h3>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {previewPermissions.map((p) => (
                    <span key={p} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{p}</span>
                  ))}
                  {!previewPermissions.length && <span className="text-gray-400 text-sm">No permissions on selected roles</span>}
                </div>
              </div>

              <button type="button" className="btn-primary" onClick={save}>Save roles</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
