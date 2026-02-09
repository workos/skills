---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:3056c8ae6df4 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The WorkOS docs are the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required WorkOS credentials:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both variables are set and non-empty before continuing.

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package.json for WorkOS SDK dependency
grep -E "@workos-inc/(node|authkit)" package.json || echo "FAIL: WorkOS SDK not installed"
```

If SDK is missing, install appropriate package for your framework (see related skills for framework-specific setup).

## Step 3: Export Users from Descope (Decision Tree)

```
User authentication type?
  |
  +-- Passwords --> Contact Descope support for password hash export (REQUIRED)
  |                 Note the hash algorithm (bcrypt/argon2/pbkdf2)
  |
  +-- Social auth only --> Use Descope Management API to export user data
  |
  +-- Both --> Get both password hashes AND social auth user data
```

### Password Export (Manual Process)

Descope does NOT expose password hashes via API. You MUST contact Descope support:

1. Open support ticket requesting user export with password hashes
2. Descope will generate a CSV file
3. **Record the hashing algorithm used** (bcrypt, argon2, or pbkdf2)
4. Arrange secure data transfer with Descope team

**BLOCKING:** Wait for Descope to provide the export before proceeding to import.

### Social Auth User Export (API)

Use Descope Management API to fetch user data:

WebFetch the current API docs: `https://docs.descope.com/management/user-management/sdks`

## Step 4: Import Users into WorkOS

### Field Mapping Reference

Map Descope user fields to WorkOS Create User API parameters:

| Descope Field    | WorkOS Parameter |
| ---------------- | ---------------- |
| `email`          | `email`          |
| `givenName`      | `first_name`     |
| `familyName`     | `last_name`      |
| `verifiedEmail`  | `email_verified` |

### Import Script Pattern (Password Users)

```typescript
// For each user from Descope export
async function importUser(descopeUser, passwordData) {
  const userData = {
    email: descopeUser.email,
    first_name: descopeUser.givenName,
    last_name: descopeUser.familyName,
    email_verified: descopeUser.verifiedEmail,
  };

  // If password hash available from Descope support
  if (passwordData) {
    userData.password_hash = passwordData.hash;
    userData.password_hash_type = passwordData.algorithm; // 'bcrypt', 'argon2', or 'pbkdf2'
  }

  // Call WorkOS Create User API
  // WebFetch https://workos.com/docs/reference/authkit/user/create for current method signature
}
```

**Critical:** WorkOS Create User API is rate-limited. Check current limits: `https://workos.com/docs/reference/rate-limits`

For large migrations, implement batching with delays between requests.

### Import Script Pattern (Social Auth Users)

Social auth users do NOT need password import. Create users with basic profile data only:

```typescript
async function importSocialAuthUser(descopeUser) {
  const userData = {
    email: descopeUser.email,
    first_name: descopeUser.givenName,
    last_name: descopeUser.familyName,
    email_verified: descopeUser.verifiedEmail,
  };

  // No password_hash or password_hash_type needed
  // WorkOS will auto-link when user signs in via social provider
}
```

**Auto-linking:** When social auth users sign in post-migration, WorkOS matches by email address and links the account automatically.

## Step 5: Configure Social Auth Providers (If Applicable)

If migrating social auth users, configure providers in WorkOS Dashboard BEFORE users attempt sign-in:

- Google OAuth: `https://workos.com/docs/integrations/google-oauth`
- Microsoft OAuth: `https://workos.com/docs/integrations/microsoft-oauth`

**Verification:** Test sign-in with each configured provider before announcing migration to users.

### Email Verification Behavior

- Providers with verified domains (e.g., `@gmail.com` via Google) skip additional verification
- Other providers may trigger email verification flow if enabled in environment settings
- Check Dashboard → Authentication Settings for current verification requirements

## Step 6: Export and Import Organizations (Decision Tree)

```
Using Descope Tenants?
  |
  +-- YES --> Export tenants via Descope Management API
  |           Create matching WorkOS Organizations
  |
  +-- NO  --> Skip this step
```

### Field Mapping Reference

Map Descope Tenant fields to WorkOS Organization API:

| Descope Field | WorkOS Parameter |
| ------------- | ---------------- |
| `name`        | `name`           |
| `id`          | `external_id`    |

