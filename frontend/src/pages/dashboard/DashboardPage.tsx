import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, UserCircle, Building2, BookOpen, UsersRound } from 'lucide-react';
import api from '../../utils/api';
import { DashboardStats } from '../../types';

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
  });

  const { data: genderStats } = useQuery({
    queryKey: ['dashboard-gender'],
    queryFn: () => api.get('/dashboard/gender-stats').then(r => r.data),
  });

  const { data: recentAdmissions } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => api.get('/dashboard/recent-admissions').then(r => r.data),
  });

  const { data: classPopulation } = useQuery({
    queryKey: ['dashboard-class-pop'],
    queryFn: () => api.get('/dashboard/class-population').then(r => r.data),
  });

  const statCards = [
    { label: 'Total Students', value: stats?.total_students || 0, icon: GraduationCap, color: 'bg-blue-500' },
    { label: 'Total Teachers', value: stats?.total_teachers || 0, icon: UserCircle, color: 'bg-green-500' },
    { label: 'Total Employees', value: stats?.total_employees || 0, icon: Users, color: 'bg-purple-500' },
    { label: 'Total Parents', value: stats?.total_parents || 0, icon: UsersRound, color: 'bg-orange-500' },
    { label: 'Total Classes', value: stats?.total_classes || 0, icon: BookOpen, color: 'bg-pink-500' },
    { label: 'Total Branches', value: stats?.total_branches || 0, icon: Building2, color: 'bg-teal-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome to Softwarevala Liberia School Management System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
              <card.icon size={22} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h2>
          {genderStats && (
            <div className="flex items-center gap-6">
              {(genderStats as any[]).map((s: any) => (
                <div key={s.gender} className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{s.count}</p>
                  <p className="text-sm text-gray-500 capitalize">{s.gender || 'Unspecified'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Population</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(classPopulation as any[] || []).map((c: any) => (
              <div key={c.class_name} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700">{c.class_name}</span>
                <span className="text-sm font-medium text-gray-900">{c.student_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Admissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-500">Admission #</th>
                <th className="text-left py-2 font-medium text-gray-500">Name</th>
                <th className="text-left py-2 font-medium text-gray-500">Class</th>
                <th className="text-left py-2 font-medium text-gray-500">Section</th>
                <th className="text-left py-2 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {(recentAdmissions as any[] || []).map((s: any) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-2 text-primary-600 font-medium">{s.admission_number}</td>
                  <td className="py-2">{s.first_name} {s.last_name}</td>
                  <td className="py-2">{s.class_name || '-'}</td>
                  <td className="py-2">{s.section_name || '-'}</td>
                  <td className="py-2 text-gray-500">{s.admission_date || '-'}</td>
                </tr>
              ))}
              {(!recentAdmissions || (recentAdmissions as any[]).length === 0) && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No recent admissions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
