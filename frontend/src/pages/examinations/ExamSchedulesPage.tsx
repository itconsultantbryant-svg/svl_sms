import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Class, Section, Subject } from '../../types';

export default function ExamSchedulesPage() {
  const { examId } = useParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class_id: '', section_id: '', subject_id: '', date: '', start_time: '', end_time: '', max_marks: '100', pass_marks: '40', room: '' });

  const { data: exam } = useQuery<any>({
    queryKey: ['exam', examId],
    queryFn: () => api.get(`/examinations/exams/${examId}`).then(r => r.data),
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then(r => r.data),
  });

  const { data: sections } = useQuery<Section[]>({
    queryKey: ['sections', form.class_id],
    queryFn: () => api.get('/academics/sections', { params: { class_id: form.class_id } }).then(r => r.data),
    enabled: !!form.class_id,
  });

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/examinations/exams/${examId}/schedules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      toast.success('Schedule added');
      setShowForm(false);
      setForm({ class_id: '', section_id: '', subject_id: '', date: '', start_time: '', end_time: '', max_marks: '100', pass_marks: '40', room: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add schedule'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id || !form.date) {
      toast.error('Class, subject, and date are required');
      return;
    }
    addMutation.mutate({
      schedules: [{
        ...form,
        max_marks: parseFloat(form.max_marks),
        pass_marks: parseFloat(form.pass_marks),
      }]
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/examinations" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.name || 'Exam'} - Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">{exam?.session_name} {exam?.term_name ? `/ ${exam.term_name}` : ''}</p>
        </div>
      </div>

      <button onClick={() => setShowForm(!showForm)} className="btn-primary">
        <Plus size={16} className="mr-2" /> Add Schedule
      </button>

      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))} className="input-field">
                <option value="">All</option>
                {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {subjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
              <input type="number" value={form.max_marks} onChange={e => setForm(f => ({ ...f, max_marks: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pass Marks</label>
              <input type="number" value={form.pass_marks} onChange={e => setForm(f => ({ ...f, pass_marks: e.target.value }))} className="input-field" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="btn-primary">Add Schedule</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Subject</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Section</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Time</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Max Marks</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Pass Marks</th>
              </tr>
            </thead>
            <tbody>
              {!exam?.schedules?.length ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No schedules added yet</td></tr>
              ) : (
                exam.schedules.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">{s.date}</td>
                    <td className="py-3 px-3 font-medium">{s.subject_name}</td>
                    <td className="py-3 px-3">{s.class_name}</td>
                    <td className="py-3 px-3">{s.section_name || 'All'}</td>
                    <td className="py-3 px-3">{s.start_time ? `${s.start_time} - ${s.end_time}` : '-'}</td>
                    <td className="py-3 px-3">{s.max_marks}</td>
                    <td className="py-3 px-3">{s.pass_marks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
