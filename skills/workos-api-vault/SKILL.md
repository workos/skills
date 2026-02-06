---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- generated -->

# WorkOS Vault API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- https://workos.com/docs/reference/vault
- https://workos.com/docs/reference/vault/key
- https://workos.com/docs/reference/vault/key/create-data-key
- https://workos.com/docs/reference/vault/key/decrypt-data
- https://workos.com/docs/reference/vault/key/decrypt-data-key
- https://workos.com/docs/reference/vault/key/encrypt-data
- https://workos.com/docs/reference/vault/object
- https://workos.com/docs/reference/vault/object/create

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### API Credentials

Check environment variables:

```bash
# Verify API key exists and has correct prefix
env | grep WORKOS_API_KEY | grep "sk_" || echo "FAIL: WORKOS_API_KEY missing or invalid"

# Verify client ID exists
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"
```

**CRITICAL:** API key MUST start with `sk_`. Client ID format varies by environment.

### SDK Installation

Detect which SDK to use:

```
Language/Framework?
  |
  +-- Node.js     --> @workos-inc/node
  |
  +-- Python      --> workos
  |
  +-- Ruby        --> workos
  |
  +-- Go          --> github.com/workos/workos-go
  |
  +-- PHP         --> workos/workos-php
```

Check SDK is installed:

```bash
# Node.js
npm list @workos-inc/node 2>/dev/null || echo "SDK not installed"

# Python
pip show workos 2>/dev/null || echo "SDK not installed"

# Ruby
gem list workos 2>/dev/null || echo "SDK not installed"
```

If not installed, install now before proceeding.

## Step 3: Use Case Detection (Decision Tree)

Determine which Vault capability you need:

```
What are you encrypting?
  |
  +-- Structured data (JSON, user profiles, configs)
  |   --> Use Vault Objects (Step 4A)
  |
  +-- Arbitrary data (files, binary, large payloads)
  |   --> Use Data Encryption (Step 4B)
  |
  +-- Need custom key management (bring your own keys)
      --> Use Data Key API (Step 4C)
```

## Step 4A: Vault Objects (Structured Data)

### Object Lifecycle

Use this pattern for storing/retrieving structured data:

1. **Create object** - Store sensitive data with metadata
2. **Retrieve object** - Get by ID or by name
3. **Update object** - Modify values (creates new version)
4. **List objects** - Paginate through all objects
5. **Delete object** - Remove permanently

### Implementation Pattern

**Node.js example:**

```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create vault object
const vaultObject = await workos.vault.createObject({
  name: 'user_ssn',
  data: { ssn: '123-45-6789' },
  metadata: { user_id: 'user_123' }
});

// Retrieve by ID
const retrieved = await workos.vault.getObject(vaultObject.id);

// Retrieve by name
const byName = await workos.vault.getObjectByName('user_ssn');

// Update (creates new version)
const updated = await workos.vault.updateObject(vaultObject.id, {
  data: { ssn: '987-65-4321' }
});
```

**Verify creation:**

```bash
# Objects return an ID that starts with 'vault_obj_'
curl -X POST https://api.workos.com/vault/objects \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","data":{"key":"value"}}' | grep "vault_obj_"
```

### Versioning

**CRITICAL:** Updates create NEW versions, they don't overwrite. Old versions remain accessible.

```javascript
// Get all versions of an object
const versions = await workos.vault.getObjectVersions(vaultObject.id);

// Get specific version
const version = await workos.vault.getObjectVersion(vaultObject.id, versionId);
```

### Metadata vs Data

- **data** - Encrypted, never returned in plaintext via API (unless explicitly decrypted)
- **metadata** - Plaintext, searchable, used for filtering/sorting

**Decision rule:**

```
Field contains sensitive info?
  |
  +-- YES --> Put in 'data' object
  |
  +-- NO  --> Put in 'metadata' object
```

## Step 4B: Data Encryption (Arbitrary Data)

### Encrypt/Decrypt Flow

Use when you need to encrypt data CLIENT-SIDE before sending to your database:

```
Your App --> Encrypt Data --> Store in Your DB
              ↑ WorkOS API
              
Your App <-- Decrypt Data <-- Retrieve from Your DB
              ↑ WorkOS API
```

**Implementation:**

```javascript
// Encrypt arbitrary data
const encrypted = await workos.vault.encryptData({
  data: 'sensitive-string-or-buffer',
  keyId: 'vault_key_123' // Optional: use specific key
});

// Returns: { ciphertext: '...', keyId: '...' }

// Store encrypted.ciphertext in YOUR database

// Later, decrypt
const decrypted = await workos.vault.decryptData({
  ciphertext: encrypted.ciphertext,
  keyId: encrypted.keyId
});

// Returns: { plaintext: 'original-data' }
```

**Verify encryption/decryption:**

```bash
# Test round-trip
PLAINTEXT="test-data"
ENCRYPTED=$(curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d "{\"data\":\"${PLAINTEXT}\"}" | jq -r '.ciphertext')

DECRYPTED=$(curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d "{\"ciphertext\":\"${ENCRYPTED}\"}" | jq -r '.plaintext')

[ "$PLAINTEXT" = "$DECRYPTED" ] && echo "PASS" || echo "FAIL"
```

