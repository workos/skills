---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- generated -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The official migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check `.env.local` or `.env` for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys exist and are valid before continuing.

### WorkOS SDK Installation

Detect package manager, confirm SDK is installed:

```bash
# Check if SDK exists
grep -E '"@workos-inc/(authkit-nextjs|node)"' package.json || echo "FAIL: SDK not found"
```

If not installed, install appropriate SDK for your framework (see gold standard workos-authkit-nextjs skill for SDK setup).

## Step 3: Password Export Decision Tree

```
Do you need to migrate passwords?
  |
  +-- YES --> Contact Descope support for CSV export (BLOCKING)
  |           |
  |           +-- Note the hashing algorithm they provide
  |           |   (bcrypt, argon2, pbkdf2)
  |           |
  |           +-- Proceed to Step 4
  |
  +-- NO --> Skip to Step 4 (users will reset passwords or use social auth)
```

**Critical:** Descope does NOT expose password hashes via API. You MUST contact Descope support directly for password exports. This can take several business days - plan accordingly.

## Step 4: Export Users from Descope

Use Descope Management API to export user data:

```bash
# Example: Fetch all users (adjust per Descope SDK/API docs)
curl https://api.descope.com/v1/mgmt/user/search \
  -H "Authorization: Bearer PROJECT_ID:MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'
```

**Required fields from export:**
- `email`
- `givenName` (optional)
- `familyName` (optional)
- `verifiedEmail` (boolean)
- `loginIDs` (if using social auth)
- Password hash (if obtained from support)

Save output to `descope_users.json` for next steps.

## Step 5: Import Users into WorkOS

### Rate Limit Strategy (CRITICAL)

WorkOS Create User API is rate-limited. Check current limits:

WebFetch: `https://workos.com/docs/reference/rate-limits`

**For large migrations (>1000 users):**
1. Implement batching (50-100 users per batch)
2. Add 1-2 second delays between batches
3. Implement retry logic with exponential backoff

### User Import Script Pattern

```typescript
// Map Descope fields to WorkOS API
function mapDescopeUser(descopeUser) {
  return {
    email: descopeUser.email,
    first_name: descopeUser.givenName,
    last_name: descopeUser.familyName,
    email_verified: descopeUser.verifiedEmail || false
  };
}

// Import single user
async function importUser(userData, passwordData?) {
  const payload = {
    ...mapDescopeUser(userData)
  };
  
  // Add password if available
  if (passwordData) {
    payload.password_hash = passwordData.hash;
    payload.password_hash_type = passwordData.algorithm; // 'bcrypt' | 'argon2' | 'pbkdf2'
  }
  
  const response = await workos.users.create(payload);
  return response.id; // Store WorkOS user ID for Step 6
}
```

**Field mapping:**
```
Descope          --> WorkOS API
email            --> email
givenName        --> first_name
familyName       --> last_name
verifiedEmail    --> email_verified
password hash    --> password_hash
hash algorithm   --> password_hash_type
```

**Verification for this step:**

```bash
# Check import logs for errors
grep "ERROR" migration.log | wc -l  # Should be 0

# Verify user count matches
echo "Descope users: $(jq length descope_users.json)"
echo "WorkOS users: $(curl -H 'Authorization: Bearer $WORKOS_API_KEY' \
  https://api.workos.com/users | jq '.data | length')"
```

## Step 6: Export and Create Organizations

### Export Descope Tenants

```bash
# Fetch tenants from Descope
curl https://api.descope.com/v1/mgmt/tenant/search \
  -H "Authorization: Bearer PROJECT_ID:MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}' > descope_tenants.json
```

### Create WorkOS Organizations

```typescript
async function createOrganization(descopeTenant) {
  return await workos.organizations.create({
    name: descopeTenant.name,
    external_id: descopeTenant.id  // CRITICAL: Store Descope ID for reference
  });
}
```

**Field mapping:**
```
Descope Tenant   --> WorkOS Organization
name             --> name
id               --> external_id
```

**Store mapping:** Create `org_id_map.json` with structure:
```json
{
  "descope_tenant_id": "org_workos_id",
  ...
}
```

You'll need this map for Step 7.

## Step 7: Migrate Organization Memberships

### Decision Tree: RBAC Migration

```
Does your app use Descope roles?
  |
  +-- YES --> Create equivalent roles in WorkOS Dashboard first
  |           |
  |           +-- Dashboard URL: https://dashboard.workos.com/environment/roles-and-permissions
  |           |
  |           +-- Map Descope roles to WorkOS role slugs
  |           |
  |           +-- Proceed with membership creation
  |
  +-- NO --> Create basic memberships without roles
```

### Membership Import Script Pattern

