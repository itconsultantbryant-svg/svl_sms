const STYLE = `
  body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; }
  p.meta { color: #555; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  img { max-width: 160px; }
`;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function documentHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${STYLE}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function slug(title: string): string {
  const clean = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'document';
}

export function downloadStoredFile(data: string, filename: string) {
  if (!data) return;
  try {
    if (data.startsWith('data:')) {
      const [meta, payload] = data.split(',');
      const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
      const binary = atob(payload || '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }
  } catch {
    // fall through to a direct link
  }
  const link = document.createElement('a');
  link.href = data;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadDocument(title: string, bodyHtml: string, filename?: string) {
  const html = documentHtml(title, bodyHtml);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${slug(title)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function previewDocument(title: string, bodyHtml: string, schoolDoc?: unknown) {
  window.dispatchEvent(new CustomEvent('svl-document-preview', {
    detail: { title, html: documentHtml(title, bodyHtml), bodyHtml, schoolDoc },
  }));
}

/** Download the current document immediately, and open an on-page preview. */
export function openPrintDocument(title: string, bodyHtml: string) {
  downloadDocument(title, bodyHtml);
  previewDocument(title, bodyHtml);
}

export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 250);
}
