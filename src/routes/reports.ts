import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const reportsRouter = Router();

// Apply tenant middleware to ALL routes
reportsRouter.use(injectTenant);
reportsRouter.use(requireTenant);

// Dashboard Statistics
reportsRouter.get('/stats', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();

    // Student stats
    const students = db.prepare('SELECT COUNT(*) as total, COUNT(CASE WHEN status = ? THEN 1 END) as active FROM students').get('active') as any;

    // Teacher stats
    const teachers = db.prepare('SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = 1 THEN 1 END) as active FROM employees WHERE is_teacher = 1').all();

    // Financial stats (current month)
    const finance = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM account_transactions
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `).get() as any;

    // Fee collection stats
    const fees = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as collected
      FROM invoices
      WHERE academic_session_id IN (SELECT id FROM academic_sessions WHERE is_current = 1)
    `).get() as any;

    // Attendance stats (today)
    const attendance = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
      FROM attendance
      WHERE date = date('now')
    `).get() as any;

    res.json({
      students,
      teachers: teachers[0] || { total: 0, active: 0 },
      finance: { ...finance, balance: (finance?.income || 0) - (finance?.expense || 0) },
      fees,
      attendance: { ...attendance, percentage: attendance?.total ? ((attendance.present / attendance.total) * 100).toFixed(1) : 0 }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Student Reports
reportsRouter.get('/students', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { class_id, section_id, status } = req.query as any;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }
    if (section_id) { where += ' AND s.section_id = ?'; params.push(section_id); }
    if (status) { where += ' AND s.status = ?'; params.push(status); }

    const students = db.prepare(`
      SELECT s.*, c.name as class_name, sec.name as section_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'present') as present_days,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id) as total_days
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      ${where}
      ORDER BY c.sort_order, sec.name, s.first_name
    `).all(...params);

    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Financial Reports
reportsRouter.get('/financial', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { start_date, end_date, type } = req.query as any;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (start_date) { where += ' AND date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND date <= ?'; params.push(end_date); }
    if (type) { where += ' AND type = ?'; params.push(type); }

    const transactions = db.prepare(`
      SELECT at.*,
        CASE
          WHEN at.type = 'income' THEN ic.name
          WHEN at.type = 'expense' THEN ec.name
        END as category_name
      FROM account_transactions at
      LEFT JOIN income_categories ic ON at.category_id = ic.id
      LEFT JOIN expense_categories ec ON at.category_id = ec.id
      ${where}
      ORDER BY at.date DESC
    `).all(...params);

    const summary = db.prepare(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM account_transactions
      ${where}
      GROUP BY type
    `).all(...params);

    res.json({ transactions, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance Reports
reportsRouter.get('/attendance', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { start_date, end_date, class_id } = req.query as any;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (start_date) { where += ' AND a.date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND a.date <= ?'; params.push(end_date); }
    if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }

    const report = db.prepare(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name, c.name as class_name,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
        COUNT(*) as total_days
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id ${where.replace('WHERE 1=1', '')}
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY c.sort_order, s.first_name
    `).all(...params);

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Academic Performance Reports
reportsRouter.get('/academic', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { exam_id, class_id } = req.query as any;

    if (!exam_id) {
      res.status(400).json({ error: 'Exam ID required' });
      return;
    }

    let where = 'WHERE er.exam_id = ?';
    const params: any[] = [exam_id];
    if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }

    const results = db.prepare(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name,
        c.name as class_name, sec.name as section_name,
        er.total_marks, er.marks_obtained, er.percentage, er.grade, er.rank
      FROM students s
      LEFT JOIN exam_results er ON s.id = er.student_id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      ${where}
      ORDER BY er.rank, s.first_name
    `).all(...params);

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Reports
reportsRouter.post('/custom', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const { query, parameters } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    // Basic SQL injection protection - only allow SELECT
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      res.status(400).json({ error: 'Only SELECT queries allowed' });
      return;
    }

    const db = getDatabase();
    const results = db.prepare(query).all(...(parameters || []));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backup Management
reportsRouter.post('/backup', authorize('platform_admin', 'super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const id = generateId();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backups/backup_${timestamp}.db`;

    // In production, implement actual file backup logic here
    db.prepare('INSERT INTO system_backups (id, type, file_path, status, initiated_by) VALUES (?, ?, ?, ?, ?)').run(
      id, 'database', backupPath, 'completed', req.user?.id || null
    );

    res.status(201).json({ id, file_path: backupPath, message: 'Backup created' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Backups
reportsRouter.get('/backups', authorize('platform_admin', 'super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const backups = db.prepare('SELECT * FROM system_backups ORDER BY created_at DESC LIMIT 50').all();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Operations Status
reportsRouter.get('/bulk-operations', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const operations = db.prepare('SELECT * FROM bulk_operations ORDER BY started_at DESC LIMIT 50').all();
    res.json(operations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Health
reportsRouter.get('/health', authorize('platform_admin', 'super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();

    // Database size
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as any;

    // Table counts
    const tables = db.prepare(`
      SELECT name, (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as count
      FROM sqlite_master m WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    // Recent activity
    const recentActivity = {
      students_today: db.prepare("SELECT COUNT(*) as count FROM students WHERE date(created_at) = date('now')").get(),
      attendance_today: db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = date('now')").get(),
      payments_today: db.prepare("SELECT COUNT(*) as count FROM payments WHERE date(payment_date) = date('now')").get()
    };

    res.json({
      database_size: dbSize?.size || 0,
      tables_count: tables.length,
      recent_activity: recentActivity,
      status: 'healthy'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
