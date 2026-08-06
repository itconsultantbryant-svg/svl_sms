# Demo Mode Integration Guide

## Quick Start

The licensing and demo mode system is now ready to be integrated into the main application flow. Here's what needs to happen:

## 1. Database Setup

Run the migrations to create the new tables:

```bash
npm run db:migrate
```

This will create:
- `licenses`
- `license_activations`
- `demo_mode_settings`

## 2. Auth Middleware (Already Done)

The authentication middleware (`src/middleware/auth.ts`) now:
- Checks for active licenses after JWT validation
- Rejects expired demo licenses with 403
- Rejects expired production licenses with 403
- Attaches license info to `req.user`

## 3. Apply Demo Mode Enforcement (Next Step)

To apply demo mode restrictions globally, update your protected route registrations in `src/index.ts`:

```typescript
import { 
  checkDemoMode, 
  addDemoWatermark, 
  blockDemoExports,
  capDemoStudentCount 
} from './routes/demo-mode-enforcement';

// After authentication middleware, add demo mode checks:
app.use(authenticate);
app.use(checkDemoMode);
app.use(addDemoWatermark);
app.use(blockDemoExports);
app.use(capDemoStudentCount);

// Then your protected routes
app.use('/api/users', usersRouter);
// ... rest of routes
```

## 4. Endpoints Ready to Use

### For Clients (Electron App)

**Initial Setup:**
```typescript
// On first launch, get or create license
const response = await fetch('/api/demo-mode/setup', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Periodic Check-in:**
```typescript
// Every 1-5 minutes, phone home to validate
const response = await fetch('/api/licensing/check-in', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ machine_id: 'device-fingerprint' })
});
```

**Check Status:**
```typescript
const response = await fetch('/api/demo-mode/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { isDemo, expired, daysRemaining } = await response.json();
```

### For Admins (To Generate Licenses)

```bash
# Generate a test license
curl -X POST http://localhost:10000/api/licensing/generate-key \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "institution_id": "inst_001",
    "plan_tier": "basic",
    "mode": "demo",
    "expiry_days": 30
  }'
```

## 5. Response Handling

### Demo Mode Watermark

All responses in demo mode include:
```json
{
  "data": {...},
  "_demo_watermark": true,
  "_demo_expiry": "2026-09-06T00:00:00Z"
}
```

### Error Responses

**License Expired:**
```json
{
  "error": "Demo expired",
  "redirect": "/setup",
  "expiry": "2026-08-06T00:00:00Z"
}
```

**No License:**
```json
{
  "error": "License required",
  "redirect": "/setup"
}
```

**Export Not Available in Demo:**
```json
{
  "error": "Exports not available in demo mode",
  "message": "Please upgrade to a production license to enable exports"
}
```

## 6. Frontend Implementation Points

### React/Vue Components

```typescript
// Check if in demo mode
const isDemo = localStorage.getItem('license_mode') === 'demo';

// Show demo badge
if (isDemo) {
  showDemoBadge(`Demo expires in ${daysRemaining} days`);
}

// Disable export buttons
if (isDemo) {
  disableExportButtons();
}

// Handle license expiry
if (response.status === 403 && response.error.includes('expired')) {
  redirectTo('/setup');
}
```

### Demo Mode UX

Show in UI:
1. **Demo Badge** - Top right corner with countdown
2. **Watermark** - Subtle "DEMO" watermark on dashboard
3. **Feature Warnings** - Disabled export/report buttons
4. **Student Count** - Show "50/50 demo limit reached"

## 7. Testing Scenarios

### Scenario 1: Fresh Installation (Demo Mode)
```
1. User launches app for first time
2. POST /api/demo-mode/setup creates 30-day demo license
3. POST /api/licensing/activate stores machine activation
4. GET /api/licensing/check returns demo info
5. All responses include _demo_watermark: true
6. Exports are blocked
```

### Scenario 2: Expired Demo Mode
```
1. Demo license expires (30 days pass)
2. User tries to login
3. Auth middleware rejects: 403 "Demo expired"
4. Frontend redirects to /setup
5. Admin can activate existing license or create new demo
```

### Scenario 3: Production License
```
1. Admin generates production license (SVL-XXXX-...)
2. User activates license during setup
3. POST /api/licensing/activate with license key
4. License is bound to machine_id
5. Exports enabled
6. No watermark in responses
```

### Scenario 4: License Check-in
```
1. App running in background
2. Every 5 minutes: POST /api/licensing/check-in
3. Server updates last_check_in timestamp
4. Returns valid: true/false
5. If invalid, app can queue offline and retry later
```

## 8. Configuration Options

### Demo Mode Defaults
Edit `src/routes/demo-mode-enforcement.ts`:
```typescript
// Change default student limit:
max_students: 100,  // was 50

