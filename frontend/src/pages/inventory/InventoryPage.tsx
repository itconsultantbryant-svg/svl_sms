import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'items' | 'transactions' | 'categories';

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('items');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {(['items', 'transactions', 'categories'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'items' && <ItemsTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

function ItemsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', sku: '', quantity: '0', min_quantity: '5', unit: 'piece', unit_price: '', location: '' });

  const { data: categories } = useQuery<any[]>({ queryKey: ['inv-categories'], queryFn: () => api.get('/inventory/categories').then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['inv-items', page, search], queryFn: () => api.get('/inventory/items', { params: { page, limit: 20, search: search || undefined } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/inventory/items', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inv-items'] }); toast.success('Item added'); setShowForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search items..." className="input-field w-64" />
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Item</button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="input-field"><option value="">Select</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">SKU</label><input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit</label><input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Min Qty (alert)</label><input type="number" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label><input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="input-field" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, quantity: parseInt(form.quantity), min_quantity: parseInt(form.min_quantity), unit_price: parseFloat(form.unit_price) || 0 })} disabled={!form.name} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">SKU</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Qty</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Unit</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Price</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Location</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No items</td></tr>
            : data.data.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3 font-medium">{item.name}</td>
                <td className="py-3 px-3">{item.category_name || '-'}</td>
                <td className="py-3 px-3 text-gray-500">{item.sku || '-'}</td>
                <td className="py-3 px-3 text-center">
                  <span className={item.quantity <= item.min_quantity ? 'text-red-600 font-medium' : ''}>{item.quantity}</span>
                  {item.quantity <= item.min_quantity && <AlertTriangle size={14} className="inline ml-1 text-red-500" />}
                </td>
                <td className="py-3 px-3">{item.unit}</td>
                <td className="py-3 px-3 text-right">${item.unit_price.toFixed(2)}</td>
                <td className="py-3 px-3">{item.location || '-'}</td>
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

function TransactionsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ item_id: '', type: 'purchase', quantity: '', unit_price: '', date: '', vendor: '', notes: '' });

  const { data: items } = useQuery<any>({ queryKey: ['inv-items-all'], queryFn: () => api.get('/inventory/items', { params: { limit: 200 } }).then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['inv-transactions', page], queryFn: () => api.get('/inventory/transactions', { params: { page, limit: 20 } }).then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/inventory/transactions', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inv-transactions'] }); queryClient.invalidateQueries({ queryKey: ['inv-items'] }); toast.success('Transaction recorded'); setShowForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);
  const typeColors: Record<string, string> = { purchase: 'bg-green-100 text-green-700', issue: 'bg-red-100 text-red-700', return: 'bg-blue-100 text-blue-700', adjustment: 'bg-gray-100 text-gray-700' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> New Transaction</button></div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Item *</label><select value={form.item_id} onChange={e => setForm(f => ({ ...f, item_id: e.target.value }))} className="input-field"><option value="">Select</option>{items?.data?.map((i: any) => <option key={i.id} value={i.id}>{i.name} (Qty: {i.quantity})</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field"><option value="purchase">Purchase</option><option value="issue">Issue</option><option value="return">Return</option><option value="adjustment">Adjustment</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label><input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label><input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label><input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field" /></div>
            <button onClick={() => addMutation.mutate({ ...form, quantity: parseInt(form.quantity), unit_price: parseFloat(form.unit_price) || undefined })} disabled={!form.item_id || !form.quantity || !form.date} className="btn-primary">Record</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Item</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Qty</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Total</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">By</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No transactions</td></tr>
            : data.data.map((t: any) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{t.date}</td>
                <td className="py-3 px-3 font-medium">{t.item_name}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[t.type] || ''}`}>{t.type}</span></td>
                <td className="py-3 px-3 text-center">{t.quantity}</td>
                <td className="py-3 px-3 text-right">${t.total_price.toFixed(2)}</td>
                <td className="py-3 px-3 text-gray-500">{t.created_by_name || '-'}</td>
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
  const { data: categories } = useQuery<any[]>({ queryKey: ['inv-categories'], queryFn: () => api.get('/inventory/categories').then(r => r.data) });
  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/inventory/categories', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inv-categories'] }); toast.success('Category added'); setName(''); },
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
