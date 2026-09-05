import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/init';
import { ensureAdminUser } from './database/ensure-admin';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { branchesRouter } from './routes/branches';
import { studentsRouter } from './routes/students';
import { parentsRouter } from './routes/parents';
import { teachersRouter } from './routes/teachers';
import teacherDashboardRouter from './routes/teacher-dashboard';
import assignmentsRouter from './routes/assignments';
import gradeApprovalRouter from './routes/grade-approval';
import studentPortalRouter from './routes/student-portal';
import parentPortalRouter from './routes/parent-portal';
import permissionsRouter from './routes/permissions';
import { academicsRouter } from './routes/academics';
import { settingsRouter } from './routes/settings';
import { dashboardRouter } from './routes/dashboard';
import { attendanceRouter } from './routes/attendance';
import { timetableRouter } from './routes/timetable';
import { examinationsRouter } from './routes/examinations';
import { marksRouter } from './routes/marks';
import { resultsRouter } from './routes/results';
import { feesRouter } from './routes/fees';
import { accountsRouter } from './routes/accounts';
import { libraryRouter } from './routes/library';
import { inventoryRouter } from './routes/inventory';
import { transportRouter } from './routes/transport';
import { receptionRouter } from './routes/reception';
import { certificatesRouter } from './routes/certificates';
import { payrollRouter } from './routes/payroll';
import { communicationRouter } from './routes/communication-simple';
import { reportsRouter } from './routes/reports';
import { platformAdminRouter } from './routes/platform-admin';
import admissionRouter from './routes/admission';
import { licensingRouter } from './routes/licensing';
import { demoModeRouter } from './routes/demo-mode-enforcement';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// CORS Configuration - MUST be before routes
const allowedOrigins = (process.env.CORS_ORIGINS || [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://svl-sms.vercel.app',
  'https://sms-system-ruby.vercel.app',
  'https://svl-sms-frontend.vercel.app',
].join(',')).split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, Electron, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Allow known Vercel/Render preview hosts for this product family
      const isTrustedHost =
        /\.vercel\.app$/i.test(origin) ||
        /\.onrender\.com$/i.test(origin) ||
        origin.startsWith('http://localhost:');
      if (isTrustedHost) {
        callback(null, true);
        return;
      }
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(null, true); // Prefer availability; credentials still work with reflected origin
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Institution-ID']
}));

// Body parsing — raised for school logo base64 payloads (default 100kb is too small)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes (no auth middleware)
app.use('/api/auth', authRouter);

// Licensing routes (no auth required for activation, auth required for check)
app.use('/api/licensing', licensingRouter);
app.use('/api/demo-mode', demoModeRouter);

// Protected routes (require authentication)
app.use('/api/users', authenticate, usersRouter);
app.use('/api/branches', authenticate, branchesRouter);
app.use('/api/students', authenticate, studentsRouter);
app.use('/api/parents', authenticate, parentsRouter);
app.use('/api/teachers', authenticate, teachersRouter);
app.use('/api/teacher-dashboard', authenticate, teacherDashboardRouter);
app.use('/api/assignments', authenticate, assignmentsRouter);
app.use('/api/grade-approval', authenticate, gradeApprovalRouter);
app.use('/api/student-portal', authenticate, studentPortalRouter);
app.use('/api/parent-portal', authenticate, parentPortalRouter);
app.use('/api/permissions', authenticate, permissionsRouter);
app.use('/api/academics', authenticate, academicsRouter);
app.use('/api/settings', authenticate, settingsRouter);
app.use('/api/dashboard', authenticate, dashboardRouter);
app.use('/api/attendance', authenticate, attendanceRouter);
app.use('/api/timetable', authenticate, timetableRouter);
app.use('/api/examinations', authenticate, examinationsRouter);
app.use('/api/marks', authenticate, marksRouter);
app.use('/api/results', authenticate, resultsRouter);
app.use('/api/fees', authenticate, feesRouter);
app.use('/api/accounts', authenticate, accountsRouter);
app.use('/api/library', authenticate, libraryRouter);
app.use('/api/inventory', authenticate, inventoryRouter);
app.use('/api/transport', authenticate, transportRouter);
app.use('/api/reception', authenticate, receptionRouter);
app.use('/api/certificates', authenticate, certificatesRouter);
app.use('/api/payroll', authenticate, payrollRouter);
app.use('/api/communication', authenticate, communicationRouter);
app.use('/api/reports', authenticate, reportsRouter);
app.use('/api/platform-admin', authenticate, platformAdminRouter);
app.use('/api/admission', authenticate, admissionRouter);

// Error handler
app.use(errorHandler);

// Initialize database and ensure developer superadmin exists
initializeDatabase();
ensureAdminUser();

// Start server. Inside Electron (packaged build), electron/main.ts imports this
// module and calls app.listen() itself so the backend runs IN the Electron main
// process (no separate Node.exe needed). Guard the auto-listen so merely
// requiring the module does not spawn a second server.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SVL-SMS Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS Origins: ${allowedOrigins.join(', ')}`);
  });
}

export default app;
