import { useQuery } from '@tanstack/react-query';
import { BookMarked } from 'lucide-react';
import api from '../../utils/api';

export default function TeacherClassesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher-my-classes'],
    queryFn: () => api.get('/teacher-dashboard/my-classes').then(r => r.data),
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
        <p>Failed to load classes. Make sure you are logged in as a teacher.</p>
      </div>
    );
  }

  const classes: any[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookMarked size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">My Classes</h1>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No classes assigned yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls: any, idx: number) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">{cls.class_name}</h2>
              {cls.section_name && (
                <p className="text-sm text-gray-500">Section: {cls.section_name}</p>
              )}
              {cls.subject_name && (
                <p className="text-sm text-gray-500">Subject: {cls.subject_name}</p>
              )}
              {cls.session_name && (
                <p className="text-xs text-gray-400 mt-1">{cls.session_name}</p>
              )}
              {cls.student_count !== undefined && (
                <p className="mt-2 text-sm font-medium text-blue-600">{cls.student_count} students</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
