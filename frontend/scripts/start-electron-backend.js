const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const port = process.argv[2] || 3001;
const logDir = path.join(process.env.HOME || '/tmp', '.svl-sms-electron', 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `backend-${Date.now()}.log`);
const stream = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  stream.write(line);
  console.log(line);
}

log(`Starting backend on port ${port}`);

// Start backend process
const backend = spawn('node', [path.join(__dirname, '../dist/index.js')], {
  env: { ...process.env, PORT: port, NODE_ENV: 'production' },
  stdio: ['inherit', 'pipe', 'pipe']
});

backend.stdout.on('data', (data) => {
  log(`Backend: ${data}`);
});

backend.stderr.on('data', (data) => {
  log(`Backend Error: ${data}`);
});

// Health check
let attempts = 0;
const maxAttempts = 60;

function checkHealth() {
  const req = http.get(`http://localhost:${port}/api/licensing/check`, { timeout: 5000 }, (res) => {
    if (res.statusCode === 401) {
      // 401 is expected (no auth), means server is running
      log('Backend health check passed (401 expected)');
      process.send({ type: 'backend-ready' });
      process.exit(0);
    }
  });

  req.on('error', () => {
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(checkHealth, 500);
    } else {
      log('Backend health check failed');
      backend.kill();
      process.exit(1);
    }
  });
}

setTimeout(checkHealth, 2000);

process.on('SIGTERM', () => {
  log('Terminating backend');
  backend.kill();
  process.exit(0);
});
