# SVL-SMS Deployment Checklist

**Pre-deployment, deployment, and post-deployment verification tasks**

---

## Pre-Deployment Checklist (5-7 days before)

### Code Preparation

- [ ] **Pull latest changes**
  ```bash
  git pull origin main
  git status
  ```

- [ ] **Update dependencies**
  ```bash
  npm update
  cd frontend && npm update && cd ..
  ```

- [ ] **Check for security vulnerabilities**
  ```bash
  npm audit
  cd frontend && npm audit && cd ..
  ```

- [ ] **Run linting**
  ```bash
  npm run lint
  ```

- [ ] **Build and test locally**
  ```bash
  npm run build
  npm test
  cd frontend && npm run build && cd ..
  ```

- [ ] **Review code changes since last deployment**
  ```bash
  git log --oneline -20
  git diff main...HEAD
  ```

### Documentation Review

- [ ] **Review DEPLOYMENT.md**
- [ ] **Check .env.example for accuracy**
- [ ] **Verify render.yaml is up-to-date**
- [ ] **Review GitHub Actions workflow**

### Team Preparation

- [ ] **Notify team of deployment plan**
- [ ] **Schedule deployment window (if needed)**
- [ ] **Assign deployment lead**
- [ ] **Assign backup/rollback lead**
- [ ] **Brief team on changes**

### Environment Preparation

- [ ] **Verify Render account is active**
- [ ] **Confirm team access to Render**
- [ ] **Check Render service quotas**
- [ ] **Verify GitHub integration is working**

---

## Database Preparation

### Backup Current Database

- [ ] **Create full backup**
  ```bash
  # Via Render Dashboard:
  # 1. Go to Backend Service
  # 2. Click "Disks"
  # 3. Download current database
  
  # Or via CLI:
  curl -H "Authorization: Bearer $RENDER_API_KEY" \
    https://api.render.com/v1/services/$SERVICE_ID/files \
    > backup_$(date +%Y%m%d_%H%M%S).tar.gz
  ```

- [ ] **Store backup securely**
  - Upload to S3 or similar
  - Keep local copy
  - Document backup location
  - Test restore

- [ ] **Verify backup integrity**
  ```bash
  # Extract and verify
  tar -tzf backup_*.tar.gz | head -20
  ```

### Database Migration (if needed)

- [ ] **Review migration scripts**
  ```bash
  ls -la src/database/migrations/
  ```

- [ ] **Test migrations locally**
  ```bash
  npm run migrate:up
  npm run migrate:down
  npm run migrate:up
  ```

- [ ] **Document migration steps**
- [ ] **Create rollback procedure**

---

## Render Configuration

### Backend Service Setup

- [ ] **Backend service created and active**
  - Service name: `svl-sms-backend`
  - Runtime: Node
  - Region: Oregon (or appropriate region)
  - Plan: Standard or higher

- [ ] **Repository connected**
  ```bash
  # Verify in Dashboard:
  # Backend Service > Settings > GitHub
  # Should show: Connected to your-repo
  ```

- [ ] **Build command correct**
  ```
  npm install && npm run build
  ```

- [ ] **Start command correct**
  ```
  npm start
  ```

- [ ] **Health check configured**
  - Path: `/api/health`
  - Interval: 30s
  - Timeout: 3s

- [ ] **Disk attached for data**
  - Name: `svl-sms-data`
  - Size: 1-2 GB
  - Mount: `/opt/render/project/src/data`

### Frontend Service Setup

- [ ] **Frontend service created and active**
  - Service name: `svl-sms-frontend`
  - Type: Static Site
  - Region: Oregon (same as backend)
  - Plan: Standard or higher

- [ ] **Repository connected**
- [ ] **Build command correct**
  ```
  cd frontend && npm install && npm run build
  ```

- [ ] **Publish directory correct**
  ```
  frontend/dist
  ```

---

## Environment Variables

### Backend Environment Variables

- [ ] **NODE_ENV = production**
- [ ] **PORT = 10000**
- [ ] **JWT_SECRET = [generated]**
  ```bash
  # Verify:
  # ✓ Not "changeme"
  # ✓ 32+ characters
  # ✓ Securely generated
  # ✓ Cryptographically random
  ```

- [ ] **LICENSE_PRIVATE_KEY = [generated]**
  ```bash
  # Verify:
  # ✓ Valid private key format
  # ✓ Generated from tools/generate-license.js
  # ✓ Starts with -----BEGIN RSA PRIVATE KEY-----
  ```

