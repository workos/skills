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

### Identify User Segments

Query Supabase to understand your user base:

```sql
-- Count users by auth method
SELECT 
  CASE 
    WHEN encrypted_password IS NOT NULL THEN 'password'
    ELSE 'social'
  END as auth_type,
  COUNT(*) as user_count
FROM auth.users
GROUP BY auth_type;

-- Check for MFA enrollments
SELECT COUNT(*) FROM auth.mfa_factors WHERE status = 'verified';
```

**Critical decisions:**
- Password users: Can migrate hashes directly (bcrypt supported)
- Social auth users: Will re-authenticate on first login (matched by email)
- MFA users: MUST re-enroll (TOTP secrets cannot be exported)
- SMS MFA users: MUST switch to TOTP or Magic Auth (WorkOS does not support SMS MFA due to SIM swap vulnerabilities)

### Check Multi-Tenancy Implementation

If using Row Level Security (RLS) or `app_metadata` for tenants:

```sql
-- Sample app_metadata structure
SELECT id, email, raw_app_meta_data FROM auth.users LIMIT 5;
```

**Decision tree:**

```
Multi-tenancy pattern?
  |
  +-- RLS with tenant_id column --> Map tenant_id to WorkOS Organization
  |
  +-- app_metadata with tenant --> Extract tenant value, create Organizations
  |
  +-- No multi-tenancy --> Import as individual users (no Organizations)
```

You will need to create Organizations BEFORE importing users if using multi-tenancy.

## Step 3: Export Users from Supabase

### Database Access

Use Supabase SQL Editor or direct PostgreSQL client connection.

**Export query (includes all auth-relevant fields):**

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

**Export to CSV:**

```bash
# Using psql (replace connection details)
psql "postgresql://user:pass@db.supabase.co:5432/postgres" \
  -c "\COPY (SELECT ...) TO 'supabase_users.csv' WITH CSV HEADER"
```

**Verify export:**
- Count rows in CSV matches query count
- Check `encrypted_password` column contains bcrypt hashes (starts with `$2a$`, `$2b$`, or `$2y$`)
- Validate email addresses are present (WorkOS requires email as primary identifier)

## Step 4: Create Organizations (If Using Multi-Tenancy)

**Skip this step if NOT using multi-tenancy.**

### Extract Unique Tenants

From CSV or via SQL:

```sql
-- Extract unique tenant IDs from app_metadata
SELECT DISTINCT raw_app_meta_data->>'tenant_id' as tenant_id
FROM auth.users
WHERE raw_app_meta_data->>'tenant_id' IS NOT NULL;
```

### Create WorkOS Organizations

**Pattern (batch with rate limiting):**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function createOrganizations(tenantIds: string[]) {
  const orgMap = new Map<string, string>(); // tenant_id -> org_id
  
  for (const tenantId of tenantIds) {
    try {
      const org = await workos.organizations.createOrganization({
        name: tenantId, // Use tenant_id as name or look up from your app
        domains: [], // Add if you have domain data
      });
      orgMap.set(tenantId, org.id);
      
      // Rate limiting: 100 req/min for Organization API
      await sleep(600); // 600ms = 100 req/min
    } catch (error) {
      console.error(`Failed to create org for tenant ${tenantId}:`, error);
    }
  }
  
  return orgMap;
}
```

**Verify:** Organizations exist in WorkOS Dashboard before proceeding.

## Step 5: Import Users into WorkOS

### Rate Limiting Strategy

- Create User API: 100 requests/minute ([rate limits reference](https://workos.com/docs/reference/rate-limits))
- Batch imports with 600ms delay between requests
- For large migrations (10k+ users), consider parallel batches with separate API keys

### Import Pattern (Password Users)

```typescript
import { WorkOS } from '@workos-inc/node';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

interface SupabaseUser {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  raw_app_meta_data: string; // JSON string
}

