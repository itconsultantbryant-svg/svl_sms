import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function PasswordRequestsPage() {
  const { data, refetch } = useQuery({
    queryKey: ['password-requests'],
    queryFn: () => api.get('/auth/password-requests', { params: { status: 'pending' } }).then((r) => r.data),
  });

  const approve = async (id: string) => {
    try {
      await api.post(`/auth/password-requests/${id}/approve`);
      toast.success('Approved');
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const reject = async (id: string) => {
    try {
      await api.post(`/auth/password-requests/${id}/reject`, { reason: 'Rejected by admin' });
      toast.success('Rejected');
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const rows = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Password Change Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Approve student password changes before they take effect</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Username / Student ID</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Requested</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50">
                <td className="py-2 pr-4">{r.first_name} {r.last_name}</td>
                <td className="py-2 pr-4">{r.username}</td>
                <td className="py-2 pr-4 capitalize">{r.user_type}</td>
                <td className="py-2 pr-4">{r.requested_at}</td>
                <td className="py-2 flex gap-3">
                  <button type="button" className="text-green-600" onClick={() => approve(r.id)}>Approve</button>
                  <button type="button" className="text-red-600" onClick={() => reject(r.id)}>Reject</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">No pending requests</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
