# SVL-SMS Electron Quick Start

Get the desktop app running locally in 5 minutes.

## Prerequisites

- Node.js 20.x ([download](https://nodejs.org/))
- npm (comes with Node)
- Git

## Installation

1. **Clone & install dependencies**

   ```bash
   git clone https://github.com/svl-sms/desktop.git
   cd desktop
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Create environment file**

   ```bash
   cp .env.example .env
   ```

3. **Start development**

   ```bash
   npm run electron-dev
   ```

   This starts:
   - ✅ Backend on `http://localhost:3001`
   - ✅ Frontend dev server on `http://localhost:5173`
   - ✅ Electron app with auto-reload

## Available Commands

```bash
# Development with live reload
npm run electron-dev

# Just build (without launching)
npm run build:electron

# Run Electron app (must build first)
npm run electron

# Backend only
npm run dev

# Frontend only
cd frontend && npm run dev

# Production build (creates installers)
npm run electron-build

# Windows offline ZIP (Setup.exe inside) — for school PCs
npm run electron-build:win:zip

# Platform-specific builds
npm run electron-build:win    # Windows Setup.exe
npm run electron-build:mac    # macOS
npm run electron-build:linux  # Linux
```

## Folder Structure

```
SMS/
├── electron/              # Electron main process & preload
│   ├── main.ts           # Main process
│   ├── preload.ts        # Secure API bridge
│   └── README.md         # Electron docs
├── frontend/             # React app (Vite)
│   └── src/
├── src/                  # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes/           # API routes
│   └── database/
├── scripts/              # Build scripts
├── ELECTRON_SETUP.md     # Complete setup guide
└── DEPLOYMENT_GUIDE.md   # Deployment instructions
```

## First Run Checklist

- [ ] App launches without errors
- [ ] Backend console shows "Backend is ready"
- [ ] Frontend loads (no blank screen)
- [ ] You can log in with demo credentials
- [ ] DevTools opens (F12)
- [ ] No red errors in console

## Debugging

### DevTools
- Press `F12` in the app to open developer tools
- Check Console tab for errors
- Check Network tab for API calls

### Main Process Logs
```bash
# macOS/Linux
cat ~/.svl-sms-electron/logs/main-*.log

# Windows
type %APPDATA%\SVL-SMS\logs\main-*.log
```

### Backend Logs
Check the terminal where you ran `npm run electron-dev`

## Common Issues

### "Port 3001 already in use"
```bash
# Find and kill the process
lsof -i :3001
kill -9 <PID>
```

### "Module not found: electron"
```bash
npm install electron --save-dev
```

### Blank screen / No frontend loading
1. Press F12 to open DevTools
2. Check Console for errors
3. Verify Vite is running on port 5173

### Backend connection failed
1. Check backend logs in terminal
2. Verify `.env` PORT is set correctly
3. Try: `curl http://localhost:3001/api/health`

## Next Steps

1. **Learn the architecture** → Read `ELECTRON_SETUP.md`
2. **Understand deployment** → Read `DEPLOYMENT_GUIDE.md`
3. **Build for production** → `npm run electron-build`
4. **Contribute** → Check `electron/README.md`

## File Locations

| Component | Location |
|-----------|----------|
| Main process | `electron/main.ts` |
| Preload script | `electron/preload.ts` |
| Backend | `src/index.ts` |
| Frontend | `frontend/src/` |
| Build config | `electron-builder.yml` |

## Environment Variables (`.env`)

```env
# Backend
NODE_ENV=development
PORT=3001

# Frontend
VITE_API_URL=http://localhost:3001/api

# Electron
ELECTRON_ENABLE_DEBUG=true
```

## API Docs

Frontend can use these APIs via `window.api`:

```typescript
// Window controls
window.api.minimizeWindow()
window.api.maximizeWindow()
window.api.closeWindow()

// File dialogs
const folder = await window.api.selectFolder()
const file = await window.api.selectFile()

// Utilities
const info = await window.api.getAppInfo()
const status = await window.api.getLicenseStatus()

// Open external links
await window.api.openExternalLink('https://example.com')

// Logging
window.api.log('info', 'Something happened')

// Deep links
const unsubscribe = window.api.onDeepLink((url) => {
  console.log('Received deep link:', url)
})
```

## Platform-Specific Notes

### Windows
- Installers go to `out/` folder
- `.exe` for full installer
- `.portable.exe` for portable version

### macOS
- `.dmg` for installer
- `.zip` for portable version
- Requires Apple Developer ID for code signing

### Linux
- `.AppImage` for universal binary
- `.snap` for snap store
- Requires snapcraft for snap builds

## Production Build

```bash
# Build everything
npm run electron-build

# Output
out/
├── SVL-SMS-1.0.0.exe
├── SVL-SMS-1.0.0.dmg
└── SVL-SMS-1.0.0.AppImage
```

## Support

- **Docs**: See `ELECTRON_SETUP.md` and `DEPLOYMENT_GUIDE.md`
- **Issues**: https://github.com/svl-sms/desktop/issues
- **Email**: support@svl-sms.com

---

**Happy coding!** 🚀
