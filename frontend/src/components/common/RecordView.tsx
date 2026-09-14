import { downloadDocument, escapeHtml } from '../../utils/printDocument';

export type ViewField = { label: string; value: unknown };

export function fieldsFromRecord(record: any, labels: Record<string, string>): ViewField[] {
  return Object.entries(labels).map(([key, label]) => ({ label, value: record?.[key] }));
}

function display(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    return value.map((item) => {
      if (item && typeof item === 'object') {
        const named = [item.first_name, item.last_name].filter(Boolean).join(' ');
        const teaching = [item.class_name, item.subject_name].filter(Boolean).join(' / ');
        return named || item.name || teaching || item.description || item.fee_type_name || JSON.stringify(item);
      }
      return String(item);
    }).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function RecordView({
  title,
  fields,
  onClose,
}: {
  title: string;
  fields: ViewField[];
  onClose: () => void;
}) {
  const html = `
    <h1>${escapeHtml(title)}</h1>
    <table>
      <tbody>
        ${fields.map((field) => `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(display(field.value))}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>Close</button>
        </div>
        <dl className="space-y-2 text-sm">
          {fields.map((field) => (
            <div key={field.label} className="grid grid-cols-3 gap-2">
              <dt className="text-gray-500">{field.label}</dt>
              <dd className="col-span-2 text-gray-900 break-words">{display(field.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-primary text-sm" onClick={() => downloadDocument(title, html)}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
