# SVL-SMS Electron Desktop Application Setup

This document provides comprehensive information about building, developing, and deploying the SVL-SMS Electron desktop application.

## Architecture Overview

The SVL-SMS Electron app follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────┐
│                   Electron Main Process                 │
│  (Window management, IPC, backend spawning, deep links)  │
└─────────────────────────────────────────────────────────┘
                           ↕
        ┌────────────────────┴────────────────────┐
        ↓                                         ↓
┌──────────────────────┐              ┌──────────────────────┐
│   React Frontend     │◄────IPC────►│  Express Backend     │
│  (UI, State, Views)  │              │  (APIs, Database)    │
└──────────────────────┘              └──────────────────────┘
        ↓                                    ↓
    User Actions                      Data Processing
    & Interactions                    & Persistence
```

### Component Breakdown

1. **Electron Main Process** (`electron/main.ts`)
   - Creates and manages the BrowserWindow
   - Spawns the Node.js backend process
   - Handles IPC communication between frontend and backend
   - Manages app lifecycle and deep linking
   - Implements auto-update checking
   - No business logic—purely orchestration

2. **React Frontend** (`frontend/src/`)
   - Built with Vite
   - Communicates with backend via HTTP
   - Can access safe APIs via `window.api` (IPC bridge)
   - Fully isolated and sandboxed

3. **Express Backend** (`src/index.ts`)
   - All existing SVL-SMS APIs
   - SQLite database
   - Authentication & authorization
   - Business logic
   - Spawned as a child process

4. **Preload Script** (`electron/preload.ts`)
   - Secure bridge for frontend ↔ main process communication
   - Exposes limited API methods only
   - No direct filesystem or process access

## Directory Structure

```
SMS/
├── electron/
│   ├── main.ts              # Main process file
│   ├── preload.ts          # Preload script
│   └── entitlements.mac.plist  # macOS entitlements
├── frontend/               # React app
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── src/                    # Backend (Express)
│   ├── index.ts
│   ├── routes/
│   ├── database/
│   └── middleware/
├── scripts/
│   └── start-electron-backend.js  # Backend spawner
├── electron-builder.yml    # Build configuration
├── tsconfig.electron.json # TypeScript config for Electron
├── tsconfig.json          # TypeScript config for backend
└── package.json           # Root package.json
```

## Development Setup

### Prerequisites

- Node.js 20.x
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/svl-sms/desktop.git
   cd desktop
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

### Development Mode

Run the entire stack in development mode:

```bash
npm run electron-dev
```

This command:
1. Starts the backend with `tsx watch` (hot reload)
2. Waits for Vite dev server on port 5173
3. Compiles Electron files
4. Launches Electron with DevTools open
5. All three parts live-reload on file changes

### Individual Development

If you need to develop components separately:

**Backend only:**
```bash
npm run dev
```

**Frontend only (web version):**
```bash
cd frontend
npm run dev
```

**Electron only (with existing servers):**
```bash
npm run build:electron
npm run electron
```

## Building for Production

### Full Production Build

```bash
npm run electron-build
```

This creates platform-specific installers:
- **Windows**: `.exe` (NSIS installer) and `.portable.exe`
- **macOS**: `.dmg` and `.zip`
- **Linux**: `.AppImage` and `.snap`

### Platform-Specific Builds

**Windows:**
```bash
npm run electron-build:win
```

**macOS:**
```bash
npm run electron-build:mac
```

**Linux:**
```bash
npm run electron-build:linux
```

**All Platforms:**
```bash
npm run electron-build:all
```

### Build Output

Installers are created in the `out/` directory:
```
out/
├── SVL-SMS-1.0.0.exe           (Windows NSIS)
├── SVL-SMS-1.0.0-portable.exe  (Windows portable)
├── SVL-SMS-1.0.0.dmg           (macOS)
├── SVL-SMS-1.0.0.zip           (macOS portable)
├── SVL-SMS-1.0.0.AppImage      (Linux)
└── SVL-SMS-1.0.0.snap          (Linux)
```

## Code Signing

### Windows Code Signing

1. Obtain a code signing certificate (DigiCert, Sectigo, etc.)
2. Update `electron-builder.yml`:
   ```yaml
   win:
     certificateFile: /path/to/certificate.pfx
     certificatePassword: ${CERTIFICATE_PASSWORD}
   ```
3. Set environment variable:
   ```bash
   export CERTIFICATE_PASSWORD=your_password
   npm run electron-build:win
   ```

### macOS Code Signing

1. Obtain a Developer ID certificate from Apple
2. Set environment variables:
   ```bash
   export APPLE_ID=your_apple_id
   export APPLE_ID_PASSWORD=your_app_password
   export APPLE_TEAM_ID=your_team_id
   ```
3. Update `electron-builder.yml`:
   ```yaml
   mac:
     identity: "Developer ID Application: Your Company"
     certificateFile: /path/to/certificate.p12
     certificatePassword: ${CERTIFICATE_PASSWORD}
   ```
4. Build:
   ```bash
   npm run electron-build:mac
   ```

### Linux Code Signing

GPG signing (optional):
```bash
export GPG_KEY_ID=your_key_id
npm run electron-build:linux
```

## Auto-Update Mechanism

SVL-SMS checks for updates every 24 hours after startup.

### How It Works

1. Main process periodically calls GitHub API for latest release
2. Compares versions semantically
3. Shows dialog if new version available
4. User clicks "Download" to open release page
5. User downloads and installs manually (or use auto-installer on next build)

### Configuration

In `electron/main.ts`:
```typescript
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
```

### Update Server Requirements

Current implementation uses GitHub releases as update source:
```
https://api.github.com/repos/svl-sms/desktop/releases/latest
```

## IPC Communication

### Frontend → Main Process

```typescript
// In React component
const result = await window.api.selectFolder();
const info = await window.api.getAppInfo();
```

### Main Process → Frontend

```typescript
// In electron/main.ts
mainWindow.webContents.send('deep-link', url);
```

### Available APIs

The following methods are exposed via `window.api`:

#### License Management
- `getLicenseStatus()` — Get current license status
- **Returns**: `{ status, message, expiresAt }`

#### Window Control
- `minimizeWindow()` — Minimize the window
- `maximizeWindow()` — Toggle maximize/restore
- `closeWindow()` — Close the application

#### File System
- `selectFolder()` — Open folder selection dialog
  - **Returns**: `{ success, path, canceled, error }`
- `selectFile(filters)` — Open file selection dialog
  - **Returns**: `{ success, path, canceled, error }`

#### Utilities
- `openExternalLink(url)` — Open URL in default browser
  - **Returns**: `{ success, error }`
- `getAppInfo()` — Get app information
  - **Returns**: `{ version, name, platform, arch, isDev, appPath, userDataPath }`
- `log(level, message)` — Log from frontend
  - **Parameters**: `level: 'info'|'warn'|'error'`, `message: string`
- `onDeepLink(callback)` — Listen for deep links
  - **Returns**: unsubscribe function
- `isElectron()` — Check if running in Electron
  - **Returns**: `boolean`

## Deep Linking

### What Are Deep Links?

Deep links allow launching the app with a specific context via custom URLs:
```
svl-sms://student/view/123
svl-sms://assignment/edit/456
```

### Implementation

1. **Register Protocol** (in `electron/main.ts`):
   ```typescript
   app.setAsDefaultProtocolClient('svl-sms');
   ```

2. **Listen for Links**:
   ```typescript
   app.on('open-url', (event, url) => {
     mainWindow.webContents.send('deep-link', url);
   });
   ```

3. **Handle in Frontend**:
   ```typescript
   useEffect(() => {
     const unsubscribe = window.api.onDeepLink((url) => {
       // Navigate based on URL
       router.push('/student/view/123');
     });
     return unsubscribe;
   }, []);
   ```

## Environment Variables

### Development

Copy `.env.example` to `.env`:
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-key

# Database
DB_PATH=./data/svl-sms.db

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Electron
VITE_API_URL=http://localhost:3001/api
ELECTRON_ENABLE_DEBUG=true
```