## Step 4C: Data Key API (Custom Key Management)

### When to Use Data Keys

Use this if:
- You need envelope encryption (encrypt locally, decrypt locally)
- You're migrating from AWS KMS / Google Cloud KMS pattern
- You want WorkOS to manage key lifecycle but encrypt client-side

**CRITICAL:** This is advanced usage. Most use cases should use Step 4A or 4B.

### Implementation Pattern

```javascript
// 1. Create a data key
const dataKey = await workos.vault.createDataKey();
// Returns: { plaintext: 'base64-key', ciphertext: 'encrypted-key' }

// 2. Use plaintext key to encrypt YOUR data locally
const encrypted = encryptLocally(yourData, dataKey.plaintext);

// 3. Store dataKey.ciphertext + encrypted data together in YOUR database
// 4. Clear dataKey.plaintext from memory

// Later, to decrypt:

// 5. Retrieve dataKey.ciphertext from YOUR database
const decryptedKey = await workos.vault.decryptDataKey({
  ciphertext: storedCiphertext
});
// Returns: { plaintext: 'base64-key' }

// 6. Use plaintext key to decrypt YOUR data locally
const decrypted = decryptLocally(encryptedData, decryptedKey.plaintext);
```

**Key lifecycle:**
- Plaintext key NEVER leaves your process after initial creation
- Ciphertext stored in your database
- WorkOS never sees your encrypted data

## Step 5: Error Handling

### Common API Errors

Map HTTP status to action:

| Status | Error | Fix |
|--------|-------|-----|
| 401 | Invalid API key | Check `WORKOS_API_KEY` starts with `sk_` and is from correct environment (test/prod) |
| 404 | Object not found | Verify object ID starts with `vault_obj_`, check it wasn't deleted |
| 422 | Validation failed | Check required fields: `data` object for creates, valid JSON structure |
| 429 | Rate limit | Implement exponential backoff, reduce request frequency |

### SDK-Specific Errors

**Node.js:**

```javascript
try {
  const obj = await workos.vault.createObject({ ... });
} catch (error) {
  if (error.code === 'invalid_api_key') {
    // Check environment variable
  } else if (error.code === 'resource_not_found') {
    // Object doesn't exist
  }
  console.error('Vault error:', error.message);
}
```

**Python:**

```python
from workos import WorkOSError

try:
    obj = workos.vault.create_object(...)
except WorkOSError as e:
    if e.code == 'invalid_api_key':
        # Check environment variable
    print(f"Vault error: {e.message}")
```

### Data Size Limits

**CRITICAL limits from docs:**
- Vault object `data` field: Check docs for max size
- `metadata` field: Check docs for max size
- Encrypt/decrypt endpoints: Check docs for payload limits

If you hit size limits:
```
Data too large?
  |
  +-- Structured data > limit
  |   --> Split into multiple objects with references
  |
  +-- Binary data > limit
      --> Encrypt in chunks OR store encrypted in S3/GCS
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. API key is valid
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/vault/objects?limit=1 | grep -q "data" && echo "PASS" || echo "FAIL: Invalid API key"

# 2. SDK is installed (Node.js example)
npm list @workos-inc/node 2>/dev/null | grep -q "@workos-inc/node" && echo "PASS" || echo "FAIL: SDK not installed"

# 3. Can create vault object
OBJECT_ID=$(curl -X POST https://api.workos.com/vault/objects \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-object","data":{"test":"value"}}' | jq -r '.id')
[ -n "$OBJECT_ID" ] && echo "PASS: Created $OBJECT_ID" || echo "FAIL: Object creation failed"

# 4. Can retrieve object
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/vault/objects/${OBJECT_ID}" | grep -q "vault_obj_" && echo "PASS" || echo "FAIL: Retrieval failed"

# 5. Can encrypt/decrypt data
ENCRYPTED=$(curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}' | jq -r '.ciphertext')
[ -n "$ENCRYPTED" ] && echo "PASS: Encryption works" || echo "FAIL: Encryption failed"
```

**If any check fails:** Stop and fix before marking integration complete.

## Security Best Practices

### API Key Management

**CRITICAL:** Never commit API keys to version control.

```bash
# Check for leaked keys BEFORE commit
grep -r "sk_[a-zA-Z0-9]" . --exclude-dir=node_modules --exclude-dir=.git
```

If found, rotate keys immediately in WorkOS Dashboard.

### Environment Separation

Use different API keys for test/production:

```bash
# .env.development
WORKOS_API_KEY=sk_test_...

# .env.production  
WORKOS_API_KEY=sk_prod_...
```

**Never** use production keys in development environments.

### Data Handling

- **DO NOT** log plaintext sensitive data
- **DO NOT** cache decrypted data longer than needed
- **DO** clear plaintext keys from memory after use (Step 4C)

## Related Skills

- `workos-authkit-nextjs` - If integrating Vault with authenticated Next.js app
- `workos-directory-sync` - If storing encrypted directory sync data
- `workos-user-management` - If encrypting user profile data
