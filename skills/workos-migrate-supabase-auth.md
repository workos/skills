---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The documentation is the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Source System Inventory

Check your Supabase project for:

```bash
# Count total users
echo "SELECT COUNT(*) FROM auth.users;" | psql $SUPABASE_DB_URL

# Count social auth users
echo "SELECT provider, COUNT(*) FROM auth.identities GROUP BY provider;" | psql $SUPABASE_DB_URL

# Check for MFA users
echo "SELECT COUNT(DISTINCT user_id) FROM auth.mfa_factors;" | psql $SUPABASE_DB_URL
```

**Decision tree for migration strategy:**

```
User authentication methods?
  |
  +-- Password only --> Export password hashes (Step 3)
  |
  +-- Social auth (Google/Microsoft) --> Configure OAuth providers first (Step 4)
  |
  +-- MFA enrolled --> Users MUST re-enroll after migration (no TOTP secret export)
  |
  +-- SMS MFA --> Not supported in WorkOS - migrate to TOTP or Magic Auth
```

### Multi-Tenancy Pattern Detection

Check if your app uses RLS-based multi-tenancy:

```sql
-- Check for tenant_id columns
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name LIKE '%tenant%';

-- Check app_metadata usage
SELECT jsonb_object_keys(raw_app_meta_data) as key, COUNT(*)
FROM auth.users
WHERE raw_app_meta_data IS NOT NULL
GROUP BY key;
```

If tenant IDs exist, you MUST create WorkOS Organizations (Step 5). Do not skip this.

## Step 3: Export Users from Supabase

### Export SQL Query (BLOCKING)