### Production

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-secret-key

# Database
DB_PATH=/var/lib/svl-sms/data.db

# CORS
CORS_ORIGINS=app://localhost

# Electron
ELECTRON_ENABLE_DEBUG=false
ELECTRON_UPDATE_URL=https://api.github.com/repos/svl-sms/desktop/releases/latest
```

## Security Considerations

### 1. Context Isolation

The renderer process is isolated from the main process:
```typescript
// Secure - only preload script can access main process
contextBridge.exposeInMainWorld('api', api);
```

### 2. No Node Integration

Renderer process cannot access Node modules:
```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
}
```

### 3. Limited IPC Exposure

Only necessary methods are exposed:
- File dialogs (not arbitrary file system access)
- Window controls (standard operations)
- License checks (read-only)

### 4. Content Security Policy

Add CSP headers in production builds to prevent injection attacks.

### 5. Secure Communication

- All IPC validated
- No arbitrary code execution
- HTTPS for all external requests
- Secure storage of sensitive data

## Troubleshooting

### Backend Won't Start

1. Check logs: `~/.svl-sms-electron/logs/`
2. Verify port availability: `lsof -i :3001`
3. Check permissions on data directory
4. Try manually: `npm run dev`

### Frontend Not Loading

1. Check Vite server is running: `http://localhost:5173`
2. Check API URL is correct: `VITE_API_URL` env var
3. Check CORS settings in backend
4. Open DevTools (press F12) for errors

