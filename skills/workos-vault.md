---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order for latest implementation details:

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both variables exist and have correct prefixes before continuing.

### SDK Installation

Detect package manager from lockfile:

```
Lockfile present?
  |
  +-- package-lock.json --> npm install @workos-inc/node
  |
  +-- yarn.lock --> yarn add @workos-inc/node
  |
  +-- pnpm-lock.yaml --> pnpm add @workos-inc/node
  |
  +-- bun.lockb --> bun add @workos-inc/node
```

**Verify:** Run `ls node_modules/@workos-inc` to confirm package installed.

### Customer Prerequisites (IMPORTANT)

Vault requires customer-managed KMS for BYOK. Confirm customer has one of:

- AWS KMS (recommended for AWS-hosted apps)
- Azure Key Vault (recommended for Azure-hosted apps)
- Google Cloud KMS (recommended for GCP-hosted apps)

If customer has no KMS, WorkOS uses internal KEKs (key-encrypting keys). This is valid but not customer-managed encryption.

## Step 3: Organization Setup (REQUIRED)

**You MUST create a WorkOS Organization before using Vault.**

```
Has WorkOS Organization?
  |
  +-- Yes --> Proceed to Step 4
  |
  +-- No  --> Create via Dashboard or API first
```

Organizations isolate encryption contexts. Without an org, Vault API calls fail with "organization not found".

Check for existing orgs:

```bash
# Verify organization exists
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data[].id'
```

If no orgs returned, create one via Dashboard (https://dashboard.workos.com) or API.

## Step 4: Key Context Strategy (Decision Tree)

**Key context determines encryption key cardinality.** Choose strategy based on isolation requirements:

```
Isolation requirement?
  |
  +-- Per-organization only
  |     --> {"organization_id": "org_123"}
  |     --> One KEK per org, shared across all objects
  |
  +-- Per-organization + per-user
  |     --> {"organization_id": "org_123", "user_id": "user_456"}
  |     --> Unique KEK per user within org
  |
  +-- Per-organization + per-resource-type
  |     --> {"organization_id": "org_123", "resource_type": "documents"}
  |     --> Unique KEK per resource type within org
  |
  +-- Maximum isolation (custom)
        --> {"organization_id": "org_123", "tenant_id": "tenant_abc", "environment": "prod"}
        --> Unique KEK per combination (up to 10 context items max)
```

**Constraints from docs:**

- All context values MUST be strings
- Maximum 10 key-value pairs per context
- Context is immutable after object creation (cannot change isolation level)

**Critical:** Key context determines which KEK/CMK is used. For BYOK, context must match CMK configuration in customer's KMS.

## Step 5: Create Encrypted Objects

### Basic Pattern

```typescript
// Import SDK (check fetched docs for exact import path)
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create encrypted object
const object = await workos.vault.createObject({
  organizationId: "org_123",
  name: "user-ssn",
  value: "123-45-6789",
  keyContext: {
    organization_id: "org_123",
    user_id: "user_456",
  },
});

// Save object.id for future operations
```

**Verify:** Object creation returns an `id` field. If error "organization not found", go back to Step 3.

### Version Tracking (IMPORTANT)

Each object has a `version` field (integer). Track this for consistency locks:

```typescript
// Initial creation returns version: 1
const obj = await workos.vault.createObject({...});
console.log(obj.version); // 1

// Update with consistency lock
const updated = await workos.vault.updateObject({
  objectId: obj.id,
  value: 'new-value',
  expectedVersion: 1  // Fails if version changed (prevents race conditions)
});
console.log(updated.version); // 2
```

**Use case:** Multi-threaded updates where stale reads must abort.

## Step 6: Retrieve and Update Objects

### Retrieval Patterns

```
What do you need?
  |
  +-- List object names only
  |     --> workos.vault.listObjects({organizationId})
  |     --> Returns names, no decryption
  |
  +-- Object metadata (no value)
  |     --> workos.vault.getObjectMetadata({objectId})
  |     --> Returns version, keyContext, createdAt - no decryption cost
  |
  +-- Decrypted value + metadata
        --> workos.vault.getObject({objectId})
        --> Full decryption, returns value + metadata
```

**Performance:** Use metadata endpoint when value not needed (e.g., checking if object exists).

### Update Pattern

```typescript
// Update object value (key context is immutable)
const updated = await workos.vault.updateObject({
  objectId: "object_abc",
  value: "updated-value",
  expectedVersion: 2, // Optional consistency lock
});

// Key context CANNOT be changed after creation
// To change isolation: delete old object, create new with different context
```

## Step 7: Deletion (Soft Delete)

Objects marked for deletion are immediately unavailable but not immediately purged:

```typescript
// Mark for deletion
await workos.vault.deleteObject({
  objectId: "object_abc",
});

// Object now unavailable to all API operations
// Actual purge happens asynchronously (not documented timeline)
```

**Critical:** Deletion is irreversible. No "undelete" operation exists.

## Step 8: BYOK Configuration (Optional)

**Only proceed if customer has KMS setup from Step 2.**

### CMK Mapping

Customer-managed keys (CMKs) are matched to encryption operations via key context:

```
Example: CMK named "key_abc" configured for org "organization_123"

Key context                          --> Key used
{"organization_id": "organization_123"} --> key_abc (customer CMK)
{"organization_id": "organization_999"} --> WorkOS KEK (default)
{"organization_id": "organization_123", "env": "prod"} --> WorkOS KEK (no CMK match)
```

**Critical:** CMK configuration happens in WorkOS Dashboard + customer KMS IAM. Not in code.

### IAM Requirements

Customer must grant WorkOS IAM permissions in their KMS:

```
AWS KMS:
  - kms:Encrypt
  - kms:Decrypt
  - kms:GenerateDataKey

Azure Key Vault:
  - keys/encrypt
  - keys/decrypt
  - keys/wrapKey
  - keys/unwrapKey

GCP KMS:
  - cloudkms.cryptoKeyVersions.useToEncrypt
  - cloudkms.cryptoKeyVersions.useToDecrypt
```

See fetched BYOK documentation for exact IAM policy templates.

**Verify:** Test encryption with BYOK context, check KMS logs for key usage.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables configured
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS: API key format" || echo "FAIL: API key missing/invalid"
echo $WORKOS_CLIENT_ID | grep -q '^client_' && echo "PASS: Client ID format" || echo "FAIL: Client ID missing/invalid"

# 2. SDK package installed
ls node_modules/@workos-inc/node && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Organization exists
curl -s -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq -e '.data | length > 0' && echo "PASS: Org exists" || echo "FAIL: No orgs found"

# 4. Can create test object (replace org_123 with real org ID)
curl -s -X POST "https://api.workos.com/vault/objects" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"org_123","name":"test","value":"test","key_context":{"organization_id":"org_123"}}' \
  | jq -e '.id' && echo "PASS: Object creation" || echo "FAIL: Cannot create object"

