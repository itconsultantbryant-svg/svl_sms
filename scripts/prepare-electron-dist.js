#!/usr/bin/env node
/**
 * Prepare dist/ layout expected by electron-builder.yml and electron/main.ts:
 *   dist/electron/  — main + preload
 *   dist/frontend/  — Vite production build
 *   dist/backend/   — compiled Express API
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

function run(cmd) {
  console.log(`\n==> ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Prefer local binaries over a global/wrong npx shim
      PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH || ''}`,
    },
  });
}

// better-sqlite3@13 ships prebuilt binaries for Node 20+ (including Node 24),
// so any modern Node works for building the desktop app.
function assertNodeSupported() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.error(
      `\nERROR: Node ${process.versions.node} detected. This project requires Node 20 or newer\n` +
        '  nvm install 20 && nvm use 20\n' +
        '  Then delete node_modules and run: npm install\n'
    );
    process.exit(1);
  }
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

assertNodeSupported();
console.log('==> Preparing Electron distribution layout (Node', process.versions.node + ')');

const distDir = path.join(root, 'dist');
rimraf(distDir);
ensureDir(distDir);

// Frontend → frontend/dist, then copy to dist/frontend.
// Built in `electron` mode (relative base, empty VITE_API_URL) so the bundle
// talks to the local backend at runtime instead of a baked-in cloud URL.
//
// Vite always loads frontend/.env (which pins the production cloud URL), and it
// would override .env.electron. Temporarily move .env aside so the electron mode
// build stays clean, then restore it afterwards.
const frontendDir = path.join(root, 'frontend');
const envPath = path.join(frontendDir, '.env');
const envBackup = path.join(frontendDir, '.env.bak');
const envExisted = fs.existsSync(envPath);
if (envExisted) {
  fs.renameSync(envPath, envBackup);
  console.log('==> Temporarily moved frontend/.env aside for electron build');
}
try {
  run('npm run build:frontend:electron');
} finally {
  if (envExisted) {
    fs.renameSync(envBackup, envPath);
    console.log('==> Restored frontend/.env');
  }
}
const frontendSrc = path.join(root, 'frontend', 'dist');
const frontendDest = path.join(distDir, 'frontend');
if (!fs.existsSync(path.join(frontendSrc, 'index.html'))) {
  console.error('Frontend build missing index.html at', frontendSrc);
  process.exit(1);
}
fs.cpSync(frontendSrc, frontendDest, { recursive: true });
console.log('==> Copied frontend → dist/frontend');

const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tscBin)) {
  console.error('TypeScript is missing. Run: nvm use 20 && rm -rf node_modules && npm install');
  process.exit(1);
}

// Backend → dist/backend (override outDir so it does not collide with electron/)
run(`node "${tscBin}" --project tsconfig.json --outDir dist/backend`);
if (!fs.existsSync(path.join(distDir, 'backend', 'index.js'))) {
  console.error('Backend build missing dist/backend/index.js');
  process.exit(1);
}
console.log('==> Built backend → dist/backend');

// Electron main/preload → dist/electron
run(`node "${tscBin}" --project tsconfig.electron.json`);
if (!fs.existsSync(path.join(distDir, 'electron', 'main.js'))) {
  console.error('Electron build missing dist/electron/main.js');
  process.exit(1);
}
console.log('==> Built electron → dist/electron');

// CRITICAL: better-sqlite3 is a native addon compiled against a specific Node
// ABI. The desktop backend runs under Electron's Node (ELECTRON_RUN_AS_NODE),
// NOT the system Node used to run this build script. If we don't rebuild it for
// Electron's ABI, require('better-sqlite3') throws "compiled against a different
// Node.js version" at startup and the app shows "Failed to start the backend".
// @electron/rebuild compiles every native module against the installed Electron.
const electronPkg = require('electron/package.json');
const electronVersion = electronPkg.version;
try {
  console.log(`\n==> Rebuilding native modules for Electron ${electronVersion}`);
  run(`npx --no-install electron-rebuild -f -w better-sqlite3 -v ${electronVersion}`);
  console.log('==> Native modules rebuilt for Electron');
} catch (err) {
  console.error(
    '\nERROR: electron-rebuild failed. The packaged desktop app will not start\n' +
      'because better-sqlite3 was compiled for the system Node, not Electron.\n' +
      'Fix: rm -rf node_modules && npm install, then retry the build.\n'
  );
  process.exit(1);
}

// CRITICAL: electron-builder runs its own npm install during packaging, which
// overwrites the rebuilt native modules with prebuilt binaries for system Node.
// Copy the rebuilt native modules to the source node_modules so electron-builder
// packages the Electron-compatible versions.
console.log('\n==> Copying rebuilt native modules to source node_modules for packaging...');
const srcBetterSqlite3 = path.join(root, 'node_modules', 'better-sqlite3');
const distBetterSqlite3 = path.join(root, 'dist', 'backend', 'node_modules', 'better-sqlite3');
if (fs.existsSync(distBetterSqlite3)) {
  // Copy the rebuilt native bindings to source
  const prebuildsSrc = path.join(distBetterSqlite3, 'prebuilds');
  const prebuildsDst = path.join(srcBetterSqlite3, 'prebuilds');
  if (fs.existsSync(prebuildsSrc)) {
    fs.cpSync(prebuildsSrc, prebuildsDst, { recursive: true });
    console.log('==> Copied rebuilt prebuilds to source node_modules/better-sqlite3/prebuilds');
  }
  // Also copy the lib/ directory which may contain the loaded binding
  const libSrc = path.join(distBetterSqlite3, 'lib');
  const libDst = path.join(srcBetterSqlite3, 'lib');
  if (fs.existsSync(libSrc)) {
    fs.cpSync(libSrc, libDst, { recursive: true });
    console.log('==> Copied rebuilt lib/ to source node_modules/better-sqlite3/lib');
  }
} else {
  console.warn('==> WARNING: dist/backend/node_modules/better-sqlite3 not found, using source as-is');
}

console.log('\n==> Electron dist layout ready');
