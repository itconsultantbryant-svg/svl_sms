import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'overview' | 'income' | 'expenses' | 'ledger';

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showForm, setShowForm] = useState(false);
  const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        {(tab === 'income' || tab === 'expenses') && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} className="mr-2" /> Add {tab === 'income' ? 'Income' : 'Expense'}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['overview', 'income', 'expenses', 'ledger'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input type="date" value={dateRange.start_date} onChange={e => setDateRange(d => ({ ...d, start_date: e.target.value }))} className="input-field w-auto text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Date</label>
          <input type="date" value={dateRange.end_date} onChange={e => setDateRange(d => ({ ...d, end_date: e.target.value }))} className="input-field w-auto text-sm" />
        </div>
      </div>

      {tab === 'overview' && <OverviewTab dateRange={dateRange} />}
      {tab === 'income' && <IncomeTab dateRange={dateRange} showForm={showForm} setShowForm={setShowForm} />}
      {tab === 'expenses' && <ExpensesTab dateRange={dateRange} showForm={showForm} setShowForm={setShowForm} />}
      {tab === 'ledger' && <LedgerTab dateRange={dateRange} />}
    </div>
  );
}

function OverviewTab({ dateRange }: { dateRange: any }) {
  const { data: report } = useQuery<any>({
    queryKey: ['financial-report', dateRange],
    queryFn: () => api.get('/accounts/report', { params: dateRange }).then(r => r.data),
  });

  if (!report) return <div className="text-center py-8 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Income" value={report.total_income} icon={<TrendingUp size={20} />} color="green" />
        <StatCard label="Fee Collections" value={report.fee_collections} icon={<DollarSign size={20} />} color="blue" />
        <StatCard label="Total Expenses" value={report.total_expenses} icon={<TrendingDown size={20} />} color="red" />
        <StatCard label="Net Income" value={report.net_income} icon={<DollarSign size={20} />} color={report.net_income >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Income by Category</h3>
          {report.income_by_category?.length ? (
            <div className="space-y-2">
              {report.income_by_category.map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{c.category || 'Uncategorized'}</span>
                  <span className="font-medium">${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No income recorded</p>}
        </div>

        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Expenses by Category</h3>
          {report.expense_by_category?.length ? (
            <div className="space-y-2">
              {report.expense_by_category.map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{c.category || 'Uncategorized'}</span>
                  <span className="font-medium">${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No expenses recorded</p>}
        </div>
      </div>

      {(report.monthly_income?.length > 0 || report.monthly_expenses?.length > 0) && (
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Monthly Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-green-600">Income</th>
                  <th className="text-right py-2 px-3 font-medium text-red-600">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly_income.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-3">{m.month}</td>
                    <td className="py-2 px-3 text-right text-green-600">${m.total.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-red-600">${(report.monthly_expenses.find((e: any) => e.month === m.month)?.total || 0).toFixed(2)}</td>
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

function IncomeTab({ dateRange, showForm, setShowForm }: { dateRange: any; showForm: boolean; setShowForm: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ category_id: '', amount: '', date: '', description: '', payment_method: 'cash', reference: '' });

  const { data: categories } = useQuery<any[]>({
    queryKey: ['income-categories'],
    queryFn: () => api.get('/accounts/income-categories').then(r => r.data),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ['income', page, dateRange],
    queryFn: () => api.get('/accounts/income', { params: { page, limit: 20, ...dateRange } }).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounts/income', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['income'] }); toast.success('Income recorded'); setShowForm(false); setForm({ category_id: '', amount: '', date: '', description: '', payment_method: 'cash', reference: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-medium">Record Income</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="input-field">
                <option value="">Select</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="input-field">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, amount: parseFloat(form.amount) })} disabled={!form.amount || !form.date} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Method</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">No income recorded</td></tr>
            ) : data.data.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{item.date}</td>
                <td className="py-3 px-3">{item.category_name || '-'}</td>
                <td className="py-3 px-3 text-gray-500">{item.description || '-'}</td>
                <td className="py-3 px-3 capitalize">{item.payment_method?.replace('_', ' ')}</td>
                <td className="py-3 px-3 text-right font-medium text-green-600">${item.amount.toFixed(2)}</td>
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

function ExpensesTab({ dateRange, showForm, setShowForm }: { dateRange: any; showForm: boolean; setShowForm: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ category_id: '', amount: '', date: '', description: '', vendor: '', payment_method: 'cash', reference: '' });

  const { data: categories } = useQuery<any[]>({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/accounts/expense-categories').then(r => r.data),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ['expenses', page, dateRange],
    queryFn: () => api.get('/accounts/expenses', { params: { page, limit: 20, ...dateRange } }).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounts/expenses', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense recorded'); setShowForm(false); setForm({ category_id: '', amount: '', date: '', description: '', vendor: '', payment_method: 'cash', reference: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-medium">Record Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="input-field">
                <option value="">Select</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="input-field">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="check">Check</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMutation.mutate({ ...form, amount: parseFloat(form.amount) })} disabled={!form.amount || !form.date} className="btn-primary">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Vendor</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Method</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">No expenses recorded</td></tr>
            ) : data.data.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{item.date}</td>
                <td className="py-3 px-3">{item.category_name || '-'}</td>
                <td className="py-3 px-3">{item.vendor || '-'}</td>
                <td className="py-3 px-3 text-gray-500">{item.description || '-'}</td>
                <td className="py-3 px-3 capitalize">{item.payment_method?.replace('_', ' ')}</td>
                <td className="py-3 px-3 text-right font-medium text-red-600">${item.amount.toFixed(2)}</td>
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

function LedgerTab({ dateRange }: { dateRange: any }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['ledger', dateRange],
    queryFn: () => api.get('/accounts/ledger', { params: dateRange }).then(r => r.data),
  });

  const typeColors: Record<string, string> = {
    income: 'bg-green-100 text-green-700',
    expense: 'bg-red-100 text-red-700',
    fee_payment: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-4">
      {data?.totals && (
        <div className="flex gap-6 text-sm">
          <span>Total Credit: <strong className="text-green-600">${data.totals.total_credit?.toFixed(2)}</strong></span>
          <span>Total Debit: <strong className="text-red-600">${data.totals.total_debit?.toFixed(2)}</strong></span>
          <span>Net: <strong className={(data.totals.total_credit - data.totals.total_debit) >= 0 ? 'text-green-600' : 'text-red-600'}>${(data.totals.total_credit - data.totals.total_debit).toFixed(2)}</strong></span>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Method</th>
              <th className="text-right py-3 px-3 font-medium text-green-600">Credit</th>
              <th className="text-right py-3 px-3 font-medium text-red-600">Debit</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.entries?.length ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No entries</td></tr>
            ) : data.entries.map((e: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 px-3">{e.date}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[e.type] || ''}`}>
                    {e.type?.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-3">{e.category || '-'}</td>
                <td className="py-3 px-3 text-gray-500">{e.description || '-'}</td>
                <td className="py-3 px-3 capitalize">{e.payment_method?.replace('_', ' ') || '-'}</td>
                <td className="py-3 px-3 text-right text-green-600">{e.credit > 0 ? `$${e.credit.toFixed(2)}` : '-'}</td>
                <td className="py-3 px-3 text-right text-red-600">{e.debit > 0 ? `$${e.debit.toFixed(2)}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color] || colors.blue}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold">${(value || 0).toFixed(2)}</p>
      </div>
    </div>
  );
}
