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

### Inventory Your Supabase Auth Setup

Determine what features you're using:

```bash
# Check if you have social auth configured
psql $SUPABASE_DB_URL -c "SELECT DISTINCT provider FROM auth.identities LIMIT 10;"

# Check if you have MFA enrolled users
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM auth.mfa_factors WHERE status = 'verified';"

# Check for custom metadata usage
psql $SUPABASE_DB_URL -c "SELECT raw_app_meta_data FROM auth.users WHERE raw_app_meta_data IS NOT NULL LIMIT 5;"
```

**Decision Tree: Migration Complexity**

```
Do you have users with...?
  |
  +-- Only email/password? --> Simple migration (proceed to Step 3)
  |
  +-- Social auth (OAuth)? --> Add Step 5: Social provider setup
  |
  +-- TOTP MFA enrolled? --> Add Step 6: MFA re-enrollment plan
  |
  +-- SMS MFA enrolled? --> REQUIRES user communication (SMS not supported)
  |
  +-- Multi-tenancy via RLS/metadata? --> Add Step 7: Organizations mapping
```

### Environment Variables Required

Check `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `SUPABASE_DB_URL` - PostgreSQL connection string for export

## Step 3: Export Users from Supabase

### SQL Export Script

Run this query in Supabase SQL Editor or via psql:

```sql
-- Export all users with password hashes
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

Save output as `supabase_users_export.csv`.

**Verification:**

```bash
# Check export has data
wc -l supabase_users_export.csv
# Should show user count + 1 header row

# Check for password hashes
grep "^\$2[aby]\$" supabase_users_export.csv | wc -l
# Should match user count with passwords
```

### Export Social Auth Identities (if applicable)

```sql
-- Export OAuth provider links
SELECT
  user_id,
  provider,
  provider_id,
  email
FROM auth.identities
WHERE provider != 'email';
```

Save as `supabase_identities_export.csv`.

## Step 4: Import Users into WorkOS

### Rate Limit Strategy (CRITICAL)

WorkOS Create User API has rate limits. For large migrations:

- **< 1,000 users**: Serial import acceptable
- **1,000 - 10,000 users**: Batch in groups of 100, 1-second delay between batches
- **> 10,000 users**: Contact WorkOS support for bulk import assistance

Check current rate limits: WebFetch `https://workos.com/docs/reference/rate-limits`

### Import Script Pattern

Create `migrate-users.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function migrateUsers() {
  const records = parse(readFileSync('supabase_users_export.csv'), {
    columns: true,
    skip_empty_lines: true,
  });

  for (const record of records) {
    try {
      await workos.users.create({
        email: record.email,
        emailVerified: !!record.email_confirmed_at,
        // Import password hash if exists
        ...(record.encrypted_password && {
          passwordHashType: 'bcrypt',
          passwordHash: record.encrypted_password,
        }),
      });

      console.log(`✓ Migrated: ${record.email}`);

      // Rate limit: 100 req/min = 600ms between requests
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (error) {
      console.error(`✗ Failed: ${record.email}`, error.message);
      // Log to migration_errors.log for retry
    }
  }
}

migrateUsers();
```

**Field Mapping Reference:**

| Supabase Field         | WorkOS API Parameter |
| ---------------------- | -------------------- |
| `email`                | `email`              |
| `email_confirmed_at`   | `emailVerified`      |
| `encrypted_password`   | `passwordHash`       |
| N/A (always bcrypt)    | `passwordHashType`   |
| `raw_user_meta_data`   | Custom handling      |

### Run Import

```bash
# Dry run first (add --dry-run flag to your script)
npx tsx migrate-users.ts --dry-run

# Verify dry run output
# Then run actual import
npx tsx migrate-users.ts
```

**Verification:**

```bash
# Check WorkOS Dashboard user count matches export
# Or query via API
curl https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

## Step 5: Social Auth Provider Setup (Conditional)

**ONLY if Step 2 found OAuth identities.**

### For Each Provider Found in Export

```
Provider in export?
  |
  +-- google --> Configure Google OAuth in WorkOS Dashboard
  |
  +-- github --> Configure GitHub OAuth in WorkOS Dashboard
  |
  +-- microsoft --> Configure Microsoft OAuth in WorkOS Dashboard
  |
  +-- Other --> Check /integrations page for support
```

**Configuration Steps (per provider):**

1. Go to WorkOS Dashboard → Integrations
2. Enable the provider
3. Add OAuth client credentials (from provider's console)
4. Copy redirect URI back to provider console
5. Test sign-in flow in test environment

**Automatic Linking:** WorkOS matches users by email address. When a user signs in via OAuth, WorkOS links to existing user with matching email.

**Email Verification Note:**

- `@gmail.com` via Google OAuth: No extra verification needed
- Other domains: May require email verification if enabled in environment settings

## Step 6: MFA Migration Plan (Conditional)

**ONLY if Step 2 found verified MFA factors.**

### TOTP MFA Users

**CRITICAL:** TOTP secrets CANNOT be exported from Supabase. Users MUST re-enroll.

**Communication Plan Template:**

1. Email users with MFA enrolled BEFORE migration
2. Message: "After migration, you'll need to re-enroll your authenticator app"
3. Link to enrollment guide: `https://workos.com/docs/authkit/mfa`
4. Timeline: "Migration date: [DATE]"

