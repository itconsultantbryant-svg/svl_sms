#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * SVL-SMS License Key Generator CLI Tool
 *
 * Generates cryptographically signed license keys for SVL-SMS installations.
 * Keys are in format: SVL-XXXX-XXXX-XXXX-XXXX (36 chars)
 */

// ============================================================================
// Configuration
// ============================================================================

const LICENSES_DIR = path.join(__dirname, 'licenses');
const GENERATED_KEYS_FILE = path.join(LICENSES_DIR, 'generated-keys.json');

// Base62 alphabet (0-9, a-z, A-Z)
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Valid plan tiers
const VALID_PLANS = ['demo', 'standard', 'premium', 'enterprise'];

// RSA Private Key (or from environment variable)
const PRIVATE_KEY = process.env.LICENSE_PRIVATE_KEY || getDefaultPrivateKey();

// RSA Public Key (embedded in frontend/backend for verification)
const PUBLIC_KEY = getDefaultPublicKey();

// ============================================================================
// Utility Functions
// ============================================================================

function getDefaultPrivateKey() {
  // Default test RSA private key (for development)
  return `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQClPu1miK8xIsem
4bO3TX1wHtYVbs5COBJfTMjoYn8aIHE5gxvZOCDr85fV284BTbM4cvRzEm6RTd75
fy5P+C++v/25Ne9qv1+QsdPVCj/KCuHUYj2oSIN34f7B3T/Ap3G7qFbUpfwoRWZB
oay135fD0Tp6ZBWO5D5TULEoWl/adI6Rb+A3OozbvCm3Gmwp0NVQJblIkEF9vjW/
ioFXnZZKW2Jz07Q9tE8duqSISPvT8JwptnWHWxtNB+RkOurKVDruihWMbdZ5+1uq
g2HQ1w+th/huA1XKMIhjk5J3glDjji5b8N2DLQLSJ09SHTPbvkHollLSjRpcvfSd
Kn/ospJdAgMBAAECggEADmNVSRPmVTFBuw50lyWgd25n65koomwUGsd/yCQotv3+
KH4kTZyX2T5DiTPIqHpl0X4eOhVvxSfHnhJsgOVg8DXyrKQSmEkuKVYigK6SG/so
lf/b0yxFLjS3pD+pzmeF/UtMttqhAwylOQUPxGJB6k3seT2qVt/EFtMJfzRR8POz
R+ihi2A9PUpQQfifDV+CCzhLsCnh3TV0CtEcTAY/z54N/XaSIB/1D0lNIQnVoalv
BUvI/bBHR17Syc6/Fl3ZZmPfRz3nL7Mzp/TXOSQd4UnQoPMU1DQYAE4xOv3Igt0s
NvZODreBc4nsBhbDpeAiwfx1K1C5IezPSfJtEZq3DQKBgQDYWSfIsaiMaiQT85M3
AHgBOJYAHj4dintsFJ/WRVimG7sN3CGxBrsmgfSaa9qx8T5jQxJvkw3ILcvR7/Oh
Q9ncYG6DICkW8BPdiwWFG/I0MUwvTSs0iMhOgrbtzOkzcF0X8UFHOQu2Ut/f5zAC
uBB4g483v8pOZRB4e9DgRlaAGwKBgQDDiBiIRpQF2SvtUKQRb7Iw0eec6UojgzH7
pbDZtRDFRQxvxVrofYnFmeNcY3MeYGmp/w35tywgwds8pDZg9+ShB86pqBO1lQNC
8T8AdnmeyH+XapTJT/YDGS965/v4I+dzKAMPasto3PrcFsYsZm3MpjAxWaX9a/Lg
og7pdiKO5wKBgHpwqqVYdk1RXK218iD0sPXv8mSKuRi64PLgET2Q7YTEuO41IRQw
/QXkEmy6kYCXSXmf4fUnQmuCD5H2vOkNn2SrZp/rOZXztSpynWMh18dWBwnWIJeQ
udxE+gZHK8ui0ezU6t7GGCzNZkovaup/BUNPIWSptHL9m360hBgJdrb1AoGAeztS
+tBAik8M+ExSmwqia1Jffu0o5KjS357VjuAm6a1S4T6oxM4Z/oe2W4vyCbsJ3TH6
RN/E2ABVhCqaexLA7RxWi2Z6xX5cx9vzsP76N7B1eaCalSXoDpvY6MU8cG9wd4tI
IndUK4raL8vKqkEEAm7bAL9XdhiKwjhg3ZKuxRECgYEAxfC07xqirX9nifjHkGhI
/g5GVf2YYDP7hoUAG2tB3mSz4ijXQNA7NWlkwrgYNYXIvK+eq4stW9gzrPYq3Fmc
B8u5WaSSkURVMFN37+wQ9TIlYVrc4uQQJ7rzayYeRZ3pgrMECq/jxu43DN2cLsVL
MjfnXMygvb49jTxv4Ck06bQ=
-----END PRIVATE KEY-----`;
}

