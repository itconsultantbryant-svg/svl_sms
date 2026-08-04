import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Bell, Mail, MessageSquare, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'sms' | 'email' | 'announcements' | 'templates' | 'log';

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>('sms');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(['sms', 'email', 'announcements', 'templates', 'log'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
            {t === 'log' ? 'Activity Log' : t}
          </button>
        ))}
      </div>
      {tab === 'sms' && <SMSTab />}
      {tab === 'email' && <EmailTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'log' && <LogTab />}
    </div>
  );
}

function SMSTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ recipient_type: 'individual', phone_numbers: '', message: '' });

  const { data, isLoading } = useQuery<any>({ queryKey: ['sms', page], queryFn: () => api.get('/communication/sms', { params: { page, limit: 20 } }).then(r => r.data) });

  const sendMutation = useMutation({
    mutationFn: (d: any) => api.post('/communication/sms', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms'] }); toast.success('SMS sent'); setShowForm(false); setForm({ recipient_type: 'individual', phone_numbers: '', message: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);
  const statusColors: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', queued: 'bg-yellow-100 text-yellow-700', sending: 'bg-blue-100 text-blue-700', sent: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Send SMS</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type *</label>
              <select value={form.recipient_type} onChange={e => setForm(f => ({ ...f, recipient_type: e.target.value }))} className="input-field">
                <option value="individual">Individual</option>
                <option value="all_parents">All Parents</option>
                <option value="all_students">All Students</option>
                <option value="all_staff">All Staff</option>
                <option value="class">Specific Class</option>
              </select>
            </div>
            {form.recipient_type === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Numbers * (comma-separated)</label>
                <input value={form.phone_numbers} onChange={e => setForm(f => ({ ...f, phone_numbers: e.target.value }))} className="input-field" placeholder="+231777000000, +231888000001" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message * ({form.message.length}/160)</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} className="input-field" maxLength={160} placeholder="Enter your message..."></textarea>
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendMutation.mutate(form)} disabled={!form.message || (form.recipient_type === 'individual' && !form.phone_numbers)} className="btn-primary"><Send size={16} className="mr-2" /> Send Now</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Sent</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Sender</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Recipients</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Message</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No SMS messages</td></tr>
            : data.data.map((sms: any) => (
              <tr key={sms.id} className="border-b border-gray-100">
                <td className="py-3 px-3 text-gray-500 text-xs">{new Date(sms.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-3">{sms.sender_name || '-'}</td>
                <td className="py-3 px-3 capitalize text-xs">{sms.recipient_type.replace('_', ' ')}</td>
                <td className="py-3 px-3 text-center">{sms.sent_count}/{sms.total_recipients}</td>
                <td className="py-3 px-3 text-gray-600 truncate max-w-xs">{sms.message}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sms.status] || ''}`}>{sms.status}</span></td>
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

function EmailTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ recipient_type: 'individual', email_addresses: '', subject: '', body: '', is_html: false });

  const { data, isLoading } = useQuery<any>({ queryKey: ['emails', page], queryFn: () => api.get('/communication/emails', { params: { page, limit: 20 } }).then(r => r.data) });

  const sendMutation = useMutation({
    mutationFn: (d: any) => api.post('/communication/emails', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['emails'] }); toast.success('Email sent'); setShowForm(false); setForm({ recipient_type: 'individual', email_addresses: '', subject: '', body: '', is_html: false }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);
  const statusColors: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', queued: 'bg-yellow-100 text-yellow-700', sending: 'bg-blue-100 text-blue-700', sent: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Send Email</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type *</label>
              <select value={form.recipient_type} onChange={e => setForm(f => ({ ...f, recipient_type: e.target.value }))} className="input-field">
                <option value="individual">Individual</option>
                <option value="all_parents">All Parents</option>
                <option value="all_students">All Students</option>
                <option value="all_staff">All Staff</option>
                <option value="class">Specific Class</option>
              </select>
            </div>
            {form.recipient_type === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses * (comma-separated)</label>
                <input value={form.email_addresses} onChange={e => setForm(f => ({ ...f, email_addresses: e.target.value }))} className="input-field" placeholder="email1@example.com, email2@example.com" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} className="input-field" placeholder="Enter your message..."></textarea>
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendMutation.mutate(form)} disabled={!form.subject || !form.body || (form.recipient_type === 'individual' && !form.email_addresses)} className="btn-primary"><Send size={16} className="mr-2" /> Send Now</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Sent</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Sender</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Recipients</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Subject</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No emails</td></tr>
            : data.data.map((email: any) => (
              <tr key={email.id} className="border-b border-gray-100">
                <td className="py-3 px-3 text-gray-500 text-xs">{new Date(email.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-3">{email.sender_name || '-'}</td>
                <td className="py-3 px-3 capitalize text-xs">{email.recipient_type.replace('_', ' ')}</td>
                <td className="py-3 px-3 text-center">{email.sent_count}/{email.total_recipients}</td>
                <td className="py-3 px-3 font-medium truncate max-w-xs">{email.subject}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[email.status] || ''}`}>{email.status}</span></td>
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

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: '', content: '', type: 'general', priority: 'normal', audience: 'all', is_published: false });

  const { data, isLoading } = useQuery<any>({ queryKey: ['announcements', page], queryFn: () => api.get('/communication/announcements', { params: { page, limit: 20 } }).then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/communication/announcements', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement created'); setShowForm(false); setForm({ title: '', content: '', type: 'general', priority: 'normal', audience: 'all', is_published: false }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/communication/announcements/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement updated'); setShowForm(false); setEditId(null); setForm({ title: '', content: '', type: 'general', priority: 'normal', audience: 'all', is_published: false }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/communication/announcements/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement deleted'); },
  });

  const handleEdit = (ann: any) => {
    setEditId(ann.id);
    setForm({ title: ann.title, content: ann.content, type: ann.type, priority: ann.priority, audience: ann.audience, is_published: ann.is_published === 1 });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / 20);
  const typeColors: Record<string, string> = { general: 'bg-gray-100 text-gray-700', academic: 'bg-blue-100 text-blue-700', event: 'bg-purple-100 text-purple-700', emergency: 'bg-red-100 text-red-700', holiday: 'bg-green-100 text-green-700', exam: 'bg-yellow-100 text-yellow-700' };
  const priorityColors: Record<string, string> = { low: 'bg-gray-100 text-gray-600', normal: 'bg-blue-100 text-blue-600', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: '', content: '', type: 'general', priority: 'normal', audience: 'all', is_published: false }); }} className="btn-primary"><Plus size={16} className="mr-2" /> New Announcement</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="event">Event</option>
                <option value="emergency">Emergency</option>
                <option value="holiday">Holiday</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input-field">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className="input-field">
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
                <option value="teachers">Teachers</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} className="input-field" placeholder="Enter announcement content..."></textarea>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="rounded" />
            <label className="text-sm text-gray-700">Publish immediately</label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={!form.title || !form.content} className="btn-primary">{editId ? 'Update' : 'Create'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? <div className="col-span-2 py-12 text-center text-gray-400">Loading...</div>
        : !data?.data?.length ? <div className="col-span-2 py-12 text-center text-gray-400">No announcements</div>
        : data.data.map((ann: any) => (
          <div key={ann.id} className="card border-l-4" style={{ borderLeftColor: ann.priority === 'urgent' ? '#dc2626' : ann.priority === 'high' ? '#f97316' : '#3b82f6' }}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[ann.type] || ''}`}>{ann.type}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[ann.priority] || ''}`}>{ann.priority}</span>
                {ann.is_published === 1 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Published</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(ann)} className="text-primary-600 hover:underline text-xs">Edit</button>
                <button onClick={() => deleteMutation.mutate(ann.id)} className="text-red-600 hover:underline text-xs">Delete</button>
              </div>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{ann.title}</h3>
            <p className="text-sm text-gray-600 mb-3">{ann.content}</p>
            <div className="text-xs text-gray-400 flex justify-between">
              <span>For: {ann.audience}</span>
              <span>{new Date(ann.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm px-3 py-1">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'sms', event: '', subject: '', body: '', variables: '' });

  const { data: templates } = useQuery<any[]>({ queryKey: ['templates'], queryFn: () => api.get('/communication/templates').then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/communication/templates', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template created'); setShowForm(false); setForm({ name: '', type: 'sms', event: '', subject: '', body: '', variables: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/communication/templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Template</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
              <input value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} className="input-field" placeholder="e.g., fee_reminder" />
            </div>
          </div>
          {(form.type === 'email' || form.type === 'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body * (use {'{{variable}}'} for placeholders)</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className="input-field" placeholder="Dear {{name}}, your fee of {{amount}} is due..."></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variables (comma-separated)</label>
            <input value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))} className="input-field" placeholder="name, amount, due_date" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.type || !form.event || !form.body} className="btn-primary">Create</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Event</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Body</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {!templates?.length ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">No templates</td></tr>
            : templates.map(tpl => (
              <tr key={tpl.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{tpl.name}</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{tpl.type}</span></td>
                <td className="py-3 px-3 text-gray-600">{tpl.event}</td>
                <td className="py-3 px-3 text-gray-500 truncate max-w-xs">{tpl.body}</td>
                <td className="py-3 px-3">
                  <button onClick={() => deleteMutation.mutate(tpl.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogTab() {
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('');

  const { data, isLoading } = useQuery<any>({ queryKey: ['comm-log', page, channel], queryFn: () => api.get('/communication/log', { params: { page, limit: 50, channel: channel || undefined } }).then(r => r.data) });

  const totalPages = Math.ceil((data?.total || 0) / 50);
  const channelIcons: Record<string, any> = { sms: MessageSquare, email: Mail, notification: Bell };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select value={channel} onChange={e => { setChannel(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Channels</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
          <option value="notification">Notification</option>
        </select>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Time</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Channel</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Sender</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Recipient</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Subject/Content</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No activity</td></tr>
            : data.data.map((log: any) => {
              const Icon = channelIcons[log.channel] || FileText;
              return (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <Icon size={14} className="text-gray-400" />
                      <span className="capitalize">{log.channel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">{log.sender_name || '-'}</td>
                  <td className="py-3 px-3 text-gray-600">{log.recipient}</td>
                  <td className="py-3 px-3 truncate max-w-xs text-gray-500">{log.subject || log.content}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{log.status}</span></td>
                </tr>
              );
            })}
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
