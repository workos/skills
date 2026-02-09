---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- generated -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The WorkOS docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Database Access

Verify you can query the Better Auth database. Better Auth uses these tables:

- `user` - Core user data (id, name, email, emailVerified, image, timestamps)
- `account` - Provider-specific auth data, including password hashes
- `organization` - Organizations (if using organization plugin)
- `member` - User-to-organization mappings with roles

**Test query:**
```bash
# Replace with your actual DB connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user;"
```

If query fails, stop here and resolve database access.

### WorkOS SDK

Confirm WorkOS SDK is installed:

```bash
# Node.js
test -d node_modules/@workos-inc/node && echo "PASS" || echo "FAIL: Install @workos-inc/node"

# Python
python -c "import workos" 2>/dev/null && echo "PASS" || echo "FAIL: Install workos"
```

Install if needed before proceeding.

## Step 3: Export User Data

### Export Core User Table

Query the `user` table and export to JSON or CSV:

```sql
-- Export all users
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

**Save output** to `better-auth-users.json` or equivalent. This is your migration source.

### Export Password Hashes

Better Auth stores passwords in the `account` table with `providerId = 'credential'`:

```sql
-- Export password hashes
SELECT 
  userId,
  password
FROM account
WHERE providerId = 'credential';
```

**Save output** to `better-auth-passwords.json`.

**CRITICAL:** Better Auth uses **scrypt** by default. If you configured a custom hash algorithm, note it now. Supported by WorkOS:
- scrypt (default)
- bcrypt
- argon2
- pbkdf2

### Export Social Auth Accounts (Optional)

If users sign in with Google, GitHub, Microsoft, etc.:

```sql
-- Export social provider accounts
SELECT 
  userId,
  providerId,
  accountId
FROM account
WHERE providerId != 'credential';
```

**Save output** to `better-auth-social.json`.

## Step 4: Map Better Auth Schema to WorkOS

Use this mapping for the Create User API:

```
Better Auth Field   -->  WorkOS API Parameter
==================       ===================
email               -->  email
emailVerified       -->  email_verified
name                -->  first_name (extract first word)
name                -->  last_name (extract remaining words)
id                  -->  Store as external reference
```

**Name splitting logic:**

```javascript
// Split "John Doe" into first/last
const [firstName, ...lastNameParts] = name.split(' ');
const lastName = lastNameParts.join(' ') || '';
```

## Step 5: Import Users into WorkOS

### Decision Tree: Batching Strategy

```
User count?
  |
  +-- < 100 users    --> Sequential import (no batching needed)
  |
  +-- 100-1000 users --> Batch of 10 with 500ms delay
  |
  +-- 1000+ users    --> Batch of 10 with 1s delay + progress tracking
```

**Rate limits:** WorkOS allows 600 requests/minute for User Management APIs. At 10 users/second with 1s delays between batches, you'll stay under limits.

### Import Script Pattern (Node.js)

```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(betterAuthUser, passwordHash) {
  const [firstName, ...lastNameParts] = (betterAuthUser.name || '').split(' ');
  
  const userData = {
    email: betterAuthUser.email,
    email_verified: betterAuthUser.emailVerified || false,
    first_name: firstName || betterAuthUser.email.split('@')[0],
    last_name: lastNameParts.join(' ') || '',
  };

  // Add password hash if exists
  if (passwordHash) {
    userData.password_hash = passwordHash;
    userData.password_hash_type = 'scrypt'; // or your custom algorithm
  }

  return await workos.userManagement.createUser(userData);
}
```

**CRITICAL:** The `password_hash` must be in PHC string format. Better Auth stores scrypt hashes in PHC format by default. If you see raw base64 strings, you need to convert them (see Error Recovery).

### Import Script Pattern (Python)

```python
from workos import WorkOSClient
import os

workos = WorkOSClient(api_key=os.environ['WORKOS_API_KEY'])