### SMS MFA Users

**BREAKING CHANGE:** WorkOS does not support SMS MFA (security reasons: SIM swap attacks).

**Migration Options:**

```
SMS MFA user?
  |
  +-- Switch to TOTP --> Send enrollment instructions
  |
  +-- Use Magic Auth (email) --> Send onboarding guide
  |
  +-- Disable MFA --> Security downgrade (not recommended)
```

**Required Communication:** Email SMS MFA users 1 week before migration with chosen alternative.

## Step 7: Organizations and Multi-Tenancy (Conditional)

**ONLY if Step 2 found `raw_app_meta_data` with tenant info.**

### Map Tenant IDs to Organizations

Identify your tenant ID pattern:

```sql
-- Find common metadata patterns
SELECT DISTINCT jsonb_object_keys(raw_app_meta_data)
FROM auth.users
WHERE raw_app_meta_data IS NOT NULL;
```

Common patterns:

- `tenant_id`
- `organization_id`
- `company_id`

### Create Organizations Script

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// 1. Extract unique tenant IDs from export
const tenants = new Set(
  records
    .filter((r) => r.raw_app_meta_data?.tenant_id)
    .map((r) => JSON.parse(r.raw_app_meta_data).tenant_id)
);

// 2. Create WorkOS organizations
const orgMap = new Map();
for (const tenantId of tenants) {
  const org = await workos.organizations.create({
    name: `Tenant ${tenantId}`, // Replace with actual tenant name if available
  });
  orgMap.set(tenantId, org.id);
  console.log(`Created org: ${tenantId} → ${org.id}`);
}

// 3. Add users to organizations
for (const record of records) {
  if (!record.raw_app_meta_data) continue;

  const tenantId = JSON.parse(record.raw_app_meta_data).tenant_id;
  const orgId = orgMap.get(tenantId);

  if (orgId) {
    await workos.userManagement.createOrganizationMembership({
      userId: record.id, // Use WorkOS user ID from import
      organizationId: orgId,
    });
  }
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration success:

```bash
# 1. Check user count matches
echo "Supabase count:"
psql $SUPABASE_DB_URL -t -c "SELECT COUNT(*) FROM auth.users;"
echo "WorkOS count:"
curl -s https://api.workos.com/users -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.metadata.total_count'

# 2. Verify password auth works (test one user)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  | jq '.user.id'

# 3. Verify OAuth linking (if configured)
# Sign in via OAuth in test app, check user is linked not duplicated

# 4. Check organization memberships (if applicable)
curl -s "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Should match user count with tenant_id

# 5. Verify migration errors log is empty or acceptable
test -f migration_errors.log && wc -l migration_errors.log || echo "No errors"
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email or retry of failed import.

**Fix:** Check WorkOS Dashboard for existing user, skip in import script:

```typescript
try {
  await workos.users.create({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    console.log(`Skipping duplicate: ${email}`);
    continue;
  }
  throw error;
}
```

### "Invalid password hash format"

**Cause:** Supabase password hash corrupted or not bcrypt format.

**Fix:** Verify hash starts with `$2a$`, `$2b$`, or `$2y$`:

```bash
# Check hash format in export
head -5 supabase_users_export.csv | grep encrypted_password
```

If invalid format, import user WITHOUT password hash and trigger password reset email.

### Rate limit 429 errors

**Cause:** Importing too fast.

**Fix:** Increase delay between requests:

```typescript
// From 600ms to 1200ms (50 req/min)
await new Promise((resolve) => setTimeout(resolve, 1200));
```

For large migrations, contact WorkOS support for temporary rate limit increase.

### OAuth users can't sign in after migration

**Cause:** Provider not configured in WorkOS Dashboard.

**Fix:**

1. Check provider is enabled: Dashboard → Integrations
2. Verify OAuth credentials are correct
3. Test OAuth flow in isolation
4. Check redirect URI matches exactly (trailing slash matters)

### Organization memberships missing

**Cause:** Script didn't map `tenant_id` correctly or user IDs mismatched.

**Fix:**

1. Verify `orgMap` contains all tenant IDs from export
2. Confirm WorkOS user IDs (not Supabase UUIDs) used in membership creation
3. Re-run organization membership script (it's idempotent)

### Email verification stuck for OAuth users

**Cause:** Email domain not recognized as verified by provider.

**Fix:** In WorkOS Dashboard → Authentication Settings:

- Disable "Require email verification" temporarily for migration
- OR manually verify users via API:

```typescript
await workos.users.update(userId, { emailVerified: true });
```

## Post-Migration Cleanup

After successful verification:

1. **Disable Supabase Auth** (don't delete DB yet):

```sql
-- Revoke auth schema access
REVOKE ALL ON SCHEMA auth FROM authenticated;
```

2. **Monitor WorkOS auth logs** for 1 week for issues
3. **Keep Supabase backup** for 30 days minimum
4. **Update all auth-related documentation** with WorkOS patterns

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit after migration
- `workos-organizations` - Advanced organization management
- `workos-user-management` - Post-migration user operations