async function importUsers(csvPath: string, orgMap: Map<string, string>) {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const users: SupabaseUser[] = parse(csv, { columns: true });
  
  for (const user of users) {
    const metadata = user.raw_app_meta_data ? JSON.parse(user.raw_app_meta_data) : {};
    const tenantId = metadata.tenant_id;
    
    try {
      const workosUser = await workos.userManagement.createUser({
        email: user.email,
        emailVerified: !!user.email_confirmed_at,
        // Import password hash if exists
        ...(user.encrypted_password && {
          passwordHash: user.encrypted_password,
          passwordHashType: 'bcrypt',
        }),
      });
      
      // Add to organization if multi-tenant
      if (tenantId && orgMap.has(tenantId)) {
        await workos.userManagement.createOrganizationMembership({
          userId: workosUser.id,
          organizationId: orgMap.get(tenantId)!,
          // roleSlug: 'member', // Add if using roles
        });
      }
      
      console.log(`Imported: ${user.email}`);
      await sleep(600); // Rate limiting
      
    } catch (error) {
      console.error(`Failed to import ${user.email}:`, error);
    }
  }
}
```

**Critical notes:**
- `passwordHashType: 'bcrypt'` is REQUIRED when importing hashes
- Bcrypt hashes from Supabase work directly in WorkOS (no conversion needed)
- Users without `encrypted_password` (social auth only) should be imported WITHOUT password fields

### Import Pattern (Social Auth Only Users)

For users with null `encrypted_password`:

```typescript
await workos.userManagement.createUser({
  email: user.email,
  emailVerified: !!user.email_confirmed_at,
  // NO password fields
});
```

These users will re-authenticate via OAuth on first login and be automatically matched by email.

## Step 6: Configure Social Auth Providers

**Required if you have social auth users.**

### Identify Providers in Use

Check Supabase auth configuration or query identities:

```sql
-- See which providers are in use
SELECT DISTINCT provider FROM auth.identities;
```

### Set Up Provider Credentials

For each provider in use:

1. **Google OAuth:** Follow [Google integration guide](https://workos.com/docs/integrations/google-oauth)
2. **Microsoft OAuth:** Follow [Microsoft integration guide](https://workos.com/docs/integrations/microsoft-oauth)
3. **GitHub, etc.:** See [integrations page](https://workos.com/docs/integrations)

**Critical:** Provider credentials in WorkOS MUST use the SAME client IDs as Supabase, or users will create duplicate accounts.

**Email matching behavior:**
- WorkOS matches social auth users by email address
- Users from providers that verify emails (gmail.com, outlook.com, etc.) skip extra verification
- Users from unverified domains MAY need to verify email (check WorkOS Dashboard auth settings)

## Step 7: Handle MFA Users

**CRITICAL: TOTP secrets CANNOT be exported from Supabase.**

### Identify MFA Users

```sql
SELECT u.email, COUNT(f.id) as factor_count
FROM auth.users u
JOIN auth.mfa_factors f ON f.user_id = u.id
WHERE f.status = 'verified'
GROUP BY u.email;
```

### Communication Plan

**Before migration:**
- Email MFA users: "You will need to re-enroll in MFA after migration"
- SMS MFA users: "SMS MFA is not supported. Please enroll in authenticator app MFA or use Magic Auth"

**After migration:**
- Prompt users to re-enroll on first login
- See [MFA guide](https://workos.com/docs/authkit/mfa) for enrollment flow

**Decision tree for MFA migration:**

```
Supabase MFA type?
  |
  +-- TOTP (authenticator app) --> User must re-enroll (WorkOS supports TOTP)
  |
  +-- SMS (phone) --> User must switch to TOTP or Magic Auth (WorkOS does NOT support SMS)
```

## Step 8: Update Application Code

### Replace Supabase Client

**Before (Supabase):**

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);
const { data: { user } } = await supabase.auth.getUser();
```

**After (WorkOS):**

See `workos-authkit-nextjs`, `workos-authkit-react`, or other AuthKit skills depending on framework.

**Critical mapping:**
- `supabase.auth.signIn()` → WorkOS sign-in flow (via AuthKit)
- `supabase.auth.getUser()` → WorkOS `getUser()` or `withAuth()` (server-side)
- `supabase.auth.signOut()` → WorkOS `signOut()`

