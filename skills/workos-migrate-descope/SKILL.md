---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- generated -->

# WorkOS Migration: Descope to WorkOS

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard configuration:

- Environment created (Production or Sandbox)
- API keys generated and stored securely
- Authentication settings configured (email verification, password policies, etc.)

### Environment Variables

Verify these exist in your environment:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Detect package manager and verify WorkOS SDK is installed:

```bash
# Check if SDK exists
ls node_modules/@workos-inc 2>/dev/null || echo "SDK not installed"
```

If missing, install before proceeding.

## Step 3: Export Data from Descope

### Decision Tree: Password Export

```
Do users sign in with passwords?
  |
  +-- YES --> Contact Descope support for password export
  |           (Backend APIs don't expose password hashes)
  |           
  |           Support will provide CSV with:
  |           - User data
  |           - Password hashes
  |           - Hash algorithm used (bcrypt, argon2, or pbkdf2)
  |           
  |           Record the hashing algorithm - you'll need it for import.
  |
  +-- NO  --> Skip password export, proceed to user export
```

### Export Users via Descope API

Use [Descope Management API](https://docs.descope.com/management/user-management/sdks) to retrieve user data:

```bash
# Example verification: Check you can call Descope API
curl -X POST https://api.descope.com/v1/mgmt/user/search \
  -H "Authorization: Bearer YOUR_DESCOPE_PROJECT_ID:YOUR_DESCOPE_MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

Required fields from Descope export:
- `email`
- `givenName`
- `familyName`
- `verifiedEmail`
- `tenantIds` (for organization memberships)
- Password hash (if exported via support)

### Export Tenants (Organizations)

Use [Descope Tenant Management API](https://docs.descope.com/management/tenant-management/sdks) to retrieve tenants:

Required fields:
- `id` (store as `external_id` in WorkOS)
- `name`

## Step 4: Import Organizations into WorkOS

**IMPORTANT:** Import organizations BEFORE users so you can create memberships during user import.

### Create Organizations

Field mapping:

```
Descope Tenant → WorkOS Organization
─────────────────────────────────────
name           → name
id             → external_id
```

Use Create Organization API: `POST /organizations`

**Store mapping:** Create a map of `descope_tenant_id → workos_org_id` for Step 5.

### Verification

```bash
# Check organizations created
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```

## Step 5: Import Users into WorkOS

### Field Mapping

```
Descope         → WorkOS API Parameter
──────────────────────────────────────
email           → email
givenName       → first_name
familyName      → last_name
verifiedEmail   → email_verified
```

### Rate Limiting Strategy

WorkOS APIs are rate-limited. For large migrations:

1. Check [rate limits documentation](/reference/rate-limits) for current limits
2. Implement batching (e.g., 100 users per batch)
3. Add delays between batches (e.g., 1 second)

**Example batch processing:**

```typescript
async function importUsers(descopeUsers, batchSize = 100) {
  for (let i = 0; i < descopeUsers.length; i += batchSize) {
    const batch = descopeUsers.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(user => createWorkOSUser(user))
    );
    
    // Rate limit protection
    if (i + batchSize < descopeUsers.length) {
      await sleep(1000);
    }
  }
}
```

Use Create User API: `POST /user_management/users`

**Store mapping:** Create a map of `descope_user_email → workos_user_id` for memberships.

### Password Import (Conditional)

Only if you obtained password export from Descope support:

```
Decision: Which hash algorithm did Descope use?
  |
  +-- bcrypt  --> Set password_hash_type: 'bcrypt'
  |
  +-- argon2  --> Set password_hash_type: 'argon2'
  |
  +-- pbkdf2  --> Set password_hash_type: 'pbkdf2'
```

Include in Create User API call:
- `password_hash_type` - algorithm name
- `password_hash` - hash value from export

**Alternative:** Import passwords later via Update User API: `PUT /user_management/users/{user_id}`

## Step 6: Configure Social Auth Providers

### Decision Tree: Social Auth Migration

```
Do users sign in via social providers?
  |
  +-- YES --> Which providers?
  |           |
  |           +-- Google --> Configure Google OAuth in WorkOS Dashboard
  |           +-- Microsoft --> Configure Microsoft OAuth in WorkOS Dashboard
  |           +-- Other --> Check /integrations for provider setup
  |
  +-- NO  --> Skip this step
