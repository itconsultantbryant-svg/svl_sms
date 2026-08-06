# SVL-SMS Frontend Licensing System

This directory contains the complete frontend licensing UI implementation for SVL-SMS. The system supports both demo mode (30-day trial) and production mode (license-based).

## Files Overview

### Core Context
- **`LicenseContext.tsx`** - Global license state management
  - Manages `mode`, `expiry`, `planTier`, `daysRemaining`, `isExpired`, `features`
  - Provides `useLicense()` hook for accessing license state
  - Auto-fetches `/api/licensing/check` on app init
  - Falls back to 30-day demo if license check fails

### Pages
- **`SetupWizard.tsx`** - Full-screen wizard on first launch
  - Step 1: Mode selection (Demo vs Production)
  - Step 2: License key entry (Production only)
  - Step 3: Demo setup confirmation
  - Posts to `/api/licensing/activate` for key validation
  - Stores mode in `localStorage.svl_license_mode`

### Components
- **`../DemoModeIndicator.tsx`** - Header badge showing license status
  - Yellow "DEMO MODE" badge for demo mode
  - Gray days-remaining badge for production
  - Red "LICENSE EXPIRED" badge when expired
  - Clickable → shows license status modal

- **`../DemoModeWatermark.tsx`** - Faint background watermark in demo mode
  - SVG overlay with "DEMO MODE" text
  - Opacity 0.05, rotated 45 degrees
  - Non-intrusive but clearly visible

### Utilities
- **`../../../utils/featureGates.ts`** - Feature gate functions
  - `canExport(license)` - Production mode only
  - `canViewReports(license)` - Production mode only
  - `getMaxStudents(license)` - 50 for demo, Infinity for production
  - `isLicenseExpired(license)` - Check expiry status
  - `getDaysRemaining(license)` - Days left on license
  - `getStudentLimitWarning(count, license)` - Smart limit warnings
  - `getExportDisabledTooltip()` - Tooltip text
  - `getReportsDisabledTooltip()` - Tooltip text

## Integration

### App.tsx Changes
```tsx
// 1. Wrap with LicenseProvider in main.tsx
<LicenseProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</LicenseProvider>

// 2. Add SetupWizard gate in App.tsx
if (!mode && !localStorage.getItem('svl_license_mode') && !isLoading) {
  return <SetupWizard />;
}

// 3. Add DemoModeWatermark to MainLayout
<DemoModeWatermark />
```

### Header.tsx Changes
```tsx
// Add DemoModeIndicator to header
<DemoModeIndicator />
```

### Using Feature Gates
```tsx
import { useLicense } from '../contexts/LicenseContext';
import { canExport, getMaxStudents } from '../utils/featureGates';

function MyComponent() {
  const license = useLicense();
  
  if (!canExport(license)) {
    // Show "Export disabled in demo mode"
  }
  
  const maxStudents = getMaxStudents(license);
}
```

## Flow Diagram

```
App Initialization
    ↓
AuthProvider loads (checks token)
    ↓
LicenseProvider loads (fetches /api/licensing/check)
    ↓
AppContent renders
    ↓
Has license mode?
    ├─ NO → Show SetupWizard
    │         ├─ Demo selected → Set mode='demo', 30-day expiry
    │         └─ Production selected → Enter key, POST /api/licensing/activate
    │
    └─ YES → Render MainLayout with DemoModeWatermark
              ├─ Header shows DemoModeIndicator
              ├─ Pages use feature gates
              └─ Demo watermark in background
```

## Demo Mode Defaults

- **Duration:** 30 days
- **Features:**
  - No export functionality
  - No reports viewing
  - Max 50 students
  - Full access to other features
- **Watermark:** Faint "DEMO MODE" text in background

## Production Mode

- **Duration:** Based on license key
- **Features:**
  - Unlimited exports
  - Full reports access
  - Unlimited students
  - All features enabled
- **Watermark:** None

## API Endpoints Required

### Backend should implement:

1. **GET `/api/licensing/check`**
   - Returns: `{ mode: 'demo'|'production', expiry: Date, plan_tier: string, features: {...} }`
   - Called on app init and when refetching license

2. **POST `/api/licensing/activate`**
   - Body: `{ key: string }`
   - Returns: `{ expiry: Date, plan_tier: string, features: {...} }`
   - Validates license key and returns activation details

## localStorage Keys

- `svl_license_mode` - Persisted mode choice ('demo' or 'production')
- `svl_setup_wizard_completed` - Whether wizard was completed
- `svl_token` - Auth token (existing)

## Demo Mode Behavior

1. First time user visits → SetupWizard modal
2. User clicks "Start Testing" → Demo mode enabled
3. Yellow badge shows "DEMO MODE" in header
4. Faint watermark visible on all pages
5. Export/Reports disabled with tooltips
6. Student table shows "Max 50" limit
7. Warning appears when adding near limit
8. After 30 days expiry, show "License Expired" modal

## Testing Checklist

- [ ] SetupWizard appears on first login
- [ ] Demo mode selection works
- [ ] License key entry validates
- [ ] Mode badge appears in header
- [ ] Watermark visible in demo mode
- [ ] Export buttons disabled in demo
- [ ] Reports blocked in demo
- [ ] Student limit enforced (50 in demo)
- [ ] Production mode has no restrictions
- [ ] License expiry shows warning
- [ ] localStorage persists mode across reloads

## Documentation Files

- **`FEATURE_GATES_INTEGRATION.md`** - Quick reference for using feature gates
- **`IMPLEMENTATION_EXAMPLES.md`** - Complete code examples for integration

See these files for detailed integration patterns and implementation guidance.
