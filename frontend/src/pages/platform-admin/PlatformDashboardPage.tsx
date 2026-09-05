import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, UserCircle, Briefcase, Building2, Home, KeyRound, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DashboardStats {
  total_institutions: number;
  active_institutions: number;
  trial_institutions?: number;
  suspended_institutions?: number;
  total_students: number;
  total_staff: number;
  total_teachers: number;
  total_parents: number;
  total_employees: number;
  total_revenue: number;
  monthly_revenue: number;
  monthly_expense?: number;
  institution_growth: Array<{ month: string; count: number }>;
  recent_institutions: Array<{
    id: string;
    institution_name: string;
    institution_code: string;
    subscription_plan?: string;
    subscription_status?: string;
    created_at: string;
  }>;
  subscription_breakdown: Array<{ subscription_status: string; count: number }>;
  fee_summary?: Array<{ month: number; total: number; collected: number; remaining: number }>;
  per_institution?: Array<{
    id: string;
    institution_name: string;
    institution_code: string;
    students: number;
    staff: number;
    users: number;
    subscription_status?: string;
    is_active?: number;
  }>;
  generated_at?: string;
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get('/platform-admin/dashboard/stats');
      const apiData = response.data;
      setStats({
        ...apiData.stats,
        subscription_breakdown: apiData.subscription_breakdown || [],
        recent_institutions: apiData.recent_institutions || [],
        institution_growth: apiData.institution_growth || [],
        fee_summary: apiData.fee_summary || [],
        per_institution: apiData.per_institution || [],
        total_revenue: apiData.stats?.total_revenue || 0,
        monthly_revenue: apiData.stats?.monthly_revenue || 0,
        monthly_expense: apiData.stats?.monthly_expense || 0,
        total_staff: apiData.stats?.total_users || 0,
        total_teachers: apiData.stats?.total_teachers || 0,
        total_parents: apiData.stats?.total_parents || 0,
        total_employees: apiData.stats?.total_employees || 0,
        generated_at: apiData.generated_at,
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(true), 15000);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard statistics</p>
      </div>
    );
  }

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });

  const incomeExpenseData = [
    { name: 'Income', value: stats.monthly_revenue || 0 },
    { name: 'Expense', value: stats.monthly_expense || 0 },
  ];
  const hasFinanceData = incomeExpenseData.some((d) => d.value > 0);
  const PIE_COLORS = ['#3b82f6', '#ef4444'];

  const annualFeeChartData = MONTHS.map((month, i) => {
    const row = stats.fee_summary?.[i];
    return {
      month,
      Total: row?.total || 0,
      Collected: row?.collected || 0,
      Remaining: row?.remaining || 0,
    };
  });

  const statCards = [
    { label: 'Institutions', value: stats.total_institutions || 0, icon: Building2 },
    { label: 'Students', value: stats.total_students || 0, icon: GraduationCap },
    { label: 'Teachers', value: stats.total_teachers || 0, icon: UserCircle },
    { label: 'Employees', value: stats.total_employees || 0, icon: Briefcase },
    { label: 'Parents', value: stats.total_parents || 0, icon: Users },
  ];

  const institutionGrowthData =
    stats.institution_growth.length > 0
      ? stats.institution_growth.map((g) => ({ month: g.month, count: g.count }))
      : MONTHS.map((m) => ({ month: m, count: 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Home size={20} className="text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Platform Dashboard</h1>
          <span className="text-xs text-gray-400 ml-2">Live · updated {lastUpdated || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats(true)}
            className="flex items-center gap-2 text-sm bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <Link
            to="/platform-admin/licenses"
            className="flex items-center gap-2 text-sm bg-white text-primary-700 border border-primary-200 px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <KeyRound size={16} />
            License Keys
          </Link>
          <Link
            to="/platform-admin/institutions"
            className="flex items-center gap-2 text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Building2 size={16} />
            Manage Institutions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border rounded-lg p-4 flex items-center gap-3">
            <card.icon size={22} className="text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-yellow-400"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Income Vs Expense Of {currentMonth}
            </h2>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={hasFinanceData ? incomeExpenseData : [{ name: 'No Data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {hasFinanceData ? (
                      incomeExpenseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                      ))
                    ) : (
                      <Cell fill="#e5e7eb" />
                    )}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-gray-600">Income (${(stats.monthly_revenue || 0).toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-gray-600">Expense (${(stats.monthly_expense || 0).toLocaleString()})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-yellow-400"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Annual Fee Summary</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={annualFeeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Total" fill="#ef4444" />
                <Bar dataKey="Collected" fill="#3b82f6" />
                <Bar dataKey="Remaining" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-green-500"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Institution Growth</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={institutionGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="New Institutions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-green-500"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Subscription Status</h2>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={
                      Array.isArray(stats.subscription_breakdown) && stats.subscription_breakdown.length > 0
                        ? stats.subscription_breakdown.map((s) => ({ name: s.subscription_status, value: s.count }))
                        : [{ name: 'No Data', value: 1 }]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Array.isArray(stats.subscription_breakdown) && stats.subscription_breakdown.length > 0 ? (
                      stats.subscription_breakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#ef4444', '#6b7280'][index % 4]} />
                      ))
                    ) : (
                      <Cell fill="#e5e7eb" />
                    )}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-1 bg-yellow-400"></div>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Schools Overview (All Levels)</h2>
          <Link to="/platform-admin/institutions" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(stats.per_institution || stats.recent_institutions).map((institution: any) => (
                <tr key={institution.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {institution.institution_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{institution.institution_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{institution.students ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{institution.staff ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{institution.users ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        institution.subscription_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : institution.subscription_status === 'trial'
                            ? 'bg-blue-100 text-blue-800'
                            : institution.subscription_status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {institution.subscription_status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/platform-admin/institutions/${institution.id}/edit`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {(stats.per_institution || stats.recent_institutions).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No institutions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
