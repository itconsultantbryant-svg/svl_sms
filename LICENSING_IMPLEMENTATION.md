# SVL-SMS Licensing System Implementation

## Overview

A complete backend licensing infrastructure for SVL-SMS that supports both demo and production modes with offline-first validation, automatic check-ins, and machine binding.

## Architecture

### Components

1. **Database Schema** (`src/database/schema-v2-consolidated.ts`)
   - `licenses` - Store license keys, modes, tiers, expiry dates, and status
   - `license_activations` - Track machine-specific activations and check-ins
   - `demo_mode_settings` - Store demo mode limits and expiry per institution

2. **Licensing Utility** (`src/utils/licensing.ts`)
   - RSA key generation and signing
   - License key generation (format: SVL-XXXX-XXXX-XXXX-XXXX)
   - License validation
   - Machine fingerprint generation
   - Expiry calculations

3. **Licensing Routes** (`src/routes/licensing.ts`)
   - `POST /api/licensing/activate` - Activate license on a machine
   - `GET /api/licensing/check` - Check current license status (requires auth)
   - `POST /api/licensing/check-in` - Periodic check-in (hybrid validation)
   - `POST /api/licensing/generate-key` - Admin endpoint to generate keys

4. **Demo Mode Enforcement** (`src/routes/demo-mode-enforcement.ts`)
   - `GET /api/demo-mode/status` - Check demo mode status
   - `POST /api/demo-mode/setup` - Setup demo mode for an institution
   - Middleware functions for demo restrictions

5. **Authentication Middleware** (`src/middleware/auth.ts`)
   - Extended with license checking
   - Rejects expired licenses (demo and production)
   - Attaches license info to authenticated requests

## Database Schema

### licenses table
```sql
CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  mode TEXT ('demo' | 'production'),
  plan_tier TEXT ('free' | 'basic' | 'standard' | 'premium' | 'enterprise'),
  expiry_date TEXT NOT NULL,
  machine_fingerprint TEXT,  -- Optional: for production licenses
  status TEXT ('active' | 'inactive' | 'revoked' | 'expired'),
  activated_at TEXT,
  created_at TEXT,
  updated_at TEXT
)
```

### license_activations table
```sql
CREATE TABLE license_activations (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  license_id TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  last_check_in TEXT,
  ip_address TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(license_id, machine_id)
)
```

### demo_mode_settings table
```sql
CREATE TABLE demo_mode_settings (
  id TEXT PRIMARY KEY,
  institution_id TEXT UNIQUE NOT NULL,
  max_students INTEGER DEFAULT 50,
  expiry_date TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
)
```

## API Endpoints

### 1. Activate License
**Endpoint:** `POST /api/licensing/activate`  
**Auth:** Not required (no authentication needed for initial activation)

**Request Body:**
```json
{
  "license_key": "SVL-XXXX-XXXX-XXXX-XXXX",
  "machine_id": "unique-machine-identifier",
  "institution_id": "optional-for-batch-activation"
}
```

**Response (200 OK):**
```json
{
  "status": "activated",
  "mode": "demo|production",
  "planTier": "free|basic|standard|premium|enterprise",
  "expiry": "2026-09-06T00:00:00Z",
  "daysRemaining": 30,
  "machineId": "unique-machine-identifier",
  "licenseId": "lic_xxx"
}
```

**Error Responses:**
- `400` - Invalid license key format
- `403` - License expired or machine ID mismatch
- `404` - License not found

### 2. Check License Status
**Endpoint:** `GET /api/licensing/check`  
**Auth:** Required (JWT token)

**Response (200 OK):**
```json
{
  "mode": "demo|production",
  "status": "active|expired",
  "planTier": "free|basic|standard|premium|enterprise",
  "expiry": "2026-09-06T00:00:00Z",
  "daysRemaining": 30,
  "licenseId": "lic_xxx",
  "demoMaxStudents": 50
}
```

### 3. License Check-in (Hybrid Validation)
**Endpoint:** `POST /api/licensing/check-in`  
**Auth:** Required (JWT token)

**Request Body:**
```json
{
  "machine_id": "unique-machine-identifier"
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "mode": "demo|production",
  "planTier": "free|basic|standard|premium|enterprise",
  "expiry": "2026-09-06T00:00:00Z",
  "daysRemaining": 30,
  "checkedInAt": "2026-08-06T12:30:00Z"
}
```

