import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';

export const dashboardRouter = Router();

// Apply tenant middleware to ALL routes
dashboardRouter.use(injectTenant);
dashboardRouter.use(requireTenant);

dashboardRouter.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = `institution_id = '${req.institution_id}'`;
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
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = `institution_id = '${req.institution_id}'`;
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
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = `c.institution_id = '${req.institution_id}'`;
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
  // TENANT ISOLATION: Filter by institution_id
  const institutionFilter = `s.institution_id = '${req.institution_id}'`;
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
