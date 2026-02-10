---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

This is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Database Access

Confirm you can access Better Auth's database tables:

```bash
# Test database connectivity (adjust for your setup)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"user\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM account WHERE \"providerId\" = 'credential';"
```

If using an ORM, verify you can query the schema:

```bash
# For Prisma
npx prisma studio  # Should show user, account, organization, member tables
```

**Required tables:**
- `user` - Core user data
- `account` - Provider auth data (including password hashes)
- `organization` - Org data (if using organization plugin)
- `member` - User-org mappings (if using organization plugin)

### WorkOS Environment

Check `.env` for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify API key permissions in WorkOS Dashboard:
- Navigate to API Keys section
- Confirm key has "User Management" scope enabled

## Step 3: Export User Data

### Core User Data

Export the `user` table. Choose method based on your setup:

**Option A: Direct SQL Export**

```sql
-- Export to JSON (PostgreSQL)
COPY (SELECT json_agg(t) FROM (SELECT * FROM "user") t) TO '/tmp/users.json';

-- Export to CSV
COPY "user" TO '/tmp/users.csv' WITH CSV HEADER;
```

**Option B: ORM Export (Prisma example)**

```typescript
// scripts/export-users.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const users = await prisma.user.findMany();
fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
```

**Verify export completeness:**

```bash
# Compare counts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"user\";"
jq 'length' users.json  # Should match DB count
```

### Password Hash Export

Export password hashes from the `account` table:

```sql
-- Export credential accounts with password hashes
SELECT 
  "userId",
  password,
  "providerId"
FROM account
WHERE "providerId" = 'credential'
  AND password IS NOT NULL;
```

**Critical:** Better Auth uses `scrypt` by default, but supports custom hash functions. If you configured a custom algorithm, document it now — you'll need it for Step 5.

**Verify hash format:**

```bash
# Check if hashes are in PHC format (start with $scrypt$)
head -1 passwords.json | jq -r '.password'
# Should output: $scrypt$n=16384,r=8,p=1$...$...
```

If hashes are NOT in PHC format, see "Error Recovery: Raw Scrypt Hashes" below.

### Social Auth Accounts Export

If you have social auth users, export their provider linkages:

```sql
SELECT 
  "userId",
  "providerId",
  "providerAccountId"
FROM account
WHERE "providerId" != 'credential';
```

Common `providerId` values: `'google'`, `'github'`, `'microsoft'`, `'apple'`

## Step 4: Map Better Auth Fields to WorkOS

### User Field Mapping

Better Auth has a flat name field. WorkOS separates first/last names. Use this decision tree:

```
Better Auth 'name' field?
  |
  +-- Contains space --> Split on first space: firstName, lastName
  |
  +-- Single word --> Use as firstName, lastName = empty string
  |
  +-- NULL/empty --> firstName = "User", lastName = email prefix
```

**Field mapping table:**

| Better Auth Field | WorkOS Create User API Parameter |
|-------------------|-----------------------------------|
| `email`           | `email`                           |
| `emailVerified`   | `email_verified`                  |
| `name` (split)    | `first_name`                      |
| `name` (split)    | `last_name`                       |

**Transform script pattern:**

```typescript
// Transform Better Auth user to WorkOS format
function mapUser(betterAuthUser) {
  const [firstName, ...lastNameParts] = (betterAuthUser.name || 'User').split(' ');
  return {
    email: betterAuthUser.email,
    email_verified: betterAuthUser.emailVerified,
    first_name: firstName,
    last_name: lastNameParts.join(' ') || betterAuthUser.email.split('@')[0]
  };
}
```

## Step 5: Import Users into WorkOS

### Rate Limit Strategy

WorkOS API is rate-limited. Check current limits:

WebFetch: `https://workos.com/docs/reference/rate-limits`

**Batch import pattern with backoff:**

```typescript
// Example: Batch import with rate limit handling
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // Adjust based on rate limits

async function importUsers(users) {
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(user => 
      workos.userManagement.createUser({
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName
      }).catch(err => {
        console.error(`Failed to import ${user.email}:`, err.message);
        // Log for retry
        fs.appendFileSync('failed.log', `${user.email}\n`);
      })
    ));
    
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
}
```

### Password Hash Import (Decision Tree)

```
Better Auth password algorithm?
  |
  +-- scrypt (default) --> Use password_hash_type: 'scrypt'
  |                        Hash must be in PHC format
  |
  +-- bcrypt           --> Use password_hash_type: 'bcrypt'
  |                        Hash format: $2a$... or $2b$...
  |
  +-- argon2           --> Use password_hash_type: 'argon2'
  |                        Hash must be in PHC format
  |
  +-- pbkdf2           --> Use password_hash_type: 'pbkdf2'
  |                        Hash must be in PHC format
```

**Scrypt import example (Better Auth default):**

```typescript
await workos.userManagement.createUser({
  email: user.email,
  emailVerified: user.emailVerified,
  firstName: user.firstName,
  lastName: user.lastName,
  password_hash: passwordHash, // From account table
  password_hash_type: 'scrypt'
});
```

**Critical:** If hash import fails with "invalid hash format", the hash is likely not in PHC format. See "Error Recovery: PHC Format Conversion" below.

### PHC Format Verification

Scrypt hashes MUST be in PHC string format:

```
$scrypt$n=16384,r=8,p=1$[salt]$[hash]
```

**Verify before import:**

```bash
# Check hash format
echo "$HASH" | grep -E '^\$scrypt\$n=[0-9]+,r=[0-9]+,p=[0-9]+\$'
```

