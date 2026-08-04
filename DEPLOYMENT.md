# SVL-SMS Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Render account (for backend)

## Backend Deployment (Render)

### 1. Push to GitHub
```bash
cd /Users/user/Desktop/systems/SMS/backend
git init
git add .
git commit -m "Initial backend commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Render
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: svl-sms-backend
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for better performance)

### 3. Set Environment Variables
In Render dashboard, add these environment variables:
- `NODE_ENV`: production
- `JWT_SECRET`: (generate a strong random string)
- `CORS_ORIGINS`: https://your-frontend.vercel.app
- `FRONTEND_URL`: https://your-frontend.vercel.app
- `PORT`: 3001

### 4. Add Persistent Disk
- Go to "Disks" tab
- Click "Add Disk"
- **Name**: svl-sms-data
- **Mount Path**: /opt/render/project/src/data
- **Size**: 1 GB

### 5. Get Backend URL
After deployment, note your backend URL (e.g., `https://svl-sms-backend.onrender.com`)

## Frontend Deployment (Vercel)

### 1. Push to GitHub
```bash
cd /Users/user/Desktop/systems/SMS/frontend
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to https://vercel.com
2. Click "New Project"
3. Import your frontend GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: dist

### 3. Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:
- `VITE_API_URL`: https://your-backend.onrender.com/api

### 4. Deploy
Click "Deploy" and wait for completion.

### 5. Update Backend CORS
Go back to Render and update `CORS_ORIGINS` with your Vercel domain:
```
CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

## Post-Deployment

### 1. Test the Application
- Visit your Vercel URL
- Login with default credentials:
  - Username: admin
  - Password: admin123

### 2. Security Checklist
- [ ] Change default admin password
- [ ] Set strong JWT_SECRET
- [ ] Configure custom domain
- [ ] Enable HTTPS (automatic on Vercel/Render)
- [ ] Set up backups for Render disk
- [ ] Review CORS origins

### 3. Custom Domain (Optional)
**Frontend (Vercel):**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration steps

**Backend (Render):**
1. Go to Settings → Custom Domain
2. Add your domain
3. Update DNS records

### 4. Monitoring
- Render provides logs and metrics
- Vercel provides analytics
- Set up uptime monitoring (e.g., UptimeRobot)

## Database Management

### Access Database
1. Use Render Shell to access your service
2. Navigate to `/opt/render/project/src/data`
3. Use sqlite3 CLI to query database

### Backups
1. Enable automatic snapshots in Render
2. Or set up cron job to backup database periodically

## Troubleshooting

### CORS Issues
- Verify CORS_ORIGINS in Render environment variables
- Check Vercel deployment URL matches CORS_ORIGINS
- Clear browser cache

### Database Issues
- Check disk is mounted correctly
- Verify DB_PATH points to persistent disk
- Check disk space usage

### Build Failures
**Backend:**
- Check TypeScript compilation errors
- Verify all dependencies in package.json
- Check Node version (18+)

**Frontend:**
- Check for TypeScript errors
- Verify VITE_API_URL is set
- Check build logs in Vercel

## Cost Estimate
- **Render Free Plan**: $0/month (limited compute, app sleeps after inactivity)
- **Render Starter Plan**: $7/month (recommended for production)
- **Vercel Free Plan**: $0/month (includes custom domain, HTTPS)
- **Total (Free)**: $0/month
- **Total (Recommended)**: $7/month

## Support
For issues, check:
1. Render logs: Dashboard → Logs
2. Vercel logs: Dashboard → Deployments → View Logs
3. Browser console for frontend errors
