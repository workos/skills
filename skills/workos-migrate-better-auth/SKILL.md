---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The WorkOS documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS account exists and is accessible
- Verify WorkOS Dashboard access at https://dashboard.workos.com
- Confirm environment is created (dev/staging/production)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### WorkOS SDK Installation

Detect package manager, install SDK package:

```bash
# npm
npm install @workos-inc/node

# yarn
yarn add @workos-inc/node

# pnpm
pnpm add @workos-inc/node
```

**Verify:** SDK package exists in node_modules before continuing.

## Step 3: Database Access and Schema Verification

Better Auth uses multiple database tables. Verify access to:

- `user` - Core user data (id, name, email, emailVerified, image, timestamps)
- `account` - Provider authentication data including password hashes
- `organization` - Organization data (if using organization plugin)
- `member` - User-to-organization mappings with roles

**Decision Tree: Database Access Method**

```
Database access method?
  |
  +-- Direct SQL --> Use native export tools
  |
  +-- ORM (Prisma, etc.) --> Use ORM query methods
  |
  +-- Database GUI --> Export to JSON/CSV
```

Test database connectivity before proceeding:

```sql
-- Verify tables exist
SELECT COUNT(*) FROM user;
SELECT COUNT(*) FROM account WHERE providerId = 'credential';
```

## Step 4: Export User Data

### Core User Data

Export from `user` table:

```sql
SELECT id, email, name, emailVerified, createdAt, updatedAt
FROM user;
```

Save output as JSON or CSV for migration script.

### Password Hashes

Export password hashes from `account` table:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**CRITICAL:** Better Auth uses `scrypt` by default. If you configured a custom hashing algorithm, document it now - you'll need it for Step 6.

### Social Auth Accounts (Optional)

If users signed in via social providers:

```sql
SELECT userId, providerId, accountId
FROM account
WHERE providerId IN ('google', 'github', 'microsoft', 'apple');
```

Note which providers are in use - you'll need to configure them in WorkOS Dashboard.

### Organizations (Optional)

If using Better Auth organization plugin:

```sql
-- Export organizations
SELECT * FROM organization;

-- Export member mappings
SELECT userId, organizationId, role
FROM member;
```

## Step 5: WorkOS Dashboard Configuration

### Enable Authentication

1. Navigate to WorkOS Dashboard → Authentication
2. Enable email/password authentication
3. Configure email verification settings (on/off)

### Configure Social Providers (if needed)

For each provider found in Step 4:

```
Provider in Better Auth?
  |
  +-- Google --> Dashboard → Integrations → Google OAuth
  |              Configure client ID & secret
  |
  +-- Microsoft --> Dashboard → Integrations → Microsoft OAuth
  |                Configure client ID & secret
  |
  +-- GitHub --> Dashboard → Integrations → GitHub OAuth
  |             Configure client ID & secret
```

**Verify:** Test each provider's configuration with "Test Connection" button in Dashboard.

## Step 6: User Migration Script

### Field Mapping

Map Better Auth fields to WorkOS Create User API:

```
Better Auth       --> WorkOS API Parameter
-------------------------------------------
email             --> email
emailVerified     --> email_verified
name              --> first_name (parse first word)
name              --> last_name (parse remaining words)
```

