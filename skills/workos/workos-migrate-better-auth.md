---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The WorkOS docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Database Access Verification

Better Auth uses multiple tables. Confirm you can access:

- `user` table (core user data)
- `account` table (password hashes, social auth links)
- `organization` table (if using organization plugin)
- `member` table (org membership if using plugin)

**Verify access:**

```bash
# Test database connection (adjust for your DB)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM account WHERE providerId = 'credential';"
```

If queries fail, fix database access before continuing.

### WorkOS Environment Setup

Check `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify SDK installed:**

```bash
# Should return version number
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: Export Better Auth Data

### Export User Table

Query user table and export to JSON:

```sql
-- Export users to JSON file
SELECT json_agg(row_to_json(t))
FROM (
  SELECT id, email, emailVerified, name, createdAt, updatedAt
  FROM "user"
) t;
```

Save output to `users.json`.

### Export Password Hashes

Better Auth stores passwords in `account` table with `providerId = 'credential'`:

```sql
-- Export password hashes
SELECT json_agg(row_to_json(t))
FROM (
  SELECT userId, password
  FROM account
  WHERE providerId = 'credential'
) t;
```

Save output to `passwords.json`.

**Critical:** Better Auth uses `scrypt` by default. If you customized the hashing algorithm, note which algorithm for Step 5.

### Export Social Auth Links (if applicable)

```sql
-- Export social provider accounts
SELECT json_agg(row_to_json(t))
FROM (
  SELECT userId, providerId, providerAccountId
  FROM account
  WHERE providerId != 'credential'
) t;
```

Save output to `social_accounts.json`.

### Export Organizations (if using plugin)

```sql
-- Export organizations
SELECT json_agg(row_to_json(t))
FROM (
  SELECT id, name, slug, createdAt
  FROM organization
) t;

-- Export organization members
SELECT json_agg(row_to_json(t))
FROM (
  SELECT organizationId, userId, role
  FROM member
) t;
```

Save to `organizations.json` and `members.json`.

## Step 4: Import Users to WorkOS

### Rate Limit Strategy

WorkOS Create User API is rate-limited. For large migrations:

```
User count?
  |
  +-- < 100    --> Direct sequential import
  |
  +-- 100-1000 --> Batch of 10 with 1s delay between batches
  |
  +-- 1000+    --> Batch of 10 with 2s delay, log progress every 100
```

Check https://workos.com/docs/reference/rate-limits for current limits.

### Field Mapping

Map Better Auth fields to WorkOS Create User API:

| Better Auth     | WorkOS           | Notes                          |
| --------------- | ---------------- | ------------------------------ |
| `email`         | `email`          | Required                       |
| `emailVerified` | `email_verified` | Boolean                        |
| `name`          | `first_name`     | Split on first space if needed |
| `name`          | `last_name`      | Remainder after first space    |

**Name splitting logic:**

```javascript
const [firstName, ...lastNameParts] = user.name.trim().split(" ");
const lastName = lastNameParts.join(" ") || firstName; // Fallback if no space
```

### Import Script Pattern

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const users = require("./users.json");

async function importUsers() {
  for (const user of users) {
    const [firstName, ...rest] = (user.name || "").trim().split(" ");
    const lastName = rest.join(" ") || firstName;

    try {
      const workosUser = await workos.users.createUser({
        email: user.email,
        email_verified: user.emailVerified || false,
        first_name: firstName,
        last_name: lastName,
      });

      console.log(`Imported: ${user.email} -> ${workosUser.id}`);
      // Store mapping: Better Auth ID -> WorkOS ID
      // You'll need this for password and org imports
    } catch (error) {
      console.error(`Failed to import ${user.email}:`, error.message);
    }

    // Rate limit handling
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
  }
}
```

**Critical:** Save a mapping file of `betterAuthUserId -> workosUserId`. You need this for Steps 5 and 6.

## Step 5: Import Password Hashes

### Password Hash Format (Decision Tree)

Better Auth default is scrypt. Determine your hash algorithm:

```
Hash algorithm?
  |
  +-- scrypt (default)  --> Use password_hash_type: 'scrypt'
  |
  +-- bcrypt            --> Use password_hash_type: 'bcrypt'
  |
  +-- argon2            --> Use password_hash_type: 'argon2'
  |
  +-- pbkdf2            --> Use password_hash_type: 'pbkdf2'
```

### Scrypt Format Requirements

Better Auth scrypt hashes must be in PHC string format:

```
$scrypt$ln=<N>,r=<r>,p=<p>$<salt>$<hash>
```

**If hashes are NOT in PHC format**, convert them:

```javascript
function convertToPhcFormat(rawHash, salt, n = 16384, r = 8, p = 1) {
  const ln = Math.log2(n);
  return `$scrypt$ln=${ln},r=${r},p=${p}$${salt}$${rawHash}`;
}
```

Check fetched docs for exact PHC parameter requirements.

### Import Password Script

```javascript
const passwords = require("./passwords.json");
const userMapping = require("./user_mapping.json"); // betterAuthId -> workosId