### 4. Generate License Key (Admin Only)
**Endpoint:** `POST /api/licensing/generate-key`  
**Auth:** Required (platform admin only)

**Request Body:**
```json
{
  "institution_id": "inst_xxx",
  "plan_tier": "basic",
  "mode": "demo",
  "expiry_days": 30
}
```

**Response (200 OK):**
```json
{
  "licenseKey": "SVL-XXXX-XXXX-XXXX-XXXX",
  "mode": "demo",
  "planTier": "basic",
  "expiryDate": "2026-09-06T00:00:00Z",
  "daysValid": 30
}
```

### 5. Demo Mode Status
**Endpoint:** `GET /api/demo-mode/status`  
**Auth:** Required (JWT token)

**Response (200 OK):**
```json
{
  "isDemo": true,
  "hasLicense": true,
  "mode": "demo",
  "planTier": "free",
  "expired": false,
  "expiry": "2026-09-06T00:00:00Z",
  "daysRemaining": 30
}
```

### 6. Setup Demo Mode
**Endpoint:** `POST /api/demo-mode/setup`  
**Auth:** Required (institution admin only)

**Response (201 Created):**
```json
{
  "message": "Demo mode setup successful",
  "mode": "demo",
  "planTier": "free",
  "maxStudents": 50,
  "expiryDate": "2026-09-06T00:00:00Z",
  "daysValid": 30
}
```

## License Modes

### Demo Mode
- **Duration:** 30 days from first setup
- **Student Limit:** 50 students max
- **Features:**
  - No exports/reports
  - Demo watermark on all responses (`_demo_watermark: true`)
  - Student count capped at 50
  - Full feature access for testing
- **Cost:** Free
- **Use Case:** Trial, evaluation, training

### Production Mode
- **Duration:** As specified by license
- **Machine Binding:** Optional fingerprint-based binding
- **Features:**
  - Full access to all features
  - Unlimited students/users
  - No watermarks
  - Export and reporting enabled
- **Cost:** Based on plan tier
- **Use Case:** Live deployment

## Plan Tiers

| Tier | Students | Staff | Features |
|------|----------|-------|----------|
| Free | 50 | 10 | Core only |
| Basic | 500 | 50 | Core + Reports |
| Standard | 2000 | 200 | Core + Reports + Analytics |
| Premium | 5000 | 500 | All |
| Enterprise | Unlimited | Unlimited | All + Support |

## Authentication & Authorization

### License Checking in Auth Middleware

After JWT verification, the `authenticate` middleware now:

1. Looks up the institution's active license
2. Checks if the license is expired
3. Blocks access if demo mode has expired
4. Blocks access if production license has expired
5. Attaches license info to `req.user`:
   - `license_mode` - 'demo' or 'production'
   - `license_expiry` - Expiry date string
   - `license_tier` - Plan tier
   - `days_remaining` - Days until expiry
   - `license_id` - License ID

**Error Responses:**
- `403 Demo expired` - Demo license has expired
- `403 License expired` - Production license has expired
- `403 License required` - No license found for institution

## Demo Mode Enforcement

### Middleware Functions

1. **checkDemoMode()** - Verifies license status
2. **addDemoWatermark()** - Adds `_demo_watermark: true` to responses
3. **blockDemoExports()** - Blocks export/report endpoints
4. **capDemoStudentCount()** - Caps student count at 50 on `/api/dashboard/stats`

### Integration Example

```typescript
import { checkDemoMode, addDemoWatermark, blockDemoExports } from './routes/demo-mode-enforcement';

app.use(authenticate);
app.use(checkDemoMode);
app.use(addDemoWatermark);
app.use(blockDemoExports);
app.use('/api/your-route', yourRouter);
```

## Key Generation & Signing

### RSA Key Pair

Keys are embedded in `src/utils/licensing.ts`:
- **Private Key:** Used only on server for signing
- **Public Key:** Embedded in app for offline validation

### License Key Format

```
SVL-XXXX-XXXX-XXXX-XXXX
│   │    │    │    │
│   │    │    │    └─ Random Key ID
│   │    │    └────── Part of RSA signature
│   │    └────────── Part of RSA signature
│   └──────────────── Part of RSA signature
└─────────────────── System identifier
```

