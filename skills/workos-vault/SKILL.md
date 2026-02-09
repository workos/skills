---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- generated -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check environment variables:
- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Verify API key:**
```bash
# Test API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq .
```

Expected: 200 response with organizations list (may be empty).

### Project Setup

- Confirm organization exists in WorkOS Dashboard
- For BYOK: Verify customer KMS access is configured (AWS KMS, Azure Key Vault, or Google Cloud KMS)

## Step 3: Install WorkOS SDK

Detect language/framework from project structure:

```
Project type detection:
  |
  +-- package.json present --> Node.js
  |     |
  |     +-- Has "next" --> Next.js (use Node SDK)
  |     +-- Has "react" --> React (use Node SDK server-side)
  |
  +-- requirements.txt / pyproject.toml --> Python
  |
  +-- go.mod --> Go
  |
  +-- Gemfile --> Ruby
```

Install SDK from documentation. **Verify:** SDK package exists before writing imports.

**Node.js example:**
```bash
npm install @workos-inc/node
# Verify
ls node_modules/@workos-inc/node
```

## Step 4: Initialize Vault Client

Create SDK client with credentials. Import pattern varies by language - check docs.

**Node.js pattern:**
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Critical:** Never hardcode API keys. Always use environment variables.

## Step 5: Implement Object Operations (Decision Tree)

Choose operation based on use case:

```
Vault operation needed?
  |
  +-- Store new secret --> CREATE object
  |
  +-- Update existing --> UPDATE object (with version lock)
  |
  +-- Read secret --> RETRIEVE object
  |
  +-- List all secrets --> LIST objects (metadata only)
  |
  +-- Remove secret --> DELETE object (soft delete)
```

### CREATE Object

**Key Context Rules (CRITICAL):**
- All values must be strings
- Maximum 10 items per context
- Context determines which encryption key is used
- Context CANNOT be changed after creation

Common context pattern:
```json
{
  "organization_id": "org_123",
  "environment": "production"
}
```

API call structure - check docs for language-specific syntax:
- Method: `vault.createObject()`
- Parameters: `key_context`, `name`, `value`
- Returns: Object with `id`, `version`, `created_at`

### UPDATE Object

**Version locking:** Provide expected version to prevent concurrent modification issues.

API call structure:
- Method: `vault.updateObject()`
- Parameters: `object_id`, `value`, `expected_version` (optional but recommended)
- Returns: Updated object with new `version`

**Error:** If version mismatch, read current version and retry or handle conflict.

### RETRIEVE Object

**Two modes:**

1. **Metadata only** (no decryption):
   - Faster, cheaper
   - Returns: `id`, `name`, `key_context`, `version`, timestamps
   - No `value` field

2. **Full object** (with decryption):
   - Returns metadata + decrypted `value`
   - Use when you need the actual secret

Check docs for method names - often `vault.getObject()` vs `vault.getObjectMetadata()`.

### LIST Objects

Returns array of metadata for all objects matching filter.

**Pagination:** If you have many objects, use pagination parameters from docs.

### DELETE Object

**Soft delete:** Object marked for deletion, not immediately removed.

After deletion:
- Object not accessible via API
- Underlying data persists temporarily per retention policy
- Cannot be undeleted - must recreate

## Step 6: BYOK Setup (Optional)

**Only if customer provides their own KMS key.**

### Prerequisites Check

Customer must have:
- AWS KMS key with proper IAM permissions, OR
- Azure Key Vault key with service principal access, OR
- Google Cloud KMS key with service account permissions

### Configuration Steps

1. Get KMS key ARN/ID/URI from customer
2. Configure in WorkOS Dashboard under organization settings
3. Grant WorkOS access to KMS key (IAM policy/service principal)
4. Test key access with a test encryption operation

**Key Matching:** When key context includes `{"organization_id": "org_with_byok"}`, Vault automatically uses the configured CMK instead of WorkOS-managed KEK.

**Verify BYOK setup:**
```bash
# Create test object for BYOK org
# Should succeed without errors about key access
```

If errors mention key access, check IAM permissions in customer's KMS.

## Step 7: Error Handling Patterns

Implement these error cases:

### Authentication Errors (401)
```
Root cause: Invalid or expired API key
Fix: Check WORKOS_API_KEY value and permissions
```

### Version Conflict (409)
```
Root cause: Object version changed since last read
Fix: Read current version, handle conflict (merge/overwrite), retry
```

### Key Context Validation Errors (400)
```
Root causes:
- Non-string values in context
- More than 10 items
- Empty context
Fix: Validate context before API call
```

### KMS Access Errors (502/503)
```
Root cause: Cannot reach customer's KMS or insufficient permissions
Fix: 
1. Check customer KMS service status
2. Verify IAM/service principal permissions
3. Test key access outside Vault
```

### Rate Limiting (429)
```
Root cause: Too many requests
Fix: Implement exponential backoff, check rate limits in docs
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 2. Environment variables set
env | grep WORKOS_API_KEY | grep -q "^WORKOS_API_KEY=sk_" || echo "FAIL: API key invalid"
env | grep -q WORKOS_CLIENT_ID || echo "FAIL: Client ID missing"

# 3. API connectivity
curl -sf -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations > /dev/null || echo "FAIL: Cannot reach API"

# 4. Create test object (replace org_id with real value)
# Run your implementation's create function
# Expected: Success response with object ID

# 5. Retrieve test object
# Run your implementation's get function
# Expected: Decrypted value matches what was stored

# 6. List objects
# Run your implementation's list function
# Expected: Array containing test object

# 7. Delete test object
# Run your implementation's delete function
# Expected: Success, object no longer retrievable

# 8. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**Do not mark complete until all 8 checks pass.**

## Security Checklist

- [ ] API keys stored as environment variables (never in code)
- [ ] Key context includes appropriate isolation boundaries (e.g., `organization_id`)
- [ ] Decrypted values never logged or exposed in error messages
- [ ] Version locking used for updates to prevent race conditions
- [ ] BYOK KMS permissions follow least-privilege principle

## Common Pitfalls

### "Key context cannot be changed"
**Symptom:** Update fails when trying to modify context.

**Fix:** Context is immutable. To change context, create new object with new name/context and delete old one.

### "Too many keys in context"
**Symptom:** API returns 400 with context validation error.

**Fix:** Maximum 10 items in key context. Consolidate or use composite string values.

### "BYOK key not found"
**Symptom:** 502/503 errors after configuring customer KMS.

**Fix:**
1. Verify key ARN/ID in Dashboard matches customer's key
2. Check WorkOS service principal has `kms:Encrypt` and `kms:Decrypt` permissions
3. Test key access with customer's cloud console

### "Object already exists"
**Symptom:** Create fails with conflict error.

**Fix:** Object names must be unique within key context scope. Use unique names or retrieve/update instead of create.

## Performance Considerations

- **Metadata vs Full Retrieval:** Use metadata-only queries when you don't need decrypted values (faster, cheaper)
- **Batch Operations:** If available in SDK, use batch APIs for multiple objects
- **Caching:** Cache decrypted values in memory if accessed frequently (be mindful of security implications)
- **Key Context Cardinality:** More specific contexts = more unique keys. Balance isolation vs key proliferation.

## Related Skills

- **workos-audit-logs**: Audit vault access and key operations for compliance
- **workos-user-management**: Associate vault objects with user identities
- **workos-organizations**: Multi-tenant key isolation patterns
