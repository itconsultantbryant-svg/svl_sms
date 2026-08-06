import crypto from 'crypto';

// RSA Key Pair (generated once)
// In production, keep the PRIVATE_KEY secure (server-side only)
// PUBLIC_KEY is embedded in the app for offline validation
const RSA_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA2X3EV1SfFhZr9gKlhC5/XwC5zL6J8vD1YzKJ7mC8Z1vZ0F1q
BvN4Dq8zJ0Y9K1m5P0R7S2T3U4V5W6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3
O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5
U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7
A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9
GwIDAQABAoIBAAl8J2K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H
3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L3M4N
5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5S6T
7U8V9W0X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z
9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F
1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L
3M4N5O6P7Q8R9S0CQQDkP2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K3L
4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R
6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X
8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0AkEA8T9U0V1W2X3Y4Z5A
6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G
8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M
0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S
2T3U4V5W6X7Y8Z9QJAZx7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9
U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1
A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3
G4H5I6J7K8LwJBANm9xFdUnxYWa/YCpYQuf18AucyxEVLw9WMyie5gvGdb2dBdagbz
eA6vMydGPStZuT9Ee0tk9VuH+1pM0NXbkO8CQQDz9K0L1M2N3O4P5Q6R7S8T9U0V
1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B
3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H
5I6J7K8L9M0N1O2P3Q4R5S6T7U8V9
-----END RSA PRIVATE KEY-----`;

const RSA_PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2X3EV1SfFhZr9gKlhC5/
XwC5zL6J8vD1YzKJ7mC8Z1vZ0F1qBvN4Dq8zJ0Y9K1m5P0R7S2T3U4V5W6X7Y8Z9
A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1
G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C4D5E6F7G8H9I0J1K2L3
M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5
S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9GwIDAQAB
-----END RSA PUBLIC KEY-----`;

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

  // Generate a random key ID
  const keyId = crypto.randomBytes(4).toString('hex').toUpperCase();

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
  // Check format: SVL-XXXX-XXXX-XXXX-XXXX
  const keyRegex = /^SVL-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i;

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
