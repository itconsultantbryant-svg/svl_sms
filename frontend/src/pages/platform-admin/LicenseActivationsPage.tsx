import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  MonitorSmartphone,
  Search,
  RefreshCw,
  KeyRound,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import api from '../../utils/api';

interface Activation {
  activationId: string;
  machineId: string;
  activatedAt: string;
  lastCheckIn: string | null;
  ipAddress: string | null;
  neverReported: boolean;
}

interface ActivationKey {
  licenseId: string;
  licenseKey: string;
  mode: string;
  planTier: string;
  expiryDate: string;
  licenseStatus: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionCode: string | null;
  activations: Activation[];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function timeAgo(value: string | null): string {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 0) return 'just now';
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs >= 1) return `${hrs}h ago`;
  const mins = Math.floor(diff / 60000);
  return `${Math.max(1, mins)}m ago`;
}

const statusClass = (status: string): string => {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-yellow-100 text-yellow-800',
    revoked: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

export default function LicenseActivationsPage() {
  const [data, setData] = useState<ActivationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMachines, setTotalMachines] = useState(0);
  const [staleDays, setStaleDays] = useState(30);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchActivations();
  }, [search, statusFilter]);

  const fetchActivations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/licensing/activations', {
        params: {
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });
      setData(res.data.data || []);
      setTotalMachines(res.data.totalMachines || 0);
      setStaleDays(res.data.staleDays || 30);
    } catch (error: any) {
      console.error('Failed to load activations', error);
      toast.error(error.response?.data?.error || 'Failed to load activations');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">License Activations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor which machines activated each license key, their last check-in, and
            offline schools that haven't phoned home.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/platform-admin/licenses"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Keys
          </Link>
          <button
            type="button"
            onClick={fetchActivations}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">License keys</p>
          <p className="text-2xl font-semibold text-gray-900">{data.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active machines</p>
          <p className="text-2xl font-semibold text-gray-900">{totalMachines}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Offline &gt; {staleDays}d (never reported)</p>
          <p className="text-2xl font-semibold text-gray-900">
            {data.reduce(
              (acc, k) => acc + k.activations.filter((a) => a.neverReported).length,
              0
            )}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search key, institution, or machine…"
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
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution / Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machines</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    Loading activations…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    <MonitorSmartphone className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    No license keys found.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <Fragment key={row.licenseId}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {row.institutionName || '—'}
                        </div>
                        <div className="text-xs text-gray-400 font-mono break-all">
                          {row.licenseKey}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-700">{row.planTier}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(row.licenseStatus)}`}>
                          {row.licenseStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.activations.length}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(row.expiryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(row.licenseId)}
                          className="inline-flex items-center text-primary-600 hover:text-primary-800 text-sm"
                        >
                          {expanded[row.licenseId] ? 'Hide' : 'View'} machines
                        </button>
                      </td>
                    </tr>
                    {expanded[row.licenseId] && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          {row.activations.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No machine activations recorded yet.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                                    <th className="py-2 pr-4">Machine ID</th>
                                    <th className="py-2 pr-4">Activated</th>
                                    <th className="py-2 pr-4">Last check-in</th>
                                    <th className="py-2 pr-4">IP</th>
                                    <th className="py-2 pr-4">State</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {row.activations.map((a) => (
                                    <tr key={a.activationId} className="text-sm text-gray-700">
                                      <td className="py-2 pr-4 font-mono break-all">{a.machineId}</td>
                                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(a.activatedAt)}</td>
                                      <td className="py-2 pr-4 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1">
                                          <Clock className="h-3 w-3 text-gray-400" />
                                          {timeAgo(a.lastCheckIn)}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4">{a.ipAddress || '—'}</td>
                                      <td className="py-2 pr-4">
                                        {a.neverReported ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                            <WifiOff className="h-3 w-3" />
                                            Never reported
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <Wifi className="h-3 w-3" />
                                            Online
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
