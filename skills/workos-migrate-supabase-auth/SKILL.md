---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

This is the source of truth for migration procedures and field mappings. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Validation

### WorkOS Environment

Check these exist before starting:

- `WORKOS_API_KEY` in environment (starts with `sk_`)
- `WORKOS_CLIENT_ID` in environment (starts with `client_`)
- WorkOS SDK installed (`@workos-inc/node` in package.json or equivalent for your stack)

### Supabase Access

Confirm you have:

- Access to Supabase SQL Editor OR
- Database client connected to Supabase project
- Permissions to query `auth.users` table

**Verify:** Run `SELECT count(*) FROM auth.users;` successfully before proceeding.

## Step 3: Export Users from Supabase

### Required Fields to Export

Query the `auth.users` table to extract:

- `id` - user identifier
- `email` - user email address
- `encrypted_password` - bcrypt password hash
- `email_confirmed_at` - email verification timestamp
- `phone` - phone number (if used)
- `raw_app_meta_data` - custom metadata (may contain tenant/org mapping)
- `raw_user_meta_data` - user profile data
- `created_at` - account creation timestamp

**Critical:** Supabase stores passwords as bcrypt hashes in `encrypted_password`. This column is directly accessible — no support ticket needed.

### Export Method (Decision Tree)

```
Data volume?
  |
  +-- < 10,000 users --> Use Supabase SQL Editor
  |                      Copy results to CSV/JSON
  |
  +-- 10,000+ users ----> Use database client (psql, DBeaver, etc.)
                          Export to file with connection string from Supabase settings
```

**Sample SQL:**

```sql
SELECT
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE deleted_at IS NULL;
```

Save results as JSON or CSV for import script.

## Step 4: Analyze Multi-Tenancy Patterns (Optional)

**If your app uses multi-tenancy:** Identify how tenant information is stored.

Common Supabase patterns:

```
Tenant storage location?
  |
  +-- raw_app_meta_data --> Extract tenant_id/org_id from JSON field
  |
  +-- Separate table ----> Join query to map user IDs to tenant IDs
  |
  +-- RLS policies -------> Review policies to understand tenant boundaries
```

**Output:** Mapping of `user_id -> tenant_id(s)` for Organization creation in WorkOS.

## Step 5: Create WorkOS Organizations (If Using Multi-Tenancy)

**Skip this step if your app is single-tenant.**

For each unique tenant/organization:

