---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Inventory Auth0 Data

Determine what you're migrating:

```
Do you have password-based users?
  |
  +-- YES --> Need password hash export (7-14 day lead time)
  |
  +-- NO  --> Can proceed with basic export
  
Do you have social auth users (Google, Microsoft, etc.)?
  |
  +-- YES --> Need to configure OAuth providers in WorkOS
  |
  +-- NO  --> Skip social auth setup

Do you have Auth0 Organizations?
  |
  +-- YES --> Need to export via Management API
  |
  +-- NO  --> Skip organization migration

Do users have MFA enabled?
  |
  +-- YES, SMS --> Users MUST re-enroll (WorkOS doesn't support SMS MFA)
  |
  +-- YES, TOTP --> Can continue using TOTP authenticators
  |
  +-- NO --> No action needed
```

### Critical Timing Note

If migrating passwords, **open Auth0 support ticket NOW** — password hash exports take 7-14 days. Do not wait until other steps are complete.

## Step 3: Export Auth0 User Data

### Basic User Export

1. Open Auth0 Dashboard → User Management → Users
2. Click "Export Users" or use [User Import/Export Extension](https://auth0.com/docs/customize/extensions/user-import-export-extension#export-users)
3. Download the newline-delimited JSON file

**Fields to verify in export:**

```bash
# Check export file has required fields
head -1 users_export.json | jq 'keys'
# Should contain: email, email_verified, given_name, family_name
```

### Password Hash Export (if needed)

**BLOCKING:** This requires Auth0 support ticket. Do not attempt without ticket approval.

1. Contact [Auth0 support](https://auth0.com/docs/troubleshoot/customer-support)
2. Request: "Bulk export of password hashes for migration"
3. Wait 7-14 days for approval and file delivery
4. Receive separate JSON file with `passwordHash` field

**Verify password export:**

```bash
# Check password hash field exists
head -1 password_export.json | jq '.passwordHash'
# Should return bcrypt hash string starting with $2
```

### Organization Export (if needed)

Use Auth0 Management API to paginate through organizations:

```bash
# Example: Export orgs via Management API
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://YOUR_DOMAIN.auth0.com/api/v2/organizations?per_page=50"
```

Store organization data and membership mappings for import.

## Step 4: Setup WorkOS Environment

### Verify Prerequisites

```bash
# Check WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# Check environment variables
grep -q "WORKOS_API_KEY" .env && echo "PASS: API key found" || echo "FAIL: API key missing"
grep -q "WORKOS_CLIENT_ID" .env && echo "PASS: Client ID found" || echo "FAIL: Client ID missing"
```

### Configure Social Auth Providers (if needed)

**Only if migrating social auth users.**

For each provider your Auth0 users use:

1. WorkOS Dashboard → Integrations
2. Enable provider (Google, Microsoft, etc.)
3. Configure OAuth client credentials

**Critical:** WorkOS matches users by email address. Provider's email MUST match Auth0 export email.

WebFetch provider-specific setup:
- Google: `https://workos.com/docs/integrations/google-oauth`
- Microsoft: `https://workos.com/docs/integrations/microsoft-oauth`

## Step 5: Import Users into WorkOS (Decision Tree)

```
Choose import method:
  |
  +-- Use WorkOS migration tool --> Go to Step 5A
  |
  +-- Write custom import script --> Go to Step 5B
```

### Step 5A: Using WorkOS Migration Tool

**Recommended for most migrations.**

```bash
# Clone WorkOS migration tool
git clone https://github.com/workos/migrate-auth0-users.git
cd migrate-auth0-users

# Install dependencies
npm install

# Configure with your exports
export WORKOS_API_KEY="sk_..."
export AUTH0_USERS_FILE="path/to/users_export.json"
export AUTH0_PASSWORDS_FILE="path/to/password_export.json"  # If applicable

# Run import
npm start
```

**Verify import progress:**

```bash
# Check WorkOS Dashboard → Users
# Count should match Auth0 export line count
wc -l users_export.json
```

### Step 5B: Using WorkOS APIs Directly

**Only if you need custom import logic.**

Field mapping from Auth0 export to WorkOS Create User API:

```
Auth0 Export Field --> WorkOS API Parameter
email              --> email
email_verified     --> email_verified
given_name         --> first_name
family_name        --> last_name
```

**Example import script structure:**

```javascript
import { WorkOS } from '@workos-inc/node';
import fs from 'fs';
import readline from 'readline';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const importUsers = async () => {
  const fileStream = fs.createReadStream('users_export.json');
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    const auth0User = JSON.parse(line);
    
    await workos.users.createUser({
      email: auth0User.email,
      emailVerified: auth0User.email_verified,
      firstName: auth0User.given_name,
      lastName: auth0User.family_name,
      // Add password hash if available
      passwordHashType: auth0User.passwordHash ? 'bcrypt' : undefined,
      passwordHash: auth0User.passwordHash || undefined
    });
  }
};
```

### Importing Password Hashes

**Critical parameters for bcrypt:**

- `passwordHashType: 'bcrypt'` (Auth0 uses bcrypt)
- `passwordHash: <value from passwordHash field>`

Can be done during user creation OR via Update User API after creation.

**Verify hash import:**

```bash
# Test login with imported password
# User should be able to sign in without password reset
```

## Step 6: Migrate Organizations (if needed)

### Create Organizations in WorkOS

For each Auth0 organization:

```javascript
const org = await workos.organizations.createOrganization({
  name: auth0Org.display_name,
  // Map other relevant fields
});
```

### Add User Memberships

**Source:** Auth0's Bulk User Export includes organization membership data.

For each user-organization relationship:

```javascript
await workos.userManagement.createOrganizationMembership({
  userId: workosUserId,
  organizationId: workosOrgId
});
```

**Verify memberships:**

```bash
# Check in WorkOS Dashboard
# Each user should have correct organization associations
```

## Step 7: Handle MFA Migration

```
User's MFA method in Auth0?
  |
  +-- SMS --> User MUST re-enroll (WorkOS doesn't support SMS)
  |           Send re-enrollment email/notification
  |
  +-- TOTP (Google Authenticator, etc.) --> Can continue using same app
  |                                          No action needed
  |
  +-- None --> No action needed
```

**Important:** WorkOS does NOT support SMS-based MFA due to security vulnerabilities. SMS users must switch to:

- Email-based Magic Auth, OR
- TOTP authenticator app (Google Authenticator, Authy, etc.)

**Notify affected users:**

```
Subject: Action Required - Update Your Two-Factor Authentication

We've upgraded our authentication system. SMS-based two-factor 
authentication is no longer supported.

Please re-enroll using one of these methods:
- Authenticator app (recommended)
- Email verification

[Re-enroll Now Button]
```

## Step 8: Social Auth User Verification

**Automatic linking:** When social auth users sign in via WorkOS, they're automatically matched to imported users by email address.

**Email verification edge case:**

```
Does provider verify emails?
  |
  +-- YES (gmail.com via Google OAuth) --> Auto-linked, no verification needed
  |
  +-- NO (custom domain via Google OAuth) --> User may need to verify email
  |
  +-- UNKNOWN --> Check WorkOS Dashboard → Authentication → Email Verification settings
```

**Test social auth flow:**

```bash
# 1. Configure provider in WorkOS Dashboard
# 2. Attempt sign-in with social provider
# 3. Verify user is matched to existing WorkOS user
# 4. Check email_verified status in Dashboard
```

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. User count matches
echo "Auth0 users:"
wc -l users_export.json
echo "WorkOS users:"
# Check WorkOS Dashboard → Users → Total count

# 2. Test password login (if passwords imported)
# Attempt login with known user credentials
# Should succeed without password reset

# 3. Test social auth login (if applicable)
# Sign in with Google/Microsoft
# Should match existing user, not create duplicate

# 4. Organization memberships (if applicable)
# Check 3-5 users in Dashboard
# Verify organization associations match Auth0

# 5. SDK integration works
npm run build && echo "PASS: Build succeeds"
```

**Do not mark complete until:**

- User count matches Auth0 export
- Password logins work (if imported)
- Social auth creates no duplicates
- Organization memberships are correct

## Error Recovery

### "User already exists" during import

**Cause:** Re-running import script or duplicate entries in Auth0 export.

**Fix:**

```javascript
// Add idempotency check
try {
  await workos.users.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    console.log(`Skipping existing user: ${email}`);
    continue;
  }
  throw error;
}
```

### Password login fails after import

**Cause:** Password hash not imported or wrong hash type specified.

**Fix:**

1. Verify `passwordHashType: 'bcrypt'` (Auth0 uses bcrypt)
2. Check passwordHash field exists in export
3. Confirm Auth0 support provided password export file
4. Test hash format: should start with `$2a$`, `$2b$`, or `$2y$`

### Social auth creates duplicate user instead of linking

**Cause:** Email mismatch between Auth0 export and social provider.

**Fix:**

1. Check email case sensitivity (Auth0 vs. provider)
2. Verify `email_verified` is true for imported user
3. Ensure provider's email exactly matches WorkOS user email
4. Check WorkOS logs for linking attempt errors

### Organization membership API returns 404

**Cause:** WorkOS user ID or organization ID doesn't exist.

**Fix:**

1. Verify user was created successfully first
2. Verify organization was created successfully first
3. Store WorkOS IDs during creation for membership linking
4. Check Dashboard for correct IDs

### Import script times out or rate limited

**Cause:** Bulk imports hitting API rate limits.

**Fix:**

```javascript
// Add rate limiting with delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const user of users) {
  await workos.users.createUser({...});
  await delay(100); // 100ms between requests
}
```

Check API rate limits: WebFetch `https://workos.com/docs/reference/rate-limiting`

### SMS MFA users cannot sign in

**Expected behavior:** WorkOS doesn't support SMS MFA.

**Fix:**

1. Send re-enrollment notification (see Step 7)
2. Provide TOTP enrollment flow in your app
3. Consider temporary grace period with email-based fallback

## Post-Migration

### Integrate WorkOS AuthKit

WebFetch AuthKit integration guide based on your framework:

- Next.js: See `workos-authkit-nextjs` skill
- React: See `workos-authkit-react` skill
- Vanilla JS: See `workos-authkit-vanilla-js` skill

### Decommission Auth0

**Only after confirming:**

- All users can sign in via WorkOS
- No traffic to Auth0 authentication endpoints
- 30+ day grace period with parallel systems

## Related Skills

- `workos-authkit-base` - Core AuthKit integration patterns
- `workos-authkit-nextjs` - Next.js-specific AuthKit setup
- `workos-authkit-react` - React-specific AuthKit setup
- `workos-api-authkit` - AuthKit API reference
- `workos-mfa` - Multi-factor authentication setup
- `workos-magic-link` - Email-based authentication
- `workos-api-organization` - Organization management APIs
- `workos-sso` - Enterprise SSO setup (post-migration)
