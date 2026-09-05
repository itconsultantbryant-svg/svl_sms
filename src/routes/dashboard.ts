import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';

export const dashboardRouter = Router();

// Apply tenant middleware to ALL routes
dashboardRouter.use(injectTenant);
dashboardRouter.use(requireTenant);

function getInstitutionFilter(req: AuthRequest, alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  if (req.institution_id) {
    return `${prefix}institution_id = '${req.institution_id}'`;
  }
  return '1=1';
}

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req);
  const branchFilter = req.user?.branch_id ? `AND branch_id = '${req.user.branch_id}'` : '';

  const totalStudents = db.prepare(`SELECT COUNT(*) as count FROM students WHERE ${institutionFilter} AND status = 'active' ${branchFilter}`).get() as any;
  const totalTeachers = db.prepare(`SELECT COUNT(*) as count FROM employees WHERE ${institutionFilter} AND is_teacher = 1 AND is_active = 1 ${branchFilter}`).get() as any;
  const totalEmployees = db.prepare(`SELECT COUNT(*) as count FROM employees WHERE ${institutionFilter} AND is_active = 1 ${branchFilter}`).get() as any;
  const totalParents = db.prepare(`SELECT COUNT(*) as count FROM parents WHERE ${institutionFilter}`).get() as any;
  const totalClasses = db.prepare(`SELECT COUNT(*) as count FROM classes WHERE ${institutionFilter} AND is_active = 1 ${branchFilter}`).get() as any;
  const totalBranches = db.prepare(`SELECT COUNT(*) as count FROM branches WHERE ${institutionFilter} AND is_active = 1`).get() as any;

  res.json({
    total_students: totalStudents.count,
    total_teachers: totalTeachers.count,
    total_employees: totalEmployees.count,
    total_parents: totalParents.count,
    total_classes: totalClasses.count,
    total_branches: totalBranches.count,
  });
});

dashboardRouter.get('/gender-stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req);
  const branchFilter = req.user?.branch_id ? `AND branch_id = '${req.user.branch_id}'` : '';

  const stats = db.prepare(`
    SELECT gender, COUNT(*) as count FROM students
    WHERE ${institutionFilter} AND status = 'active' ${branchFilter}
    GROUP BY gender
  `).all();

  res.json(stats);
});

dashboardRouter.get('/class-population', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req, 'c');
  const branchFilter = req.user?.branch_id ? `AND s.branch_id = '${req.user.branch_id}'` : '';

  const stats = db.prepare(`
    SELECT c.name as class_name, COUNT(s.id) as student_count
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active' ${branchFilter}
    WHERE ${institutionFilter} AND c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `).all();

  res.json(stats);
});

dashboardRouter.get('/recent-admissions', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req, 's');
  const branchFilter = req.user?.branch_id ? `AND s.branch_id = '${req.user.branch_id}'` : '';

  const students = db.prepare(`
    SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo, s.admission_date,
           c.name as class_name, sec.name as section_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE ${institutionFilter} AND s.status = 'active' ${branchFilter}
    ORDER BY s.created_at DESC
    LIMIT 10
  `).all();

  res.json(students);
});

