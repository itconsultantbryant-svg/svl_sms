import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Subject } from '../../types';
import RecordActions from '../../components/common/RecordActions';

function asList(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

const emptyRow = () => ({ name: '', code: '' });

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [assignClassId, setAssignClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then((r) => asList(r.data)),
  });

  const { data: classes } = useQuery<any[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then((r) => asList(r.data)),
  });

  const { data: assignments } = useQuery<any[]>({
    queryKey: ['class-subjects'],
    queryFn: () => api.get('/academics/class-subjects').then((r) => asList(r.data)),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/academics/subjects', data),
    onSuccess: (res: any) => {
      refresh();
      toast.success(res?.data?.message || 'Subjects saved');
      setShowForm(false);
      setClassId('');
      setRows([emptyRow(), emptyRow()]);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create subjects'),
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => api.post('/academics/class-subjects', data),
    onSuccess: (res: any) => {
      refresh();
      toast.success(res?.data?.message || 'Subjects assigned');
      setSelectedSubjectIds([]);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign subjects'),
  });

  const subjectList = asList(subjects);
  const classList = asList(classes);
  const assignmentList = asList(assignments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const named = rows.filter((row) => row.name.trim());
    if (!named.length) {
      toast.error('Enter at least one subject');
      return;
    }
    createMutation.mutate({
      class_id: classId || undefined,
      subjects: named.map((row) => ({ name: row.name.trim(), code: row.code.trim() || undefined, type: 'theory' })),
    });
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-sm text-gray-500 mt-1">Create several subjects and assign them to a class</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} className="mr-2" />
          Add Subjects
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">New subjects</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input-field">
                <option value="">Do not assign yet</option>
                {classList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => setRows((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                    className="input-field md:col-span-7"
                    placeholder="Subject name"
                  />
                  <input
                    value={row.code}
                    onChange={(e) => setRows((current) => current.map((item, i) => i === index ? { ...item, code: e.target.value } : item))}
                    className="input-field md:col-span-4"
                    placeholder="Code"
                  />
                  <button type="button" className="btn-secondary md:col-span-1" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label="Remove subject">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRows((current) => [...current, emptyRow()])}>Add another subject</button>
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Save and assign</button>
            </div>
          </form>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Assign existing subjects to a class</h2>
        <div className="max-w-sm">
          <select value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)} className="input-field">
            <option value="">Select class</option>
            {classList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {subjectList.map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedSubjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} />
              <span>{subject.name}{subject.code ? ` (${subject.code})` : ''}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!assignClassId || !selectedSubjectIds.length || assignMutation.isPending}
          onClick={() => assignMutation.mutate({ class_id: assignClassId, subject_ids: selectedSubjectIds })}
        >
          Assign selected subjects
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Subject Name</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Code</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Classes</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : subjectList.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No subjects found</td></tr>
              ) : (
                subjectList.map((subject) => {
                  const classesForSubject = assignmentList.filter((item) => item.subject_id === subject.id).map((item) => item.class_name).filter(Boolean);
                  return (
                    <tr key={subject.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">{subject.name}</td>
                      <td className="py-3 px-3">{subject.code || '-'}</td>
                      <td className="py-3 px-3">{classesForSubject.length ? Array.from(new Set(classesForSubject)).join(', ') : '—'}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          subject.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {subject.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <RecordActions resource="subjects" id={subject.id} label={subject.name} invalidate={['subjects', 'class-subjects']} fields={[
                        { key: 'name', label: 'Name' },
                        { key: 'code', label: 'Code' },
                      ]} record={subject} />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
