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

The official docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both variables are set before writing any code.

### Dashboard Configuration

**BLOCKING:** Log into WorkOS Dashboard and create an Organization if one doesn't exist. Vault objects are scoped to Organizations.

URL: https://dashboard.workos.com

Note the Organization ID (starts with `org_`) - you'll need this for key context.

### Customer Key Management (BYOK Only)

If using BYOK (customer-managed keys), verify customer has ONE of:

- AWS KMS with IAM role for WorkOS
- Azure Key Vault with service principal for WorkOS
- Google Cloud KMS with service account for WorkOS

**If not using BYOK:** Skip this check. WorkOS-managed keys work out of the box.

## Step 3: Install SDK

Detect package manager and install WorkOS SDK. See fetched docs for language-specific packages.

**Verify:** SDK package exists in dependencies before continuing.

```bash
# Node.js example
grep "@workos-inc/node" package.json
```

## Step 4: Initialize SDK Client

Import SDK and configure with API credentials. See fetched docs for exact import paths per language.

**Critical:** Never hardcode API keys. Use environment variables or secret management.

## Step 5: Understand Key Context (Decision Tree)

Key context is a JSON object of metadata that determines which encryption key to use. This is REQUIRED for all Vault operations.

```
Key Context Use Cases
  |
  +-- Single tenant per org --> {"organization_id": "org_abc123"}
  |
  +-- Multi-tenant with user isolation --> {"organization_id": "org_abc123", "user_id": "user_xyz"}
  |
  +-- Environment separation --> {"organization_id": "org_abc123", "environment": "production"}
  |
  +-- BYOK (customer key) --> {"organization_id": "org_abc123"} matches to customer CMK
```

**Key Context Rules (enforced by API):**

- All values MUST be strings
- Maximum 10 key-value pairs
- Once set for an object, key context CANNOT be changed (only value can update)

**BYOK matching:** If customer `org_abc123` has configured a CMK, Vault automatically uses it when key context contains `{"organization_id": "org_abc123"}`. Otherwise, WorkOS-managed KEK is used.

## Step 6: Create Encrypted Object

Use SDK method to create encrypted object. See fetched docs for exact method signature.

**Pattern:**

1. Choose object name (e.g., "database_credentials", "api_token")
2. Define key context matching your isolation needs
3. Provide value to encrypt (string or bytes depending on SDK)
4. Call create method with: name, key_context, value

**Verify:** Object creation returns metadata (name, version, created_at) WITHOUT decrypted value.

## Step 7: Retrieve Object Value

Vault provides THREE retrieval patterns:

```
Retrieval Options
  |
  +-- List objects --> Returns names only (no metadata, no values)
  |
  +-- Get object metadata --> Returns name, version, created_at, key_context (no value)
  |
  +-- Get object value --> Returns metadata + decrypted value
```

**When to use each:**

- List: UI showing available secrets
- Metadata: Check version before update, audit object existence
- Value: Actually use the secret

## Step 8: Update Object Value

**Critical:** Key context is IMMUTABLE. You can only change the value.

**Optimistic locking pattern:**

1. Get current object metadata to read version
2. Call update with expected_version parameter
3. If version mismatch, API returns error (prevents race conditions)

See fetched docs for exact update method signature.

## Step 9: Delete Object

Deletion is a two-phase process:

1. Mark for deletion (object becomes unavailable immediately)
2. Actual data deletion happens asynchronously

**Important:** Once marked for deletion, the object cannot be retrieved. This is irreversible.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 2. Environment variables set
test -n "$WORKOS_API_KEY" && echo "PASS: API key set" || echo "FAIL: Missing WORKOS_API_KEY"
test -n "$WORKOS_CLIENT_ID" && echo "PASS: Client ID set" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 3. API key format
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: Key format valid" || echo "FAIL: Key must start with sk_"

# 4. Test API connectivity (requires working code)
# Run your test script that creates and retrieves an object
```

**Manual verification:**

- [ ] Created test object in WorkOS Dashboard Vault section
- [ ] Retrieved object value matches original
- [ ] Updated object increments version
- [ ] Deleted object becomes inaccessible

## Error Recovery

### "Invalid key context: values must be strings"

**Root cause:** Passing integers, booleans, or objects in key context.

**Fix:**

```javascript
// WRONG
{organization_id: 123, active: true}

// CORRECT
{organization_id: "123", active: "true"}
```

### "Key context exceeds maximum size"

**Root cause:** More than 10 key-value pairs in context.

**Fix:** Reduce to 10 or fewer. Consider if all fields are necessary for isolation.

### "Cannot update key context"

**Root cause:** Trying to change key context on existing object.

**Fix:** Create new object with different name and desired key context, then delete old object.

### "Expected version mismatch"

**Root cause:** Object was modified between read and write (race condition).

**Fix:** Re-fetch current version and retry update.

### "Organization not found"

**Root cause:** Organization ID in key context doesn't exist in WorkOS.

**Fix:** Verify org ID in Dashboard, ensure it starts with `org_`.

### "Insufficient permissions for BYOK key"

**Root cause:** WorkOS cannot access customer-managed key (AWS KMS, Azure Key Vault, etc.).

**Fix:**

1. Check IAM role/service principal permissions in customer's cloud provider
2. Verify key ID is correctly configured in WorkOS Dashboard
3. Test key access directly in cloud provider console

Refer to https://workos.com/docs/vault/byok for detailed BYOK setup per provider.

### "Object marked for deletion"

**Root cause:** Attempting to access object after deletion call.

**Fix:** Object cannot be recovered. Re-create if needed.

## Integration Patterns

### Pattern 1: Per-Organization Database Credentials

```
Use case: SaaS app with separate DB per customer
Key context: {"organization_id": "org_abc123"}
Object name: "db_connection_string"
```

### Pattern 2: Per-User API Tokens

```
Use case: OAuth tokens for external services
Key context: {"organization_id": "org_abc123", "user_id": "user_xyz"}
Object name: "slack_oauth_token"
```

### Pattern 3: Environment Separation

```
Use case: Different keys for prod/staging
Key context: {"organization_id": "org_abc123", "environment": "production"}
Object name: "stripe_secret_key"
```

### Pattern 4: BYOK Compliance

```
Use case: Customer in regulated industry requires own keys
Setup: Customer configures AWS KMS key in WorkOS Dashboard
Key context: {"organization_id": "org_abc123"} → automatically uses customer CMK
No code changes needed - WorkOS routes to customer key transparently
```

## BYOK Decision Tree

```
Do you need BYOK?
  |
  +-- YES (compliance, customer requirement)
  |     |
  |     +-- Customer has AWS? --> Use AWS KMS integration
  |     +-- Customer has Azure? --> Use Azure Key Vault integration
  |     +-- Customer has GCP? --> Use Google Cloud KMS integration
  |
  +-- NO (standard security sufficient) --> Use WorkOS-managed keys (default)
```

**BYOK setup is in Dashboard, NOT code.** Once configured, same SDK calls work transparently.

## Related Skills

- **workos-audit-logs**: Audit secret access and modifications
- **workos-directory-sync**: Sync organization data for key context
- **workos-sso**: Combine with SSO for complete auth + secrets solution
