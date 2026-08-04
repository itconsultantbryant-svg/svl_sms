import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function MarksEntryPage() {
  const { examId } = useParams();
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [marks, setMarks] = useState<Record<string, { marks_obtained: string; is_absent: boolean }>>({});

  const { data: exam } = useQuery<any>({
    queryKey: ['exam', examId],
    queryFn: () => api.get(`/examinations/exams/${examId}`).then(r => r.data),
  });

  const { data: scheduleData } = useQuery<any>({
    queryKey: ['marks-schedule', selectedSchedule],
    queryFn: () => api.get(`/marks/schedule/${selectedSchedule}`).then(r => r.data),
    enabled: !!selectedSchedule,
  });

  useEffect(() => {
    if (scheduleData?.students) {
      const initial: Record<string, { marks_obtained: string; is_absent: boolean }> = {};
      scheduleData.students.forEach((s: any) => {
        initial[s.id] = {
          marks_obtained: s.marks_obtained?.toString() || '',
          is_absent: Boolean(s.is_absent),
        };
      });
      setMarks(initial);
    }
  }, [scheduleData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post(`/marks/schedule/${selectedSchedule}`, data),
    onSuccess: () => toast.success('Marks saved successfully'),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save marks'),
  });

  const handleSave = () => {
    const marksArray = Object.entries(marks).map(([student_id, m]) => ({
      student_id,
      marks_obtained: m.is_absent ? null : parseFloat(m.marks_obtained) || 0,
      is_absent: m.is_absent,
    }));
    saveMutation.mutate({ marks: marksArray });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/examinations" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.name || 'Exam'} - Marks Entry</h1>
          <p className="text-sm text-gray-500 mt-1">Enter student marks by subject</p>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Subject Schedule</label>
        <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)} className="input-field max-w-md">
          <option value="">Select a schedule</option>
          {exam?.schedules?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.subject_name} - {s.class_name} {s.section_name || ''} ({s.date})</option>
          ))}
        </select>
      </div>

      {selectedSchedule && scheduleData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{scheduleData.schedule.subject_name}</h2>
              <p className="text-sm text-gray-500">
                {scheduleData.schedule.class_name} {scheduleData.schedule.section_name || ''} |
                Max: {scheduleData.schedule.max_marks} | Pass: {scheduleData.schedule.pass_marks}
              </p>
            </div>
            <button onClick={handleSave} disabled={saveMutation.isPending} className="btn-primary">
              <Save size={16} className="mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Marks'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">#</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Admission #</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Student Name</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Marks (/{scheduleData.schedule.max_marks})</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">Absent</th>
                </tr>
              </thead>
              <tbody>
                {scheduleData.students.map((student: any, idx: number) => (
                  <tr key={student.id} className={`border-b border-gray-100 ${marks[student.id]?.is_absent ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3 text-primary-600 font-medium">{student.admission_number}</td>
                    <td className="py-2 px-3">{student.first_name} {student.last_name}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        max={scheduleData.schedule.max_marks}
                        value={marks[student.id]?.marks_obtained || ''}
                        onChange={e => setMarks(prev => ({ ...prev, [student.id]: { ...prev[student.id], marks_obtained: e.target.value } }))}
                        disabled={marks[student.id]?.is_absent}
                        className="input-field w-24"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={marks[student.id]?.is_absent || false}
                        onChange={e => setMarks(prev => ({ ...prev, [student.id]: { marks_obtained: '', is_absent: e.target.checked } }))}
                        className="w-4 h-4 rounded"
                      />
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
