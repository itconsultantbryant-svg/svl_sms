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
