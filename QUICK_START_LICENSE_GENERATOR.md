# Quick Start: License Key Generator

## One-Minute Setup

The license key generator is ready to use. No setup required.

## Generate Your First Key

```bash
npm run generate-license -- generate \
  --institution "Your School Name" \
  --expiry "2027-12-31" \
  --plan "standard"
```

**Output:**
```
✓ License Key Generated:

  SVL-XXXX-XXXX-XXXX-XXXX

  Institution: Your School Name
  Expiry: 2027-12-31 (12 months remaining)
  Plan: standard
```

## Common Commands

```bash
# List all keys
npm run generate-license -- list

# Validate a key
npm run generate-license -- validate --key "SVL-XXXX-XXXX-XXXX-XXXX"

# Revoke a key
npm run generate-license -- revoke --key "SVL-XXXX-XXXX-XXXX-XXXX"

# Export to CSV
npm run generate-license -- export --format csv

# Export to JSON
npm run generate-license -- export --format json
```

## Key Format

**Pattern:** `SVL-XXXX-XXXX-XXXX-XXXX`
- 36 characters total
- Base62 encoding (0-9, a-z, A-Z)
- Cryptographically signed

## Plan Tiers

- `demo` - Free evaluation
- `standard` - Standard deployment
- `premium` - Advanced features
- `enterprise` - Custom enterprise

## Important Notes

1. **Expiry dates** must be in the future (YYYY-MM-DD format)
2. **Institution names** can be any string (used for code generation)
3. **Keys are stored** in `tools/licenses/generated-keys.json` (gitignored)
4. **Private key** is embedded (or use `LICENSE_PRIVATE_KEY` env var for production)

## Full Documentation

See `tools/README-LICENSE-GENERATOR.md` for complete documentation.

## Troubleshooting

- **Command not found?** Run `npm install` first
- **Invalid date?** Use format: `YYYY-MM-DD` (e.g., 2027-12-31)
- **Invalid plan?** Use: demo, standard, premium, or enterprise

## Integration

To verify keys in your backend:

1. Extract the RSA public key from `tools/generate-license.js`
2. Embed it in your backend validation code
3. Verify signatures using the public key

See `tools/README-LICENSE-GENERATOR.md` for code examples.

## Help

```bash
npm run generate-license -- help
```
