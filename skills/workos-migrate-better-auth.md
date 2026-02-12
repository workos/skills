---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

This is the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Database Access

Confirm you have:

- Direct database access OR ORM setup (e.g., Prisma)
- Credentials to query Better Auth database
- Export permissions for tables: `user`, `account`, `organization`, `member`

**Verify database schema:**

```bash
# Example for PostgreSQL - adjust for your database
psql -d your_db -c "\d user" 2>/dev/null | grep -E "id|email|name" || echo "FAIL: Cannot access Better Auth user table"
```

## Step 3: Determine Migration Scope (Decision Tree)

```
What are you migrating?
  |
  +-- Users only
  |     |
  |     +-- Password auth? --> Export user + account tables
  |     |
  |     +-- Social auth only? --> Export user table only
  |
  +-- Users + Organizations
        |
        +-- Export user, account, organization, member tables
```

**Record your scope before continuing.** This determines which tables to export.

## Step 4: Export User Data

### Core User Data (REQUIRED)

Export from `user` table:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

Save as JSON or CSV. **Field mapping for WorkOS:**

| Better Auth Field | WorkOS API Parameter                                |
| ----------------- | --------------------------------------------------- |
| `email`           | `email`                                             |
| `emailVerified`   | `email_verified`                                    |
| `name`            | `first_name` (full name)                            |
| `name`            | `last_name` (leave empty or split programmatically) |

**Note:** Better Auth stores full name in single `name` field. WorkOS has separate `first_name`/`last_name`. Decide split strategy:

- Option A: Put full name in `first_name`, leave `last_name` empty
- Option B: Split on first space: "John Doe" → first="John", last="Doe"
- Option C: Leave both empty, let users update profiles

### Password Data (IF USING PASSWORD AUTH)

Export from `account` table:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**Critical:** Better Auth defaults to `scrypt` hashing. If you configured a custom hash algorithm, note it now.

**Verify hash format:**

```bash
# Check if hashes are PHC format (start with $scrypt$)
head -1 accounts_export.csv | grep '\$scrypt\$' && echo "PHC format - ready for import" || echo "WARN: May need PHC conversion"
```

If hashes are NOT in PHC format, you must convert them. See Step 6 for conversion.

## Step 5: Export Organizations (IF APPLICABLE)

Skip this step if not using Better Auth organization plugin.

### Organization Data

```sql
SELECT id, name, slug, logo, createdAt, metadata
FROM organization;
```

### Membership Data

```sql
SELECT organizationId, userId, role, createdAt
FROM member;
```

**WorkOS mapping:**
| Better Auth | WorkOS |
|-------------|--------|
| `organization.name` | Organization `name` |
| `member.role` | OrganizationMembership `role` |

## Step 6: Password Hash Conversion (IF NEEDED)

Better Auth's default scrypt format is compatible with WorkOS IF stored as PHC string.

**PHC format structure:**

```
$scrypt$n=16384,r=8,p=1$<salt>$<hash>
```

**Parameters from Better Auth defaults:**

- `n=16384` (CPU/memory cost)
- `r=8` (block size)
- `p=1` (parallelization)

**If your hashes are raw binary or non-PHC:**

1. Extract salt and hash components
2. Base64 encode both
3. Format as: `$scrypt$n=16384,r=8,p=1$<base64_salt>$<base64_hash>`

**If using custom algorithm:**

Check fetched docs for supported types:

- `bcrypt` - Supported
- `argon2` - Supported (specify variant: argon2i, argon2d, argon2id)
- `pbkdf2` - Supported

Format hashes according to each algorithm's PHC requirements (see fetched docs).

## Step 7: Create Migration Script

**Script structure:**

```javascript
// Pseudocode - adapt to your language/SDK
const WorkOS = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Rate limiting: WorkOS API has limits - check fetched docs
const BATCH_SIZE = 100;
const DELAY_MS = 1000; // Adjust based on rate limits

async function migrateUsers(users, passwords) {
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    for (const user of batch) {
      const passwordData = passwords.find((p) => p.userId === user.id);

      try {
        await workos.userManagement.createUser({
          email: user.email,
          email_verified: user.emailVerified,
          first_name: user.name, // Or your split logic
          password_hash: passwordData?.password,
          password_hash_type: "scrypt", // Or your algorithm
        });

        console.log(`Migrated: ${user.email}`);
      } catch (error) {
        console.error(`Failed: ${user.email}`, error.message);
        // Log for retry
      }
    }

    // Rate limit delay
    await sleep(DELAY_MS);
  }
}
```

**CRITICAL:** The WebFetched docs contain the exact rate limits and API method signatures. Use those instead of assumptions.

