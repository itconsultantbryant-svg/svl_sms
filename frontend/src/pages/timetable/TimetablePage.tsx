import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Class, Section, Subject, Employee } from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: '', start_time: '', end_time: '', is_break: false });
  const [termForm, setTermForm] = useState({ session_id: '', name: '', start_date: '', end_date: '' });
  const [entryForm, setEntryForm] = useState({ subject_id: '', teacher_id: '', period_id: '', day_of_week: '0', room: '' });

  const { data: classes } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then(r => r.data),
  });

  const { data: sections } = useQuery<Section[]>({
    queryKey: ['sections', classId],
    queryFn: () => api.get('/academics/sections', { params: { class_id: classId } }).then(r => r.data),
    enabled: !!classId,
  });

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then(r => r.data),
  });

  const { data: teachers } = useQuery<any>({
    queryKey: ['teachers-list'],
    queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then(r => r.data.data),
  });

  const { data: periods } = useQuery<any[]>({
    queryKey: ['periods'],
    queryFn: () => api.get('/timetable/periods').then(r => r.data),
  });

  const { data: timetable } = useQuery<any>({
    queryKey: ['timetable', classId, sectionId],
    queryFn: () => api.get(`/timetable/class/${classId}`, { params: { section_id: sectionId } }).then(r => r.data),
    enabled: !!classId,
  });

  const { data: sessions } = useQuery<any[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then(r => r.data),
  });

  const currentSession = sessions?.find((s: any) => s.is_current);

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/timetable/entries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Entry added');
      setShowForm(false);
      setEntryForm({ subject_id: '', teacher_id: '', period_id: '', day_of_week: '0', room: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/timetable/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Entry removed');
    },
  });

  const addPeriod = useMutation({
    mutationFn: (data: any) => api.post('/timetable/periods', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      toast.success('Period created');
      setPeriodForm({ name: '', start_time: '', end_time: '', is_break: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create period'),
  });

  const addTerm = useMutation({
    mutationFn: (data: any) => api.post('/academics/terms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term created');
      setTermForm({ session_id: '', name: '', start_date: '', end_date: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create term'),
  });

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryForm.period_id || !currentSession) {
      toast.error('Period and active session required');
      return;
    }
    addMutation.mutate({
      class_id: classId,
      section_id: sectionId || undefined,
      subject_id: entryForm.subject_id || undefined,
      teacher_id: entryForm.teacher_id || undefined,
      period_id: entryForm.period_id,
      day_of_week: parseInt(entryForm.day_of_week),
      session_id: currentSession.id,
      room: entryForm.room || undefined,
    });
  };

  const nonBreakPeriods = periods?.filter(p => !p.is_break) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
          <p className="text-sm text-gray-500 mt-1">Create periods and terms, then fill the class timetable</p>
        </div>
        <button type="button" onClick={() => setShowSetup(!showSetup)} className="btn-secondary">
          <Plus size={16} className="mr-2" /> {showSetup ? 'Hide setup' : 'Periods & Terms'}
        </button>
      </div>

      {showSetup && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); addPeriod.mutate({ ...periodForm, sort_order: (periods?.length || 0) + 1 }); }}>
            <h2 className="font-semibold">New period</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input className="input-field" value={periodForm.name} onChange={e => setPeriodForm(f => ({ ...f, name: e.target.value }))} placeholder="Period 1 or Break" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start *</label>
                <input type="time" className="input-field" value={periodForm.start_time} onChange={e => setPeriodForm(f => ({ ...f, start_time: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End *</label>
                <input type="time" className="input-field" value={periodForm.end_time} onChange={e => setPeriodForm(f => ({ ...f, end_time: e.target.value }))} required />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={periodForm.is_break} onChange={e => setPeriodForm(f => ({ ...f, is_break: e.target.checked }))} />
              This is a break
            </label>
            <button className="btn-primary" type="submit" disabled={addPeriod.isPending}>Create period</button>
            <p className="text-xs text-gray-500">{periods?.length || 0} period(s) already set up</p>
          </form>
          <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); addTerm.mutate(termForm); }}>
            <h2 className="font-semibold">New term</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Session *</label>
              <select className="input-field" value={termForm.session_id} onChange={e => setTermForm(f => ({ ...f, session_id: e.target.value }))} required>
                <option value="">Select session</option>
                {(Array.isArray(sessions) ? sessions : []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Term name *</label>
              <input className="input-field" value={termForm.name} onChange={e => setTermForm(f => ({ ...f, name: e.target.value }))} placeholder="Term 1" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start *</label>
                <input type="date" className="input-field" value={termForm.start_date} onChange={e => setTermForm(f => ({ ...f, start_date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End *</label>
                <input type="date" className="input-field" value={termForm.end_date} onChange={e => setTermForm(f => ({ ...f, end_date: e.target.value }))} required />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={addTerm.isPending}>Create term</button>
          </form>
        </div>
      )}

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
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              <Plus size={16} className="mr-2" /> Add Entry
            </button>
          )}
        </div>
      </div>

      {showForm && classId && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Timetable Entry</h2>
          <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day *</label>
              <select value={entryForm.day_of_week} onChange={e => setEntryForm(f => ({ ...f, day_of_week: e.target.value }))} className="input-field">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period *</label>
              <select value={entryForm.period_id} onChange={e => setEntryForm(f => ({ ...f, period_id: e.target.value }))} className="input-field" required>
                <option value="">Select</option>
                {nonBreakPeriods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.start_time}-{p.end_time})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select value={entryForm.subject_id} onChange={e => setEntryForm(f => ({ ...f, subject_id: e.target.value }))} className="input-field">
                <option value="">Select</option>
                {subjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
              <select value={entryForm.teacher_id} onChange={e => setEntryForm(f => ({ ...f, teacher_id: e.target.value }))} className="input-field">
                <option value="">Select</option>
                {(teachers as Employee[] || []).map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary">Add</button>
          </form>
        </div>
      )}

      {classId && timetable && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 py-2 px-3 font-medium text-gray-500 text-left">Period</th>
                {DAYS.map(d => (
                  <th key={d} className="border border-gray-200 py-2 px-3 font-medium text-gray-500 text-center">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(periods || []).map((period: any) => (
                <tr key={period.id} className={period.is_break ? 'bg-yellow-50' : ''}>
                  <td className="border border-gray-200 py-2 px-3">
                    <div className="font-medium text-gray-900">{period.name}</div>
                    <div className="text-xs text-gray-500">{period.start_time} - {period.end_time}</div>
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    if (period.is_break) {
                      return <td key={dayIdx} className="border border-gray-200 py-2 px-3 text-center text-xs text-gray-400">Break</td>;
                    }
                    const entries = (timetable.byDay[dayIdx] || []).filter((e: any) => e.period_id === period.id);
                    return (
                      <td key={dayIdx} className="border border-gray-200 py-2 px-3 text-center">
                        {entries.map((entry: any) => (
                          <div key={entry.id} className="group relative">
                            <div className="text-xs font-medium text-primary-700">{entry.subject_name || '-'}</div>
                            <div className="text-[10px] text-gray-500">{entry.teacher_name || ''}</div>
                            <button
                              onClick={() => deleteMutation.mutate(entry.id)}
                              className="absolute -top-1 -right-1 hidden group-hover:block text-red-400 hover:text-red-600 text-xs"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
