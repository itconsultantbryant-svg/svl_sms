import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, UserCircle, Briefcase, Home } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import { DashboardStats } from '../../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
  });

  const { data: feeData } = useQuery({
    queryKey: ['dashboard-fee-summary'],
    queryFn: () => api.get('/dashboard/fee-summary').then(r => r.data).catch(() => null),
  });

  const { data: financeData } = useQuery({
    queryKey: ['dashboard-finance'],
    queryFn: () => api.get('/dashboard/finance-summary').then(r => r.data).catch(() => null),
  });

  const { data: genderStats } = useQuery({
    queryKey: ['dashboard-gender'],
    queryFn: () => api.get('/dashboard/gender-stats').then(r => r.data),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['dashboard-attendance-weekly'],
    queryFn: () => api.get('/dashboard/attendance-weekly').then(r => r.data).catch(() => null),
  });

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });

  const incomeExpenseData = [
    { name: 'Income', value: financeData?.income || 0 },
    { name: 'Expense', value: financeData?.expense || 0 },
  ];
  const hasFinanceData = incomeExpenseData.some(d => d.value > 0);
  const PIE_COLORS = ['#3b82f6', '#ef4444'];

  const annualFeeChartData = MONTHS.map((month, idx) => {
    const monthData = feeData?.monthly?.[idx] || {};
    return {
      month,
      Total: monthData.total || 0,
      Collected: monthData.collected || 0,
      Remaining: monthData.remaining || 0,
    };
  });

  const studentGenderData = [
    { name: 'Male', value: 0 },
    { name: 'Female', value: 0 },
  ];
  if (genderStats && Array.isArray(genderStats)) {
    genderStats.forEach((s: any) => {
      if (s.gender?.toLowerCase() === 'male') studentGenderData[0].value = s.count;
      if (s.gender?.toLowerCase() === 'female') studentGenderData[1].value = s.count;
    });
  }
  const hasGenderData = studentGenderData.some(d => d.value > 0);
  const GENDER_COLORS = ['#3b82f6', '#f59e0b'];

  const attendanceChartData = attendanceData?.days?.map((day: any) => ({
    day: day.name || day.day,
    Present: day.present || 0,
    Absent: day.absent || 0,
  })) || [];

  const statCards = [
    { label: 'Employee', value: stats?.total_employees || 0, icon: Briefcase },
    { label: 'Students', value: stats?.total_students || 0, icon: GraduationCap },
    { label: 'Parents', value: stats?.total_parents || 0, icon: Users },
    { label: 'Teachers', value: stats?.total_teachers || 0, icon: UserCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Home size={20} className="text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">All Branch Dashboard</h1>
      </div>

      {/* Top Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Donut */}
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
                <span className="text-sm text-gray-600">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-gray-600">Expense</span>
              </div>
            </div>
          </div>
        </div>

        {/* Annual Fee Summary */}
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

      {/* Stats Row - Blue Background */}
      <div className="bg-blue-600 rounded-lg p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="flex items-center justify-between px-4 py-3 border-r last:border-r-0 border-blue-500">
            <div className="flex items-center gap-3">
              <card.icon size={32} className="text-white" />
              <div>
                <p className="text-white font-semibold text-sm">{card.label}</p>
                <p className="text-yellow-300 text-xs">TOTAL STRENGTH</p>
              </div>
            </div>
            <p className="text-white text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Bottom Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Quantity (Gender) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-green-500"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Student Quantity</h2>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={hasGenderData ? studentGenderData : [{ name: 'No Data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {hasGenderData ? (
                      studentGenderData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index]} />
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
                <span className="text-sm text-gray-600">Male</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-sm text-gray-600">Female</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekend Attendance Inspection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1 bg-green-500"></div>
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Weekend Attendance Inspection</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceChartData.length > 0 ? attendanceChartData : MONTHS.slice(0, 5).map(m => ({ day: m, Present: 0, Absent: 0 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" fill="#22c55e" />
                <Bar dataKey="Absent" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
