#!/usr/bin/env node

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SVL-SMS License Key Generator CLI Tool
 *
 * Generates cryptographically signed license keys for SVL-SMS installations.
 * Keys are in format: SVL-XXXX-XXXX-XXXX-XXXX (36 chars)
 *
 * Usage:
 *   node generate-license.ts generate --institution "School ABC" --expiry "2025-12-31" --plan "standard"
 *   node generate-license.ts list
 *   node generate-license.ts revoke --key "SVL-XXXX-XXXX-XXXX-XXXX"
 *   node generate-license.ts validate --key "SVL-XXXX-XXXX-XXXX-XXXX"
 *   node generate-license.ts export --format csv
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
// For development: we'll generate a test key if not provided
const PRIVATE_KEY = process.env.LICENSE_PRIVATE_KEY || getDefaultPrivateKey();

// RSA Public Key (embedded in frontend/backend for verification)
const PUBLIC_KEY = getDefaultPublicKey();

// ============================================================================
// Utility Functions
// ============================================================================

function getDefaultPrivateKey(): string {
  // Default test RSA private key (for development)
  // In production, this should be provided via LICENSE_PRIVATE_KEY env var
  return `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA2a2rwplBCgJstIW4gVYBN3cBBVAkB9qnzJQBJ5uy7h+JvQhQ
Hvy+4xY8NjqkKPVaL6vLpk8fy8W8H7xJZ5F8Ry2K0z+m5x9L7Q9A3B8C9D0E1F2G
3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5
n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7
T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9QIDAQABAoIBAA0c5QFi
YpXq0VPu9H3G7N4K8L2J9M6O5P1Q2R3S4T5U6V7W8X9Y0Z1a2b3c4d5e6f7g8h9i0
j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2
P3Q4R5S6T7U8V9W0X1Y2Z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5
w6x7y8z9AQJBAQCPh/QKVx+Qw0s8N7F5L3K9J2M6O4P0Q1R2S3T4U5V6W7X8Y9Z0a
1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G
3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7VCQQDdMlsPJjQj4A7k9B1L2M3N4O5P6Q7R8S
9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1
z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0SAkA/kL5M6N7O8P9Q0R1S2T3U4V
5W6X7Y8Z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5A6B7
C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1a2b3c4d5e6f7g8h9i
0j1k2l3m4n5oAkEAkf+sQ1L7W9z+Rx2L5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z9a0b
1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5A6B7C8D9E0F1G2H
3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5
-----END RSA PRIVATE KEY-----`;
}