- [ ] **CORS_ORIGINS = [production domains]**
  - `https://svl-sms-frontend.onrender.com`
  - `https://your-domain.com`
  - `https://www.your-domain.com` (if applicable)

- [ ] **FRONTEND_URL = [production frontend URL]**

- [ ] **DATABASE_URL = [if PostgreSQL]**

- [ ] **DB_PATH = ./data/svl-sms.db**

### Frontend Environment Variables

- [ ] **VITE_API_URL = https://svl-sms-backend.onrender.com/api**
  ```bash
  # Or custom domain:
  VITE_API_URL=https://api.your-domain.com/api
  ```

- [ ] **VITE_APP_NAME = SVL School Management System**
- [ ] **VITE_APP_VERSION = 1.0.0**

### Verification

- [ ] **All variables in Render Dashboard**
  ```bash
  # For each service:
  # 1. Go to Settings
  # 2. Click Environment
  # 3. Verify all variables present
  # 4. Verify no test/dev values
  # 5. Verify no secrets exposed
  ```

- [ ] **No hardcoded secrets in code**
  ```bash
  grep -r "JWT_SECRET\|changeme\|dev-secret" src/ frontend/src/
  # Should return: (no results)
  ```

---

## SSL/HTTPS Setup

### Custom Domain (if applicable)

- [ ] **Domain registered and active**
- [ ] **DNS records configured**
  ```dns
  Type: CNAME
  Name: api  (or your subdomain)
  Value: onrender.com  (provided by Render)
  TTL: 3600
  ```

- [ ] **DNS propagation verified**
  ```bash
  nslookup api.your-domain.com
  # Should resolve to Render IP
  ```

- [ ] **Custom domain added to services**
  - Backend: `api.your-domain.com`
  - Frontend: `app.your-domain.com` or `www.your-domain.com`

- [ ] **SSL certificate provisioned**
  - Render auto-provisions via Let's Encrypt
  - Wait 5-10 minutes for issuance
  - Check: `https://your-domain.com` in browser

### HTTPS Verification

- [ ] **Backend accessible via HTTPS**
  ```bash
  curl https://api.your-domain.com/api/health
  # Status: 200 OK
  ```

- [ ] **Frontend accessible via HTTPS**
  ```bash
  curl https://app.your-domain.com
  # Status: 200 OK
  ```

- [ ] **SSL certificate valid**
  ```bash
  openssl s_client -connect api.your-domain.com:443
  # Check: Not expired, valid CN
  ```

- [ ] **HSTS header present**
  ```bash
  curl -i https://api.your-domain.com/api/health
  # Should include: Strict-Transport-Security
  ```

---

## Monitoring & Logging

### Monitoring Setup

- [ ] **Monitoring enabled in Render**
  - Dashboard > Service > Metrics
  - View: CPU, Memory, Request Rate

- [ ] **Alerts configured**
  - High CPU (>80%)
  - High Memory (>80%)
  - Error rate (>1%)
  - Service down

- [ ] **Log collection enabled**
  - Dashboard > Service > Logs
  - Logs streaming in real-time

### External Monitoring (Optional)

- [ ] **Datadog/CloudWatch connected** (if applicable)
- [ ] **Uptime monitoring configured**
- [ ] **Error tracking enabled** (Sentry, etc.)

---

## Backup Configuration

### Database Backup

- [ ] **Automatic backups enabled**
  ```bash
  # Render backs up daily
  # Via Dashboard: Backend > Backups
  ```

- [ ] **Backup retention set**
  - Keep minimum 30 days
  - Test restore monthly

- [ ] **Backup verification script**
  ```bash
  ./.render.sh backup
  # Creates ./backups/svl-sms_TIMESTAMP.db
  ```

### File Backups

- [ ] **Data directory backed up**
  - `/opt/render/project/src/data`
  - Included in Render disk backup

- [ ] **Backup location documented**
  - S3 bucket or similar
  - Access credentials stored safely
  - Recovery procedure documented

---

## License Setup

### License Generation

- [ ] **License private key generated**
  ```bash
  node tools/generate-license.js
  ```

- [ ] **License stored securely**
  - Set as JWT_SECRET equivalent for license
  - Store in Render environment variable
  - Not committed to git

- [ ] **License validation tested**
  ```bash
  # Test invalid license handling
  ENABLE_LICENSE_VALIDATION=true npm start
  # Should enforce license validation
  ```

### License Documentation

