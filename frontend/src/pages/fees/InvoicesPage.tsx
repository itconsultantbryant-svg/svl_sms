import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import DocumentActions from '../../components/common/DocumentActions';
import RecordActions from '../../components/common/RecordActions';
import { SchoolDoc, schoolName, schoolPlace } from '../../utils/schoolDocument';

function invoiceDoc(invoice: any): SchoolDoc {
  const school = invoice.institution || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return {
    title: 'INVOICE',
    filename: `invoice-${invoice.invoice_number || invoice.id}.pdf`,
    school,
    subtitle: invoice.invoice_number || '',
    meta: [
      { label: 'Student', value: `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim() },
      { label: 'Admission No.', value: invoice.admission_number || '' },
      { label: 'Class', value: [invoice.class_name, invoice.section_name].filter(Boolean).join(' ') },
      { label: 'Status', value: invoice.status || '' },
      { label: 'Due date', value: invoice.due_date || '' },
    ],
    columns: ['Description', 'Amount'],
    rows: [
      ...items.map((item: any) => [item.fee_type_name || item.description || 'Fee', Number(item.net_amount ?? item.amount ?? 0).toFixed(2)]),
      ['Total', Number(invoice.total_amount || 0).toFixed(2)],
      ['Paid', Number(invoice.paid_amount || 0).toFixed(2)],
      ['Balance', Number(invoice.balance || 0).toFixed(2)],
    ],
  };
}

function InvoiceDocument({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const school = invoice.institution || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-end">
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>Close</button>
        </div>
        <div className="text-center border-b pb-4 mb-4">
          {school.logo ? <img src={school.logo} alt="" className="h-16 mx-auto mb-2 object-contain" /> : null}
          <h2 className="text-xl font-bold">{schoolName(school)}</h2>
          {school.motto ? <p className="text-sm text-gray-500 italic">{school.motto}</p> : null}
          <p className="text-sm text-gray-500">{schoolPlace(school)}</p>
          <p className="mt-2 font-semibold text-primary-600">INVOICE {invoice.invoice_number}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <p><span className="text-gray-500">Student:</span> {invoice.first_name} {invoice.last_name}</p>
          <p><span className="text-gray-500">Admission No.:</span> {invoice.admission_number || '—'}</p>
          <p><span className="text-gray-500">Class:</span> {invoice.class_name || '—'}</p>
          <p><span className="text-gray-500">Due:</span> {invoice.due_date || '—'}</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th></tr></thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">{item.fee_type_name || item.description || 'Fee'}</td>
                <td className="py-2 text-right">${Number(item.net_amount ?? item.amount ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            <tr><td className="py-2 font-medium">Balance</td><td className="py-2 text-right font-medium">${Number(invoice.balance || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <DocumentActions doc={invoiceDoc(invoice)} />
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['invoices', page, status],
    queryFn: () => api.get('/fees/invoices', { params: { page, limit: 20, status: status || undefined } }).then(r => r.data),
  });

  const { data: viewed } = useQuery<any>({
    queryKey: ['invoice-view', viewId],
    queryFn: () => api.get(`/fees/invoices/${viewId}`).then((r) => r.data),
    enabled: !!viewId,
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
                <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400">No invoices found</td></tr>
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
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <button type="button" className="text-primary-600 text-sm" onClick={() => setViewId(inv.id)}>View</button>
                      <RecordActions resource="invoices" id={inv.id} label={inv.invoice_number} invalidate={['invoices', 'finance-dashboard', 'dashboard-finance']} fields={[
                        { key: 'status', label: 'Status' },
                        { key: 'due_date', label: 'Due date', type: 'date' },
                        { key: 'notes', label: 'Notes' },
                      ]} record={inv} />
                    </div>
                  </td>
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
      {viewed && viewId && (
        <InvoiceDocument invoice={viewed} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}
