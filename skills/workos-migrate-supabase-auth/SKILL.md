---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- generated -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Project Inventory

Run these commands to understand what you're migrating:

```bash
# 1. Count total users in Supabase
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM auth.users;"

# 2. Count users with social auth
psql $SUPABASE_DB_URL -c "SELECT provider, COUNT(*) FROM auth.identities GROUP BY provider;"

# 3. Count users with MFA enabled
psql $SUPABASE_DB_URL -c "SELECT COUNT(DISTINCT user_id) FROM auth.mfa_factors WHERE status = 'verified';"

# 4. Check for custom app_metadata (multi-tenancy)
psql $SUPABASE_DB_URL -c "SELECT DISTINCT jsonb_object_keys(raw_app_meta_data) FROM auth.users LIMIT 10;"
```

**Document these numbers** — you will verify them post-migration.

### WorkOS Prerequisites

Check `.env` or environment variables for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** API key is valid before continuing:

```bash
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

If 401/403, key is invalid. Stop and fix.

## Step 3: Export Users from Supabase

### Export User Data

Run this SQL in [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):

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
  updated_at
FROM auth.users
ORDER BY created_at;
```

Save output as CSV or JSON. **Critical:** `encrypted_password` column contains bcrypt hashes — do not lose this data.

### Export Social Auth Identities

```sql
SELECT
  user_id,
  provider,
  provider_id,
  identity_data,
  created_at
FROM auth.identities
ORDER BY user_id, created_at;
```

Save separately. You will use this to understand which users use social auth.

### Export MFA Enrollments (INFORMATION ONLY)

```sql
SELECT
  user_id,
  factor_type,
  status,
  friendly_name
FROM auth.mfa_factors
WHERE status = 'verified';
```

**Important:** TOTP secrets cannot be exported. Save this to identify which users need MFA re-enrollment notifications.

## Step 4: Decision Tree - Multi-Tenancy Migration

```
Does your Supabase app use multi-tenancy?
  |
  +-- NO --> Skip to Step 5
  |
  +-- YES --> How is tenancy implemented?
       |
       +-- app_metadata with tenant_id --> Use Step 4A
       |
       +-- RLS policies with tenant column --> Use Step 4B
       |
       +-- Other --> Adapt Step 4A pattern
```

### Step 4A: Migrate Organizations from app_metadata

If users have `tenant_id` in `raw_app_meta_data`:

1. Extract unique tenant IDs:

```bash
psql $SUPABASE_DB_URL -c "SELECT DISTINCT raw_app_meta_data->>'tenant_id' as tenant_id FROM auth.users WHERE raw_app_meta_data->>'tenant_id' IS NOT NULL;"
```

2. Create WorkOS Organizations for each tenant:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// For each unique tenant_id
const organization = await workos.organizations.createOrganization({
  name: tenantName, // You must map tenant_id to a readable name
  domains: [], // Optional: add domains if applicable
});

// Save mapping: tenant_id -> organization.id
```

3. Save the mapping file (JSON):

```json
{
  "tenant_123": "org_01HXYZ...",
  "tenant_456": "org_01HABC..."
}
```

You will use this in Step 5.

### Step 4B: Migrate Organizations from RLS

If using RLS with a `tenant` column in app tables:

1. Query your app database (not auth schema) to extract tenant info
2. Create Organizations as in Step 4A
3. Map user emails to tenant IDs using your app's user-tenant relationship table

## Step 5: Import Users to WorkOS

### Rate Limit Strategy (CRITICAL)

WorkOS user creation API has rate limits. See `https://workos.com/docs/reference/rate-limits` for current limits.

**For migrations >1000 users:**

- Batch users in groups of 100
- Add 1-second delay between batches
- Implement retry with exponential backoff on 429 responses

### Import Script Template

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Load your Supabase export
const supabaseUsers = loadSupabaseExport(); // Your CSV/JSON loader
const tenantMapping = loadTenantMapping(); // From Step 4, if applicable

