---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- generated -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The official migration guide is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Inventory Current Auth0 Setup

Run these checks in Auth0 Dashboard or Management API:

1. **Count total users**: Check Users section or GET `/api/v2/users`
2. **List authentication methods**: Password, social (Google, Microsoft, etc.), enterprise SSO
3. **Check organizations**: Count Auth0 Organizations and membership mappings
4. **MFA status**: Identify users with SMS MFA (requires migration)

Document findings before proceeding.

### WorkOS Prerequisites Validation

```bash
# 1. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env.local || echo "FAIL: Missing WorkOS keys"

# 2. Verify API key format
grep "^WORKOS_API_KEY=sk_" .env.local || echo "FAIL: Invalid API key format"

# 3. Check WorkOS SDK installed
npm list @workos-inc/node || yarn list --pattern @workos-inc/node
```

All checks must pass before export.

## Step 3: Export Auth0 User Data

### Export User Profiles (REQUIRED)

**Method:** Use Auth0's User Import/Export Extension

1. Navigate to Auth0 Dashboard → Extensions
2. Install "User Import / Export" extension if not present
3. Click "Export Users" → Select target connection
4. Download NDJSON file (newline-delimited JSON)

**Verify export:**

```bash
# Check file exists and is valid JSON-per-line
cat auth0_users.ndjson | head -1 | jq . || echo "FAIL: Invalid JSON format"

# Count exported users
wc -l < auth0_users.ndjson
```

### Export Password Hashes (CONDITIONAL)

**Only if:** Users authenticate with passwords (not just social/SSO)

**BLOCKING STEP:** Contact Auth0 Support to request password hash export. This takes 5-10 business days.

Support ticket must include:

- Tenant domain
- Connection name(s) needing password export
- Justification: "Migrating to WorkOS AuthKit"

Auth0 provides separate NDJSON file with `passwordHash` field (bcrypt format).

**Verify password export:**

```bash
# Check password hashes exist in export
cat auth0_passwords.ndjson | head -1 | jq -r '.passwordHash' || echo "FAIL: No password hashes"
```

## Step 4: Data Mapping (Decision Tree)

```
User data export ready?
  |
  +-- Passwords included
  |   |
  |   +-- Import with password_hash (Step 5A)
  |
  +-- Passwords NOT included
  |   |
  |   +-- Users must reset passwords via Magic Auth
  |
  +-- Social auth users (Google, Microsoft, etc.)
      |
      +-- Configure OAuth providers in WorkOS first (Step 6)
      +-- Import users without passwords
      +-- Auto-link on first sign-in
```

### Field Mapping Reference

| Auth0 Field      | WorkOS API Parameter |
| ---------------- | -------------------- |
| `email`          | `email`              |
| `email_verified` | `email_verified`     |
| `given_name`     | `first_name`         |
| `family_name`    | `last_name`          |
| `passwordHash`   | `password_hash`      |

## Step 5: Import Users into WorkOS

### Option A: Using WorkOS Import Tool (RECOMMENDED)

```bash
# 1. Clone migration tool
git clone https://github.com/workos/migrate-auth0-users.git
cd migrate-auth0-users

# 2. Install dependencies
npm install

# 3. Set environment variables
export WORKOS_API_KEY="sk_..."
export AUTH0_USERS_FILE="./auth0_users.ndjson"
export AUTH0_PASSWORDS_FILE="./auth0_passwords.ndjson"  # Optional

# 4. Run import (dry-run first)
npm run import -- --dry-run

# 5. Execute actual import
npm run import
```

**Verify import:**

```bash
# Check WorkOS Dashboard user count matches Auth0 export
# Expected: User count in WorkOS = line count in NDJSON
```

### Option B: Custom Import Script

If writing custom import code, use WorkOS SDK:

```javascript
// Example: Import single user with password
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const user = await workos.userManagement.createUser({
  email: auth0User.email,
  email_verified: auth0User.email_verified,
  first_name: auth0User.given_name,
  last_name: auth0User.family_name,
  password_hash: auth0User.passwordHash, // bcrypt format
  password_hash_type: 'bcrypt', // REQUIRED when password_hash provided
});
```

**CRITICAL:** Set `password_hash_type: 'bcrypt'` when importing Auth0 passwords. This is Auth0's hashing algorithm.

**Error handling pattern:**

```javascript
try {
  await workos.userManagement.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    // Update existing user instead
    await workos.userManagement.updateUser(userId, {...});
  } else {
    throw error;
  }
}
```

## Step 6: Configure Social Auth Providers

**Only if:** Users sign in with Google, Microsoft, GitHub, etc.

### Provider Setup Checklist

For each social provider in Auth0:

1. **In WorkOS Dashboard:**
   - Navigate to Authentication → Social Connections
   - Enable provider (e.g., Google OAuth)
   - Add OAuth client credentials from provider console

2. **Provider configuration:**
   - Add WorkOS callback URL to provider's allowed redirects
   - WorkOS callback: `https://api.workos.com/sso/oauth/callback`

3. **Email verification settings:**
   - Check WorkOS environment settings
   - Google/Microsoft users with matching domain may skip verification
   - Other providers require email verification if enabled

**Verify provider:**

