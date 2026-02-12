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

## Step 2: Pre-Migration Assessment (Decision Tree)

```
What are you migrating?
  |
  +-- Users only --> Go to Step 3
  |
  +-- Users + passwords --> Go to Step 3, enable password export
  |
  +-- Users + organizations --> Go to Step 3, then Step 7
  |
  +-- Users + social auth --> Go to Step 3, then Step 8
  |
  +-- Everything --> Complete all steps in order
```

**Critical questions to answer before starting:**

1. Do users sign in with passwords? (If yes, you MUST request password export from Auth0 — this takes 1+ week)
2. Do you use Auth0 Organizations? (If yes, you'll need Management API access)
3. Do users sign in via Google/Microsoft OAuth? (If yes, configure providers in WorkOS first)
4. Do users use SMS-based MFA? (If yes, they will need to re-enroll — WorkOS does not support SMS)

## Step 3: Export User Data from Auth0

### Basic User Export (REQUIRED)

Use Auth0's Bulk User Export extension:

1. Log into Auth0 Dashboard
2. Navigate to Extensions → User Import/Export
3. Trigger bulk export job
4. Download newline-delimited JSON file

**Verify export contains these fields:**

```bash
# Check first user record has required fields
head -n 1 users_export.json | jq 'has("email") and has("email_verified") and has("given_name") and has("family_name")'
# Should output: true
```

### Password Export (OPTIONAL, SLOW)

**ONLY if migrating password-based authentication.**

**Timeline:** 1+ weeks. Start this immediately if needed.

1. Contact Auth0 support: https://auth0.com/docs/troubleshoot/customer-support
2. Request password hash export (includes bcrypt hashes)
3. Wait for separate JSON file with `passwordHash` field

**Important:** Auth0 does NOT export plaintext passwords. You will receive bcrypt hashes.

**Verify password export:**

```bash
# Check password file has hashes
head -n 1 passwords_export.json | jq 'has("passwordHash")'
# Should output: true
```

## Step 4: Prepare WorkOS Environment

### API Keys

Check `.env` or environment variables:

- `WORKOS_API_KEY` - starts with `sk_`, has user management permissions
- `WORKOS_CLIENT_ID` - starts with `client_`

**Test API access:**

```bash
curl -X GET https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
# Should return 200 with user list (may be empty)
```

### SDK Installation

Install WorkOS SDK if not already present:

```bash
# Detect package manager, install SDK
npm install @workos-inc/node
# OR
yarn add @workos-inc/node
# OR
pnpm add @workos-inc/node
```

**Verify installation:**

```bash
ls node_modules/@workos-inc/node
# Should show package directory
```

## Step 5: Import Users (Two Options)

### Option A: Use WorkOS Migration Tool (RECOMMENDED)

**Best for:** Quick migrations, standard Auth0 exports

1. Clone migration tool: `git clone https://github.com/workos/migrate-auth0-users`
2. Install dependencies: `cd migrate-auth0-users && npm install`
3. Set environment variables: `WORKOS_API_KEY`, input file paths
4. Run migration: `npm start`

**Verify migration:**

```bash
# Check users imported
curl -X GET https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match Auth0 export count
```

### Option B: Use WorkOS API Directly

**Best for:** Custom migration logic, data transformation needs

**Field mapping (Auth0 → WorkOS):**

```
Auth0 Export Field  →  WorkOS Create User API Parameter
-----------------      ----------------------------------
email               →  email
email_verified      →  email_verified
given_name          →  first_name
family_name         →  last_name
```

**Example API call:**

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

**If using SDK (Node.js example):**

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Read Auth0 export
const users = require("./users_export.json");

for (const user of users) {
  await workos.userManagement.createUser({
    email: user.email,
    emailVerified: user.email_verified,
    firstName: user.given_name,
    lastName: user.family_name,
  });
}
```

## Step 6: Import Passwords (If Exported)

**ONLY proceed if you have password hashes from Step 3.**

### During User Creation

Add password parameters to Create User API call:

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Doe",
    "password_hash": "$2a$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**Critical:** Auth0 uses `bcrypt` — this is supported by WorkOS. Always set `password_hash_type` to `"bcrypt"`.

### After User Creation

Use Update User API if users already created:

```bash
curl -X PUT https://api.workos.com/user_management/users/{user_id} \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "password_hash": "$2a$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**Verify password import:**

```bash
# Test login with migrated password
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$WORKOS_CLIENT_ID'",
    "email": "user@example.com",
    "password": "original_password"
  }'
# Should return 200 with user session
```

## Step 7: Migrate Organizations

**ONLY proceed if you use Auth0 Organizations.**

### Export Organizations from Auth0

Use Auth0 Management API to paginate through organizations:

```bash
# Get first page
curl -X GET "https://{your-domain}.auth0.com/api/v2/organizations" \
  -H "Authorization: Bearer {management_api_token}"

# Note: API is paginated, repeat with cursor tokens
```

### Create Organizations in WorkOS

For each Auth0 organization, call Create Organization API:

```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "domains": ["acme.com"]
  }'
```

**Save mapping:** Auth0 org ID → WorkOS org ID (you'll need this for memberships).

### Add User Memberships

Match users to organizations using Auth0's bulk export data, then add memberships:

```bash
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H...",
    "organization_id": "org_01H..."
  }'
```

**Verify memberships:**

```bash
# List memberships for an org
curl -X GET https://api.workos.com/user_management/organization_memberships?organization_id=org_01H... \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match expected member count
```

## Step 8: Configure Social Auth Providers

**ONLY proceed if users sign in via Google, Microsoft, etc.**

### Supported Providers

WorkOS supports these Auth0 social auth equivalents:

- Google OAuth
- Microsoft OAuth
- GitHub OAuth
- Apple OAuth

See: https://workos.com/docs/integrations for provider-specific setup guides.

### Provider Configuration (Before Migration)

1. Go to WorkOS Dashboard → Redirects
2. Configure OAuth redirect URLs for your app
3. For each provider:
   - Navigate to Integrations → [Provider Name]
   - Add OAuth client ID and secret from provider console
   - Enable provider

**Critical:** Configure providers BEFORE importing users. Users will auto-link on first sign-in via email match.

### Auto-Linking Behavior

When a user signs in via social auth:

1. WorkOS matches by email address
2. If email matches imported user → auto-links
3. If email not verified by provider → user must verify in WorkOS

**Known verified providers (skip WorkOS verification):**

- Google with `@gmail.com` domain
- Microsoft with verified domains

**All others:** User will need to verify email through WorkOS if email verification is enabled.

## Step 9: Handle MFA Migration

**Critical difference:** WorkOS does NOT support SMS-based MFA (security reasons).

### SMS MFA Users (BREAKING CHANGE)

Auth0 users with SMS-based second factors have two options:

1. **Switch to Magic Auth** (email-based, passwordless)
2. **Re-enroll in TOTP MFA** (authenticator app like Google Authenticator)

**User communication required:** Notify SMS MFA users BEFORE migration that they will need to re-enroll.

### TOTP MFA Users (NO ACTION)

Users with authenticator apps can re-enroll after migration. Their existing TOTP secrets cannot be exported from Auth0.

**Migration flow:**

1. User logs in to WorkOS app
2. Prompt to set up MFA again
3. User scans new QR code with authenticator app

## Verification Checklist (ALL MUST PASS)

Run these commands AFTER migration to confirm success:

```bash
# 1. Check user count matches Auth0 export
wc -l users_export.json  # Count Auth0 users
curl -X GET https://api.workos.com/users -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Numbers should match

# 2. Test password login (if passwords imported)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Content-Type: application/json" \
  -d '{"client_id": "'$WORKOS_CLIENT_ID'", "email": "test@example.com", "password": "test_password"}'
# Should return 200 with session

# 3. Check org memberships (if orgs migrated)
curl -X GET https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match expected membership count

# 4. Test social auth (if configured)
# Manually: Sign in via provider in app, check auto-link works

# 5. Check email verification settings
curl -X GET https://api.workos.com/user_management/authentication \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.settings.email_verification'
# Should show your desired setting
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in Auth0 export or re-running import script.

**Fix:**

1. Check for duplicates: `cat users_export.json | jq '.email' | sort | uniq -d`
2. Skip existing users: Use `ListUsers` API to check before creating
3. Or use idempotency key: Add `idempotency_key` header to Create User calls

### "Invalid password hash" error

**Cause:** Incorrect `password_hash_type` or malformed hash.

**Fix:**

1. Verify hash format: Auth0 bcrypt hashes start with `$2a$` or `$2b$`
2. Ensure `password_hash_type` is exactly `"bcrypt"` (lowercase)
3. Check hash wasn't truncated during export/import

### "Organization not found" during membership creation

**Cause:** Organization not created yet or incorrect ID.

**Fix:**

1. Verify org created: `curl https://api.workos.com/organizations/{org_id} -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Check ID mapping: Ensure you saved Auth0 org ID → WorkOS org ID mapping
3. Create org first if missing, then retry membership

### Social auth user not auto-linking

**Cause:** Email mismatch or email not verified by provider.

**Fix:**

1. Check email match: `curl https://api.workos.com/users?email={user_email} -H "Authorization: Bearer $WORKOS_API_KEY"`
2. If email verified by known provider (e.g., Gmail) but still not linking:
   - Check WorkOS Dashboard → Settings → Authentication → Email Verification is not blocking
3. If unverified provider: User must complete email verification in WorkOS

### Management API token expired (Auth0 export)

**Cause:** Auth0 Management API tokens expire after 24 hours.

**Fix:**

1. Generate new token: Auth0 Dashboard → Applications → Machine to Machine
2. Grant scopes: `read:organizations`, `read:users`
3. Copy new token, retry export

### Rate limit errors during bulk import

**Cause:** Too many API calls too quickly.

**Fix:**

1. Add delays between calls: `sleep 0.1` in script
2. Use batch operations if available in migration tool
3. Contact WorkOS support for temporary rate limit increase

## Post-Migration Tasks

After verification passes:

1. **Update application code:** Replace Auth0 SDK calls with WorkOS AuthKit (see related skills)
2. **Test authentication flows:** Password login, social auth, MFA enrollment
3. **Notify users:** Send migration announcement, highlight MFA re-enrollment if needed
4. **Monitor errors:** Check WorkOS Dashboard → Logs for auth failures
5. **Decommission Auth0:** Only after confirming WorkOS auth works in production

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit into Next.js app
- workos-authkit-react - Integrate AuthKit into React app
- workos-authkit-vanilla-js - Integrate AuthKit into vanilla JavaScript app
