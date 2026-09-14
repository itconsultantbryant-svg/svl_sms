import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { escapeHtml, previewDocument } from './printDocument';

export type SchoolInfo = {
  institution_name?: string | null;
  name?: string | null;
  logo?: string | null;
  motto?: string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type SchoolDoc = {
  title: string;
  filename?: string;
  school: SchoolInfo;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Array<Array<string | number>>;
  footer?: string[];
};

export function schoolName(school?: SchoolInfo | null): string {
  return school?.institution_name || school?.name || 'School';
}

export function schoolPlace(school?: SchoolInfo | null): string {
  return [school?.address, school?.city, school?.county].filter(Boolean).join(', ');
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
}

export function schoolDocumentHtml(doc: SchoolDoc): string {
  const school = doc.school || {};
  const place = schoolPlace(school);
  const contact = [school.phone, school.email].filter(Boolean).join(' · ');
  const meta = (doc.meta || []).map((item) => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`).join('');
  const head = doc.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
  const body = doc.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `
    <div style="text-align:center;margin-bottom:16px">
      ${school.logo ? `<img src="${escapeHtml(school.logo)}" alt="" style="height:72px;object-fit:contain;margin-bottom:8px" />` : ''}
      <h1>${escapeHtml(schoolName(school))}</h1>
      ${school.motto ? `<p class="meta">${escapeHtml(school.motto)}</p>` : ''}
      ${place ? `<p class="meta">${escapeHtml(place)}</p>` : ''}
      ${contact ? `<p class="meta">${escapeHtml(contact)}</p>` : ''}
      <h2 style="letter-spacing:1px;margin-top:12px">${escapeHtml(doc.title)}</h2>
      ${doc.subtitle ? `<p class="meta">${escapeHtml(doc.subtitle)}</p>` : ''}
    </div>
    ${meta ? `<table style="margin-bottom:12px">${meta}</table>` : ''}
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${Math.max(doc.columns.length, 1)}">No records</td></tr>`}</tbody>
    </table>
    ${(doc.footer || []).map((line) => `<p class="meta" style="margin-top:8px">${escapeHtml(line)}</p>`).join('')}
  `;
}

function imageFormat(logo: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (logo.includes('image/jpeg') || logo.includes('image/jpg')) return 'JPEG';
  if (logo.includes('image/webp')) return 'WEBP';
  return 'PNG';
}

export function schoolPdf(doc: SchoolDoc) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const school = doc.school || {};
  let y = 36;

  if (school.logo && school.logo.startsWith('data:image')) {
    try {
      pdf.addImage(school.logo, imageFormat(school.logo), pageWidth / 2 - 28, y, 56, 56);
      y += 66;
    } catch {
      // A logo the PDF engine cannot embed should not block the download.
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(17);
  pdf.text(schoolName(school), pageWidth / 2, y, { align: 'center' });
  y += 16;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(80);
  const lines = [school.motto, schoolPlace(school), [school.phone, school.email].filter(Boolean).join(' · ')].filter(Boolean) as string[];
  lines.forEach((line) => {
    pdf.text(String(line), pageWidth / 2, y, { align: 'center' });
    y += 12;
  });
  y += 8;
  pdf.setTextColor(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(doc.title, pageWidth / 2, y, { align: 'center' });
  y += 14;
  if (doc.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(doc.subtitle, pageWidth / 2, y, { align: 'center' });
    y += 14;
  }

  if (doc.meta?.length) {
    autoTable(pdf, {
      startY: y,
      body: doc.meta.map((item) => [item.label, item.value || '—']),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
    });
    y = ((pdf as any).lastAutoTable?.finalY || y) + 12;
  }

  autoTable(pdf, {
    startY: y,
    head: [doc.columns],
    body: doc.rows.length ? doc.rows.map((row) => row.map((cell) => String(cell ?? ''))) : [doc.columns.map(() => '')],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  if (doc.footer?.length) {
    let fy = ((pdf as any).lastAutoTable?.finalY || y) + 20;
    pdf.setFontSize(9);
    pdf.setTextColor(80);
    doc.footer.forEach((line) => {
      pdf.text(line, 40, fy);
      fy += 14;
    });
  }

  return pdf;
}

export async function downloadSchoolPdf(doc: SchoolDoc) {
  schoolPdf(doc).save(doc.filename || `${slug(doc.title)}.pdf`);
}

export function openSchoolDocument(doc: SchoolDoc) {
  previewDocument(doc.title, schoolDocumentHtml(doc), doc);
}

export function lessonPlanDoc(plan: any, school: SchoolInfo): SchoolDoc {
  return {
    title: 'LESSON PLAN',
    filename: `${slug(plan?.title || 'lesson-plan')}.pdf`,
    school,
    subtitle: plan?.title || '',
    meta: [
      { label: 'Class', value: plan?.class_name || 'Any class' },
      { label: 'Subject', value: plan?.subject_name || 'Any subject' },
    ],
    columns: ['Plan'],
    rows: [[plan?.description || 'No description']],
    footer: plan?.file_name ? [`Attachment: ${plan.file_name}`] : [],
  };
}
