---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Database Access

Better Auth uses multiple tables. Confirm you can access:

- `user` table - core user data
- `account` table - provider auth data and password hashes
- `organization` table - if using organization plugin
- `member` table - if using organization plugin

**Verify database access:**

```bash
# Example for PostgreSQL - adjust for your database
psql -h <host> -U <user> -d <database> -c "SELECT COUNT(*) FROM user;"
```

### WorkOS Environment

Check `.env` or environment variables for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify SDK installed:**

```bash
grep -E '"@workos-inc/node"|"workos"' package.json
```

If SDK not installed, install it before proceeding.

## Step 3: Export Better Auth Data

### Export Users

Query the `user` table for core user information:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

Export to JSON or CSV format that your migration script can consume.

### Export Password Hashes

Better Auth stores credential-based auth in the `account` table:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**CRITICAL:** Note the password hashing algorithm. Better Auth defaults to `scrypt`, but supports custom algorithms. If you configured a custom algorithm, document it now - you'll need it for Step 5.

### Export Social Auth Accounts (If Applicable)

If you have social auth users, export their provider mappings:

```sql
SELECT userId, providerId, accountId
FROM account
WHERE providerId != 'credential';
```

Common `providerId` values: `'google'`, `'github'`, `'microsoft'`, `'apple'`

### Export Organizations (If Using Organization Plugin)

```sql
-- Organizations
SELECT id, name, slug, metadata, createdAt
FROM organization;

-- Organization members
SELECT userId, organizationId, role
FROM member;
```

**Verification:** Confirm exported files exist and contain expected row counts before proceeding.

## Step 4: Create Migration Script

Create a migration script (Node.js example):

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const users = JSON.parse(fs.readFileSync('users.json'));

// Rate limiting: WorkOS APIs have rate limits
// See https://workos.com/docs/reference/rate-limits
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // 1 second between batches

async function migrateUsers() {
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(createUser));
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
}
```

## Step 5: Import Users into WorkOS

### User Data Mapping

Map Better Auth user fields to WorkOS Create User API:

```
Better Auth          WorkOS API Parameter
--------------------------------------------
email           →    email
emailVerified   →    email_verified
name            →    first_name (split on space for full name)
name            →    last_name (split on space for full name)
```

**Name splitting logic:**

```javascript
function splitName(fullName) {
  const parts = (fullName || '').trim().split(' ');
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}
```

### Import Without Passwords (Initial)

Create users first, then add passwords separately:

```javascript
async function createUser(betterAuthUser) {
  const { firstName, lastName } = splitName(betterAuthUser.name);
  
  try {
    const user = await workos.userManagement.createUser({
      email: betterAuthUser.email,
      firstName,
      lastName,
      emailVerified: betterAuthUser.emailVerified
    });
    
    console.log(`Created user: ${user.id} (${user.email})`);
    return user;
  } catch (error) {
    console.error(`Failed to create user ${betterAuthUser.email}:`, error.message);
    // Log for retry
    return null;
  }
}
```

### Import Password Hashes

Better Auth defaults to `scrypt`. WorkOS supports this with PHC string format.

**Decision tree for password hash format:**

```
Better Auth password algorithm?
  |
  +-- scrypt (default) --> Use password_hash_type: 'scrypt'
  |                        Ensure hash is in PHC format
  |
  +-- bcrypt            --> Use password_hash_type: 'bcrypt'
  |
  +-- argon2            --> Use password_hash_type: 'argon2'
  |
  +-- pbkdf2            --> Use password_hash_type: 'pbkdf2'
```

**PHC format requirement:** Password hashes must be in PHC string format. Better Auth typically stores them this way by default. If you see raw hashes, you'll need to convert them.

PHC format example: `$scrypt$n=16384,r=8,p=1$<salt>$<hash>`

**Import password hashes:**

```javascript
async function importPassword(workosUserId, betterAuthPasswordHash) {
  try {
    await workos.userManagement.updateUser({
      userId: workosUserId,
      passwordHash: betterAuthPasswordHash,
      passwordHashType: 'scrypt' // Or your algorithm
    });
    console.log(`Imported password for user: ${workosUserId}`);
  } catch (error) {
    console.error(`Failed to import password for ${workosUserId}:`, error.message);
  }
}
```

**CRITICAL:** If the hash is not in PHC format or WorkOS rejects it, check the migration guide for PHC format requirements: WebFetch `https://workos.com/docs/migrate/other-services/2-importing-users-into-workos/importing-passwords`

## Step 6: Configure Social Auth Providers (If Applicable)

If you exported social auth accounts in Step 3, configure those providers in WorkOS before users attempt to sign in.

**Provider configuration locations:**