```

See [integrations documentation](/integrations) for provider-specific setup.

**Automatic linking:** After provider configured, users signing in with social auth are automatically matched to WorkOS users by **email address**.

**Email verification note:** Users may need to verify email if:
- Email verification is enabled in your environment settings
- Provider is not known to verify emails (e.g., non-Gmail Google accounts)

## Step 7: Create Organization Memberships

### Prerequisites

- Organizations imported (Step 4)
- Users imported (Step 5)
- Mapping of Descope tenant IDs to WorkOS org IDs
- Mapping of Descope user emails to WorkOS user IDs

### Create Memberships

Use Create Organization Membership API: `POST /user_management/organization_memberships`

Required parameters:
- `user_id` - WorkOS user ID
- `organization_id` - WorkOS organization ID

**Optional:** Assign roles if using RBAC:
- Create roles in [WorkOS Dashboard](https://dashboard.workos.com/environment/roles-and-permissions) first
- Pass `roleSlug` parameter during membership creation

**Example:**

```typescript
async function migrateMemberships(
  descopeUserTenants,  // User-to-tenant associations from Descope
  orgIdMap,             // descope_tenant_id → workos_org_id
  userIdMap             // descope_user_email → workos_user_id
) {
  for (const [userEmail, tenantIds] of Object.entries(descopeUserTenants)) {
    const workosUserId = userIdMap[userEmail];
    
    for (const tenantId of tenantIds) {
      const workosOrgId = orgIdMap[tenantId];
      
      await workos.userManagement.createOrganizationMembership({
        userId: workosUserId,
        organizationId: workosOrgId,
        // roleSlug: 'member' // Optional: assign role
      });
    }
  }
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Verify organizations imported
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Expected: Count matches Descope tenant count

# 2. Verify users imported
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Expected: Count matches Descope user count

# 3. Verify organization memberships created
curl https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Expected: Count matches total user-tenant associations

# 4. Test user login (if using AuthKit)
# Attempt login with a migrated user's credentials
# Expected: Successful authentication

# 5. Check password import (if applicable)
# Test login with original password
# Expected: Password authentication succeeds
```

## Error Recovery

### "invalid_credentials" during password login after migration

**Root cause:** Password hash format mismatch or incorrect `password_hash_type`.

**Fix:**
1. Verify the hash algorithm Descope support specified
2. Confirm `password_hash_type` matches exactly: `bcrypt`, `argon2`, or `pbkdf2`
3. Check password hash is the raw hash value, not base64 encoded (unless Descope specified base64)
4. Re-import affected users with correct hash type using Update User API

### Rate limit errors (429) during bulk import

**Root cause:** Exceeding WorkOS API rate limits.

**Fix:**
1. Check current rate limits: WebFetch `/reference/rate-limits`
2. Reduce batch size (e.g., from 100 to 50 users)
3. Increase delay between batches (e.g., from 1s to 2s)
4. Implement exponential backoff for retries

### Users not auto-linking with social auth

**Root cause:** Email mismatch or provider not configured.

**Fix:**
1. Verify social provider is configured in WorkOS Dashboard
2. Check email from social provider matches email in WorkOS user record exactly
3. Confirm `email_verified` is `true` for the WorkOS user
4. Check WorkOS environment authentication settings allow social auth

### "organization_not_found" when creating memberships

**Root cause:** Organization not imported or incorrect ID mapping.

**Fix:**
1. Verify organization exists: `GET /organizations/{organization_id}`
2. Check your `orgIdMap` has correct mapping from Descope tenant ID to WorkOS org ID
3. Re-import missing organizations from Step 4

### API key permission errors

**Root cause:** API key doesn't have required scopes.

**Fix:**
1. Check API key starts with `sk_` (secret key, not client ID)
2. Generate new API key in WorkOS Dashboard with full permissions
3. Verify key is for correct environment (Production vs Sandbox)

### Duplicate user errors during import

**Root cause:** User already exists with same email.

**Fix:**
1. Check if user was partially imported in previous run
2. Use Update User API instead of Create User API for existing users
3. Implement idempotency: Check if user exists before creating

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit after migration
- `workos-directory-sync` - Set up directory sync for ongoing user provisioning
- `workos-admin-portal` - Enable self-service organization management
