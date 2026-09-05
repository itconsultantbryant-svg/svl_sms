#!/usr/bin/env node

// Offline license key VERIFICATION — mirrors src/utils/licensing.ts exactly.
// Exposed for the CLI generator's `validate` command. No private key needed.

const crypto = require('crypto');

const LICENSE_PUBLIC_KEY_B64 =
  'MCowBQYDK2VwAyEA7ZcSBN/eDFnIH7PRFLbyoHwgZBoOQzoxcn6GnF84mtc=';

const B32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_VERSION = 1;
const PAYLOAD_BYTES = 6;
const SIGNATURE_BYTES = 64;
const TOTAL_BYTES = PAYLOAD_BYTES + SIGNATURE_BYTES;
const GROUP_COUNT = 28;

const PLAN_BY_CODE = { 1: 'demo', 2: 'standard', 3: 'premium', 4: 'enterprise' };

function getPublicKey() {
  return crypto.createPublicKey({
    key: Buffer.from(LICENSE_PUBLIC_KEY_B64, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function base32Decode(str) {
  const clean = str.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32 char');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function validateLicenseKey(key) {
  if (typeof key !== 'string') return { valid: false };
  const normalized = key.trim().toUpperCase();
  const groups = normalized.split('-');
  if (groups.length !== GROUP_COUNT + 1 || groups[0] !== 'SVL') return { valid: false };
  for (let i = 1; i < groups.length; i++) {
    if (!/^[0-9A-Z]{4}$/.test(groups[i])) return { valid: false };
  }
  let raw;
  try {
    raw = base32Decode(groups.slice(1).join(''));
  } catch {
    return { valid: false };
  }
  if (raw.length !== TOTAL_BYTES) return { valid: false };

  const payload = raw.subarray(0, PAYLOAD_BYTES);
  const signature = raw.subarray(PAYLOAD_BYTES);

  let sigOk = false;
  try {
    sigOk = crypto.verify(null, payload, getPublicKey(), signature);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { valid: false };

  if (payload[0] !== KEY_VERSION) return { valid: false };

  const expiryDays =
    payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
  const tierCode = payload[5];
  const planTier = PLAN_BY_CODE[tierCode];
  if (!planTier) return { valid: false };

  return {
    valid: true,
    expiry: new Date(expiryDays * 86400000),
    planTier,
    keyId: '',
  };
}

module.exports = { validateLicenseKey };
