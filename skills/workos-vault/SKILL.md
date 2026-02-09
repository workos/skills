---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables or config for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Organization Setup

- Confirm a WorkOS Organization exists in the Dashboard
- Note the organization ID (format: `org_*` or `organization_*`)

### BYOK Requirements (if applicable)

If using customer-managed keys:

- Customer has AWS KMS, Azure Key Vault, or Google Cloud KMS configured
- WorkOS has IAM permissions to access customer keys
- BYOK is configured in WorkOS Dashboard for the organization

## Step 3: Install WorkOS SDK

Detect package manager, install WorkOS SDK from docs.

**Language-specific packages:**
- Node.js: `@workos-inc/node`
- Python: `workos`
- Ruby: `workos`
- Go: `github.com/workos/workos-go/v4`

**Verify:** SDK package exists in node_modules/vendor/go.mod before continuing.

## Step 4: SDK Initialization

Initialize SDK with credentials. Pattern varies by language:

```
Language?
  |
  +-- Node.js --> Import WorkOS, pass apiKey in constructor or env
  |
  +-- Python --> Import workos, set api_key attribute or env
  |
  +-- Ruby --> Require workos, configure with API key
  |
  +-- Go --> Import workos, create client with API key
```

Check docs for exact initialization pattern. Store credentials as environment variables, not hardcoded.

## Step 5: Create Encrypted Object (Decision Tree)

Determine key context based on isolation requirements:

```
Isolation level?
  |
  +-- Per organization --> {"organization_id": "org_abc123"}
  |
  +-- Per user --> {"organization_id": "org_abc123", "user_id": "user_xyz"}
  |
  +-- Per resource type --> {"organization_id": "org_abc123", "resource_type": "documents"}
  |
  +-- Custom dimensions --> Up to 10 key-value pairs
```

**Critical:** Key context determines encryption keys. Once set for an object, it CANNOT be changed.

Create object using SDK method from docs (likely `vault.create_object()` or similar).

**Required parameters:**
- `name` - object identifier (string)
- `value` - data to encrypt (string/bytes)
- `key_context` - key-value metadata (dict/map, max 10 items, all string values)

**Optional parameters:**
- `organization_id` - WorkOS organization (may be inferred from key context)
- `expected_version` - consistency lock for updates

## Step 6: Retrieve Object Value

### List Objects (metadata only)

Use list/query method to get object names without decrypting values.

### Get Object Metadata

Fetch metadata (name, version, created_at) without decrypting value.

### Decrypt Object Value

Fetch full object including decrypted value using get/fetch method from docs.

**Returns:** Metadata + plaintext value

## Step 7: Update Object Value

Use update method with:

- `name` - object to update
- `value` - new encrypted value
- `expected_version` (recommended) - current version for consistency lock

**Critical:** Key context CANNOT be changed on update. Only value can be modified.

**Concurrency protection:** If `expected_version` is provided and doesn't match current version, update fails. This prevents lost writes.

## Step 8: Delete Object

Call delete method with object name.

**Important:** Deletion is asynchronous. Object becomes unavailable immediately but data is not instantly purged.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK is installed
[ -d "node_modules/@workos-inc/node" ] || pip show workos || gem list workos || go list github.com/workos/workos-go/v4

# 2. Check environment variables are set
[ -n "$WORKOS_API_KEY" ] && echo "API key set" || echo "FAIL: Missing WORKOS_API_KEY"
[ -n "$WORKOS_CLIENT_ID" ] && echo "Client ID set" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 3. Test API connectivity (adjust for your language)
# Node.js example:
node -e "const {WorkOS} = require('@workos-inc/node'); const w = new WorkOS(process.env.WORKOS_API_KEY); console.log('SDK initialized')"