// Change default demo duration:
const demoExpiry = new Date();
demoExpiry.setDate(demoExpiry.getDate() + 60);  // was 30
```

### Demo Enforcement Endpoints
Edit `src/routes/demo-mode-enforcement.ts`:
```typescript
// Block additional endpoints
const exportEndpoints = [
  '/export',
  '/download',
  '/report',
  '/pdf',
  '/excel',
  '/csv',
  '/backup',  // Add this
];
```

## 9. License Tiers (For Future)

Current plan tiers are defined in `src/utils/licensing.ts`:
- `free` - Demo mode, 50 students, no exports
- `basic` - 500 students, basic reports
- `standard` - 2000 students, analytics
- `premium` - 5000 students, all features
- `enterprise` - Unlimited, everything

To enforce tier-based limits, add checks in route handlers:
```typescript
if (req.user?.license_tier === 'free') {
  return res.status(403).json({ error: 'Feature requires at least basic license' });
}
```

## 10. Monitoring & Logging

### License Activity Logging
Logs are written to server console:
```
✅ License activated: SVL-XXXX-... on machine dev-001
❌ Demo license expired for institution inst_001
⚠️  License expiring in 3 days: inst_001
```

### Database Queries for Monitoring

Check active licenses:
```sql
SELECT * FROM licenses WHERE status = 'active' AND mode = 'demo';
```

Check recent activations:
```sql
SELECT * FROM license_activations 
WHERE activated_at > datetime('now', '-7 days');
```

Check expiring licenses:
```sql
SELECT * FROM licenses 
WHERE expiry_date BETWEEN datetime('now') AND datetime('now', '+7 days');
```

## 11. Next Steps

1. **Implement in Electron App:**
   - Add license activation screen in setup flow
   - Add machine fingerprint generation
   - Add periodic check-in loop
   - Show demo badge and countdown

2. **Add License Management UI:**
   - Admin panel to view active licenses
   - Ability to generate test licenses
   - View activation history per institution

3. **Integrate with Billing (Future):**
   - Connect to payment processor
   - Auto-generate licenses on purchase
   - Auto-renew licenses

4. **Add Feature Flags:**
   - Define which features are available in each tier
   - Check in route handlers before allowing access

## 12. Troubleshooting

**Problem:** "License required" error on login
- Check: `SELECT * FROM licenses WHERE institution_id = ?`
- Action: Either activate existing license or run `/api/demo-mode/setup`

**Problem:** "Demo expired" after 30 days
- Check: License expiry date in database
- Action: Generate new license with `POST /api/licensing/generate-key`

**Problem:** Can't export in demo mode
- Check: Response includes 403 error
- Expected: Export blocked by `blockDemoExports` middleware
- Action: Upgrade to production license

**Problem:** Machine ID mismatch for production license
- Check: `license.machine_fingerprint` vs `machine_id` in activation request
- Action: For development, remove machine binding or regenerate license

## Files Modified/Created

- ✅ `src/database/schema-v2-consolidated.ts` - Added 3 new tables
- ✅ `src/utils/licensing.ts` - New file with RSA signing
- ✅ `src/routes/licensing.ts` - New file with activation/check endpoints
- ✅ `src/routes/demo-mode-enforcement.ts` - New file with demo restrictions
- ✅ `src/middleware/auth.ts` - Updated with license checking
- ✅ `src/index.ts` - Updated to register licensing routes
- ✅ `LICENSING_IMPLEMENTATION.md` - Comprehensive documentation
- ✅ `DEMO_MODE_INTEGRATION.md` - This file

## Ready to Deploy

The backend licensing system is fully functional and ready to:
1. Run migrations on database
2. Integrate demo mode middleware in index.ts
3. Build Electron frontend with license UI
4. Deploy to production

No database backup or downtime needed - all tables use `IF NOT EXISTS`.
