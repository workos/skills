---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. https://workos.com/docs/vault/quick-start
2. https://workos.com/docs/vault/key-context
3. https://workos.com/docs/vault/index
4. https://workos.com/docs/vault/byok

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables or secrets manager for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing.

### Organization Setup

Confirm target WorkOS organization exists:

1. Check Dashboard or use Organizations API to list orgs
2. Note organization ID (format: `org_*`)

**Without an organization ID, Vault operations will fail.**

### Customer Key Management (BYOK Only)

If implementing Bring Your Own Key:

- Customer must have AWS KMS, Azure Key Vault, or Google Cloud KMS configured
- WorkOS service principal must have IAM permissions to use customer keys
- CMK identifiers must be configured in WorkOS Dashboard

**Skip this section if using WorkOS-managed keys (default).**

## Step 3: Install SDK

Detect language/framework, install WorkOS SDK:

```bash
# Node.js
npm install @workos-inc/node

# Python
pip install workos

# Ruby
gem install workos

# Go
go get github.com/workos/workos-go/v4

# Java
# Add to pom.xml or build.gradle per docs
```

**Verify:** SDK package exists before writing imports.

## Step 4: SDK Initialization

Initialize SDK with credentials. Pattern varies by language:

```
Language?
  |
  +-- Node.js --> Import WorkOS class, instantiate with apiKey
  |
  +-- Python  --> Import workos module, set workos.api_key
  |
  +-- Ruby    --> Require workos, set WorkOS.key!
  |
  +-- Go      --> Import workos package, create client with apiKey option
  |
  +-- Java    --> Create WorkOS instance with apiKey in builder
```

Check fetched Quick Start docs for exact initialization pattern.

**Critical:** Do NOT hardcode API keys. Load from environment or secrets manager.

## Step 5: Key Context Design (DECISION TREE)

Key context determines which encryption keys are used. Plan cardinality BEFORE creating objects:

```
Isolation requirement?
  |
  +-- Per-organization --> {"organization_id": "org_123"}
  |
  +-- Per-user --> {"organization_id": "org_123", "user_id": "user_456"}
  |
  +-- Per-tenant + data type --> {"organization_id": "org_123", "data_type": "ssn"}
  |
  +-- Custom hierarchy --> Up to 10 key-value pairs
```

**Key context rules (from docs):**

- All values MUST be strings
- Maximum 10 key-value pairs per context
- Context is IMMUTABLE after object creation (you cannot change keys, only values)
- Context determines KEK selection (WorkOS-managed or BYOK)

**Example for multi-tenant SaaS isolating customer data:**

```json
{
  "organization_id": "org_01HZMS...",
  "environment": "production",
  "data_classification": "pii"
}
```

This creates a unique encryption key for each combination of org + environment + classification.

## Step 6: Create Encrypted Object

Use SDK's Vault object creation method. Check fetched docs for exact method name (likely `vault.createObject` or similar).

**Pattern:**

```
SDK method to create object with:
  - key_context: dict/map of string pairs (from Step 5)
  - value: string blob to encrypt (JSON serialize if needed)
  - name: unique identifier within context (e.g., "user_ssn")
```

**Critical behaviors (from docs):**

- KEKs are created just-in-time based on key context
- A unique data-encrypting key (DEK) is generated per object
- DEK is encrypted with all KEKs from context
- Both encrypted value and encrypted DEKs are stored together

**Returns:** Object metadata including:

- Object name
- Version number (starts at 1)
- Created timestamp
- Key context (immutable)

**Example pseudo-code:**

```
object = workos.vault.createObject(
  keyContext: {"organization_id": "org_123"},
  name: "database_credentials",
  value: '{"username":"app","password":"secret123"}'
)
```

## Step 7: Retrieve Object Value

Use SDK's get/fetch object method. Check fetched docs for exact signature.

**Pattern:**

```
SDK method to fetch object with:
  - key_context: SAME context used at creation
  - name: object identifier
```

**Returns:** Object with decrypted value plus metadata (version, timestamps, etc.)

**Critical:** Key context MUST match exactly. Mismatched context will fail to decrypt even if object name exists.

## Step 8: Update Object Value

Use SDK's update object method. Key context CANNOT change, only value.

**Pattern:**

```
SDK method to update with:
  - key_context: original context (immutable)
  - name: object identifier
  - value: new encrypted value
  - version: (optional) expected current version for consistency check
```

**Version locking (from docs):**

- If `version` parameter is provided, update ONLY succeeds if current version matches
- Use this to prevent lost updates in concurrent scenarios
- If omitted, update always succeeds (last write wins)

**Version is incremented on each update.**

## Step 9: List and Query Objects

Two SDK methods for object discovery:

### List object names

Returns ONLY names, no metadata or values. Use for efficient enumeration.

