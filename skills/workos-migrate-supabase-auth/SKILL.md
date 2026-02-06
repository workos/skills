---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- generated -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The WorkOS migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Verify in `.env.local` or equivalent:
- `WORKOS_API_KEY` exists and starts with `sk_`
- `WORKOS_CLIENT_ID` exists and starts with `client_`

**Test API connectivity:**
```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users?limit=1
```

Expected: 200 response. If 401, verify API key in WorkOS Dashboard.

### Supabase Database Access

Confirm you can access Supabase SQL Editor OR have database connection string:
```bash
# If using connection string, test connection
psql "$SUPABASE_DB_URL" -c "SELECT 1"
```

## Step 3: Export Users from Supabase

### SQL Export Strategy

Open Supabase SQL Editor (or connect via psql) and run:

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

**Export format decision tree:**

```
User count?
  |
  +-- < 1000 --> Copy/paste from SQL Editor to CSV
  |
  +-- 1000-10k --> Use psql \copy to file
  |
  +-- > 10k --> Use pg_dump with --data-only
```

For large exports with psql:
```bash
psql "$SUPABASE_DB_URL" -c "\copy (SELECT id, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at FROM auth.users) TO 'supabase_users.csv' WITH CSV HEADER"
```

**CRITICAL:** The `encrypted_password` field contains bcrypt hashes. These will import directly to WorkOS.

### Multi-Tenancy Data Extraction

If using Supabase multi-tenancy patterns, identify tenant mapping:

```
Tenant storage pattern?
  |
  +-- tenant_id in users table --> Extract: SELECT DISTINCT tenant_id FROM users
  |
  +-- tenant in raw_app_meta_data --> Extract: SELECT id, raw_app_meta_data->>'tenant_id' FROM auth.users
  |
  +-- RLS with separate table --> Query: SELECT user_id, organization_id FROM your_tenancy_table
```

Save tenant mappings separately — you'll need these for Step 5.

## Step 4: Create Migration Script

Create `scripts/migrate-supabase.ts` (or .js):

```typescript
import { WorkOS } from '@workos-inc/node';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

interface SupabaseUser {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  raw_app_meta_data: string;
  raw_user_meta_data: string;
  created_at: string;
}

async function migrateUsers() {
  const fileContent = fs.readFileSync('supabase_users.csv', 'utf-8');
  const users: SupabaseUser[] = csv.parse(fileContent, { columns: true });
  
  console.log(`Migrating ${users.length} users...`);
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    try {
      await workos.userManagement.createUser({
        email: user.email,
        emailVerified: !!user.email_confirmed_at,
        password: user.encrypted_password, // bcrypt hash imports directly
        passwordHashType: 'bcrypt',
        firstName: parseMetadata(user.raw_user_meta_data).firstName,
        lastName: parseMetadata(user.raw_user_meta_data).lastName,
      });
      
      console.log(`✓ Migrated ${user.email} (${i + 1}/${users.length})`);
      
      // Rate limiting: 10 req/sec = 100ms delay
      await sleep(100);
      
    } catch (error) {
      console.error(`✗ Failed ${user.email}:`, error.message);
      // Continue with other users
    }
  }
}

function parseMetadata(jsonString: string): any {
  try {
    return JSON.parse(jsonString || '{}');
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

migrateUsers().catch(console.error);
```

**Field mapping reference:**

| Supabase Field | WorkOS API Parameter | Notes |
|----------------|---------------------|-------|
| `email` | `email` | Required |
| `encrypted_password` | `password` + `passwordHashType: 'bcrypt'` | Imports hash directly |
| `email_confirmed_at` | `emailVerified` | Boolean: `!!email_confirmed_at` |
| `raw_user_meta_data` | `firstName`, `lastName` | Parse JSON |
| `phone` | N/A | WorkOS doesn't support phone auth |

## Step 5: Create Organizations (If Multi-Tenant)