for (const user of supabaseUsers) {
  try {
    const workosUser = await workos.userManagement.createUser({
      email: user.email,
      emailVerified: !!user.email_confirmed_at,
      firstName: user.raw_user_meta_data?.first_name,
      lastName: user.raw_user_meta_data?.last_name,
      // CRITICAL: Import password hash
      passwordHash: user.encrypted_password,
      passwordHashType: 'bcrypt',
    });

    // If using Organizations (from Step 4)
    if (user.raw_app_meta_data?.tenant_id) {
      const orgId = tenantMapping[user.raw_app_meta_data.tenant_id];
      if (orgId) {
        await workos.userManagement.createOrganizationMembership({
          userId: workosUser.id,
          organizationId: orgId,
          roleSlug: user.raw_app_meta_data?.role || 'member',
        });
      }
    }

    console.log(`Migrated: ${user.email}`);
  } catch (error) {
    console.error(`Failed: ${user.email}`, error.message);
    // Log to error file for manual review
  }

  // Rate limit protection
  await sleep(10); // 10ms between requests = ~100 req/sec
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Run the script:**

```bash
node migrate-users.js > migration.log 2> migration-errors.log
```

### Verify Import Count

After script completes:

```bash
# Count imported users
curl -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total'

# Compare to Supabase count from Step 2
```

Counts should match. If not, review `migration-errors.log`.

## Step 6: Configure Social Auth Providers

### Provider Inventory

From Step 3 social auth export, identify which providers are used:

```bash
# Count users per provider
cat identities.csv | awk -F',' '{print $2}' | sort | uniq -c
```

### Configure Each Provider in WorkOS

For each provider (Google, Microsoft, GitHub, etc.):

1. Go to WorkOS Dashboard → Authentication → Social Login
2. Follow provider-specific setup guide (check `/integrations/{provider}` in docs)
3. Enter OAuth client ID and secret from provider console
4. **Critical:** Use the SAME OAuth client credentials from your Supabase project if possible — this preserves user provider IDs

**Provider-specific URLs to check:**

- Google: `/integrations/google-oauth`
- Microsoft: `/integrations/microsoft-oauth`
- GitHub: `/integrations/github-oauth`

### Email Verification for Social Auth

After migration, users signing in via social auth will auto-link by email.

**Behavior:**

- Gmail/Google Workspace: No extra verification needed (Google pre-verifies)
- Other providers: May require email verification step if enabled in WorkOS settings

Check WorkOS Dashboard → Settings → Authentication → Email Verification to configure.

## Step 7: Handle MFA Migration

### TOTP Users (Authenticator Apps)

**CRITICAL:** TOTP secrets cannot be exported from Supabase. Users MUST re-enroll.

**Migration plan:**

1. Identify affected users from Step 3 MFA export
2. Send email notification BEFORE cutting over:

```
Subject: Action Required - MFA Re-enrollment

Your account uses multi-factor authentication. After our system upgrade on [DATE], you will need to re-enroll your authenticator app.

Instructions: [link to MFA setup guide]
```

3. Post-migration: Users enroll via WorkOS MFA flow (see `/authkit/mfa` in docs)

### SMS MFA Users

**WorkOS does not support SMS MFA** (security reasons: SIM swap attacks).

**Migration options:**

1. **Recommended:** Migrate to TOTP (authenticator app)
2. **Alternative:** Use Magic Auth (email-based passwordless)

Send email to SMS MFA users explaining the change:

```
Subject: MFA Change Required

We're upgrading to more secure authentication. SMS codes are being replaced with:

Option 1: Authenticator app (Google Authenticator, Authy, etc.)
Option 2: Email-based magic links

Choose your method: [link]
```

## Step 8: Update Application Code

### Replace Supabase Auth Calls

Common patterns to migrate:

```typescript
// BEFORE (Supabase)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);
const {
  data: { user },
} = await supabase.auth.getUser();

// AFTER (WorkOS)
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const { user } = await workos.userManagement.getUser(userId);
```

### Session Management

Supabase uses JWT tokens. WorkOS uses session cookies (managed by AuthKit middleware).

**If using Next.js:** Follow the `workos-authkit-nextjs` skill for integration.

**If using other frameworks:** Check WorkOS docs for framework-specific SDKs.

### Organization Context

If you migrated organizations (Step 4), update queries that used `tenant_id`:

```typescript
// BEFORE (Supabase + RLS)
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('tenant_id', user.app_metadata.tenant_id);

// AFTER (WorkOS Organizations)
const membership = await workos.userManagement.getOrganizationMembership({
  userId: user.id,
});
const orgId = membership.organizationId;
// Query your database with orgId instead of tenant_id
```

## Verification Checklist (ALL MUST PASS)

Run these checks before going live:

```bash
# 1. User count matches Supabase export
curl -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total'
# Compare to: psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM auth.users;"

# 2. Password authentication works (test user)
# Sign in via your app with a test user's Supabase password
# Should succeed without password reset

# 3. Social auth providers configured
# Sign in via each provider (Google, Microsoft, etc.)
# Should auto-link to existing user by email

# 4. Organizations linked (if applicable)
curl -X GET "https://api.workos.com/user_management/organization_memberships?user_id=USER_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
# Should return correct organization for test user

# 5. Application builds and starts
npm run build && npm start
```

**If any check fails, DO NOT proceed to cutover.**

## Step 9: Cutover Strategy

### Recommended Approach: Dual-Write Period

1. **T-7 days:** Run migration script, import all users to WorkOS
2. **T-7 to T-0:** Run nightly sync script to import new Supabase users
3. **T-0:** Deploy app with WorkOS auth, disable Supabase auth
4. **T+7 days:** Stop sync script, decommission Supabase auth

### Sync Script (for dual-write period)

```typescript
// Fetch users created in Supabase since last sync
const lastSyncTime = loadLastSyncTimestamp();
const newUsers = await supabase
  .from('auth.users')
  .select('*')
  .gt('created_at', lastSyncTime);

// Import to WorkOS (same logic as Step 5)
// Save new sync timestamp
```

### Rollback Plan

If critical issues arise post-cutover:

1. Redeploy previous app version with Supabase auth
2. WorkOS users are preserved (no data loss)
3. Investigate and fix issues
4. Retry cutover when ready

## Error Recovery

### "User already exists" during import

**Cause:** Running import script multiple times, or user exists from previous migration attempt.

**Fix:**

1. Check if user exists in WorkOS:

```bash
curl -X GET "https://api.workos.com/user_management/users?email=user@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

2. If exists, use Update API instead of Create:

```typescript
await workos.userManagement.updateUser({
  userId: existingUserId,
  passwordHash: user.encrypted_password,
  passwordHashType: 'bcrypt',
});
```

### "Invalid password hash" during import

**Cause:** Supabase `encrypted_password` is null or malformed.

**Fix:**

1. Check export query includes `encrypted_password` column
2. For users without passwords (social auth only), omit `passwordHash` parameter:

```typescript
// Social auth user - no password hash
await workos.userManagement.createUser({
  email: user.email,
  emailVerified: true,
  // No passwordHash fields
});
```

### "Rate limit exceeded" (429 responses)

**Cause:** Importing too fast, hitting WorkOS API rate limits.

**Fix:**

1. Increase delay between requests (currently 10ms → try 100ms)
2. Implement exponential backoff:

```typescript
async function createUserWithRetry(userData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.userManagement.createUser(userData);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### Social auth user cannot sign in after migration

**Cause 1:** OAuth provider not configured in WorkOS Dashboard.

**Fix:** Complete Step 6 for that provider.

**Cause 2:** Email mismatch between Supabase and provider.

**Fix:**

1. Check provider email vs Supabase email:

```sql
SELECT u.email, i.identity_data->>'email' as provider_email
FROM auth.users u
JOIN auth.identities i ON u.id = i.user_id
WHERE u.email != i.identity_data->>'email';
```

2. Users with mismatched emails need manual account linking or password reset

**Cause 3:** Email verification required but not completed.

**Fix:** User must verify email via WorkOS email verification flow. Check WorkOS Dashboard → Users → [user] → Email Verification status.

### Organization membership missing after migration

**Cause:** Mapping error between Supabase `tenant_id` and WorkOS `organizationId`.

**Fix:**

1. Check tenant mapping file from Step 4 is correct
2. Manually create membership:

```bash
curl -X POST "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01HXYZ...",
    "organization_id": "org_01HABC...",
    "role_slug": "member"
  }'
```

### Users cannot sign in with old passwords

**Cause 1:** `passwordHashType` not set to `'bcrypt'` during import.

**Fix:** Update users with correct hash type:

```typescript
await workos.userManagement.updateUser({
  userId: userId,
  passwordHash: user.encrypted_password,
  passwordHashType: 'bcrypt',
});
```

**Cause 2:** `encrypted_password` column was empty/null in export.

**Fix:** Force password reset for affected users via WorkOS Dashboard or API.

## Related Skills

- `workos-authkit-nextjs` - If migrating a Next.js app
- `workos-organizations` - For B2B multi-tenant apps
- `workos-user-management` - Core user operations and APIs
