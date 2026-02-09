---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Inventory Your Supabase Auth Data

Check the Supabase project for:

- Total user count in `auth.users` table
- Users with social auth connections (check `auth.identities` table)
- Users with MFA enrolled (check `auth.mfa_factors` table)
- Multi-tenancy implementation (RLS policies, `app_metadata.tenant_id`, etc.)

**Decision Point:**

```
User count?
  |
  +-- < 10,000 --> Single-batch import (Step 3)
  |
  +-- 10,000+ --> Batched import with rate limit handling (Step 3)
```

### Environment Variables

Check `.env` or environment configuration for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

## Step 3: Export Users from Supabase

### Export User Data via SQL

Run this SQL query in [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview#the-sql-editor):

```sql
SELECT
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at
FROM auth.users;
```

Save the result as JSON or CSV.

**Verify:** File contains `encrypted_password` column with bcrypt hashes (start with `$2a$`, `$2b$`, or `$2y$`).

### Export Social Auth Connections (if applicable)

If you have social auth users, run:

```sql
SELECT
  user_id,
  provider,
  provider_id,
  identity_data
FROM auth.identities;
```

**Note:** Social auth users will automatically link after migration if the email matches. No manual import of OAuth tokens is needed.

### Export MFA Enrollments (if applicable)

If you have MFA-enrolled users, run:

```sql
SELECT
  user_id,
  factor_type
FROM auth.mfa_factors
WHERE status = 'verified';
```

**Critical:** TOTP secrets CANNOT be exported from Supabase. Users with TOTP MFA will need to re-enroll after migration.

## Step 4: Handle Multi-Tenancy (Decision Tree)

```
Does your app use multi-tenancy?
  |
  +-- NO --> Skip to Step 5
  |
  +-- YES, using app_metadata.tenant_id
      |
      +-- Create Organizations in WorkOS (Step 4a)
```

### Step 4a: Create Organizations in WorkOS

For each unique tenant in your Supabase data:

```bash
# Example with curl
curl https://api.workos.com/organizations \
  -u "$WORKOS_API_KEY:" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tenant Name",
    "domains": ["tenant.com"]
  }'
```

**Save the returned `organization.id` for each tenant** — you'll need this in Step 5.

**Verify:** List organizations returns all created orgs:

```bash
curl https://api.workos.com/organizations -u "$WORKOS_API_KEY:"
```

## Step 5: Import Users into WorkOS

### Field Mapping

| Supabase Column | WorkOS API Parameter |
|-----------------|----------------------|
| `email` | `email` |
| `email_confirmed_at` | `email_verified` (true if not null) |
| `encrypted_password` | `password_hash` |
| N/A | `password_hash_type` = `'bcrypt'` |
| `raw_user_meta_data.first_name` | `first_name` |
| `raw_user_meta_data.last_name` | `last_name` |

### Import Script Pattern

Create a script that:

1. Reads the exported JSON/CSV
2. Calls WorkOS Create User API for each user
3. Handles rate limits (default: 600 requests/minute)

**Example pattern (not a complete script):**

```javascript
// This is a PATTERN, not a working script
// Check the WebFetched docs for exact API signature

for (const user of supabaseUsers) {
  const payload = {
    email: user.email,
    email_verified: user.email_confirmed_at !== null,
    password_hash: user.encrypted_password,
    password_hash_type: 'bcrypt',
    first_name: user.raw_user_meta_data?.first_name,
    last_name: user.raw_user_meta_data?.last_name
  };
  
  // Call WorkOS Create User API
  // Add rate limit handling for large batches
}
```

**Critical:** If importing >10,000 users, implement batching with delays. See [WorkOS rate limits docs](https://workos.com/docs/reference/rate-limits) for current limits.

**Verify import:**

```bash
# Check user count matches
curl "https://api.workos.com/user_management/users?limit=1" -u "$WORKOS_API_KEY:" | jq '.metadata.total_count'
```

Compare to your Supabase user count. They should match.

## Step 6: Create Organization Memberships (if applicable)

**Only if you completed Step 4.**

For each user with a `tenant_id` in `app_metadata`:

```bash
curl https://api.workos.com/user_management/organization_memberships \
  -u "$WORKOS_API_KEY:" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H...",
    "organization_id": "org_01H..."
  }'
```

**Verify memberships:**

```bash
# Check a sample user has correct organization
curl "https://api.workos.com/user_management/organization_memberships?user_id=user_01H..." \
  -u "$WORKOS_API_KEY:"
```

## Step 7: Configure Social Auth Providers (if applicable)

**Only if you have users from Step 3 who use social auth.**

For each provider in your `auth.identities` export:

1. Go to WorkOS Dashboard → Integrations
2. Enable the provider (Google, Microsoft, etc.)
3. Add OAuth client credentials from the provider

**Verify:** Test sign-in with each provider. WorkOS will automatically link users by email address.

**Critical:** Users with unverified emails may need to verify after first social auth sign-in. Check WorkOS Dashboard → Authentication Settings for email verification rules.

## Step 8: Handle MFA Migration

**Decision Tree:**

```
What MFA types did users have in Supabase?
  |
  +-- TOTP only --> Users re-enroll TOTP in WorkOS (notify users)
  |
  +-- SMS only --> Users must switch to TOTP or Magic Auth (notify users)
  |
  +-- Both --> Users re-enroll TOTP, SMS users switch (notify users)
```

**Action:** Create a communication plan to notify affected users. TOTP secrets cannot be migrated.

**Alternative for SMS users:** Enable [Magic Auth](https://workos.com/docs/authkit/magic-auth) as an email-based second factor.

## Verification Checklist (ALL MUST PASS)

Run these commands after import:

```bash
# 1. User count matches Supabase
curl "https://api.workos.com/user_management/users?limit=1" -u "$WORKOS_API_KEY:" | jq '.metadata.total_count'
# Expected: Same as Supabase auth.users count

# 2. Sample user has password hash
curl "https://api.workos.com/user_management/users?email=sample@example.com" -u "$WORKOS_API_KEY:" | jq '.[0].password_hash_type'
# Expected: "bcrypt"

# 3. If multi-tenant: User has organization membership
curl "https://api.workos.com/user_management/organization_memberships?user_id=user_01H..." -u "$WORKOS_API_KEY:" | jq '.[0].organization_id'
# Expected: Non-empty org ID

# 4. Test login with existing password
# Use WorkOS SDK or AuthKit UI to test actual authentication
```

**Critical:** Test authentication with sample users BEFORE retiring Supabase Auth.

## Error Recovery

### "password_hash_type not supported"

**Root cause:** Incorrect hash format or type.

**Fix:**
- Verify exported hashes start with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
- Check API payload has `password_hash_type: 'bcrypt'`

### "email already exists"

**Root cause:** Duplicate import attempt or user already manually created.

**Fix:**
- Skip user if already imported (check by email first)
- Use Update User API if you need to add password hash to existing user

### Rate limit exceeded (429)

**Root cause:** Too many requests in short window.

**Fix:**
- Add delay between batches (e.g., 100 users per batch, 10-second pause)
- Check current rate limits: https://workos.com/docs/reference/rate-limits
- Use exponential backoff on 429 responses

### Social auth user not linking after migration

**Root cause:** Email mismatch or email not verified.

**Fix:**
- Verify the social provider returns the same email as Supabase
- Check WorkOS Dashboard → Authentication Settings for email verification requirements
- User may need to verify email before social auth link works

### Organization membership not created

**Root cause:** Invalid organization_id or user_id.

**Fix:**
- Verify organization was created in Step 4a (check org ID exists)
- Verify user was imported in Step 5 (check user ID exists)
- Ensure both IDs are from WorkOS (start with `org_` and `user_` prefixes)

## Related Skills

- workos-authkit-base - Core AuthKit implementation after migration
- workos-migrate-auth0 - Similar migration pattern for Auth0 users
- workos-api-organization - Managing organizations post-migration
- workos-mfa - MFA enrollment for users after migration
- workos-sso - Enterprise SSO setup (Supabase Auth doesn't have this)