```typescript
async function createMembership(descopeUserTenant, orgIdMap, userIdMap) {
  const workosOrgId = orgIdMap[descopeUserTenant.tenantId];
  const workosUserId = userIdMap[descopeUserTenant.userId];
  
  const payload = {
    organization_id: workosOrgId,
    user_id: workosUserId
  };
  
  // Add role if using RBAC
  if (descopeUserTenant.roleNames?.length > 0) {
    payload.role_slug = mapDescopeRole(descopeUserTenant.roleNames[0]);
  }
  
  await workos.organizationMemberships.create(payload);
}
```

**Verification for this step:**

```bash
# Check membership count
echo "Expected memberships: $(jq '[.[] | .userTenants | length] | add' descope_users.json)"
echo "Actual memberships: $(curl -H 'Authorization: Bearer $WORKOS_API_KEY' \
  https://api.workos.com/organization_memberships | jq '.data | length')"
```

## Step 8: Social Auth Provider Configuration (If Applicable)

```
Do users sign in with social providers (Google, Microsoft, etc.)?
  |
  +-- YES --> Configure OAuth providers in WorkOS Dashboard
  |           |
  |           +-- Dashboard URL: https://dashboard.workos.com/environment/auth-methods
  |           |
  |           +-- For each provider:
  |               - Add OAuth client credentials
  |               - Enable provider in environment settings
  |               - Test with a sample user
  |           |
  |           +-- Users will auto-link on first sign-in (email match)
  |
  +-- NO --> Skip to Step 9
```

**Email verification note:** Users from Google/Microsoft with verified emails (e.g., @gmail.com) will NOT need to re-verify. Other providers may require verification based on WorkOS environment settings.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. User count matches
DESCOPE_COUNT=$(jq 'length' descope_users.json)
WORKOS_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.data | length')
[ "$DESCOPE_COUNT" -eq "$WORKOS_COUNT" ] && echo "✓ User count matches" || echo "✗ FAIL: User count mismatch"

# 2. Organization count matches
DESCOPE_ORG_COUNT=$(jq 'length' descope_tenants.json)
WORKOS_ORG_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length')
[ "$DESCOPE_ORG_COUNT" -eq "$WORKOS_ORG_COUNT" ] && echo "✓ Org count matches" || echo "✗ FAIL: Org count mismatch"

# 3. Test authentication with sample user
# (Manual: Attempt sign-in with a migrated user via WorkOS AuthKit UI)

# 4. Verify social auth provider is configured (if applicable)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/authentication_factors | \
  jq '.data[] | select(.type == "oauth")' || echo "No OAuth providers configured"

# 5. Check for any users with missing memberships
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/users?limit=100" | \
  jq '.data[] | select(.organization_memberships | length == 0) | .email'
# Should return empty if all users have org memberships
```

**Do not mark migration complete until all checks pass.**

## Error Recovery

### "Rate limit exceeded" during import

**Root cause:** Exceeding WorkOS API rate limits (see docs for current limits).

**Fix:**
1. Reduce batch size (try 50 users per batch instead of 100)
2. Increase delay between batches to 2-3 seconds
3. Implement exponential backoff retry logic

### "User already exists" error

**Root cause:** Duplicate email or previous partial migration.

**Fix:**
1. Use Update User API instead of Create User for existing users
2. Query existing users first: `GET /users?email={email}`
3. Store mapping of processed users to avoid duplicates

### "Invalid password_hash_type"

**Root cause:** Password hash algorithm from Descope not supported by WorkOS.

**Fix:**
1. Verify algorithm is one of: `bcrypt`, `argon2`, `pbkdf2`
2. Contact Descope support to confirm hash format
3. If unsupported algorithm, skip password import and force password reset

### "Organization not found" during membership creation

**Root cause:** Organization not created yet or ID mapping error.

**Fix:**
1. Verify Step 6 completed successfully
2. Check `org_id_map.json` contains the Descope tenant ID
3. Re-run organization creation for missing orgs

### Social auth users cannot sign in after migration

**Root cause:** OAuth provider not configured or email mismatch.

**Fix:**
1. Verify provider credentials in WorkOS Dashboard
2. Check user's email in Descope matches provider email
3. Enable provider in environment auth settings
4. Test provider sign-in flow with a sample user

### "Password hash does not match expected format"

**Root cause:** Hash string format issue from Descope export.

**Fix:**
1. Verify hash includes required components (salt, iterations, etc.)
2. Check for encoding issues (base64 vs hex)
3. Contact Descope support for correct hash format specification
4. Reference WorkOS docs for exact hash format per algorithm

## Related Skills

- `workos-authkit-nextjs` - Setting up WorkOS AuthKit in Next.js (required for post-migration auth)
- `workos-directory-sync` - Syncing users from identity providers (alternative to manual migration for ongoing sync)
