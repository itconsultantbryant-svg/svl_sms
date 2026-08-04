import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Users, DollarSign, FileText, Database } from 'lucide-react';
import api from '../../utils/api';

type Tab = 'overview' | 'students' | 'financial' | 'attendance' | 'academic' | 'system';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(['overview', 'students', 'financial', 'attendance', 'academic', 'system'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'students' && <StudentsReportTab />}
      {tab === 'financial' && <FinancialReportTab />}
      {tab === 'attendance' && <AttendanceReportTab />}
      {tab === 'academic' && <AcademicReportTab />}
      {tab === 'system' && <SystemTab />}
    </div>
  );
}

function OverviewTab() {
  const { data: stats } = useQuery<any>({ queryKey: ['dashboard-stats'], queryFn: () => api.get('/reports/stats').then(r => r.data) });

  if (!stats) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const cards = [
    { title: 'Total Students', value: stats.students?.total || 0, subtitle: `${stats.students?.active || 0} active`, icon: Users, color: 'bg-blue-500' },
    { title: 'Total Teachers', value: stats.teachers?.total || 0, subtitle: `${stats.teachers?.active || 0} active`, icon: Users, color: 'bg-green-500' },
    { title: 'Fee Collection', value: `$${(stats.fees?.collected || 0).toLocaleString()}`, subtitle: `of $${(stats.fees?.total_amount || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-yellow-500' },
    { title: 'Monthly Balance', value: `$${(stats.finance?.balance || 0).toLocaleString()}`, subtitle: `Income: $${(stats.finance?.income || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon size={24} className="text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
            <p className="text-sm text-gray-500">{card.title}</p>
            <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Fee Collection Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Paid Invoices</span>
              <span className="font-medium text-green-600">{stats.fees?.paid || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Unpaid Invoices</span>
              <span className="font-medium text-red-600">{stats.fees?.unpaid || 0}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium text-gray-900">Total Invoices</span>
              <span className="font-bold">{stats.fees?.total_invoices || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Today's Attendance</h3>
          {stats.attendance?.total ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Present</span>
                <span className="font-medium text-green-600">{stats.attendance.present}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Absent</span>
                <span className="font-medium text-red-600">{stats.attendance.absent}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium text-gray-900">Attendance Rate</span>
                <span className="font-bold text-primary-600">{stats.attendance.percentage}%</span>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No attendance recorded today</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentsReportTab() {
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('active');

  const { data: classes } = useQuery<any[]>({ queryKey: ['classes'], queryFn: () => api.get('/academics/classes').then(r => r.data) });
  const { data: students, isLoading } = useQuery<any[]>({ queryKey: ['student-report', classId, status], queryFn: () => api.get('/reports/students', { params: { class_id: classId || undefined, status } }).then(r => r.data) });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field w-auto">
          <option value="">All Classes</option>
          {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-auto">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
        </select>
        <button className="btn-primary ml-auto"><Download size={16} className="mr-2" /> Export</button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Admission No</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Gender</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Attendance</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !students?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No students found</td></tr>
            : students.map(s => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{s.admission_number}</td>
                <td className="py-3 px-3">{s.first_name} {s.last_name}</td>
                <td className="py-3 px-3">{s.class_name}</td>
                <td className="py-3 px-3 capitalize">{s.gender}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                <td className="py-3 px-3 text-center">{s.total_days ? `${((s.present_days / s.total_days) * 100).toFixed(0)}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancialReportTab() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery<any>({ queryKey: ['financial-report', startDate, endDate, type], queryFn: () => api.get('/reports/financial', { params: { start_date: startDate || undefined, end_date: endDate || undefined, type: type || undefined } }).then(r => r.data) });

  const summary = data?.summary || [];
  const income = summary.find((s: any) => s.type === 'income');
  const expense = summary.find((s: any) => s.type === 'expense');

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field w-auto" placeholder="Start Date" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field w-auto" placeholder="End Date" />
        <select value={type} onChange={e => setType(e.target.value)} className="input-field w-auto">
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <button className="btn-primary ml-auto"><Download size={16} className="mr-2" /> Export</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-green-50 border-green-200">
          <p className="text-sm text-green-600 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-700">${(income?.total || 0).toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">{income?.count || 0} transactions</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-sm text-red-600 mb-1">Total Expense</p>
          <p className="text-2xl font-bold text-red-700">${(expense?.total || 0).toLocaleString()}</p>
          <p className="text-xs text-red-600 mt-1">{expense?.count || 0} transactions</p>
        </div>
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-600 mb-1">Net Balance</p>
          <p className="text-2xl font-bold text-blue-700">${((income?.total || 0) - (expense?.total || 0)).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-gray-900 mb-4">Transactions</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.transactions?.length ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">No transactions</td></tr>
            : data.transactions.map((t: any) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{t.date}</td>
                <td className="py-3 px-3 capitalize"><span className={`px-2 py-0.5 rounded-full text-xs ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span></td>
                <td className="py-3 px-3">{t.category_name}</td>
                <td className="py-3 px-3">{t.description}</td>
                <td className={`py-3 px-3 text-right font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>${t.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceReportTab() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useQuery<any[]>({ queryKey: ['attendance-report', startDate, endDate], queryFn: () => api.get('/reports/attendance', { params: { start_date: startDate || undefined, end_date: endDate || undefined } }).then(r => r.data) });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field w-auto" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field w-auto" />
        <button className="btn-primary ml-auto"><Download size={16} className="mr-2" /> Export</button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Admission No</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Present</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Absent</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Late</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">%</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No data</td></tr>
            : data.map(s => {
              const percentage = s.total_days ? ((s.present / s.total_days) * 100).toFixed(1) : 0;
              return (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-medium">{s.admission_number}</td>
                  <td className="py-3 px-3">{s.first_name} {s.last_name}</td>
                  <td className="py-3 px-3">{s.class_name}</td>
                  <td className="py-3 px-3 text-center text-green-600">{s.present}</td>
                  <td className="py-3 px-3 text-center text-red-600">{s.absent}</td>
                  <td className="py-3 px-3 text-center text-yellow-600">{s.late}</td>
                  <td className="py-3 px-3 text-center font-medium">{percentage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AcademicReportTab() {
  const [examId, setExamId] = useState('');

  const { data: exams } = useQuery<any[]>({ queryKey: ['exams'], queryFn: () => api.get('/examinations/exams').then(r => r.data.data) });
  const { data, isLoading } = useQuery<any[]>({ queryKey: ['academic-report', examId], queryFn: () => api.get('/reports/academic', { params: { exam_id: examId } }).then(r => r.data), enabled: !!examId });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={examId} onChange={e => setExamId(e.target.value)} className="input-field flex-1">
          <option value="">Select Exam</option>
          {exams?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="btn-primary" disabled={!examId}><Download size={16} className="mr-2" /> Export</button>
      </div>

      {examId && (
        <div className="card">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-3 font-medium text-gray-500">Rank</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Admission No</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Marks</th>
              <th className="text-center py-3 px-3 font-medium text-gray-500">%</th>
              <th className="text-center py-3 px-3 font-medium text-gray-500">Grade</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
              : !data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No results</td></tr>
              : data.map(s => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-bold text-primary-600">{s.rank || '-'}</td>
                  <td className="py-3 px-3">{s.admission_number}</td>
                  <td className="py-3 px-3">{s.first_name} {s.last_name}</td>
                  <td className="py-3 px-3">{s.class_name} - {s.section_name}</td>
                  <td className="py-3 px-3 text-right">{s.marks_obtained}/{s.total_marks}</td>
                  <td className="py-3 px-3 text-center font-medium">{s.percentage}%</td>
                  <td className="py-3 px-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700 font-medium">{s.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  const { data: health } = useQuery<any>({ queryKey: ['system-health'], queryFn: () => api.get('/reports/health').then(r => r.data) });
  const { data: backups } = useQuery<any[]>({ queryKey: ['backups'], queryFn: () => api.get('/reports/backups').then(r => r.data) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Database size={24} className="text-primary-600" />
            <h3 className="font-medium">Database Size</h3>
          </div>
          <p className="text-2xl font-bold">{((health?.database_size || 0) / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={24} className="text-green-600" />
            <h3 className="font-medium">Tables</h3>
          </div>
          <p className="text-2xl font-bold">{health?.tables_count || 0}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} className="text-blue-600" />
            <h3 className="font-medium">System Status</h3>
          </div>
          <p className="text-2xl font-bold capitalize text-green-600">{health?.status || 'Unknown'}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-gray-900 mb-4">Recent Backups</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">File Path</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
          </tr></thead>
          <tbody>
            {!backups?.length ? <tr><td colSpan={4} className="py-12 text-center text-gray-400">No backups found</td></tr>
            : backups.map(b => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-3 px-3">{new Date(b.created_at).toLocaleString()}</td>
                <td className="py-3 px-3 capitalize">{b.type}</td>
                <td className="py-3 px-3 text-xs font-mono text-gray-600">{b.file_path}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