dashboardRouter.get('/fee-summary', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req);

  try {
    const monthly: any[] = [];
    for (let i = 0; i < 12; i++) {
      const month = String(i + 1).padStart(2, '0');
      const year = new Date().getFullYear();
      const startDate = `${year}-${month}-01`;
      const endDate = i < 11 ? `${year}-${String(i + 2).padStart(2, '0')}-01` : `${year + 1}-01-01`;

      let total = 0, collected = 0;
      try {
        const totalRow = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM fee_invoices
          WHERE ${institutionFilter} AND due_date >= ? AND due_date < ?
        `).get(startDate, endDate) as any;
        total = totalRow?.total || 0;

        const collectedRow = db.prepare(`
          SELECT COALESCE(SUM(amount_paid), 0) as collected FROM fee_payments
          WHERE ${institutionFilter} AND payment_date >= ? AND payment_date < ?
        `).get(startDate, endDate) as any;
        collected = collectedRow?.collected || 0;
      } catch (e) {}

      monthly.push({ total, collected, remaining: total - collected });
    }

    res.json({ monthly });
  } catch (error) {
    res.json({ monthly: Array(12).fill({ total: 0, collected: 0, remaining: 0 }) });
  }
});

dashboardRouter.get('/finance-summary', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const endDate = now.getMonth() < 11 ? `${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01` : `${year + 1}-01-01`;

  let income = 0, expense = 0;
  try {
    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paid), 0) as total FROM fee_payments
      WHERE ${institutionFilter} AND payment_date >= ? AND payment_date < ?
    `).get(startDate, endDate) as any;
    income = incomeRow?.total || 0;
  } catch (e) {}

  try {
    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM account_transactions
      WHERE ${institutionFilter} AND type = 'expense' AND transaction_date >= ? AND transaction_date < ?
    `).get(startDate, endDate) as any;
    expense = expenseRow?.total || 0;
  } catch (e) {}

  res.json({ income, expense });
});

dashboardRouter.get('/attendance-weekly', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const institutionFilter = getInstitutionFilter(req);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const days: any[] = [];

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    let present = 0, absent = 0;
    try {
      const presentRow = db.prepare(`
        SELECT COUNT(*) as count FROM attendance
        WHERE ${institutionFilter} AND date = ? AND status = 'present'
      `).get(dateStr) as any;
      present = presentRow?.count || 0;

      const absentRow = db.prepare(`
        SELECT COUNT(*) as count FROM attendance
        WHERE ${institutionFilter} AND date = ? AND status = 'absent'
      `).get(dateStr) as any;
      absent = absentRow?.count || 0;
    } catch (e) {}

    days.push({ name: dayNames[i], day: dayNames[i], present, absent });
  }

  res.json({ days });
});

// Finance officer dashboard
dashboardRouter.get('/finance', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const iid = req.institution_id;
  const safe = (fn: () => any, fallback: any = 0) => {
    try { return fn(); } catch { return fallback; }
  };

  const totalInvoiced = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM fee_invoices WHERE institution_id = ?`).get(iid) as any).v);
  const totalCollected = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount_paid),0) as v FROM fee_payments WHERE institution_id = ?`).get(iid) as any).v);
  const outstanding = Math.max(0, Number(totalInvoiced) - Number(totalCollected));
  const unpaidInvoices = safe(() => (db.prepare(`SELECT COUNT(*) as v FROM fee_invoices WHERE institution_id = ? AND status IN ('unpaid','partial','overdue')`).get(iid) as any).v);
  const paymentsToday = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount_paid),0) as v FROM fee_payments WHERE institution_id = ? AND DATE(payment_date) = DATE('now')`).get(iid) as any).v);
  const expenseMonth = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM account_transactions WHERE institution_id = ? AND type = 'expense' AND strftime('%Y-%m', transaction_date) = strftime('%Y-%m','now')`).get(iid) as any).v);
  const incomeMonth = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount_paid),0) as v FROM fee_payments WHERE institution_id = ? AND strftime('%Y-%m', payment_date) = strftime('%Y-%m','now')`).get(iid) as any).v);

  const recentPayments = safe(() => db.prepare(`
    SELECT p.id, p.amount_paid, p.payment_date, p.payment_method,
           s.first_name || ' ' || s.last_name as student_name, s.admission_number
    FROM fee_payments p
    LEFT JOIN students s ON s.id = p.student_id
    WHERE p.institution_id = ?
    ORDER BY p.payment_date DESC LIMIT 10
  `).all(iid), []);

  res.json({
    total_invoiced: totalInvoiced,
    total_collected: totalCollected,
    outstanding,
    unpaid_invoices: unpaidInvoices,
    payments_today: paymentsToday,
    income_this_month: incomeMonth,
    expense_this_month: expenseMonth,
    net_this_month: Number(incomeMonth) - Number(expenseMonth),
    recent_payments: recentPayments,
  });
});

