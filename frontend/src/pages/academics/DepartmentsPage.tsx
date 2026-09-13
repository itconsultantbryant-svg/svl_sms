import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [dept, setDept] = useState({ name: '', description: '' });
  const [desig, setDesig] = useState({ name: '', description: '' });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/academics/departments').then((r) => r.data),
  });
  const { data: designations } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/academics/designations').then((r) => r.data),
  });

  const createDept = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academics/departments', dept);
      toast.success('Department created');
      setDept({ name: '', description: '' });
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create department');
    }
  };

  const createDesig = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/academics/designations', desig);
      toast.success('Designation created');
      setDesig({ name: '', description: '' });
      qc.invalidateQueries({ queryKey: ['designations'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create designation');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departments &amp; Designations</h1>
        <p className="text-sm text-gray-500 mt-1">Create school departments and staff designations for teachers and users</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={createDept} className="card space-y-3">
          <h2 className="font-semibold">New department</h2>
          <input className="input-field" placeholder="Name" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} required />
          <input className="input-field" placeholder="Description" value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} />
          <button className="btn-primary" type="submit">Create department</button>
          <ul className="divide-y text-sm">
            {(departments || []).map((d: any) => (
              <li key={d.id} className="py-2">{d.name}</li>
            ))}
          </ul>
        </form>
        <form onSubmit={createDesig} className="card space-y-3">
          <h2 className="font-semibold">New designation</h2>
          <input className="input-field" placeholder="Name (e.g. Senior Teacher)" value={desig.name} onChange={(e) => setDesig({ ...desig, name: e.target.value })} required />
          <input className="input-field" placeholder="Description" value={desig.description} onChange={(e) => setDesig({ ...desig, description: e.target.value })} />
          <button className="btn-primary" type="submit">Create designation</button>
          <ul className="divide-y text-sm">
            {(designations || []).map((d: any) => (
              <li key={d.id} className="py-2">{d.name}</li>
            ))}
          </ul>
        </form>
      </div>
    </div>
  );
}
