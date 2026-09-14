import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { deleteSchoolRecord } from '../utils/purgeRecords';

export const recordsRouter = Router();

recordsRouter.use(injectTenant);
recordsRouter.use(requireTenant);

const ADMIN = ['platform_admin', 'institution_admin'] as const;
const FINANCE = ['platform_admin', 'institution_admin', 'accountant', 'finance_officer', 'finance'] as const;

type Resource = {
  table: string;
  roles: readonly string[];
  fields: string[];
  userColumn?: string;
};

const RESOURCES: Record<string, Resource> = {
  students: { table: 'students', roles: ADMIN, userColumn: 'user_id', fields: ['first_name', 'last_name', 'status', 'phone', 'email', 'address', 'gender', 'class_id', 'section_id', 'session_id'] },
  teachers: { table: 'employees', roles: ADMIN, userColumn: 'user_id', fields: ['first_name', 'last_name', 'phone', 'email', 'address', 'is_active', 'department_id', 'designation_id'] },
  staff: { table: 'employees', roles: ADMIN, userColumn: 'user_id', fields: ['first_name', 'last_name', 'phone', 'email', 'address', 'is_active', 'department_id', 'designation_id'] },
  employees: { table: 'employees', roles: ADMIN, userColumn: 'user_id', fields: ['first_name', 'last_name', 'phone', 'email', 'address', 'is_active', 'department_id', 'designation_id'] },
  parents: { table: 'parents', roles: ADMIN, userColumn: 'user_id', fields: ['first_name', 'last_name', 'phone', 'email', 'address', 'occupation', 'relationship'] },
  sessions: { table: 'academic_sessions', roles: ADMIN, fields: ['name', 'start_date', 'end_date', 'is_current'] },
  terms: { table: 'terms', roles: ADMIN, fields: ['name', 'start_date', 'end_date', 'session_id'] },
  classes: { table: 'classes', roles: ADMIN, fields: ['name', 'capacity', 'is_active', 'branch_id'] },
  subjects: { table: 'subjects', roles: ADMIN, fields: ['name', 'code', 'is_active'] },
  branches: { table: 'branches', roles: ADMIN, fields: ['branch_name', 'branch_code', 'address', 'phone', 'email', 'is_active'] },
  exams: { table: 'exams', roles: ADMIN, fields: ['name', 'status', 'start_date', 'end_date'] },
  attendance: { table: 'attendance_sessions', roles: ADMIN, fields: ['date', 'status'] },
  periods: { table: 'timetable_periods', roles: ADMIN, fields: ['name', 'start_time', 'end_time', 'is_break'] },
  timetable: { table: 'timetable_entries', roles: ADMIN, fields: ['subject_id', 'teacher_id', 'room'] },
  fee_types: { table: 'fee_types', roles: FINANCE, fields: ['name', 'code', 'description', 'is_active', 'is_recurring'] },
  fee_structures: { table: 'fee_structures', roles: FINANCE, fields: ['amount', 'due_date', 'is_active'] },
  invoices: { table: 'invoices', roles: FINANCE, fields: ['status', 'due_date', 'notes'] },
  payments: { table: 'payments', roles: FINANCE, fields: ['status', 'notes'] },
  payslips: { table: 'payslips', roles: FINANCE, fields: ['status'] },
  payroll_runs: { table: 'payroll_runs', roles: FINANCE, fields: ['status'] },
  income: { table: 'income', roles: FINANCE, fields: ['amount', 'date', 'description', 'category_id', 'payment_method', 'reference'] },
  expenses: { table: 'expenses', roles: FINANCE, fields: ['amount', 'date', 'description', 'category_id', 'payment_method', 'reference', 'vendor'] },
  income_categories: { table: 'income_categories', roles: FINANCE, fields: ['name', 'description', 'is_active'] },
  expense_categories: { table: 'expense_categories', roles: FINANCE, fields: ['name', 'description', 'is_active'] },
  lesson_plans: { table: 'lesson_plans', roles: ADMIN, fields: ['title', 'description'] },
  gradebooks: { table: 'gradebooks', roles: ADMIN, fields: ['status'] },
  departments: { table: 'departments', roles: ADMIN, fields: ['name', 'description'] },
  designations: { table: 'designations', roles: ADMIN, fields: ['name', 'description'] },
  inventory_items: { table: 'inventory_items', roles: ADMIN, fields: ['name', 'sku', 'quantity', 'min_quantity', 'unit', 'unit_price', 'location', 'description', 'is_active'] },
  inventory_categories: { table: 'inventory_categories', roles: ADMIN, fields: ['name', 'description', 'is_active'] },
  stock_transactions: { table: 'stock_transactions', roles: ADMIN, fields: ['notes', 'vendor', 'reference'] },
  visitors: { table: 'visitors', roles: ADMIN, fields: ['name', 'phone', 'purpose', 'to_meet', 'id_type', 'id_number', 'notes'] },
  phone_calls: { table: 'phone_calls', roles: ADMIN, fields: ['caller_name', 'phone', 'purpose', 'date', 'duration', 'notes'] },
  postal_records: { table: 'postal_records', roles: ADMIN, fields: ['from_to', 'reference_number', 'description', 'date', 'received_by', 'notes'] },
  vehicles: { table: 'vehicles', roles: ADMIN, fields: ['vehicle_number', 'model', 'driver_name', 'driver_phone', 'driver_license', 'capacity', 'status', 'insurance_expiry', 'notes'] },
  transport_routes: { table: 'transport_routes', roles: ADMIN, fields: ['name', 'fare', 'description', 'is_active'] },
  student_transport: { table: 'student_transport', roles: ADMIN, fields: ['route_id', 'stop_id', 'pickup', 'dropoff'] },
  books: { table: 'books', roles: ADMIN, fields: ['title', 'isbn', 'author', 'publisher', 'edition', 'year', 'quantity', 'available', 'rack_number', 'price', 'description', 'is_active'] },
  book_categories: { table: 'book_categories', roles: ADMIN, fields: ['name', 'description', 'is_active'] },
  book_issues: { table: 'book_issues', roles: ADMIN, fields: ['due_date', 'status', 'fine_amount', 'notes'] },
  announcements: { table: 'announcements', roles: ADMIN, fields: ['title', 'content', 'type', 'priority', 'audience', 'is_published', 'expires_at'] },
  notification_templates: { table: 'notification_templates', roles: ADMIN, fields: ['name', 'type', 'event', 'subject', 'body', 'is_active'] },
  sms_messages: { table: 'sms_messages', roles: ADMIN, fields: ['message', 'status'] },
  email_messages: { table: 'email_messages', roles: ADMIN, fields: ['subject', 'body', 'status'] },
  communication_log: { table: 'communication_log', roles: ADMIN, fields: [] },
  certificates: { table: 'certificates', roles: ADMIN, fields: ['issued_date'] },
  certificate_templates: { table: 'certificate_templates', roles: ADMIN, fields: ['name', 'type', 'content', 'header', 'footer', 'is_active'] },
};

