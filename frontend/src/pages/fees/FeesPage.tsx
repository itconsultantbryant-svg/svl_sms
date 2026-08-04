import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Class, AcademicSession } from '../../types';

export default function FeesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'structures' | 'types'>('structures');
  const [showForm, setShowForm] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', code: '', description: '' });
  const [structForm, setStructForm] = useState({ fee_type_id: '', session_id: '', term_id: '', class_id: '', amount: '', due_date: '' });

  const { data: feeTypes } = useQuery<any[]>({
    queryKey: ['fee-types'],
    queryFn: () => api.get('/fees/types').then(r => r.data),
  });

  const { data: structures } = useQuery<any[]>({
    queryKey: ['fee-structures'],
    queryFn: () => api.get('/fees/structures').then(r => r.data),
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then(r => r.data),
  });

  const { data: sessions } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then(r => r.data),
  });

  const { data: terms } = useQuery<any[]>({
    queryKey: ['terms', structForm.session_id],
    queryFn: () => api.get('/academics/terms', { params: { session_id: structForm.session_id } }).then(r => r.data),
    enabled: !!structForm.session_id,
  });

  const createTypeMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/types', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-types'] }); toast.success('Fee type created'); setShowForm(false); setTypeForm({ name: '', code: '', description: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const createStructMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/structures', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-structures'] }); toast.success('Fee structure created'); setShowForm(false); setStructForm({ fee_type_id: '', session_id: '', term_id: '', class_id: '', amount: '', due_date: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage fee types and structures</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-2" /> {tab === 'types' ? 'Add Fee Type' : 'Add Structure'}
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('structures')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'structures' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>Fee Structures</button>
        <button onClick={() => setTab('types')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'types' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>Fee Types</button>
      </div>

      {showForm && tab === 'types' && (
        <div className="card">
          <form onSubmit={e => { e.preventDefault(); createTypeMutation.mutate(typeForm); }} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input value={typeForm.code} onChange={e => setTypeForm(f => ({ ...f, code: e.target.value }))} className="input-field" />
            </div>
            <button type="submit" className="btn-primary">Create</button>
          </form>
        </div>
      )}

      {showForm && tab === 'structures' && (
        <div className="card">
          <form onSubmit={e => { e.preventDefault(); createStructMutation.mutate({ ...structForm, amount: parseFloat(structForm.amount) }); }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type *</label>
              <select value={structForm.fee_type_id} onChange={e => setStructForm(f => ({ ...f, fee_type_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {feeTypes?.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
              <select value={structForm.session_id} onChange={e => setStructForm(f => ({ ...f, session_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {sessions?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
              <select value={structForm.term_id} onChange={e => setStructForm(f => ({ ...f, term_id: e.target.value }))} className="input-field">
                <option value="">All Terms</option>
                {terms?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <select value={structForm.class_id} onChange={e => setStructForm(f => ({ ...f, class_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={structForm.amount} onChange={e => setStructForm(f => ({ ...f, amount: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={structForm.due_date} onChange={e => setStructForm(f => ({ ...f, due_date: e.target.value }))} className="input-field" />
            </div>
            <button type="submit" className="btn-primary">Create</button>
          </form>
        </div>
      )}

      {tab === 'types' && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Code</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Recurring</th>
              </tr>
            </thead>
            <tbody>
              {feeTypes?.map(ft => (
                <tr key={ft.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-medium">{ft.name}</td>
                  <td className="py-3 px-3">{ft.code || '-'}</td>
                  <td className="py-3 px-3 text-gray-500">{ft.description || '-'}</td>
                  <td className="py-3 px-3">{ft.is_recurring ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'structures' && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Fee Type</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Session</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Term</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {!structures?.length ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No fee structures defined</td></tr>
              ) : structures.map(fs => (
                <tr key={fs.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-medium">{fs.fee_type_name}</td>
                  <td className="py-3 px-3">{fs.class_name}</td>
                  <td className="py-3 px-3">{fs.session_name}</td>
                  <td className="py-3 px-3">{fs.term_name || 'All'}</td>
                  <td className="py-3 px-3 text-right font-medium">${fs.amount.toFixed(2)}</td>
                  <td className="py-3 px-3">{fs.due_date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
