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

function assertNode20() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 20) {
    console.error(
      `\nERROR: Node ${process.versions.node} detected. This project requires Node 20.x\n` +
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

assertNode20();
console.log('==> Preparing Electron distribution layout (Node', process.versions.node + ')');

const distDir = path.join(root, 'dist');
rimraf(distDir);
ensureDir(distDir);

// Frontend → frontend/dist, then copy to dist/frontend
run('npm run build:frontend');
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

console.log('\n==> Electron dist layout ready');