// Staff dashboard
dashboardRouter.get('/staff', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const iid = req.institution_id;
  const safe = (fn: () => any, fallback: any = 0) => {
    try { return fn(); } catch { return fallback; }
  };

  res.json({
    total_students: safe(() => (db.prepare(`SELECT COUNT(*) as v FROM students WHERE institution_id = ? AND status = 'active'`).get(iid) as any).v),
    total_teachers: safe(() => (db.prepare(`SELECT COUNT(*) as v FROM employees WHERE institution_id = ? AND is_teacher = 1 AND is_active = 1`).get(iid) as any).v),
    open_enquiries: safe(() => (db.prepare(`SELECT COUNT(*) as v FROM admission_enquiries WHERE institution_id = ? AND status IN ('new','follow_up','pending')`).get(iid) as any).v),
    visitors_today: safe(() => (db.prepare(`SELECT COUNT(*) as v FROM visitors WHERE institution_id = ? AND DATE(visit_date) = DATE('now')`).get(iid) as any).v),
    library_issues: safe(() => (db.prepare(`SELECT COUNT(*) as v FROM book_issues WHERE institution_id = ? AND status = 'issued'`).get(iid) as any).v),
    announcements: safe(() => db.prepare(`
      SELECT id, title, created_at FROM announcements
      WHERE institution_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(iid), []),
  });
});

// Teacher dashboard
dashboardRouter.get('/teacher', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const iid = req.institution_id;
  const userId = req.user?.id;
  const safe = (fn: () => any, fallback: any = 0) => {
    try { return fn(); } catch { return fallback; }
  };

  const employee = safe(() => db.prepare(`SELECT id FROM employees WHERE user_id = ? AND institution_id = ?`).get(userId, iid), null) as any;
  const empId = employee?.id;

  res.json({
    my_classes: safe(() => (db.prepare(`SELECT COUNT(DISTINCT class_id) as v FROM teacher_assignments WHERE teacher_id = ? AND institution_id = ?`).get(empId, iid) as any)?.v || 0),
    my_students: safe(() => (db.prepare(`
      SELECT COUNT(DISTINCT s.id) as v FROM students s
      JOIN teacher_assignments ta ON ta.class_id = s.class_id
      WHERE ta.teacher_id = ? AND s.institution_id = ? AND s.status = 'active'
    `).get(empId, iid) as any)?.v || 0),
    pending_assignments: safe(() => (db.prepare(`
      SELECT COUNT(*) as v FROM homework_assignments
      WHERE teacher_id = ? AND institution_id = ? AND due_date >= DATE('now')
    `).get(empId, iid) as any)?.v || 0),
    attendance_today: safe(() => (db.prepare(`
      SELECT COUNT(*) as v FROM attendance_sessions
      WHERE teacher_id = ? AND institution_id = ? AND DATE(session_date) = DATE('now')
    `).get(empId, iid) as any)?.v || 0),
  });
});

// Student dashboard
dashboardRouter.get('/student', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const iid = req.institution_id;
  const userId = req.user?.id;
  const safe = (fn: () => any, fallback: any = 0) => {
    try { return fn(); } catch { return fallback; }
  };

  const student = safe(() => db.prepare(`SELECT id, class_id FROM students WHERE user_id = ? AND institution_id = ?`).get(userId, iid), null) as any;

  res.json({
    pending_assignments: safe(() => (db.prepare(`
      SELECT COUNT(*) as v FROM homework_assignments ha
      WHERE ha.class_id = ? AND ha.institution_id = ? AND ha.due_date >= DATE('now')
        AND NOT EXISTS (SELECT 1 FROM homework_submissions hs WHERE hs.assignment_id = ha.id AND hs.student_id = ?)
    `).get(student?.class_id, iid, student?.id) as any)?.v || 0),
    attendance_pct: safe(() => {
      const total = (db.prepare(`SELECT COUNT(*) as v FROM attendance WHERE student_id = ?`).get(student?.id) as any)?.v || 0;
      const present = (db.prepare(`SELECT COUNT(*) as v FROM attendance WHERE student_id = ? AND status = 'present'`).get(student?.id) as any)?.v || 0;
      return total ? Math.round((present / total) * 100) : 0;
    }),
    recent_grades: safe(() => db.prepare(`
      SELECT m.marks_obtained, m.max_marks, sub.name as subject_name, e.name as exam_name
      FROM marks m
      LEFT JOIN subjects sub ON sub.id = m.subject_id
      LEFT JOIN examinations e ON e.id = m.exam_id
      WHERE m.student_id = ?
      ORDER BY m.created_at DESC LIMIT 5
    `).all(student?.id), []),
  });
});

// Parent dashboard
dashboardRouter.get('/parent', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const iid = req.institution_id;
  const userId = req.user?.id;
  const safe = (fn: () => any, fallback: any = 0) => {
    try { return fn(); } catch { return fallback; }
  };

  const parent = safe(() => db.prepare(`SELECT id FROM parents WHERE user_id = ? AND institution_id = ?`).get(userId, iid), null) as any;

  const children = safe(() => db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.admission_number, c.name as class_name
    FROM students s
    JOIN student_parents sp ON sp.student_id = s.id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE sp.parent_id = ? AND s.institution_id = ?
  `).all(parent?.id, iid), []);

  res.json({
    children_count: (children as any[]).length,
    children,
    outstanding_fees: safe(() => {
      const ids = (children as any[]).map((c) => c.id);
      if (!ids.length) return 0;
      const placeholders = ids.map(() => '?').join(',');
      return (db.prepare(`
        SELECT COALESCE(SUM(amount - COALESCE(amount_paid,0)),0) as v FROM fee_invoices
        WHERE student_id IN (${placeholders}) AND status IN ('unpaid','partial','overdue')
      `).get(...ids) as any)?.v || 0;
    }),
  });
});
