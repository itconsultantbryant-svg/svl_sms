import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'visitors' | 'calls' | 'postal';

export default function ReceptionPage() {
  const [tab, setTab] = useState<Tab>('visitors');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reception</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {(['visitors', 'calls', 'postal'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'visitors' && <VisitorsTab />}
      {tab === 'calls' && <CallsTab />}
      {tab === 'postal' && <PostalTab />}
    </div>
  );
}

function VisitorsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', purpose: '', to_meet: '', id_type: '', id_number: '', check_in: '' });

  const { data, isLoading } = useQuery<any>({ queryKey: ['visitors', page], queryFn: () => api.get('/reception/visitors', { params: { page, limit: 20 } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/reception/visitors', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visitor checked in'); setShowForm(false); setForm({ name: '', phone: '', purpose: '', to_meet: '', id_type: '', id_number: '', check_in: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (id: string) => api.put(`/reception/visitors/${id}/checkout`, { check_out: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visitor checked out'); },
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Check In Visitor</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label><input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">To Meet</label><input value={form.to_meet} onChange={e => setForm(f => ({ ...f, to_meet: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label><select value={form.id_type} onChange={e => setForm(f => ({ ...f, id_type: e.target.value }))} className="input-field"><option value="">Select</option><option value="national_id">National ID</option><option value="passport">Passport</option><option value="drivers_license">Driver's License</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label><input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time *</label><input type="datetime-local" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} className="input-field" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate(form)} disabled={!form.name || !form.check_in} className="btn-primary">Check In</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Phone</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Purpose</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">To Meet</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Check In</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Check Out</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Action</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No visitors</td></tr>
            : data.data.map((v: any) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{v.name}</td>
                <td className="py-3 px-3">{v.phone || '-'}</td>
                <td className="py-3 px-3">{v.purpose || '-'}</td>
                <td className="py-3 px-3">{v.to_meet || '-'}</td>
                <td className="py-3 px-3 text-xs">{v.check_in?.replace('T', ' ').slice(0, 16)}</td>
                <td className="py-3 px-3 text-xs">{v.check_out ? v.check_out.replace('T', ' ').slice(0, 16) : <span className="text-green-600 font-medium">In premises</span>}</td>
                <td className="py-3 px-3">
                  {!v.check_out && <button onClick={() => checkoutMutation.mutate(v.id)} className="text-red-600 hover:underline text-xs font-medium"><LogOut size={14} className="inline mr-1" />Check Out</button>}
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

function CallsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ call_type: 'incoming', caller_name: '', phone: '', purpose: '', date: '', duration: '', notes: '' });

  const { data, isLoading } = useQuery<any>({ queryKey: ['phone-calls'], queryFn: () => api.get('/reception/calls', { params: { page: 1, limit: 50 } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/reception/calls', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['phone-calls'] }); toast.success('Call logged'); setShowForm(false); setForm({ call_type: 'incoming', caller_name: '', phone: '', purpose: '', date: '', duration: '', notes: '' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Log Call</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.call_type} onChange={e => setForm(f => ({ ...f, call_type: e.target.value }))} className="input-field"><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Caller Name</label><input value={form.caller_name} onChange={e => setForm(f => ({ ...f, caller_name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label><input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration</label><input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="input-field" placeholder="e.g. 5 min" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" /></div>
            <button onClick={() => addMutation.mutate(form)} disabled={!form.date} className="btn-primary">Save</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Caller</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Phone</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Purpose</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Duration</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No calls</td></tr>
            : data.data.map((c: any) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{c.date}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.call_type === 'incoming' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{c.call_type}</span></td>
                <td className="py-3 px-3">{c.caller_name || '-'}</td>
                <td className="py-3 px-3">{c.phone || '-'}</td>
                <td className="py-3 px-3">{c.purpose || '-'}</td>
                <td className="py-3 px-3">{c.duration || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostalTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'incoming', reference_number: '', from_to: '', date: '', description: '', received_by: '' });

  const { data, isLoading } = useQuery<any>({ queryKey: ['postal'], queryFn: () => api.get('/reception/postal', { params: { page: 1, limit: 50 } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/reception/postal', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['postal'] }); toast.success('Record added'); setShowForm(false); setForm({ type: 'incoming', reference_number: '', from_to: '', date: '', description: '', received_by: '' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Record</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field"><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label><input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">From/To</label><input value={form.from_to} onChange={e => setForm(f => ({ ...f, from_to: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Received By</label><input value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))} className="input-field" /></div>
            <button onClick={() => addMutation.mutate(form)} disabled={!form.date} className="btn-primary">Save</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Reference</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">From/To</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">No records</td></tr>
            : data.data.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{r.date}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'incoming' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{r.type}</span></td>
                <td className="py-3 px-3">{r.reference_number || '-'}</td>
                <td className="py-3 px-3">{r.from_to || '-'}</td>
                <td className="py-3 px-3">{r.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
