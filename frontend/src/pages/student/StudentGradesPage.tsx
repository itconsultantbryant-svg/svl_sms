import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { escapeHtml, openPrintDocument } from '../../utils/printDocument';

export default function StudentGradesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-grades'],
    queryFn: () => api.get('/student-portal/grades').then(r => r.data),
  });

  const { data: gradebookData } = useQuery({
    queryKey: ['student-gradebook'],
    queryFn: () => api.get('/gradebook/student/me').then(r => r.data),
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
        <p>Failed to load grades. Make sure you are logged in as a student.</p>
      </div>
    );
  }

  const grades: any[] = data?.data || [];
  const gradebooks: any[] = gradebookData?.data || [];

  const downloadSheet = () => {
    openPrintDocument('Gradesheet', `
      <h1>Gradesheet</h1>
      <p class="meta">Approved term grades</p>
      <table>
        <thead><tr><th>Subject</th><th>Class</th><th>Term</th><th>%</th><th>Grade</th></tr></thead>
        <tbody>${gradebooks.map((g: any) => `<tr><td>${escapeHtml(g.subject_name)}</td><td>${escapeHtml(g.class_name)}</td><td>${escapeHtml(g.term_name)}</td><td>${escapeHtml(g.computed_percent)}</td><td>${escapeHtml(g.letter_grade)}</td></tr>`).join('')}</tbody>
      </table>
    `);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">My Grades</h1>
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={downloadSheet} disabled={!gradebooks.length}>
          Preview / Download PDF
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b bg-gray-50 font-medium text-sm text-gray-700">Term gradebook (approved)</div>
        {gradebooks.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No approved gradebook scores yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gradebooks.map((g: any) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{g.subject_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{g.class_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{g.term_name || '-'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">{g.computed_percent}%</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{g.letter_grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b bg-gray-50 font-medium text-sm text-gray-700">Exam results</div>
        {grades.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No exam grades available yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {grades.map((g: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{g.exam_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{g.session_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{g.total_obtained}/{g.total_marks}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">{g.grade}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{g.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