1. Call [Create Organization API](https://workos.com/docs/reference/organization/create)
2. Store mapping of `supabase_tenant_id -> workos_org_id`

**Sample code pattern:**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// For each unique tenant from Step 4
const organization = await workos.organizations.createOrganization({
  name: tenantName,
  // Store Supabase tenant ID as reference
  domainData: [{ domain: tenantDomain }] // if applicable
});

// Map: supabase_tenant_id -> organization.id
```

**Verify:** Check WorkOS Dashboard shows created organizations before importing users.

## Step 6: Import Users into WorkOS

### Rate Limiting Strategy (CRITICAL)

WorkOS API has rate limits. For large migrations:

```
User count?
  |
  +-- < 1,000 users -----> Sequential import with 100ms delay between requests
  |
  +-- 1,000 - 10,000 ----> Batch of 10 concurrent requests, 1s delay between batches
  |
  +-- 10,000+ -----------> Contact WorkOS support for rate limit increase FIRST
```

Check current rate limits: https://workos.com/docs/reference/rate-limits

### Field Mapping

Use this mapping for [Create User API](https://workos.com/docs/reference/authkit/user/create):

| Supabase Field          | WorkOS API Parameter  | Notes                                      |
| ----------------------- | --------------------- | ------------------------------------------ |
| `email`                 | `email`               | Required                                   |
| `email_confirmed_at`    | `emailVerified`       | Boolean: true if timestamp exists          |
| `encrypted_password`    | `password_hash`       | Bcrypt hash — see password import section  |
| N/A                     | `password_hash_type`  | Set to `'bcrypt'`                          |
| `raw_user_meta_data`    | Custom mapping        | Extract first_name, last_name if present   |

### Password Import (CRITICAL)

**Supabase uses bcrypt — WorkOS supports this directly.**

Include in user creation request:

```typescript
{
  email: user.email,
  emailVerified: !!user.email_confirmed_at,
  password_hash: user.encrypted_password,  // Direct copy from Supabase
  password_hash_type: 'bcrypt'
}
```

**No password reset required** if hash imports correctly. Users can sign in with existing passwords immediately.

### Organization Membership (If Multi-Tenant)

If you created organizations in Step 5, link users to their orgs:

```typescript
// After creating user, if user belongs to organization
await workos.userManagement.createOrganizationMembership({
  userId: workosUser.id,
  organizationId: orgMapping[supabaseTenantId],
  roleSlug: 'member' // or map from Supabase roles if using RBAC
});
```

**Verify per batch:** Query WorkOS API to confirm users created before proceeding to next batch.

## Step 7: Configure Social Auth Providers (If Used)

**Skip if you only used email/password auth.**

### Decision Tree

```
Supabase social providers used?
  |
  +-- None -----------------> Skip this step
  |
  +-- Google ---------------> Configure Google OAuth in WorkOS Dashboard
  |
  +-- Microsoft ------------> Configure Microsoft OAuth in WorkOS Dashboard
  |
  +-- GitHub ---------------> Configure GitHub OAuth in WorkOS Dashboard
  |
  +-- Multiple -------------> Configure each provider separately
```

**Provider configuration:** See https://workos.com/docs/integrations for provider-specific setup.

### Automatic Linking

WorkOS automatically links social auth users by **email address**:

- User signs in with Google
- WorkOS finds existing user with matching email
- Accounts are linked — no manual intervention needed

**Important:** Email verification behavior depends on provider. Gmail users skip extra verification. Others may need to verify email.

## Step 8: Handle MFA Users

### TOTP-Based MFA

**Supabase TOTP users:** TOTP secrets CANNOT be exported from Supabase.

**Required action:** Users must re-enroll in MFA after migration.

**Implementation:**

1. Identify users with TOTP enrolled (check Supabase `auth.mfa_factors` table)
2. Notify these users they must re-enroll MFA
3. Follow WorkOS MFA enrollment flow: https://workos.com/docs/authkit/mfa

### SMS-Based MFA (NOT SUPPORTED)

**Critical:** WorkOS does NOT support SMS-based MFA due to security vulnerabilities (SIM swap attacks).

**Migration path for SMS users:**

```
SMS MFA users?
  |
  +-- Require TOTP ---------> Force enrollment in TOTP-based MFA
  |
  +-- Use Magic Auth -------> Configure email-based Magic Auth as alternative
  |
  +-- Downgrade to password -> Remove MFA requirement temporarily
```

**Verify:** Test TOTP enrollment flow works before notifying users.

## Step 9: Update Application Code

### Authentication Flow Changes

Replace Supabase Auth SDK calls with WorkOS:

```
Supabase pattern                    -->  WorkOS equivalent
supabase.auth.signInWithPassword()  -->  WorkOS AuthKit sign-in flow
supabase.auth.signUp()              -->  WorkOS user creation
supabase.auth.signOut()             -->  WorkOS signOut()
supabase.auth.getSession()          -->  WorkOS getUser() / withAuth()
```

### Multi-Tenancy Code Changes (If Applicable)

```
Supabase RLS pattern                       -->  WorkOS pattern
SELECT * WHERE tenant_id = current_user()  -->  Query by organization_id from session
Auth policies on tenant_id                 -->  Authorization via organization membership
```

**Critical:** If you used `app_metadata` for tenant storage, extract organization ID from WorkOS session instead.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify user count matches
# Supabase: SELECT count(*) FROM auth.users WHERE deleted_at IS NULL;
# WorkOS: Query via API and compare counts

# 2. Test password authentication
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"existing_password"}'

# 3. Test social auth (if configured)
# Sign in via provider and verify account linking

# 4. Verify organization memberships (if multi-tenant)
# Check user belongs to correct organization via Dashboard or API

# 5. Application builds and auth flows work
npm run build && npm run dev
```

**If any check fails:** DO NOT proceed with production migration. Debug the failing check first.

## Error Recovery

### "invalid_password_hash" during import

**Root cause:** Password hash format mismatch or wrong algorithm specified.

**Fix:**

1. Verify `encrypted_password` from Supabase starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
2. Confirm `password_hash_type` is exactly `'bcrypt'` (not `'bcrypt_sha256'` or other variants)
3. Check hash is not truncated in export (bcrypt hashes are 60 characters)

### "rate_limit_exceeded" during import

**Root cause:** Importing too fast or exceeding account limits.

**Fix:**

1. Check current limits: https://workos.com/docs/reference/rate-limits
2. Add delays between API calls (see Step 6 rate limiting strategy)
3. For large migrations, contact WorkOS support BEFORE starting import

### "email_already_exists" during import

**Root cause:** Duplicate email in import data OR user already exists from previous partial import.

**Fix:**

1. Check WorkOS Dashboard for existing user with that email
2. If duplicate in Supabase data, deduplicate before import
3. If from partial import, use Update User API instead of Create User API

### Social auth user not automatically linked

**Root cause:** Email addresses don't match exactly OR email not verified.

**Fix:**

1. Check provider returns verified email claim
2. Verify WorkOS user email matches provider email exactly (case-sensitive)
3. Check WorkOS environment email verification settings

### Users can't sign in after migration

**Root cause #1:** Password hash imported incorrectly.

**Fix:** Re-import with correct bcrypt hash from `encrypted_password` column.

**Root cause #2:** Email verification required but not set.

**Fix:** Set `emailVerified: true` during import if `email_confirmed_at` exists in Supabase.

### Application can't find user's organization

**Root cause:** Organization membership not created OR wrong organization ID used.

**Fix:**

1. Verify organization exists in WorkOS Dashboard
2. Check Organization Membership API was called with correct `userId` and `organizationId`
3. Query memberships via API to confirm: `GET /user_management/organization_memberships?user_id=<userId>`

## Related Skills

- `workos-authkit-nextjs` - For integrating WorkOS AuthKit in Next.js applications post-migration
- `workos-organizations` - For advanced organization management and RBAC setup after migration
