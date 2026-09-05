import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { Institution } from '../../types';
import { useBrand } from '../../contexts/BrandContext';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { refreshBranding } = useBrand();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Institution>>({
    institution_name: '',
    institution_code: '',
    mobile: '',
    address: '',
    email: '',
    website: '',
    country: 'Liberia',
    currency: 'USD',
    currency_symbol: '$',
    timezone: 'Africa/Monrovia',
    motto: '',
    logo: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
  });

  const { data: institution } = useQuery<Institution>({
    queryKey: ['institution'],
    queryFn: () => api.get('/settings/institution').then((r) => r.data),
  });

  useEffect(() => {
    if (institution && institution.id) {
      setForm({
        ...institution,
        institution_name: institution.institution_name || (institution as any).name,
        institution_code: institution.institution_code || (institution as any).code,
      });
    }
  }, [institution]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/settings/institution', form);
      await queryClient.invalidateQueries({ queryKey: ['institution'] });
      await refreshBranding();
      toast.success('Settings saved successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Institution branding and system settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center gap-4">
              {form.logo ? (
                <img src={form.logo} alt="Logo" className="h-16 w-16 object-contain rounded border" />
              ) : (
                <div
                  className="h-16 w-16 rounded flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: form.primary_color || '#1e40af' }}
                >
                  {(form.institution_name || 'S').charAt(0)}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('Logo must be under 5MB');
                      return;
                    }
                    try {
                      const { compressImageToDataUrl } = await import('../../utils/compressImage');
                      const dataUrl = await compressImageToDataUrl(file);
                      setForm((prev) => ({ ...prev, logo: dataUrl }));
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to process logo');
                    }
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">PNG/JPG up to 5MB (auto-compressed). Colors below theme the portal.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <input type="color" name="primary_color" value={form.primary_color || '#1e40af'} onChange={handleChange} className="h-10 w-full rounded border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
              <input type="color" name="secondary_color" value={form.secondary_color || '#3b82f6'} onChange={handleChange} className="h-10 w-full rounded border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
              <input type="color" name="accent_color" value={form.accent_color || '#f59e0b'} onChange={handleChange} className="h-10 w-full rounded border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input name="website" value={form.website || ''} onChange={handleChange} className="input-field" placeholder="https://school.edu.lr" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Institution Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name</label>
              <input name="institution_name" value={form.institution_name || ''} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution Code</label>
              <input name="institution_code" value={form.institution_code || ''} onChange={handleChange} className="input-field" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" value={form.email || ''} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone/Mobile</label>
              <input name="mobile" value={form.mobile || ''} onChange={handleChange} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea name="address" value={form.address || ''} onChange={handleChange} className="input-field" rows={2} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motto</label>
              <input name="motto" value={form.motto || ''} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Regional Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input name="currency" value={form.currency || ''} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
              <input name="currency_symbol" value={form.currency_symbol || ''} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input name="timezone" value={form.timezone || ''} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
