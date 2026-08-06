# SVL-SMS Deployment Guide

Comprehensive guide for deploying SVL-SMS components to production environments.

## Table of Contents

1. [Backend Deployment](#backend-deployment)
2. [Frontend Deployment](#frontend-deployment)
3. [Electron Desktop App](#electron-desktop-app)
4. [Docker Setup](#docker-setup)
5. [Environment Configuration](#environment-configuration)
6. [Database Management](#database-management)
7. [Auto-Updates](#auto-updates)
8. [Monitoring & Logging](#monitoring--logging)
9. [Testing Checklist](#testing-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Backend Deployment

### Option 1: Render.com (Recommended)

#### Setup Steps

1. **Create Render Account**
   - Go to render.com
   - Sign up with GitHub account

2. **Connect Repository**
   - New → Web Service
   - Select SVL-SMS repository
   - Choose main branch

3. **Configure Service**

   ```yaml
   Name: svl-sms-backend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Environment: production
   Region: Auto
   ```

4. **Set Environment Variables**

   Click "Environment" and add:

   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=<your-production-secret>
   DB_PATH=/var/data/svl-sms.db
   CORS_ORIGINS=https://your-frontend.vercel.app,https://app.your-domain.com
   FRONTEND_URL=https://your-frontend.vercel.app
   ```

5. **Connect Database**

   - Under "Disks", add:
     - Mount Path: `/var/data`
     - Name: `svl-sms-db`
     - Size: 10GB

6. **Deploy**

   - Click "Create Web Service"
   - Render auto-deploys on GitHub push to main

#### Render Features

- ✅ Auto-deploys on git push
- ✅ SSL/TLS included
- ✅ Persistent storage
- ✅ Environment variables
- ✅ Easy scaling
- ✅ Free tier available

#### Verify Deployment

```bash
# Check health endpoint
curl https://your-backend.onrender.com/api/health

# Should return:
# {
#   "status": "ok",
#   "timestamp": "2024-08-06T...",
#   "uptime": 1234,
#   "environment": "production"
# }
```

### Option 2: Traditional VPS/Bare Metal

#### Prerequisites

- Ubuntu 22.04 LTS
- Node.js 20.x
- SQLite 3
- nginx reverse proxy
- systemd service manager

#### Installation

1. **SSH into server**

   ```bash
   ssh user@your-server.com
   ```

2. **Install Dependencies**

   ```bash
   sudo apt update
   sudo apt install -y nodejs npm postgresql sqlite3 nginx
   node --version  # Should be v20.x
   ```

3. **Clone Repository**

   ```bash
   cd /var/www
   sudo git clone https://github.com/your-org/svl-sms.git
   cd svl-sms
   sudo chown -R $USER:$USER .
   ```

4. **Install Dependencies**

   ```bash
   npm install
   npm run build
   ```

5. **Create Environment File**

   ```bash
   sudo nano .env
   ```

   ```env
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=your-super-secret-key-min-32-chars
   DB_PATH=/var/lib/svl-sms/svl-sms.db
   CORS_ORIGINS=https://app.your-domain.com
   FRONTEND_URL=https://app.your-domain.com
   ```

6. **Create Data Directory**

   ```bash
   sudo mkdir -p /var/lib/svl-sms
   sudo chown nobody:nogroup /var/lib/svl-sms
   ```

7. **Create Systemd Service**

   ```bash
   sudo nano /etc/systemd/system/svl-sms-backend.service
   ```

   ```ini
   [Unit]
   Description=SVL-SMS Backend
   After=network.target

   [Service]
   Type=simple
   User=nobody
   WorkingDirectory=/var/www/svl-sms
   Environment="NODE_ENV=production"
   Environment="PORT=3001"
   ExecStart=/usr/bin/node /var/www/svl-sms/dist/index.js
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

8. **Enable Service**

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable svl-sms-backend
   sudo systemctl start svl-sms-backend
   sudo systemctl status svl-sms-backend
   ```

9. **Configure nginx Reverse Proxy**

   ```bash
   sudo nano /etc/nginx/sites-available/svl-sms
   ```

   ```nginx
   upstream svl_sms_backend {
     server localhost:3001;
   }

   server {
     listen 80;
     server_name api.your-domain.com;
     return 301 https://$server_name$request_uri;
   }

   server {
     listen 443 ssl http2;
     server_name api.your-domain.com;

     ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

     location / {
       proxy_pass http://svl_sms_backend;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```

10. **Enable Site & Get SSL Certificate**

    ```bash
    sudo ln -s /etc/nginx/sites-available/svl-sms /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx

    # Install certbot
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d api.your-domain.com
    ```

11. **View Logs**

    ```bash
    # System logs
    sudo journalctl -u svl-sms-backend -f

    # Application logs
    tail -f /var/www/svl-sms/logs/*.log
    ```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### Setup

1. **Push to GitHub**

   ```bash
   git push origin main
   ```

2. **Connect to Vercel**

   - Go to vercel.com
   - Click "New Project"
   - Select SVL-SMS repository

3. **Configure Build**

   ```
   Framework: Vite
   Build Command: cd frontend && npm run build
   Output Directory: frontend/dist
   ```

4. **Environment Variables**

   ```
   VITE_API_URL=https://api.your-domain.com/api
   ```

5. **Deploy**

   - Click "Deploy"
   - Vercel auto-deploys on every git push

#### Verify

```bash
curl https://your-frontend.vercel.app
```

### Option 2: Netlify

1. **Connect Repository**
   - netlify.com → New site from Git
   - Select SVL-SMS repo

2. **Build Settings**

   ```
   Build Command: cd frontend && npm run build
   Publish Directory: frontend/dist
   ```

3. **Environment Variables**

   ```
   VITE_API_URL=https://api.your-domain.com/api
   ```

4. **Deploy** — Auto-deploys on git push

---

## Electron Desktop App

### Build & Release Process

1. **Tag Release**

   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Build Installers**

   ```bash
   npm run electron-build:all
   ```

3. **Create GitHub Release**

   - Go to GitHub → Releases
   - Click "Create a new release"
   - Select your tag (v1.0.0)
   - Upload installers from `out/` directory:
     - `SVL-SMS-1.0.0.exe`
     - `SVL-SMS-1.0.0-portable.exe`
     - `SVL-SMS-1.0.0.dmg`
     - `SVL-SMS-1.0.0.zip`
     - `SVL-SMS-1.0.0.AppImage`

4. **Publish Release**

   - Write release notes
   - Click "Publish release"

5. **Auto-Update**

   - Users get notified within 24 hours
   - One-click update to new version

### CI/CD with GitHub Actions

Create `.github/workflows/electron-build.yml`:

```yaml
name: Build Electron App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build Electron
        run: npm run electron-build

      - name: Upload artifacts
        uses: softprops/action-gh-release@v1
        with:
          files: |
            out/SVL-SMS-*.exe
            out/SVL-SMS-*.dmg
            out/SVL-SMS-*.zip
            out/SVL-SMS-*.AppImage
```

---

## Docker Setup

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      JWT_SECRET: ${JWT_SECRET}
      DB_PATH: /data/svl-sms.db
      CORS_ORIGINS: http://frontend:3000,http://localhost:3000
    volumes:
      - ./data:/data
    depends_on:
      - frontend

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://backend:3001/api
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
```

### Backend Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start
CMD ["npm", "start"]
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Remove volumes (clean slate)
docker-compose down -v
```

---

## Environment Configuration

### Production Environment Variables

#### Backend (.env)

```env
# Server
NODE_ENV=production
PORT=3001

# Security
JWT_SECRET=your-32+-character-production-secret-key
JWT_EXPIRY=7d

# Database
DB_PATH=/var/lib/svl-sms/svl-sms.db

# CORS
CORS_ORIGINS=https://app.your-domain.com,https://www.your-domain.com

# Frontend URL
FRONTEND_URL=https://app.your-domain.com

# Optional: Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Optional: S3 (for file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=svl-sms-files
```

#### Frontend (Vercel/Netlify)

```
VITE_API_URL=https://api.your-domain.com/api
```

#### Electron (.env)

```env
VITE_API_URL=http://localhost:3001/api
ELECTRON_BACKEND_PORT=3001
ELECTRON_ENABLE_DEBUG=false
```

### Secure Secrets Management

1. **Never commit secrets to git**
   - Use `.env.local` for local development
   - Use platform-specific secret managers for production

2. **Render Secrets**
   - Dashboard → Environment → Add from file
   - Paste `.env` contents

3. **Vercel Secrets**
   - Dashboard → Settings → Environment Variables
   - Add each variable separately

4. **Systemd Secrets**
   - Create `/etc/default/svl-sms-backend`
   - Source in systemd service file

---

## Database Management

### Backup Strategy

#### Automated Daily Backup

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/var/backups/svl-sms"
DB_PATH="/var/lib/svl-sms/svl-sms.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/svl-sms_$DATE.db.gz"

mkdir -p $BACKUP_DIR

# Create backup
sqlite3 $DB_PATH ".backup /tmp/svl-sms_backup_$DATE.db"

# Compress
gzip /tmp/svl-sms_backup_$DATE.db

# Move to backup directory
mv /tmp/svl-sms_backup_$DATE.db.gz $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.db.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE"
```

Add to crontab:

```bash
0 2 * * * /usr/local/bin/backup-db.sh
```

#### Manual Backup

```bash
# Backup
sqlite3 /var/lib/svl-sms/svl-sms.db ".backup /tmp/backup.db"
gzip /tmp/backup.db

# Restore
gunzip backup.db.gz
sqlite3 /var/lib/svl-sms/svl-sms.db ".restore /tmp/backup.db"
```

### Database Migrations

1. **Test Migrations**

   ```bash
   npm run dev
   # Test with fresh data
   ```

2. **Review Migration Script**

   ```bash
   cat src/database/init.ts
   ```

3. **Deploy Backend**

   - Render: Push to main (auto-deploys)
   - VPS: Push code, restart service

4. **Verify**

   ```bash
   curl https://api.your-domain.com/api/health
   ```

---

## Auto-Updates

### GitHub Releases Setup

1. **Create Personal Access Token**

   - GitHub → Settings → Developer settings → Personal access tokens
   - Select: `repo`, `read:user`, `user:email`

2. **Update electron/main.ts**

   ```typescript
   // Already configured to check GitHub releases
   const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
   ```

3. **Test Auto-Update Locally**

   ```bash
   # Set version to old one temporarily
   npm run electron-dev
   # Should show update notification after 5 seconds
   ```

### Manual Update Prompts

Users can also manually check:
- App Menu → Help → Check for Updates
- Restart app to apply

---

## Monitoring & Logging

### Application Logs

#### Backend Logs

```bash
# Render
# Dashboard → Logs

# VPS (systemd)
sudo journalctl -u svl-sms-backend -f

# Docker
docker-compose logs -f backend
```

#### Frontend Logs

- Browser Console (F12)
- Application tab → Local Storage
- Network tab for API calls

#### Electron Logs

Located at:
- **Windows**: `%APPDATA%\SVL-SMS\logs\`
- **macOS**: `~/Library/Application Support/SVL-SMS/logs/`
- **Linux**: `~/.config/SVL-SMS/logs/`

### Monitoring Stack

#### Option 1: Render Built-in

- Dashboard shows uptime, memory, CPU
- Alerts for failures
- Auto-restart on crash

#### Option 2: Uptime Monitoring

```bash
# Healthcheck endpoint
curl -f https://api.your-domain.com/api/health || \
  curl -X POST https://healthchecks.io/ping/unique-id
```

#### Option 3: ELK Stack (Advanced)

- Set up Elasticsearch
- Logstash ingests logs
- Kibana for visualization

### Error Tracking (Sentry)

1. **Install Sentry**

   ```bash
   npm install @sentry/node @sentry/tracing
   ```

2. **Setup in Backend** (`src/index.ts`)

   ```typescript
   import * as Sentry from "@sentry/node";

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0,
   });

   app.use(Sentry.Handlers.requestHandler());
   app.use(Sentry.Handlers.errorHandler());
   ```

3. **Setup in Frontend** (`frontend/src/main.tsx`)

   ```typescript
   import * as Sentry from "@sentry/react";

   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     integrations: [...],
   });
   ```

---

## Testing Checklist

### Pre-Deployment Testing

- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run build`
- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] Electron builds: `npm run electron-build`

### Manual Testing

- [ ] Login works
- [ ] Create student
- [ ] View dashboard
- [ ] Generate report
- [ ] Deep links work (Electron)
- [ ] File uploads work
- [ ] Database persists after restart

### Performance Testing

- [ ] API responds < 200ms for health check
- [ ] Page loads in < 3 seconds
- [ ] No memory leaks (check with DevTools)
- [ ] Can handle 100+ concurrent users

### Security Testing

- [ ] JWT validation works
- [ ] CORS properly configured
- [ ] No sensitive data in logs
- [ ] SQL injection tests pass
- [ ] XSS protection enabled

### Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

### Platform Testing (Electron)

- [ ] Windows 10/11
- [ ] macOS 11+
- [ ] Ubuntu 20.04 LTS+

---

## Troubleshooting

### Backend Issues

#### "Address already in use"

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm start
```

#### "CORS blocked"

Check backend `.env`:
```env
CORS_ORIGINS=https://your-frontend.domain.com
```

Restart backend after change.

#### "Database locked"

```bash
# Check SQLite connections
lsof | grep svl-sms.db

# Restart backend
sudo systemctl restart svl-sms-backend
```

### Frontend Issues

#### "API unreachable"

1. Check backend is running
2. Check `VITE_API_URL` environment variable
3. Check CORS headers in response
4. Check firewall rules

#### "Blank screen"

1. Open DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Check browser version compatibility

### Electron Issues

#### "Backend won't start"

```bash
# Check logs
cat ~/.svl-sms-electron/logs/main-*.log

# Try manual start
npm run dev
```

#### "Update check fails"

1. Check internet connection
2. Check GitHub API access
3. Verify repository exists and is public

---

## Rollback Procedure

### If Deployment Breaks

#### Render

1. Dashboard → Deployments
2. Click previous successful deployment
3. Click "Redeploy"

#### Vercel

1. Dashboard → Deployments
2. Click previous successful deployment
3. Click "Redeploy"

#### VPS

```bash
# SSH into server
ssh user@server.com

# Go to repo
cd /var/www/svl-sms

# Checkout previous version
git log --oneline
git checkout <previous-commit>

# Rebuild & restart
npm install
npm run build
sudo systemctl restart svl-sms-backend
```

---

## Support & Documentation

- **GitHub**: https://github.com/svl-sms/desktop
- **Documentation**: https://docs.svl-sms.com
- **Email**: support@svl-sms.com
- **Issues**: https://github.com/svl-sms/desktop/issues

## Next Steps

1. Choose deployment platform (Render recommended)
2. Set up DNS records
3. Configure SSL/TLS certificates
4. Set environment variables
5. Deploy and test
6. Monitor logs and errors
7. Configure auto-updates
8. Set up backups