**Only if your app uses multi-tenancy.** Skip to Step 6 if single-tenant.

Create `scripts/create-organizations.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function createOrganizations() {
  const tenants = [
    { id: 'tenant_1', name: 'Acme Corp' },
    { id: 'tenant_2', name: 'Globex Inc' },
    // ... from your tenant mapping export
  ];
  
  const orgMap = new Map(); // tenant_id -> org_id
  
  for (const tenant of tenants) {
    const org = await workos.organizations.createOrganization({
      name: tenant.name,
    });
    
    orgMap.set(tenant.id, org.id);
    console.log(`✓ Created org ${org.name} (${org.id})`);
  }
  
  // Save mapping for membership step
  fs.writeFileSync('org_mapping.json', JSON.stringify(Object.fromEntries(orgMap)));
}
```

Run BEFORE user migration:
```bash
npx tsx scripts/create-organizations.ts
```

## Step 6: Add Organization Memberships

**Only if multi-tenant.** This links users to organizations.

Create `scripts/assign-memberships.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function assignMemberships() {
  const orgMapping = JSON.parse(fs.readFileSync('org_mapping.json', 'utf-8'));
  const userTenants = JSON.parse(fs.readFileSync('user_tenant_mapping.json', 'utf-8'));
  
  for (const [email, tenantId] of Object.entries(userTenants)) {
    const orgId = orgMapping[tenantId];
    if (!orgId) {
      console.warn(`No org found for tenant ${tenantId}`);
      continue;
    }
    
    // Find user by email
    const { data: users } = await workos.userManagement.listUsers({ email });
    if (users.length === 0) {
      console.warn(`User not found: ${email}`);
      continue;
    }
    
    await workos.userManagement.createOrganizationMembership({
      userId: users[0].id,
      organizationId: orgId,
    });
    
    console.log(`✓ Added ${email} to ${orgId}`);
    await sleep(100); // Rate limiting
  }
}
```

## Step 7: Run Migration

Execute scripts in order:

```bash
# 1. Create organizations (if multi-tenant)
npx tsx scripts/create-organizations.ts

# 2. Migrate users
npx tsx scripts/migrate-supabase.ts

# 3. Assign memberships (if multi-tenant)
npx tsx scripts/assign-memberships.ts
```

**Monitor output for errors.** Common issues:
- Duplicate emails (WorkOS enforces unique emails)
- Invalid email formats
- Rate limit 429 responses (increase sleep duration)

## Step 8: Configure Social Auth Providers (If Used)

**Decision tree for social auth:**

```
Did users sign in with OAuth?
  |
  +-- No --> Skip to Step 9
  |
  +-- Yes --> Which providers?
        |
        +-- Google --> Go to WorkOS Dashboard > Integrations > Google
        |
        +-- Microsoft --> Go to WorkOS Dashboard > Integrations > Microsoft
        |
        +-- GitHub --> Go to WorkOS Dashboard > Integrations > GitHub
```

For each provider used:
1. Navigate to WorkOS Dashboard > Integrations
2. Click provider name
3. Add OAuth client credentials (client ID + secret)
4. Save

**CRITICAL:** WorkOS matches users by email. When a user signs in with Google after migration, WorkOS automatically links them to the existing account IF:
- Email matches exactly
- Email verification status allows it (see dashboard settings)

**Verify provider setup:**
```bash
# Check configured connections in dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/connections
```

Expected: JSON array with your configured providers.

## Step 9: Handle MFA Migration

**IMPORTANT:** TOTP secrets cannot be exported from Supabase.

### MFA Migration Strategy

```
User has MFA enrolled?
  |
  +-- TOTP (authenticator app) --> User must re-enroll
  |
  +-- SMS --> Switch to TOTP or Magic Auth (SMS not supported)
```

**Action items:**

1. Query Supabase for MFA users:
```sql
SELECT email, COUNT(*) 
FROM auth.mfa_factors 
WHERE status = 'verified'
GROUP BY email;
```

