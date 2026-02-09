---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- generated -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Assessment

### Project Validation

- Confirm WorkOS SDK already installed (see `workos-authkit-nextjs` skill)
- Confirm AuthKit integration complete and working
- Confirm you have dashboard access with admin permissions

### Environment Variables

Check `.env.local` or `.env` for:

- `WORKOS_API_KEY` - starts with `sk_` (production) or `sk_test_` (development)
- `WORKOS_CLIENT_ID` - starts with `client_`

**CRITICAL:** Use test keys for migration dry-run, production keys for final import.

### Auth0 Access

- Confirm you have Auth0 admin access
- Confirm you can access Auth0 Management API
- Confirm you can open Auth0 support tickets (for password export)

## Step 3: Data Export Strategy (Decision Tree)

```
Auth0 user authentication method?
  |
  +-- Password-based only
  |     |
  |     +-- Open Auth0 support ticket NOW
  |     |   (1-2 week lead time for password hash export)
  |     |
  |     +-- Continue with bulk user export below
  |
  +-- Social auth only (Google, Microsoft, etc.)
  |     |
  |     +-- Bulk user export (no password ticket needed)
  |     +-- Configure matching OAuth providers in WorkOS
  |
  +-- Mixed (password + social)
        |
        +-- Open Auth0 support ticket NOW
        +-- Bulk user export
        +-- Configure OAuth providers in WorkOS
```

### Export Users from Auth0

**Method 1: Auth0 Dashboard (Recommended for <1000 users)**

1. Navigate to Auth0 Dashboard → Extensions
2. Install "User Import / Export" extension if not present
3. Run "Export Users" job
4. Download newline-delimited JSON (NDJSON) file
5. Save as `auth0-users.ndjson`

**Method 2: Auth0 Management API (For >1000 users)**

```bash
# Get Auth0 Management API token first
# Then paginate through users
curl -X GET \
  'https://YOUR_DOMAIN.auth0.com/api/v2/users?per_page=100&page=0' \
  -H 'Authorization: Bearer YOUR_MGMT_TOKEN' > auth0-users-page0.json
```

Repeat with `page=1`, `page=2`, etc. until all users exported.

### Export Organizations (If Using Auth0 Organizations)

Use Auth0 Management API to export organizations:

```bash
curl -X GET \
  'https://YOUR_DOMAIN.auth0.com/api/v2/organizations' \
  -H 'Authorization: Bearer YOUR_MGMT_TOKEN' > auth0-orgs.json
```

For each org, export memberships:

```bash
curl -X GET \
  'https://YOUR_DOMAIN.auth0.com/api/v2/organizations/{org_id}/members' \
  -H 'Authorization: Bearer YOUR_MGMT_TOKEN' > auth0-org-{org_id}-members.json
```

### Password Hash Export (Only If Password Auth Used)

1. Open Auth0 support ticket requesting password hash export
2. Wait 1-2 weeks for Auth0 to process
3. Receive second NDJSON file with `passwordHash` field
4. Save as `auth0-passwords.ndjson`

**IMPORTANT:** Auth0 uses `bcrypt` algorithm. WorkOS supports bcrypt import.

## Step 4: Configure OAuth Providers (If Using Social Auth)

**Skip this step if only using password authentication.**

For each social provider your Auth0 users authenticate with:

1. Navigate to WorkOS Dashboard → Authentication → Social Providers
2. Enable the provider (Google, Microsoft, GitHub, etc.)
3. Configure OAuth client credentials (see provider-specific WorkOS docs)
4. Save configuration

**User matching:** WorkOS auto-links social auth users by email address.

**Email verification note:** Some users may need to verify email if:
- Provider doesn't guarantee verified emails (e.g., GitHub)
- Email domain doesn't match verified provider domain (e.g., Google OAuth with non-gmail.com)

## Step 5: Import Users (Choose One Method)

```
Import method?
  |
  +-- Small migration (<500 users) --> Manual API calls (Method A)
  |
  +-- Large migration (>500 users) --> WorkOS import tool (Method B)
```

