#!/usr/bin/env node

/**
 * Backend startup script for Electron app
 * Spawns the Node.js Express backend process
 * Handles port detection, graceful shutdown, and error recovery
 */

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const DEFAULT_PORT = 3001;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 500; // 500ms between checks

// State
let backendProcess = null;
let currentPort = DEFAULT_PORT;
let retryCount = 0;

// Logging
const logDir = path.join(os.homedir(), '.svl-sms-electron', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `backend-${new Date().toISOString().split('T')[0]}.log`);

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}`;
  console.log(logLine);

  try {
    fs.appendFileSync(logFile, logLine + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * Find an available port
 */
function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });

    server.once('listening', () => {
      const port = server.address().port;
      server.close();
      resolve(port);
    });

    server.listen(startPort, 'localhost');
  });
}

/**
 * Check if backend is healthy via health endpoint
 */
async function checkBackendHealth(port, timeout = HEALTH_CHECK_TIMEOUT) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        timeout: 5000,
      });

      if (response.ok) {
        const data = await response.json();
        log(`Backend health check passed: ${JSON.stringify(data)}`, 'INFO');
        return true;
      }
    } catch (err) {
      // Backend not ready yet, retry
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  return false;
}

/**
 * Spawn the backend process
 */
async function startBackend(port) {
  return new Promise(async (resolve, reject) => {
    try {
      log(`Attempting to start backend on port ${port}`, 'INFO');

      // Determine if we're in development or production
      const isDev = process.env.NODE_ENV !== 'production';
      const isWindows = process.platform === 'win32';

      let command, args, env;

      if (isDev) {
        // Development: use tsx with watch mode
        command = 'tsx';
        args = ['watch', path.resolve(__dirname, '../src/index.ts')];
      } else {
        // Production: use node
        command = 'node';
        args = [path.resolve(__dirname, '../dist/backend/index.js')];
      }

      env = {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: port.toString(),
        CORS_ORIGINS: 'http://localhost:*,app://localhost',
        ELECTRON_MODE: 'true',
      };

      backendProcess = spawn(command, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: !isWindows,
      });

      // Handle stdout
      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          const message = data.toString().trim();
          if (message) {
            log(`Backend: ${message}`, 'DEBUG');
          }
        });
      }

      // Handle stderr
      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          const message = data.toString().trim();
          if (message) {
            log(`Backend: ${message}`, 'ERROR');
          }
        });
      }

      // Handle process error
      backendProcess.on('error', (err) => {
        log(`Failed to spawn backend process: ${err.message}`, 'ERROR');
        reject(err);
      });

      // Handle process exit
      backendProcess.on('exit', (code, signal) => {
        log(`Backend process exited with code ${code} and signal ${signal}`, 'WARN');
        backendProcess = null;
      });

      // Wait for backend to be healthy
      const isHealthy = await checkBackendHealth(port);

      if (isHealthy) {
        log(`Backend is healthy on port ${port}`, 'INFO');
        currentPort = port;

        // Output the port so parent process can read it
        console.log(JSON.stringify({ success: true, port, pid: backendProcess.pid }));

        resolve({ port, pid: backendProcess.pid });
      } else {
        log(`Backend health check failed after ${HEALTH_CHECK_TIMEOUT}ms`, 'ERROR');

        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill();
        }

        reject(new Error('Backend health check failed'));
      }
    } catch (err) {
      log(`Error starting backend: ${err.message}`, 'ERROR');
      reject(err);
    }
  });
}

/**
 * Start backend with retry logic
 */
async function startBackendWithRetry() {
  try {
    // Find available port
    const port = await findAvailablePort(DEFAULT_PORT);
    log(`Found available port: ${port}`, 'INFO');

    // Start backend
    const result = await startBackend(port);
    retryCount = 0;
    return result;
  } catch (err) {
    retryCount++;

    if (retryCount < MAX_RETRIES) {
      log(`Retrying backend startup (attempt ${retryCount}/${MAX_RETRIES})...`, 'WARN');

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return startBackendWithRetry();
    } else {
      log(`Failed to start backend after ${MAX_RETRIES} retries`, 'ERROR');
      console.error(JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    }
  }
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown() {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGHUP', shutdown);
  process.on('exit', shutdown);
}

function shutdown() {
  log('Shutdown signal received', 'INFO');

  if (backendProcess && !backendProcess.killed) {
    log('Killing backend process', 'INFO');

    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        // On Windows, use taskkill
        spawn('taskkill', ['/pid', backendProcess.pid, '/f']);
      } else {
        // On Unix, use process group kill
        process.kill(-backendProcess.pid);
      }
    } catch (err) {
      log(`Error killing backend process: ${err.message}`, 'ERROR');
    }
  }

  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  log('Starting SVL-SMS Electron Backend', 'INFO');
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'INFO');
  log(`Platform: ${process.platform}`, 'INFO');

  setupGracefulShutdown();

  try {
    const result = await startBackendWithRetry();
    log(`Backend started successfully on port ${result.port}`, 'INFO');
  } catch (err) {
    log(`Failed to start backend: ${err.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run main
main().catch((err) => {
  log(`Unexpected error: ${err.message}`, 'ERROR');
  process.exit(1);
});
