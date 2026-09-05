import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, UserCheck, Calendar, CheckSquare } from 'lucide-react';
import api from '../../utils/api';

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/teacher');
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
    { label: 'My Classes', value: stats?.my_classes, icon: BookMarked, href: '/teacher/classes' },
    { label: 'My Students', value: stats?.my_students, icon: UserCheck, href: '/teacher/students' },
    { label: 'Upcoming Assignments', value: stats?.pending_assignments, icon: CheckSquare, href: '/assignments' },
    { label: 'Attendance Sessions Today', value: stats?.attendance_today, icon: Calendar, href: '/attendance' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-sm text-gray-500">Your classes, students, and daily teaching tasks</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.href} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary)]">
                <c.icon size={18} />
              </div>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value ?? 0}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/attendance" className="btn-primary text-sm">Mark Attendance</Link>
        <Link to="/assignments" className="btn-secondary text-sm">Assignments</Link>
        <Link to="/examinations" className="btn-secondary text-sm">Examinations</Link>
      </div>
    </div>
  );
}
