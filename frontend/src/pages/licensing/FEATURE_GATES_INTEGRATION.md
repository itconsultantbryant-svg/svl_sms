# Feature Gates Integration Guide

This file shows how to integrate feature gates into your pages and components.

## Quick Example: Disabling Export in ReportsPage

```tsx
import { useLicense } from '../../contexts/LicenseContext';
import { canExport, getExportDisabledTooltip } from '../../utils/featureGates';

function StudentsReportTab() {
  const license = useLicense();
  const exportDisabled = !canExport(license);
  
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {/* ... filters ... */}
        
        {/* Export Button with Feature Gate */}
        <div className="ml-auto group">
          <button 
            disabled={exportDisabled}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} className="mr-2" /> Export
          </button>
          {exportDisabled && (
            <div className="hidden group-hover:block absolute right-0 bg-gray-800 text-white text-xs rounded py-1 px-2 mt-1 whitespace-nowrap z-10">
              {getExportDisabledTooltip()}
            </div>
          )}
        </div>
      </div>
      
      {/* ... rest of table ... */}
    </div>
  );
}
```

## Example: Student Limit Warning

```tsx
import { useLicense } from '../../contexts/LicenseContext';
import { getMaxStudents, getStudentLimitWarning } from '../../utils/featureGates';
import { AlertCircle } from 'lucide-react';

function StudentsPage() {
  const license = useLicense();
  const { data: students } = useQuery(...);
  
  const studentCount = students?.length || 0;
  const maxStudents = getMaxStudents(license);
  const warning = getStudentLimitWarning(studentCount, license);
  
  return (
    <div className="space-y-4">
      {warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-yellow-800">{warning}</p>
        </div>
      )}
      
      <div className="text-sm text-gray-600 mb-4">
        Students: {studentCount} / {maxStudents === Infinity ? 'Unlimited' : maxStudents}
      </div>
      
      {/* ... students table ... */}
    </div>
  );
}
```

## Available Feature Gates

### `canExport(license: LicenseContextType): boolean`
Returns true if license mode is 'production'. Use to disable export functionality in demo mode.

### `canViewReports(license: LicenseContextType): boolean`
Returns true if license mode is 'production'. Use to disable report viewing in demo mode.

### `getMaxStudents(license: LicenseContextType): number`
Returns 50 for demo mode, Infinity for production. Use to enforce student limits.

### `isLicenseExpired(license: LicenseContextType): boolean`
Returns true if license is expired. Use to show expiry warnings.

### `getDaysRemaining(license: LicenseContextType): number | null`
Returns number of days remaining on license. Use in dashboard warnings.

### `getExportDisabledTooltip(): string`
Returns tooltip text for disabled export button.

### `getReportsDisabledTooltip(): string`
Returns tooltip text for disabled reports section.

### `getStudentLimitWarning(currentCount: number, license: LicenseContextType): string | null`
Returns warning message if near student limit, null otherwise.

## Implementation Checklist

Pages that should have feature gates:

- [ ] ReportsPage - Disable export buttons, limit report access
- [ ] StudentsPage - Show student limit warning, disable adding new students if at limit
- [ ] DashboardPage - Show expiry/mode indicator
- [ ] Any export functionality pages
- [ ] Financial/Accounts pages - Disable reports and exports

## License Hook Usage

```tsx
import { useLicense } from '../contexts/LicenseContext';

function MyComponent() {
  const {
    mode,           // 'demo' | 'production' | null
    expiry,         // Date | null
    planTier,       // string | null
    daysRemaining,  // number | null
    isExpired,      // boolean
    features,       // LicenseFeatures
    isLoading,      // boolean
    error,          // string | null
    setMode,        // (mode) => void
    refetchLicense  // () => Promise<void>
  } = useLicense();
  
  if (mode === 'demo') {
    // Show demo mode restrictions
  }
  
  if (isExpired) {
    // Show license expired warning
  }
}
```

## localStorage Keys

- `svl_license_mode` - User's chosen mode ('demo' or 'production')
- `svl_setup_wizard_completed` - Whether setup wizard has been completed
- `svl_token` - Auth token (existing)

## API Endpoints

The licensing system calls:

- `GET /api/licensing/check` - Check current license status
- `POST /api/licensing/activate` - Activate a license key

These should be implemented in the backend licensing controller.
