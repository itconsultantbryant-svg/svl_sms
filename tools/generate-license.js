#!/usr/bin/env node

// ============================================================================
// SVL-SMS License Key Generator CLI
//
// Issues cryptographically signed license keys (Ed25519) using the same scheme
// the desktop app verifies offline (src/utils/licensing.ts). The PRIVATE key
// below MUST match the server's LICENSE_PRIVATE_KEY and the PUBLIC key embedded
// in the app. Set LICENSE_PRIVATE_KEY in the environment to override.
//
// Format: SVL-XXXX-XXXX-...-XXXX (28 groups of 4 Crockford base32)
//   payload (6 bytes): version(1) | expiryDays(uint32 LE) | tier(uint8)
//   signature (64 bytes): Ed25519 over payload
// ============================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LICENSES_DIR = path.join(__dirname, 'licenses');
const GENERATED_KEYS_FILE = path.join(LICENSES_DIR, 'generated-keys.json');

// Crockford base32 — case-insensitive, no I/L/O/U/0 confusables.
const B32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_VERSION = 1;
const PAYLOAD_BYTES = 6;
const SIGNATURE_BYTES = 64;
const TOTAL_BYTES = PAYLOAD_BYTES + SIGNATURE_BYTES; // 70
const GROUP_COUNT = 28;

const PLAN_BY_CODE = { 1: 'demo', 2: 'standard', 3: 'premium', 4: 'enterprise' };
const CODE_BY_PLAN = { demo: 1, standard: 2, premium: 3, enterprise: 4 };

const VALID_PLANS = ['demo', 'standard', 'premium', 'enterprise'];