```
SDK list method with:
  - key_context: context to query within
```

### Get object metadata

Returns metadata WITHOUT decrypting value. Use to check version, timestamps, context.

```
SDK metadata method with:
  - key_context: context to query within
  - name: object identifier
```

**Use metadata queries to check versions before expensive decrypt operations.**

## Step 10: Delete Object

Use SDK's delete object method. Marks for deletion but doesn't immediately wipe data.

**Pattern:**

```
SDK delete method with:
  - key_context: original context
  - name: object identifier
```

**From docs:** Object becomes unavailable to API operations immediately, but physical deletion is asynchronous.

**Cannot be undone.** Deleted objects cannot be recreated with same name until fully purged.

## Step 11: BYOK Configuration (Optional)

If using Bring Your Own Key, configure CMK mappings in WorkOS Dashboard.

**Critical from docs:** CMK selection is AUTOMATIC based on key context:

```
Key context matching example:
  |
  +-- {"organization_id": "org_abc123"} --> Uses CMK configured for org_abc123
  |
  +-- {"organization_id": "org_xyz987"} --> Uses WorkOS-managed KEK (no CMK configured)
```

**No code changes required for BYOK.** Vault automatically uses CMK when context matches configuration.

**Supported CMK providers:**

- AWS KMS
- Azure Key Vault
- Google Cloud KMS

Check fetched BYOK docs for Dashboard setup steps and IAM permission requirements.

## Step 12: Local Encryption (Advanced)

For client-side encryption before transmission, use SDK's encrypt method with Vault-managed keys.

**Pattern (check fetched docs for exact method):**

```
SDK encrypt method with:
  - key_context: context determining KEK
  - plaintext: data to encrypt
```

**Returns:** Encrypted blob with embedded encrypted DEKs.

**Use case:** Encrypt data client-side, store encrypted blob in your own database, decrypt later via SDK.

**Decryption:** Use corresponding decrypt method with same key context.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || pip show workos || gem list workos || go list -m github.com/workos/workos-go

# 2. Check credentials set
env | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY not set"
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID not set"

# 3. Test create object (replace with actual SDK test code)
# This is language-specific - write actual test that creates/retrieves/deletes object

# 4. Verify object encrypted at rest
# Check WorkOS Dashboard Vault section for test object

# 5. Application builds
npm run build || python -m py_compile app.py || rake build || go build || mvn compile
```

**Manual checks:**

- [ ] Created object appears in WorkOS Dashboard Vault section
- [ ] Retrieved value matches original plaintext
- [ ] Updated object shows incremented version
- [ ] Deleted object returns 404 on subsequent fetch
- [ ] BYOK: Customer CMK is used for configured organizations (check Dashboard audit)

## Error Recovery

### "Invalid key context" on create/fetch

**Root cause:** Context format validation failed.

Fixes:

1. Check all context values are strings (not numbers, booleans, objects)
2. Check context has ≤10 key-value pairs
3. Check no empty strings as keys or values

### "Object not found" with correct name

**Root cause:** Key context mismatch between create and fetch.

Fix: Verify EXACT context used at creation time. Even spacing in keys matters.

### "Version conflict" on update

**Root cause:** Object was modified between your fetch and update (concurrent write).

Fix: Fetch latest version, reapply changes, retry update with new version number.

### "Insufficient permissions" for BYOK

**Root cause:** WorkOS service principal lacks IAM permissions on customer CMK.

Fixes for each provider:

- **AWS KMS:** Grant `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey` to WorkOS role
- **Azure Key Vault:** Assign "Key Vault Crypto User" role to WorkOS service principal
- **Google Cloud KMS:** Grant `cloudkms.cryptoKeyVersions.useToEncrypt` and `useToDecrypt` permissions

Check fetched BYOK docs for exact IAM policy examples.

### "API key invalid"

**Root cause:** Key doesn't start with `sk_` or was revoked.

Fixes:

1. Regenerate API key in WorkOS Dashboard
2. Update `WORKOS_API_KEY` environment variable
3. Verify key is for correct environment (staging vs production)

### SDK import fails

**Root cause:** Package not installed or wrong import path.

Fixes:

1. Reinstall SDK package (see Step 3)
2. Check import path matches SDK version (e.g., `@workos-inc/node` not `workos`)
3. Clear package cache: `npm cache clean --force` or equivalent

### "Rate limit exceeded"

**Root cause:** Too many API requests in short time.

Fixes:

1. Implement exponential backoff on retries
2. Batch operations where possible (list instead of individual gets)
3. Cache decrypted values client-side if appropriate for use case
4. Contact WorkOS support for rate limit increase

## Related Skills

- **workos-api-vault**: Reference for Vault REST API direct usage
- **workos-audit-logs**: Audit Vault access events
- **workos-api-organization**: Manage organizations for key context isolation
