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
  student?: {
    first_name?: string;
    last_name?: string;
    admission_number?: string;
    class_name?: string | null;
    section_name?: string | null;
    session_name?: string | null;
  };
  subjects?: Array<{
    id: string;
    name: string;
    code?: string | null;
    percent?: number | null;
    letter?: string;
    term_name?: string;
  }>;
};

export function gradesheetDoc(sheet: GradesheetData): SchoolDoc {
  const school = sheet.institution || {};
  const student = sheet.student || {};
  return {
    title: 'STUDENT GRADESHEET',
    filename: `${(student.admission_number || 'gradesheet').toString().toLowerCase()}.pdf`,
    school,
    meta: [
      { label: 'Student', value: `${student.first_name || ''} ${student.last_name || ''}`.trim() },
      { label: 'Admission No.', value: student.admission_number || '' },
      { label: 'Class', value: [student.class_name, student.section_name].filter(Boolean).join(' — ') },
      { label: 'Session', value: student.session_name || '' },
    ],
    columns: ['#', 'Subject', 'Code', 'Score %', 'Grade', 'Term'],
    rows: (sheet.subjects || []).map((subject, index) => [
      index + 1,
      subject.name,
      subject.code || '',
      subject.percent == null ? '' : subject.percent,
      subject.letter || '',
      subject.term_name || '',
    ]),
    footer: ['Class Teacher ________________    Principal ________________    Date ________________'],
  };
}

export function gradesheetHtml(sheet: GradesheetData): string {
  const school = sheet.institution || {};
  const student = sheet.student || {};
  const place = [school.address, school.city, school.county].filter(Boolean).join(', ');
  const contact = [school.phone, school.email].filter(Boolean).join(' · ');
  const rows = (sheet.subjects || []).map((subject, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(subject.name)}</td>
      <td>${escapeHtml(subject.code || '')}</td>
      <td>${subject.percent == null ? '' : escapeHtml(subject.percent)}</td>
      <td>${escapeHtml(subject.letter || '')}</td>
      <td>${escapeHtml(subject.term_name || '')}</td>
    </tr>
  `).join('') || '<tr><td colspan="6">No subjects are assigned to this class yet.</td></tr>';

  return `
    <div style="text-align:center;margin-bottom:16px">
      ${school.logo ? `<img src="${escapeHtml(school.logo)}" alt="" style="height:72px;object-fit:contain;margin-bottom:8px" />` : ''}
      <h1 style="font-size:22px;margin:0">${escapeHtml(school.institution_name || 'School')}</h1>
      ${school.motto ? `<p class="meta">${escapeHtml(school.motto)}</p>` : ''}
      ${place ? `<p class="meta">${escapeHtml(place)}</p>` : ''}
      ${contact ? `<p class="meta">${escapeHtml(contact)}</p>` : ''}
      <h2 style="margin:14px 0 0;font-size:16px;letter-spacing:1px">STUDENT GRADESHEET</h2>
    </div>
    <table style="margin-bottom:12px">
      <tr>
        <th>Student</th><td>${escapeHtml(`${student.first_name || ''} ${student.last_name || ''}`.trim())}</td>
        <th>Admission No.</th><td>${escapeHtml(student.admission_number || '')}</td>
      </tr>
      <tr>
        <th>Class</th><td>${escapeHtml(student.class_name || '')}${student.section_name ? ` — ${escapeHtml(student.section_name)}` : ''}</td>
        <th>Session</th><td>${escapeHtml(student.session_name || '')}</td>
      </tr>
    </table>
    <table>
      <thead>
        <tr><th>#</th><th>Subject</th><th>Code</th><th>Score %</th><th>Grade</th><th>Term</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:48px;font-size:12px">
      <div>Class Teacher ________________</div>
      <div>Principal ________________</div>
      <div>Date ________________</div>
    </div>
  `;
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
  const place = [school.address, school.city, school.county].filter(Boolean).join(', ');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="text-center mb-6">
        {school.logo ? <img src={school.logo} alt="" className="h-16 mx-auto mb-2 object-contain" /> : null}
        <h2 className="text-xl font-bold text-gray-900">{school.institution_name || 'School'}</h2>
        {school.motto ? <p className="text-sm text-gray-500">{school.motto}</p> : null}
        {place ? <p className="text-xs text-gray-500">{place}</p> : null}
        <p className="mt-3 text-sm font-semibold tracking-wide text-gray-800">STUDENT GRADESHEET</p>
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
              <th className="px-3 py-2 text-left border-b">Score %</th>
              <th className="px-3 py-2 text-left border-b">Grade</th>
              <th className="px-3 py-2 text-left border-b">Term</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No subjects are assigned to this class yet.</td></tr>
            ) : subjects.map((subject, index) => (
              <tr key={subject.id} className="border-b border-gray-100">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-medium">{subject.name}</td>
                <td className="px-3 py-2">{subject.code || '—'}</td>
                <td className="px-3 py-2">{subject.percent == null ? '—' : subject.percent}</td>
                <td className="px-3 py-2">{subject.letter || '—'}</td>
                <td className="px-3 py-2">{subject.term_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocumentActions doc={gradesheetDoc(sheet)} />
    </div>
  );
}