### Multi-Tenancy Code Updates

**Before (RLS with tenant_id):**

```typescript
const { data } = await supabase
  .from('documents')
  .select('*')
  .eq('tenant_id', user.app_metadata.tenant_id);
```

**After (WorkOS Organizations):**

```typescript
const { organizationMemberships } = await workos.userManagement.listOrganizationMemberships({
  userId: user.id,
});
const orgId = organizationMemberships[0]?.organizationId;

// Use orgId in your queries
const documents = await db.documents.findMany({
  where: { organizationId: orgId },
});
```

**Pattern:** Replace `tenant_id` checks with Organization membership lookups.

## Verification Checklist (ALL MUST PASS)

Run these commands AFTER migration:

```bash
# 1. Check user count matches
echo "Supabase user count:"
psql "postgresql://..." -c "SELECT COUNT(*) FROM auth.users;"
echo "WorkOS user count:"
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 2. Verify password auth works (test with a known user)
# Manual: Sign in to your app with a migrated user's password

# 3. Verify social auth works (if applicable)
# Manual: Sign in with Google/Microsoft using a migrated user's email

# 4. Check Organizations exist (if multi-tenant)
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 5. Verify Organization memberships (if multi-tenant)
curl -X GET "https://api.workos.com/user_management/organization_memberships?limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data'

# 6. Application builds without errors
npm run build
```

**Manual verification:**
- [ ] Password users can sign in with existing passwords
- [ ] Social auth users can sign in and are matched to existing accounts
- [ ] MFA-enrolled users see re-enrollment prompt
- [ ] Multi-tenant users see correct organization context

## Error Recovery

### "Invalid password hash" during import

**Root cause:** Supabase may store non-bcrypt hashes in rare cases (legacy accounts).

**Fix:**
1. Check hash format: `SELECT LEFT(encrypted_password, 4) FROM auth.users LIMIT 10;`
2. If NOT bcrypt (not `$2a$`, `$2b$`, `$2y$`): Skip password import, force password reset
3. Use Magic Auth for passwordless migration

### "Email already exists" during import

**Root cause:** Duplicate emails or prior partial migration.

**Fix:**
1. Check if user already exists: `curl -X GET "https://api.workos.com/user_management/users?email=user@example.com"`
2. If exists and should be updated: Use Update User API instead of Create
3. If duplicate in Supabase: Deduplicate before migration

### Social auth creates duplicate account

**Root cause:** User's social auth email differs from Supabase email, or email is unverified in provider.

**Fix:**
1. Check user's provider email: `SELECT provider, email FROM auth.identities WHERE user_id = '...'`
2. Ensure WorkOS provider config uses SAME client ID as Supabase
3. Manually merge accounts using WorkOS Dashboard if needed

### MFA users locked out

**Root cause:** Forgot to communicate re-enrollment requirement.

**Fix:**
1. Disable MFA enforcement temporarily in WorkOS Dashboard
2. Email users with re-enrollment instructions
3. Re-enable MFA enforcement after grace period

### Rate limit errors during import

**Root cause:** Exceeded 100 req/min limit.

**Fix:**
1. Add/increase `sleep()` delay between requests (600ms minimum)
2. Use exponential backoff on 429 responses
3. For large migrations, split CSV and use parallel API keys

### Organization membership not found after migration

**Root cause:** Membership creation failed or was skipped.

**Fix:**
1. Check Organization membership exists: `curl -X GET "https://api.workos.com/user_management/organization_memberships?userId=user_xxx"`
2. If missing: Create manually via [Create Organization Membership API](https://workos.com/docs/reference/authkit/organization-membership/create)
3. Verify `orgMap` was populated correctly in Step 4

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit with Next.js after migration
- `workos-authkit-react` - Integrate WorkOS AuthKit with React apps
- `workos-mfa` - Configure MFA enrollment flows for migrated users
- `workos-api-organization` - Manage Organizations via API for multi-tenant migrations
- `workos-magic-link` - Alternative auth method for users without password hashes
