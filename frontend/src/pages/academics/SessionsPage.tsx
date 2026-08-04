import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { AcademicSession } from '../../types';

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', is_current: false });

  const { data: sessions, isLoading } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/academics/sessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully');
      setShowForm(false);
      setForm({ name: '', start_date: '', end_date: '', is_current: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create session'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage academic years and terms</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-2" />
          Add Session
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Academic Session</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g. 2026/2027" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" required />
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} className="rounded" />
                Current
              </label>
              <button type="submit" className="btn-primary flex-1">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-400 col-span-full text-center py-12">Loading...</p>
        ) : sessions?.length === 0 ? (
          <p className="text-gray-400 col-span-full text-center py-12">No sessions found</p>
        ) : (
          sessions?.map((session) => (
            <div key={session.id} className={`card border-2 ${session.is_current ? 'border-primary-500' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${session.is_current ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <Calendar size={18} className={session.is_current ? 'text-primary-600' : 'text-gray-500'} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{session.name}</h3>
                  {session.is_current && (
                    <span className="text-xs text-primary-600 font-medium">Current Session</span>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Start: {session.start_date}</p>
                <p>End: {session.end_date}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
