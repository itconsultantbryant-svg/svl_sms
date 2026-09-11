import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type ColumnDraft = { name: string; weight: number; max_score: number };

export default function GradebookAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'list' | 'generate' | 'pending'>('list');
  const [form, setForm] = useState({
    session_id: '',
    term_id: '',
    class_id: '',
    section_id: '',
    subject_id: '',
    teacher_id: '',
  });
  const [columns, setColumns] = useState<ColumnDraft[]>([
    { name: 'Quiz', weight: 10, max_score: 100 },
    { name: 'Homework', weight: 20, max_score: 100 },
    { name: 'Midterm', weight: 30, max_score: 100 },
    { name: 'Exam', weight: 40, max_score: 100 },
  ]);

  const { data: listData, refetch } = useQuery({
    queryKey: ['gradebooks'],
    queryFn: () => api.get('/gradebook').then((r) => r.data),
  });

  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ['gradebooks-pending'],
    queryFn: () => api.get('/gradebook/pending').then((r) => r.data),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then((r) => r.data),
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then((r) => r.data),
  });
  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then((r) => r.data),
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then((r) => r.data.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms', form.session_id],
    queryFn: () => api.get('/academics/terms', { params: { session_id: form.session_id } }).then((r) => r.data),
    enabled: !!form.session_id,
  });

  const weightSum = useMemo(() => columns.reduce((s, c) => s + Number(c.weight || 0), 0), [columns]);

  const generate = async () => {
    if (Math.abs(weightSum - 100) > 0.01) {
      toast.error('Weights must sum to 100');
      return;
    }
    try {
      await api.post('/gradebook/generate', { ...form, columns });
      toast.success('Gradebook generated');
      setTab('list');
      refetch();
      qc.invalidateQueries({ queryKey: ['gradebooks'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to generate');
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/gradebook/${id}/approve`);
      toast.success('Approved — visible to students');
      refetchPending();
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Approve failed');
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Rejection reason') || 'Needs revision';
    try {
      await api.post(`/gradebook/${id}/reject`, { reason });
      toast.success('Rejected');
      refetchPending();
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Reject failed');
    }
  };

  const rows = listData?.data || [];
  const pending = pendingData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gradebook</h1>
          <p className="text-sm text-gray-500 mt-1">Assign weighted gradebooks to class, subject, and teacher</p>
        </div>
        <div className="flex gap-2">
          {(['list', 'generate', 'pending'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-lg ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {t === 'list' ? 'All' : t === 'generate' ? 'Generate' : `Pending (${pending.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'generate' && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Session</label>
              <select className="input-field" value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })}>
                <option value="">Select</option>
                {(sessions || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Term</label>
              <select className="input-field" value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
                <option value="">Select</option>
                {(terms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Class *</label>
              <select className="input-field" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
                <option value="">Select</option>
                {(classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject *</label>
              <select className="input-field" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">Select</option>
                {(subjects || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teacher *</label>
              <select className="input-field" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">Select</option>
                {(teachers || []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Weighted columns (sum = {weightSum}%)</h3>
              <button
                type="button"
                className="text-sm text-primary-600"
                onClick={() => setColumns([...columns, { name: 'Activity', weight: 0, max_score: 100 }])}
              >
                + Add column
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input-field col-span-5"
                    value={col.name}
                    onChange={(e) => {
                      const next = [...columns];
                      next[i] = { ...next[i], name: e.target.value };
                      setColumns(next);
                    }}
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    className="input-field col-span-3"
                    value={col.weight}
                    onChange={(e) => {
                      const next = [...columns];
                      next[i] = { ...next[i], weight: Number(e.target.value) };
                      setColumns(next);
                    }}
                    placeholder="Weight %"
                  />
                  <input
                    type="number"
                    className="input-field col-span-3"
                    value={col.max_score}
                    onChange={(e) => {
                      const next = [...columns];
                      next[i] = { ...next[i], max_score: Number(e.target.value) };
                      setColumns(next);
                    }}
                    placeholder="Max"
                  />
                  <button type="button" className="text-red-500 text-sm col-span-1" onClick={() => setColumns(columns.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={generate} className="btn-primary" disabled={!form.class_id || !form.subject_id || !form.teacher_id}>
            Generate Gradebook
          </button>
        </div>
      )}

      {tab === 'pending' && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Term</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((g: any) => (
                <tr key={g.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{g.class_name}</td>
                  <td className="py-2 pr-4">{g.subject_name}</td>
                  <td className="py-2 pr-4">{g.teacher_name}</td>
                  <td className="py-2 pr-4">{g.term_name || '—'}</td>
                  <td className="py-2 flex gap-2">
                    <Link to={`/gradebook/${g.id}`} className="text-primary-600">Review</Link>
                    <button type="button" className="text-green-600" onClick={() => approve(g.id)}>Approve</button>
                    <button type="button" className="text-red-600" onClick={() => reject(g.id)}>Reject</button>
                  </td>
                </tr>
              ))}
              {!pending.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No pending submissions</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'list' && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g: any) => (
                <tr key={g.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{g.class_name}</td>
                  <td className="py-2 pr-4">{g.subject_name}</td>
                  <td className="py-2 pr-4">{g.teacher_name}</td>
                  <td className="py-2 pr-4 capitalize">{g.status}</td>
                  <td className="py-2"><Link className="text-primary-600" to={`/gradebook/${g.id}`}>View</Link></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No gradebooks yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
