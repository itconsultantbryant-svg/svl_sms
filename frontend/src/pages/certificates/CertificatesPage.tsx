import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'certificates' | 'templates' | 'id-cards';

export default function CertificatesPage() {
  const [tab, setTab] = useState<Tab>('certificates');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Certificates & ID Cards</h1>
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('certificates')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'certificates' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>Certificates</button>
        <button onClick={() => setTab('templates')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'templates' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>Templates</button>
        <button onClick={() => setTab('id-cards')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'id-cards' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>ID Cards</button>
      </div>
      {tab === 'certificates' && <CertificatesTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'id-cards' && <IdCardsTab />}
    </div>
  );
}

function CertificatesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [viewCert, setViewCert] = useState<any>(null);
  const [form, setForm] = useState({ template_id: '', student_id: '', issued_date: '' });

  const { data: templates } = useQuery<any[]>({ queryKey: ['cert-templates'], queryFn: () => api.get('/certificates/templates').then(r => r.data) });
  const { data: students } = useQuery<any>({ queryKey: ['students-cert'], queryFn: () => api.get('/students', { params: { limit: 200 } }).then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['certificates', page], queryFn: () => api.get('/certificates', { params: { page, limit: 20 } }).then(r => r.data) });

  const genMutation = useMutation({
    mutationFn: (d: any) => api.post('/certificates/generate', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['certificates'] }); toast.success('Certificate generated'); setShowForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  if (viewCert) {
    return (
      <div className="space-y-4">
        <button onClick={() => setViewCert(null)} className="btn-secondary text-sm">Back</button>
        <div className="card max-w-3xl mx-auto p-8 print:shadow-none" id="certificate">
          {viewCert.institution && <div className="text-center border-b pb-4 mb-6">
            <h2 className="text-xl font-bold">{viewCert.institution.name}</h2>
            <p className="text-sm text-gray-500">{viewCert.institution.address}</p>
          </div>}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-primary-700">{viewCert.certificate.template_name}</h3>
            <p className="text-sm text-gray-500">Certificate #{viewCert.certificate.certificate_number}</p>
          </div>
          <div className="prose max-w-none text-center" dangerouslySetInnerHTML={{ __html: viewCert.certificate.content?.replace(/\n/g, '<br/>') }} />
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Date: {viewCert.certificate.issued_date}</p>
          </div>
          <div className="mt-6 text-center print:hidden">
            <button onClick={() => window.print()} className="btn-primary"><Printer size={16} className="mr-2" /> Print</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Generate Certificate</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Template *</label><select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))} className="input-field"><option value="">Select</option>{templates?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Student *</label><select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} className="input-field"><option value="">Select</option>{students?.data?.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {s.admission_number}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label><input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} className="input-field" /></div>
            <button onClick={() => genMutation.mutate(form)} disabled={!form.template_id || !form.student_id || !form.issued_date} className="btn-primary">Generate</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Certificate #</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Student</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Template</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Issued</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Action</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No certificates generated</td></tr>
            : data.data.map((c: any) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium text-primary-600">{c.certificate_number}</td>
                <td className="py-3 px-3">{c.first_name} {c.last_name}</td>
                <td className="py-3 px-3">{c.template_name}</td>
                <td className="py-3 px-3 capitalize">{c.template_type}</td>
                <td className="py-3 px-3">{c.issued_date}</td>
                <td className="py-3 px-3">
                  <button onClick={async () => { const res = await api.get(`/certificates/${c.id}`); setViewCert(res.data); }} className="text-primary-600 hover:underline text-xs font-medium"><FileText size={14} className="inline mr-1" />View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'custom', content: '' });

  const { data: templates } = useQuery<any[]>({ queryKey: ['cert-templates'], queryFn: () => api.get('/certificates/templates').then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/certificates/templates', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cert-templates'] }); toast.success('Template created'); setShowForm(false); setForm({ name: '', type: 'custom', content: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Template</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field"><option value="custom">Custom</option><option value="transfer">Transfer</option><option value="character">Character</option><option value="bonafide">Bonafide</option><option value="completion">Completion</option></select></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content * <span className="text-gray-400 font-normal">(Use {'{{student_name}}'}, {'{{class}}'}, {'{{date}}'}, {'{{certificate_number}}'})</span></label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="input-field" rows={6} placeholder="This is to certify that {{student_name}} of class {{class}}..." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate(form)} disabled={!form.name || !form.content} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!templates?.length ? <p className="col-span-3 text-center py-8 text-gray-400">No templates</p> : templates.map(t => (
          <div key={t.id} className="card">
            <h3 className="font-medium text-gray-900">{t.name}</h3>
            <p className="text-sm text-gray-500 capitalize mt-1">{t.type}</p>
            <p className="text-xs text-gray-400 mt-2 line-clamp-3">{t.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdCardsTab() {
  const [studentId, setStudentId] = useState('');
  const [cardData, setCardData] = useState<any>(null);

  const { data: students } = useQuery<any>({ queryKey: ['students-id'], queryFn: () => api.get('/students', { params: { limit: 200 } }).then(r => r.data) });

  const loadCard = async () => {
    if (!studentId) return;
    const res = await api.get(`/certificates/id-cards/student/${studentId}`);
    setCardData(res.data);
  };

  return (
    <div className="space-y-4">
      <div className="card flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input-field">
            <option value="">Select</option>
            {students?.data?.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {s.admission_number}</option>)}
          </select>
        </div>
        <button onClick={loadCard} disabled={!studentId} className="btn-primary">Generate Preview</button>
      </div>

      {cardData && (
        <div className="flex justify-center">
          <div className="w-[350px] bg-white rounded-lg shadow-lg border-2 border-primary-600 overflow-hidden print:shadow-none" id="id-card">
            <div className="bg-primary-700 text-white text-center py-3 px-4">
              <h3 className="font-bold text-sm">{cardData.institution?.name || 'School Name'}</h3>
              <p className="text-[10px] opacity-80">{cardData.institution?.address || ''}</p>
            </div>
            <div className="p-4 text-center">
              <div className="w-20 h-20 mx-auto bg-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-400 mb-3">
                {cardData.student.first_name[0]}{cardData.student.last_name[0]}
              </div>
              <h4 className="font-bold text-gray-900">{cardData.student.first_name} {cardData.student.last_name}</h4>
              <p className="text-sm text-gray-500">{cardData.student.class_name} {cardData.student.section_name || ''}</p>
            </div>
            <div className="px-4 pb-4 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Adm No:</span><span className="font-medium">{cardData.student.admission_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Gender:</span><span className="capitalize">{cardData.student.gender}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">DOB:</span><span>{cardData.student.date_of_birth}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Blood Group:</span><span>{cardData.student.blood_group || '-'}</span></div>
              {cardData.parent && <div className="flex justify-between"><span className="text-gray-500">Guardian:</span><span>{cardData.parent.first_name} {cardData.parent.last_name}</span></div>}
            </div>
            <div className="bg-primary-700 text-white text-center py-2 text-[10px]">
              {cardData.institution?.phone} | {cardData.institution?.email}
            </div>
          </div>
        </div>
      )}
      {cardData && (
        <div className="text-center print:hidden">
          <button onClick={() => window.print()} className="btn-primary"><Printer size={16} className="mr-2" /> Print ID Card</button>
        </div>
      )}
    </div>
  );
}
