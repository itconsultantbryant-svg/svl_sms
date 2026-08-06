# Electron Main Process & Preload

This directory contains the Electron-specific code for the SVL-SMS desktop application.

## Files

### main.ts (200+ lines)
The main Electron process that:
- Creates the BrowserWindow
- Manages the application lifecycle
- Spawns the Node.js backend process
- Handles IPC communication
- Implements auto-update checking
- Supports deep linking (svl-sms://)
- Sets up the application menu
- Handles window events

**Key Responsibilities:**
- Window creation and management
- Backend process spawning and monitoring
- IPC request handlers
- Auto-update mechanism
- Error handling and logging

### preload.ts (100+ lines)
Preload script that provides a secure API bridge:
- Exposes limited IPC methods to the renderer
- No direct Node.js access
- No filesystem access
- Type-safe API definitions
- Context isolation enforcement

**Exposed APIs:**
```typescript
window.api.getLicenseStatus()
window.api.openExternalLink(url)
window.api.minimizeWindow()
window.api.maximizeWindow()
window.api.closeWindow()
window.api.selectFolder()
window.api.selectFile(filters)
window.api.getAppInfo()
window.api.log(level, message)
window.api.onDeepLink(callback)
window.api.isElectron()
```

### api.d.ts
TypeScript type definitions for the Electron API. Import in your React components:

```typescript
import type { ElectronAPI } from '@/electron/api';
```

### entitlements.mac.plist
macOS sandboxing configuration that allows:
- Network access (local and remote)
- File system access (user-selected directories)
- Subprocess spawning (for backend process)
- Pasteboard access
- Printing

## Development

### Build
```bash
npm run build:electron
```

### Run Development
```bash
npm run electron-dev
```

### Debug
Open DevTools in the app (F12) to debug:
- Frontend JavaScript errors
- Network requests to backend
- React state (with React DevTools extension)

View main process logs:
```bash
# macOS/Linux
~/.svl-sms-electron/logs/main-*.log

# Windows
%APPDATA%\SVL-SMS\logs\main-*.log
```

## Architecture

```
┌─────────────────────────────┐
│   Main Process (main.ts)    │
│  - Window management        │
│  - Backend spawning         │
│  - IPC handlers             │
└──────────────┬──────────────┘
               │
       ┌───────┴───────┐
       ↓               ↓
  ┌─────────┐     ┌─────────┐
  │Frontend │     │ Backend │
  │ (React) │     │(Express)│
  └────┬────┘     └────┬────┘
       │               │
   (IPC/HTTP)     (Data Process)
       │               │
  Browser API      Database
```

## Building for Distribution

### Cross-Platform Build
```bash
npm run electron-build
```

Creates installers for:
- Windows (.exe, .portable.exe)
- macOS (.dmg, .zip)
- Linux (.AppImage, .snap)

### Platform-Specific
```bash
npm run electron-build:win
npm run electron-build:mac
npm run electron-build:linux
```

## Code Signing

### macOS
```bash
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=XXXXX
npm run electron-build:mac
```

### Windows
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=password
npm run electron-build:win
```

## Security Best Practices

1. **Context Isolation**: Renderer process is isolated from main process
2. **No Node Integration**: Renderer cannot require() Node modules
3. **Sandboxing**: Renderer runs in sandbox with limited access
4. **Limited IPC**: Only necessary APIs exposed via preload
5. **Input Validation**: All IPC inputs validated
6. **No Arbitrary Code Execution**: No eval() or Function() in preload

## Logging

All events are logged to:
- **Development**: Console + file in `~/.svl-sms-electron/logs/`
- **Production**: File only in user's app data directory

Log format:
```
[2024-08-06T12:34:56.789Z] [INFO] Backend started on port 3001
[2024-08-06T12:34:57.012Z] [WARN] Auto-update check failed
[2024-08-06T12:34:58.345Z] [ERROR] Failed to load window
```

## Testing

### Manual Testing Checklist
- [ ] App launches successfully
- [ ] Backend starts automatically
- [ ] Frontend loads
- [ ] Login works
- [ ] APIs respond correctly
- [ ] Window controls work
- [ ] File dialogs work
- [ ] External links open in browser
- [ ] Deep links trigger navigation
- [ ] Auto-update check doesn't crash
- [ ] App closes cleanly

### Debugging IPC Issues

Enable debug logging:
```typescript
// In main.ts
logMessage('IPC handler called: get-license-status', 'info');

// In preload.ts
ipcRenderer.invoke('get-license-status').then(result => {
  console.log('License status:', result);
});
```

## Environment Variables

Used in `main.ts`:
```
NODE_ENV=development|production
VITE_API_URL=http://localhost:3001/api (set dynamically)
ELECTRON_ENABLE_DEBUG=true|false
```

## Files Included in Build

The electron-builder config includes:
- `dist/electron/**/*` — Compiled Electron files
- `dist/frontend/**/*` — Built React app
- `dist/backend/**/*` — Built backend
- `package.json` — Dependencies
- `node_modules/` — Production dependencies only

## Troubleshooting

### "Cannot find module 'electron'"
```bash
npm install electron --save-dev
```

### "Backend won't start"
Check logs: `~/.svl-sms-electron/logs/main-*.log`

### "Frontend blank screen"
Open DevTools (F12) and check Console tab

### "Deep links don't work"
Ensure `svl-sms://` protocol is registered on target system

## Further Reading

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [IPC Security](https://www.electronjs.org/docs/latest/tutorial/ipc)

## Support

For issues:
1. Check logs in `~/.svl-sms-electron/logs/`
2. Check GitHub Issues: https://github.com/svl-sms/desktop/issues
3. Email: support@svl-sms.com
