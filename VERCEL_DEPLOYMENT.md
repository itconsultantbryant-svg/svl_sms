# Vercel Frontend Deployment Guide

## Step 1: Get Your Render Backend URL

1. Go to your Render dashboard: https://dashboard.render.com
2. Find your backend service (svl-sms-backend)
3. Copy the URL (e.g., `https://svl-sms-backend-xxxx.onrender.com`)
4. **Save this URL - you'll need it for Vercel environment variables**

## Step 2: Deploy Frontend to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com/new

2. **Import Repository**
   - Click "Import Project"
   - Select your GitHub repository: `itconsultantbryant-svg/svl_sms`
   - Click "Import"

3. **Configure Project**
   - **Framework Preset**: Vite
   - **Root Directory**: Leave as `.` (Vercel will use vercel.json config)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `cd frontend && npm install`

4. **Add Environment Variable**
   - Click "Environment Variables"
   - Add:
     - **Key**: `VITE_API_URL`
     - **Value**: `https://your-backend-name.onrender.com/api`
       (Replace with your actual Render backend URL from Step 1)
   - Click "Add"

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project root
cd /Users/user/Desktop/systems/SMS
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? svl-sms-frontend
# - Directory? ./
# - Override settings? No

# Add environment variable
vercel env add VITE_API_URL production
# Paste your Render backend URL when prompted

# Deploy to production
vercel --prod
```

## Step 3: Update Backend CORS

After Vercel deployment, you'll get a URL like: `https://svl-sms-frontend.vercel.app`

1. Go to Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Update these variables:
   - **CORS_ORIGINS**: `https://svl-sms-frontend.vercel.app`
   - **FRONTEND_URL**: `https://svl-sms-frontend.vercel.app`
5. Click "Save Changes"
6. Service will redeploy automatically

## Step 4: Test the Application

1. Visit your Vercel URL: `https://svl-sms-frontend.vercel.app`
2. You should see the login page
3. Login with:
   - Username: `admin`
   - Password: `admin123`

## Troubleshooting

### Issue: "Network Error" or "Failed to fetch"

**Solution**: Check CORS settings
```bash
# In Render dashboard, verify CORS_ORIGINS includes your Vercel URL
CORS_ORIGINS=https://svl-sms-frontend.vercel.app
```

### Issue: Frontend shows backend code

**Solution**: Vercel is building from wrong directory
- Check `vercel.json` exists in root
- Verify `outputDirectory` is set to `frontend/dist`
- Redeploy

### Issue: "Failed to compile" during build

**Solution**: Check environment variable
```bash
# Ensure VITE_API_URL is set in Vercel
vercel env ls
```

### Issue: Login fails with CORS error

**Solution**: Update Render backend
1. Go to Render → Environment
2. Set `CORS_ORIGINS` to your Vercel URL
3. Redeploy

## Project URLs Summary

After deployment, save these URLs:

- **Frontend (Vercel)**: https://svl-sms-frontend.vercel.app
- **Backend (Render)**: https://svl-sms-backend-xxxx.onrender.com
- **GitHub Repo**: https://github.com/itconsultantbryant-svg/svl_sms

## Custom Domain (Optional)

### Add Custom Domain to Vercel

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `sms.yourdomain.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-10 minutes)

### Update Backend CORS for Custom Domain

```bash
# In Render Environment variables:
CORS_ORIGINS=https://sms.yourdomain.com,https://svl-sms-frontend.vercel.app
```

## Cost Summary

- **Vercel Free Tier**:
  - 100 GB bandwidth/month
  - Unlimited deployments
  - Custom domain included
  - HTTPS automatic

- **Render Free Tier**:
  - Backend sleeps after 15 min inactivity
  - 750 hours/month
  - Upgrade to Starter ($7/mo) for always-on

## Security Checklist

After deployment:

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET in Render
- [ ] Verify CORS origins are correct
- [ ] Enable Vercel password protection (optional)
- [ ] Set up custom domain with HTTPS
- [ ] Test all features in production
- [ ] Set up monitoring/alerts

## Support

If you encounter issues:
1. Check Vercel build logs
2. Check Render runtime logs
3. Check browser console for errors
4. Verify environment variables are set correctly

---

**Deployment Complete! 🚀**

Your SVL School Management System is now live!
