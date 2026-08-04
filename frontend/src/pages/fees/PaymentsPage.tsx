import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [form, setForm] = useState({ invoice_id: '', amount: '', payment_method: 'cash', payment_date: '', reference_number: '', notes: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['payments', page],
    queryFn: () => api.get('/fees/payments', { params: { page, limit: 20 } }).then(r => r.data),
  });

  const { data: studentInvoices } = useQuery<any>({
    queryKey: ['student-invoices', selectedStudent?.id],
    queryFn: () => api.get('/fees/invoices', { params: { student_id: selectedStudent.id, status: 'unpaid' } }).then(r => r.data),
    enabled: !!selectedStudent,
  });

  const { data: receipt } = useQuery<any>({
    queryKey: ['receipt', receiptId],
    queryFn: () => api.get(`/fees/payments/${receiptId}/receipt`).then(r => r.data),
    enabled: !!receiptId,
  });

  const { data: students } = useQuery<any>({
    queryKey: ['students-search', studentSearch],
    queryFn: () => api.get('/students', { params: { search: studentSearch, limit: 10 } }).then(r => r.data),
    enabled: studentSearch.length >= 2,
  });

  const payMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/payments', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded');
      setReceiptId(res.data.id);
      setShowForm(false);
      setForm({ invoice_id: '', amount: '', payment_method: 'cash', payment_date: '', reference_number: '', notes: '' });
      setSelectedStudent(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  if (receiptId && receipt) {
    return <ReceiptView receipt={receipt} onBack={() => setReceiptId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total || 0} payments recorded</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <DollarSign size={16} className="mr-2" /> Record Payment
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-medium text-gray-900">Record New Payment</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Student</label>
              <input
                value={studentSearch}
                onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); }}
                placeholder="Type student name or admission #..."
                className="input-field"
              />
              {students?.data?.length > 0 && !selectedStudent && (
                <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto bg-white shadow">
                  {students.data.map((s: any) => (
                    <button key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch(`${s.first_name} ${s.last_name}`); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0">
                      {s.first_name} {s.last_name} — {s.admission_number}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedStudent && studentInvoices?.data?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice *</label>
                <select value={form.invoice_id} onChange={e => setForm(f => ({ ...f, invoice_id: e.target.value }))} className="input-field" required>
                  <option value="">Select Invoice</option>
                  {studentInvoices.data.filter((i: any) => i.status !== 'paid').map((inv: any) => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} — Balance: ${inv.balance.toFixed(2)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="input-field">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
              <input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} className="input-field" />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => payMutation.mutate({ ...form, amount: parseFloat(form.amount) })}
              disabled={!form.invoice_id || !form.amount || !form.payment_date}
              className="btn-primary"
            >
              Record Payment
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Payment #</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Student</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Invoice</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Method</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No payments recorded</td></tr>
              ) : data.data.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium">{p.payment_number}</td>
                  <td className="py-3 px-3">{p.first_name} {p.last_name}</td>
                  <td className="py-3 px-3 text-gray-500">{p.invoice_number}</td>
                  <td className="py-3 px-3 text-right font-medium text-green-600">${p.amount.toFixed(2)}</td>
                  <td className="py-3 px-3 capitalize">{p.payment_method?.replace('_', ' ')}</td>
                  <td className="py-3 px-3">{p.payment_date}</td>
                  <td className="py-3 px-3">
                    <button onClick={() => setReceiptId(p.id)} className="text-primary-600 hover:underline text-xs font-medium">
                      <Printer size={14} className="inline mr-1" />Receipt
                    </button>
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
    </div>
  );
}

function ReceiptView({ receipt, onBack }: { receipt: any; onBack: () => void }) {
  const { payment, institution } = receipt;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-secondary text-sm">Back to Payments</button>
      <div className="card max-w-2xl mx-auto print:shadow-none" id="receipt">
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold">{institution?.name || 'SVL Academy'}</h2>
          <p className="text-sm text-gray-500">{institution?.address}</p>
          <p className="text-sm text-gray-500">{institution?.phone} | {institution?.email}</p>
          <p className="mt-2 font-semibold text-primary-600">PAYMENT RECEIPT</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p><span className="text-gray-500">Receipt No:</span> <strong>{payment.payment_number}</strong></p>
            <p><span className="text-gray-500">Date:</span> {payment.payment_date}</p>
            <p><span className="text-gray-500">Method:</span> <span className="capitalize">{payment.payment_method?.replace('_', ' ')}</span></p>
            {payment.reference_number && <p><span className="text-gray-500">Reference:</span> {payment.reference_number}</p>}
          </div>
          <div>
            <p><span className="text-gray-500">Student:</span> <strong>{payment.first_name} {payment.last_name}</strong></p>
            <p><span className="text-gray-500">Adm. No:</span> {payment.admission_number}</p>
            <p><span className="text-gray-500">Class:</span> {payment.class_name} {payment.section_name}</p>
            <p><span className="text-gray-500">Invoice:</span> {payment.invoice_number}</p>
          </div>
        </div>

        <div className="border-t border-b py-4 my-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Amount Paid</span>
            <span className="text-green-600">${payment.amount.toFixed(2)}</span>
          </div>
          {payment.balance > 0 && (
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>Remaining Balance</span>
              <span>${payment.balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 mt-4">
          <p>Received by: {payment.received_first} {payment.received_last}</p>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => window.print()} className="btn-primary print:hidden">
            <Printer size={16} className="mr-2" /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
