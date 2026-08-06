# SVL-SMS License Key Generator

A CLI tool for generating and managing cryptographically-signed license keys for SVL-SMS installations.

## Overview

This tool generates license keys in the format `SVL-XXXX-XXXX-XXXX-XXXX` (36 characters). Each key is:

- **Cryptographically signed** using RSA-2048
- **Deterministic** - same inputs always produce the same key
- **Offline-verifiable** - signatures can be verified without contacting a server
- **Institution-locked** - encoded with institution name, expiry date, and plan tier
- **Machine-optional** - can be tied to a specific machine via MAC address hash

## Installation

The tool uses Node.js and TypeScript. It's already included in the project and requires no additional dependencies beyond what's in `package.json`.

### Running the Tool

Using npm script:
```bash
npm run generate-license -- [command] [options]
```

Or directly with tsx:
```bash
npx tsx tools/generate-license.ts [command] [options]
```

## Commands

### generate

Create a new license key for a client.

**Required Arguments:**
- `--institution "Name"` - Institution/school name
- `--expiry YYYY-MM-DD` - License expiry date (must be in future)
- `--plan <plan>` - Plan tier: `demo`, `standard`, `premium`, or `enterprise`

**Optional Arguments:**
- `--machine-id "MAC_ADDRESS"` - 16-32 character hex string (e.g., MAC address). If provided, the key will be locked to that machine.

**Example:**
```bash
npm run generate-license -- generate \
  --institution "Lincoln High School" \
  --expiry "2025-12-31" \
  --plan "standard"
```

**Output:**
```
✓ License Key Generated:

  SVL-ABC12-DEF34-GHI56-JKL78

  Institution: Lincoln High School
  Expiry: 2025-12-31 (12 months remaining)
  Plan: standard

  Save this key. You can only generate it once.
  Give it to the client via secure channel.
```

The key is immediately saved to `tools/licenses/generated-keys.json` (gitignored). You can regenerate the same key by providing identical arguments.

---

### list

Display all generated license keys and their status.

**Example:**
```bash
npm run generate-license -- list
```

**Output:**
```
════════════════════════════════════════════════════════════════════════════════════════════════════
License Keys Generated
════════════════════════════════════════════════════════════════════════════════════════════════════

✓  SVL-ABC12-DEF34-GHI56-JKL78
   Institution: Lincoln High School
   Plan: standard
   Expiry: 2025-12-31 (12 months)
   Generated: 8/6/2026

❌ SVL-XYZ99-UVW88-RST77-QOP66
   Institution: Central Middle School
   Plan: premium
   Expiry: 2024-12-31 (EXPIRED)
   Generated: 5/15/2026
   Revoked: 6/1/2026

════════════════════════════════════════════════════════════════════════════════════════════════════
```

---

### revoke

Mark a license key as revoked. This prevents it from being used in the future.

**Required Arguments:**
- `--key "SVL-XXXX-XXXX-XXXX-XXXX"` - The license key to revoke

**Example:**
```bash
npm run generate-license -- revoke --key "SVL-ABC12-DEF34-GHI56-JKL78"
```

**Note:** Revocation is recorded locally in `generated-keys.json`. The backend should check against this database or maintain its own revocation list.

---

### validate

Decode and validate a license key without modifying it. Useful for testing key format and extracting metadata.

**Required Arguments:**
- `--key "SVL-XXXX-XXXX-XXXX-XXXX"` - The license key to validate

**Example:**
```bash
npm run generate-license -- validate --key "SVL-ABC12-DEF34-GHI56-JKL78"
```

**Output:**
```
✓ License Key Valid:

  Key: SVL-ABC12-DEF34-GHI56-JKL78
  Institution: Lincoln High School
  Plan: standard
  Expiry: 2025-12-31
  Status: ACTIVE
  Months Remaining: 12
```

---

### export

Export all generated keys to CSV or JSON format. Useful for record-keeping and backups.

**Optional Arguments:**
- `--format csv|json` - Output format (default: `csv`)

**Example (CSV):**
```bash
npm run generate-license -- export --format csv
```

**Output:**
```
Key,Institution,Plan,Expiry,Generated,Status
SVL-ABC12-DEF34-GHI56-JKL78,Lincoln High School,standard,2025-12-31,8/6/2026,ACTIVE
SVL-XYZ99-UVW88-RST77-QOP66,Central Middle School,premium,2024-12-31,5/15/2026,REVOKED
```

**Example (JSON):**
```bash
npm run generate-license -- export --format json
```

---

## License Key Format

### Structure

Keys follow the format: `SVL-XXXX-XXXX-XXXX-XXXX` where:
- **SVL** = Prefix (School/SVL identifier)
- **Segments 1-3** = Base62-encoded institution + expiry + plan data
- **Segment 4** = Checksum (RSA signature verification)

### Key Components

1. **Institution Code** (4 chars, base62)
   - First 1-2 letters of each word in institution name
   - Example: "Lincoln High School" → "LHS" padded to "LHSX"

2. **Expiry Timestamp** (8 hex chars, base62)
   - Unix timestamp of expiry date
   - Example: 2025-12-31 → 1767225600 → "69bb1000"

3. **Plan Code** (1 char, base62)
   - 0 = demo, 1 = standard, 2 = premium, 3 = enterprise

4. **Machine ID Hash** (8 hex chars, base62, optional)
   - SHA256 hash of machine ID (if provided)
   - Allows binding keys to specific machines

