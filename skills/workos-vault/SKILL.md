---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables or secrets manager for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both values are non-empty and correctly prefixed before proceeding.

### Project Dependencies

- Confirm WorkOS SDK is installed: `npm list @workos-inc/node` or equivalent for your language
- Confirm `package.json` (or equivalent) includes WorkOS SDK dependency

## Step 3: Organization Setup (REQUIRED)

Vault encryption is **always** scoped to a WorkOS Organization. You cannot encrypt data without an organization context.

**Decision tree:**

```
Do you have existing Organizations?
  |
  +-- YES --> Use organization_id from your database
  |
  +-- NO  --> Create test organization via API or Dashboard first
```

**Critical:** The `organization_id` is required in the key context for all Vault operations. No organization = no encryption.

## Step 4: Key Context Design (PLANNING PHASE)

Before writing code, determine your key isolation strategy. This cannot be changed after objects are created.

### Key Context Rules (from docs)

- All values must be strings
- Maximum 10 key-value pairs per context
- Context determines which encryption keys are used
- **Same context = same key** (important for billing and key rotation)

### Common Patterns

**Pattern 1: Organization-scoped (most common)**
```json
{"organization_id": "org_abc123"}
```
Use when: All data for an org uses the same key

**Pattern 2: Organization + data type**
```json
{"organization_id": "org_abc123", "data_type": "user_credentials"}
```
Use when: You want separate keys for different data types within an org

**Pattern 3: Organization + user**
```json
{"organization_id": "org_abc123", "user_id": "user_xyz"}
```
Use when: Each user gets their own key (CAUTION: high key count = higher costs)

**Document your chosen pattern now.** Changing key context later requires re-encrypting all data.

## Step 5: SDK Installation and Import

Detect language from project structure:

```
Language detection:
  |
  +-- package.json present --> Node.js (@workos-inc/node)
  |
  +-- requirements.txt / pyproject.toml --> Python (workos)
  |
  +-- go.mod --> Go (github.com/workos/workos-go)
  |
  +-- Gemfile --> Ruby (workos)
```

**Install command (example for Node.js):**
```bash
npm install @workos-inc/node
```

**Verify:** SDK package exists in dependencies/node_modules before proceeding.

**Import pattern:** Check fetched docs for current import syntax. SDK initialization typically requires API key:

```javascript
// Example - verify exact syntax in fetched docs
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

## Step 6: Create Encrypted Object

WebFetch the docs for exact method names — do NOT assume method signatures.

**Typical flow (verify with docs):**

1. Prepare key context (from Step 4)
2. Prepare plaintext value to encrypt
3. Call SDK method to create object (name + value + key_context)

**Expected parameters (check docs for exact names):**
- `name`: String identifier for the object
- `value`: Plaintext data to encrypt (string or bytes)
- `key_context`: JSON object matching your design from Step 4

**Return value:** Object metadata including `id`, `version`, `created_at`

## Step 7: Retrieve Object Value

Retrieve operations require:
- Object `name` or `id` (check docs for which is primary)
- Same key context used during creation (CRITICAL)

**Common mistake:** Passing different key context than creation → decryption fails

**Decision tree for retrieval:**

```
Need just metadata or full value?
  |
  +-- Metadata only (size, version, timestamps)
  |     └─> Use metadata/list method (faster, no decryption)
  |
  +-- Full decrypted value
        └─> Use fetch/get method (returns value + metadata)
```

## Step 8: Update Object Value

**Key constraint:** The key context is **immutable** after creation. Only the value can be updated.

**Optimistic locking pattern:**
- Pass current `version` when updating
- API rejects if version doesn't match (prevents race conditions)
- If rejected, refetch current version and retry

Check fetched docs for update method signature and version parameter name.

## Step 9: Delete Object

**Important:** Deletion is a soft delete that marks the object unavailable. Actual data deletion happens later (check docs for timing).

Deletion requires:
- Object `name` or `id`
- Key context (for authorization)

**Verify:** After deletion, retrieval attempts should fail with appropriate error (not "object not found" if soft delete).

## Step 10: BYOK Setup (OPTIONAL)

**Skip this section unless customer specifically needs Bring Your Own Key.**

BYOK requires:
1. Customer has AWS KMS, Azure Key Vault, or Google Cloud KMS
2. Customer has configured CMK (Customer Managed Key) in their KMS
3. WorkOS Vault has IAM permissions to use customer's CMK

**Configuration location:** WorkOS Dashboard → Organization Settings → Vault

**How BYOK affects key context:**
- Same key context behavior
- WorkOS automatically uses customer's CMK instead of WorkOS-managed KEK
- Transparent to your application code (no code changes needed)

**Example from docs:**
```
Context: {"organization_id": "org_abc123"}
- Without BYOK: Uses WorkOS KEK for org_abc123
- With BYOK: Uses customer's CMK for org_abc123
```

WebFetch https://workos.com/docs/vault/byok for IAM permission requirements and setup steps.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm implementation:

```bash
# 1. Verify SDK is installed
npm list @workos-inc/node || pip show workos || go list -m github.com/workos/workos-go

# 2. Verify environment variables are set
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key valid" || echo "FAIL: API key invalid"

# 3. Test create operation (replace with actual test)
# Run your application's Vault test suite or integration test
npm test -- vault.test.js

# 4. Verify object can be retrieved after creation
# Your test should: create object → retrieve → compare values

# 5. Verify different key context fails to decrypt
# Your test should: create with context A → try retrieve with context B → expect failure
```

**Critical verification:** Create an object with `{"organization_id": "test_org"}`, then try to retrieve it with `{"organization_id": "different_org"}`. This should fail — if it doesn't, key context is not being enforced.

## Error Recovery

### "Invalid key context" / "Key context required"

**Root cause:** Missing or malformed key context object.

**Fix:**
1. Verify key context is a JSON object (not a string)
2. Check all values are strings (not numbers or booleans)
3. Verify no more than 10 key-value pairs
4. Ensure `organization_id` is present (common requirement — check docs)

### "Object not found" on retrieve

**Root cause:** Key context mismatch between create and retrieve.

**Fix:**
1. Log the key context used during creation
2. Compare with key context used during retrieval
3. Ensure exact match (order doesn't matter, but keys and values must be identical)

### "Version conflict" on update

**Root cause:** Another process updated the object between your read and write.

**Fix:** Implement retry logic:
1. Refetch object to get current version
2. Apply your update to the new value
3. Retry update with new version number
4. Consider exponential backoff if contention is high

### "Decryption failed" / "KMS error"

**Root cause (BYOK only):** WorkOS cannot access customer's CMK.

**Fix:**
1. Verify CMK exists in customer's KMS
2. Check IAM permissions (see BYOK docs for required policies)
3. Verify CMK is enabled (not disabled or scheduled for deletion)
4. Check CloudWatch/Azure Monitor logs for KMS access denied errors

### "API key invalid" or 401 errors

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_` which is publishable key)
2. Check key is from correct environment (test vs production)
3. Regenerate key in WorkOS Dashboard if compromised

### SDK import errors

**Fix:**
1. Verify SDK version matches your language runtime (e.g., Node.js 16+ for @workos-inc/node v5+)
2. Clear package cache: `npm cache clean --force` or equivalent
3. Reinstall SDK: `rm -rf node_modules && npm install`

## Related Skills

- **workos-api-vault**: Lower-level API reference (if you need direct HTTP calls instead of SDK)
- **workos-audit-logs**: Track who accessed encrypted data for compliance
- **workos-api-organization**: Manage organizations that scope Vault encryption
