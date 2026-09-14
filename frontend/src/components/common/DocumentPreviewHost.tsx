import { useEffect, useState } from 'react';
import { downloadDocument, printHtml } from '../../utils/printDocument';

type Preview = { title: string; html: string; bodyHtml: string };

export default function DocumentPreviewHost() {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<Preview>).detail;
      if (detail?.html) setPreview(detail);
    };
    window.addEventListener('svl-document-preview', onPreview);
    return () => window.removeEventListener('svl-document-preview', onPreview);
  }, []);

  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">{preview.title}</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => downloadDocument(preview.title, preview.bodyHtml)}>
              Download
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => printHtml(preview.html)}>
              Print / Save PDF
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setPreview(null)}>Close</button>
          </div>
        </div>
        <iframe title={preview.title} srcDoc={preview.html} className="flex-1 w-full min-h-[60vh] bg-white" />
      </div>
    </div>
  );
}
