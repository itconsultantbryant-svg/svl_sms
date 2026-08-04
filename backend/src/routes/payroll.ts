import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const payrollRouter = Router();

// Apply tenant middleware to ALL routes
payrollRouter.use(injectTenant);
payrollRouter.use(requireTenant);

// Salary Structures
payrollRouter.get('/structures', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const structures = db.prepare(`
    SELECT ss.*,
      (SELECT COUNT(*) FROM employee_salaries WHERE structure_id = ss.id AND is_active = 1) as employee_count
    FROM salary_structures ss WHERE ss.is_active = 1 ORDER BY ss.name
  `).all();
  res.json(structures);
});

payrollRouter.post('/structures', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO salary_structures (id, name, description) VALUES (?, ?, ?)').run(id, name, description || null);
  res.status(201).json({ id, message: 'Salary structure created' });
});

// Salary Components
payrollRouter.get('/structures/:structureId/components', (req: AuthRequest, res: Response) => {
  const { structureId } = req.params;
  const db = getDatabase();
  const components = db.prepare('SELECT * FROM salary_components WHERE structure_id = ? ORDER BY type, sort_order').all(structureId);
  res.json(components);
});

payrollRouter.post('/structures/:structureId/components', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { structureId } = req.params;
  const { name, type, calculation_type, amount, percentage_of, is_taxable, sort_order } = req.body;
  if (!name || !type) { res.status(400).json({ error: 'Name and type are required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO salary_components (id, structure_id, name, type, calculation_type, amount, percentage_of, is_taxable, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, structureId, name, type, calculation_type || 'fixed', amount || 0, percentage_of || null, is_taxable !== undefined ? is_taxable : 1, sort_order || 0);
  res.status(201).json({ id, message: 'Component added' });
});

payrollRouter.delete('/components/:id', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM salary_components WHERE id = ?').run(id);
  res.json({ message: 'Component deleted' });
});

// Employee Salary Assignment
payrollRouter.get('/employee-salaries', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { employee_id } = req.query as any;
  let where = 'WHERE es.is_active = 1';
  const params: any[] = [];
  if (employee_id) { where += ' AND es.employee_id = ?'; params.push(employee_id); }

  const salaries = db.prepare(`
    SELECT es.*, e.first_name, e.last_name, e.employee_id as emp_number,
      d.name as department_name, des.name as designation_name, ss.name as structure_name
    FROM employee_salaries es
    JOIN employees e ON es.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN salary_structures ss ON es.structure_id = ss.id
    ${where} ORDER BY e.first_name
  `).all(...params);
  res.json(salaries);
});

payrollRouter.post('/employee-salaries', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { employee_id, structure_id, basic_salary, effective_from } = req.body;
  if (!employee_id || !structure_id || !basic_salary || !effective_from) {
    res.status(400).json({ error: 'Employee, structure, basic salary and effective date are required' });
    return;
  }
  const db = getDatabase();
  db.prepare('UPDATE employee_salaries SET is_active = 0 WHERE employee_id = ? AND is_active = 1').run(employee_id);
  const id = generateId();
  db.prepare(`INSERT INTO employee_salaries (id, employee_id, structure_id, basic_salary, effective_from) VALUES (?, ?, ?, ?, ?)`).run(id, employee_id, structure_id, basic_salary, effective_from);
  res.status(201).json({ id, message: 'Salary assigned' });
});

// Payroll Runs
payrollRouter.get('/runs', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { year } = req.query as any;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (year) { where += ' AND pr.year = ?'; params.push(parseInt(year)); }

  const runs = db.prepare(`
    SELECT pr.*, u.first_name || ' ' || u.last_name as processed_by_name
    FROM payroll_runs pr
    LEFT JOIN users u ON pr.processed_by = u.id
    ${where} ORDER BY pr.year DESC, pr.month DESC
  `).all(...params);
  res.json(runs);
});

payrollRouter.post('/runs', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { month, year, branch_id, notes } = req.body;
  if (!month || !year) { res.status(400).json({ error: 'Month and year are required' }); return; }
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM payroll_runs WHERE month = ? AND year = ? AND status != ?').get(month, year, 'cancelled') as any;
  if (existing) { res.status(400).json({ error: 'Payroll already exists for this month' }); return; }

  const id = generateId();
  db.prepare(`INSERT INTO payroll_runs (id, month, year, branch_id, notes) VALUES (?, ?, ?, ?, ?)`).run(id, month, year, branch_id || null, notes || null);
  res.status(201).json({ id, message: 'Payroll run created' });
});