### Signing Flow

```
Data Object
  ↓
JSON Stringify
  ↓
RSA Sign (SHA256)
  ↓
Hex Encode
  ↓
Format as SVL-XXXX-XXXX-XXXX-XXXX
```

## Machine Fingerprinting

For production licenses with machine binding:

```typescript
const fingerprint = generateMachineFingerprint();
// Returns: SHA256 hash of system info
```

Can be used to bind licenses to specific devices (optional).

## Offline-First Validation

The licensing system works offline:

1. **License Key Format:** Can be validated locally (signature checking)
2. **Expiry Dates:** Stored locally, checked against system clock
3. **Phone-Home:** Optional periodic check-in to sync activation data
4. **Check-in Endpoint:** `POST /api/licensing/check-in` for server sync

## Expiry Handling

### Grace Period (Optional)
Add grace period logic in middleware:
```typescript
if (daysRemaining < 0 && daysRemaining > -3) {
  // Grace period: allow access but warn user
  addWarning(res, `License expired ${Math.abs(daysRemaining)} days ago`);
}
```

### Automatic Status Updates
Licenses marked as 'expired' when:
1. Activation check detects expiry date in past
2. Scheduled job runs (if implemented)

## Testing Guide

### 1. Generate a Test License

```bash
curl -X POST http://localhost:10000/api/licensing/generate-key \
  -H "Authorization: Bearer PLATFORM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institution_id": "inst_test",
    "plan_tier": "basic",
    "mode": "demo",
    "expiry_days": 30
  }'
```

### 2. Activate the License

```bash
curl -X POST http://localhost:10000/api/licensing/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "SVL-XXXX-XXXX-XXXX-XXXX",
    "machine_id": "dev-machine-001"
  }'
```

### 3. Check License Status

```bash
curl -X GET http://localhost:10000/api/licensing/check \
  -H "Authorization: Bearer USER_TOKEN"
```

### 4. Setup Demo Mode

```bash
curl -X POST http://localhost:10000/api/demo-mode/setup \
  -H "Authorization: Bearer INSTITUTION_ADMIN_TOKEN"
```

## Implementation Notes

### Database Migration
The new tables are added to `schema-v2-consolidated.ts`. Run migrations:
```bash
npm run db:migrate
```

### Environment Variables
No new environment variables required. Uses existing `JWT_SECRET`.

### Security Considerations
1. Private RSA key never exposed to client
2. License keys are signed and can be verified offline
3. Machine fingerprinting is optional but recommended for production
4. IP address logging for activation tracking
5. Status tracking (active/inactive/revoked/expired)

### Performance
- License check happens in auth middleware (once per request)
- Database query optimized with indexes on:
  - `idx_licenses_institution`
  - `idx_licenses_status`
  - `idx_licenses_expiry`

### Future Enhancements
1. Scheduled job to mark licenses as 'expired' after expiry date
2. License revocation/suspension mechanism
3. Usage tracking per institution
4. Automatic license renewal/billing integration
5. License transfer between institutions
6. Tiered feature access based on plan tier

## File Structure

```
src/
├── database/
│   └── schema-v2-consolidated.ts (updated with license tables)
├── utils/
│   └── licensing.ts (new - RSA signing, key generation)
├── routes/
│   ├── licensing.ts (new - activation, check, check-in)
│   └── demo-mode-enforcement.ts (new - demo restrictions)
├── middleware/
│   └── auth.ts (updated - license checking)
└── index.ts (updated - license routes registration)
```

## API Integration Points

### For Frontend (Electron App)
1. Call `/api/licensing/activate` on first launch with local machine ID
2. Periodically call `POST /api/licensing/check-in` for sync
3. Check `_demo_watermark` in responses to show demo badge
4. Catch 403 responses with `error: 'Demo expired'` to redirect to setup

### For Backend
1. All authenticated routes automatically check license
2. Use `req.user.license_mode` to apply demo restrictions
3. Use `req.user.days_remaining` for warnings
4. Export/report endpoints should check license tier

## Support

For issues:
1. Check license status: `GET /api/licensing/check`
2. Verify activation: Check `license_activations` table
3. Check expiry: Compare `licenses.expiry_date` with current date
4. Review logs: Check for license validation errors in server logs
