---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- generated -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The migration guide is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Database Access

Verify you can access Better Auth database tables:

```bash
# Test database connectivity (adjust for your setup)
psql -h localhost -U your_user -d your_db -c "\dt" | grep -E "user|account|organization|member"
```

**Required tables:**
- `user` - Core user data (id, name, email, emailVerified, image, timestamps)
- `account` - Provider auth data including password hashes
- `organization` - Organization data (if using org plugin)
- `member` - User-to-org mappings with roles

### WorkOS Environment

Verify environment variables:

```bash
# Check env vars are set
test -n "$WORKOS_API_KEY" && echo "API key: OK" || echo "FAIL: WORKOS_API_KEY missing"
test -n "$WORKOS_CLIENT_ID" && echo "Client ID: OK" || echo "FAIL: WORKOS_CLIENT_ID missing"

# Validate API key format
echo "$WORKOS_API_KEY" | grep -q "^sk_" && echo "Key format: OK" || echo "FAIL: Key must start with sk_"
```

## Step 3: Export User Data

### Export Users

Run SQL query to extract user table:

```sql
SELECT 
  id,
  email,
  emailVerified,
  name,
  image,
  createdAt,
  updatedAt
FROM user
ORDER BY createdAt;
```

Export to JSON or CSV for processing. Store as `better-auth-users.json`.

**Verification:**

```bash
# Check export file exists and has content
test -f better-auth-users.json && wc -l better-auth-users.json || echo "FAIL: Export file missing"
```

### Export Passwords

Extract password hashes from credential accounts:

```sql
SELECT 
  userId,
  password,
  providerId
FROM account
WHERE providerId = 'credential'
  AND password IS NOT NULL;
```

Export as `better-auth-passwords.json`.

**CRITICAL:** Note the password hashing algorithm. Better Auth defaults to `scrypt`, but may use custom algorithms.

```bash
# Document which algorithm was used
echo "scrypt" > password-algorithm.txt
```

## Step 4: Export Social Auth Accounts (If Applicable)

If users sign in via OAuth providers, extract those mappings:

```sql
SELECT 
  userId,
  providerId,
  accountId,
  email
FROM account
WHERE providerId IN ('google', 'github', 'microsoft', 'facebook')
ORDER BY userId, providerId;
```

Export as `better-auth-social.json`.

## Step 5: Export Organizations (If Using Org Plugin)

```
Using Better Auth organization plugin?
  |
  +-- YES --> Export org data
  |           |
  |           +-- Query organization table
  |           +-- Query member table for user-org-role mappings
  |
  +-- NO  --> Skip to Step 6
```

### Export Organizations

```sql
SELECT 
  id,
  name,
  slug,
  metadata,
  createdAt
FROM organization;
```

Export as `better-auth-orgs.json`.

### Export Members

```sql
SELECT 
  organizationId,
  userId,
  role,
  createdAt
FROM member
ORDER BY organizationId, userId;
```

Export as `better-auth-members.json`.

## Step 6: Create Migration Script

Create `migrate-better-auth.ts` (or `.js`) in your project root.

### Install WorkOS SDK (if not already)

```bash
# Detect package manager
if [ -f "package-lock.json" ]; then
  npm install @workos-inc/node
elif [ -f "yarn.lock" ]; then
  yarn add @workos-inc/node
elif [ -f "pnpm-lock.yaml" ]; then
  pnpm add @workos-inc/node
else
  npm install @workos-inc/node
fi
```

### Migration Script Structure

```typescript
import { WorkOS } from '@workos-inc/node';
import fs from 'fs';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Load exported data
const users = JSON.parse(fs.readFileSync('better-auth-users.json', 'utf-8'));
const passwords = JSON.parse(fs.readFileSync('better-auth-passwords.json', 'utf-8'));

// Rate limiting: WorkOS has API rate limits
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // 1 second between batches

async function migrateUsers() {
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (user) => {
      // Map Better Auth fields to WorkOS
      const [firstName, ...lastNameParts] = (user.name || '').split(' ');
      
      try {
        const workosUser = await workos.userManagement.createUser({
          email: user.email,
          emailVerified: user.emailVerified || false,
          firstName: firstName || '',
          lastName: lastNameParts.join(' ') || '',
        });
        
        console.log(`✓ Migrated: ${user.email}`);
        return workosUser;
      } catch (error) {
        console.error(`✗ Failed: ${user.email}`, error.message);
        // Log to error file for retry
        fs.appendFileSync('migration-errors.log', 
          JSON.stringify({ user, error: error.message }) + '\n'
        );
      }
    }));
    
    // Rate limiting delay
    if (i + BATCH_SIZE < users.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
}

migrateUsers().catch(console.error);
```

