import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import isDev from 'electron-is-dev';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendServer: import('http').Server | null = null;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
// Port the local backend actually bound to. Set in createWindow() and read by
// the get-api-url / get-license-status IPC handlers so they never hardcode 3001.
let backendPort = 3001;

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Get app data directory
const appDataPath = app.getPath('userData');
const logsPath = path.join(appDataPath, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(logsPath, { recursive: true });
}

const logFile = path.join(logsPath, `main-${new Date().toISOString().split('T')[0]}.log`);

function logMessage(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  console.log(logLine);
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * On-disk app root for packaged builds.
 * app.getAppPath() points at app.asar (a file) — cannot be used as cwd or spawn target.
 */
function getUnpackedAppRoot(): string {
  const appPath = app.getAppPath();
  if (appPath.includes('app.asar')) {
    return appPath.replace(/app\.asar.*/, 'app.asar.unpacked');
  }
  return appPath;
}

/**
 * Find an available port starting from the given port
 */
function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });

    server.once('listening', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close();
      resolve(port);
    });

    server.listen(startPort, 'localhost');
  });
}

/**
 * Wait until the local backend answers /api/health (or time out).
 */
async function waitForBackend(port: number, lastError: string): Promise<number> {
  const maxAttempts = 30;
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) {
        logMessage('Backend is ready');
        return port;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(lastError || 'Backend failed to start within timeout');
}

/**
 * DEV ONLY: run the backend as a child process via tsx (hot reload).
 */
async function spawnDevBackend(port: number): Promise<number> {
  let lastError = '';
  const unpackedRoot = path.join(__dirname, '..');
  const backendPath = path.join(__dirname, '../src/index.ts');
  logMessage(`Backend entry: ${backendPath}`);
  logMessage(`Backend cwd: ${unpackedRoot}`);

  const env: NodeJS.ProcessEnv = { ...process.env };
  env.NODE_ENV = 'development';
  env.PORT = port.toString();
  env.CORS_ORIGINS = 'http://localhost:*,app://localhost,file://*';
  env.DB_PATH = path.join(app.getPath('userData'), 'svl-sms.db');
  env.ELECTRON_MODE = 'true';

  backendProcess = spawn('tsx', ['watch', backendPath], {
    env,
    cwd: unpackedRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  backendProcess.stdout?.on('data', (d) => logMessage(`Backend: ${d.toString().trim()}`, 'info'));
  backendProcess.stderr?.on('data', (d) => {
    lastError = d.toString().trim();
    logMessage(`Backend Error: ${lastError}`, 'error');
  });
  backendProcess.on('error', (err) => {
    lastError = err.message;
    logMessage(`Failed to start backend: ${err.message}`, 'error');
  });
  backendProcess.on('exit', (code) => {
    logMessage(`Backend process exited with code ${code}`, 'warn');
    backendProcess = null;
  });

  return waitForBackend(port, lastError);
}

/**
 * PROD: run the backend INSIDE the Electron main process.
 *
 * A packaged Electron app ships no standalone Node.exe, and on Windows none of
 * the Unix system-Node paths exist — so the old code fell back to spawning the
 * Electron binary itself to run the backend. In a packaged build that just
 * re-launches the whole app (fork-bomb of windows on Windows) and never starts
 * a real HTTP server. Running the Express app in-process uses the Electron
 * runtime where better-sqlite3 is already rebuilt, with no separate Node and no
 * native-module ABI mismatch.
 */
async function startInProcessBackend(port: number): Promise<number> {
  const unpackedRoot = getUnpackedAppRoot();
  const backendPath = path.join(unpackedRoot, 'dist', 'backend', 'index.js');
  logMessage(`Loading backend in-process: ${backendPath}`);

  if (!fs.existsSync(backendPath)) {
    throw new Error(`Backend file missing: ${backendPath}`);
  }

  // Must be set BEFORE requiring the backend — its DB init reads DB_PATH.
  process.env.NODE_ENV = 'production';
  process.env.PORT = port.toString();
  process.env.CORS_ORIGINS = 'http://localhost:*,app://localhost,file://*';
  process.env.DB_PATH = path.join(app.getPath('userData'), 'svl-sms.db');
  process.env.ELECTRON_MODE = 'true';

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const backendModule = require(backendPath);
    const backendApp = backendModule.default || backendModule;
    backendServer = backendApp.listen(port, () => {
      logMessage(`Backend (in-process) listening on port ${port}`);
    });
  } catch (err) {
    logMessage(`Error starting in-process backend: ${err}`, 'error');
    throw err;
  }

  return waitForBackend(port, '');
}

/**
 * Start the backend: child process in dev, in-process in production.
 */
async function spawnBackend(): Promise<number> {
  const port = await findAvailablePort(3001);
  logMessage(`Resolved backend port: ${port}`);
  return isDev ? spawnDevBackend(port) : startInProcessBackend(port);
}

/**
 * Create the browser window
 */
async function createWindow(): Promise<void> {
  // Start the backend
  try {
    backendPort = await spawnBackend();
  } catch (err) {
    logMessage(`Failed to start backend: ${err}`, 'error');
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the backend service.\n\n${err instanceof Error ? err.message : String(err)}\n\nSee logs in:\n${logsPath}`
    );
    app.quit();
    return;
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // The frontend discovers the real backend URL at runtime via the preload
  // bridge (window.api.getApiUrl() → the 'get-api-url' IPC handler below), so
  // there is no need to inject it as a build-time env var here.

  // Never let the renderer open new Electron windows/tabs. Any external http(s)
  // link is sent to the user's default browser instead; everything else is denied.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const startUrl = isDev
    ? 'http://localhost:5173' // Vite dev server
    : pathToFileURL(path.join(__dirname, '../frontend/index.html')).href;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMessage(`Frontend crashed: ${details.reason}`, 'error');
    dialog.showErrorBox('Application Error', 'The application has crashed. Please restart.');
    app.quit();
  });

  // Setup auto-update check (quarterly)
  setupAutoUpdateCheck();
}

/**
 * Setup periodic auto-update checks
 */
function setupAutoUpdateCheck(): void {
  // Check for updates every 24 hours (configurable)
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  updateCheckInterval = setInterval(() => {
    checkForUpdates();
  }, CHECK_INTERVAL);

  // Check on startup after a delay
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
}

/**
 * Check for updates from GitHub releases
 */
async function checkForUpdates(): Promise<void> {
  try {
    const currentVersion = app.getVersion();

    const response = await fetch(
      'https://api.github.com/repos/itconsultantbryant-svg/svl_sms/releases/latest',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as { tag_name: string; html_url: string };
    const latestVersion = data.tag_name.replace(/^v/, '');

    if (isNewerVersion(latestVersion, currentVersion)) {
      logMessage(`New version available: ${latestVersion}`, 'info');

      const response = await dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Update Available',
        message: `A new version of SVL-SMS (${latestVersion}) is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
      });

      if (response.response === 0) {
        shell.openExternal(data.html_url);
      }
    }
  } catch (err) {
    logMessage(`Error checking for updates: ${err}`, 'warn');
  }
}

