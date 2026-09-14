import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { parseSpreadsheetFile, downloadTextFile } from '../../utils/spreadsheet';
import { downloadStoredFile } from '../../utils/printDocument';
import RecordActions from '../../components/common/RecordActions';
import { useSchool } from '../../hooks/useSchool';
import { lessonPlanDoc, openSchoolDocument, downloadSchoolPdf } from '../../utils/schoolDocument';

export default function LessonPlansAdminPage() {
  const qc = useQueryClient();
  const { data: school } = useSchool();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_ids: [] as string[],
    subject_ids: [] as string[],
    teacher_ids: [] as string[],
    file_data: '',
    file_name: '',
    mime_type: '',
  });

  const asList = (value: any) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

  const { data, refetch } = useQuery({
    queryKey: ['lesson-plans'],
    queryFn: () => api.get('/lesson-plans').then((r) => r.data),
  });
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then((r) => r.data),
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get('/academics/subjects').then((r) => r.data),
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then((r) => r.data.data || r.data),
  });

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('File must be under 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        file_data: String(reader.result || ''),
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
      }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lesson-plans', form);
      toast.success(form.teacher_ids.length ? 'Lesson plan sent to teachers' : 'Lesson plan saved');
      setShowForm(false);
      setForm({
        title: '', description: '', class_ids: [], subject_ids: [],
        teacher_ids: [], file_data: '', file_name: '', mime_type: '',
      });
      refetch();
      qc.invalidateQueries({ queryKey: ['lesson-plans'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseSpreadsheetFile(file);
      const res = await api.post('/lesson-plans/import', { rows });
      toast.success(`Imported ${res.data.created?.length || 0} lesson plan(s)`);
      if (res.data.errors?.length) toast.error(res.data.errors[0]);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Import failed');
    }
  };

  const preview = (plan: any) => {
    const doc = lessonPlanDoc(plan, school || {});
    openSchoolDocument(doc);
    downloadSchoolPdf(doc);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Create and send lesson plans to teachers</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => downloadTextFile('lesson-plan-template.csv', 'title,description,class,subject,teachers\nWeek 1 Algebra,Introduce variables,Grade 10,Mathematics,Jane Doe\n')}>CSV template</button>
        <label className="btn-secondary cursor-pointer">
          Import CSV/Excel
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => importFile(e.target.files?.[0] || null)} />
        </label>
        <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Lesson Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Classes</label>
              <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1">
                {asList(classes).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.class_ids.includes(c.id)} onChange={() => setForm((prev) => ({ ...prev, class_ids: prev.class_ids.includes(c.id) ? prev.class_ids.filter((id) => id !== c.id) : [...prev.class_ids, c.id] }))} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subjects</label>
              <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1">
                {asList(subjects).map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.subject_ids.includes(s.id)} onChange={() => setForm((prev) => ({ ...prev, subject_ids: prev.subject_ids.includes(s.id) ? prev.subject_ids.filter((id) => id !== s.id) : [...prev.subject_ids, s.id] }))} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Upload file</label>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={(e) => onFile(e.target.files?.[0] || null)} />
              {form.file_name && <p className="text-xs text-gray-500 mt-1">{form.file_name}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Send to teachers</label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {asList(teachers).map((t: any) => {
                  const checked = form.teacher_ids.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((prev) => ({
                            ...prev,
                            teacher_ids: checked
                              ? prev.teacher_ids.filter((id) => id !== t.id)
                              : [...prev.teacher_ids, t.id],
                          }));
                        }}
                      />
                      {t.first_name} {t.last_name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <button type="submit" className="btn-primary">Save &amp; Send</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Class</th>
              <th className="py-2 pr-4">Subject</th>
              <th className="py-2 pr-4">Recipients</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">File</th>
            </tr>
          </thead>
          <tbody>
            {asList(data?.data || data).map((p: any) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium">{p.title}</td>
                <td className="py-2 pr-4">{p.class_name || '—'}</td>
                <td className="py-2 pr-4">{p.subject_name || '—'}</td>
                <td className="py-2 pr-4">{p.recipient_count}</td>
                <td className="py-2 pr-4 capitalize">{p.status}</td>
                <td className="py-2">
                  <button type="button" className="text-primary-600 mr-3" onClick={() => preview(p)}>Preview / PDF</button>
                  <RecordActions resource="lesson_plans" id={p.id} label={p.title} invalidate={['lesson-plans']} fields={[
                    { key: 'title', label: 'Title' },
                    { key: 'description', label: 'Description' },
                  ]} record={p} />
                  {p.file_data ? (
                    <button type="button" className="text-primary-600" onClick={() => downloadStoredFile(p.file_data, p.file_name || 'lesson-plan')}>
                      Download
                    </button>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {!asList(data?.data || data).length && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No lesson plans yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
