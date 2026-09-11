import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';

export default function GradebookTeacherPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['gradebook-mine'],
    queryFn: () => api.get('/gradebook/mine').then((r) => r.data),
  });

  const rows = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Gradebooks</h1>
        <p className="text-sm text-gray-500 mt-1">Enter activity grades for your assigned classes and subjects</p>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-gray-500 p-4">Loading…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Term</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g: any) => (
                <tr key={g.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{g.class_name}</td>
                  <td className="py-2 pr-4">{g.subject_name}</td>
                  <td className="py-2 pr-4">{g.term_name || '—'}</td>
                  <td className="py-2 pr-4 capitalize">{g.status}</td>
                  <td className="py-2">
                    <Link to={`/gradebook/${g.id}`} className="text-primary-600">
                      {['open', 'draft', 'rejected'].includes(g.status) ? 'Enter grades' : 'View'}
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No gradebooks assigned yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
