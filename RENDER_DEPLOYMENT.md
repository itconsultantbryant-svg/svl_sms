# SVL-SMS Render Deployment Guide

**Complete setup guide for deploying SVL-SMS to Render.com**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Account Setup](#account-setup)
3. [Repository Preparation](#repository-preparation)
4. [Render Configuration](#render-configuration)
5. [Database Setup](#database-setup)
6. [Environment Variables](#environment-variables)
7. [GitHub Integration](#github-integration)
8. [Custom Domain](#custom-domain)
9. [SSL/HTTPS](#ssl-https)
10. [Monitoring & Logs](#monitoring--logs)
11. [Scaling Configuration](#scaling-configuration)
12. [Backup Strategy](#backup-strategy)
13. [Troubleshooting](#troubleshooting)
14. [Performance Optimization](#performance-optimization)
15. [Security Checklist](#security-checklist)

---

## Prerequisites

Before deploying to Render, ensure you have:

- **Render Account**: Create free account at https://render.com
- **GitHub Account**: With access to the SVL-SMS repository
- **Domain (Optional)**: For custom domain setup
- **Git Knowledge**: Basic git commands and operations
- **Node.js 20+**: For local testing and development
- **OpenSSL**: For generating secure secrets

### Required Credentials

- Render API Key (generated in Render dashboard)
- GitHub personal access token
- Domain registrar credentials (if using custom domain)

---

## Account Setup

### 1. Create Render Account

1. Go to https://render.com
2. Click "Sign Up"
3. Choose preferred authentication method (GitHub recommended)
4. Complete email verification
5. Accept terms of service

### 2. Create Render Team (Optional)

For organizations, create a team:

1. Go to Account Settings
2. Click "Teams"
3. Click "Create a new team"
4. Add team members and set permissions

### 3. Generate API Key

For CI/CD integration:

1. Go to Account Settings → API Keys
2. Click "Create API Key"
3. Name it: `svl-sms-deployment`
4. Copy and store securely in GitHub Secrets

---

## Repository Preparation

### 1. Verify Repository Structure

Ensure these files exist in repository root:

```
/
├── render.yaml              # Render configuration
├── package.json             # Root package.json
├── tsconfig.json            # TypeScript config
├── src/                     # Backend source
├── dist/                    # Built backend (after build)
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   └── dist/                # Built frontend (after build)
├── .env.example             # Environment template
└── .github/workflows/
    └── deploy.yml           # CI/CD workflow
```

### 2. Update .gitignore

Ensure sensitive files are ignored:

```bash
# Environment files
.env
.env.local
.env.production.local

# Build output
dist/
build/
frontend/dist/

# Dependencies
node_modules/

# Database
*.db
data/

# Logs
*.log
logs/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

### 3. Verify Package Scripts

Backend package.json must have:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Frontend package.json must have:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 4. Test Local Build

```bash
# Backend
npm install
npm run build
npm start

# Frontend (in another terminal)
cd frontend
npm install
npm run build
npm preview
```

---

## Render Configuration

### 1. Create Backend Service

1. Go to https://dashboard.render.com
2. Click "New +"
3. Select "Web Service"
4. Configure:
   - **Name**: `svl-sms-backend`
   - **GitHub Repository**: Select your repo
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or `.` if needed)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Select appropriate tier
5. Click "Create Web Service"

### 2. Create Frontend Service

1. Click "New +"
2. Select "Static Site"
3. Configure:
   - **Name**: `svl-sms-frontend`
   - **GitHub Repository**: Select your repo
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Plan**: Select appropriate tier
4. Click "Create Static Site"

### 3. Update render.yaml

Render can automatically create services from `render.yaml`:

```bash
# Push to GitHub and Render will auto-detect render.yaml
git add render.yaml
git commit -m "Add Render deployment configuration"
git push origin main
```

---

## Database Setup

### SQLite Database (Default)

For SQLite (included in backend):

1. No additional setup needed
2. Database file stored in `/opt/render/project/src/data/`
3. Disk attached at service creation

### Using Render PostgreSQL (Optional)

For scalability, switch to PostgreSQL:

1. Go to Dashboard
2. Click "New +"
3. Select "PostgreSQL"
4. Configure:
   - **Name**: `svl_sms_postgres`
   - **Region**: Match backend region
   - **PostgreSQL Version**: 15
   - **Plan**: Select appropriate tier
5. Copy connection string
6. Update backend DATABASE_URL

### Migration from SQLite to PostgreSQL

```bash
# 1. Export SQLite data
npm install better-sqlite3

# 2. Create migration script
# tools/migrate-to-postgres.js

# 3. Run migration
node tools/migrate-to-postgres.js

# 4. Test connection
npm run build && npm start
```

### Database Disk Attachment

For persistent storage:

1. Go to Backend Service
2. Click "Disks"
3. Click "Attach Disk"
4. Configure:
   - **Name**: `svl-sms-data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: Start with 1GB, increase as needed
5. Restart service

---

## Environment Variables

### Backend Environment Variables

Go to Backend Service → Environment:

| Variable | Value | Type |
|----------|-------|------|
| `NODE_ENV` | `production` | Fixed |
| `PORT` | `10000` | Fixed |
| `JWT_SECRET` | Generate new value | Secret |
| `LICENSE_PRIVATE_KEY` | Generate new value | Secret |
| `CORS_ORIGINS` | `https://svl-sms-frontend.onrender.com` | Fixed |
| `FRONTEND_URL` | `https://svl-sms-frontend.onrender.com` | Fixed |
| `DATABASE_URL` | From database service | Database |
| `DB_PATH` | `./data/svl-sms.db` | Fixed |

### Frontend Environment Variables

Go to Frontend Service → Environment:

| Variable | Value | Type |
|----------|-------|------|
| `VITE_API_URL` | `https://svl-sms-backend.onrender.com/api` | Fixed |
| `VITE_APP_NAME` | `SVL School Management System` | Fixed |
| `VITE_APP_VERSION` | `1.0.0` | Fixed |

### Generating Secret Values

**JWT_SECRET:**
```bash
openssl rand -base64 32
# Output example: 9XC7+/qS5K2mL8N3oR4pT5uW6vX7yZ8aB9cD0eF1gH2iJ3kL4m
```

**LICENSE_PRIVATE_KEY:**
```bash
# Use the license generator from your project
node tools/generate-license.js
```

### Setting Environment Variables via CLI

```bash
# Via Render CLI (if installed)
render env set NODE_ENV production
render env set JWT_SECRET "generated_secret_here"

# Or via Dashboard:
# 1. Go to Service → Environment
# 2. Add variable
# 3. Click Save
```

---

## GitHub Integration

### 1. Connect GitHub Repository

1. Go to Render Dashboard
2. Click your service
3. Click "GitHub" in top menu
4. Authorize Render to access your GitHub account
5. Select repository

### 2. Configure Auto-Deploy

1. Go to Service Settings
2. Under "Deploys", select:
   - **Branch**: `main`
   - **Auto-Deploy**: `Yes`
3. Save settings

Any push to `main` will automatically trigger deployment.

### 3. Setup GitHub Actions

GitHub Actions will run tests and deploy:

```yaml
# .github/workflows/deploy.yml already created
# Configure these GitHub Secrets:

RENDER_API_KEY=<your-render-api-key>
RENDER_SERVICE_ID_BACKEND=<backend-service-id>
RENDER_SERVICE_ID_FRONTEND=<frontend-service-id>
```

To get service IDs:

```bash
# From URL when viewing service:
# https://dashboard.render.com/web/srv_xxxxxxxxxxxxx
# The part after "srv_" is your service ID
```

### 4. Configure Deploy Notifications

Optional: Setup GitHub deployment status:

1. Go to Service → Deploy Hooks
2. Create webhook for GitHub
3. GitHub will show deployment status on commits

---

## Custom Domain

### Using Root Domain (example.com)

1. Go to Frontend Service
2. Click "Settings"
3. Under "Custom Domain", click "Add Custom Domain"
4. Enter your domain: `example.com`
5. Render provides DNS instructions
6. Add DNS records to your registrar:

```dns
Type: CNAME
Name: @
Value: onrender.com (provided by Render)
TTL: 3600
```

### Using Subdomain (app.example.com)

1. Add custom domain: `app.example.com`
2. Add DNS record:

```dns
Type: CNAME
Name: app
Value: cname.onrender.com (provided by Render)
TTL: 3600
```

### Backend Custom Domain

1. Go to Backend Service
2. Click "Settings"
3. Add custom domain: `api.example.com`
4. Follow same DNS setup

### Verify DNS Propagation

```bash
# Check DNS propagation
nslookup app.example.com

# Or use online tool:
# https://mxtoolbox.com/

# Wait 24-48 hours for full propagation
```

### Update CORS_ORIGINS

Once domain is active, update environment variables:

**Backend service:**
```
CORS_ORIGINS=https://app.example.com,https://example.com
FRONTEND_URL=https://app.example.com
```

**Frontend service:**
```
VITE_API_URL=https://api.example.com/api
```

---

## SSL/HTTPS

### Automatic SSL/TLS

Render automatically provides SSL certificates for all services:

1. All `.onrender.com` domains have automatic SSL
2. Custom domains get SSL via Let's Encrypt
3. SSL is auto-renewed before expiration

### Verify SSL Certificate

```bash
# Check certificate
echo | openssl s_client -servername app.example.com -connect app.example.com:443

# Or use online tool:
# https://www.sslshopper.com/ssl-checker.html
```

### HSTS (HTTP Strict Transport Security)

Configure in backend middleware:

```typescript
// src/middleware/security.ts
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### HTTP to HTTPS Redirect

Render automatically redirects HTTP to HTTPS.

### SSL Pinning (Optional)

For mobile apps, implement certificate pinning:

```typescript
// Store certificate fingerprint
// Verify on each request
```

---

## Monitoring & Logs

### Access Logs

1. Go to Service
2. Click "Logs"
3. View real-time logs:
   - Build logs
   - Runtime logs
   - Error logs

### Tail Logs

```bash
# View backend logs
# Via Render Dashboard > Logs tab

# Or via SSH (if enabled):
ssh user@service.onrender.com tail -f logs/app.log
```

### Log Levels

Configure in backend:

```typescript
// src/utils/logger.ts
const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = {
  error: (msg: string) => console.error('[ERROR]', msg),
  warn: (msg: string) => console.warn('[WARN]', msg),
  info: (msg: string) => console.log('[INFO]', msg),
  debug: (msg: string) => process.env.DEBUG && console.log('[DEBUG]', msg),
};
```

### Monitoring Metrics

1. Go to Dashboard
2. View service metrics:
   - CPU usage
   - Memory usage
   - Request rate
   - Response time

### Setup Alerts

1. Go to Service
2. Click "Alerts"
3. Create alert:
   - Trigger: High CPU/Memory/Error Rate
   - Action: Email notification
   - Threshold: Set appropriate limits

### Integrate with External Monitoring

Send logs to external services:

```typescript
// winston, pino, or similar
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-datadog',
    options: {
      apiKey: process.env.DATADOG_API_KEY,
    },
  },
});
```

---

## Scaling Configuration

### Horizontal Scaling

#### Backend Service

1. Go to Backend Service
2. Click "Settings"
3. Under "Plan", select higher tier:
   - **Starter**: 0.5 CPU, 0.5 GB RAM
   - **Standard**: 1 CPU, 1 GB RAM
   - **Premium**: 2 CPU, 2 GB RAM

#### Frontend Service

1. Go to Frontend Service
2. Click "Settings"
3. Select higher plan (static sites have fewer options)

### Vertical Scaling (Adding Instances)

Render doesn't support multiple instances for SQLite.

For horizontal scaling with multiple backend instances:

1. Switch to PostgreSQL database
2. Configure load balancer
3. Deploy multiple backend instances

### Performance Optimization

**Backend:**
- Use connection pooling
- Implement caching (Redis, Memcached)
- Optimize database queries
- Compress responses (gzip)

**Frontend:**
- Code splitting
- Lazy loading
- Image optimization
- Service worker caching

### Database Optimization

```typescript
// Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_assignments_student ON assignments(student_id);

// Use prepared statements
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(userId);
```

---

## Backup Strategy

### Automated Backups

#### SQLite Database

1. Download backups daily:

```bash
# Via cron job or GitHub Actions
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/$SERVICE_ID/files/data/svl-sms.db \
  > backups/svl-sms_$(date +%Y%m%d).db
```

2. Store in GitHub (private repo or cloud storage):

```bash
# Upload to S3
aws s3 cp backups/svl-sms_*.db s3://your-bucket/backups/
```

#### PostgreSQL Database

Render provides automatic daily backups:

1. Go to Database Service
2. Click "Backups"
3. View backup history
4. Download backup as needed

### Manual Backup

**Download via CLI:**
```bash
# Via Render service console
ssh into service and download database file
```

**Backup Script:**
```bash
#!/bin/bash
# tools/backup-database.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_FILE="./data/svl-sms.db"

mkdir -p "$BACKUP_DIR"
cp "$DB_FILE" "$BACKUP_DIR/svl-sms_${TIMESTAMP}.db"

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR/svl-sms_${TIMESTAMP}.db" s3://your-bucket/backups/
```

### Restore from Backup

```bash
# 1. Download backup
aws s3 cp s3://your-bucket/backups/svl-sms_20240101_120000.db ./restore.db

# 2. Stop service
render api-post /services/srv_xxx/restart-instance

# 3. Restore database
cp ./restore.db ./data/svl-sms.db

# 4. Restart service
render api-post /services/srv_xxx/restart-instance
```

### Backup Retention

Keep minimum 3 months of backups:

```bash
# Delete backups older than 90 days
find ./backups -name "svl-sms_*.db" -mtime +90 -delete
```

### Backup Testing

Regularly test backup restoration:

1. Download backup
2. Restore to local instance
3. Verify data integrity
4. Test critical functions
5. Document any issues

---

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
# View logs in Render Dashboard
# Look for:
# - Build errors
# - Missing dependencies
# - Port conflicts
# - Environment variable issues
```

**Common issues:**

1. **Missing environment variables:**
   - Verify JWT_SECRET is set
   - Check CORS_ORIGINS format
   - Ensure NODE_ENV=production

2. **Build failures:**
   ```bash
   # Test local build
   npm install
   npm run build
   npm start
   ```

3. **Port conflicts:**
   - Ensure PORT is set to 10000 (Render default)
   - Check for hardcoded ports in code

### Database Connection Errors

**For SQLite:**
```typescript
// Verify path
console.log('DB Path:', process.env.DB_PATH);

// Check disk space
df -h /opt/render/project/src/data
```

**For PostgreSQL:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
# postgres://user:password@host:5432/database
```

### CORS Errors

**Common causes:**
- Frontend domain not in CORS_ORIGINS
- Incorrect API URL in frontend config

**Fix:**
```bash
# Update CORS_ORIGINS
# Example: https://app.example.com,https://www.example.com
```

### High CPU/Memory Usage

1. Check logs for infinite loops
2. Monitor database query performance
3. Review connected clients
4. Optimize code/queries
5. Scale service to higher tier

### Deployment Failures

1. Check GitHub Actions logs
2. Verify build command success
3. Check environment variables
4. Review recent code changes
5. Check disk space availability

### SSL Certificate Issues

```bash
# Verify certificate
openssl s_client -connect your-domain.onrender.com:443

# Common issues:
# - Domain not yet in DNS
# - Waiting for Let's Encrypt verification
# - Certificate not auto-renewing
```

---

## Performance Optimization

### Frontend Optimization

1. **Code Splitting:**
```typescript
// React lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

2. **Image Optimization:**
```html
<!-- Use optimized images -->
<img src="image.webp" alt="description" loading="lazy" />
```

3. **Caching:**
```typescript
// Cache-Control headers
app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});
```

### Backend Optimization

1. **Database Optimization:**
```typescript
// Add indexes
db.exec('CREATE INDEX idx_users_email ON users(email)');

// Use prepared statements
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
```

2. **Response Compression:**
```typescript
import compression from 'compression';
app.use(compression());
```

3. **Connection Pooling:**
```typescript
// Use connection pool for database
const pool = createPool({ min: 2, max: 10 });
```

### CDN Integration (Optional)

Use Cloudflare or similar for:
- Static asset caching
- DDoS protection
- WAF rules
- Analytics

---

## Security Checklist

### Pre-Deployment

- [ ] JWT_SECRET changed from default
- [ ] LICENSE_PRIVATE_KEY generated securely
- [ ] CORS_ORIGINS specified (not wildcards)
- [ ] HTTPS/SSL enabled
- [ ] No hardcoded secrets in code
- [ ] Environment variables validated
- [ ] Database backups configured
- [ ] Monitoring alerts enabled

### Post-Deployment

- [ ] Health check passing
- [ ] SSL certificate valid
- [ ] CORS working correctly
- [ ] Authentication functional
- [ ] Database accessible
- [ ] Logs being recorded
- [ ] Backups running
- [ ] Alerts configured

### Ongoing

- [ ] Regular security updates
- [ ] Dependency scanning
- [ ] Log monitoring
- [ ] Backup verification
- [ ] Access control review
- [ ] Database optimization
- [ ] Performance monitoring

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor logs for errors
- Check health endpoint
- Review backup status

**Weekly:**
- Review performance metrics
- Check for security updates
- Verify backup restoration

**Monthly:**
- Full security audit
- Database optimization
- Backup retention cleanup
- Cost review

### Updating

1. **Update backend:**
```bash
git commit -am "Update dependencies"
git push origin main
# Render auto-deploys
```

2. **Update frontend:**
```bash
cd frontend
npm update
cd ..
git commit -am "Update frontend dependencies"
git push origin main
```

3. **Update Render plan:**
- Via Dashboard
- Select higher tier if needed
- Restart instance

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **GitHub Integration**: https://github.com/apps/render
- **API Reference**: https://render.com/docs/api-reference
- **Community**: https://community.render.com
- **Support**: https://support.render.com

---

**Last Updated**: 2026-08-06
**Version**: 1.0.0
**Status**: Complete Deployment Guide