```bash
# Test sign-in flow in WorkOS Dashboard
# Authentication → Social Connections → [Provider] → Test Connection
```

### Auto-Linking Behavior

When social auth users sign in via WorkOS:

- WorkOS matches by **email address**
- If imported user has matching email, automatically links accounts
- User sees seamless sign-in experience

**No code changes needed** — linking is automatic.

## Step 7: Migrate Organizations (CONDITIONAL)

**Only if:** Using Auth0 Organizations feature

### Export Auth0 Organizations

```javascript
// Use Auth0 Management API to export orgs
const auth0 = new ManagementClient({
  domain: 'your-domain.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

const organizations = await auth0.organizations.getAll();
```

### Create WorkOS Organizations

```javascript
const workos = new WorkOS(process.env.WORKOS_API_KEY);

for (const auth0Org of organizations) {
  const workosOrg = await workos.organizations.createOrganization({
    name: auth0Org.name,
    domains: auth0Org.domains?.map((d) => d.name) || [],
    // Optional: Store Auth0 org ID for reference
    externalId: auth0Org.id,
  });

  // Add organization memberships
  for (const member of auth0Org.members) {
    await workos.userManagement.createOrganizationMembership({
      organization_id: workosOrg.id,
      user_id: workosUserId, // Mapped from Auth0 user ID
    });
  }
}
```

**Verify organization import:**

```bash
# Check WorkOS Dashboard: Org count matches Auth0
# Check user memberships in WorkOS match Auth0 export
```

## Step 8: Handle MFA Migration

### SMS MFA Users (BREAKING CHANGE)

**WorkOS does not support SMS MFA** due to security vulnerabilities.

Users with SMS MFA must:

1. **Re-enroll in MFA** using TOTP authenticator app (Google Authenticator, 1Password, etc.)
2. **OR switch to email-based Magic Auth** (passwordless)

### Communication Plan

1. Email users with SMS MFA before migration
2. Provide enrollment instructions: Link to WorkOS MFA setup guide
3. Offer grace period where MFA is optional
4. Enforce MFA after grace period

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches
echo "Auth0 users: $(wc -l < auth0_users.ndjson)"
echo "WorkOS users: [Check Dashboard]"
# Expected: Counts match within margin of error

# 2. Password authentication works
# Test: Sign in with email/password in your app
# Expected: Users can authenticate with existing passwords

# 3. Social auth configured
# Test: Sign in with Google/Microsoft
# Expected: Users auto-link to existing accounts

# 4. Organizations migrated (if applicable)
# Check: WorkOS Dashboard → Organizations
# Expected: Org count matches Auth0

# 5. MFA status
# Check: Users with TOTP MFA can sign in
# Expected: SMS MFA users prompted to re-enroll

# 6. Application builds
npm run build
```

## Error Recovery

### "user_already_exists" during import

**Cause:** User with email already exists in WorkOS (likely from test imports)

**Fix:** Use Update User API instead of Create:

```javascript
await workos.userManagement.updateUser(existingUserId, {
  first_name: auth0User.given_name,
  password_hash: auth0User.passwordHash,
  password_hash_type: 'bcrypt',
});
```

### "invalid_password_hash" error

**Cause:** Wrong `password_hash_type` or malformed hash

**Fix:**

1. Verify `password_hash_type: 'bcrypt'` (Auth0's algorithm)
2. Check password hash format: Should start with `$2a$`, `$2b$`, or `$2y$`
3. Ensure hash is full string from Auth0 export (no truncation)

### Social auth users cannot sign in

**Cause:** Provider not configured or callback URL mismatch

**Fix:**

1. Check WorkOS Dashboard → Authentication → Social Connections → [Provider] is enabled
2. Verify OAuth credentials are correct
3. Add WorkOS callback URL to provider's allowed redirects: `https://api.workos.com/sso/oauth/callback`
4. Test connection in WorkOS Dashboard

### Users not auto-linking to social accounts

**Cause:** Email mismatch or email verification required

**Fix:**

1. Verify imported user email matches social provider email exactly
2. Check email verification settings in WorkOS environment
3. If verification required, user must verify email before linking

### Organization memberships missing

**Cause:** User IDs not mapped correctly from Auth0 to WorkOS

**Fix:**

1. Store Auth0 user ID → WorkOS user ID mapping during import
2. Use mapping when creating organization memberships
3. Double-check `user_id` parameter in `createOrganizationMembership` calls

### Migration taking too long (>1 hour for 10k users)

**Cause:** Serial API calls, no batching/parallelization

**Fix:**

1. Use Promise.all() with batches of 50-100 concurrent requests
2. Add retry logic with exponential backoff
3. Consider using WorkOS bulk import tool (handles rate limiting)

## Post-Migration Tasks

1. **Update application code:** Replace Auth0 SDK calls with WorkOS AuthKit SDK
2. **Test authentication flows:** Password, social, MFA, password reset
3. **Monitor error logs:** Check for authentication failures in first 48 hours
4. **Deprecate Auth0:** After validation period, disable Auth0 tenant
5. **Update documentation:** Internal docs, onboarding guides, support articles

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit with Next.js after migration
- `workos-sso-setup` - Configure enterprise SSO connections in WorkOS
- `workos-organizations` - Manage organizations and memberships programmatically
