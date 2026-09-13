export function openPrintDocument(title: string, bodyHtml: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return;
  win.document.write(`<!doctype html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p.meta { color: #555; font-size: 12px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .actions { margin: 16px 0; }
    @media print { .actions { display: none; } }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Download / Print PDF</button>
  </div>
  ${bodyHtml}
</body>
</html>`);
  win.document.close();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
