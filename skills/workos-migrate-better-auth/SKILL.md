---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- generated -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Database Access

Confirm you have read access to Better Auth database tables:
- `user` - Core user information
- `account` - Provider auth data (including password hashes)
- `organization` - Organization data (if using organization plugin)
- `member` - User-to-org mappings with roles

**Verify:** Run test query to ensure database connectivity:
```bash
# Example for PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user;"
```

### WorkOS Environment

Check environment variables exist:
- `WORKOS_API_KEY` - Must start with `sk_`
- `WORKOS_CLIENT_ID` - Must start with `client_`

**Verify:**
```bash
[ -n "$WORKOS_API_KEY" ] && echo "PASS: API key set" || echo "FAIL: API key missing"
[ -n "$WORKOS_CLIENT_ID" ] && echo "PASS: Client ID set" || echo "FAIL: Client ID missing"
```

## Step 3: Export User Data

### Core User Table

Export all users from the `user` table:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt 
FROM user;
```

Save to a structured format (JSON, CSV, or intermediate database).

**Critical:** Record the `id` field - you'll need it to map passwords and organizations.

### Password Hashes

Better Auth stores passwords in the `account` table with `providerId = 'credential'`.

Export password data:

```sql
SELECT userId, password 
FROM account 
WHERE providerId = 'credential';
```

**Verify:** Count matches expected credential users:
```sql
-- This count should match your credential-based users
SELECT COUNT(*) FROM account WHERE providerId = 'credential';
```

### Social Auth Accounts (Optional)

If you have social auth users, export provider mappings:

```sql
SELECT userId, providerId, accountId 
FROM account 
WHERE providerId != 'credential';
```

Common `providerId` values: `'google'`, `'github'`, `'microsoft'`

## Step 4: Password Hash Detection

Better Auth uses **scrypt by default**, but supports custom algorithms.

Check your Better Auth configuration for password hashing:
- Default: `scrypt` (WorkOS compatible)
- Alternative: `bcrypt`, `argon2`, `pbkdf2` (WorkOS compatible)

If custom algorithm used, note the specific parameters (rounds, iterations, etc.)

## Step 5: Convert Password Format (If Needed)

WorkOS requires passwords in **PHC string format**.

### Check Current Format

Examine a sample password hash from your export:

```
PHC format example:
$scrypt$n=16384,r=8,p=1$base64salt$base64hash

Raw format (needs conversion):
base64hashonly
```

### Conversion Decision Tree

```
Password format?
  |
  +-- Already PHC format ($scrypt$...) --> Proceed to Step 6
  |
  +-- Raw hash only --> Convert to PHC format:
        - Extract scrypt parameters from Better Auth config
        - Format as: $scrypt$n=N,r=R,p=P$salt$hash
        - See WebFetch docs for parameter mapping
```

## Step 6: Import Users to WorkOS

### Rate Limiting Strategy

WorkOS APIs have rate limits. For large migrations:
- Batch requests in groups of 100
- Add 100ms delay between batches
- Implement retry logic for 429 responses

### Field Mapping

Map Better Auth fields to WorkOS Create User API:

| Better Auth Field | WorkOS API Parameter |
|-------------------|---------------------|
| `email` | `email` |
| `emailVerified` | `email_verified` |
| `name` | `first_name` |
| `name` | `last_name` |

**Critical:** Better Auth stores full name in single `name` field. You must split it or use same value for both `first_name` and `last_name`.

### Name Splitting Logic

```
Better Auth "name" value --> WorkOS names
  |
  +-- Contains space --> Split on first space
  |     "John Doe" --> first_name: "John", last_name: "Doe"
  |
  +-- No space --> Use full value for both
        "John" --> first_name: "John", last_name: "John"
