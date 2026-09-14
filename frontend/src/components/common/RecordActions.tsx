import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import RecordView, { ViewField } from './RecordView';

const MANAGERS = ['platform_admin', 'institution_admin'];
const FINANCE = [...MANAGERS, 'accountant', 'finance_officer', 'finance'];
const FINANCE_RESOURCES = new Set([
  'fee_types', 'fee_structures', 'invoices', 'payments', 'payslips', 'payroll_runs',
  'income', 'expenses', 'income_categories', 'expense_categories',
]);

type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' };

export function canManageRecords(user: { user_type?: string; role_codes?: string[]; role?: { code?: string | null }; roles?: Array<{ code?: string | null }> } | null, resource: string) {
  const allowed = FINANCE_RESOURCES.has(resource) ? FINANCE : MANAGERS;
  const codes = [
    user?.user_type,
    user?.role?.code,
    ...(user?.role_codes || []),
    ...(user?.roles || []).map((role) => role.code),
  ].filter(Boolean);
  return codes.some((code) => allowed.includes(String(code)));
}

export default function RecordActions({
  resource,
  id,
  label,
  invalidate,
  record,
  fields,
  viewFields,
}: {
  resource: string;
  id: string;
  label?: string;
  invalidate: string[];
  record?: Record<string, any>;
  fields?: Field[];
  viewFields?: ViewField[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const canManage = canManageRecords(user, resource);
  if (!id) return null;
  if (!canManage && !viewFields?.length) return null;

  const refresh = () => {
    invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${label || 'this record'}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/records/${resource}/${id}`);
      toast.success('Deleted');
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/records/${resource}/${id}`, form);
      toast.success('Updated');
      setEditing(false);
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className="inline-flex items-center gap-2">
        {viewFields?.length ? (
          <button type="button" className="text-primary-600 text-sm" disabled={busy} onClick={() => setViewing(true)}>
            View
          </button>
        ) : null}
        {canManage && fields?.length ? (
          <button
            type="button"
            className="text-gray-600 text-sm"
            disabled={busy}
            onClick={() => {
              const next: Record<string, string> = {};
              fields.forEach((field) => { next[field.key] = record?.[field.key] ?? ''; });
              setForm(next);
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null}
        {canManage ? (
          <button type="button" className="text-red-600 text-sm" disabled={busy} onClick={remove}>Delete</button>
        ) : null}
      </span>
      {viewing && viewFields ? (
        <RecordView title={label || 'Record'} fields={viewFields} onClose={() => setViewing(false)} />
      ) : null}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Edit {label || 'record'}</h3>
            {fields?.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  className="input-field"
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((current) => ({ ...current, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