- [ ] **License terms documented**
  - Expiration date (if applicable)
  - Seats/users allowed
  - Features enabled

- [ ] **License renewal process documented**
  - How often to renew
  - Who to contact
  - Renewal procedure

---

## Testing Verification

### Automated Tests

- [ ] **Unit tests passing**
  ```bash
  npm test
  ```

- [ ] **Integration tests passing**
  ```bash
  npm run test:integration
  ```

- [ ] **Build succeeds**
  ```bash
  npm run build
  cd frontend && npm run build && cd ..
  ```

### Manual Testing

- [ ] **Health endpoint working**
  ```bash
  curl https://svl-sms-backend.onrender.com/api/health
  # Expected: {"status":"ok"}
  ```

- [ ] **Authentication flow**
  - [ ] Login successful
  - [ ] Logout successful
  - [ ] Token refresh working
  - [ ] Session timeout working

- [ ] **User portals**
  - [ ] Admin dashboard accessible
  - [ ] Teacher portal accessible
  - [ ] Student portal accessible
  - [ ] Parent portal accessible

- [ ] **Core features**
  - [ ] Can view dashboard
  - [ ] Can view assignments
  - [ ] Can view grades
  - [ ] Can create/edit content
  - [ ] Can manage users (admin)

- [ ] **Database operations**
  - [ ] Can read from database
  - [ ] Can write to database
  - [ ] Can update records
  - [ ] Can delete records

- [ ] **File operations** (if applicable)
  - [ ] Can upload files
  - [ ] Can download files
  - [ ] File storage working

- [ ] **Error handling**
  - [ ] 404 errors handled
  - [ ] 500 errors handled
  - [ ] Validation errors handled
  - [ ] CORS errors handled

---

## Security Verification

### Secrets Verification

- [ ] **No secrets in source code**
  ```bash
  grep -r "password\|secret\|key" src/ frontend/src/ \
    --exclude-dir=node_modules | grep -v "\.example"
  # Should return: (no results)
  ```

- [ ] **No secrets in logs**
  ```bash
  # Check Render logs
  Dashboard > Logs
  # Search for: password, secret, token, key
  # Should find: none
  ```

- [ ] **Environment variables not exposed**
  ```bash
  # Check backend response headers
  curl -i https://api.your-domain.com/api/health
  # Should NOT include: JWT_SECRET, LICENSE_PRIVATE_KEY
  ```

### HTTPS/SSL Verification

- [ ] **All endpoints using HTTPS**
  ```bash
  # No HTTP access
  curl http://api.your-domain.com/api/health
  # Should redirect to HTTPS
  ```

- [ ] **CORS headers correct**
  ```bash
  curl -H "Origin: https://your-domain.com" \
    https://api.your-domain.com/api/health
  # Should include: Access-Control-Allow-Origin
  ```

- [ ] **Security headers present**
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: SAMEORIGIN
  - Strict-Transport-Security: max-age=...
  - Content-Security-Policy (if configured)

### Access Control Verification

- [ ] **Role-based access working**
  - Admin can access admin functions
  - Teachers can access teaching functions
  - Students can access student functions
  - Parents can access parent functions

- [ ] **Unauthenticated access blocked**
  - No API access without token
  - No page access without login

---

## Post-Deployment Checklist (After Deployment)

### Immediate Verification (0-30 minutes)

- [ ] **Services running**
  ```bash
  # Check Render Dashboard
  # Backend: Status should be "Live"
  # Frontend: Status should be "Live"
  ```

- [ ] **Health check passing**
  ```bash
  curl https://api.your-domain.com/api/health
  ```

- [ ] **Logs showing normal operation**
  ```bash
  # Dashboard > Logs
  # Should show: "Server running", "Connected to database"
  # Should NOT show: ERROR, Exception, Crash
  ```

- [ ] **Frontend loading**
  ```bash
  # Navigate to https://app.your-domain.com
  # Page should load without errors
  ```

- [ ] **API responding**
  ```bash
  # Test endpoint
  curl https://api.your-domain.com/api/auth/status
  # Should return 200 or 401 (not 500)
  ```

### 30-Minute Testing

- [ ] **Login workflow**
  - Access login page
  - Enter credentials
  - Successful authentication
  - Dashboard displays correctly

- [ ] **Core features**
  - Navigate dashboard
  - View data
  - No JavaScript errors in console
  - No network errors

- [ ] **Database connectivity**
  - Data displays from database
  - Can perform CRUD operations
  - No database errors in logs

### 1-Hour Extended Testing