2. Email affected users BEFORE cutover:
```
Subject: Action Required: Re-enroll MFA

We're upgrading our authentication system. You'll need to:
1. Sign in after [migration date]
2. Go to Security settings
3. Scan the new QR code with your authenticator app

Your existing password will continue to work.
```

3. In WorkOS Dashboard, enable MFA:
   - Go to Authentication > Multi-Factor Auth
   - Enable "TOTP"
   - Set enforcement policy (optional, required, etc.)

## Verification Checklist (ALL MUST PASS)

Run these commands after migration completes:

```bash
# 1. Verify user count matches
echo "Supabase users:" && psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM auth.users"
echo "WorkOS users:" && curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/users?limit=1" | jq '.listMetadata.after // 0'

# 2. Test authentication with sample user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"existing_password","clientId":"'$WORKOS_CLIENT_ID'"}'

# 3. Verify organizations created (if multi-tenant)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'

# 4. Check for failed migrations in logs
grep "✗ Failed" migration.log | wc -l
```

**Pass criteria:**
1. User counts within 5% (some duplicates expected)
2. Sample auth returns 200 with session token
3. Organization count matches tenant count
4. Failed migrations < 1% of total

## Error Recovery

### "email already exists" during migration

**Root cause:** Duplicate emails in Supabase OR user already migrated.

**Fix:**
1. Check if email truly exists: `curl -H "Authorization: Bearer $WORKOS_API_KEY" "https://api.workos.com/users?email=user@example.com"`
2. If exists, skip: Add to migration script's `continue` block
3. If Supabase has duplicates, deduplicate BEFORE migration

### "invalid password hash" error

**Root cause:** Supabase field contains NULL or non-bcrypt hash.

**Fix:**
1. Check CSV for empty `encrypted_password` values
2. Filter in SQL export: `WHERE encrypted_password IS NOT NULL`
3. For users without passwords (OAuth-only), omit `password` field in CreateUser call

### "rate limit exceeded" (429 responses)

**Root cause:** API limit is 10 requests/second for user creation.

**Fix:**
1. Increase sleep duration in migration script: `await sleep(150)` (6.6 req/sec)
2. For bulk migrations, contact WorkOS support for temporary limit increase
3. Use batch API if available (check docs)

### Social auth user cannot sign in after migration

**Root cause:** Email mismatch or provider not configured.

**Debug:**
1. Check WorkOS Dashboard > Integrations for provider setup
2. Verify email in WorkOS matches provider's email: `curl https://api.workos.com/users?email=...`
3. Check email verification settings: Dashboard > Authentication > Email Verification

**Fix:** If emails differ, update user record or ask user to verify email.

### Organization memberships not working

**Root cause:** Tenant ID mapping incorrect or memberships not created.

**Debug:**
1. Check user's memberships: `curl https://api.workos.com/user_management/organization_memberships?userId=user_123`
2. Verify org ID exists: `curl https://api.workos.com/organizations/org_123`

**Fix:** Re-run membership script with corrected mapping.

### "password authentication disabled" error

**Root cause:** WorkOS environment has password auth disabled in Dashboard.

**Fix:** 
1. Go to WorkOS Dashboard > Authentication > Password
2. Enable "Password authentication"
3. Save and retry migration

## Post-Migration Tasks

1. **Update application code** to use WorkOS SDK instead of Supabase Auth
2. **Test critical flows** with real user accounts (get permission first)
3. **Monitor error logs** for 48 hours after cutover
4. **Deprecate Supabase Auth** after verification period:
   ```sql
   -- Disable Supabase auth signups
   UPDATE auth.config SET allow_signup = false;
   ```
5. **Archive Supabase user data** per retention policy

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit in Next.js apps
- `workos-directory-sync` - Sync users from identity providers like Okta, Entra ID
