import { useLicense } from '../contexts/LicenseContext';

export default function DemoModeWatermark() {
  const { mode } = useLicense();

  if (mode !== 'demo') return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{
          opacity: 0.05,
          transform: 'rotate(-45deg)',
          transformOrigin: 'bottom right',
        }}
      >
        <defs>
          <pattern
            id="watermark-pattern"
            x="0"
            y="0"
            width="500"
            height="500"
            patternUnits="userSpaceOnUse"
          >
            <text
              x="250"
              y="250"
              fontSize="120"
              fontWeight="bold"
              textAnchor="middle"
              fill="#999999"
              opacity="0.5"
            >
              DEMO MODE
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
      </svg>
    </div>
  );
}