async function importPasswords() {
  for (const record of passwords) {
    const workosUserId = userMapping[record.userId];
    if (!workosUserId) {
      console.error(
        `No WorkOS user found for Better Auth ID: ${record.userId}`,
      );
      continue;
    }

    try {
      await workos.users.updateUser({
        userId: workosUserId,
        password_hash: record.password, // Must be PHC format
        password_hash_type: "scrypt", // Or your custom algorithm
      });

      console.log(`Imported password for user: ${workosUserId}`);
    } catch (error) {
      console.error(
        `Failed to import password for ${workosUserId}:`,
        error.message,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

**Verification command:**

```bash
# Test a user can authenticate with their old password
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$WORKOS_CLIENT_ID"'",
    "email": "test@example.com",
    "password": "their_old_password",
    "grant_type": "password"
  }'
```

Should return 200 with user token, not 401.

## Step 6: Configure Social Auth Providers

### Provider Setup (Per Provider)

For each `providerId` found in Step 3's `social_accounts.json`:

```
providerId?
  |
  +-- 'google'    --> Set up Google OAuth integration
  |
  +-- 'github'    --> Set up GitHub OAuth integration
  |
  +-- 'microsoft' --> Set up Microsoft OAuth integration
```

**For each provider:**

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. Enable the provider (e.g., Google)
3. Configure OAuth client ID and secret from provider's console
4. Set redirect URI to your app's callback URL

**Verify setup:**

```bash
# Check provider is enabled via API
curl https://api.workos.com/user_management/authentication_methods \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | select(.type=="oauth")'
```

Should return enabled OAuth providers.

### Email Matching Behavior

When users sign in with social auth after migration:

- WorkOS matches by **email address** to existing user
- If email verified by provider (e.g., Gmail domain via Google), user is auto-linked
- If email NOT verified by provider, user may need to verify email first

**Important:** Users migrated from Better Auth will be automatically linked to their social auth accounts on first sign-in IF the email matches.

## Step 7: Migrate Organizations (if applicable)

### Create Organizations

```javascript
const organizations = require("./organizations.json");
const orgMapping = {}; // betterAuthOrgId -> workosOrgId

async function importOrganizations() {
  for (const org of organizations) {
    try {
      const workosOrg = await workos.organizations.createOrganization({
        name: org.name,
        // slug maps to 'domains' in WorkOS - check docs
      });

      orgMapping[org.id] = workosOrg.id;
      console.log(`Created org: ${org.name} -> ${workosOrg.id}`);
    } catch (error) {
      console.error(`Failed to create org ${org.name}:`, error.message);
    }
  }
}
```

### Add Organization Members

```javascript
const members = require("./members.json");
const userMapping = require("./user_mapping.json");

async function importMembers() {
  for (const member of members) {
    const workosUserId = userMapping[member.userId];
    const workosOrgId = orgMapping[member.organizationId];

    if (!workosUserId || !workosOrgId) {
      console.error(`Missing mapping for member: ${member.userId}`);
      continue;
    }

    try {
      await workos.organizations.createOrganizationMembership({
        organization_id: workosOrgId,
        user_id: workosUserId,
        role_slug: member.role, // May need mapping - check docs
      });

      console.log(`Added member ${workosUserId} to org ${workosOrgId}`);
    } catch (error) {
      console.error(`Failed to add member:`, error.message);
    }
  }
}
```

**Role mapping:** Better Auth roles may differ from WorkOS role slugs. Check fetched docs for valid `role_slug` values.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Verify users imported
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match your Better Auth user count

# 2. Test password authentication
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$WORKOS_CLIENT_ID"'",
    "email": "known_user@example.com",
    "password": "their_old_password",
    "grant_type": "password"
  }' | jq '.access_token'
# Should return valid token, not null

# 3. Verify social auth providers enabled
curl https://api.workos.com/user_management/authentication_methods \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | select(.type=="oauth")'
# Should list configured providers

# 4. Verify organizations (if applicable)
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match your Better Auth org count

# 5. Check email verification status
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | {email, email_verified}'
# Verify email_verified matches Better Auth emailVerified
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** Password hash not in PHC string format.

**Fix:**

1. Check if hash starts with `$scrypt$` (or `$bcrypt$`, etc.)
2. If not, convert using PHC format function from Step 5
3. Verify parameters: ln (log2 of N), r, p match Better Auth config

### "User already exists" during import

**Root cause:** Email already imported (duplicate run or partial failure).

**Fix:**

1. Query existing WorkOS users: `workos.users.listUsers({ email: user.email })`
2. If user exists, skip creation or update existing user
3. Save WorkOS ID to mapping file for password/org import

### "Rate limit exceeded"

**Root cause:** Importing too fast.

**Fix:**

1. Increase delay between API calls (Step 4 default is 100ms)
2. For 429 errors, implement exponential backoff:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### "Unknown password hash type"

**Root cause:** Better Auth using custom hash algorithm not supported by WorkOS.

**Fix:**

1. Check fetched docs for supported `password_hash_type` values
2. If algorithm unsupported, migrate users WITHOUT password hashes
3. Users must reset password on first sign-in via WorkOS password reset flow

### Social auth user not auto-linking after migration

**Root cause:** Email mismatch or email not verified.

**Fix:**

1. Check WorkOS user's `email` exactly matches social provider's email
2. If provider doesn't verify emails, user must verify via WorkOS first
3. Check WorkOS Dashboard → Authentication → Email Verification settings

### Organization role mapping issues

**Root cause:** Better Auth role names don't match WorkOS role slugs.

**Fix:**

1. Check fetched docs for valid WorkOS `role_slug` values (likely `admin`, `member`)
2. Create role mapping dictionary:

```javascript
const roleMap = {
  owner: "admin",
  admin: "admin",
  member: "member",
  // Add other Better Auth roles
};
```

3. Apply mapping in member import: `role_slug: roleMap[member.role] || 'member'`

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
