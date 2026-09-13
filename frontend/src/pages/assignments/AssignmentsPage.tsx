import { useCallback, useEffect, useState } from 'react';
import { Plus, FileText, Calendar, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

function asList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.assignments)) return payload.assignments;
  return [];
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [formData, setFormData] = useState({
    title: '', description: '', class_id: '', subject_id: '', due_date: '', max_marks: '100', type: 'assignment',
  });

  const canCreate = ['teacher', 'institution_admin', 'platform_admin', 'staff'].includes(user?.user_type || '')
    || (user?.permissions || []).some((p) => p.startsWith('assignments.'));

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await api.get('/assignments', { params: { limit: 100 } });
      setAssignments(asList(response.data));
      setError('');
    } catch (err: any) {
      setAssignments([]);
      setError(err.response?.data?.error || 'Could not load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  const openAssignment = async (id: string) => {
    try {
      const response = await api.get(`/assignments/${id}`);
      setSelected(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not open assignment');
    }
  };

  useEffect(() => {
    fetchAssignments();
    api.get('/academics/classes').then((r) => setClasses(asList(r.data))).catch(() => setClasses([]));
    api.get('/academics/subjects').then((r) => setSubjects(asList(r.data))).catch(() => setSubjects([]));
    const timer = window.setInterval(fetchAssignments, 20000);
    return () => window.clearInterval(timer);
  }, [fetchAssignments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assignments', { ...formData, max_marks: Number(formData.max_marks) || 100 });
      toast.success('Assignment created');
      setShowForm(false);
      setFormData({ title: '', description: '', class_id: '', subject_id: '', due_date: '', max_marks: '100', type: 'assignment' });
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create assignment');
    }
  };

  const gradeSubmission = async (submissionId: string) => {
    if (!selected) return;
    const grade = grades[submissionId] || { marks: '', feedback: '' };
    try {
      await api.post(`/assignments/${selected.id}/submissions/${submissionId}/grade`, {
        marks_obtained: Number(grade.marks),
        feedback: grade.feedback,
      });
      toast.success('Marked');
      openAssignment(selected.id);
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Could not save marks');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-sm text-gray-500 mt-1">Create work for a class, then mark submissions as they come in</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Assignment
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Create Assignment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input-field">
                  <option value="assignment">Assignment</option>
                  <option value="homework">Homework</option>
                  <option value="classwork">Classwork</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max marks</label>
                <input type="number" min="1" value={formData.max_marks} onChange={(e) => setFormData({ ...formData, max_marks: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: e.target.value })} className="input-field" required>
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name || c.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select value={formData.subject_id} onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })} className="input-field" required>
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={3} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Create Assignment</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((assignment) => (
          <button
            key={assignment.id}
            type="button"
            onClick={() => openAssignment(assignment.id)}
            className="card hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-primary-500 shrink-0" />
                <h3 className="font-medium text-gray-900 truncate">{assignment.title}</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{assignment.type || 'assignment'}</span>
            </div>
            {assignment.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{assignment.description}</p>}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Calendar size={12} /> Due: {assignment.due_date || 'N/A'}</span>
              <span className="flex items-center gap-1"><Users size={12} /> {assignment.total_submissions || assignment.submission_count || 0} submissions</span>
            </div>
            {(assignment.class_name || assignment.subject_name) && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {assignment.class_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{assignment.class_name}</span>}
                {assignment.subject_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{assignment.subject_name}</span>}
              </div>
            )}
          </button>
        ))}
        {assignments.length === 0 && !error && (
          <div className="col-span-full text-center py-12 text-gray-400">No assignments yet. Create one to get started.</div>
        )}
      </div>

      {selected && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
              <p className="text-sm text-gray-500">{selected.class_name} · {selected.subject_name} · Due {selected.due_date} · {selected.max_marks} marks</p>
              {selected.description && <p className="text-sm text-gray-700 mt-2">{selected.description}</p>}
            </div>
            <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Work</th>
                  <th className="py-2 pr-3">Marks</th>
                  <th className="py-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {(selected.submissions || []).map((sub: any) => (
                  <tr key={sub.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{sub.student_name}</td>
                    <td className="py-2 pr-3 capitalize">{sub.status}</td>
                    <td className="py-2 pr-3 max-w-xs">{sub.submission_text || '—'}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        className="input-field w-24"
                        defaultValue={sub.marks_obtained ?? ''}
                        onChange={(e) => setGrades((g) => ({ ...g, [sub.id]: { marks: e.target.value, feedback: g[sub.id]?.feedback ?? sub.feedback ?? '' } }))}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <input
                          className="input-field"
                          defaultValue={sub.feedback || ''}
                          onChange={(e) => setGrades((g) => ({ ...g, [sub.id]: { marks: g[sub.id]?.marks ?? String(sub.marks_obtained ?? ''), feedback: e.target.value } }))}
                        />
                        <button type="button" className="btn-primary shrink-0" onClick={() => gradeSubmission(sub.id)}>Save</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!(selected.submissions || []).length && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">No submissions yet. This list refreshes as students submit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