Storing Descope tenant ID as `external_id` maintains cross-reference during migration.

### Import Script Pattern

```typescript
async function importOrganization(descopeTenant) {
  const orgData = {
    name: descopeTenant.name,
    external_id: descopeTenant.id, // Preserves Descope tenant ID
  };

  // Call WorkOS Create Organization API
  // WebFetch https://workos.com/docs/reference/organization/create for current method signature
  
  // Store returned org.id for membership creation in Step 7
  return workosOrgId;
}
```

## Step 7: Create Organization Memberships

Once organizations exist, assign users to organizations using the Organization Membership API.

### Data Source

Descope's Search Users API returns tenant associations. Use this data to determine which users belong to which organizations.

### Import Script Pattern

```typescript
async function createMembership(workosUserId, workosOrgId, roleSlug?) {
  const membershipData = {
    user_id: workosUserId,
    organization_id: workosOrgId,
  };

  // Optional: Assign role if migrating RBAC
  if (roleSlug) {
    membershipData.role_slug = roleSlug;
  }

  // Call WorkOS Create Organization Membership API
  // WebFetch https://workos.com/docs/reference/authkit/organization-membership/create for current method signature
}
```

### RBAC Migration (Optional)

If using Descope roles:

1. Identify Descope role definitions
2. Create equivalent roles in WorkOS Dashboard: `https://dashboard.workos.com/environment/roles-and-permissions`
3. Pass `role_slug` parameter when creating memberships

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm successful migration:

```bash
# 1. Verify WorkOS API credentials are set
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key valid" || echo "FAIL: API key invalid"

# 2. Test Create User API connectivity
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | grep -q "id" && echo "PASS: API accessible" || echo "FAIL: API call failed"

# 3. Verify social auth providers configured (if applicable)
# Check WorkOS Dashboard → Integrations for active OAuth providers

# 4. Test user sign-in post-migration
# Attempt sign-in with migrated user credentials
```

**Critical:** Test sign-in with sample users from each category (password, social auth, different organizations) before announcing migration.

## Error Recovery

### "Rate limit exceeded" during import

**Cause:** Exceeding WorkOS API rate limits during bulk user import.

**Fix:**
1. Check current rate limits: `https://workos.com/docs/reference/rate-limits`
2. Add delays between API calls (e.g., 100ms per request)
3. Implement exponential backoff for 429 responses
4. Consider splitting import into smaller batches

### "Invalid password hash type"

**Cause:** Using unsupported hashing algorithm or incorrect `password_hash_type` value.

**Fix:**
1. Verify Descope provided hash algorithm is bcrypt, argon2, or pbkdf2
2. Confirm `password_hash_type` parameter exactly matches: `'bcrypt'`, `'argon2'`, or `'pbkdf2'`
3. If Descope used a different algorithm, contact WorkOS support

### Social auth users not auto-linking

**Cause:** Email mismatch or provider not configured in WorkOS.

**Fix:**
1. Verify email addresses match exactly between Descope export and WorkOS import
2. Check provider is configured in WorkOS Dashboard → Integrations
3. Confirm provider client credentials are correct
4. Test sign-in flow manually to isolate issue

### Organization memberships not created

**Cause:** Invalid user_id or organization_id references.

**Fix:**
1. Verify WorkOS user and organization were created successfully
2. Check IDs are stored correctly from creation responses
3. Use WorkOS Dashboard to manually verify user and org exist
4. Retry membership creation with correct IDs

### "User already exists" errors

**Cause:** Attempting to re-import users that already exist in WorkOS.

**Fix:**
1. Query existing WorkOS users before import: WebFetch `https://workos.com/docs/reference/authkit/user/list` for List Users API
2. Skip users that already exist, or use Update User API instead
3. Implement idempotency checks in import script

## Related Skills

- `workos-authkit-nextjs` - Post-migration AuthKit integration for Next.js
- `workos-authkit-react` - Post-migration AuthKit integration for React
- `workos-sso` - If migrating to SSO instead of password auth
- `workos-rbac` - Advanced RBAC configuration post-migration
- `workos-api-organization` - Organization management APIs
- `workos-api-authkit` - User management APIs
