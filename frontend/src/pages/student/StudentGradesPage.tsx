import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import GradesheetView, { printGradesheet, GradesheetData } from '../../components/gradesheet/GradesheetView';

export default function StudentGradesPage() {
  const { data, isLoading, error } = useQuery<GradesheetData>({
    queryKey: ['student-gradesheet'],
    queryFn: () => api.get('/gradebook/gradesheet/me').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-center py-12 text-gray-500">Gradesheet could not be loaded.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gradesheet</h1>
          <p className="text-sm text-gray-500">School template with every subject assigned to your class</p>
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={() => printGradesheet(data)}>
          Preview / Download PDF
        </button>
      </div>
      <GradesheetView sheet={data} />
    </div>
  );
}
