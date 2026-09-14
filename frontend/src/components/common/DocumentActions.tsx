import { Download, Eye } from 'lucide-react';
import { downloadSchoolPdf, openSchoolDocument, SchoolDoc } from '../../utils/schoolDocument';

export default function DocumentActions({ doc, className = 'mt-6 flex justify-center gap-2 print:hidden' }: { doc: SchoolDoc; className?: string }) {
  return (
    <div className={className}>
      <button type="button" className="btn-secondary" onClick={() => openSchoolDocument(doc)}>
        <Eye size={16} className="mr-2" /> Preview
      </button>
      <button type="button" className="btn-primary" onClick={() => downloadSchoolPdf(doc)}>
        <Download size={16} className="mr-2" /> Download PDF
      </button>
    </div>
  );
}