Run this in [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview#the-sql-editor):

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
WHERE deleted_at IS NULL;
```

**Export as CSV and save locally.** You need `encrypted_password` for hash import.

**Critical:** Supabase uses bcrypt for `encrypted_password`. WorkOS supports bcrypt import directly — no re-hashing needed.

### Export Social Identities

If you have social auth users:

```sql
SELECT
  user_id,
  provider,
  email,
  created_at
FROM auth.identities;
```

Save as `identities.csv`. You'll need this to understand which users rely on OAuth.

### Export Tenant Mappings (If Multi-Tenant)

If you use `app_metadata` for tenancy:

```sql
SELECT
  id,
  email,
  raw_app_meta_data->>'tenant_id' as tenant_id,
  raw_app_meta_data->>'role' as role
FROM auth.users
WHERE raw_app_meta_data->>'tenant_id' IS NOT NULL;
```

Save as `tenant_mappings.csv`.

## Step 4: Configure OAuth Providers (If Needed)

**Skip this step if you have no social auth users.**

For each provider in `identities.csv`, configure in WorkOS Dashboard:

- Google OAuth: https://workos.com/docs/integrations/google-oauth
- Microsoft OAuth: https://workos.com/docs/integrations/microsoft-oauth

**Verification:**

```bash
# Check provider is configured
curl -X GET "https://api.workos.com/sso/connections" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | select(.connection_type=="GoogleOAuth")'
```

If output is empty, provider is NOT configured. Go back to Dashboard.

## Step 5: Create WorkOS Organizations (If Multi-Tenant)

**Skip this step if you have no tenant_id data.**

For each unique tenant from Step 3's tenant_mappings.csv, create an Organization:

```typescript
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Read tenant_mappings.csv
const tenants = new Set(mappings.map((row) => row.tenant_id));

for (const tenantId of tenants) {
  await workos.organizations.createOrganization({
    name: tenantId, // or map to a friendly name
    // domains: [...], // if applicable
  });
}
```

**Verification:**

```bash
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

Expected: Count matches unique tenant_id count from SQL.

## Step 6: Import Users to WorkOS

### Rate Limit Strategy (CRITICAL)

WorkOS Create User API is rate-limited. Check current limits:

WebFetch: `https://workos.com/docs/reference/rate-limits`

**For migrations >1000 users:**

- Batch in groups of 100
- Add 1-second delay between batches
- Implement exponential backoff on 429 responses

### Import Script Template

```typescript
import { WorkOS } from "@workos-inc/node";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const users = parse(readFileSync("users.csv"), { columns: true });

for (const user of users) {
  try {
    await workos.userManagement.createUser({
      email: user.email,
      emailVerified: !!user.email_confirmed_at,
      firstName: user.raw_user_meta_data?.first_name,
      lastName: user.raw_user_meta_data?.last_name,
      // CRITICAL: Include password hash for existing password users
      ...(user.encrypted_password && {
        passwordHashType: "bcrypt",
        passwordHash: user.encrypted_password,
      }),
    });
  } catch (error) {
    console.error(`Failed to import ${user.email}:`, error);
  }
}
```

**Field mappings:**

| Supabase             | WorkOS API Parameter                 |
| -------------------- | ------------------------------------ |
| `email`              | `email`                              |
| `email_confirmed_at` | `emailVerified`                      |
| `encrypted_password` | `passwordHash`                       |
| (always `'bcrypt'`)  | `passwordHashType`                   |
| `raw_user_meta_data` | `firstName`, `lastName` (parse JSON) |

**Critical for password import:**

- `passwordHashType` MUST be `'bcrypt'` (Supabase's algorithm)
- `passwordHash` is the raw `encrypted_password` value (already bcrypt format)
- Do NOT re-hash or modify the hash — WorkOS accepts bcrypt directly

### Add Organization Memberships (If Multi-Tenant)

After user creation, add them to organizations:

```typescript
// For each user in tenant_mappings.csv
const workosUser = await workos.userManagement.getUserByEmail(user.email);
const workosOrg = await workos.organizations.listOrganizations({
  domains: [tenantId], // or however you mapped them
});

await workos.userManagement.createOrganizationMembership({
  userId: workosUser.id,
  organizationId: workosOrg.data[0].id,
  roleSlug: user.role, // if using roles
});
```

## Step 7: Handle Social Auth Users

**For users in identities.csv who signed in via OAuth:**

These users do NOT need manual import if you completed Step 4. On first sign-in:

1. User authenticates with Google/Microsoft
2. WorkOS receives email from OAuth provider
3. WorkOS auto-links to existing WorkOS user by email match

**Email verification gate:**

- If provider email is verified (gmail.com, company.com via Google Workspace), no extra verification
- If provider email is unverified, user MUST verify email before access

**Decision tree:**

```
Social auth user first sign-in?
  |
  +-- Email matches existing WorkOS user --> Auto-link (no action needed)
  |
  +-- No match --> New user created (not a migration case)
  |
  +-- Provider unverified email --> Verification flow required
```

## Step 8: MFA Migration Strategy

**CRITICAL:** TOTP secrets CANNOT be exported from Supabase. All MFA users MUST re-enroll.

### For TOTP Users

1. Notify users before migration: "You will need to re-enroll your authenticator app"
2. After migration, users enroll via WorkOS MFA flow (see https://workos.com/docs/authkit/mfa)
3. Old TOTP secrets become invalid after Supabase decommission

### For SMS MFA Users

SMS MFA is NOT supported in WorkOS due to SIM swap vulnerabilities. Migration options:

```
SMS MFA user?
  |
  +-- Migrate to TOTP --> User enrolls authenticator app post-migration
  |
  +-- Migrate to Magic Auth --> User receives email code for sign-in
  |
  +-- No MFA --> Downgrade to password-only (least secure)
```

Email users before migration to explain the change.

## Step 9: Update Application Auth Code

### Replace Supabase Client Calls

| Supabase Pattern                     | WorkOS Pattern             |
| ------------------------------------ | -------------------------- |
| `supabase.auth.signInWithPassword()` | AuthKit sign-in flow       |
| `supabase.auth.signInWithOAuth()`    | AuthKit OAuth providers    |
| `supabase.auth.getSession()`         | `getUser()` in AuthKit SDK |
| `supabase.auth.signOut()`            | `signOut()` in AuthKit SDK |

See relevant framework skill for exact SDK usage:

- Next.js: Reference `workos-authkit-nextjs` skill
- React: Reference `workos-authkit-react` skill

### Replace RLS Policies with Organization Checks

If you used Supabase RLS with tenant_id:

```sql
-- OLD: Supabase RLS policy
CREATE POLICY tenant_isolation ON posts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Replace with WorkOS organization membership checks:

```typescript
// NEW: WorkOS organization check
const memberships = await workos.userManagement.listOrganizationMemberships({
  userId: user.id,
});
const userOrgIds = memberships.data.map((m) => m.organizationId);

// Filter data by userOrgIds in application layer
```

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Count imported users
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Expected: Match Supabase user count

# 2. Check password hash import worked
# Try signing in as a test user with their OLD password
# If sign-in succeeds, hashes imported correctly

# 3. Check organization memberships (if multi-tenant)
curl -X GET "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Expected: Match tenant_mappings.csv row count

# 4. Test social auth sign-in
# Sign in via Google/Microsoft as a test user from identities.csv
# Expected: Auto-links to existing WorkOS user without creating duplicate

# 5. Verify MFA users cannot sign in with old TOTP
# Expected: Sign-in fails until user re-enrolls
```

**If any check fails, DO NOT proceed to production cutover.**

## Error Recovery

### "User already exists" during import

**Cause:** User email already in WorkOS (duplicate run or partial migration).

**Fix:** Check if user needs update vs. creation:

```typescript
try {
  await workos.userManagement.createUser({ email });
} catch (error) {
  if (error.code === "user_already_exists") {
    // Update instead
    const existing = await workos.userManagement.getUserByEmail(email);
    await workos.userManagement.updateUser({
      userId: existing.id,
      passwordHash: user.encrypted_password,
      passwordHashType: "bcrypt",
    });
  }
}
```

### "Invalid password hash" error

**Cause 1:** `passwordHashType` is wrong. Supabase uses `'bcrypt'`, not `'md5'` or `'sha256'`.

**Fix:** Verify `passwordHashType: 'bcrypt'` in all import calls.

**Cause 2:** Password hash is corrupted or incomplete in CSV export.

**Fix:** Re-export users.csv and check `encrypted_password` column is not truncated.

### Rate limit 429 responses

**Cause:** Exceeding Create User API rate limit (see https://workos.com/docs/reference/rate-limits).

**Fix:** Add delays between batches:

```typescript
for (let i = 0; i < users.length; i += 100) {
  const batch = users.slice(i, i + 100);
  await Promise.all(batch.map(importUser));
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
}
```

### Social auth users create duplicates instead of linking

**Cause:** OAuth provider not configured in WorkOS Dashboard before migration.

**Fix:** Complete Step 4 BEFORE running user import. If already imported, delete duplicates via Dashboard.

### Organization membership fails with "user not found"

**Cause:** User import (Step 6) did not complete before membership creation (Step 6).

**Fix:** Ensure user creation returns successfully before creating memberships. Add verification:

```typescript
const workosUser = await workos.userManagement.getUserByEmail(email);
if (!workosUser)
  throw new Error(`User ${email} not found - import may have failed`);
```

### Users cannot sign in after migration

**Decision tree:**

```
Sign-in fails?
  |
  +-- Password users --> Check passwordHash was imported (Step 6)
  |                      Verify bcrypt format with test hash
  |
  +-- Social auth --> Check OAuth provider configured (Step 4)
  |                   Verify provider returns email claim
  |
  +-- MFA users --> Expected - they MUST re-enroll (Step 8)
```

### WORKOS_API_KEY authentication fails

**Cause:** Using client-side key (`pk_`) instead of server-side key (`sk_`).

**Fix:** Verify key starts with `sk_` and has appropriate scopes in WorkOS Dashboard.

## Related Skills

- `workos-authkit-nextjs` - For Next.js application integration after migration
- `workos-authkit-react` - For React application integration after migration
- `workos-directory-sync.rules.yml` - For enterprise directory sync after SSO setup
