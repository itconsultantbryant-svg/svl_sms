import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import GradesheetView, { printGradesheet, GradesheetData } from '../../components/gradesheet/GradesheetView';

export default function StudentGradesPage() {
  const [mode, setMode] = useState<'term' | 'year'>('year');
  const [termId, setTermId] = useState('');

  const { data: terms } = useQuery<any[]>({
    queryKey: ['terms-current'],
    queryFn: () => api.get('/academics/terms').then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),
  });

  const { data, isLoading, error } = useQuery<GradesheetData>({
    queryKey: ['student-gradesheet', mode, termId],
    queryFn: () => api.get('/gradebook/gradesheet/me', {
      params: { mode, term_id: mode === 'term' ? termId || undefined : undefined },
    }).then((r) => r.data),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gradesheet</h1>
          <p className="text-sm text-gray-500">Term sheets and the full yearly transcript with promotion status</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input-field w-auto" value={mode} onChange={(e) => setMode(e.target.value as 'term' | 'year')}>
            <option value="year">Yearly / full transcript</option>
            <option value="term">Term / semester</option>
          </select>
          {mode === 'term' && (
            <select className="input-field w-auto" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">All available terms</option>
              {(terms || []).map((term: any) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          )}
          <button type="button" className="btn-secondary text-sm" onClick={() => printGradesheet(data)}>
            Preview / Download PDF
          </button>
        </div>
      </div>
      <GradesheetView sheet={data} />
    </div>
  );
}
