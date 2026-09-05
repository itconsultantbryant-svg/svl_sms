import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, UserCircle, ClipboardList, Library, ArrowRight } from 'lucide-react';
import api from '../../utils/api';

export default function StaffDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/staff');
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
    { label: 'Active Students', value: stats?.total_students, icon: GraduationCap, href: '/students' },
    { label: 'Teachers', value: stats?.total_teachers, icon: UserCircle, href: '/teachers' },
    { label: 'Open Enquiries', value: stats?.open_enquiries, icon: ClipboardList, href: '/admission/enquiries' },
    { label: 'Visitors Today', value: stats?.visitors_today, icon: Users, href: '/reception' },
    { label: 'Books Issued', value: stats?.library_issues, icon: Library, href: '/library' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Staff Dashboard</h1>
        <p className="text-sm text-gray-500">Operations overview for your school</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.href} className="card hover:border-[var(--brand-primary)] transition-colors flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-[rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary)]">
              <c.icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-semibold text-gray-900">{c.value ?? 0}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/students/new" className="btn-primary text-sm">New Student</Link>
          <Link to="/admission/enquiries/new" className="btn-secondary text-sm">New Enquiry</Link>
          <Link to="/reception" className="btn-secondary text-sm">Reception</Link>
          <Link to="/communication" className="btn-secondary text-sm flex items-center gap-1">
            Communication <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