### Migration Script Structure

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function migrateUser(betterAuthUser: any, passwordHash?: string) {
  // Parse name into first/last
  const nameParts = betterAuthUser.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const params = {
    email: betterAuthUser.email,
    email_verified: betterAuthUser.emailVerified || false,
    first_name: firstName,
    last_name: lastName,
  };

  // Add password hash if available
  if (passwordHash) {
    params.password_hash = passwordHash;
    params.password_hash_type = 'scrypt'; // or your custom algorithm
  }

  return await workos.userManagement.createUser(params);
}
```

### Rate Limiting (CRITICAL)

WorkOS API is rate-limited. Check current limits: https://workos.com/docs/reference/rate-limits

**Pattern for batched migration:**

```typescript
async function migrateBatch(users: any[], batchSize = 10, delayMs = 1000) {
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.all(batch.map(user => migrateUser(user)));
    
    // Delay between batches to respect rate limits
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

## Step 7: Password Hash Import

**Decision Tree: Password Hash Algorithm**

```
Better Auth password algorithm?
  |
  +-- scrypt (default) --> Set password_hash_type: 'scrypt'
  |                        Ensure PHC string format
  |
  +-- bcrypt --> Set password_hash_type: 'bcrypt'
  |             Verify format matches WorkOS requirements
  |
  +-- argon2 --> Set password_hash_type: 'argon2'
  |             Check variant (argon2i/argon2id)
  |
  +-- pbkdf2 --> Set password_hash_type: 'pbkdf2'
               Check iteration count and hash function
```

### PHC String Format (scrypt)

Better Auth may store raw scrypt hashes. WorkOS requires PHC format:

```
$scrypt$ln=<cost>,r=<blocksize>,p=<parallelization>$<salt>$<hash>
```

If Better Auth stores raw hashes, convert to PHC format before import.

**Reference:** See https://workos.com/docs/migrate/other-services for PHC parameter requirements.

### Import Pattern

```typescript
// During user creation
await workos.userManagement.createUser({
  email: user.email,
  password_hash: phcFormattedHash,
  password_hash_type: 'scrypt',
  // ... other fields
});

// Or update existing user
await workos.userManagement.updateUser({
  userId: workosUserId,
  password_hash: phcFormattedHash,
  password_hash_type: 'scrypt',
});
```

## Step 8: Social Auth User Linking

Social auth users from Better Auth will auto-link on first sign-in if:

1. Provider is configured in WorkOS Dashboard (from Step 5)
2. Email address matches existing WorkOS user
3. Provider's email is verified (Google, Microsoft auto-verify; others may require verification)

**No explicit migration needed** - users sign in with provider, WorkOS handles linking.

**Email Verification Note:**

- `gmail.com` emails via Google OAuth → No extra verification
- Other providers → May require email verification step
- Check Dashboard → Authentication → Email Verification settings

## Step 9: Organization Migration (Optional)

If using Better Auth organization plugin:

### Create Organizations

```typescript
async function migrateOrganization(betterAuthOrg: any) {
  return await workos.organizations.createOrganization({
    name: betterAuthOrg.name,
    // Map other Better Auth org fields as needed
  });
}
```

### Add Organization Members

```typescript
async function addMember(workosOrgId: string, workosUserId: string, role: string) {
  await workos.userManagement.createOrganizationMembership({
    organization_id: workosOrgId,
    user_id: workosUserId,
    role_slug: role, // Map Better Auth roles to WorkOS role slugs
  });
}
```

**CRITICAL:** Migrate users BEFORE adding them to organizations. User IDs must exist in WorkOS.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check environment variables
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing env vars"

# 3. Test API connectivity
node -e "const {WorkOS} = require('@workos-inc/node'); \
  const w = new WorkOS(process.env.WORKOS_API_KEY); \
  w.userManagement.listUsers().then(() => console.log('PASS: API connected')).catch(e => console.log('FAIL:', e.message))"

# 4. Verify user count matches (adjust SQL for your DB)
# Better Auth count:
psql -d yourdb -c "SELECT COUNT(*) FROM user;"
# Compare with WorkOS Dashboard user count

# 5. Test password login for migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'$WORKOS_CLIENT_ID'","email":"test@example.com","password":"testpass"}'
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** Password hash not in PHC string format.

**Fix:**

1. Check Better Auth password format in database
2. Convert to PHC format: `$scrypt$ln=...,r=...,p=...$salt$hash`
3. Verify parameters match WorkOS requirements (see migration docs)

### "Rate limit exceeded" (429 response)

**Root cause:** Too many API requests without delay.

**Fix:**

1. Reduce batch size (try `batchSize = 5`)
2. Increase delay between batches (try `delayMs = 2000`)
3. Check current rate limits in WorkOS docs
4. Consider running migration during off-peak hours

### "Email already exists" on user creation

**Root cause:** User already migrated or email conflict.

**Fix:**

1. Use `workos.userManagement.listUsers({ email: userEmail })` to check if user exists
2. If exists, use `updateUser` instead of `createUser` for password import
3. Implement idempotency: check before create

### Social auth not auto-linking

**Root cause:** Email mismatch or provider not configured.

**Fix:**

1. Verify provider configured in WorkOS Dashboard → Integrations
2. Check email addresses match exactly between Better Auth and WorkOS
3. Confirm `email_verified: true` on WorkOS user if provider requires it
4. Test provider OAuth flow manually in Dashboard

### "Invalid API key" errors

**Root cause:** API key incorrect or lacks permissions.

**Fix:**

1. Verify key starts with `sk_` (secret key, not client ID)
2. Regenerate key in WorkOS Dashboard → API Keys
3. Confirm key is for correct environment (dev/staging/production)
4. Check key has User Management permissions

### Organization membership fails

**Root cause:** User or organization doesn't exist yet.

**Fix:**

1. Ensure users migrated BEFORE organization memberships
2. Store WorkOS user ID mapping: `{ betterAuthUserId: workosUserId }`
3. Store WorkOS org ID mapping: `{ betterAuthOrgId: workosOrgId }`
4. Use mapped IDs when creating memberships

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit for authentication UI
- `workos-admin-portal` - Set up Admin Portal for organization management
