---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- generated -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
1. `https://workos.com/docs/vault/quick-start`
2. `https://workos.com/docs/vault/key-context`
3. `https://workos.com/docs/vault/index`
4. `https://workos.com/docs/vault/byok`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required variables:

```bash
# Verify API key exists and has correct prefix
grep -q "WORKOS_API_KEY.*sk_" .env* || echo "FAIL: Missing or invalid WORKOS_API_KEY"

# Verify client ID exists
grep -q "WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing WORKOS_CLIENT_ID"
```

Both must exist before proceeding. API key MUST start with `sk_`.

### Organization Setup

Vault requires WorkOS Organizations. Check that:
- At least one organization exists in WorkOS Dashboard
- You have the organization ID for testing (format: `org_` or `organization_` prefix)

**If no organizations exist:** Create one in WorkOS Dashboard before continuing.

## Step 3: Install SDK

Detect package manager and install WorkOS SDK:

```bash
# Detect package manager
if [ -f "package-lock.json" ]; then
  npm install @workos-inc/node
elif [ -f "yarn.lock" ]; then
  yarn add @workos-inc/node
elif [ -f "pnpm-lock.yaml" ]; then
  pnpm add @workos-inc/node
fi
```

**Verify:** SDK package exists in node_modules before continuing:

```bash
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK not installed"
```

## Step 4: Initialize Vault Client

Create Vault client with API key. See quick-start docs for exact initialization pattern.

**Decision Tree: API Key Loading**

```
Environment?
  |
  +-- Production --> Load from managed secrets (AWS Secrets Manager, etc.)
  |
  +-- Development --> Load from .env file via dotenv or similar
  |
  +-- Testing --> Use test API key (starts with sk_test_)
```

**Critical:** NEVER hardcode API keys in source files.

## Step 5: Implement Core Operations (Decision Tree)

```
What operation?
  |
  +-- Store encrypted data --> Step 5a: Create Object
  |
  +-- Update existing data --> Step 5b: Update Object
  |
  +-- Read encrypted data --> Step 5c: Retrieve Object
  |
  +-- Remove data --> Step 5d: Delete Object
  |
  +-- List all objects --> Step 5e: List Objects
```

### Step 5a: Create Object

Use Vault API to create encrypted object. Required parameters from docs:

1. **Key Context** - Metadata for key selection (see Step 6 for context rules)
2. **Value** - Data to encrypt (blob/string)
3. **Name** - Unique identifier for this object

**Example pattern from docs:**

```javascript
// Pattern - check docs for exact API
await workos.vault.createObject({
  keyContext: { organization_id: 'org_123' },
  name: 'user-settings',
  value: JSON.stringify(data)
});
```

**CRITICAL:** Key context cannot be changed after creation. Choose carefully.

### Step 5b: Update Object

Only the VALUE can be updated - key context is immutable.

**Consistency Lock (IMPORTANT):** If your app needs atomic updates, use version locking:

```javascript
// Check current version first
const current = await workos.vault.getObject({ name: 'user-settings' });

// Update with version check
await workos.vault.updateObject({
  name: 'user-settings',
  value: newData,
  expectedVersion: current.version // Fails if version changed
});
```

See docs for exact version parameter name.

### Step 5c: Retrieve Object

**Decision: What data needed?**

```
Need?
  |
  +-- Just metadata (no decryption) --> Use getObjectMetadata()
  |
  +-- Decrypted value --> Use getObject()
  |
  +-- List names only --> Use listObjects()
```

Metadata operations are faster and don't require decryption - use when possible.

### Step 5d: Delete Object

**IMPORTANT:** Deletion is NOT immediate - object is marked for deletion and becomes unavailable.

From docs: "marked for deletion...data will not be immediately deleted"

Deleted objects will fail API operations immediately but data purge is asynchronous.

### Step 5e: List Objects

Lists object names only - no values or metadata.

Use for: UI dropdowns, existence checks, auditing

## Step 6: Configure Key Context (CRITICAL)

Key context is metadata that determines which encryption key(s) are used.

### Rules from Documentation

1. **All values must be strings** - Numbers/booleans must be stringified
2. **Maximum 10 items** per context
3. **Context is immutable** after object creation
4. **KEKs created just-in-time** - No pre-configuration needed

### Recommended Context Patterns

```
Use case                  --> Context example
Per-organization data     --> { organization_id: "org_123" }
Per-user data            --> { organization_id: "org_123", user_id: "user_456" }
Per-tenant + environment --> { tenant_id: "ten_789", environment: "production" }
```

**CRITICAL for BYOK:** If using Bring Your Own Key, the context MUST match your CMK configuration. Example:

- CMK configured for `organization_abc123`
- Context MUST include `{ organization_id: "organization_abc123" }`
- Different org ID will use WorkOS-managed key instead of your CMK

