import { escapeHtml } from '../../utils/printDocument';
import DocumentActions from '../common/DocumentActions';
import { downloadSchoolPdf, openSchoolDocument, SchoolDoc } from '../../utils/schoolDocument';

export type GradesheetData = {
  institution?: {
    institution_name?: string;
    logo?: string | null;
    motto?: string | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  signatures?: Array<{
    role_key?: string;
    signer_name?: string;
    signer_title?: string;
    signature_image?: string;
  }>;
  student?: {
    first_name?: string;
    last_name?: string;
    admission_number?: string;
    class_name?: string | null;
    section_name?: string | null;
    session_name?: string | null;
  };
  mode?: 'term' | 'year';
  terms?: Array<{ id: string; name: string }>;
  term_averages?: Array<{ term_id: string; term_name: string; average?: number | null; letter?: string }>;
  semester_average?: number | null;
  yearly_average?: number | null;
  yearly_letter?: string;
  promoted?: boolean;
  promotion_statement?: string;
  subjects?: Array<{
    id: string;
    name: string;
    code?: string | null;
    percent?: number | null;
    letter?: string;
    term_name?: string;
    term_scores?: Array<{ term_id: string; term_name: string; percent?: number | null; letter?: string }>;
  }>;
};

export function gradesheetDoc(sheet: GradesheetData): SchoolDoc {
  const school = sheet.institution || {};
  const student = sheet.student || {};
  const terms = sheet.terms || [];
  const columns = ['#', 'Subject', 'Code', ...terms.map((term) => term.name), 'Average %', 'Grade'];
  const rows = (sheet.subjects || []).map((subject, index) => [
    index + 1,
    subject.name,
    subject.code || '',
    ...terms.map((term) => {
      const hit = subject.term_scores?.find((item) => item.term_id === term.id);
      return hit?.percent == null ? '' : hit.percent;
    }),
    subject.percent == null ? '' : subject.percent,
    subject.letter || '',
  ]);
  rows.push([
    '',
    'TERM / PERIOD AVERAGE',
    '',
    ...(sheet.term_averages || []).map((item) => (item.average == null ? '' : item.average)),
    sheet.yearly_average == null ? '' : sheet.yearly_average,
    sheet.yearly_letter || '',
  ]);

  return {
    title: sheet.mode === 'term' ? 'TERM GRADESHEET' : 'YEARLY GRADESHEET / TRANSCRIPT',
    filename: `${(student.admission_number || 'gradesheet').toString().toLowerCase()}-${sheet.mode || 'year'}.pdf`,
    school,
    subtitle: [student.class_name, student.session_name].filter(Boolean).join(' · '),
    meta: [
      { label: 'Student', value: `${student.first_name || ''} ${student.last_name || ''}`.trim() },
      { label: 'Admission No.', value: student.admission_number || '' },
      { label: 'Class', value: [student.class_name, student.section_name].filter(Boolean).join(' — ') },
      { label: 'Session', value: student.session_name || '' },
      { label: 'Yearly average', value: sheet.yearly_average == null ? '' : `${sheet.yearly_average}% (${sheet.yearly_letter || ''})` },
    ],
    columns,
    rows,
    footer: [
      sheet.promotion_statement || '',
      ...(sheet.signatures || []).map((signature) => `${signature.signer_title || signature.role_key}: ${signature.signer_name || ''}`),
    ].filter(Boolean),
  };
}

export function printGradesheet(sheet: GradesheetData) {
  const doc = gradesheetDoc(sheet);
  openSchoolDocument(doc);
  downloadSchoolPdf(doc);
}

export default function GradesheetView({ sheet }: { sheet: GradesheetData }) {
  const school = sheet.institution || {};
  const student = sheet.student || {};
  const subjects = sheet.subjects || [];
  const terms = sheet.terms || [];
  const place = [school.address, school.city, school.county].filter(Boolean).join(', ');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="text-center mb-6">
        {school.logo ? <img src={school.logo} alt="" className="h-16 mx-auto mb-2 object-contain" /> : null}
        <h2 className="text-xl font-bold text-gray-900">{school.institution_name || 'School'}</h2>
        {school.motto ? <p className="text-sm text-gray-500">{school.motto}</p> : null}
        {place ? <p className="text-xs text-gray-500">{place}</p> : null}
        <p className="mt-3 text-sm font-semibold tracking-wide text-gray-800">
          {sheet.mode === 'term' ? 'TERM / SEMESTER GRADESHEET' : 'YEARLY GRADESHEET / TRANSCRIPT'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <p><span className="text-gray-500">Student:</span> {student.first_name} {student.last_name}</p>
        <p><span className="text-gray-500">Admission No.:</span> {student.admission_number || '—'}</p>
        <p><span className="text-gray-500">Class:</span> {student.class_name || '—'}{student.section_name ? ` — ${student.section_name}` : ''}</p>
        <p><span className="text-gray-500">Session:</span> {student.session_name || '—'}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-b">#</th>
              <th className="px-3 py-2 text-left border-b">Subject</th>
              <th className="px-3 py-2 text-left border-b">Code</th>
              {terms.map((term) => (
                <th key={term.id} className="px-3 py-2 text-left border-b">{term.name}</th>
              ))}
              <th className="px-3 py-2 text-left border-b">Average %</th>
              <th className="px-3 py-2 text-left border-b">Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr><td colSpan={5 + terms.length} className="px-3 py-6 text-center text-gray-400">No subjects are assigned to this class yet.</td></tr>
            ) : subjects.map((subject, index) => (
              <tr key={subject.id} className="border-b border-gray-100">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-medium">{subject.name}</td>
                <td className="px-3 py-2">{subject.code || '—'}</td>
                {terms.map((term) => {
                  const hit = subject.term_scores?.find((item) => item.term_id === term.id);
                  return <td key={term.id} className="px-3 py-2">{hit?.percent == null ? '—' : hit.percent}</td>;
                })}
                <td className="px-3 py-2 font-medium">{subject.percent == null ? '—' : subject.percent}</td>
                <td className="px-3 py-2">{subject.letter || '—'}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-medium">
              <td className="px-3 py-2" colSpan={3}>Averages</td>
              {(sheet.term_averages || []).map((item) => (
                <td key={item.term_id} className="px-3 py-2">{item.average == null ? '—' : `${item.average}%`}</td>
              ))}
              <td className="px-3 py-2">{sheet.yearly_average == null ? '—' : `${sheet.yearly_average}%`}</td>
              <td className="px-3 py-2">{sheet.yearly_letter || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${sheet.promoted ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {sheet.promotion_statement || 'Promotion status will appear when approved grades are available.'}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {(sheet.signatures || []).map((signature) => (
          <div key={signature.role_key || signature.signer_title} className="text-center">
            {signature.signature_image ? (
              <img
                src={signature.signature_image}
                alt={signature.signer_name || 'Signature'}
                className="h-16 mx-auto object-contain bg-transparent"
                style={{ mixBlendMode: 'multiply' as any }}
              />
            ) : (
              <div className="h-16 border-b border-gray-300" />
            )}
            <p className="mt-2 text-sm font-medium text-gray-900">{signature.signer_name}</p>
            <p className="text-xs text-gray-500">{signature.signer_title || signature.role_key}</p>
          </div>
        ))}
        {!sheet.signatures?.length ? (
          <>
            <div className="text-center"><div className="h-16 border-b border-gray-300" /><p className="mt-2 text-xs text-gray-500">Registrar</p></div>
            <div className="text-center"><div className="h-16 border-b border-gray-300" /><p className="mt-2 text-xs text-gray-500">Principal</p></div>
            <div className="text-center"><div className="h-16 border-b border-gray-300" /><p className="mt-2 text-xs text-gray-500">Board Chair</p></div>
          </>
        ) : null}
      </div>

      <DocumentActions doc={gradesheetDoc(sheet)} />
    </div>
  );
}