// DEV private key (matches src/utils/license-issuer.ts). Override with the
// production LICENSE_PRIVATE_KEY env var.
const DEV_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEICq2lZK7RCz81adFNK0OZpPS2VTSlIB9vmKp+0tP27bO
-----END PRIVATE KEY-----
`;

function getPrivateKey() {
  const envKey = process.env.LICENSE_PRIVATE_KEY;
  if (envKey && envKey.trim().length > 0) {
    try {
      return crypto.createPrivateKey(envKey.trim());
    } catch (e) {
      console.error('LICENSE_PRIVATE_KEY is invalid — using DEV key.');
    }
  }
  return crypto.createPrivateKey(DEV_PRIVATE_KEY_PEM);
}

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function issueLicenseKey({ planTier, expiryDays }) {
  const tierCode = CODE_BY_PLAN[planTier];
  if (!tierCode) throw new Error(`Invalid plan tier: ${planTier}`);

  const expiry = new Date(Date.now() + expiryDays * 86400000);
  const expiryDayInt = Math.floor(expiry.getTime() / 86400000);

  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload[0] = KEY_VERSION;
  payload[1] = expiryDayInt & 0xff;
  payload[2] = (expiryDayInt >>> 8) & 0xff;
  payload[3] = (expiryDayInt >>> 16) & 0xff;
  payload[4] = (expiryDayInt >>> 24) & 0xff;
  payload[5] = tierCode;

  const signature = crypto.sign(null, payload, getPrivateKey());
  const raw = Buffer.concat([payload, signature]);

  const b32 = base32Encode(raw);
  const groups = [];
  for (let i = 0; i < b32.length; i += 4) groups.push(b32.slice(i, i + 4));

  return { key: `SVL-${groups.join('-')}`, expiry, planTier };
}

// ---- generated-keys persistence (unchanged behavior) ----

function ensureLicensesDir() {
  if (!fs.existsSync(LICENSES_DIR)) fs.mkdirSync(LICENSES_DIR, { recursive: true });
}
function loadGeneratedKeys() {
  ensureLicensesDir();
  if (!fs.existsSync(GENERATED_KEYS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(GENERATED_KEYS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}
function saveGeneratedKeys(keys) {
  ensureLicensesDir();
  fs.writeFileSync(GENERATED_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

function validateExpiryDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
    if (date <= now) return { valid: false, error: 'Expiry date must be in the future' };
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid date format' };
  }
}

function getMonthsRemaining(expiryDate) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.max(0, (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth()));
}

// ---- CLI ----

async function cmdGenerate(args) {
  const institution = args.institution;
  const expiry = args.expiry;
  const plan = args.plan;

  if (!institution || !expiry || !plan) {
    console.error('Error: Missing required arguments');
    console.error('Usage: generate --institution "Name" --expiry YYYY-MM-DD --plan <plan>');
    process.exit(1);
  }
  const ev = validateExpiryDate(expiry);
  if (!ev.valid) {
    console.error(`Error: ${ev.error}`);
    process.exit(1);
  }
  if (!VALID_PLANS.includes(plan)) {
    console.error(`Error: Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`);
    process.exit(1);
  }

  const expiryDays = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  const { key, expiry: e, planTier } = issueLicenseKey({ planTier: plan, expiryDays });

  const metadata = {
    institution,
    expiry,
    plan: planTier,
    key,
    generatedAt: new Date().toISOString(),
    revoked: false,
  };
  const keys = loadGeneratedKeys();
  keys.push(metadata);
  saveGeneratedKeys(keys);

  console.log('\n✓ License Key Generated:\n');
  console.log(`  ${key}\n`);
  console.log(`  Institution: ${institution}`);
  console.log(`  Expiry: ${expiry} (${getMonthsRemaining(expiry)} months remaining)`);
  console.log(`  Plan: ${planTier}`);
  console.log('\n  Save this key. Give it to the client via secure channel.\n');
}

async function cmdList(args) {
  const keys = loadGeneratedKeys();
  if (keys.length === 0) {
    console.log('\nNo license keys generated yet.\n');
    return;
  }
  console.log('\n' + '='.repeat(100));
  console.log('License Keys Generated');
  console.log('='.repeat(100) + '\n');
  for (const key of keys) {
    const status = key.revoked ? 'REVOKED' : 'ACTIVE';
    const statusColor = key.revoked ? '❌' : '✓ ';
    const months = getMonthsRemaining(key.expiry);
    console.log(`${statusColor} ${key.key}`);
    console.log(`   Institution: ${key.institution}`);
    console.log(`   Plan: ${key.plan}`);
    console.log(`   Expiry: ${key.expiry} (${months} months) ${months <= 0 ? '(EXPIRED)' : ''}`);
    if (key.revoked && key.revokedAt) console.log(`   Revoked: ${new Date(key.revokedAt).toLocaleDateString()}`);
    console.log();
  }
  console.log('='.repeat(100) + '\n');
}

async function cmdRevoke(args) {
  const keyToRevoke = args.key;
  if (!keyToRevoke) {
    console.error('Error: Missing required --key argument');
    process.exit(1);
  }
  const keys = loadGeneratedKeys();
  const idx = keys.findIndex((k) => k.key === keyToRevoke);
  if (idx === -1) {
    console.error(`Error: Key not found: ${keyToRevoke}`);
    process.exit(1);
  }
  if (keys[idx].revoked) {
    console.log(`\nKey ${keyToRevoke} is already revoked.\n`);
    return;
  }
  keys[idx].revoked = true;
  keys[idx].revokedAt = new Date().toISOString();
  saveGeneratedKeys(keys);
  console.log(`\n✓ Key revoked: ${keyToRevoke}\n`);
}

async function cmdValidate(args) {
  const key = args.key;
  if (!key) {
    console.error('Error: Missing required --key argument');
    process.exit(1);
  }
  // Re-run the same offline verification the app uses.
  const { validateLicenseKey } = require('./verify-license.js');
  const result = validateLicenseKey(key);
  if (!result.valid) {
    console.error(`\n❌ Invalid license key: ${key}\n`);
    process.exit(1);
  }
  const months = getMonthsRemaining(result.expiry.toISOString());
  console.log('\n✓ License Key Valid:\n');
  console.log(`  Key: ${key}`);
  console.log(`  Plan: ${result.planTier}`);
  console.log(`  Expiry: ${result.expiry.toISOString()}`);
  console.log(`  Status: ${months <= 0 ? 'EXPIRED' : 'ACTIVE'}`);
  console.log(`  Months Remaining: ${months}\n`);
}

async function cmdExport(args) {
  const format = args.format || 'csv';
  const keys = loadGeneratedKeys();
  if (keys.length === 0) {
    console.log('No keys to export.\n');
    return;
  }
  if (format === 'csv') {
    console.log(
      [
        'Key,Institution,Plan,Expiry,Generated,Status',
        ...keys.map(
          (k) =>
            `${k.key},${k.institution},${k.plan},${k.expiry},${new Date(k.generatedAt).toLocaleDateString()},${k.revoked ? 'REVOKED' : 'ACTIVE'}`
        ),
      ].join('\n')
    );
  } else if (format === 'json') {
    console.log(JSON.stringify(keys, null, 2));
  } else {
    console.error(`Error: Unsupported format: ${format}`);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }
  const command = args[0];
  const parsed = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return { command, args: parsed };
}

function printHelp() {
  console.log(`
SVL-SMS License Key Generator

Usage:
  node generate-license.js <command> [options]

Commands:
  generate    Generate a new license key
              --institution "Name"      Institution name (required)
              --expiry YYYY-MM-DD       Expiry date (required)
              --plan <plan>             demo | standard | premium | enterprise (required)
  list        List all generated license keys
  revoke      --key "SVL-..."           Revoke a key
  validate    --key "SVL-..."           Verify a key (same check the app uses)
  export      --format csv|json         Export all keys

Examples:
  node generate-license.js generate --institution "Lincoln High" --expiry "2030-12-31" --plan "standard"
  node generate-license.js validate --key "SVL-..."
`);
}

async function main() {
  try {
    const { command, args } = parseArgs();
    switch (command) {
      case 'generate':
        await cmdGenerate(args);
        break;
      case 'list':
        await cmdList(args);
        break;
      case 'revoke':
        await cmdRevoke(args);
        break;
      case 'validate':
        await cmdValidate(args);
        break;
      case 'export':
        await cmdExport(args);
        break;
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
      default:
        console.error(`Error: Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
