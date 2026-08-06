import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../../utils/api';

interface Role {
  id: string;
  role_name: string;
  role_code: string;
  description: string;
  permissions: string[];
  user_count?: number;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [systemPermissions, setSystemPermissions] = useState<any>({});
  const [formData, setFormData] = useState({ role_name: '', role_code: '', description: '', permissions: [] as string[] });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get('/permissions/roles');
      setRoles(response.data.roles || response.data || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/permissions/system-permissions');
      setSystemPermissions(response.data || {});
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await api.put(`/permissions/roles/${editingRole.id}`, formData);
      } else {
        await api.post('/permissions/roles', formData);
      }
      fetchRoles();
      resetForm();
    } catch (error) {
      console.error('Failed to save role:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await api.delete(`/permissions/roles/${id}`);
      fetchRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name,
      role_code: role.role_code,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingRole(null);
    setFormData({ role_name: '', role_code: '', description: '', permissions: [] });
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage user roles and their permissions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Role
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{editingRole ? 'Edit Role' : 'Create Role'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={formData.role_name}
                  onChange={e => setFormData({ ...formData, role_name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Code</label>
                <input
                  type="text"
                  value={formData.role_code}
                  onChange={e => setFormData({ ...formData, role_code: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto border rounded-lg p-4">
                {Object.entries(systemPermissions).map(([module, perms]: [string, any]) => (
                  <div key={module}>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{module}</h4>
                    {(Array.isArray(perms) ? perms : []).map((p: any) => (
                      <label key={p.code} className="flex items-center gap-2 text-sm py-0.5">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(p.code)}
                          onChange={() => togglePermission(p.code)}
                          className="rounded border-gray-300"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editingRole ? 'Update' : 'Create'} Role
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Role Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Code</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Permissions</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map(role => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium flex items-center gap-2">
                  <Shield size={16} className="text-primary-500" />
                  {role.role_name}
                </td>
                <td className="py-3 px-4 text-gray-500">{role.role_code}</td>
                <td className="py-3 px-4 text-gray-500">{role.description || '-'}</td>
                <td className="py-3 px-4">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {role.permissions?.length || 0} permissions
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => handleEdit(role)} className="text-gray-400 hover:text-blue-600 mr-2">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(role.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No roles defined yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