# 5. Application builds
npm run build || yarn build || pnpm build
```

**Do not mark complete until all checks pass.**

## Error Recovery

### "organization not found"

**Root cause:** No WorkOS Organization exists for the provided ID.

Fix:

1. List orgs: `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/organizations`
2. If empty, create org via Dashboard or API first (Step 3)
3. Use correct `organization_id` in object operations

### "invalid key context" or "context exceeds 10 items"

**Root cause:** Key context violates constraints (non-string value, too many items).

Fix:

1. Verify all context values are strings: `{"org": "123"}` not `{"org": 123}`
2. Count context items, must be ≤ 10
3. Remove unnecessary context keys to reduce cardinality

### "expected version mismatch" (409 Conflict)

**Root cause:** Object was updated by another process between read and write.

Fix:

1. Re-fetch latest version: `getObjectMetadata({objectId})`
2. Retry update with new `expectedVersion`
3. Or omit `expectedVersion` to force update (risks race conditions)

### "key context cannot be modified"

**Root cause:** Attempted to change key context on existing object.

Fix:

1. Key context is immutable by design (determines KEK)
2. To change isolation: delete object, create new with different context
3. Data migration required if changing all objects

### BYOK key not used / falling back to WorkOS KEK

**Root cause:** Key context doesn't match CMK configuration or IAM permissions missing.

Fix:

1. Check WorkOS Dashboard: CMK mapped to exact key context?
2. Verify customer IAM grants WorkOS permissions (see Step 8)
3. Test with minimal context first: `{"organization_id": "org_123"}`
4. Check customer KMS logs for denied access attempts

### SDK import errors

**Root cause:** Wrong import path or package not installed.

Fix:

1. Verify package: `ls node_modules/@workos-inc/node`
2. Check fetched docs for correct import path (may be different for non-Node SDKs)
3. Reinstall if corrupted: `rm -rf node_modules/@workos-inc && npm install`

## Related Skills

- **workos-directory-sync.rules.yml**: Sync user data that feeds into Vault key contexts (e.g., organization_id)