### Context Validation Command

```bash
# Check context in code doesn't exceed 10 items
grep -r "keyContext.*{" . | grep -v node_modules | while read line; do
  # Manual review - automated counting is unreliable
  echo "Review: $line"
done
```

## Step 7: BYOK Setup (Optional - If Using Customer Keys)

**STOP:** Only proceed if customer requirements mandate BYOK.

### BYOK Decision Tree

```
Customer key manager?
  |
  +-- AWS KMS --> Configure AWS IAM permissions for WorkOS
  |
  +-- Azure Key Vault --> Configure Azure AD permissions for WorkOS
  |
  +-- Google Cloud KMS --> Configure GCP IAM permissions for WorkOS
  |
  +-- None (WorkOS-managed) --> Skip this step entirely
```

**From docs:** Customer-managed key (CMK) replaces WorkOS KEK when key context matches.

### IAM Permission Requirements

Check BYOK docs for specific permissions. Generally requires:

- **AWS:** `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey`
- **Azure:** `Key Vault Crypto Service Encryption User` role
- **GCP:** `cloudkms.cryptoKeyVersions.useToEncrypt/Decrypt` permissions

**Verify:** Test encryption with your CMK before deploying to production.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check environment variables set
grep -q "WORKOS_API_KEY" .env* && grep -q "WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing env vars"

# 3. Check no hardcoded API keys in source
grep -r "sk_live_\|sk_test_" src/ && echo "FAIL: Hardcoded API key found" || echo "PASS: No hardcoded keys"

# 4. Verify key context limits (manual check)
echo "Manual check: Ensure all key contexts have ≤10 items and string values"

# 5. Build succeeds
npm run build || echo "FAIL: Build error"
```

**Additional runtime test:**

```javascript
// Test basic vault operations (run in dev environment)
const testVault = async () => {
  // Create
  const obj = await workos.vault.createObject({
    keyContext: { organization_id: 'org_test' },
    name: 'test-object',
    value: 'test-data'
  });
  
  // Retrieve
  const retrieved = await workos.vault.getObject({ name: 'test-object' });
  console.assert(retrieved.value === 'test-data', 'Value mismatch');
  
  // Delete
  await workos.vault.deleteObject({ name: 'test-object' });
  
  console.log('PASS: Vault operations working');
};
```

## Error Recovery

### "Invalid key context" / "Context validation failed"

**Root cause:** Key context violates rules (non-string value, >10 items, etc.)

**Fix:**

1. Check all context values are strings: `{ user_id: "123" }` not `{ user_id: 123 }`
2. Count context items - must be ≤10
3. Check for special characters in keys - use alphanumeric + underscore

### "Encryption failed" / "Key not found" (BYOK)

**Root cause:** CMK not accessible or key context mismatch

**Fix:**

1. Verify IAM permissions for WorkOS in your KMS
2. Check key context exactly matches CMK configuration
3. Confirm CMK is not disabled/deleted in key manager
4. Test with WorkOS-managed key first (different context) to isolate issue

### "Object not found" after deletion

**Root cause:** Expected behavior - deletion marks object unavailable immediately

**Fix:** This is correct behavior per docs. If you need the data, restore from backup or don't delete.

### "Version conflict" on update

**Root cause:** Object was modified between read and update (optimistic locking)

**Fix:**

1. Retry with fresh version number
2. Implement exponential backoff for retries
3. Consider if your app needs version locking at all

### "API key invalid" or "Unauthorized"

**Root cause:** Wrong API key, incorrect environment, or missing permissions

**Fix:**

1. Verify API key starts with `sk_live_` (production) or `sk_test_` (staging)
2. Check key copied correctly (no whitespace)
3. Confirm key has Vault permissions in WorkOS Dashboard
4. Match staging/production keys with staging/production endpoints

### Build succeeds but runtime errors

**Root cause:** Environment variables not loaded at runtime

**Fix:**

1. Check env var loading library (dotenv, etc.) is initialized early
2. Verify deployment platform env var configuration (Vercel, AWS, etc.)
3. Test with hardcoded test key locally to isolate env loading issue
4. Check for typos in env var names (`WORKOS_API_KEY` not `WORK_OS_API_KEY`)

## Security Best Practices

1. **Never log decrypted values** - Only log object names/metadata
2. **Rotate API keys regularly** - Follow your organization's key rotation policy
3. **Use different keys per environment** - Staging and production must use separate API keys
4. **Audit key context patterns** - Ensure they align with data isolation requirements
5. **Monitor failed decryption attempts** - May indicate key compromise

## Related Skills

- **workos-audit-logs**: Track Vault access patterns and encryption events
- **workos-organizations**: Manage organization entities that Vault encrypts data for
