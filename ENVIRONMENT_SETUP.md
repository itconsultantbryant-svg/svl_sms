# SVL-SMS Environment Setup Guide

**Complete guide for configuring all environment variables and secrets**

---

## Table of Contents

1. [Overview](#overview)
2. [Development Environment](#development-environment)
3. [Staging Environment](#staging-environment)
4. [Production Environment](#production-environment)
5. [Generating Secrets](#generating-secrets)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Backend Configuration](#backend-configuration)
8. [Frontend Configuration](#frontend-configuration)
9. [Database Configuration](#database-configuration)
10. [Security Configuration](#security-configuration)
11. [Feature Flags](#feature-flags)
12. [Render-Specific Setup](#render-specific-setup)
13. [CI/CD Configuration](#cicd-configuration)
14. [Troubleshooting](#troubleshooting)

---

## Overview

Environment configuration in SVL-SMS is managed through:

1. **.env files** - Local configuration (never commit)
2. **Render Environment Variables** - Production configuration
3. **GitHub Secrets** - CI/CD credentials
4. **.env.example** - Template for all variables

### Environment Files

```
Development:    .env.local, .env
Staging:        .env.staging
Production:     .env.production (Render manages)
```

### Configuration Priority

1. Environment variables (highest)
2. .env file
3. Default values in code (lowest)

---

## Development Environment

### Setup Steps

1. **Copy environment template:**
```bash
cp .env.example .env.local
```

2. **Edit .env.local:**
```bash
# Backend
NODE_ENV=development
PORT=3001

# Database
DB_PATH=./data/svl-sms.db

# JWT Secret (use development value)
JWT_SECRET=dev-secret-key-very-insecure-for-development-only

# License
LICENSE_PRIVATE_KEY=dev-key-insecure-for-dev-only

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:3001/api
```

3. **Install dependencies:**
```bash
npm install
cd frontend && npm install && cd ..
```

4. **Generate dev database:**
```bash
# Run backend once to create database
npm run dev
# Press Ctrl+C after seeing "Server running"
```

5. **Run development servers:**
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Development Tools

**Database Browser:**
```bash
# Install SQLite viewer
npm install -g sqlite3

# Inspect database
sqlite3 ./data/svl-sms.db
sqlite> .tables
sqlite> SELECT * FROM users;
sqlite> .quit
```

**API Testing:**
```bash
# Using curl
curl -X GET http://localhost:3001/api/health

# Or use Postman
# Import collection from docs/postman-collection.json
```

**Debug Mode:**
```bash
# Enable detailed logging
DEBUG=* npm run dev

# Or for specific module
DEBUG=svl-sms:* npm run dev
```

---

## Staging Environment

### Setup Steps

1. **Create .env.staging:**
```bash
# Server
NODE_ENV=staging
PORT=10000

# Database (separate from production)
DB_PATH=./data/svl-sms-staging.db

# JWT Secret (generate new)
JWT_SECRET=$(openssl rand -base64 32)

# License
LICENSE_PRIVATE_KEY=staging-license-key

# CORS (staging domain)
CORS_ORIGINS=https://staging-frontend.onrender.com,https://staging.your-domain.com

# Frontend
VITE_API_URL=https://staging-backend.onrender.com/api
```

2. **Generate secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate LICENSE_PRIVATE_KEY
node tools/generate-license.js --env staging
```

3. **Deploy to Render:**
```bash
# Push staging branch
git checkout -b staging
git push origin staging

# Create Render service for staging
# Repeat Render setup for staging environment
```

4. **Test staging deployment:**
```bash
curl https://staging-backend.onrender.com/api/health
```

### Staging Checklist

- [ ] Separate database from production
- [ ] Different JWT_SECRET than production
- [ ] Different CORS_ORIGINS
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Test critical flows
- [ ] Load testing completed

---

## Production Environment

### Pre-Production Checklist

- [ ] All dependencies updated
- [ ] Security audit completed
- [ ] Performance testing passed
- [ ] Backup strategy tested
- [ ] Monitoring configured
- [ ] SSL certificates ready
- [ ] Domain configured
- [ ] Team trained

### Production Environment Variables

```bash
# Backend Configuration
NODE_ENV=production
PORT=10000

# Database (PostgreSQL for production recommended)
DATABASE_URL=postgresql://user:password@host:5432/svl_sms
DB_PATH=./data/svl-sms.db

# Security (MUST BE GENERATED)
JWT_SECRET=<securely-generated-32-char-base64>
LICENSE_PRIVATE_KEY=<securely-generated-key>

# CORS (Production domains only)
CORS_ORIGINS=https://svl-sms-frontend.onrender.com,https://www.your-domain.com
FRONTEND_URL=https://svl-sms-frontend.onrender.com

# Frontend
VITE_API_URL=https://svl-sms-backend.onrender.com/api
VITE_APP_NAME=SVL School Management System
VITE_APP_VERSION=1.0.0

# Logging
LOG_LEVEL=warn
DEBUG=false

# Feature Flags
DEMO_MODE=false
ENABLE_LICENSE_VALIDATION=true
ENABLE_RBAC=true
```

### Production Setup on Render

1. **Go to Render Dashboard**
2. **Select backend service**
3. **Click Environment**
4. **Add each variable** (never expose in logs)
5. **Trigger deploy**

---

## Generating Secrets

### JWT_SECRET

Generate a cryptographically secure random token:

```bash
# Using OpenSSL (recommended)
openssl rand -base64 32

# Output example:
# 9XC7+/qS5K2mL8N3oR4pT5uW6vX7yZ8aB9cD0eF1gH2iJ3kL4m

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Requirements:**
- Minimum 32 characters
- Cryptographically random
- No special characters problematic in URLs
- Store securely (never commit)

### LICENSE_PRIVATE_KEY

Generate license private key:

```bash
# Run license generator
node tools/generate-license.js

# Follow prompts:
# 1. Enter organization name
# 2. Enter license type (commercial/educational)
# 3. Confirm generation

# Output: Private key stored in tools/keys/private.key
```

**Private Key Format:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA... (base64 encoded)
-----END RSA PRIVATE KEY-----
```

**Securing the Key:**
- Store in environment variable (Render)
- Never commit to git
- Use GitHub Secrets for CI/CD
- Rotate periodically (6-12 months)

### Database Password (if using PostgreSQL)

```bash
# Generate strong password
openssl rand -base64 24

# Or use password generator
# https://www.random.org/passwords/
```

**Criteria:**
- Minimum 16 characters
- Mix of upper, lower, numbers, symbols
- No dictionary words
- Unique per environment

---

## Environment Variables Reference

### Backend Variables

| Variable | Environment | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | All | `production` | Yes |
| `PORT` | All | `10000` | Yes |
| `JWT_SECRET` | All | Base64 string | Yes |
| `LICENSE_PRIVATE_KEY` | All | Private key | Yes |
| `DB_PATH` | All | `./data/svl-sms.db` | Yes |
| `DATABASE_URL` | Prod | Connection string | If PostgreSQL |
| `CORS_ORIGINS` | All | Domain list | Yes |
| `FRONTEND_URL` | All | Frontend URL | Yes |
| `RENDER_EXTERNAL_URL` | Render | Auto-set | No |
| `DEBUG` | Dev/Staging | `false` | No |
| `LOG_LEVEL` | All | `info` | No |

### Frontend Variables

| Variable | Environment | Example | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | All | Backend URL | Yes |
| `VITE_APP_NAME` | All | App name | Yes |
| `VITE_APP_VERSION` | All | Version | Yes |
| `VITE_DEBUG` | Dev | `true` | No |

---

## Backend Configuration

### Port Configuration

```typescript
// src/index.ts
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### CORS Configuration

```typescript
// src/middleware/cors.ts
import cors from 'cors';

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
}));
```

Example values:
```
Development: http://localhost:5173,http://localhost:3000
Staging: https://staging-frontend.onrender.com,https://staging.your-domain.com
Production: https://svl-sms-frontend.onrender.com,https://www.your-domain.com
```

### Database Configuration

```typescript
// src/database/index.ts
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || './data/svl-sms.db';
export const db = new Database(dbPath);
```

### JWT Configuration

```typescript
// src/middleware/auth.ts
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable not set');
}

export const generateToken = (payload: object) => {
  return jwt.sign(payload, secret, { expiresIn: '24h' });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, secret);
};
```

---

## Frontend Configuration

### API URL Configuration

```typescript
// frontend/src/config/api.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});
```

### App Metadata

```typescript
// frontend/src/config/app.ts
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'SVL SMS',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
};
```

### Environment Detection

```typescript
// frontend/src/config/env.ts
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Usage
if (isDevelopment) {
  // Dev-only code
}
```

---

## Database Configuration

### SQLite Setup (Development)

```bash
# No setup needed, automatically created
# Database file: ./data/svl-sms.db

# View database
sqlite3 ./data/svl-sms.db

# Backup
cp ./data/svl-sms.db ./data/svl-sms.backup.db
```

### SQLite Setup (Production on Render)

Render manages SQLite database:
- File location: `/opt/render/project/src/data/svl-sms.db`
- Disk attached: `svl-sms-data` (1-2 GB)
- Auto-backups: Daily
- Accessible via: `DB_PATH` environment variable

### PostgreSQL Setup (Recommended for Production)

1. **Create PostgreSQL on Render:**
```bash
# Via Dashboard:
# New + → PostgreSQL
# Name: svl_sms_db
# Region: Same as backend
```

2. **Connection String:**
```
postgres://username:password@service-name.onrender.com:5432/svl_sms_db
```

3. **Environment Variable:**
```bash
DATABASE_URL=postgres://user:pass@host:5432/database
```

4. **Connect with better-sqlite3 migration:**
```typescript
// tools/migrate-sqlite-to-postgres.ts
import Database from 'better-sqlite3';
import { Pool } from 'pg';

const sqlite = new Database('./data/svl-sms.db');
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Migrate data...
```

---

## Security Configuration

### Secure Defaults

```typescript
// src/middleware/security.ts
import helmet from 'helmet';

// HTTPS headers
app.use(helmet());

// HSTS (HTTP Strict Transport Security)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains');
  next();
});

// Prevent clickjacking
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Prevent MIME sniffing
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// XSS Protection
app.use((req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

### Secrets in Render

Never expose secrets in logs:

```typescript
// Good - doesn't log secrets
console.log(`Using database: ${process.env.DB_PATH}`);

// Bad - logs the secret
console.log(`Database URL: ${process.env.DATABASE_URL}`);
```

### Rotating Secrets

1. **Generate new secret:**
```bash
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo $NEW_JWT_SECRET
```

2. **Update on Render:**
- Go to Environment
- Update JWT_SECRET
- Trigger deploy (allows grace period for token validation)

3. **Verify:**
```bash
# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

---

## Feature Flags

### Demo Mode

Allows testing without full license:

```bash
DEMO_MODE=true  # Development/Testing
DEMO_MODE=false # Production
```

```typescript
// src/middleware/demo.ts
if (process.env.DEMO_MODE === 'true') {
  // Allow demo login
  app.post('/api/auth/demo', (req, res) => {
    const token = generateToken({ 
      role: 'admin', 
      isDemoUser: true 
    });
    res.json({ token });
  });
}
```

### License Validation

```bash
ENABLE_LICENSE_VALIDATION=true   # Production
ENABLE_LICENSE_VALIDATION=false  # Development
```

```typescript
// src/middleware/license.ts
if (process.env.ENABLE_LICENSE_VALIDATION === 'true') {
  const isValid = validateLicense(process.env.LICENSE_PRIVATE_KEY);
  if (!isValid) {
    throw new Error('Invalid license');
  }
}
```

### RBAC (Role-Based Access Control)

```bash
ENABLE_RBAC=true  # Enable role-based permissions
```

---

## Render-Specific Setup

### Environment Variables on Render

1. **Backend Service:**
```
Go to: Dashboard > Backend Service > Environment

Add Variables:
NODE_ENV=production
PORT=10000
JWT_SECRET=<generated-value>
LICENSE_PRIVATE_KEY=<generated-value>
CORS_ORIGINS=https://svl-sms-frontend.onrender.com
FRONTEND_URL=https://svl-sms-frontend.onrender.com
VITE_API_URL=https://svl-sms-backend.onrender.com/api
```

2. **Frontend Service:**
```
Go to: Dashboard > Frontend Service > Environment

Add Variables:
VITE_API_URL=https://svl-sms-backend.onrender.com/api
VITE_APP_NAME=SVL School Management System
VITE_APP_VERSION=1.0.0
```

### Database Environment Variables

Render provides:
- `DATABASE_URL` (if using PostgreSQL)
- Auto-set for database connections

### Auto-Deploy on Push

Render reads environment variables from:
1. render.yaml (default values)
2. Render Dashboard (overrides)
3. GitHub push (triggers deploy)

---

## CI/CD Configuration

### GitHub Secrets

Set in: Settings > Secrets and variables > Actions

```
RENDER_API_KEY=<api-key-from-render>
RENDER_SERVICE_ID_BACKEND=srv_xxxxx
RENDER_SERVICE_ID_FRONTEND=srv_xxxxx
```

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
env:
  NODE_ENV: production
  PORT: 10000

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          npm run build
          npm test
```

### Secure Secrets in Workflows

```yaml
# Correct - secrets are masked in logs
- name: Deploy
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
  run: npm start

# Incorrect - logs the value
- name: Print Secret
  run: echo "Secret is ${{ secrets.JWT_SECRET }}"
```

---

## Troubleshooting

### Environment Variable Not Loading

**Issue**: `process.env.JWT_SECRET` is undefined

**Solution:**
```bash
# 1. Verify .env file exists
ls -la .env

# 2. Check variable is set
grep JWT_SECRET .env

# 3. Restart development server
npm run dev

# 4. Check Render Dashboard if in production
Dashboard > Environment > Verify variable exists
```

### Port Already in Use

**Issue**: Port 3001 (or 10000) already in use

**Solution:**
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm run dev
```

### CORS Errors

**Issue**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution:**
```bash
# Check CORS_ORIGINS includes frontend domain
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Verify frontend is hitting correct API URL
VITE_API_URL=http://localhost:3001/api

# Restart both servers
npm run dev  # Backend
cd frontend && npm run dev  # Frontend
```

### Database Connection Error

**Issue**: `Cannot read data from database`

**Solution:**
```bash
# Check database path
ls -la ./data/svl-sms.db

# Create data directory if needed
mkdir -p ./data

# Reset database
rm ./data/svl-sms.db
npm run dev  # Recreates on start

# Check permissions
chmod 755 ./data
chmod 644 ./data/svl-sms.db
```

### Authentication Failing

**Issue**: Login returns 401 Unauthorized

**Solution:**
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check token format
curl -X GET http://localhost:3001/api/auth/status \
  -H "Authorization: Bearer $TOKEN"

# Regenerate token
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({id: 1}, process.env.JWT_SECRET, {expiresIn: '24h'});
console.log(token);
"
```

### Production Deployment Issues

**Issue**: Service not starting on Render

**Solution:**
1. Check Render logs: Dashboard > Logs
2. Verify environment variables set
3. Test build locally:
   ```bash
   npm install
   npm run build
   npm start
   ```
4. Check for hardcoded ports or environment assumptions
5. Enable debug logging temporarily

---

## Environment Setup Checklist

### Local Development

- [ ] Copy .env.example to .env.local
- [ ] Set NODE_ENV=development
- [ ] Set PORT=3001 (or available port)
- [ ] Generate development JWT_SECRET
- [ ] Set DB_PATH=./data/svl-sms.db
- [ ] Set CORS_ORIGINS for local development
- [ ] Install dependencies
- [ ] Create data directory
- [ ] Test with `npm run dev`

### Staging Environment

- [ ] Create separate .env.staging file
- [ ] Generate new JWT_SECRET
- [ ] Generate new LICENSE_PRIVATE_KEY
- [ ] Configure staging database
- [ ] Set CORS_ORIGINS to staging domain
- [ ] Deploy to Render staging branch
- [ ] Configure monitoring
- [ ] Run full test suite
- [ ] Backup strategy tested

### Production Environment

- [ ] Render account and services created
- [ ] Environment variables configured on Render
- [ ] JWT_SECRET generated and set
- [ ] LICENSE_PRIVATE_KEY generated and set
- [ ] Database configured (PostgreSQL recommended)
- [ ] Daily backups configured
- [ ] Monitoring and alerts enabled
- [ ] SSL/HTTPS certificate valid
- [ ] Custom domain configured
- [ ] CORS_ORIGINS set to production domain(s)
- [ ] Health check passing
- [ ] Database tested and working
- [ ] Authentication flows tested
- [ ] Logs being collected
- [ ] Performance acceptable

---

**Last Updated**: 2026-08-06
**Version**: 1.0.0
**Status**: Complete Environment Setup