function getDefaultPublicKey() {
  return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApT7tZoivMSLHpuGzt019
cB7WFW7OQjgSX0zI6GJ/GiBxOYMb2Tgg6/OX1dvOAU2zOHL0cxJukU3e+X8uT/gv
vr/9uTXvar9fkLHT1Qo/ygrh1GI9qEiDd+H+wd0/wKdxu6hW1KX8KEVmQaGstd+X
w9E6emQVjuQ+U1CxKFpf2nSOkW/gNzqM27wptxpsKdDVUCW5SJBBfb41v4qBV52W
Sltic9O0PbRPHbqkiEj70/CcKbZ1h1sbTQfkZDrqylQ67ooVjG3WeftbqoNh0NcP
rYf4bgNVyjCIY5OSd4JQ444uW/Ddgy0C0idPUh0z275B6JZS0o0aXL30nSp/6LKS
XQIDAQAB
-----END PUBLIC KEY-----`;
}

function base62Encode(num) {
  if (num === 0n) return BASE62_ALPHABET[0];

  let result = '';
  let n = num;

  while (n > 0n) {
    result = BASE62_ALPHABET[Number(n % 62n)] + result;
    n = n / 62n;
  }

  return result;
}

function base62Decode(str) {
  let result = 0n;

  for (const char of str) {
    result = result * 62n + BigInt(BASE62_ALPHABET.indexOf(char));
  }

  return result;
}

function institutionToCode(name) {
  const words = name.trim().split(/\s+/);
  let code = '';

  for (const word of words) {
    if (code.length < 4) {
      code += word[0].toUpperCase();
    }
  }

  return code.padEnd(4, 'X').slice(0, 4);
}

function planToCode(plan) {
  const planCodes = {
    demo: '0',
    standard: '1',
    premium: '2',
    enterprise: '3',
  };
  return planCodes[plan] || '0';
}

function codeToPlan(code) {
  const plans = {
    '0': 'demo',
    '1': 'standard',
    '2': 'premium',
    '3': 'enterprise',
  };
  return plans[code] || 'unknown';
}

function validateMachineId(machineId) {
  const hexRegex = /^[a-f0-9]{16,32}$/i;
  return hexRegex.test(machineId);
}

function validateExpiryDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();

    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
    }

    if (date <= now) {
      return { valid: false, error: 'Expiry date must be in the future' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid date format' };
  }
}

function getMonthsRemaining(expiryDate) {
  const expiry = new Date(expiryDate);
  const now = new Date();

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  return Math.max(0, months);
}

// ============================================================================
// License Key Generation & Validation
// ============================================================================

function generateLicenseKey(data) {
  const institutionCode = institutionToCode(data.institution);
  const expiryTime = Math.floor(new Date(data.expiry).getTime() / 1000);
  const planCode = planToCode(data.plan);
  const machineIdHash = data.machineId
    ? crypto.createHash('sha256').update(data.machineId).digest('hex').slice(0, 8)
    : '00000000';

  // Create data string with all hex-encoded parts
  const institutionHex = Buffer.from(institutionCode.padEnd(4, ' ')).toString('hex');
  const expiryHex = expiryTime.toString(16).padStart(8, '0');
  const planHex = planCode.charCodeAt(0).toString(16).padStart(2, '0');

  const dataHexString = institutionHex + expiryHex + planHex + machineIdHash;
  const dataBuffer = Buffer.from(dataHexString, 'hex');

  const sign = crypto.createSign('sha256');
  sign.update(dataBuffer);
  const signature = sign.sign(PRIVATE_KEY, 'hex');

  const signatureBigInt = BigInt('0x' + signature.slice(0, 32));
  let checksumBase62 = base62Encode(signatureBigInt);
  checksumBase62 = checksumBase62.slice(0, 12).padEnd(12, '0');

  const dataBigInt = BigInt('0x' + dataHexString);
  const dataBase62 = base62Encode(dataBigInt).padStart(16, '0');

  const segment1 = dataBase62.slice(0, 4);
  const segment2 = dataBase62.slice(4, 8);
  const segment3 = dataBase62.slice(8, 12);
  const segment4 = checksumBase62.slice(0, 4);

  return `SVL-${segment1}-${segment2}-${segment3}-${segment4}`;
}

function decodeLicenseKey(key) {
  if (!key.match(/^SVL-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)) {
    return null;
  }

  const parts = key.split('-');
  const segment1 = parts[1];
  const segment2 = parts[2];
  const segment3 = parts[3];

  try {
    const dataHex = (base62Decode(segment1 + segment2 + segment3).toString(16)).padStart(24, '0');

    const institutionCode = Buffer.from(dataHex.slice(0, 8), 'hex').toString('utf8').trim();
    const expiryTime = parseInt(dataHex.slice(8, 16), 16);
    const planCode = dataHex.slice(16, 17);

    const expiryDate = new Date(expiryTime * 1000).toISOString().split('T')[0];
    const plan = codeToPlan(planCode);

    return {
      institution: institutionCode,
      expiry: expiryDate,
      plan: plan,
    };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// License Database Management
// ============================================================================

function ensureLicensesDir() {
  if (!fs.existsSync(LICENSES_DIR)) {
    fs.mkdirSync(LICENSES_DIR, { recursive: true });
  }
}

function loadGeneratedKeys() {
  ensureLicensesDir();

  if (!fs.existsSync(GENERATED_KEYS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(GENERATED_KEYS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveGeneratedKeys(keys) {
  ensureLicensesDir();
  fs.writeFileSync(GENERATED_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

// ============================================================================
// CLI Commands
// ============================================================================

async function cmdGenerate(args) {
  const institution = args.institution;
  const expiry = args.expiry;
  const plan = args.plan;
  const machineId = args['machine-id'];

  if (!institution || !expiry || !plan) {
    console.error('Error: Missing required arguments');
    console.error('Usage: generate --institution "Name" --expiry YYYY-MM-DD --plan <plan>');
    process.exit(1);
  }

  const expiryValidation = validateExpiryDate(expiry);
  if (!expiryValidation.valid) {
    console.error(`Error: ${expiryValidation.error}`);
    process.exit(1);
  }

  if (!VALID_PLANS.includes(plan)) {
    console.error(`Error: Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`);
    process.exit(1);
  }

  if (machineId && !validateMachineId(machineId)) {
    console.error('Error: Invalid machine ID. Must be 16-32 hex characters');
    process.exit(1);
  }

  const licenseData = {
    institution,
    expiry,
    plan,
    machineId,
  };

  const key = generateLicenseKey(licenseData);
  const metadata = {
    ...licenseData,
    key,
    generatedAt: new Date().toISOString(),
    revoked: false,
  };

  const keys = loadGeneratedKeys();
  keys.push(metadata);
  saveGeneratedKeys(keys);

  const monthsRemaining = getMonthsRemaining(expiry);
  console.log('\n✓ License Key Generated:\n');
  console.log(`  ${key}\n`);
  console.log(`  Institution: ${institution}`);
  console.log(`  Expiry: ${expiry} (${monthsRemaining} months remaining)`);
  console.log(`  Plan: ${plan}`);
  if (machineId) {
    console.log(`  Machine ID: ${machineId}`);
  }
  console.log('\n  Save this key. You can only generate it once.');
  console.log('  Give it to the client via secure channel.\n');
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
    const monthsRemaining = getMonthsRemaining(key.expiry);
    const isExpired = monthsRemaining <= 0;

    console.log(`${statusColor} ${key.key}`);
    console.log(`   Institution: ${key.institution}`);
    console.log(`   Plan: ${key.plan}`);
    console.log(`   Expiry: ${key.expiry} (${monthsRemaining} months) ${isExpired ? '(EXPIRED)' : ''}`);
    console.log(`   Generated: ${new Date(key.generatedAt).toLocaleDateString()}`);
    if (key.revoked && key.revokedAt) {
      console.log(`   Revoked: ${new Date(key.revokedAt).toLocaleDateString()}`);
    }
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
  const keyIndex = keys.findIndex(k => k.key === keyToRevoke);

  if (keyIndex === -1) {
    console.error(`Error: Key not found: ${keyToRevoke}`);
    process.exit(1);
  }

  if (keys[keyIndex].revoked) {
    console.log(`\nKey ${keyToRevoke} is already revoked.\n`);
    return;
  }

  keys[keyIndex].revoked = true;
  keys[keyIndex].revokedAt = new Date().toISOString();
  saveGeneratedKeys(keys);

  console.log(`\n✓ Key revoked: ${keyToRevoke}\n`);
}

async function cmdValidate(args) {
  const key = args.key;

  if (!key) {
    console.error('Error: Missing required --key argument');
    process.exit(1);
  }

  const data = decodeLicenseKey(key);

  if (!data) {
    console.error(`\n❌ Invalid license key format: ${key}\n`);
    process.exit(1);
  }

  const monthsRemaining = getMonthsRemaining(data.expiry);
  const isExpired = monthsRemaining <= 0;

  console.log('\n✓ License Key Valid:\n');
  console.log(`  Key: ${key}`);
  console.log(`  Institution: ${data.institution}`);
  console.log(`  Plan: ${data.plan}`);
  console.log(`  Expiry: ${data.expiry}`);
  console.log(`  Status: ${isExpired ? 'EXPIRED' : 'ACTIVE'}`);
  console.log(`  Months Remaining: ${monthsRemaining}\n`);
}

async function cmdExport(args) {
  const format = args.format || 'csv';
  const keys = loadGeneratedKeys();

  if (keys.length === 0) {
    console.log('No keys to export.\n');
    return;
  }

  if (format === 'csv') {
    const rows = [
      'Key,Institution,Plan,Expiry,Generated,Status',
      ...keys.map(k =>
        `${k.key},${k.institution},${k.plan},${k.expiry},${new Date(k.generatedAt).toLocaleDateString()},${k.revoked ? 'REVOKED' : 'ACTIVE'}`
      ),
    ];
    console.log(rows.join('\n'));
  } else if (format === 'json') {
    console.log(JSON.stringify(keys, null, 2));
  } else {
    console.error(`Error: Unsupported format: ${format}`);
    process.exit(1);
  }
}

// ============================================================================
// CLI Argument Parser
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const parsedArgs = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsedArgs[key] = args[i + 1];
        i++;
      } else {
        parsedArgs[key] = true;
      }
    }
  }

  return { command, args: parsedArgs };
}

function printHelp() {
  console.log(`
SVL-SMS License Key Generator

Usage:
  node generate-license.js <command> [options]

Commands:
  generate    Generate a new license key
              Options:
                --institution "Name"      Institution name (required)
                --expiry YYYY-MM-DD       Expiry date (required)
                --plan <plan>             Plan tier: demo, standard, premium, enterprise (required)
                --machine-id "MAC_ADDR"   Optional machine ID (16-32 hex chars)

  list        List all generated license keys

  revoke      Revoke a license key
              Options:
                --key "SVL-XXXX-XXXX-XXXX-XXXX"   License key to revoke (required)

  validate    Validate and decode a license key
              Options:
                --key "SVL-XXXX-XXXX-XXXX-XXXX"   License key to validate (required)

  export      Export all keys to CSV or JSON
              Options:
                --format csv|json         Output format (default: csv)

Examples:
  node generate-license.js generate \\
    --institution "Lincoln High School" \\
    --expiry "2025-12-31" \\
    --plan "standard"

  node generate-license.js list

  node generate-license.js revoke --key "SVL-ABCD-EFGH-IJKL-MNOP"
`);
}

// ============================================================================
// Main
// ============================================================================

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
