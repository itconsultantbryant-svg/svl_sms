import crypto from 'crypto';
import {
  LICENSE_KEY_CONSTANTS,
  LICENSE_PLAN_CODES,
  LICENSE_CODE_PLANS,
} from './licensing';

// ISSUER — SERVER ONLY. Private key never bundled into the desktop app.
const DEV_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEICq2lZK7RCz81adFNK0OZpPS2VTSlIB9vmKp+0tP27bO
-----END PRIVATE KEY-----
`;

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