def import_user(better_auth_user, password_hash=None):
    name_parts = (better_auth_user.get('name') or '').split(' ', 1)
    first_name = name_parts[0] if name_parts else better_auth_user['email'].split('@')[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    user_data = {
        'email': better_auth_user['email'],
        'email_verified': better_auth_user.get('emailVerified', False),
        'first_name': first_name,
        'last_name': last_name,
    }
    
    if password_hash:
        user_data['password_hash'] = password_hash
        user_data['password_hash_type'] = 'scrypt'
    
    return workos.user_management.create_user(**user_data)
```

### Execute Migration

Run your import script with batching:

```bash
# Node.js
node migrate-users.js

# Python
python migrate_users.py
```

**Monitor output** for errors. Log WorkOS user IDs alongside Better Auth IDs for rollback capability.

## Step 6: Configure Social Auth Providers (If Needed)

If you exported social accounts from `account` table, configure providers in WorkOS:

### Provider Configuration

```
Better Auth providerId  -->  WorkOS Integration
======================      ===================
google                  -->  Google OAuth
github                  -->  GitHub OAuth
microsoft               -->  Microsoft OAuth
```

1. Go to WorkOS Dashboard → Integrations
2. Enable each provider used in your Better Auth export
3. Configure OAuth client credentials from provider's console
4. Set redirect URI to your WorkOS callback endpoint

**Auto-linking:** When users sign in with social providers, WorkOS auto-links by email address. No additional import needed for social accounts.

**Email verification note:** Users from verified providers (gmail.com via Google OAuth) skip extra verification. Other domains may require verification if your environment has email verification enabled.

## Step 7: Migrate Organizations (Optional)

Skip this if you didn't use Better Auth's organization plugin.

### Export Better Auth Organizations

```sql
-- Export organizations
SELECT 
  id,
  name,
  slug,
  metadata,
  createdAt
FROM organization;

-- Export organization members
SELECT 
  org.id AS orgId,
  org.name AS orgName,
  m.userId,
  m.role,
  u.email
FROM member m
JOIN organization org ON m.organizationId = org.id
JOIN user u ON m.userId = u.id;
```

### Create Organizations in WorkOS

```javascript
// Create organization
const org = await workos.organizations.createOrganization({
  name: betterAuthOrg.name,
  // Optional: Store Better Auth slug in metadata
  domains: [], // Add if you have domain data
});

// Add members
for (const member of orgMembers) {
  await workos.userManagement.createOrganizationMembership({
    organization_id: org.id,
    user_id: workosUserIdMap[member.userId], // From Step 5 import
    role_slug: member.role, // Map Better Auth roles to WorkOS roles
  });
}
```

**Role mapping:** Better Auth roles (owner, admin, member) should map to WorkOS role slugs. Define these in WorkOS Dashboard → Roles before importing.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Check user count matches
echo "Better Auth users:"
psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM user;"
echo "WorkOS users (check dashboard or API):"
# Use WorkOS API or Dashboard to verify count

# 2. Test password login for migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -u "$WORKOS_API_KEY:" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$WORKOS_CLIENT_ID'",
    "client_secret": "'$WORKOS_API_KEY'",
    "email": "test@example.com",
    "password": "test-password"
  }'
# Should return 200 with access token

# 3. Test social auth (if configured)
# Attempt sign-in flow through your app with Google/GitHub/etc.
# Verify auto-linking by email works

# 4. Verify email_verified status preserved
# Check a few users in WorkOS Dashboard - verified status should match Better Auth

# 5. Check organization memberships (if migrated)
# Verify member count per org matches Better Auth
```

**If any check fails:** Do not proceed to production. Review error logs from import script.

## Error Recovery

### "Invalid password hash format"

**Root cause:** WorkOS expects PHC string format. Better Auth scrypt hashes should already be PHC, but check format.

**PHC format for scrypt:**
```
$scrypt$n=16384,r=8,p=1$<salt>$<hash>
```

**Fix:** If you see raw base64 strings, convert to PHC:

```javascript
function toPHC(rawHash, salt, n = 16384, r = 8, p = 1) {
  return `$scrypt$n=${n},r=${r},p=${p}$${salt}$${rawHash}`;
}
```

Check Better Auth source code for exact scrypt parameters if defaults fail.

### "Email already exists"

**Root cause:** User already imported, or email collision with existing WorkOS user.

**Fix:**

1. Check if user exists first:
```javascript
const existingUser = await workos.userManagement.listUsers({
  email: betterAuthUser.email
});
if (existingUser.data.length > 0) {
  // Skip or update instead of create
}
```

2. Use Update User API instead of Create:
```javascript
await workos.userManagement.updateUser(existingUser.data[0].id, {
  first_name: firstName,
  last_name: lastName,
});
```

### "Rate limit exceeded"

**Root cause:** Importing too fast (>600 requests/minute).

**Fix:** Increase batch delays:

```javascript
// Add delay between batches
await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
```

For very large migrations (10,000+ users), consider splitting into multiple runs or contact WorkOS support for temporary rate limit increase.

### Social auth users can't sign in

**Root cause:** Provider not configured in WorkOS, or OAuth client credentials incorrect.

**Fix:**

1. Verify provider enabled in Dashboard → Integrations
2. Check OAuth client ID/secret match provider's console
3. Verify redirect URI matches WorkOS callback endpoint
4. Test OAuth flow manually - check browser console for errors

**Common issue:** Redirect URI mismatch. WorkOS requires exact match including protocol and trailing slash.

### Organization members not linking

**Root cause:** WorkOS user IDs don't match Better Auth userId mapping.

**Fix:** During Step 5 import, maintain a mapping file:

```json
{
  "better-auth-user-id-1": "workos-user-id-abc",
  "better-auth-user-id-2": "workos-user-id-def"
}
```

Use this mapping when creating organization memberships in Step 7.

### Email verification status not preserved

**Root cause:** `emailVerified` field not passed during user creation.

**Fix:** Update users after import:

```javascript
await workos.userManagement.updateUser(workosUserId, {
  email_verified: true
});
```

**Prevention:** Ensure `email_verified: betterAuthUser.emailVerified` in create payload.

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit after migration
- `workos-directory-sync` - Set up SCIM directory sync post-migration