5. **RSA Signature** (4 chars, base62 checksum)
   - First 12 chars of RSA-SHA256 signature over data

### Determinism

The key generation is **deterministic**. Given the same inputs:
```bash
npm run generate-license -- generate \
  --institution "School ABC" \
  --expiry "2025-12-31" \
  --plan "standard"
```

You will always get the same key. This allows re-generating keys if metadata is lost, as long as you remember the original parameters.

---

## Database Storage

Generated keys are stored in `tools/licenses/generated-keys.json` (gitignored). Each entry contains:

```json
{
  "key": "SVL-XXXX-XXXX-XXXX-XXXX",
  "institution": "School Name",
  "expiry": "2025-12-31",
  "plan": "standard",
  "machineId": "optional-hex-string",
  "generatedAt": "2026-08-06T10:30:45.123Z",
  "revoked": false,
  "revokedAt": null
}
```

---

## Key Verification

Keys are verified offline using the public RSA key. Both backend and frontend embed the same public key:

```javascript
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBCgJstIW4gVYB
...
-----END PUBLIC KEY-----`;
```

### Backend Verification (Node.js)

```typescript
import * as crypto from 'crypto';

function verifyLicenseKey(key: string, publicKey: string): boolean {
  // Parse key: SVL-XXXX-XXXX-XXXX-XXXX
  const parts = key.split('-');
  if (parts.length !== 5 || parts[0] !== 'SVL') return false;

  const dataSegments = parts[1] + parts[2] + parts[3]; // First 3 segments
  const checksumSegment = parts[4]; // 4th segment is checksum

  // Verify RSA signature...
  // (See backend verification implementation)
  return true;
}
```

### Frontend Verification (React/TypeScript)

```typescript
// Use a library like `node-rsa` or `crypto-browserify`
// Or call your backend API to verify the key
```

---

## Private Key Configuration

### Development

The tool uses a default test RSA key hardcoded in the script. This is fine for development.

### Production

For production, provide the private key via environment variable:

```bash
export LICENSE_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----'

npm run generate-license -- generate ...
```

Or store it in `.env`:
```
LICENSE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

---

## Workflow Example

### 1. Generate a Key for a New Client

```bash
npm run generate-license -- generate \
  --institution "Central Elementary School" \
  --expiry "2026-08-31" \
  --plan "standard"
```

Output:
```
SVL-CENT-1234-5678-ABCD
```

### 2. Send the Key to the Client

Share via email or secure channel:
> Your SVL-SMS license key is: `SVL-CENT-1234-5678-ABCD`
> 
> Valid until: 2026-08-31

### 3. Client Activates the License

In the SVL-SMS UI, client enters the key and it's validated:
- Format verified ✓
- Expiry date checked ✓
- Signature verified offline ✓

### 4. List All Keys (as Admin)

```bash
npm run generate-license -- list
```

### 5. Revoke a Key If Needed

```bash
npm run generate-license -- revoke --key "SVL-CENT-1234-5678-ABCD"
```

### 6. Export Records

```bash
npm run generate-license -- export --format csv > keys-backup.csv
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| **Institution** | Non-empty string, used for code generation |
| **Expiry** | Must be future date in `YYYY-MM-DD` format |
| **Plan** | Must be one of: `demo`, `standard`, `premium`, `enterprise` |
| **Machine ID** | Optional; if provided, must be 16-32 hex characters |

---

## Troubleshooting

### Key Validation Fails

**Problem:** "Invalid license key format"

**Solution:**
- Ensure key matches format: `SVL-XXXX-XXXX-XXXX-XXXX`
- Check for typos or extra spaces
- Verify it hasn't been truncated

### Key Expired

**Problem:** "License has expired"

**Solution:**
- Generate a new key with a future expiry date
- Contact the client with the new key

### Machine ID Not Recognized

**Problem:** Key works on one machine but not another

**Solution:**
- If the key was generated with `--machine-id`, it's locked to that machine
- Generate a new key without `--machine-id` for machine-independent licensing

### Cannot Find generated-keys.json

**Problem:** File was deleted or moved

**Solution:**
- The file will be recreated when you generate the next key
- If you need records, use `export` command before the issue occurs

---

## Security Considerations

1. **Private Key:** Keep the `LICENSE_PRIVATE_KEY` secret. Anyone with it can forge keys.
2. **Public Key:** Safe to share. Used only for verification.
3. **Key Storage:** `generated-keys.json` is gitignored but should still be backed up.
4. **Revocation:** Revoked keys are marked locally. Backend should check revocation status.
5. **Machine Binding:** Optional machine ID hash adds security for sensitive deployments.

---

## Files

- **`tools/generate-license.ts`** - Main CLI tool
- **`tools/licenses/`** - Generated key database directory
- **`tools/licenses/generated-keys.json`** - Key metadata (gitignored)
- **`tools/licenses/.gitkeep`** - Ensures directory exists in repo
- **`.gitignore`** - Updated to exclude `tools/licenses/*.json`
- **`package.json`** - Added `generate-license` script

---

## Next Steps

1. **Embed Public Key:** Add the public RSA key to backend/frontend for verification
2. **Backend Verification:** Implement key validation in your license check endpoint
3. **Frontend UI:** Add license key input field in installation wizard
4. **Revocation API:** Implement backend check against revocation list
5. **Key Distribution:** Set up secure channel for sending keys to clients

