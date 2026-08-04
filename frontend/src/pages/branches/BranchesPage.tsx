import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Branch } from '../../types';

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', email: '' });

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch created successfully');
      setShowForm(false);
      setForm({ name: '', code: '', address: '', phone: '', email: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create branch'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-sm text-gray-500 mt-1">Manage institution branches/campuses</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-2" />
          Add Branch
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Branch</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="input-field" placeholder="e.g. MAIN" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" type="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full">Create Branch</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-400 col-span-full text-center py-12">Loading...</p>
        ) : branches?.length === 0 ? (
          <p className="text-gray-400 col-span-full text-center py-12">No branches found</p>
        ) : (
          branches?.map((branch) => (
            <div key={branch.id} className={`card border-2 ${branch.is_main ? 'border-primary-500' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${branch.is_main ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <Building2 size={18} className={branch.is_main ? 'text-primary-600' : 'text-gray-500'} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                  {branch.is_main ? (
                    <span className="text-xs text-primary-600 font-medium">Main Campus</span>
                  ) : (
                    <span className="text-xs text-gray-500">{branch.code || ''}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Students</p>
                  <p className="font-semibold">{branch.student_count || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Staff</p>
                  <p className="font-semibold">{branch.employee_count || 0}</p>
                </div>
              </div>
              {branch.address && (
                <p className="text-xs text-gray-500 mt-3">{branch.address}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
