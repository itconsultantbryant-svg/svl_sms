import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function LessonPlansTeacherPage() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['lesson-plans-mine'],
    queryFn: () => api.get('/lesson-plans/mine').then((r) => r.data),
  });

  const markSeen = async (id: string) => {
    try {
      await api.post(`/lesson-plans/${id}/seen`);
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const rows = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
        <p className="text-sm text-gray-500 mt-1">Plans sent by school admin for your use</p>
      </div>

      <div className="card divide-y">
        {isLoading && <p className="p-4 text-gray-500">Loading…</p>}
        {!isLoading && !rows.length && <p className="p-6 text-center text-gray-400">No lesson plans received</p>}
        {rows.map((p: any) => (
          <div key={p.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{p.description || 'No description'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {p.class_name || 'Any class'} · {p.subject_name || 'Any subject'}
                {!p.seen_at ? ' · New' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {p.file_data && (
                <a
                  href={p.file_data}
                  download={p.file_name || 'lesson-plan'}
                  className="btn-primary text-sm"
                  onClick={() => markSeen(p.id)}
                >
                  Open / Download
                </a>
              )}
              {!p.seen_at && (
                <button type="button" className="btn-secondary text-sm" onClick={() => markSeen(p.id)}>
                  Mark seen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
