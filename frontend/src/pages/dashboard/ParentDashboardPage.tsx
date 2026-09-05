import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, DollarSign } from 'lucide-react';
import api from '../../utils/api';

export default function ParentDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/parent');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Parent Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of your children</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-[rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary)]">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Children</p>
            <p className="text-lg font-semibold">{stats?.children_count ?? 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Outstanding Fees</p>
            <p className="text-lg font-semibold">${Number(stats?.outstanding_fees || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">My Children</h2>
          <Link to="/parent/children" className="text-sm text-[var(--brand-primary)]">View details</Link>
        </div>
        {(stats?.children || []).length === 0 ? (
          <p className="text-sm text-gray-400">No linked students</p>
        ) : (
          <ul className="divide-y">
            {(stats.children as any[]).map((c) => (
              <li key={c.id} className="py-3 flex justify-between text-sm">
                <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                <span className="text-gray-500">{c.class_name || '—'} · {c.admission_number}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