**Key mapping (Better Auth → WorkOS):**

| Better Auth Field | WorkOS Field     | Notes                    |
|-------------------|------------------|--------------------------|
| `email`           | `email`          | Direct mapping           |
| `emailVerified`   | `emailVerified`  | Boolean flag             |
| `name`            | `firstName`      | Split on first space     |
| `name`            | `lastName`       | Remainder after split    |
| `image`           | Not mapped       | Store in user metadata   |

## Step 7: Import Passwords

Extend migration script to import password hashes:

```typescript
async function importPasswords(workosUsers: Map<string, string>) {
  // workosUsers: Map of email -> WorkOS user ID
  
  for (const pwdRecord of passwords) {
    const betterAuthUser = users.find(u => u.id === pwdRecord.userId);
    if (!betterAuthUser) continue;
    
    const workosUserId = workosUsers.get(betterAuthUser.email);
    if (!workosUserId) continue;
    
    try {
      await workos.userManagement.updateUser({
        userId: workosUserId,
        passwordHash: pwdRecord.password,
        passwordHashType: 'scrypt', // or check password-algorithm.txt
      });
      
      console.log(`✓ Password imported: ${betterAuthUser.email}`);
    } catch (error) {
      console.error(`✗ Password failed: ${betterAuthUser.email}`, error.message);
    }
  }
}
```

**Password hash format:** Better Auth uses PHC string format for scrypt by default. WorkOS expects:

```
$scrypt$ln=16,r=8,p=1$<salt>$<hash>
```

If Better Auth stores raw scrypt hashes (not PHC format), you must convert them:

```typescript
function convertToPhc(rawHash: string, salt: string): string {
  // PHC format: $scrypt$ln=16,r=8,p=1$<base64-salt>$<base64-hash>
  const saltB64 = Buffer.from(salt).toString('base64');
  const hashB64 = Buffer.from(rawHash).toString('base64');
  return `$scrypt$ln=16,r=8,p=1$${saltB64}$${hashB64}`;
}
```

Check WorkOS docs for exact PHC parameter requirements for scrypt.

## Step 8: Configure Social Auth Providers (If Applicable)

```
Exported social auth accounts?
  |
  +-- YES --> Configure OAuth providers in WorkOS
  |           |
  |           +-- Go to WorkOS Dashboard → Authentication → Social Connections
  |           +-- Enable relevant providers (Google, GitHub, Microsoft, etc.)
  |           +-- Add client ID/secret for each provider
  |
  +-- NO  --> Skip to Step 9
```

**Provider-specific notes:**

- **Google**: Users with `@gmail.com` won't need email verification
- **Microsoft**: Configure tenant ID if restricting to specific org
- **GitHub**: Users will auto-link by email on first sign-in

**Auto-linking behavior:** When a user signs in via social auth, WorkOS matches by email address. If a user with that email exists (from migration), they're automatically linked.

**Email verification caveat:** Users may need to verify email if:
- Provider doesn't guarantee email verification
- Email domain doesn't match provider (e.g., Google account with non-gmail.com email)

## Step 9: Migrate Organizations (If Applicable)

Create separate script or extend existing:

```typescript
async function migrateOrganizations() {
  const orgs = JSON.parse(fs.readFileSync('better-auth-orgs.json', 'utf-8'));
  const members = JSON.parse(fs.readFileSync('better-auth-members.json', 'utf-8'));
  
  const orgMap = new Map<string, string>(); // Better Auth org ID → WorkOS org ID
  
  // Create organizations
  for (const org of orgs) {
    try {
      const workosOrg = await workos.organizations.createOrganization({
        name: org.name,
        domains: [], // Add domains if applicable
      });
      
      orgMap.set(org.id, workosOrg.id);
      console.log(`✓ Created org: ${org.name}`);
    } catch (error) {
      console.error(`✗ Org failed: ${org.name}`, error.message);
    }
  }
  
  // Add members with roles
  for (const member of members) {
    const workosOrgId = orgMap.get(member.organizationId);
    if (!workosOrgId) continue;
    
    const betterAuthUser = users.find(u => u.id === member.userId);
    if (!betterAuthUser) continue;
    
    const workosUserId = workosUsers.get(betterAuthUser.email);
    if (!workosUserId) continue;
    
    try {
      await workos.userManagement.createOrganizationMembership({
        organizationId: workosOrgId,
        userId: workosUserId,
        roleSlug: mapRole(member.role), // Map Better Auth role to WorkOS role
      });
      
      console.log(`✓ Added member: ${betterAuthUser.email} to ${member.organizationId}`);
    } catch (error) {
      console.error(`✗ Member add failed:`, error.message);
    }
  }
}

function mapRole(betterAuthRole: string): string {
  // Map Better Auth roles to WorkOS role slugs
  const roleMap: Record<string, string> = {
    'owner': 'admin',
    'admin': 'admin',
    'member': 'member',
    // Add more mappings as needed
  };
  return roleMap[betterAuthRole] || 'member';
}
```

