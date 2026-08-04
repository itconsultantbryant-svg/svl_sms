import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'runs' | 'salaries' | 'structures' | 'leaves' | 'loans';

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>('runs');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">HR & Payroll</h1>
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(['runs', 'salaries', 'structures', 'leaves', 'loans'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t === 'runs' ? 'Payroll Runs' : t}</button>
        ))}
      </div>
      {tab === 'runs' && <PayrollRunsTab />}
      {tab === 'salaries' && <SalariesTab />}
      {tab === 'structures' && <StructuresTab />}
      {tab === 'leaves' && <LeavesTab />}
      {tab === 'loans' && <LoansTab />}
    </div>
  );
}

function PayrollRunsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewPayslips, setViewPayslips] = useState<string | null>(null);
  const [viewPayslip, setViewPayslip] = useState<any>(null);
  const [form, setForm] = useState({ month: '', year: '' });

  const { data: runs } = useQuery<any[]>({ queryKey: ['payroll-runs'], queryFn: () => api.get('/payroll/runs').then(r => r.data) });
  const { data: payslips } = useQuery<any[]>({ queryKey: ['payslips', viewPayslips], queryFn: () => api.get(`/payroll/runs/${viewPayslips}/payslips`).then(r => r.data), enabled: !!viewPayslips });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/payroll/runs', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-runs'] }); toast.success('Payroll run created'); setShowForm(false); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/process`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-runs'] }); queryClient.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Payroll processed'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const statusColors: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', processing: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

  if (viewPayslip) {
    return <PayslipView id={viewPayslip} onBack={() => setViewPayslip(null)} />;
  }

  if (viewPayslips) {
    return (
      <div className="space-y-4">
        <button onClick={() => setViewPayslips(null)} className="btn-secondary text-sm">Back to Runs</button>
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Payslips</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-3 font-medium text-gray-500">Employee</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Department</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Basic</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Earnings</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Deductions</th>
              <th className="text-right py-3 px-3 font-medium text-gray-500">Net</th>
              <th className="text-left py-3 px-3 font-medium text-gray-500">Action</th>
            </tr></thead>
            <tbody>
              {!payslips?.length ? <tr><td colSpan={7} className="py-8 text-center text-gray-400">No payslips</td></tr>
              : payslips.map(ps => (
                <tr key={ps.id} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-medium">{ps.first_name} {ps.last_name}</td>
                  <td className="py-3 px-3">{ps.department_name || '-'}</td>
                  <td className="py-3 px-3 text-right">${ps.basic_salary.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-green-600">${ps.total_earnings.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-red-600">${ps.total_deductions.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-medium">${ps.net_salary.toFixed(2)}</td>
                  <td className="py-3 px-3"><button onClick={() => setViewPayslip(ps.id)} className="text-primary-600 hover:underline text-xs"><FileText size={14} className="inline mr-1" />View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> New Payroll</button></div>

      {showForm && (
        <div className="card flex gap-3 items-end">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Month *</label><select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="input-field"><option value="">Select</option>{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Year *</label><input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="input-field" placeholder="2026" /></div>
          <button onClick={() => createMutation.mutate({ month: parseInt(form.month), year: parseInt(form.year) })} disabled={!form.month || !form.year} className="btn-primary">Create</button>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Period</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Employees</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Total Net</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Processed By</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {!runs?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No payroll runs</td></tr>
            : runs.map(run => (
              <tr key={run.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{months[(run.month - 1)] || run.month} {run.year}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[run.status] || ''}`}>{run.status}</span></td>
                <td className="py-3 px-3 text-center">{run.employee_count}</td>
                <td className="py-3 px-3 text-right font-medium">${run.total_net.toFixed(2)}</td>
                <td className="py-3 px-3 text-gray-500">{run.processed_by_name || '-'}</td>
                <td className="py-3 px-3 flex gap-2">
                  {run.status === 'draft' && <button onClick={() => processMutation.mutate(run.id)} className="text-green-600 hover:underline text-xs font-medium"><Play size={14} className="inline mr-1" />Process</button>}
                  {run.status === 'completed' && <button onClick={() => setViewPayslips(run.id)} className="text-primary-600 hover:underline text-xs font-medium"><FileText size={14} className="inline mr-1" />Payslips</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayslipView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data } = useQuery<any>({ queryKey: ['payslip', id], queryFn: () => api.get(`/payroll/payslips/${id}`).then(r => r.data) });
  if (!data) return <div className="text-center py-8 text-gray-400">Loading...</div>;

  const { payslip, items, institution } = data;
  const earnings = items.filter((i: any) => i.type === 'earning');
  const deductions = items.filter((i: any) => i.type === 'deduction');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-secondary text-sm">Back</button>
      <div className="card max-w-2xl mx-auto print:shadow-none" id="payslip">
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold">{institution?.name || 'SVL Academy'}</h2>
          <p className="text-sm text-gray-500">{institution?.address}</p>
          <p className="mt-2 font-semibold text-primary-600">PAYSLIP - {months[(payslip.month - 1)]} {payslip.year}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4 border-b pb-4">
          <div>
            <p><span className="text-gray-500">Employee:</span> <strong>{payslip.first_name} {payslip.last_name}</strong></p>
            <p><span className="text-gray-500">Emp ID:</span> {payslip.emp_number}</p>
          </div>
          <div>
            <p><span className="text-gray-500">Department:</span> {payslip.department_name || '-'}</p>
            <p><span className="text-gray-500">Designation:</span> {payslip.designation_name || '-'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-green-700 border-b pb-1 mb-2">Earnings</h4>
            {earnings.map((e: any, i: number) => (
              <div key={i} className="flex justify-between py-1"><span>{e.component_name}</span><span>${e.amount.toFixed(2)}</span></div>
            ))}
            <div className="flex justify-between font-bold border-t mt-2 pt-2"><span>Total Earnings</span><span className="text-green-600">${payslip.total_earnings.toFixed(2)}</span></div>
          </div>
          <div>
            <h4 className="font-medium text-red-700 border-b pb-1 mb-2">Deductions</h4>
            {deductions.length ? deductions.map((d: any, i: number) => (
              <div key={i} className="flex justify-between py-1"><span>{d.component_name}</span><span>${d.amount.toFixed(2)}</span></div>
            )) : <p className="text-gray-400 text-xs">No deductions</p>}
            <div className="flex justify-between font-bold border-t mt-2 pt-2"><span>Total Deductions</span><span className="text-red-600">${payslip.total_deductions.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="mt-6 border-t pt-4 flex justify-between text-lg font-bold">
          <span>Net Salary</span>
          <span className="text-primary-700">${payslip.net_salary.toFixed(2)}</span>
        </div>

        <div className="mt-6 text-center print:hidden">
          <button onClick={() => window.print()} className="btn-primary"><Printer size={16} className="mr-2" /> Print</button>
        </div>
      </div>
    </div>
  );
}

function SalariesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', structure_id: '', basic_salary: '', effective_from: '' });

  const { data: salaries } = useQuery<any[]>({ queryKey: ['employee-salaries'], queryFn: () => api.get('/payroll/employee-salaries').then(r => r.data) });
  const { data: employees } = useQuery<any>({ queryKey: ['employees-payroll'], queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then(r => r.data) });
  const { data: structures } = useQuery<any[]>({ queryKey: ['salary-structures'], queryFn: () => api.get('/payroll/structures').then(r => r.data) });

  const assignMutation = useMutation({
    mutationFn: (d: any) => api.post('/payroll/employee-salaries', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employee-salaries'] }); toast.success('Salary assigned'); setShowForm(false); setForm({ employee_id: '', structure_id: '', basic_salary: '', effective_from: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Assign Salary</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label><select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="input-field"><option value="">Select</option>{employees?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Structure *</label><select value={form.structure_id} onChange={e => setForm(f => ({ ...f, structure_id: e.target.value }))} className="input-field"><option value="">Select</option>{structures?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary *</label><input type="number" step="0.01" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label><input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className="input-field" /></div>
            <button onClick={() => assignMutation.mutate({ ...form, basic_salary: parseFloat(form.basic_salary) })} disabled={!form.employee_id || !form.structure_id || !form.basic_salary || !form.effective_from} className="btn-primary">Assign</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Employee</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Department</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Structure</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Basic Salary</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Effective From</th>
          </tr></thead>
          <tbody>
            {!salaries?.length ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">No salary assignments</td></tr>
            : salaries.map(s => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{s.first_name} {s.last_name}</td>
                <td className="py-3 px-3">{s.department_name || '-'}</td>
                <td className="py-3 px-3">{s.structure_name}</td>
                <td className="py-3 px-3 text-right font-medium">${s.basic_salary.toFixed(2)}</td>
                <td className="py-3 px-3">{s.effective_from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StructuresTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [compForm, setCompForm] = useState({ name: '', type: 'earning', calculation_type: 'fixed', amount: '' });

  const { data: structures } = useQuery<any[]>({ queryKey: ['salary-structures'], queryFn: () => api.get('/payroll/structures').then(r => r.data) });
  const { data: components } = useQuery<any[]>({ queryKey: ['salary-components', selectedStructure], queryFn: () => api.get(`/payroll/structures/${selectedStructure}/components`).then(r => r.data), enabled: !!selectedStructure });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/payroll/structures', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-structures'] }); toast.success('Structure created'); setShowForm(false); setForm({ name: '', description: '' }); },
  });

  const addCompMutation = useMutation({
    mutationFn: (d: any) => api.post(`/payroll/structures/${selectedStructure}/components`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salary-components'] }); toast.success('Component added'); setCompForm({ name: '', type: 'earning', calculation_type: 'fixed', amount: '' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Structure</button></div>

      {showForm && (
        <div className="card flex gap-3 items-end">
          <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" /></div>
          <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" /></div>
          <button onClick={() => createMutation.mutate(form)} disabled={!form.name} className="btn-primary">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {structures?.map(s => (
          <div key={s.id} onClick={() => setSelectedStructure(s.id)} className={`card cursor-pointer border-2 transition ${selectedStructure === s.id ? 'border-primary-500' : 'border-transparent hover:border-gray-200'}`}>
            <h3 className="font-medium">{s.name}</h3>
            <p className="text-sm text-gray-500">{s.employee_count} employees</p>
          </div>
        ))}
      </div>

      {selectedStructure && (
        <div className="card">
          <h3 className="font-medium mb-3">Components</h3>
          <div className="flex gap-3 items-end mb-4">
            <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} className="input-field text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Type</label><select value={compForm.type} onChange={e => setCompForm(f => ({ ...f, type: e.target.value }))} className="input-field text-sm"><option value="earning">Earning</option><option value="deduction">Deduction</option></select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Calc</label><select value={compForm.calculation_type} onChange={e => setCompForm(f => ({ ...f, calculation_type: e.target.value }))} className="input-field text-sm"><option value="fixed">Fixed</option><option value="percentage">% of Basic</option></select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amount/{compForm.calculation_type === 'percentage' ? '%' : '$'}</label><input type="number" step="0.01" value={compForm.amount} onChange={e => setCompForm(f => ({ ...f, amount: e.target.value }))} className="input-field text-sm w-24" /></div>
            <button onClick={() => addCompMutation.mutate({ ...compForm, amount: parseFloat(compForm.amount) || 0 })} disabled={!compForm.name} className="btn-primary text-sm">Add</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Name</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Calculation</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Amount</th>
            </tr></thead>
            <tbody>
              {!components?.length ? <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-xs">No components</td></tr>
              : components.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 px-3">{c.name}</td>
                  <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${c.type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.type}</span></td>
                  <td className="py-2 px-3 capitalize">{c.calculation_type}</td>
                  <td className="py-2 px-3 text-right">{c.calculation_type === 'percentage' ? `${c.amount}%` : `$${c.amount.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeavesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: '', reason: '' });

  const { data: leaveTypes } = useQuery<any[]>({ queryKey: ['leave-types'], queryFn: () => api.get('/payroll/leave-types').then(r => r.data) });
  const { data: employees } = useQuery<any>({ queryKey: ['employees-leave'], queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then(r => r.data) });
  const { data, isLoading } = useQuery<any>({ queryKey: ['leaves', page, statusFilter], queryFn: () => api.get('/payroll/leaves', { params: { page, limit: 20, status: statusFilter || undefined } }).then(r => r.data) });

  const applyMutation = useMutation({
    mutationFn: (d: any) => api.post('/payroll/leaves', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Leave applied'); setShowForm(false); setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: '', reason: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/payroll/leaves/${id}/approve`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Updated'); },
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);
  const statusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto"><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Apply Leave</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label><select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="input-field"><option value="">Select</option>{employees?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label><select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))} className="input-field"><option value="">Select</option>{leaveTypes?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.days_allowed} days)</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Days *</label><input type="number" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="input-field" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={() => applyMutation.mutate({ ...form, days: parseInt(form.days) })} disabled={!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date || !form.days} className="btn-primary">Submit</button><button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button></div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Employee</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Leave Type</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">From</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">To</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Days</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
            : !data?.data?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No leave applications</td></tr>
            : data.data.map((l: any) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{l.first_name} {l.last_name}</td>
                <td className="py-3 px-3">{l.leave_type_name}</td>
                <td className="py-3 px-3">{l.start_date}</td>
                <td className="py-3 px-3">{l.end_date}</td>
                <td className="py-3 px-3 text-center">{l.days}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[l.status] || ''}`}>{l.status}</span></td>
                <td className="py-3 px-3">
                  {l.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => approveMutation.mutate({ id: l.id, status: 'approved' })} className="text-green-600 hover:underline text-xs">Approve</button>
                      <button onClick={() => approveMutation.mutate({ id: l.id, status: 'rejected' })} className="text-red-600 hover:underline text-xs">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoansTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', amount: '', monthly_deduction: '', start_date: '', reason: '' });

  const { data: employees } = useQuery<any>({ queryKey: ['employees-loan'], queryFn: () => api.get('/teachers', { params: { limit: 200 } }).then(r => r.data) });
  const { data: loans } = useQuery<any[]>({ queryKey: ['loans'], queryFn: () => api.get('/payroll/loans').then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/payroll/loans', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); toast.success('Loan created'); setShowForm(false); setForm({ employee_id: '', amount: '', monthly_deduction: '', start_date: '', reason: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const statusColors: Record<string, string> = { active: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> New Loan</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label><select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="input-field"><option value="">Select</option>{employees?.data?.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Monthly Deduction *</label><input type="number" step="0.01" value={form.monthly_deduction} onChange={e => setForm(f => ({ ...f, monthly_deduction: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" /></div>
            <button onClick={() => addMutation.mutate({ ...form, amount: parseFloat(form.amount), monthly_deduction: parseFloat(form.monthly_deduction) })} disabled={!form.employee_id || !form.amount || !form.monthly_deduction || !form.start_date} className="btn-primary">Create</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Employee</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Monthly</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Paid</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Balance</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
          </tr></thead>
          <tbody>
            {!loans?.length ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No loans</td></tr>
            : loans.map(l => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{l.first_name} {l.last_name}</td>
                <td className="py-3 px-3 text-right">${l.amount.toFixed(2)}</td>
                <td className="py-3 px-3 text-right">${l.monthly_deduction.toFixed(2)}</td>
                <td className="py-3 px-3 text-right text-green-600">${l.total_paid.toFixed(2)}</td>
                <td className="py-3 px-3 text-right text-red-600">${l.balance.toFixed(2)}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[l.status] || ''}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
