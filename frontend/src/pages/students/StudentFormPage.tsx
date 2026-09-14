import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Class, Section, Branch, AcademicSession } from '../../types';

export default function StudentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');

  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', nationality: 'Liberian',
    county: '', address: '', phone: '', email: '',
    photo: '',
    blood_group: '', medical_info: '',
    previous_school: '', previous_class: '', admission_date: '',
    branch_id: '', class_id: '', section_id: '', session_id: '',
    parent: { first_name: '', last_name: '', relationship: 'father', phone: '', email: '', occupation: '' },
  });
  const [createdCreds, setCreatedCreds] = useState<{
    admission_number: string;
    temporary_password: string;
    parent_credentials?: { username: string; temporary_password: string } | null;
  } | null>(null);

  const { data: classes } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then(r => r.data),
  });

  const { data: sections } = useQuery<Section[]>({
    queryKey: ['sections', selectedClass],
    queryFn: () => api.get('/academics/sections', { params: { class_id: selectedClass } }).then(r => r.data),
    enabled: !!selectedClass,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });

  const { data: sessions } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/academics/sessions').then(r => Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : []),
  });

  useEffect(() => {
    if (id) {
      api.get(`/students/${id}`).then(res => {
        const s = res.data;
        setForm(prev => ({
          ...prev, ...s,
          parent: s.parents?.[0] || prev.parent,
        }));
        setSelectedClass(s.class_id || '');
      });
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('parent.')) {
      const field = name.split('.')[1];
      setForm(prev => ({ ...prev, parent: { ...prev.parent, [field]: value } }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
      if (name === 'class_id') setSelectedClass(value);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) {
      toast.error('First name and last name are required');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/students/${id}`, form);
        toast.success('Student updated successfully');
        navigate('/students');
      } else {
        const res = await api.post('/students', form);
        setCreatedCreds({
          admission_number: res.data.admission_number,
          temporary_password: res.data.temporary_password,
          parent_credentials: res.data.parent_credentials,
        });
        toast.success('Student admitted — save the login credentials below');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.details || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const { compressImageToDataUrl } = await import('../../utils/compressImage');
      const dataUrl = await compressImageToDataUrl(file);
      setForm((prev) => ({ ...prev, photo: dataUrl }));
    } catch {
      toast.error('Could not process image');
    }
  };

  if (createdCreds) {
    return (
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Student created</h1>
        <div className="card space-y-3">
          <p className="text-sm text-gray-600">Share these credentials with the student. They login with Student ID + password.</p>
          <div>
            <div className="text-xs text-gray-500">Student ID (username)</div>
            <div className="font-mono font-semibold">{createdCreds.admission_number}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Temporary password</div>
            <div className="font-mono font-semibold">{createdCreds.temporary_password}</div>
          </div>
          {createdCreds.parent_credentials && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">Parent login</p>
              <div className="font-mono text-sm">User: {createdCreds.parent_credentials.username}</div>
              <div className="font-mono text-sm">Pass: {createdCreds.parent_credentials.temporary_password}</div>
            </div>
          )}
          <button type="button" className="btn-primary" onClick={() => navigate('/students')}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Student' : 'New Admission'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEdit ? 'Update student information' : 'Register a new student'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="mb-4 flex items-center gap-4">
            {form.photo ? (
              <img src={form.photo} alt="" className="w-20 h-20 rounded-full object-cover border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200" />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile photo</label>
              <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input name="middle_name" value={form.middle_name} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} className="input-field">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
              <input name="nationality" value={form.nationality} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input name="county" value={form.county} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="input-field" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea name="address" value={form.address} onChange={handleChange} className="input-field" rows={2} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Academic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select name="branch_id" value={form.branch_id} onChange={handleChange} className="input-field">
                <option value="">Select Branch</option>
                {(Array.isArray(branches) ? branches : []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select name="class_id" value={form.class_id} onChange={handleChange} className="input-field">
                <option value="">Select Class</option>
                {(Array.isArray(classes) ? classes : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select name="section_id" value={form.section_id} onChange={handleChange} className="input-field">
                <option value="">Select Section</option>
                {sections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session</label>
              <select name="session_id" value={form.session_id} onChange={handleChange} className="input-field">
                <option value="">Select Session</option>
                {(Array.isArray(sessions) ? sessions : []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {Array.isArray(sessions) && !sessions.length && <option value="" disabled>No sessions yet — create one under Academics</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date</label>
              <input name="admission_date" type="date" value={form.admission_date} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Parent/Guardian Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input name="parent.first_name" value={form.parent.first_name} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input name="parent.last_name" value={form.parent.last_name} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                <select name="parent.relationship" value={form.parent.relationship} onChange={handleChange} className="input-field">
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input name="parent.phone" value={form.parent.phone} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="parent.email" type="email" value={form.parent.email} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                <input name="parent.occupation" value={form.parent.occupation} onChange={handleChange} className="input-field" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/students')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Admit Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