### Method A: Manual API Import (Small Scale)

**Field mapping from Auth0 export to WorkOS Create User API:**

```
Auth0 field        --> WorkOS parameter
email              --> email
email_verified     --> email_verified
given_name         --> first_name
family_name        --> last_name
```

**Import script template:**

```javascript
// import-users.js
const { WorkOS } = require('@workos-inc/node');
const fs = require('fs');
const readline = require('readline');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUsers() {
  const fileStream = fs.createReadStream('auth0-users.ndjson');
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    const auth0User = JSON.parse(line);
    
    try {
      await workos.userManagement.createUser({
        email: auth0User.email,
        emailVerified: auth0User.email_verified,
        firstName: auth0User.given_name,
        lastName: auth0User.family_name,
      });
      console.log(`✓ Imported: ${auth0User.email}`);
    } catch (error) {
      console.error(`✗ Failed: ${auth0User.email}`, error.message);
    }
  }
}

importUsers();
```

**Import passwords (if applicable):**

```javascript
// Add to createUser call above:
{
  // ... existing fields
  passwordHash: auth0User.passwordHash, // from auth0-passwords.ndjson
  passwordHashType: 'bcrypt',
}
```

**Run import:**

```bash
node import-users.js
```

### Method B: WorkOS Import Tool (Large Scale)

**RECOMMENDED for >500 users.**

1. Clone WorkOS migration tool:

```bash
git clone https://github.com/workos/migrate-auth0-users.git
cd migrate-auth0-users
npm install
```

2. Follow tool's README for configuration

3. Run import with dry-run first:

```bash
WORKOS_API_KEY=sk_test_... npm run import -- --dry-run
```

4. Review output, fix any errors

5. Run production import:

```bash
WORKOS_API_KEY=sk_... npm run import
```

**Tool advantages:** Automatic retry logic, rate limiting, progress tracking.

## Step 6: Import Organizations (If Applicable)

**Skip if not using Auth0 Organizations feature.**

### Create Organizations in WorkOS

For each Auth0 org, call WorkOS Create Organization API:

```javascript
const org = await workos.organizations.createOrganization({
  name: auth0Org.display_name,
  // Optional: map auth0Org.metadata to WorkOS domains/settings
});
```

### Add Organization Memberships

For each user-org relationship from Auth0:

```javascript
await workos.userManagement.createOrganizationMembership({
  userId: workosUserId,  // from Step 5 import
  organizationId: org.id, // from organization creation above
  // Optional: roleSlug if you have RBAC configured
});
```

## Step 7: MFA Migration Considerations

**CRITICAL:** WorkOS does not support SMS-based MFA (security reasons).

### MFA Strategy

```
Auth0 MFA type?
  |
  +-- SMS only
  |     |
  |     +-- Users MUST re-enroll using TOTP authenticator app
  |     +-- Alternative: Use WorkOS Magic Auth (email-based)
  |
  +-- TOTP (authenticator app)
  |     |
  |     +-- Users MUST re-enroll (cannot export TOTP secrets from Auth0)
  |
  +-- No MFA
        |
        +-- Enable WorkOS MFA in Dashboard → Authentication → MFA
        +-- Users enroll on next sign-in (if required)
```

**Communication plan:** Notify users before migration that SMS MFA will be disabled and they need to re-enroll.

## Step 8: Post-Migration Validation

### Verify Import Success

Run these commands to check import completion:

```bash
# 1. Check total user count in WorkOS (via API)
curl -X GET 'https://api.workos.com/user_management/users' \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'

# 2. Spot-check specific user exists
curl -X GET 'https://api.workos.com/user_management/users' \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G --data-urlencode "email=test@example.com" \
  | jq '.data[0].email'

# 3. If using orgs, check org count
curl -X GET 'https://api.workos.com/organizations' \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```

### Test Authentication Flows

**Password auth test:**

1. Use WorkOS test login form or your app's login page
2. Sign in with migrated user credentials
3. Confirm successful authentication
4. Confirm session works (check `getUser()` returns data)