**Role mapping notes:**

- WorkOS has predefined roles: `admin`, `member`
- Custom roles must be created in WorkOS Dashboard first
- Check Better Auth role schema and map accordingly

## Step 10: Run Migration

Execute migration with monitoring:

```bash
# Dry run first (modify script to skip actual API calls)
DRY_RUN=true node migrate-better-auth.ts

# Run actual migration
node migrate-better-auth.ts 2>&1 | tee migration.log

# Check for errors
grep "✗" migration.log | wc -l
```

**Monitor rate limits:**

```bash
# If you hit rate limits, increase DELAY_MS or decrease BATCH_SIZE
# Check migration-errors.log for failed records
test -f migration-errors.log && echo "Errors found - review migration-errors.log" || echo "Clean migration"
```

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Check user count matches
echo "Better Auth users:" && wc -l < better-auth-users.json
echo "Check WorkOS Dashboard user count matches"

# 2. Test password login (use WorkOS test user endpoint or dashboard)
# Verify at least one migrated user can sign in with their Better Auth password

# 3. Test social auth (if applicable)
# Sign in with OAuth provider and verify auto-linking works

# 4. Check organizations (if applicable)
echo "Better Auth orgs:" && wc -l < better-auth-orgs.json
echo "Check WorkOS Dashboard org count matches"

# 5. Verify no critical errors
grep "✗" migration.log | head -20
test ! -s migration-errors.log && echo "No errors" || echo "Review migration-errors.log"
```

**Manual verification steps:**

1. Go to WorkOS Dashboard → User Management → Users
2. Spot-check 5-10 migrated users - verify email, name fields
3. Attempt sign-in with migrated credentials (test account)
4. If using social auth, test OAuth flow with previously linked account
5. If using orgs, verify org structure and member roles in Dashboard

## Error Recovery

### "Rate limit exceeded"

**Cause:** Too many API requests in short time window.

**Fix:**
1. Check WorkOS rate limits: https://workos.com/docs/reference/rate-limits
2. Increase `DELAY_MS` in migration script (e.g., from 1000 to 2000)
3. Decrease `BATCH_SIZE` (e.g., from 10 to 5)
4. Re-run migration for failed records only (parse `migration-errors.log`)

### "Invalid password hash format"

**Cause:** Better Auth password hash not in PHC format, or using non-scrypt algorithm.

**Fix:**
1. Check `password-algorithm.txt` - confirm algorithm matches WorkOS supported types
2. If raw hash (not PHC), implement conversion function (see Step 7)
3. For non-scrypt algorithms, check WorkOS docs for PHC parameter requirements
4. Test with single user before batch import

### "Email already exists"

**Cause:** User already exists in WorkOS (duplicate migration or existing user).

**Fix:**
1. Check WorkOS Dashboard - user may already exist
2. Use `updateUser` instead of `createUser` if intentionally overwriting
3. Skip duplicates in migration script:

```typescript
try {
  await workos.userManagement.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    console.log(`⊙ Skipped duplicate: ${user.email}`);
  } else {
    throw error;
  }
}
```

### "User not found" during password import

**Cause:** User creation failed but password import attempted, or email mismatch.

**Fix:**
1. Check `migration.log` for user creation failures
2. Retry failed user creations before importing passwords
3. Verify email matching logic between user and password exports
4. Ensure `workosUsers` map is populated before password import

### Social auth auto-linking not working

**Cause:** Email mismatch, email not verified, or provider not configured.

**Fix:**
1. Verify OAuth provider configured in WorkOS Dashboard
2. Check `emailVerified` flag was set to `true` during migration
3. Verify email from OAuth provider matches migrated user email exactly
4
