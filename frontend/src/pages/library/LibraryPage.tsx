import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'books' | 'issues' | 'categories';

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('books');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
      </div>
      <div className="flex gap-2 border-b border-gray-200">
        {(['books', 'issues', 'categories'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'books' && <BooksTab />}
      {tab === 'issues' && <IssuesTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

function BooksTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', publisher: '', category_id: '', quantity: '1', rack_number: '', price: '' });

  const { data: categories } = useQuery<any[]>({ queryKey: ['book-categories'], queryFn: () => api.get('/library/categories').then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['books', page, search], queryFn: () => api.get('/library/books', { params: { page, limit: 20, search: search || undefined } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/library/books', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['books'] }); toast.success('Book added'); setShowForm(false); setForm({ title: '', author: '', isbn: '', publisher: '', category_id: '', quantity: '1', rack_number: '', price: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search books..." className="input-field w-64" />
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Book</button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Author</label><input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label><input value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label><input value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="input-field"><option value="">Select</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Rack #</label><input value={form.rack_number} onChange={e => setForm(f => ({ ...f, rack_number: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Price</label><input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, quantity: parseInt(form.quantity) || 1, price: parseFloat(form.price) || 0 })} disabled={!form.title} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Title</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Author</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">ISBN</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Total</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Available</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Rack</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No books found</td></tr>
            : data.data.map((b: any) => (
              <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3 font-medium">{b.title}</td>
                <td className="py-3 px-3">{b.author || '-'}</td>
                <td className="py-3 px-3">{b.category_name || '-'}</td>
                <td className="py-3 px-3 text-gray-500">{b.isbn || '-'}</td>
                <td className="py-3 px-3 text-center">{b.quantity}</td>
                <td className="py-3 px-3 text-center"><span className={b.available > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>{b.available}</span></td>
                <td className="py-3 px-3">{b.rack_number || '-'}</td>
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

function IssuesTab() {
  const queryClient = useQueryClient();
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('issued');
  const [form, setForm] = useState({ book_id: '', issued_to: '', issued_to_type: 'student', issue_date: '', due_date: '' });

  const { data: books } = useQuery<any>({ queryKey: ['books-all'], queryFn: () => api.get('/library/books', { params: { limit: 200, available: '1' } }).then(r => r.data) });
  const { data: students } = useQuery<any>({ queryKey: ['students-lib'], queryFn: () => api.get('/students', { params: { limit: 200 } }).then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['book-issues', page, statusFilter], queryFn: () => api.get('/library/issues', { params: { page, limit: 20, status: statusFilter || undefined } }).then(r => r.data) });

  const issueMutation = useMutation({
    mutationFn: (d: any) => api.post('/library/issue', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['book-issues'] }); queryClient.invalidateQueries({ queryKey: ['books'] }); toast.success('Book issued'); setShowIssueForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.post(`/library/return/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['book-issues'] }); queryClient.invalidateQueries({ queryKey: ['books'] }); toast.success('Book returned'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="issued">Currently Issued</option>
          <option value="returned">Returned</option>
          <option value="">All</option>
        </select>
        <button onClick={() => setShowIssueForm(!showIssueForm)} className="btn-primary"><BookOpen size={16} className="mr-2" /> Issue Book</button>
      </div>

      {showIssueForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Book *</label><select value={form.book_id} onChange={e => setForm(f => ({ ...f, book_id: e.target.value }))} className="input-field"><option value="">Select Book</option>{books?.data?.map((b: any) => <option key={b.id} value={b.id}>{b.title} ({b.available} avail)</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Student *</label><select value={form.issued_to} onChange={e => setForm(f => ({ ...f, issued_to: e.target.value }))} className="input-field"><option value="">Select</option>{students?.data?.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label><input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input-field" /></div>
            <button onClick={() => issueMutation.mutate(form)} disabled={!form.book_id || !form.issued_to || !form.issue_date || !form.due_date} className="btn-primary">Issue</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Book</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Issued To</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Issue Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Due Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Action</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No records</td></tr>
            : data.data.map((issue: any) => (
              <tr key={issue.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{issue.book_title}</td>
                <td className="py-3 px-3">{issue.member_name || issue.issued_to}</td>
                <td className="py-3 px-3">{issue.issue_date}</td>
                <td className="py-3 px-3">{issue.due_date}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${issue.status === 'issued' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{issue.status}</span></td>
                <td className="py-3 px-3">
                  {issue.status === 'issued' && (
                    <button onClick={() => returnMutation.mutate({ id: issue.id, return_date: new Date().toISOString().split('T')[0] })} className="text-primary-600 hover:underline text-xs font-medium"><RotateCcw size={14} className="inline mr-1" />Return</button>
                  )}
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

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const { data: categories } = useQuery<any[]>({ queryKey: ['book-categories'], queryFn: () => api.get('/library/categories').then(r => r.data) });
  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/library/categories', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['book-categories'] }); toast.success('Category added'); setName(''); },
  });

  return (
    <div className="space-y-4">
      <div className="card flex gap-3 items-end">
        <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">New Category</label><input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Category name" /></div>
        <button onClick={() => addMutation.mutate({ name })} disabled={!name} className="btn-primary">Add</button>
      </div>
      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50"><th className="text-left py-3 px-3 font-medium text-gray-500">Name</th></tr></thead>
          <tbody>{categories?.map(c => <tr key={c.id} className="border-b border-gray-100"><td className="py-3 px-3">{c.name}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
