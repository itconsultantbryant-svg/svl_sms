import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['invoices', page, status],
    queryFn: () => api.get('/fees/invoices', { params: { page, limit: 20, status: status || undefined } }).then(r => r.data),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    unpaid: 'bg-red-100 text-red-700',
    overdue: 'bg-red-200 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total || 0} invoices</p>
        </div>
        <Link to="/fees/collect" className="btn-primary">Collect Fee</Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Invoice #</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Student</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Session</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">Total</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">Paid</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">Balance</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Due</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400">No invoices found</td></tr>
              ) : data.data.map((inv: any) => (
                <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium text-primary-600">{inv.invoice_number}</td>
                  <td className="py-3 px-3">{inv.first_name} {inv.last_name}</td>
                  <td className="py-3 px-3">{inv.class_name || '-'}</td>
                  <td className="py-3 px-3">{inv.session_name || '-'}</td>
                  <td className="py-3 px-3 text-right">${(inv.total_amount - inv.discount_amount).toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-green-600">${inv.paid_amount.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-medium text-red-600">${inv.balance.toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-500">{inv.due_date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
