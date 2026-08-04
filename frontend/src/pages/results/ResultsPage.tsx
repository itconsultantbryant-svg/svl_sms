import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Class, Section } from '../../types';

export default function ResultsPage() {
  const { examId } = useParams();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const { data: exam } = useQuery<any>({
    queryKey: ['exam', examId],
    queryFn: () => api.get(`/examinations/exams/${examId}`).then(r => r.data),
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then(r => r.data),
  });

  const { data: sections } = useQuery<Section[]>({
    queryKey: ['sections', classId],
    queryFn: () => api.get('/academics/sections', { params: { class_id: classId } }).then(r => r.data),
    enabled: !!classId,
  });

  const { data: results } = useQuery<any[]>({
    queryKey: ['results', examId, classId, sectionId],
    queryFn: () => api.get(`/results/exam/${examId}`, { params: { class_id: classId, section_id: sectionId } }).then(r => r.data),
    enabled: !!examId && !!classId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/results/generate/${examId}`, { class_id: classId, section_id: sectionId || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast.success(res.data.message);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to generate results'),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.put(`/results/publish/${examId}`, { class_id: classId, section_id: sectionId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast.success('Results published successfully');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/examinations" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.name || 'Exam'} - Results</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and manage exam results</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="input-field">
              <option value="">Select Class</option>
              {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="input-field">
              <option value="">All</option>
              {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {classId && (
            <>
              <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary">
                {generateMutation.isPending ? 'Generating...' : 'Generate Results'}
              </button>
              {results && results.length > 0 && (
                <button onClick={() => publishMutation.mutate()} className="btn-secondary">
                  Publish Results
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {results && results.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Results ({results.length} students)</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Rank</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Admission #</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Total</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Obtained</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Percentage</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Grade</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Report Card</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${r.status === 'fail' ? 'bg-red-50' : ''}`}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        {r.rank <= 3 && <Award size={14} className={r.rank === 1 ? 'text-yellow-500' : r.rank === 2 ? 'text-gray-400' : 'text-orange-400'} />}
                        <span className="font-medium">{r.rank}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-primary-600 font-medium">{r.admission_number}</td>
                    <td className="py-3 px-3">{r.first_name} {r.last_name}</td>
                    <td className="py-3 px-3">{r.total_marks}</td>
                    <td className="py-3 px-3 font-medium">{r.total_obtained}</td>
                    <td className="py-3 px-3 font-medium">{r.percentage}%</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-sm">
                        {r.grade}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Link to={`/results/report-card/${r.student_id}/${examId}`} className="text-primary-600 hover:text-primary-800">
                        <FileText size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
