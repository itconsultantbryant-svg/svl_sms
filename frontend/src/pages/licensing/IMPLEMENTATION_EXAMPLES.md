# Frontend Licensing Implementation Examples

## Complete Example: Reports Page with Feature Gates

Here's how to modify `ReportsPage.tsx` to add feature gates:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Users, DollarSign, FileText, Database, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { useLicense } from '../../contexts/LicenseContext';
import { canViewReports, canExport, getExportDisabledTooltip } from '../../utils/featureGates';

type Tab = 'overview' | 'students' | 'financial' | 'attendance' | 'academic' | 'system';

export default function ReportsPage() {
  const license = useLicense();
  const canView = canViewReports(license);
  const [tab, setTab] = useState<Tab>('overview');

  if (!canView) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-start gap-4">
          <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Production Mode Only</h3>
            <p className="text-sm text-blue-800">
              Advanced reports and analytics are available in Production mode only. 
              Upgrade your license to access this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(['overview', 'students', 'financial', 'attendance', 'academic', 'system'] as Tab[]).map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t}
          </button>
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

function StudentsReportTab() {
  const license = useLicense();
  const canDoExport = canExport(license);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('active');

  const { data: classes } = useQuery<any[]>({ 
    queryKey: ['classes'], 
    queryFn: () => api.get('/academics/classes').then(r => r.data) 
  });
  const { data: students, isLoading } = useQuery<any[]>({ 
    queryKey: ['student-report', classId, status], 
    queryFn: () => api.get('/reports/students', { params: { class_id: classId || undefined, status } }).then(r => r.data) 
  });

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
        
        {/* Export Button with Feature Gate */}
        <div className="ml-auto relative group">
          <button 
            disabled={!canDoExport}
            className={`btn-primary flex items-center gap-2 ${
              !canDoExport ? 'opacity-50 cursor-not-allowed bg-gray-300' : ''
            }`}
          >
            <Download size={16} /> Export
          </button>
          {!canDoExport && (
            <div className="hidden group-hover:block absolute right-0 z-10 mt-1 w-48">
              <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-normal">
                {getExportDisabledTooltip()}
              </div>
            </div>
          )}
        </div>
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
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  {s.total_days ? `${((s.present_days / s.total_days) * 100).toFixed(0)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Complete Example: Students Page with Student Limit

Here's how to modify `StudentsPage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useLicense } from '../../contexts/LicenseContext';
import { getMaxStudents, getStudentLimitWarning } from '../../utils/featureGates';

export default function StudentsPage() {
  const license = useLicense();
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['students', page],
    queryFn: () => api.get('/students', { params: { page, per_page: 20 } }).then(r => r.data),
  });

  const students = data?.data || [];
  const totalStudents = data?.total || 0;
  const maxStudents = getMaxStudents(license);
  const atLimit = maxStudents !== Infinity && totalStudents >= maxStudents;
  const warning = getStudentLimitWarning(totalStudents, license);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <Link to="/students/new">
          <button 
            disabled={atLimit}
            className={`btn-primary flex items-center gap-2 ${
              atLimit ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus size={18} /> Add Student
          </button>
        </Link>
      </div>

      {warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm text-yellow-800 font-medium">{warning}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            Students ({totalStudents})
            {maxStudents !== Infinity && (
              <span className="text-xs text-gray-500 ml-2">
                ({totalStudents} of {maxStudents})
              </span>
            )}
          </h3>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-6 font-medium text-gray-500">Admission No</th>
              <th className="text-left py-3 px-6 font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-6 font-medium text-gray-500">Class</th>
              <th className="text-left py-3 px-6 font-medium text-gray-500">Email</th>
              <th className="text-center py-3 px-6 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : !students?.length ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">No students found</td></tr>
            ) : (
              students.map(student => (
                <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-6 font-medium">{student.admission_number}</td>
                  <td className="py-3 px-6">{student.first_name} {student.last_name}</td>
                  <td className="py-3 px-6">{student.class_name}</td>
                  <td className="py-3 px-6 text-gray-600">{student.email}</td>
                  <td className="py-3 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      student.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Integration Checklist for Your Application

### Critical Pages to Update

1. **ReportsPage** (`/pages/reports/ReportsPage.tsx`)
   - [ ] Import `useLicense`, `canViewReports`, `canExport`, `getExportDisabledTooltip`
   - [ ] Add access check at top - show alert if `!canViewReports(license)`
   - [ ] Disable all export buttons if `!canExport(license)`
   - [ ] Add tooltip on disabled export buttons

2. **StudentsPage** (`/pages/students/StudentsPage.tsx`)
   - [ ] Import `useLicense`, `getMaxStudents`, `getStudentLimitWarning`
   - [ ] Calculate `maxStudents` and display to user
   - [ ] Disable "Add Student" button if at limit
   - [ ] Show warning when within 10 students of limit

3. **DashboardPage** (`/pages/dashboard/DashboardPage.tsx`)
   - [ ] Add demo mode warning banner if `license.mode === 'demo'`
   - [ ] Show expiry notice if `license.daysRemaining && license.daysRemaining < 7`

4. **FeesPage / InvoicesPage** (`/pages/fees/`)
   - [ ] Disable export if demo mode
   - [ ] Show warning if trying to export financial data

5. **Any Print/Download Pages**
   - [ ] Check `canExport()` before allowing download
   - [ ] Show "Available in Production mode" message

## Pattern: Disabled Button with Tooltip

```tsx
import { useLicense } from '../contexts/LicenseContext';
import { canExport, getExportDisabledTooltip } from '../utils/featureGates';

function ExportButton() {
  const license = useLicense();
  const isDisabled = !canExport(license);
  
  return (
    <div className="relative group inline-block">
      <button
        disabled={isDisabled}
        className={`btn-primary ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Export
      </button>
      {isDisabled && (
        <div className="hidden group-hover:block absolute z-10 bottom-full right-0 mb-2">
          <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
            {getExportDisabledTooltip()}
          </div>
        </div>
      )}
    </div>
  );
}
```

## Pattern: Feature-Blocked Section

```tsx
import { useLicense } from '../contexts/LicenseContext';
import { canViewReports } from '../utils/featureGates';
import { AlertCircle } from 'lucide-react';

function ReportsSection() {
  const license = useLicense();
  
  if (!canViewReports(license)) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-start gap-4">
        <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={24} />
        <div>
          <h3 className="font-medium text-blue-900 mb-1">Advanced Reports</h3>
          <p className="text-sm text-blue-800">
            Detailed analytics and reporting are available in Production mode only.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    // ... your reports UI
  );
}
```

## Testing Locally

1. **Test Demo Mode:**
   - Clear localStorage: `localStorage.clear()`
   - Refresh page - should see SetupWizard
   - Click "DEMO MODE"
   - Should see yellow "DEMO MODE" badge in header
   - Export buttons should be disabled
   - Student limit should be 50

2. **Test Production Mode:**
   - In SetupWizard, click "PRODUCTION MODE"
   - Enter a test license key (depends on backend implementation)
   - Should show activation success
   - Badge should show days remaining
   - Export should be enabled

3. **Test Expiry:**
   - Backend should return `expiry` date in past for testing
   - Should see "LICENSE EXPIRED" badge in red
   - Feature gates should behave like demo mode