- [ ] **All user types**
  - Admin login and access
  - Teacher login and access
  - Student login and access
  - Parent login and access

- [ ] **All major features**
  - Assignments
  - Grades
  - Messages/Communications
  - User management (admin)
  - Reports/Analytics

- [ ] **Performance**
  - Page load time reasonable (<3s)
  - API response time acceptable (<1s)
  - No memory leaks
  - CPU usage normal

- [ ] **Error scenarios**
  - Invalid login handled
  - Expired session handled
  - Network error recovery
  - Error messages displayed

### 24-Hour Monitoring

- [ ] **System stability**
  - Services running continuously
  - No unexpected restarts
  - Memory usage stable
  - CPU usage normal

- [ ] **Log monitoring**
  - No ERROR level logs
  - Minimal WARNING logs
  - Info logs showing normal operation

- [ ] **Performance metrics**
  - CPU: <50% average
  - Memory: <70% average
  - Request latency: <1s avg
  - Error rate: <0.1%

- [ ] **Backup verification**
  ```bash
  ./.render.sh backup
  # Backup created successfully
  ```

---

## Rollback Checklist (If Issues Occur)

### Decision to Rollback

- [ ] **Issue severity assessed**
  - Critical: Immediate rollback
  - High: Rollback after troubleshooting (max 1 hour)
  - Medium: Monitor and decide after 4 hours
  - Low: Can wait for patch deployment

- [ ] **Team notified**
  - Notify all stakeholders
  - Document issue
  - Document rollback decision

### Rollback Execution

- [ ] **Database backup ready**
  ```bash
  ls -la ./backups/svl-sms_*.db
  ```

- [ ] **Previous deployment identified**
  ```bash
  # Via Render Dashboard > Deploys
  # Select previous successful deploy
  ```

- [ ] **Rollback initiated**
  ```bash
  # Via Render Dashboard:
  # 1. Go to Backend Service
  # 2. Click "Deploys"
  # 3. Select previous deployment
  # 4. Click "Redeploy"
  ```

- [ ] **Database restored** (if needed)
  ```bash
  ./.render.sh rollback
  ```

- [ ] **Verification after rollback**
  - [ ] Services running
  - [ ] Health check passing
  - [ ] Login working
  - [ ] Data accessible

- [ ] **Communication**
  - [ ] Users notified of rollback
  - [ ] ETA for resolution provided
  - [ ] Ticket created for root cause analysis

---

## Post-Rollback Checklist

- [ ] **Root cause analysis**
  - What went wrong?
  - Why wasn't it caught in testing?
  - How to prevent in future?

- [ ] **Fix developed and tested**
  - New code written
  - Local testing completed
  - Code review approved

- [ ] **Redeploy with fix**
  - Tag release
  - Push to main
  - Trigger deployment
  - Verify fix works

- [ ] **Post-incident review**
  - Team meeting held
  - Documentation updated
  - Process improvements identified
  - Training scheduled if needed

---

## Ongoing Maintenance Checklist (Weekly)

- [ ] **Monitor logs**
  - Review error logs
  - Check for patterns
  - Address recurring issues

- [ ] **Performance review**
  - Check CPU/Memory trends
  - Identify optimization opportunities
  - Scale if needed

- [ ] **Security updates**
  - Check for npm package updates
  - Review security advisories
  - Plan updates

- [ ] **Backup verification**
  - Test backup restoration
  - Verify backup integrity
  - Update backup retention

- [ ] **Database optimization**
  - Review query performance
  - Check database size
  - Optimize if needed

---

## Sign-Off

**Deployment Lead:**
- Name: ___________________
- Date: ___________________
- Signature: ___________________

**Approval:**
- Name: ___________________
- Title: ___________________
- Date: ___________________

---

## Incident Contact Information

**On-Call Engineer:**
- Phone: ___________________
- Email: ___________________
- Slack: ___________________

**Escalation:**
- Name: ___________________
- Phone: ___________________
- Email: ___________________

**Emergency Contacts:**
- Server Provider: Render Support (support.render.com)
- DNS Provider: ___________________
- Domain Registrar: ___________________

---

## Deployment Notes

**Date:** _________________
**Version:** _________________
**Changes:** 
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Issues/Decisions:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Post-Deployment Status:**
✓ Success / ✗ Failure / ⚠ Partial

**Lessons Learned:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

**Last Updated**: 2026-08-06
**Version**: 1.0.0
**Status**: Complete Deployment Checklist