# 4. Application builds without errors
npm run build || python -m py_compile main.py || bundle exec rake build || go build
```

## BYOK Integration (if applicable)

### Step 1: Configure Customer Key

In WorkOS Dashboard:

1. Navigate to organization settings
2. Add customer-managed key (CMK) details
3. Provide key ARN/ID and region/location

### Step 2: Grant WorkOS Permissions

Customer must grant WorkOS IAM permissions:

**AWS KMS:**
- `kms:Decrypt`
- `kms:Encrypt`
- `kms:GenerateDataKey`

**Azure Key Vault:**
- `keys/encrypt`
- `keys/decrypt`
- `keys/wrap`
- `keys/unwrap`

**Google Cloud KMS:**
- `cloudkms.cryptoKeyVersions.useToEncrypt`
- `cloudkms.cryptoKeyVersions.useToDecrypt`

### Step 3: Verify Key Context Routing

When key context matches BYOK configuration (e.g., `{"organization_id": "org_byok"}`), Vault automatically uses CMK.

When key context doesn't match, Vault uses WorkOS-managed KEK.

**Test:** Create object with BYOK organization ID, verify encryption succeeds.

## Error Recovery

### "Invalid key context" or "context must be object"

**Root cause:** Key context is not a string-keyed object, or has non-string values.

**Fix:**
1. Check all context values are strings (not numbers or booleans)
2. Check max 10 key-value pairs
3. Example valid context: `{"org_id": "123", "user_id": "456"}` (not `{"org_id": 123}`)

### "Key context cannot be changed"

**Root cause:** Attempted to update object with different key context than original.

**Fix:**
1. Key context is immutable after creation
2. To change isolation: create new object, copy value, delete old object
3. Check docs for object migration patterns

### "Expected version mismatch" on update

**Root cause:** Another process updated the object between read and write.

**Fix:**
1. Fetch latest object version
2. Retry update with new `expected_version`
3. Implement retry logic with exponential backoff

### "Insufficient permissions" with BYOK

**Root cause:** WorkOS cannot access customer-managed key.

**Fix:**
1. Verify IAM policy grants required permissions to WorkOS principal
2. Check key ARN/ID is correct in Dashboard
3. Verify key is in same region as configured
4. Check customer key is enabled (not disabled or pending deletion)
5. Reference BYOK docs: https://workos.com/docs/vault/byok

### "Organization not found" or "Invalid organization ID"

**Root cause:** Organization ID doesn't exist or is malformed.

**Fix:**
1. List organizations in WorkOS Dashboard
2. Check organization ID format (usually `org_*` or `organization_*`)
3. Verify organization is active, not deleted

### SDK import errors

**Root cause:** Package not installed or wrong import path.

**Fix:**
1. Verify SDK installation: `npm list @workos-inc/node` or equivalent
2. Check docs for correct import path for SDK version
3. Clear package cache and reinstall

### "API key invalid" or 401 Unauthorized

**Root cause:** Missing or incorrect API key.

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is for correct environment (staging vs production)
3. Regenerate key in WorkOS Dashboard if compromised

## Key Context Design Patterns

### Pattern 1: Organization-Level Isolation

Use when all data for an organization shares encryption keys:

```
key_context = {"organization_id": "org_abc123"}
```

### Pattern 2: Multi-Tenant with User Isolation

Use when each user's data needs separate keys:

```
key_context = {
  "organization_id": "org_abc123",
  "user_id": "user_xyz789"
}
```

### Pattern 3: Resource Type Isolation

Use when different data types need separate keys:

```
key_context = {
  "organization_id": "org_abc123",
  "resource_type": "api_keys"
}
```

### Pattern 4: Compliance Boundary Isolation

Use when data must be isolated by regulatory requirements:

```
key_context = {
  "organization_id": "org_abc123",
  "data_classification": "pii",
  "region": "eu-west-1"
}
```

**Critical:** More granular key context = more keys generated. Balance security isolation with operational complexity.

## Related Skills

- **workos-audit-logs**: Track Vault access for compliance
- **workos-directory-sync**: Sync user data that may need Vault encryption
- **workos-sso**: Authenticate users accessing Vault-encrypted data