- Google OAuth: WebFetch `https://workos.com/docs/integrations/google-oauth`
- Microsoft OAuth: WebFetch `https://workos.com/docs/integrations/microsoft-oauth`
- GitHub: Check WorkOS integrations page
- Apple: Check WorkOS integrations page

**Post-configuration behavior:**

When a user signs in with a social provider, WorkOS matches by email address:
- If email is verified by provider (e.g., `@gmail.com` via Google), user is automatically linked
- If email is not verified by provider, user may need to verify email if email verification is enabled

**No additional API calls needed** - social auth linking happens automatically on first sign-in after provider configuration.

## Step 7: Migrate Organizations (If Using Organization Plugin)

### Create Organizations

```javascript
async function createOrganization(betterAuthOrg) {
  try {
    const org = await workos.organizations.createOrganization({
      name: betterAuthOrg.name,
      // WorkOS generates slug automatically, or you can pass your own
      domainData: [] // Add domains if applicable
    });
    
    console.log(`Created organization: ${org.id} (${org.name})`);
    return org;
  } catch (error) {
    console.error(`Failed to create org ${betterAuthOrg.name}:`, error.message);
    return null;
  }
}
```

### Add Organization Members

After organizations are created, add members:

```javascript
async function addOrgMember(workosOrgId, workosUserId, role) {
  try {
    await workos.userManagement.createOrganizationMembership({
      organizationId: workosOrgId,
      userId: workosUserId,
      roleSlug: role // Map Better Auth roles to WorkOS role slugs
    });
    
    console.log(`Added user ${workosUserId} to org ${workosOrgId}`);
  } catch (error) {
    console.error(`Failed to add member:`, error.message);
  }
}
```

**Role mapping:** Map Better Auth role names to WorkOS role slugs. You may need to create custom roles in WorkOS Dashboard first.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify user count matches
# Compare row count from Better Auth export to WorkOS Dashboard user count

# 2. Test credential-based login
# Attempt login with a migrated user's email/password

# 3. Test social auth login (if applicable)
# Attempt login with social provider for a user who had that provider in Better Auth

# 4. Verify organizations created (if applicable)
# Check WorkOS Dashboard for organization count matching export

# 5. Verify organization memberships (if applicable)
# Check a sample organization has correct members and roles

# 6. Check migration script logs for errors
grep -i "error\|failed" migration.log

# 7. Verify WorkOS API calls succeeded
# Check for HTTP 200/201 responses in logs, not 4xx/5xx
```

**Critical verification:** Do NOT consider migration complete until login tests pass for both credential and social auth users.

## Error Recovery

### "Invalid password hash format"

**Cause:** Password hash is not in PHC string format or uses unsupported algorithm.

**Fix:**

1. Check the hash format - should start with `$<algorithm>$`
2. Verify algorithm is `scrypt`, `bcrypt`, `argon2`, or `pbkdf2`
3. If raw hash, convert to PHC format (see migration guide)
4. If custom algorithm, it may not be supported - contact WorkOS support

### "Rate limit exceeded"

**Cause:** Too many API requests in short time.

**Fix:**

1. Reduce `BATCH_SIZE` in migration script
2. Increase `DELAY_MS` between batches
3. Check rate limits: WebFetch `https://workos.com/docs/reference/rate-limits`

### "User already exists"

**Cause:** Attempting to create duplicate user (same email).

**Fix:**

1. Check if partial migration ran before
2. Add duplicate detection to script:

```javascript
const { users } = await workos.userManagement.listUsers({ email: betterAuthUser.email });
if (users.length > 0) {
  console.log(`User ${betterAuthUser.email} already exists, skipping`);
  return users[0];
}
```

### "Email not verified" after social auth

**Cause:** Provider doesn't verify email, and email verification is enabled in WorkOS.

**Fix:**

1. User must verify email via WorkOS verification flow
2. Or, if provider is trusted, manually mark email as verified:

```javascript
await workos.userManagement.updateUser({
  userId: workosUserId,
  emailVerified: true
});
```

### Social auth user not linking automatically

**Cause:** Email mismatch between Better Auth and provider, or provider not configured.

**Fix:**

1. Verify provider is configured in WorkOS Dashboard
2. Check email address matches between Better Auth export and provider profile
3. If email differs, user must re-authenticate to create new account

### Organization membership creation fails

**Cause:** Role slug doesn't exist in WorkOS, or user/org not created yet.

**Fix:**

1. Create custom roles in WorkOS Dashboard first
2. Verify user and organization were created successfully before adding membership
3. Check role slug matches exactly (case-sensitive)

### "Invalid API key"

**Cause:** API key is wrong, expired, or lacks permissions.

**Fix:**

1. Verify key starts with `sk_`
2. Check key is from correct WorkOS environment (test vs. production)
3. Regenerate key in WorkOS Dashboard if needed

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit after migration
- workos-api-organization - Advanced organization management
- workos-rbac - Role-based access control setup
