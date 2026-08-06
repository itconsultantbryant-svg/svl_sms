import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import StudentsPage from './pages/students/StudentsPage';
import StudentFormPage from './pages/students/StudentFormPage';
import ParentsPage from './pages/parents/ParentsPage';
import TeachersPage from './pages/teachers/TeachersPage';
import TeacherFormPage from './pages/teachers/TeacherFormPage';
import ClassesPage from './pages/academics/ClassesPage';
import SubjectsPage from './pages/academics/SubjectsPage';
import SessionsPage from './pages/academics/SessionsPage';
import BranchesPage from './pages/branches/BranchesPage';
import SettingsPage from './pages/settings/SettingsPage';
import AttendancePage from './pages/attendance/AttendancePage';
import TimetablePage from './pages/timetable/TimetablePage';
import ExamsPage from './pages/examinations/ExamsPage';
import ExamSchedulesPage from './pages/examinations/ExamSchedulesPage';
import MarksEntryPage from './pages/examinations/MarksEntryPage';
import ResultsPage from './pages/results/ResultsPage';
import ReportCardPage from './pages/results/ReportCardPage';
import FeesPage from './pages/fees/FeesPage';
import InvoicesPage from './pages/fees/InvoicesPage';
import PaymentsPage from './pages/fees/PaymentsPage';
import AccountsPage from './pages/accounts/AccountsPage';
import LibraryPage from './pages/library/LibraryPage';
import InventoryPage from './pages/inventory/InventoryPage';
import TransportPage from './pages/transport/TransportPage';
import ReceptionPage from './pages/reception/ReceptionPage';
import CertificatesPage from './pages/certificates/CertificatesPage';
import PayrollPage from './pages/payroll/PayrollPage';
import CommunicationPage from './pages/communication/CommunicationPage';
import ReportsPage from './pages/reports/ReportsPage';
import PlatformDashboardPage from './pages/platform-admin/PlatformDashboardPage';
import InstitutionsPage from './pages/platform-admin/InstitutionsPage';
import InstitutionFormPage from './pages/platform-admin/InstitutionFormPage';
import AdmissionDashboard from './pages/admission/AdmissionDashboard';
import EnquiriesPage from './pages/admission/EnquiriesPage';
import EnquiryFormPage from './pages/admission/EnquiryFormPage';
import ApplicationsPage from './pages/admission/ApplicationsPage';
import RolesPage from './pages/permissions/RolesPage';
import AssignmentsPage from './pages/assignments/AssignmentsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Students */}
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/new" element={<StudentFormPage />} />
                <Route path="/students/:id/edit" element={<StudentFormPage />} />

                {/* Parents */}
                <Route path="/parents" element={<ParentsPage />} />

                {/* Teachers */}
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/teachers/new" element={<TeacherFormPage />} />
                <Route path="/teachers/:id/edit" element={<TeacherFormPage />} />

                {/* Academics */}
                <Route path="/academics/classes" element={<ClassesPage />} />
                <Route path="/academics/subjects" element={<SubjectsPage />} />
                <Route path="/academics/sessions" element={<SessionsPage />} />

                {/* Attendance */}
                <Route path="/attendance" element={<AttendancePage />} />

                {/* Timetable */}
                <Route path="/timetable" element={<TimetablePage />} />

                {/* Examinations */}
                <Route path="/examinations" element={<ExamsPage />} />
                <Route path="/examinations/:examId/schedules" element={<ExamSchedulesPage />} />
                <Route path="/examinations/:examId/marks" element={<MarksEntryPage />} />
                <Route path="/examinations/:examId/results" element={<ResultsPage />} />
                <Route path="/results/report-card/:studentId/:examId" element={<ReportCardPage />} />

                {/* Assignments */}
                <Route path="/assignments" element={<AssignmentsPage />} />

                {/* Finance */}
                <Route path="/fees" element={<FeesPage />} />
                <Route path="/fees/invoices" element={<InvoicesPage />} />
                <Route path="/fees/payments" element={<PaymentsPage />} />
                <Route path="/accounts" element={<AccountsPage />} />

                {/* Library */}
                <Route path="/library" element={<LibraryPage />} />

                {/* Inventory */}
                <Route path="/inventory" element={<InventoryPage />} />

                {/* Transport */}
                <Route path="/transport" element={<TransportPage />} />

                {/* Reception */}
                <Route path="/reception" element={<ReceptionPage />} />

                {/* Certificates */}
                <Route path="/certificates" element={<CertificatesPage />} />

                {/* HR & Payroll */}
                <Route path="/payroll" element={<PayrollPage />} />

                {/* Communication */}
                <Route path="/communication" element={<CommunicationPage />} />

                {/* Reports */}
                <Route path="/reports" element={<ReportsPage />} />

                {/* Branches */}
                <Route path="/branches" element={<BranchesPage />} />

                {/* Settings */}
                <Route path="/settings" element={<SettingsPage />} />

                {/* Roles & Permissions */}
                <Route path="/permissions/roles" element={<RolesPage />} />

                {/* Platform Admin */}
                <Route path="/platform-admin" element={<PlatformDashboardPage />} />
                <Route path="/platform-admin/institutions" element={<InstitutionsPage />} />
                <Route path="/platform-admin/institutions/new" element={<InstitutionFormPage />} />
                <Route path="/platform-admin/institutions/:id/edit" element={<InstitutionFormPage />} />

                {/* Admission */}
                <Route path="/admission" element={<AdmissionDashboard />} />
                <Route path="/admission/enquiries" element={<EnquiriesPage />} />
                <Route path="/admission/enquiries/new" element={<EnquiryFormPage />} />
                <Route path="/admission/enquiries/:id/edit" element={<EnquiryFormPage />} />
                <Route path="/admission/applications" element={<ApplicationsPage />} />
                <Route path="/admission/applications/new" element={<EnquiryFormPage />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