function resourceOf(name: string): Resource | undefined {
  return RESOURCES[name];
}

function canManage(req: AuthRequest, roles: readonly string[]): boolean {
  const userType = req.user?.user_type || '';
  const roleCode = req.user?.role_code || '';
  const roleCodes = req.user?.role_codes || [];
  return roles.includes(userType) || roles.includes(roleCode) || roleCodes.some((code) => roles.includes(code));
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

recordsRouter.put('/:resource/:id', (req: AuthRequest, res: Response) => {
  const spec = resourceOf(req.params.resource);
  if (!spec) {
    res.status(404).json({ error: 'This record type cannot be updated here' });
    return;
  }
  if (!canManage(req, spec.roles)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  if (!req.institution_id) {
    res.status(400).json({ error: 'Select a school before updating its records' });
    return;
  }

  try {
    const db = getDatabase();
    const cols = db.prepare(`PRAGMA table_info(${quote(spec.table)})`).all() as Array<{ name: string; notnull: number }>;
    const byName = new Map(cols.map((col) => [col.name, col]));
    const sets: string[] = [];
    const params: any[] = [];
    for (const field of spec.fields) {
      if (req.body[field] === undefined || !byName.has(field)) continue;
      const col = byName.get(field)!;
      let value = req.body[field];
      if (typeof value === 'boolean') value = value ? 1 : 0;
      if (value === '') value = null;
      if (value == null && col.notnull) {
        res.status(400).json({ error: `${field.replace(/_/g, ' ')} is required` });
        return;
      }
      sets.push(`${quote(field)} = ?`);
      params.push(value);
    }
    if (!sets.length) {
      res.status(400).json({ error: 'Nothing to update' });
      return;
    }
    if (byName.has('updated_at')) sets.push(`updated_at = datetime('now')`);
    params.push(req.params.id, req.institution_id);
    const result = db.prepare(`
      UPDATE ${quote(spec.table)} SET ${sets.join(', ')}
      WHERE id = ? AND institution_id = ?
    `).run(...params);
    if (!result.changes) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    res.json({ message: 'Record updated' });
  } catch (err: any) {
    console.error('Record update failed:', err);
    res.status(400).json({ error: err.message || 'Could not update this record' });
  }
});

recordsRouter.delete('/:resource/:id', (req: AuthRequest, res: Response) => {
  const spec = resourceOf(req.params.resource);
  if (!spec) {
    res.status(404).json({ error: 'This record type cannot be deleted here' });
    return;
  }
  if (!canManage(req, spec.roles)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  if (!req.institution_id) {
    res.status(400).json({ error: 'Select a school before deleting its records' });
    return;
  }

  try {
    deleteSchoolRecord(getDatabase(), spec.table, req.params.id, req.institution_id, { userColumn: spec.userColumn });
    res.json({ message: 'Record deleted' });
  } catch (err: any) {
    if (err?.message !== 'Record not found') console.error('Record delete failed:', err);
    const message = err?.message === 'Record not found' ? 'Record not found' : (err.message || 'Could not delete this record');
    res.status(err?.message === 'Record not found' ? 404 : 400).json({ error: message });
  }
});