**Social auth test (if configured):**

1. Use WorkOS test login form or your app's login page
2. Click social provider button
3. Authenticate with provider
4. Confirm WorkOS links to existing user by email
5. Check no duplicate users created

**Organization test (if applicable):**

1. Sign in as user with organization membership
2. Confirm organization context is available in session
3. Verify RBAC permissions work (if configured)

### Rollback Plan

**If migration fails validation:**

```bash
# 1. Delete all imported users (TEST ENVIRONMENT ONLY)
# WorkOS does not have bulk delete - use with extreme caution
curl -X GET 'https://api.workos.com/user_management/users' \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -r '.data[].id' \
  | xargs -I {} curl -X DELETE "https://api.workos.com/user_management/users/{}" \
       -H "Authorization: Bearer $WORKOS_API_KEY"

# 2. Re-run import with fixes
```

**For production:** Keep Auth0 active until WorkOS validation complete.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Auth0 export files exist
ls auth0-users.ndjson auth0-passwords.ndjson 2>/dev/null

# 2. WorkOS API reachable
curl -X GET 'https://api.workos.com/user_management/users?limit=1' \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  --fail

# 3. User count matches (adjust expected count)
EXPECTED=1000
ACTUAL=$(curl -s 'https://api.workos.com/user_management/users' \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
[ "$ACTUAL" -eq "$EXPECTED" ] && echo "PASS" || echo "FAIL: Expected $EXPECTED, got $ACTUAL"

# 4. Test user can authenticate
# (Manual test via login form)

# 5. Application builds and starts
npm run build && npm start
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in import file or running import twice.

**Fix:**

1. Check WorkOS Dashboard for existing user by email
2. If duplicate in file: deduplicate NDJSON before import
3. If re-running import: use Update User API instead of Create User API

### "Invalid password hash" error

**Cause:** Password hash format mismatch or missing `passwordHashType`.

**Fix:**

1. Verify `passwordHashType: 'bcrypt'` is set in API call
2. Check Auth0 export has `passwordHash` field (not `password`)
3. Verify hash starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)

### Social auth user creates duplicate account

**Cause:** Email mismatch between Auth0 and social provider.

**Fix:**

1. Check Auth0 user's `email` matches their social provider email exactly
2. In WorkOS Dashboard, manually merge duplicate users if created
3. Ensure `email_verified: true` for social auth users in import

### "Rate limit exceeded" during bulk import

**Cause:** Hitting WorkOS API rate limits (varies by plan).

**Fix:**

1. Add delay between API calls: `await new Promise(r => setTimeout(r, 100))`
2. Use WorkOS import tool (Method B) which handles rate limiting
3. Contact WorkOS support for temporary rate limit increase

### Users cannot sign in after migration

**Checklist:**

1. Verify AuthKit integration complete (`workos-authkit-nextjs` skill)
2. Check middleware/proxy file exists and routes to callback
3. Verify callback route uses `handleAuth()` correctly
4. Check `WORKOS_CLIENT_ID` matches Dashboard Application
5. Test with WorkOS test login form first (isolate app vs. migration issue)

### Organization memberships not working

**Cause:** Users imported before organizations created, or membership API calls failed.

**Fix:**

1. Create organizations first, then add memberships
2. Check WorkOS Dashboard → Organizations for membership list
3. Re-run membership import script if needed
4. Verify organization ID in membership API call is correct

### MFA users locked out

**Cause:** SMS MFA no longer supported, TOTP secrets not transferred.

**Fix:**

1. User must reset MFA enrollment
2. Provide clear instructions: "Sign in → Profile → Security → Re-enroll MFA"
3. Alternative: Temporarily disable MFA requirement in WorkOS Dashboard
4. Communicate migration plan to users BEFORE migration

## Related Skills

- `workos-authkit-nextjs` - Complete AuthKit integration (prerequisite)
- `workos-organizations` - Advanced organization management
- `workos-directory-sync` - Automate user provisioning post-migration
