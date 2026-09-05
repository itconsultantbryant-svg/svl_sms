import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Receipt, Wallet, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../utils/api';

export default function FinanceDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/finance');
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" />
      </div>
    );
  }

  const cards = [
    { label: 'Collected (All Time)', value: stats?.total_collected, icon: Wallet, color: 'text-green-600 bg-green-50' },
    { label: 'Outstanding', value: stats?.outstanding, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Income This Month', value: stats?.income_this_month, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Expense This Month', value: stats?.expense_this_month, icon: DollarSign, color: 'text-red-600 bg-red-50' },
    { label: 'Unpaid Invoices', value: stats?.unpaid_invoices, icon: Receipt, color: 'text-purple-600 bg-purple-50', raw: true },
    { label: 'Payments Today', value: stats?.payments_today, icon: Wallet, color: 'text-teal-600 bg-teal-50' },
  ];

  const fmt = (n: number, raw?: boolean) =>
    raw ? String(n ?? 0) : `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500">Live fees, collections, and accounts overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/fees/payments" className="btn-primary text-sm">Record Payment</Link>
          <Link to="/fees/invoices" className="btn-secondary text-sm">Invoices</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.color}`}>
              <c.icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-semibold text-gray-900">{fmt(c.value, c.raw)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Payments</h2>
          <Link to="/fees/payments" className="text-sm text-[var(--brand-primary)] flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent_payments || []).length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No payments yet</td></tr>
              ) : (
                (stats.recent_payments as any[]).map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2.5 pr-4">{p.student_name || '—'} <span className="text-gray-400 text-xs">{p.admission_number}</span></td>
                    <td className="py-2.5 pr-4 font-medium">${Number(p.amount_paid || 0).toFixed(2)}</td>
                    <td className="py-2.5 pr-4 capitalize">{p.payment_method || '—'}</td>
                    <td className="py-2.5">{p.payment_date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