```

### Import Script Pattern

```javascript
// Pseudo-code for migration script
for (const user of betterAuthUsers) {
  const [firstName, lastName] = splitName(user.name);
  const passwordHash = passwordMap.get(user.id); // From Step 3
  
  await workos.users.create({
    email: user.email,
    email_verified: user.emailVerified,
    first_name: firstName,
    last_name: lastName,
    password_hash: passwordHash, // If exists
    password_hash_type: 'scrypt'
  });
  
  await sleep(10); // Rate limiting
}
```

**Critical:** Include password hash during creation if available. Importing passwords later requires additional API calls.

## Step 7: Configure Social Auth Providers (If Applicable)

If you exported social auth accounts in Step 3, configure providers in WorkOS:

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. For each `providerId` from Better Auth export, configure matching provider
3. Add OAuth client credentials from your provider (Google, Microsoft, GitHub)

**Auto-linking:** WorkOS automatically links social auth sign-ins to existing users by **email address match**.

**Email verification note:** Some providers (like Google with gmail.com) are trusted for email verification. Others may require users to verify email on first WorkOS sign-in.

## Step 8: Migrate Organizations (If Using Plugin)

Skip this step if you're not using Better Auth's organization plugin.

### Export Organization Data

```sql
-- Organizations
SELECT id, name, slug, metadata, createdAt 
FROM organization;

-- Members with roles
SELECT organizationId, userId, role 
FROM member;
```

### Import to WorkOS

Use the [Create Organization API](/reference/organization/create) for each org, then add members using the [Create Organization Membership API](/reference/organization-membership/create).

**Role mapping:** Better Auth roles are freeform. WorkOS has `member` and `admin` roles. Map according to your business logic:
- Better Auth `'owner'` → WorkOS `'admin'`
- Better Auth `'admin'` → WorkOS `'admin'`
- Better Auth `'member'` → WorkOS `'member'`

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify user count matches
echo "Better Auth user count:"
psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM user;"
echo "WorkOS user count (check Dashboard or API)"

# 2. Test credential login with migrated password
# (Manual test in your app's login flow)

# 3. Test social auth login
# (Manual test - should auto-link by email)

# 4. Verify email verified status preserved
# Check user records in WorkOS Dashboard

# 5. If orgs migrated, verify member counts
# Check org membership in WorkOS Dashboard
```

**Do not mark complete until:**
- User counts match (± accounts you intentionally excluded)
- At least 3 test logins succeed (1 password, 2 social if applicable)
- Email verification status preserved for verified users

## Error Recovery

### "Password hash format invalid"

**Root cause:** Password hash not in PHC string format.

**Fix:**
1. Check sample hash from your export - does it start with `$scrypt$`?
2. If not, convert to PHC format: `$scrypt$n=16384,r=8,p=1$salt$hash`
3. Verify scrypt parameters match Better Auth config (default: n=16384, r=8, p=1)
4. Ensure salt and hash are base64 encoded

### "Email already exists"

**Root cause:** Duplicate email in your Better Auth database, or user already exists in WorkOS.

**Fix:**
1. Check for duplicates: `SELECT email, COUNT(*) FROM user GROUP BY email HAVING COUNT(*) > 1;`
2. Decide on merge strategy (keep most recent, manual review, etc.)
3. For pre-existing WorkOS users, use Update User API instead of Create

### "Rate limit exceeded (429)"

**Root cause:** Sending too many requests too quickly.

**Fix:**
1. Implement exponential backoff: wait 1s, then 2s, then 4s, etc.
2. Reduce batch size (try 50 users per batch instead of 100)
3. Increase delay between batches (200ms instead of 100ms)

### Social auth users can't sign in after migration

**Root cause:** Provider not configured in WorkOS, or email mismatch.

**Fix:**
1. Verify provider configured in WorkOS Dashboard → Authentication → Social Connections
2. Check OAuth client ID and secret are correct
3. Verify callback URL matches your app's endpoint
4. Test with a known user's email - does it match exactly (including case)?

### Organization members missing after migration

**Root cause:** Member import failed silently, or user IDs don't match.

**Fix:**
1. Check that you're using WorkOS user IDs (not Better Auth IDs) when creating memberships
2. Store Better Auth ID → WorkOS ID mapping during user import
3. Re-run organization membership import with correct IDs

### Scrypt parameters don't match

**Root cause:** Better Auth configured with non-default scrypt parameters.

**Fix:**
1. Find Better Auth config file (usually `better-auth.config.ts`)
2. Check for custom password hashing config
3. Extract exact parameters: `n` (CPU/memory cost), `r` (block size), `p` (parallelization)
4. Format PHC string with these values: `$scrypt$n=X,r=Y,p=Z$salt$hash`

## Related Skills

- `workos-authkit-nextjs` - For implementing WorkOS auth in Next.js after migration
- `workos-user-management` - For managing migrated users via WorkOS APIs
- `workos-organizations` - For working with migrated organization data
