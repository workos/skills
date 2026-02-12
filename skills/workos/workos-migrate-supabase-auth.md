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

## Step 2: Pre-Migration Planning

### Assess Migration Scope

Run these queries in Supabase SQL Editor to determine migration complexity:

```bash
# Count total users
SELECT COUNT(*) FROM auth.users;

# Count users with social auth (no password)
SELECT COUNT(*) FROM auth.users WHERE encrypted_password IS NULL;

# Count users with MFA enabled
SELECT COUNT(*) FROM auth.users WHERE totp_secret IS NOT NULL;

# Count users with phone auth
SELECT COUNT(*) FROM auth.users WHERE phone IS NOT NULL AND phone_confirmed_at IS NOT NULL;
```

**Decision tree based on counts:**

```
User count?
  |
  +-- < 1,000 --> Direct API import (Step 3)
  |
  +-- 1,000-10,000 --> Batched import with 100ms delays (Step 3)
  |
  +-- 10,000+ --> Contact WorkOS support for bulk import assistance
```

### Multi-Tenancy Detection

Check if your Supabase app uses multi-tenancy:

```sql
-- Check for tenant_id columns (common RLS pattern)
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name LIKE '%tenant%' OR column_name LIKE '%org%';

-- Check user metadata for tenant references
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE raw_app_meta_data::text LIKE '%tenant%'
   OR raw_app_meta_data::text LIKE '%org%'
LIMIT 5;
```

**If multi-tenancy detected:** You will create WorkOS Organizations in Step 4. Note the metadata field containing tenant IDs.

## Step 3: Export Users from Supabase

### Export User Data

Run this query in Supabase SQL Editor or via database client:

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
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at;
```

Save results as CSV or JSON.

### Password Hash Verification

**CRITICAL:** Supabase uses bcrypt hashes. Verify format before importing:

```bash
# Bcrypt hashes start with $2a$, $2b$, or $2y$
grep -E '^\$2[aby]\$' exported_users.csv

# All password hashes should match this pattern
# If any don't, those users will need password resets
```

**Expected format:** `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`

### Social Auth User Identification

Users with `encrypted_password = NULL` signed in via social providers (Google, Microsoft, GitHub, etc.).

**These users:**

- Do NOT need password import
- WILL automatically link on first social sign-in via WorkOS
- MAY need email verification depending on provider (gmail.com bypasses verification, others may not)

## Step 4: Prepare WorkOS Environment

### Install SDK

Detect package manager and install WorkOS SDK:

```bash
# Detect package manager
if [ -f "package-lock.json" ]; then
  npm install @workos-inc/node
elif [ -f "yarn.lock" ]; then
  yarn add @workos-inc/node
elif [ -f "pnpm-lock.yaml" ]; then
  pnpm add @workos-inc/node
fi
```

**Verify installation:**

```bash
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK not installed"
```

### Environment Variables

Add to `.env` or `.env.local`:

```bash
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
```

**Verify keys:**

```bash
grep -E "WORKOS_API_KEY=sk_" .env* && \
grep -E "WORKOS_CLIENT_ID=client_" .env* || \
echo "FAIL: WorkOS credentials missing or malformed"
```

### Create Organizations (If Multi-Tenant)

If Step 2 detected multi-tenancy, create WorkOS Organizations BEFORE importing users:

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Extract unique tenant IDs from Supabase metadata
const tenantIds = [
  ...new Set(
    supabaseUsers.map((u) => u.raw_app_meta_data?.tenant_id).filter(Boolean),
  ),
];

// Create organizations
const orgMap = new Map();
for (const tenantId of tenantIds) {
  const org = await workos.organizations.createOrganization({
    name: `Organization ${tenantId}`, // Replace with actual tenant name
    domains: [], // Add if you have domain data
  });
  orgMap.set(tenantId, org.id);
}
```

**Save organization mapping** — you'll need `orgMap` for Step 5.

## Step 5: Import Users into WorkOS

### Rate Limit Strategy

WorkOS Create User API has rate limits. Use this batching pattern:

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function importUsers(users: SupabaseUser[]) {
  const results = { success: 0, failed: 0, errors: [] };

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    try {
      await workos.userManagement.createUser({
        email: user.email,
        emailVerified: !!user.email_confirmed_at,
        password: user.encrypted_password, // Only if not null
        passwordHash: user.encrypted_password, // Bcrypt hash
        passwordHashType: "bcrypt",
        firstName: user.raw_user_meta_data?.first_name,
        lastName: user.raw_user_meta_data?.last_name,
      });

      results.success++;

      // Rate limit: 100ms delay between requests for < 10k users
      if (users.length < 10000) {
        await sleep(100);
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ email: user.email, error: error.message });
    }

    // Progress logging every 100 users
    if ((i + 1) % 100 === 0) {
      console.log(`Imported ${i + 1}/${users.length} users`);
    }
  }

  return results;
}
```

### Password-Only Users

For users WITH `encrypted_password`, use this mapping:

```typescript
await workos.userManagement.createUser({
  email: user.email,
  emailVerified: !!user.email_confirmed_at,
  passwordHash: user.encrypted_password,
  passwordHashType: "bcrypt",
  // Optional fields from metadata:
  firstName: user.raw_user_meta_data?.first_name,
  lastName: user.raw_user_meta_data?.last_name,
});
```

### Social Auth Users

For users WITHOUT `encrypted_password` (social auth only), OMIT password fields:

```typescript
await workos.userManagement.createUser({
  email: user.email,
  emailVerified: !!user.email_confirmed_at,
  // NO password fields - user will link on first OAuth sign-in
  firstName: user.raw_user_meta_data?.first_name,
  lastName: user.raw_user_meta_data?.last_name,
});
```

**CRITICAL:** Social auth users will auto-link when they sign in via WorkOS OAuth using the SAME email address. Do NOT try to manually link them.

### Add to Organizations (If Multi-Tenant)

After creating users, add them to organizations:

```typescript
const workosUser = await workos.userManagement.createUser({...});