If this fails, your hashes need conversion. See error recovery section.

## Step 6: Configure Social Auth Providers (If Applicable)

If you exported social auth accounts in Step 3, configure those providers in WorkOS.

**For each unique `providerId` in your export:**

1. Navigate to WorkOS Dashboard → Environments → Your Environment → Authentication
2. Select the provider (Google, Microsoft, GitHub, etc.)
3. Add OAuth client credentials

**Provider-specific guides:**

- Google: WebFetch `https://workos.com/docs/integrations/google-oauth`
- Microsoft: WebFetch `https://workos.com/docs/integrations/microsoft-oauth`

**Post-configuration test:**

Create a test user with the provider's auth flow. Verify the sign-in flow completes successfully before considering social auth migration complete.

**Email matching behavior:**

When a social auth user signs in post-migration:
- WorkOS matches by email address to the imported user
- If email is verified by provider (e.g., Gmail domain), no extra verification needed
- If email domain is NOT verified by provider, WorkOS sends verification email

## Step 7: Migrate Organizations (If Using Organization Plugin)

**Check if you use Better Auth organization plugin:**

```bash
# Query organization table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM organization;" 2>/dev/null
```

If table doesn't exist or returns 0, skip to Step 8.

### Export Organization Data

```sql
-- Export organizations
SELECT * FROM organization;

-- Export member mappings
SELECT * FROM member;
```

### Create Organizations in WorkOS

```typescript
// Map Better Auth org to WorkOS
const org = await workos.organizations.createOrganization({
  name: betterAuthOrg.name,
  // Add other fields based on your schema
});
```

### Add Organization Members

```typescript
// After creating org, add members
await workos.organizations.createOrganizationMembership({
  organizationId: org.id,
  userId: workosUserId, // From Step 5 import
  roleSlug: betterAuthMember.role // Map to WorkOS role
});
```

**Role mapping:** Better Auth roles are strings. Map them to WorkOS role slugs (e.g., `'admin'` → `'admin'`, `'member'` → `'member'`).

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Count imported users
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# Compare to source count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"user\";"

# 2. Verify password authentication works
# (Manual test: attempt login with a migrated user's credentials)

# 3. Check for failed imports
test -f failed.log && wc -l failed.log || echo "No failures"

# 4. Verify organizations imported (if applicable)
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# Compare to source count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM organization;"
```

**All counts must match.** If user counts differ, check `failed.log` for errors and retry those users.

## Error Recovery

### API Error: "Invalid hash format"

**Root cause:** Password hash is not in PHC string format.

**Fix for raw scrypt hashes:**

Better Auth may store raw scrypt output. Convert to PHC format:

```typescript
// Example conversion (adjust params to match Better Auth config)
function toPHCFormat(rawHash, salt) {
  // Better Auth default params: n=16384, r=8, p=1
  const params = 'n=16384,r=8,p=1';
  const saltB64 = Buffer.from(salt, 'hex').toString('base64url');
  const hashB64 = Buffer.from(rawHash, 'hex').toString('base64url');
  return `$scrypt$${params}$${saltB64}$${hashB64}`;
}
```

Check Better Auth docs for your configured scrypt parameters if different from defaults.

### API Error: "Email already exists"

**Root cause:** Attempting to create duplicate user (e.g., re-running import script).

**Fix:** Check if user exists before creating:

```typescript
const existingUsers = await workos.userManagement.listUsers({
  email: user.email
});

if (existingUsers.data.length === 0) {
  await workos.userManagement.createUser(user);
} else {
  console.log(`User ${user.email} already exists, skipping`);
}
```

### API Error: "Rate limit exceeded"

**Root cause:** Importing too fast.

**Fix:** Increase `DELAY_MS` in batch import script. Check current rate limits and adjust batch size accordingly.

### Social auth user cannot sign in after migration

**Root cause:** Provider not configured in WorkOS, or email mismatch.

**Fix:**

1. Verify provider is configured in Dashboard (Step 6)
2. Check email address matches between Better Auth export and provider profile
3. Test provider auth flow with a non-migrated test account first

**Email verification note:** If provider does NOT verify emails (custom OAuth apps), users will receive verification email from WorkOS. This is expected behavior.

### Organization member not linking to user

**Root cause:** `userId` mismatch between Better Auth export and WorkOS user ID.

**Fix:** Build a mapping table during user import:

```typescript
const userIdMap = new Map(); // betterAuthId → workosId

// During import:
const workosUser = await workos.userManagement.createUser(user);
userIdMap.set(betterAuthUser.id, workosUser.id);

// Later when creating org memberships:
const workosUserId = userIdMap.get(member.userId);
```

Save this mapping to a file for auditing and retry scenarios.

### Custom password hash algorithm not supported

**Root cause:** Better Auth configured with a hash algorithm WorkOS doesn't support.

**Fix options:**

1. Force password reset for affected users (send password reset emails post-migration)
2. If algorithm is similar to supported one (e.g., custom scrypt params), contact WorkOS support for assistance

Supported algorithms: scrypt, bcrypt, argon2, pbkdf2. Check the fetched docs for exact parameter requirements.

## Related Skills

- workos-authkit-nextjs — Implement AuthKit UI in Next.js after migration
- workos-authkit-react — Implement AuthKit UI in React after migration
- workos-api-authkit — Direct API integration if not using SDK
- workos-api-organization — Advanced organization management post-migration
- workos-mfa — Add MFA to migrated users
- workos-magic-link — Alternative auth method for users without passwords