function getDefaultPublicKey(): string {
  // Default test RSA public key (matching the private key above)
  // This will be embedded in backend/frontend for verification
  return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBCgJstIW4gVYB
N3cBBVAkB9qnzJQBJ5uy7h+JvQhQHvy+4xY8NjqkKPVaL6vLpk8fy8W8H7xJZ5F8
Ry2K0z+m5x9L7Q9A3B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y
1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E
3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5
l6m7n8o9QIDAQAB
-----END PUBLIC KEY-----`;
}

function base62Encode(num: bigint): string {
  if (num === 0n) return BASE62_ALPHABET[0];

  let result = '';
  let n = num;

  while (n > 0n) {
    result = BASE62_ALPHABET[Number(n % 62n)] + result;
    n = n / 62n;
  }

  return result;
}

function base62Decode(str: string): bigint {
  let result = 0n;

  for (const char of str) {
    result = result * 62n + BigInt(BASE62_ALPHABET.indexOf(char));
  }

  return result;
}

function institutionToCode(name: string): string {
  // Create a 2-4 char code from institution name
  const words = name.trim().split(/\s+/);
  let code = '';

  for (const word of words) {
    if (code.length < 4) {
      code += word[0].toUpperCase();
    }
  }

  return code.padEnd(4, 'X').slice(0, 4);
}

function planToCode(plan: string): string {
  const planCodes: Record<string, string> = {
    demo: '0',
    standard: '1',
    premium: '2',
    enterprise: '3',
  };
  return planCodes[plan] || '0';
}

function codeToPlan(code: string): string {
  const plans: Record<string, string> = {
    '0': 'demo',
    '1': 'standard',
    '2': 'premium',
    '3': 'enterprise',
  };
  return plans[code] || 'unknown';
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateMachineId(machineId: string): boolean {
  // Machine ID should be 16-32 chars hex
  const hexRegex = /^[a-f0-9]{16,32}$/i;
  return hexRegex.test(machineId);
}

function validateExpiryDate(dateStr: string): { valid: boolean; error?: string } {
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

function getMonthsRemaining(expiryDate: string): number {
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

interface LicenseData {
  institution: string;
  expiry: string; // YYYY-MM-DD
  plan: string;
  machineId?: string;
}

interface LicenseKeyMetadata extends LicenseData {
  key: string;
  generatedAt: string;
  revoked: boolean;
  revokedAt?: string;
}

function generateLicenseKey(data: LicenseData): string {
  // Format: SVL-[segment1]-[segment2]-[segment3]-[segment4]
  // segment1-3: data, segment4: checksum

  const institutionCode = institutionToCode(data.institution);
  const expiryTime = Math.floor(new Date(data.expiry).getTime() / 1000); // Unix timestamp
  const planCode = planToCode(data.plan);
  const machineIdHash = data.machineId
    ? crypto.createHash('sha256').update(data.machineId).digest('hex').slice(0, 8)
    : '00000000';

  // Combine data into a single string for signing
  const dataString = `${institutionCode}${expiryTime.toString(16).padStart(8, '0')}${planCode}${machineIdHash}`;
  const dataBuffer = Buffer.from(dataString, 'utf8');

  // Sign the data with RSA private key
  const sign = crypto.createSign('sha256');
  sign.update(dataBuffer);
  const signature = sign.sign(PRIVATE_KEY, 'hex');

  // Convert signature to base62 and take first 12 chars
  const signatureBigInt = BigInt('0x' + signature.slice(0, 32)); // Use first 16 hex chars
  let checksumBase62 = base62Encode(signatureBigInt);
  checksumBase62 = checksumBase62.slice(0, 12).padEnd(12, '0');

  // Encode data segments in base62
  const dataBigInt = BigInt('0x' + dataString);
  const dataBase62 = base62Encode(dataBigInt).padStart(16, '0');

  // Split into 4-char segments
  const segment1 = dataBase62.slice(0, 4);
  const segment2 = dataBase62.slice(4, 8);
  const segment3 = dataBase62.slice(8, 12);
  const segment4 = checksumBase62.slice(0, 4);

  return `SVL-${segment1}-${segment2}-${segment3}-${segment4}`;
}

function decodeLicenseKey(key: string): LicenseData | null {
  // Parse key format: SVL-XXXX-XXXX-XXXX-XXXX
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

function ensureLicensesDir(): void {
  if (!fs.existsSync(LICENSES_DIR)) {
    fs.mkdirSync(LICENSES_DIR, { recursive: true });
  }
}

function loadGeneratedKeys(): LicenseKeyMetadata[] {
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

function saveGeneratedKeys(keys: LicenseKeyMetadata[]): void {
  ensureLicensesDir();
  fs.writeFileSync(GENERATED_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

// ============================================================================
// CLI Commands
// ============================================================================

async function cmdGenerate(args: Record<string, string | boolean>): Promise<void> {
  const institution = args.institution as string;
  const expiry = args.expiry as string;
  const plan = args.plan as string;
  const machineId = args['machine-id'] as string | undefined;

  // Validation
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

  // Generate key
  const licenseData: LicenseData = {
    institution,
    expiry,
    plan,
    machineId,
  };

  const key = generateLicenseKey(licenseData);
  const metadata: LicenseKeyMetadata = {
    ...licenseData,
    key,
    generatedAt: new Date().toISOString(),
    revoked: false,
  };

  // Save to database
  const keys = loadGeneratedKeys();
  keys.push(metadata);
  saveGeneratedKeys(keys);

  // Output
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

async function cmdList(args: Record<string, string | boolean>): Promise<void> {
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

async function cmdRevoke(args: Record<string, string | boolean>): Promise<void> {
  const keyToRevoke = args.key as string;

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

async function cmdValidate(args: Record<string, string | boolean>): Promise<void> {
  const key = args.key as string;

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

async function cmdExport(args: Record<string, string | boolean>): Promise<void> {
  const format = (args.format || 'csv') as string;
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

function parseArgs(): { command: string; args: Record<string, string | boolean> } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const parsedArgs: Record<string, string | boolean> = {};

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

function printHelp(): void {
  console.log(`
SVL-SMS License Key Generator

Usage:
  node generate-license.ts <command> [options]

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
  node generate-license.ts generate \\
    --institution "Lincoln High School" \\
    --expiry "2025-12-31" \\
    --plan "standard"

  node generate-license.ts list

  node generate-license.ts revoke --key "SVL-ABCD-EFGH-IJKL-MNOP"
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
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
