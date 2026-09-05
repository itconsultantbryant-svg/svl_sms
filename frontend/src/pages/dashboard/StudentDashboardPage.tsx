import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, CheckSquare, Calendar } from 'lucide-react';
import api from '../../utils/api';

export default function StudentDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/dashboard/student');
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
        <h1 className="text-xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-sm text-gray-500">Your grades, assignments, and attendance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/student/assignments" className="card">
          <div className="flex items-center gap-3 mb-2 text-[var(--brand-primary)]">
            <CheckSquare size={18} />
            <span className="text-xs text-gray-500">Pending Assignments</span>
          </div>
          <p className="text-2xl font-bold">{stats?.pending_assignments ?? 0}</p>
        </Link>
        <Link to="/student/attendance" className="card">
          <div className="flex items-center gap-3 mb-2 text-[var(--brand-primary)]">
            <Calendar size={18} />
            <span className="text-xs text-gray-500">Attendance</span>
          </div>
          <p className="text-2xl font-bold">{stats?.attendance_pct ?? 0}%</p>
        </Link>
        <Link to="/student/grades" className="card">
          <div className="flex items-center gap-3 mb-2 text-[var(--brand-primary)]">
            <TrendingUp size={18} />
            <span className="text-xs text-gray-500">Recent Grades</span>
          </div>
          <p className="text-2xl font-bold">{(stats?.recent_grades || []).length}</p>
        </Link>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Latest Marks</h2>
        {(stats?.recent_grades || []).length === 0 ? (
          <p className="text-sm text-gray-400">No grades yet</p>
        ) : (
          <ul className="space-y-2">
            {(stats.recent_grades as any[]).map((g, i) => (
              <li key={i} className="flex justify-between text-sm border-b border-gray-50 py-2">
                <span>{g.subject_name || 'Subject'} · {g.exam_name || 'Exam'}</span>
                <span className="font-medium">{g.marks_obtained}/{g.max_marks}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
