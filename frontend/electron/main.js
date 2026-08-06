const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;
let backendReady = false;

const isDev = process.env.NODE_ENV === 'development';
const backendPort = 3001;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (backendProcess) {
      backendProcess.kill();
    }
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendScript = path.join(__dirname, '../../scripts/start-electron-backend.js');
    backendProcess = spawn('node', [backendScript, backendPort.toString()], {
      stdio: 'inherit'
    });

    backendProcess.on('error', (err) => {
      console.error('Backend error:', err);
      reject(err);
    });

    const timeout = setTimeout(() => {
      console.error('Backend startup timeout');
      reject(new Error('Backend timeout'));
    }, 30000);

    ipcMain.once('backend-ready', () => {
      clearTimeout(timeout);
      backendReady = true;
      resolve();
    });
  });
}

app.on('ready', async () => {
  try {
    await startBackend();
    createWindow();
  } catch (error) {
    console.error('Failed to start:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${backendPort}`;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});
