import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { AcademicSession } from '../../types';

export default function ExamsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', exam_type_id: '', session_id: '', term_id: '', start_date: '', end_date: '', description: '' });

  const { data: exams, isLoading } = useQuery<any[]>({
    queryKey: ['exams'],
    queryFn: () => api.get('/examinations/exams').then(r => r.data),
  });

  const { data: examTypes } = useQuery<any[]>({
    queryKey: ['exam-types'],
    queryFn: () => api.get('/examinations/types').then(r => r.data),
  });

  const { data: sessions } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then(r => r.data),
  });

  const { data: terms } = useQuery<any[]>({
    queryKey: ['terms', form.session_id],
    queryFn: () => api.get('/academics/terms', { params: { session_id: form.session_id } }).then(r => r.data),
    enabled: !!form.session_id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/examinations/exams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Exam created successfully');
      setShowForm(false);
      setForm({ name: '', exam_type_id: '', session_id: '', term_id: '', start_date: '', end_date: '', description: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create exam'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.session_id) {
      toast.error('Name and session are required');
      return;
    }
    createMutation.mutate(form);
  };

  const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Examinations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage exams, schedules, and marks</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-2" /> Create Exam
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Examination</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required placeholder="e.g. Midterm Exam 2026" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
              <select value={form.exam_type_id} onChange={e => setForm(f => ({ ...f, exam_type_id: e.target.value }))} className="input-field">
                <option value="">Select Type</option>
                {examTypes?.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
              <select value={form.session_id} onChange={e => setForm(f => ({ ...f, session_id: e.target.value, term_id: '' }))} className="input-field" required>
                <option value="">Select Session</option>
                {sessions?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
              <select value={form.term_id} onChange={e => setForm(f => ({ ...f, term_id: e.target.value }))} className="input-field">
                <option value="">Select Term</option>
                {terms?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Exam</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="col-span-full text-center py-12 text-gray-400">Loading...</p>
        ) : exams?.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-400">No exams created yet</p>
        ) : (
          exams?.map((exam: any) => (
            <div key={exam.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <ClipboardList size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{exam.name}</h3>
                    <p className="text-xs text-gray-500">{exam.exam_type_name || 'General'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exam.status] || 'bg-gray-100 text-gray-700'}`}>
                  {exam.status}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Session: {exam.session_name}</p>
                {exam.term_name && <p>Term: {exam.term_name}</p>}
                {exam.start_date && <p>Date: {exam.start_date} to {exam.end_date}</p>}
                <p>{exam.schedule_count} schedules, {exam.class_count} classes</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Link to={`/examinations/${exam.id}/schedules`} className="btn-secondary text-xs px-3 py-1">Schedules</Link>
                <Link to={`/examinations/${exam.id}/marks`} className="btn-secondary text-xs px-3 py-1">Marks</Link>
                <Link to={`/examinations/${exam.id}/results`} className="btn-primary text-xs px-3 py-1">Results</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
