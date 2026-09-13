import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { escapeHtml, openPrintDocument } from '../../utils/printDocument';

export default function PortalFeesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ invoice_id: '', amount: '', payment_date: '', payment_method: 'cash', reference_number: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['my-fees'],
    queryFn: () => api.get('/fees/mine').then((r) => r.data),
  });

  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const openInvoices = invoices.filter((i: any) => Number(i.balance) > 0 && i.status !== 'paid');

  const pay = async () => {
    try {
      await api.post('/fees/payments', { ...form, amount: Number(form.amount) });
      toast.success('Payment recorded');
      setForm({ invoice_id: '', amount: '', payment_date: '', payment_method: 'cash', reference_number: '' });
      qc.invalidateQueries({ queryKey: ['my-fees'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Payment failed');
    }
  };

  const printStatement = () => {
    openPrintDocument('Financial statement', `
      <h1>Financial statement</h1>
      <p class="meta">Invoices and payments</p>
      <h2>Invoices</h2>
      <table><thead><tr><th>Invoice</th><th>Student</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>${invoices.map((i: any) => `<tr><td>${escapeHtml(i.invoice_number)}</td><td>${escapeHtml(i.first_name)} ${escapeHtml(i.last_name)}</td><td>${Number(i.total_amount || 0).toFixed(2)}</td><td>${Number(i.paid_amount || 0).toFixed(2)}</td><td>${Number(i.balance || 0).toFixed(2)}</td><td>${escapeHtml(i.status)}</td></tr>`).join('')}</tbody></table>
      <h2>Payments</h2>
      <table><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
      <tbody>${payments.map((p: any) => `<tr><td>${escapeHtml(p.payment_number)}</td><td>${escapeHtml(p.payment_date)}</td><td>${Number(p.amount || 0).toFixed(2)}</td><td>${escapeHtml(p.payment_method)}</td></tr>`).join('')}</tbody></table>
    `);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading finances…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees &amp; Payments</h1>
          <p className="text-sm text-gray-500">Invoices, balances, and payment history</p>
        </div>
        <button type="button" className="btn-secondary" onClick={printStatement}>Preview / Download PDF</button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Make a payment</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="input-field" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
            <option value="">Select invoice</option>
            {openInvoices.map((i: any) => (
              <option key={i.id} value={i.id}>{i.invoice_number} — ${Number(i.balance || 0).toFixed(2)}</option>
            ))}
          </select>
          <input className="input-field" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="input-field" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
          <select className="input-field" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="mobile_money">Mobile money</option>
          </select>
        </div>
        <button type="button" className="btn-primary" disabled={!form.invoice_id || !form.amount || !form.payment_date} onClick={pay}>Pay now</button>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">Invoices</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Invoice</th><th>Student</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((i: any) => (
              <tr key={i.id} className="border-b"><td className="py-2">{i.invoice_number}</td><td>{i.first_name} {i.last_name}</td><td>${Number(i.balance || 0).toFixed(2)}</td><td className="capitalize">{i.status}</td></tr>
            ))}
            {!invoices.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No invoices</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">Payments</h2>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Receipt</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {payments.map((p: any) => (
              <tr key={p.id} className="border-b"><td className="py-2">{p.payment_number}</td><td>{p.payment_date}</td><td>${Number(p.amount || 0).toFixed(2)}</td><td>{p.payment_method}</td></tr>
            ))}
            {!payments.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