// Process Payroll
payrollRouter.post('/runs/:id/process', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(id) as any;
    if (!run) { res.status(404).json({ error: 'Payroll run not found' }); return; }
    if (run.status === 'completed') { res.status(400).json({ error: 'Payroll already processed' }); return; }

    const employeeSalaries = db.prepare(`
      SELECT es.*, e.first_name, e.last_name, e.employee_id as emp_number
      FROM employee_salaries es
      JOIN employees e ON es.employee_id = e.id
      WHERE es.is_active = 1 AND e.is_active = 1
    `).all() as any[];

    if (employeeSalaries.length === 0) {
      res.status(400).json({ error: 'No active employee salaries found' });
      return;
    }

    const transaction = db.transaction(() => {
      let runTotalEarnings = 0;
      let runTotalDeductions = 0;
      let runTotalNet = 0;

      const insertPayslip = db.prepare(`INSERT INTO payslips (id, payroll_id, employee_id, basic_salary, total_earnings, total_deductions, net_salary) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const insertItem = db.prepare(`INSERT INTO payslip_items (id, payslip_id, component_name, type, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);

      for (const es of employeeSalaries) {
        const components = db.prepare('SELECT * FROM salary_components WHERE structure_id = ? ORDER BY type, sort_order').all(es.structure_id) as any[];

        let totalEarnings = es.basic_salary;
        let totalDeductions = 0;
        const items: { name: string; type: string; amount: number; order: number }[] = [
          { name: 'Basic Salary', type: 'earning', amount: es.basic_salary, order: 0 }
        ];

        for (const comp of components) {
          let amount = comp.amount;
          if (comp.calculation_type === 'percentage') {
            amount = (es.basic_salary * comp.amount) / 100;
          }
          items.push({ name: comp.name, type: comp.type, amount, order: comp.sort_order });
          if (comp.type === 'earning') totalEarnings += amount;
          else totalDeductions += amount;
        }

        // Deduct active loans
        const loan = db.prepare('SELECT * FROM employee_loans WHERE employee_id = ? AND status = ?').get(es.employee_id, 'active') as any;
        if (loan && loan.balance > 0) {
          const deduction = Math.min(loan.monthly_deduction, loan.balance);
          items.push({ name: 'Loan Deduction', type: 'deduction', amount: deduction, order: 99 });
          totalDeductions += deduction;
          const newPaid = loan.total_paid + deduction;
          const newBalance = loan.amount - newPaid;
          db.prepare('UPDATE employee_loans SET total_paid = ?, balance = ?, status = ? WHERE id = ?').run(newPaid, Math.max(0, newBalance), newBalance <= 0 ? 'completed' : 'active', loan.id);
        }

        const netSalary = totalEarnings - totalDeductions;
        const payslipId = generateId();
        insertPayslip.run(payslipId, id, es.employee_id, es.basic_salary, totalEarnings, totalDeductions, netSalary);

        for (const item of items) {
          insertItem.run(generateId(), payslipId, item.name, item.type, item.amount, item.order);
        }

        runTotalEarnings += totalEarnings;
        runTotalDeductions += totalDeductions;
        runTotalNet += netSalary;
      }

      db.prepare(`UPDATE payroll_runs SET status = 'completed', total_earnings = ?, total_deductions = ?, total_net = ?, employee_count = ?, processed_by = ?, processed_at = datetime('now') WHERE id = ?`).run(runTotalEarnings, runTotalDeductions, runTotalNet, employeeSalaries.length, req.user?.id || null, id);
    });

    transaction();
    res.json({ message: 'Payroll processed successfully' });
  } catch (err: any) {
    console.error('Payroll processing error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Payslips
payrollRouter.get('/runs/:id/payslips', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const payslips = db.prepare(`
    SELECT ps.*, e.first_name, e.last_name, e.employee_id as emp_number,
      d.name as department_name, des.name as designation_name
    FROM payslips ps
    JOIN employees e ON ps.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    WHERE ps.payroll_id = ?
    ORDER BY e.first_name
  `).all(id);
  res.json(payslips);
});

payrollRouter.get('/payslips/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const payslip = db.prepare(`
    SELECT ps.*, e.first_name, e.last_name, e.employee_id as emp_number, e.email,
      d.name as department_name, des.name as designation_name,
      pr.month, pr.year
    FROM payslips ps
    JOIN employees e ON ps.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN payroll_runs pr ON ps.payroll_id = pr.id
    WHERE ps.id = ?
  `).get(id) as any;
  if (!payslip) { res.status(404).json({ error: 'Payslip not found' }); return; }

  const items = db.prepare('SELECT * FROM payslip_items WHERE payslip_id = ? ORDER BY type, sort_order').all(id);
  const institution = db.prepare('SELECT * FROM institutions LIMIT 1').get();
  res.json({ payslip, items, institution });
});

// Leave Types
payrollRouter.get('/leave-types', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const types = db.prepare('SELECT * FROM leave_types WHERE is_active = 1 ORDER BY name').all();
  res.json(types);
});

payrollRouter.post('/leave-types', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { name, days_allowed, is_paid } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO leave_types (id, name, days_allowed, is_paid) VALUES (?, ?, ?, ?)').run(id, name, days_allowed || 0, is_paid !== undefined ? is_paid : 1);
  res.status(201).json({ id, message: 'Leave type created' });
});

// Leave Applications
payrollRouter.get('/leaves', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', status, employee_id } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND la.status = ?'; params.push(status); }
  if (employee_id) { where += ' AND la.employee_id = ?'; params.push(employee_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM leave_applications la ${where}`).get(...params) as any;
  const leaves = db.prepare(`
    SELECT la.*, e.first_name, e.last_name, e.employee_id as emp_number,
      lt.name as leave_type_name, u.first_name || ' ' || u.last_name as approved_by_name
    FROM leave_applications la
    JOIN employees e ON la.employee_id = e.id
    LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
    LEFT JOIN users u ON la.approved_by = u.id
    ${where} ORDER BY la.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: leaves, total: total.count, page: parseInt(page), limit: lim });
});

payrollRouter.post('/leaves', (req: AuthRequest, res: Response) => {
  const { employee_id, leave_type_id, start_date, end_date, days, reason } = req.body;
  if (!employee_id || !leave_type_id || !start_date || !end_date || !days) {
    res.status(400).json({ error: 'Employee, leave type, dates and days are required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO leave_applications (id, employee_id, leave_type_id, start_date, end_date, days, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, employee_id, leave_type_id, start_date, end_date, days, reason || null);
  res.status(201).json({ id, message: 'Leave application submitted' });
});

payrollRouter.put('/leaves/:id/approve', authorize('platform_admin', 'institution_admin', 'hr_manager', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Valid status (approved/rejected) is required' });
    return;
  }
  const db = getDatabase();
  db.prepare(`UPDATE leave_applications SET status = ?, approved_by = ?, approved_at = datetime('now'), notes = ? WHERE id = ?`).run(status, req.user?.id || null, notes || null, id);
  res.json({ message: `Leave ${status}` });
});

// Loans
payrollRouter.get('/loans', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { employee_id, status } = req.query as any;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (employee_id) { where += ' AND el.employee_id = ?'; params.push(employee_id); }
  if (status) { where += ' AND el.status = ?'; params.push(status); }

  const loans = db.prepare(`
    SELECT el.*, e.first_name, e.last_name, e.employee_id as emp_number
    FROM employee_loans el
    JOIN employees e ON el.employee_id = e.id
    ${where} ORDER BY el.created_at DESC
  `).all(...params);
  res.json(loans);
});

payrollRouter.post('/loans', authorize('platform_admin', 'institution_admin', 'hr_manager'), (req: AuthRequest, res: Response) => {
  const { employee_id, amount, monthly_deduction, start_date, reason } = req.body;
  if (!employee_id || !amount || !monthly_deduction || !start_date) {
    res.status(400).json({ error: 'Employee, amount, monthly deduction and start date are required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  db.prepare(`INSERT INTO employee_loans (id, employee_id, amount, monthly_deduction, balance, start_date, reason, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, employee_id, amount, monthly_deduction, amount, start_date, reason || null, req.user?.id || null);
  res.status(201).json({ id, message: 'Loan created' });
});
