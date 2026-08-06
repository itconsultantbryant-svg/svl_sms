import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import api from '../../utils/api';

export default function TeacherStudentsPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { data: classesData } = useQuery({
    queryKey: ['teacher-my-classes'],
    queryFn: () => api.get('/teacher-dashboard/my-classes').then(r => r.data),
  });

  const { data: studentsData, isLoading, error } = useQuery({
    queryKey: ['teacher-my-students', selectedClassId],
    queryFn: () => api.get(`/teacher-dashboard/my-students?class_id=${selectedClassId}`).then(r => r.data),
    enabled: !!selectedClassId,
  });

  const classes: any[] = classesData?.data || [];
  const students: any[] = studentsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCheck size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">My Students</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a class --</option>
          {classes.map((cls: any) => (
            <option key={cls.assignment_id} value={cls.class_id}>
              {cls.class_name}{cls.section_name ? ` - ${cls.section_name}` : ''} ({cls.subject_name})
            </option>
          ))}
        </select>
      </div>

      {!selectedClassId ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          Select a class above to view students.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-gray-500">Failed to load students.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {students.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No students found in this class.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">{s.admission_number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.class_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.section_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
