import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  KeyRound,
  Plus,
  Search,
  Copy,
  Ban,
  RefreshCw,
  Building2,
} from 'lucide-react';
import api from '../../utils/api';

interface InstitutionOption {
  id: string;
  institution_code: string;
  institution_name: string;
}

interface LicenseRow {
  id: string;
  license_key: string;
  institution_id: string;
  institution_name: string | null;
  institution_code: string | null;
  mode: 'demo' | 'production';
  plan_tier: string;
  expiry_date: string;
  status: string;
  activated_at: string | null;
  created_at: string;
  activation_count: number;
}

const emptyForm = {
  institution_id: '',
  plan_tier: 'standard',
  mode: 'production',
  expiry_days: 365,
};

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchLicenses();
  }, [search, statusFilter, modeFilter]);

  const fetchInstitutions = async () => {
    try {
      const res = await api.get('/platform-admin/institutions/list');
      setInstitutions(res.data || []);
    } catch (error) {
      console.error('Failed to load institutions', error);
      toast.error('Failed to load institutions');
    }
  };

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/licensing/keys', {
        params: {
          search: search || undefined,
          status: statusFilter || undefined,
          mode: modeFilter || undefined,
        },
      });
      setLicenses(res.data.data || []);
    } catch (error: any) {
      console.error('Failed to load licenses', error);
      toast.error(error.response?.data?.error || 'Failed to load license keys');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.institution_id) {
      toast.error('Select an institution');
      return;
    }

    try {
      setGenerating(true);
      const res = await api.post('/licensing/generate-key', {
        institution_id: form.institution_id,
        plan_tier: form.plan_tier,
        mode: form.mode,
        expiry_days: Number(form.expiry_days),
      });
      setLastGeneratedKey(res.data.licenseKey);
      toast.success('License key generated');
      setShowForm(false);
      setForm(emptyForm);
      fetchLicenses();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success('License key copied');
    } catch {
      toast.error('Could not copy key');
    }
  };

  const revokeKey = async (license: LicenseRow) => {
    if (license.status === 'revoked') return;
    const ok = window.confirm(
      `Revoke license ${license.license_key} for ${license.institution_name || 'this institution'}?`
    );
    if (!ok) return;

    try {
      await api.post(`/licensing/keys/${license.id}/revoke`);
      toast.success('License revoked');
      fetchLicenses();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to revoke license');
    }
  };

  const statusClass = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      revoked: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">License Keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and manage production/demo license keys for institutions
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/platform-admin/institutions"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Institutions
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Key
          </button>
        </div>
      </div>

      {lastGeneratedKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-green-900">Latest generated key</p>
            <p className="font-mono text-sm text-green-800 break-all mt-1">{lastGeneratedKey}</p>
          </div>
          <button
            type="button"
            onClick={() => copyKey(lastGeneratedKey)}
            className="inline-flex items-center px-3 py-2 text-sm bg-white border border-green-300 rounded-md text-green-800 hover:bg-green-100"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleGenerate} className="bg-white rounded-lg shadow border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
              <select
                required
                value={form.institution_id}
                onChange={(e) => setForm((f) => ({ ...f, institution_id: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select institution</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.institution_name} ({inst.institution_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={form.plan_tier}
                onChange={(e) => setForm((f) => ({ ...f, plan_tier: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="production">Production</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid days</label>
              <input
                type="number"
                min={1}
                max={3650}
                value={form.expiry_days}
                onChange={(e) => setForm((f) => ({ ...f, expiry_days: Number(e.target.value) }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate license key'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search key or institution…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
          <div className="flex gap-2">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">All modes</option>
              <option value="production">Production</option>
              <option value="demo">Demo</option>
            </select>
            <button
              type="button"
              onClick={fetchLicenses}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activations</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    Loading license keys…
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    <KeyRound className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    No license keys yet. Generate one for an institution.
                  </td>
                </tr>
              ) : (
                licenses.map((license) => (
                  <tr key={license.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900 whitespace-nowrap">
                      {license.license_key}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium">{license.institution_name || '—'}</div>
                      <div className="text-xs text-gray-400">{license.institution_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700">{license.plan_tier}</td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700">{license.mode}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {new Date(license.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(license.status)}`}>
                        {license.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{license.activation_count || 0}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => copyKey(license.license_key)}
                        className="inline-flex items-center text-primary-600 hover:text-primary-800 text-sm mr-3"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </button>
                      <button
                        type="button"
                        disabled={license.status === 'revoked'}
                        onClick={() => revokeKey(license)}
                        className="inline-flex items-center text-red-600 hover:text-red-800 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
