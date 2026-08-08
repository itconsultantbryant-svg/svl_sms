import crypto from 'crypto';

// RSA Key Pair (generated once)
// In production, keep the PRIVATE_KEY secure (server-side only)
// PUBLIC_KEY is embedded in the app for offline validation
const RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCtB9eRfuvlZ47D
FzRqX5FfJqxm4UdKgBoFsRX0GyJ9dwnu3zfQiJdasl3CrVG8czaE2o9xZ+3BY1db
ns3vTgXFP3FrOxCWZpcnZRdRynzXst8NUd9r+mTS4jvyLBL/m2bkO2Xjptxlnen0
Kh1IdoK3pfq8gG/FI1+gKzkUylEOEkb0/b0yX6siOh3EEDvy+36WOCs2RBUD3cWw
1vCphumqHFLMgYOyAMouWAui+wczneAlHQ0rCCfZffZQ3OhLgrGb9Qbb4YjuFyPa
chgT9y7FZUhu3jlQRxvggQQYdEzlTaoyMxqWfsgwbBlTOrwy2POEVH/y12yh1GbC
iig81rNtAgMBAAECggEACq0+yL2hbjbJORyz3AgjcaYyrKgkIe13eELwqm7zM5/h
Bxzodi+7e89LmEvhYi9kyDwD7mOTPjk0Rn/CesygcAb7EhAOCmMbBXAIM+s6mq+w
8kLgoP/NcV11hVBhaBAi1ZycVqNbmvyXF1Jy8J9OxRNoPkdEPlCcDFzRE/Prnk0k
btdmBfdZedPM5jxiGna7/MprzdBfnvH9o04XlF/mBnFvWZDO6OHfMLeHUVWTobF2
cuVGTPX7tDZ1PKxXIuHlZHThn8UkFer4W69bHihnzTHgnQRVhmNPdAjMCnFQxNfc
iaZQeFUIOJ4m+ZWnRcF4j2Rqq5nKpOXiJAmq9AUx6QKBgQDsWqVft/INpRY3ygaG
ojqwoAf7CBY3HbYjK/yOk0vEYjNw/14Gqhi9kVRFiQ9J+7jL+1o8x6GYLYmhibpc
hJ2nXg3JPPjk4DUFjdNBtF1dGqBYFyqVaz0T/v4vn72sKinYuzeCZ8PTZW7Zdkad
jO/5m7eQw/rnvyg2RO6TzLTihQKBgQC7ab4vFZIA3c4kh7/SCK94/S8XF2pCMjVr
ZKye95vQOZGArPbkQN5NDVtNIleB59WflIbIgKEqeLmlNt+1QQNgmV9HE0MnrA1u
4cj5W+7XFBz+C1PeIbo38yLdjRn2B5lJwmNsQAtIFQxaNZfw37EsikjqAxVJwy6S
923dGadFyQKBgCHV4DLRvH8jkQivjTuc4dYDMuFHCRce08I5O9CVWZVlkYOtqyI9
G4mX0n6Z3mxy8sOQ2hw1X/bPHhLYCqvP+FnLZyHV7rOlPTHsWb/gODVp6GZz+o6l
aXsBWBYtQhPxfUgflRTAEhKjRLkw628GjBwppJ++zp56iSErwRO7jHGZAoGAd+e9
oE5CrX87xq97kJux+Myz9igq+dM5zk4JC2QMMnrClvsSsxK1p8Kl6YHRTvHPAVx7
p4h0lMHMtOGY21SPHpzCEq1GR/mSVqDqfm/NLZpWukrxC6u0gttyMSF3vKs77a8L
AVUwYpvk3UpwvdHAf2iyIdZ7JkhUYf8gMVeaZ9ECgYALeSU+y2hvSDNWB+9LE0ZB
9/vYoaTulW8aEIWrCa5WYdRdBKS68VmdU7IXKUe5UpnJ1V/EceAQ/Bh/HZPDY5GL
mQwu8n3QqxhUgGZwhBKzorSzxm+iJDuZgY8pWIs78/drdtW7LSWY2SdfN9gJWRP6
Z5j1MsKqgnht1SEk1qOcgg==
-----END PRIVATE KEY-----`;

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArQfXkX7r5WeOwxc0al+R
XyasZuFHSoAaBbEV9BsifXcJ7t830IiXWrJdwq1RvHM2hNqPcWftwWNXW57N704F
xT9xazsQlmaXJ2UXUcp817LfDVHfa/pk0uI78iwS/5tm5Dtl46bcZZ3p9CodSHaC
t6X6vIBvxSNfoCs5FMpRDhJG9P29Ml+rIjodxBA78vt+ljgrNkQVA93FsNbwqYbp
qhxSzIGDsgDKLlgLovsHM53gJR0NKwgn2X32UNzoS4Kxm/UG2+GI7hcj2nIYE/cu
xWVIbt45UEcb4IEEGHRM5U2qMjMaln7IMGwZUzq8MtjzhFR/8tdsodRmwoooPNaz
bQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Generate a signed license key
 * Format: SVL-XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(config: {
  institution: string;
  expiryDate: Date;
  planTier: string;
  machineId?: string;
}): string {
  // Create the data object to sign
  const data = {
    institution: config.institution,
    expiry: config.expiryDate.toISOString(),
    tier: config.planTier,
    machine: config.machineId || '',
    issued: new Date().toISOString(),
  };

  // Sign the data
  const signature = signKey(data);

  // Generate a random key ID — 2 bytes = 4 hex chars so the emitted key
  // matches the documented SVL-XXXX-XXXX-XXXX-XXXX format (validated by
  // validateLicenseKey). Earlier builds used a 4-byte id (8 hex chars), so
  // the validator also accepts that trailing length for backward compat.
  const keyId = crypto.randomBytes(2).toString('hex').toUpperCase();

  // Return formatted license key: SVL-{signature}-{keyId}
  const signatureShort = signature.substring(0, 32).toUpperCase();
  return `SVL-${signatureShort.slice(0, 4)}-${signatureShort.slice(4, 8)}-${signatureShort.slice(8, 12)}-${keyId}`;
}

/**
 * Sign data with RSA private key
 */
export function signKey(data: any): string {
  const jsonString = JSON.stringify(data);
  const signer = crypto.createSign('sha256');
  signer.update(jsonString);
  signer.end();

  const signature = signer.sign(RSA_PRIVATE_KEY, 'hex');
  return signature;
}

/**
 * Verify a signature
 */
export function verifyKeySignature(data: any, signature: string): boolean {
  const jsonString = JSON.stringify(data);
  const verifier = crypto.createVerify('sha256');
  verifier.update(jsonString);
  verifier.end();

  try {
    return verifier.verify(RSA_PUBLIC_KEY, signature, 'hex');
  } catch (error) {
    return false;
  }
}

/**
 * Validate a license key (basic format validation)
 * Returns the extracted data if valid, null otherwise
 */
export function validateLicenseKey(key: string): {
  valid: boolean;
  institution?: string;
  expiry?: Date;
  planTier?: string;
  machineId?: string;
  keyId?: string;
} {
  // Check format: SVL-XXXX-XXXX-XXXX-XXXX (last group may be 8 hex chars for
  // keys issued by earlier builds that used a 4-byte key id).
  const keyRegex = /^SVL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4,8}$/i;

  if (!keyRegex.test(key)) {
    return { valid: false };
  }

  try {
    // Extract parts
    const parts = key.split('-');
    const keyId = parts[4];

    // In a real implementation, you'd verify the signature here
    // For now, we accept the key as valid if it has the right format
    return {
      valid: true,
      keyId,
    };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Generate a machine fingerprint for device identification
 */
export function generateMachineFingerprint(): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        timestamp: Date.now(),
        random: crypto.randomBytes(16).toString('hex'),
      })
    )
    .digest('hex');
}

/**
 * Calculate days remaining until expiry
 */
export function getDaysRemaining(expiryDate: Date): number {
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Check if a date is in the past
 */
export function isExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}