## Step 8: Create Organizations (IF APPLICABLE)

**Decision: Organizations before or after users?**

```
Do memberships reference existing users?
  |
  +-- Yes --> Migrate users FIRST (Step 7), then orgs (Step 8)
  |
  +-- No --> Can migrate in any order
```

**Create organizations:**

```javascript
// Check fetched docs for exact method signature
const org = await workos.organizations.createOrganization({
  name: betterAuthOrg.name,
  // Add other fields from fetched docs
});
```

**Add members:**

```javascript
// Check fetched docs for exact method signature
await workos.organizationMemberships.createOrganizationMembership({
  organization_id: org.id,
  user_id: migratedUserId,
  role: betterAuthMember.role,
});
```

## Step 9: Handle Social Auth Users

**Important:** Social auth users (Google, Microsoft, etc.) do NOT need password hashes.

### Provider Configuration (REQUIRED)

Before users can sign in with social providers:

1. Go to WorkOS Dashboard → Integrations
2. Configure each provider you used in Better Auth:
   - Google: See https://workos.com/docs/integrations/google-oauth
   - Microsoft: See https://workos.com/docs/integrations/microsoft-oauth
   - GitHub: Check integrations page for setup

**How social auth linking works:**

1. User signs in via provider (e.g., Google)
2. WorkOS receives email from provider
3. WorkOS matches email to existing user automatically
4. User is logged in - no migration script needed

**Email verification caveat:**

Check fetched docs for provider-specific verification behavior:

- Known providers (gmail.com via Google OAuth): Auto-verified
- Unknown providers: May require email verification step

## Verification Checklist (ALL MUST PASS)

Run after migration script completes:

```bash
# 1. Check migration logs for failures
grep -i "failed" migration.log | wc -l
# Should be 0 or minimal

# 2. Verify user count in WorkOS Dashboard
# Dashboard → Users → Total count should match Better Auth count

# 3. Test password login (if applicable)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test_password"}' \
  | grep -q "access_token" && echo "PASS: Password auth works" || echo "FAIL: Password auth broken"

# 4. Test social auth redirect (if applicable)
# Use WorkOS Dashboard → AuthKit → Test button for each provider

# 5. Verify organizations (if applicable)
# Dashboard → Organizations → Count should match Better Auth count
```

**If any check fails, DO NOT proceed to production cutover.**

## Error Recovery

### "Invalid password hash format"

**Root cause:** Hash not in PHC format or wrong algorithm specified.

**Fix:**

1. Check `password_hash_type` matches actual algorithm (scrypt, bcrypt, etc.)
2. For scrypt: Verify format is `$scrypt$n=16384,r=8,p=1$<salt>$<hash>`
3. Verify salt and hash are base64 encoded
4. Check fetched docs for algorithm-specific format requirements

### "Email already exists"

**Root cause:** User already migrated or duplicate in Better Auth database.

**Fix:**

1. Skip duplicate and log for review
2. OR use Update User API to update existing user with password hash
3. Check Better Auth for duplicate emails: `SELECT email, COUNT(*) FROM user GROUP BY email HAVING COUNT(*) > 1`

### "Rate limit exceeded"

**Root cause:** Too many API calls too quickly.

**Fix:**

1. Increase `DELAY_MS` in migration script
2. Reduce `BATCH_SIZE`
3. Check fetched docs for current rate limits - they may have changed
4. Consider running migration during off-peak hours

### Social auth users can't sign in after migration

**Root cause:** Provider not configured in WorkOS Dashboard.

**Fix:**

1. Go to Dashboard → Integrations
2. Add OAuth client credentials for each provider (Google, Microsoft, etc.)
3. Test sign-in flow using Dashboard test button
4. Verify redirect URIs match your application's callback URLs

### Organizations not linking to users

**Root cause:** Users migrated AFTER organization memberships created.

**Fix:**

1. Check membership creation logs for user_id values
2. Re-run membership creation step after users are migrated
3. OR delete failed memberships and recreate: `workos.organizationMemberships.deleteOrganizationMembership(id)`

### Scrypt hash parameters mismatch

**Root cause:** Better Auth configured with non-default scrypt parameters.

**Fix:**

1. Check Better Auth config for custom `n`, `r`, `p` values
2. Update PHC format: `$scrypt$n=<custom_n>,r=<custom_r>,p=<custom_p>$<salt>$<hash>`
3. Verify parameters are comma-separated with no spaces

## Related Skills

- workos-migrate-other-services.rules.yml - Generic migration patterns for unsupported providers
- workos-authkit-nextjs - Implementing AuthKit after migration (Next.js)
- workos-authkit-react - Implementing AuthKit after migration (React SPA)
