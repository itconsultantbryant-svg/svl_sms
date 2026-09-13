import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function StudentAssignmentsPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: () => api.get('/student-portal/assignments').then(r => r.data),
    refetchInterval: 20000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Failed to load assignments. Make sure you are logged in as a student.</p>
      </div>
    );
  }

  const assignments: any[] = Array.isArray(data?.data) ? data.data : [];

  const submit = async (id: string) => {
    try {
      await api.post(`/assignments/${id}/submit`, { submission_text: drafts[id] || '' });
      toast.success('Submitted');
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not submit');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">My Assignments</h1>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No assignments available.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a: any, idx: number) => (
            <div key={a.id || idx} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{a.title}</h2>
                  {a.subject_name && <p className="text-sm text-gray-500 mt-1">{a.subject_name}</p>}
                  {a.description && <p className="text-sm text-gray-700 mt-2">{a.description}</p>}
                </div>
                {a.due_date && (
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    Due: {new Date(a.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  a.submission_status === 'submitted' || a.submission_status === 'late' ? 'bg-green-100 text-green-700' :
                  a.submission_status === 'graded' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {a.submission_status || 'pending'}
                </span>
                {a.submission_status === 'graded' && (
                  <span className="text-sm text-gray-700">{a.marks_obtained}/{a.max_marks} {a.feedback ? `· ${a.feedback}` : ''}</span>
                )}
              </div>
              {a.submission_status !== 'graded' && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="input-field"
                    placeholder="Write your answer"
                    value={drafts[a.id] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                  />
                  <button type="button" className="btn-primary shrink-0" onClick={() => submit(a.id)}>Submit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
