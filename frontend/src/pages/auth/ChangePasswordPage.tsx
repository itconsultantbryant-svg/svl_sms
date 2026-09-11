import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const isStudent = user?.user_type === 'student';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      if (res.data.requires_approval) {
        toast.success('Submitted — waiting for admin approval');
      } else {
        toast.success('Password updated');
      }
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
        {isStudent && (
          <p className="text-sm text-amber-700 mt-1">
            Student password changes require school admin approval before they take effect.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input
            type="password"
            className="input-field"
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input
            type="password"
            className="input-field"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm new password</label>
          <input
            type="password"
            className="input-field"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
            minLength={6}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : isStudent ? 'Request change' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