### Update Check Fails

1. Check internet connection
2. Verify GitHub API access: `curl https://api.github.com/repos/svl-sms/desktop/releases/latest`
3. Check logs for error details

### macOS Code Signing Errors

1. Ensure Developer ID certificate is installed
2. Verify team ID matches certificate
3. Check entitlements file has correct permissions
4. Try: `codesign --force --deep --sign - dist/electron/main.js`

### Windows Installer Issues

1. Verify NSIS is installed
2. Check `electron-builder.yml` syntax
3. Run as administrator
4. Check antivirus isn't blocking build

## Performance Optimization

### Frontend

- Use React.memo for expensive components
- Implement code splitting
- Lazy load routes
- Optimize images and assets

### Backend

- Use database indexes
- Implement caching
- Optimize queries
- Use connection pooling

### Electron

- Lazy load heavy modules
- Use native modules where possible
- Optimize startup time
- Monitor memory usage

## Database Management

### Backup

The SQLite database is stored at:
- **Windows**: `%APPDATA%\SVL-SMS\data\svl-sms.db`
- **macOS**: `~/Library/Application Support/SVL-SMS/data/svl-sms.db`
- **Linux**: `~/.config/SVL-SMS/data/svl-sms.db`

### Restore

1. Close SVL-SMS
2. Replace the database file
3. Restart SVL-SMS

## Deployment

See `DEPLOYMENT_GUIDE.md` for comprehensive deployment instructions including:
- Release management
- Auto-update setup
- GitHub Actions CI/CD
- Monitoring and logging
- User support

## API Reference

### IPC Main Events

```typescript
// Window controls
ipcMain.handle('minimize-window', () => { ... })
ipcMain.handle('maximize-window', () => { ... })
ipcMain.handle('close-window', () => { ... })

// File dialogs
ipcMain.handle('select-folder', async () => { ... })
ipcMain.handle('select-file', async (event, filters) => { ... })

// External links
ipcMain.handle('open-external-link', (event, url) => { ... })

// App info
ipcMain.handle('get-app-info', () => { ... })

// License
ipcMain.handle('get-license-status', async () => { ... })

// Logging
ipcMain.on('log', (event, level, message) => { ... })
```

## Contributing

When contributing to the Electron setup:

1. Follow TypeScript strict mode
2. Always validate IPC inputs
3. Add security checks for file operations
4. Test on all platforms
5. Update documentation
6. Use conventional commits

## License

Proprietary - SVL-SMS Team

## Support

For issues and questions:
- GitHub Issues: https://github.com/svl-sms/desktop/issues
- Documentation: https://docs.svl-sms.com
- Email: support@svl-sms.com
