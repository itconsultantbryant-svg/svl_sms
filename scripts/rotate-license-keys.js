// One-off key rotation helper. Generates a fresh Ed25519 keypair, writes the
// PRIVATE key into the server-side issuer + CLI (never bundled to desktop) and
// the PUBLIC key into the desktop verifiers. Keeps the private key out of the
// shell command line / transcript. Run: node scripts/rotate-license-keys.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
crypto.createPrivateKey(privPem);
crypto.createPublicKey({ key: Buffer.from(pubB64, 'base64'), format: 'der', type: 'spki' });

const BQ = String.fromCharCode(96);

// 1) license-issuer.ts
const issuer = `import crypto from 'crypto';
import {
  LICENSE_KEY_CONSTANTS,
  LICENSE_PLAN_CODES,
  LICENSE_CODE_PLANS,
} from './licensing';

// ISSUER — SERVER ONLY. Private key never bundled into the desktop app.
const DEV_PRIVATE_KEY_PEM = ${BQ}${privPem}${BQ};

function getPrivateKey(): crypto.KeyObject {
  const envKey = process.env.LICENSE_PRIVATE_KEY;
  if (envKey && envKey.trim().length > 0) {
    try {
      return crypto.createPrivateKey(envKey.trim());
    } catch {
      console.warn('[licensing] LICENSE_PRIVATE_KEY invalid — using DEV key.');
    }
  }
  console.warn('[licensing] LICENSE_PRIVATE_KEY not set — using DEV keypair.');
  return crypto.createPrivateKey(DEV_PRIVATE_KEY_PEM);
}

export interface IssueLicenseInput { planTier: string; expiryDays: number; }
export interface IssuedLicense { key: string; expiry: Date; planTier: string; }

export function issueLicenseKey(input: IssueLicenseInput): IssuedLicense {
  const planTier = input.planTier || 'standard';
  const tierCode = LICENSE_PLAN_CODES[planTier];
  if (!tierCode) throw new Error('Invalid plan tier: ' + planTier);
  const expiry = new Date(Date.now() + input.expiryDays * 86400000);
  const expiryDays = Math.floor(expiry.getTime() / 86400000);
  const payload = Buffer.alloc(LICENSE_KEY_CONSTANTS.PAYLOAD_BYTES);
  payload[0] = LICENSE_KEY_CONSTANTS.KEY_VERSION;
  payload[1] = expiryDays & 0xff;
  payload[2] = (expiryDays >>> 8) & 0xff;
  payload[3] = (expiryDays >>> 16) & 0xff;
  payload[4] = (expiryDays >>> 24) & 0xff;
  payload[5] = tierCode;
  const signature = crypto.sign(null, payload, getPrivateKey());
  const raw = Buffer.concat([payload, signature]);
  const b32 = base32Encode(raw);
  const groups: string[] = [];
  for (let i = 0; i < b32.length; i += 4) groups.push(b32.slice(i, i + 4));
  const key = 'SVL-' + groups.join('-');
  return { key, expiry, planTier };
}

const B32_ALPHABET = LICENSE_KEY_CONSTANTS.B32_ALPHABET;
function base32Encode(bytes: Buffer): string {
  let bits = 0; let value = 0; let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export { LICENSE_PLAN_CODES, LICENSE_CODE_PLANS };
`;
fs.writeFileSync(path.join(root, 'src/utils/license-issuer.ts'), issuer);

// 2) licensing.ts (public key only)
let l = fs.readFileSync(path.join(root, 'src/utils/licensing.ts'), 'utf8');
l = l.replace(/const LICENSE_PUBLIC_KEY_B64 = .*;/, `const LICENSE_PUBLIC_KEY_B64 = '${pubB64}';`);
fs.writeFileSync(path.join(root, 'src/utils/licensing.ts'), l);

// 3) generate-license.js (private key only)
let c = fs.readFileSync(path.join(root, 'tools/generate-license.js'), 'utf8');
c = c.replace(/const DEV_PRIVATE_KEY_PEM = [\s\S]*?;/, `const DEV_PRIVATE_KEY_PEM = ${BQ}${privPem}${BQ};`);
fs.writeFileSync(path.join(root, 'tools/generate-license.js'), c);

// 4) verify-license.js (public key only)
let v = fs.readFileSync(path.join(root, 'tools/verify-license.js'), 'utf8');
v = v.replace(/const LICENSE_PUBLIC_KEY_B64 = .*;/, `const LICENSE_PUBLIC_KEY_B64 = '${pubB64}';`);
fs.writeFileSync(path.join(root, 'tools/verify-license.js'), v);

console.log('Rotated license keypair. Public key embedded in desktop verifiers; private key in issuer + CLI only.');
console.log('Set LICENSE_PRIVATE_KEY on the server to override the DEV key for production keys.');
