import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bus, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

type Tab = 'routes' | 'vehicles' | 'students';

export default function TransportPage() {
  const [tab, setTab] = useState<Tab>('routes');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transport</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {(['routes', 'vehicles', 'students'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'routes' && <RoutesTab />}
      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'students' && <StudentsTab />}
    </div>
  );
}

function RoutesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', vehicle_id: '', fare: '', description: '' });

  const { data: routes } = useQuery<any[]>({ queryKey: ['transport-routes'], queryFn: () => api.get('/transport/routes').then(r => r.data) });
  const { data: vehicles } = useQuery<any[]>({ queryKey: ['vehicles'], queryFn: () => api.get('/transport/vehicles').then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/transport/routes', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route created'); setShowForm(false); setForm({ name: '', vehicle_id: '', fare: '', description: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus size={16} className="mr-2" /> Add Route</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label><select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} className="input-field"><option value="">Select</option>{vehicles?.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} - {v.driver_name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fare ($)</label><input type="number" step="0.01" value={form.fare} onChange={e => setForm(f => ({ ...f, fare: e.target.value }))} className="input-field" /></div>
            <button onClick={() => addMutation.mutate({ ...form, fare: parseFloat(form.fare) || 0 })} disabled={!form.name} className="btn-primary">Create</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!routes?.length ? <p className="text-gray-400 col-span-3 text-center py-8">No routes defined</p> : routes.map(route => (
          <div key={route.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{route.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{route.vehicle_number ? `${route.vehicle_number} - ${route.driver_name}` : 'No vehicle assigned'}</p>
              </div>
              <MapPin size={20} className="text-primary-500" />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-gray-500">{route.student_count} students</span>
              <span className="font-medium">${route.fare?.toFixed(2)}/mo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehiclesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicle_number: '', model: '', driver_name: '', driver_phone: '', capacity: '', insurance_expiry: '' });

  const { data: vehicles } = useQuery<any[]>({ queryKey: ['vehicles'], queryFn: () => api.get('/transport/vehicles').then(r => r.data) });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/transport/vehicles', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); toast.success('Vehicle added'); setShowForm(false); setForm({ vehicle_number: '', model: '', driver_name: '', driver_phone: '', capacity: '', insurance_expiry: '' }); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-700', maintenance: 'bg-yellow-100 text-yellow-700', inactive: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Bus size={16} className="mr-2" /> Add Vehicle</button></div>

      {showForm && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle # *</label><input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Model</label><input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label><input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label><input value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiry</label><input type="date" value={form.insurance_expiry} onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} className="input-field" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={() => addMutation.mutate({ ...form, capacity: parseInt(form.capacity) || 0 })} disabled={!form.vehicle_number} className="btn-primary">Save</button><button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button></div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Vehicle #</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Model</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Driver</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Phone</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Capacity</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Routes</th>
          </tr></thead>
          <tbody>
            {!vehicles?.length ? <tr><td colSpan={7} className="py-12 text-center text-gray-400">No vehicles</td></tr>
            : vehicles.map(v => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{v.vehicle_number}</td>
                <td className="py-3 px-3">{v.model || '-'}</td>
                <td className="py-3 px-3">{v.driver_name || '-'}</td>
                <td className="py-3 px-3">{v.driver_phone || '-'}</td>
                <td className="py-3 px-3 text-center">{v.capacity}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[v.status] || ''}`}>{v.status}</span></td>
                <td className="py-3 px-3">{v.route_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentsTab() {
  const { data: assignments } = useQuery<any[]>({ queryKey: ['transport-students'], queryFn: () => api.get('/transport/students').then(r => r.data) });

  return (
    <div className="space-y-4">
      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Student</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Adm #</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Class</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Route</th>
            <th className="text-left py-3 px-3 font-medium text-gray-500">Stop</th>
          </tr></thead>
          <tbody>
            {!assignments?.length ? <tr><td colSpan={5} className="py-12 text-center text-gray-400">No student transport assignments</td></tr>
            : assignments.map(a => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">{a.first_name} {a.last_name}</td>
                <td className="py-3 px-3">{a.admission_number}</td>
                <td className="py-3 px-3">{a.class_name || '-'}</td>
                <td className="py-3 px-3">{a.route_name}</td>
                <td className="py-3 px-3">{a.stop_name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
