#!/usr/bin/env node
/**
 * Zip the Windows NSIS Setup.exe into a distributable archive:
 *   out/SVL-SMS-<version>-Windows.zip
 *     └── SVL-SMS-Setup-<version>.exe
 */
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');

async function main() {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = pkg.version;
  const outDir = path.join(root, 'out');

  if (!fs.existsSync(outDir)) {
    console.error('out/ not found. Run the Windows electron build first.');
    process.exit(1);
  }

  const setupName = `SVL-SMS-Setup-${version}.exe`;
  const setupPath = path.join(outDir, setupName);

  // Fallback: find any Setup*.exe produced by electron-builder
  let exePath = setupPath;
  if (!fs.existsSync(exePath)) {
    const candidates = fs
      .readdirSync(outDir)
      .filter((f) => f.toLowerCase().endsWith('.exe') && /setup/i.test(f));
    if (candidates.length === 0) {
      const allExe = fs.readdirSync(outDir).filter((f) => f.toLowerCase().endsWith('.exe'));
      console.error('No Setup.exe found in out/. Found:', allExe.join(', ') || '(none)');
      process.exit(1);
    }
    exePath = path.join(outDir, candidates[0]);
  }

  const zipName = `SVL-SMS-${version}-Windows.zip`;
  const zipPath = path.join(outDir, zipName);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  let archiver;
  try {
    archiver = require('archiver');
  } catch {
    console.error('archiver is required. Run: npm install -D archiver');
    process.exit(1);
  }

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.file(exePath, { name: path.basename(exePath) });
    archive.finalize();
  });

  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`\n==> Created ${zipName} (${sizeMb} MB)`);
  console.log(`    Contains: ${path.basename(exePath)}`);
  console.log(`    Path: ${zipPath}`);
  console.log('\nSchool install flow:');
  console.log('  1. Download and extract the ZIP');
  console.log('  2. Run the Setup .exe');
  console.log('  3. Follow the installer wizard');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
