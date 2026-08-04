import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database/init';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { branchesRouter } from './routes/branches';
import { studentsRouter } from './routes/students';
import { parentsRouter } from './routes/parents';
import { teachersRouter } from './routes/teachers';
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
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRouter);

app.use('/api/users', authenticate, usersRouter);
app.use('/api/branches', authenticate, branchesRouter);
app.use('/api/students', authenticate, studentsRouter);
app.use('/api/parents', authenticate, parentsRouter);
app.use('/api/teachers', authenticate, teachersRouter);
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

app.use(errorHandler);

initializeDatabase();

app.listen(PORT, () => {
  console.log(`SVL-SMS Backend running on port ${PORT}`);
});

export default app;