const tenantId = user.raw_app_meta_data?.tenant_id;
const organizationId = orgMap.get(tenantId);

if (organizationId) {
  await workos.userManagement.createOrganizationMembership({
    userId: workosUser.id,
    organizationId: organizationId,
    // If using roles:
    // roleSlug: user.raw_app_meta_data?.role || 'member',
  });
}
```

## Step 6: Configure Social Auth Providers

If Step 3 identified social auth users, configure those providers in WorkOS Dashboard:

**Provider setup checklist:**

```
For each provider (Google, Microsoft, GitHub, etc.):
  |
  +-- Dashboard: Navigate to "Integrations"
  |
  +-- Enable provider
  |
  +-- Add OAuth client credentials
  |
  +-- Test sign-in with a migrated social auth user
```

See provider-specific guides:

- Google OAuth: https://workos.com/docs/integrations/google-oauth
- Microsoft OAuth: https://workos.com/docs/integrations/microsoft-oauth
- GitHub OAuth: https://workos.com/docs/integrations/github-oauth

**Email verification note:** Users signing in with `gmail.com` emails via Google OAuth skip verification. Other providers may require email verification — check the fetched migration guide for exact behavior.

## Step 7: Handle MFA Users (BREAKING CHANGE)

**CRITICAL:** Supabase TOTP secrets CANNOT be exported. All MFA users must re-enroll.

### TOTP Users

Users with `totp_secret` in Supabase must re-enroll TOTP in WorkOS:

1. User signs in after migration
2. App prompts for MFA enrollment using WorkOS MFA API
3. User scans new QR code with authenticator app

**Implementation:** See https://workos.com/docs/authkit/mfa for enrollment flow.

### SMS MFA Users (NOT SUPPORTED)

**WorkOS does NOT support SMS-based MFA** due to SIM swap vulnerabilities.

Users with `phone_confirmed_at` in Supabase used SMS MFA. Present these options:

```
SMS MFA user migration path:
  |
  +-- Option A: Switch to TOTP (authenticator app)
  |
  +-- Option B: Use Magic Auth (email-based passwordless)
  |
  +-- Option C: Use password + TOTP
```

**Communicate this change to users BEFORE migration** — SMS MFA will stop working.

## Verification Checklist (ALL MUST PASS)

Run these checks after import completes:

```bash
# 1. Verify WorkOS SDK installed
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK missing"

# 2. Verify environment variables
grep -E "WORKOS_API_KEY=sk_" .env* && \
grep -E "WORKOS_CLIENT_ID=client_" .env* || \
echo "FAIL: WorkOS credentials missing"

# 3. Check import results
# (This is from your import script output)
echo "Expected users: [TOTAL_FROM_SUPABASE]"
echo "Imported successfully: [results.success]"
echo "Failed imports: [results.failed]"

# 4. Test authentication for a migrated user
# Use WorkOS Dashboard > Users to verify a test user exists
# Then test sign-in via your app

# 5. For social auth users: verify provider is enabled
# Dashboard > Integrations > [Provider] should show "Enabled"
```

**Import success criteria:**

- `results.success` ≥ 95% of total users (some failures expected for invalid emails, etc.)
- Test user can sign in with existing password
- Social auth test user can sign in via OAuth
- Multi-tenant test user is in correct organization

## Error Recovery

### "Invalid password hash format"

**Cause:** Bcrypt hash is malformed or not bcrypt.

**Fix:**

1. Check hash format in export: `grep "encrypted_password" exported_users.csv | head -1`
2. Verify starts with `$2a$`, `$2b$`, or `$2y$`
3. If hash is different algorithm, those users MUST reset passwords (WorkOS only supports bcrypt from Supabase)

### "Email already exists"

**Cause:** User already imported or email conflict.

**Fix:** Skip duplicate and log for manual review — likely a re-run of import script.

### "Rate limit exceeded"

**Cause:** Too many requests too quickly.

**Fix:**

1. Increase `sleep()` delay to 200ms
2. For > 10,000 users, contact WorkOS support for bulk import

### Social auth user "email not verified"

**Cause:** Provider doesn't pre-verify emails.

**Expected behavior:** User receives verification email on first WorkOS sign-in.

**Fix:** This is normal for non-Gmail providers. User must verify email once.

### MFA user cannot sign in

**Cause:** TOTP secret was not migrated (cannot be exported from Supabase).

**Fix:**

1. User signs in with password
2. App detects no MFA enrollment
3. App triggers MFA enrollment flow (see https://workos.com/docs/authkit/mfa)
4. User scans new QR code

This is expected and MUST be communicated to users before migration.

### Organization membership not working

**Cause:** User created before organization, or mapping error.

**Fix:**

1. Verify organization exists: Check WorkOS Dashboard > Organizations
2. Re-run organization membership creation for that user:

```typescript
await workos.userManagement.createOrganizationMembership({
  userId: workosUserId,
  organizationId: organizationId,
});
```

### "Cannot read property 'raw_app_meta_data' of undefined"

**Cause:** Supabase export missing metadata columns.

**Fix:** Re-run SQL export including `raw_app_meta_data` and `raw_user_meta_data` columns.

## Related Skills

After completing user migration, integrate AuthKit:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