/**
 * Compare semantic versions
 */
function isNewerVersion(newer: string, current: string): boolean {
  const newerParts = newer.split('.').map((x) => parseInt(x, 10));
  const currentParts = current.split('.').map((x) => parseInt(x, 10));

  for (let i = 0; i < 3; i++) {
    const n = newerParts[i] || 0;
    const c = currentParts[i] || 0;

    if (n > c) return true;
    if (n < c) return false;
  }

  return false;
}

/**
 * Handle deep links (svl-sms://)
 */
function setupDeepLinking(): void {
  // Register the protocol
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('svl-sms', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('svl-sms');
  }

  // Handle deep link open
  app.on('open-url', (event, url) => {
    event.preventDefault();
    logMessage(`Deep link received: ${url}`, 'info');

    if (mainWindow) {
      mainWindow.show();
      // Send the deep link URL to the frontend
      mainWindow.webContents.send('deep-link', url);
    }
  });
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  // Return the dynamically assigned local backend URL so the renderer always
  // talks to the bundled backend (its port is chosen at runtime).
  ipcMain.handle('get-api-url', () => {
    return `http://localhost:${backendPort}/api`;
  });

  // Get license status
  ipcMain.handle('get-license-status', async () => {
    try {
      const response = await fetch(`http://localhost:${backendPort}/api/licensing/status`);
      const data = await response.json();
      return data;
    } catch (err) {
      logMessage(`Error getting license status: ${err}`, 'error');
      return { status: 'offline', message: 'Unable to connect to backend' };
    }
  });

  // Open external link
  ipcMain.handle('open-external-link', (event, url: string) => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: 'Invalid URL' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Window controls
  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // Select folder
  ipcMain.handle('select-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Select file
  ipcMain.handle('select-file', async (event, filters?: Array<{ name: string; extensions: string[] }>) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters,
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Get app info
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      platform: process.platform,
      arch: process.arch,
      isDev,
      appPath: app.getAppPath(),
      userDataPath: appDataPath,
    };
  });

  // Log from frontend
  ipcMain.on('log', (event, level: string, message: string) => {
    logMessage(`Frontend (${level}): ${message}`, level as 'info' | 'warn' | 'error');
  });
}

/**
 * App event handlers
 */
app.on('ready', async () => {
  logMessage('App ready event fired', 'info');

  // Setup deep linking
  setupDeepLinking();

  // Setup IPC
  setupIPC();

  // Create window
  await createWindow();

  // Setup application menu
  setupMenu();
});

app.on('window-all-closed', () => {
  if (!isMac) {
    logMessage('All windows closed, quitting app', 'info');
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    logMessage('App activated, creating window', 'info');
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  logMessage('App quitting, cleaning up resources', 'info');

  // Clear update check interval
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }

  // Kill backend process (dev child process)
  if (backendProcess) {
    try {
      if (isWindows) {
        // On Windows, use taskkill
        spawn('taskkill', ['/pid', backendProcess.pid!.toString(), '/f']);
      } else {
        // On Unix-like systems, use process.kill
        process.kill(-backendProcess.pid!);
      }
    } catch (err) {
      logMessage(`Error killing backend process: ${err}`, 'warn');
    }
  }

  // Close in-process backend server (production)
  if (backendServer) {
    try {
      backendServer.close();
    } catch (err) {
      logMessage(`Error closing backend server: ${err}`, 'warn');
    }
    backendServer = null;
  }
});

/**
 * Setup application menu
 */
function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About SVL-SMS',
              message: 'SVL School Management System',
              detail: `Version ${app.getVersion()}\n\nA comprehensive school management platform.`,
            });
          },
        },
        {
          label: 'Check for Updates',
          click: () => {
            checkForUpdates();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Make sure we handle any uncaught exceptions
process.on('uncaughtException', (err) => {
  logMessage(`Uncaught exception: ${err.message}\n${err.stack}`, 'error');
});

export { mainWindow, backendProcess };
