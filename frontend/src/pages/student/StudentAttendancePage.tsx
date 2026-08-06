import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import api from '../../utils/api';

export default function StudentAttendancePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: () => api.get('/student-portal/attendance').then(r => r.data),
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
        <p>Failed to load attendance. Make sure you are logged in as a student.</p>
      </div>
    );
  }

  const records: any[] = data?.data || [];
  const present = records.filter((r: any) => r.status === 'present').length;
  const absent = records.filter((r: any) => r.status === 'absent').length;
  const total = present + absent;
  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{present}</p>
          <p className="text-sm text-green-700">Present</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{absent}</p>
          <p className="text-sm text-red-700">Absent</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{percentage}%</p>
          <p className="text-sm text-blue-700">Attendance</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No attendance records available.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{r.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.subject_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                      r.status === 'present' ? 'bg-green-100 text-green-700' :
                      r.status === 'absent' ? 'bg-red-100 text-red-700' :
                      r.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
