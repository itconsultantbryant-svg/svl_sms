import { useState, useEffect } from 'react';
import { Plus, FileText, Calendar, Users } from 'lucide-react';
import api from '../../utils/api';

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  class_name?: string;
  subject_id: string;
  subject_name?: string;
  due_date: string;
  status: string;
  total_submissions?: number;
  created_at: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '', description: '', class_id: '', subject_id: '', due_date: '', max_score: '100'
  });

  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchAssignments = async () => {
    try {
      const response = await api.get('/assignments');
      setAssignments(response.data.assignments || response.data || []);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get('/academics/classes');
      setClasses(response.data || []);
    } catch (error) {}
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/academics/subjects');
      setSubjects(response.data || []);
    } catch (error) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assignments', formData);
      fetchAssignments();
      setShowForm(false);
      setFormData({ title: '', description: '', class_id: '', subject_id: '', due_date: '', max_score: '100' });
    } catch (error) {
      console.error('Failed to create assignment:', error);
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
          <p className="text-sm text-gray-500 mt-1">Manage class assignments</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Create Assignment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={formData.class_id}
                  onChange={e => setFormData({ ...formData, class_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={formData.subject_id}
                  onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Create Assignment</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map(assignment => (
          <div key={assignment.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-primary-500" />
                <h3 className="font-medium text-gray-900">{assignment.title}</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                assignment.status === 'active' ? 'bg-green-100 text-green-700' :
                assignment.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                'bg-blue-100 text-blue-700'
              }`}>
                {assignment.status || 'active'}
              </span>
            </div>
            {assignment.description && (
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{assignment.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Due: {assignment.due_date || 'N/A'}
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {assignment.total_submissions || 0} submissions
              </span>
            </div>
            {(assignment.class_name || assignment.subject_name) && (
              <div className="mt-2 flex gap-2">
                {assignment.class_name && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{assignment.class_name}</span>
                )}
                {assignment.subject_name && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{assignment.subject_name}</span>
                )}
              </div>
            )}
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            No assignments yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
