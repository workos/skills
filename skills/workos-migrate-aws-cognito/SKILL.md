---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- generated -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Current AWS Cognito State

Audit your existing Cognito setup:

```bash
# List user pools
aws cognito-idp list-user-pools --max-results 60

# Get user pool details (replace POOL_ID)
aws cognito-idp describe-user-pool --user-pool-id POOL_ID

# Count users in pool
aws cognito-idp list-users --user-pool-id POOL_ID --query 'Users | length(@)'
```

Document:
- **Total user count** - determines migration strategy (bulk vs incremental)
- **Authentication methods** - password, OAuth providers (Google, Facebook, etc.)
- **OAuth provider credentials** - Client IDs and Secrets for each provider
- **Custom attributes** - any non-standard user fields you need to preserve

### WorkOS Environment Setup

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_ORGANIZATION_ID` (optional) - for multi-tenant setups

**Verify API key permissions:**

```bash
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Should return 200 with user list (empty is fine).

## Step 3: Migration Strategy (Decision Tree)

```
User count?
  |
  +-- <1000 --> Bulk import (Step 4A)
  |
  +-- 1000-10000 --> Incremental import (Step 4B)
  |
  +-- >10000 --> Contact WorkOS for batch import tooling
```

```
Auth methods?
  |
  +-- Password only --> Export users, import to WorkOS (Step 4)
  |
  +-- OAuth providers --> Migrate credentials first (Step 5), then users
  |
  +-- Both --> OAuth credentials (Step 5) → then users (Step 4)
```

## Step 4A: Bulk Password User Import (Under 1000 users)

### Export from Cognito

```bash
# Export all users (save to users.json)
aws cognito-idp list-users --user-pool-id POOL_ID > users.json

# Extract email and hashed password
jq -r '.Users[] | {email: (.Attributes[] | select(.Name=="email") | .Value), password_hash: .UserStatus}' users.json
```

**CRITICAL:** AWS Cognito does NOT export password hashes. You have two options:

1. **Trigger password resets** (recommended) - Import users without passwords, force reset on first login
2. **JIT migration** (Step 4B) - Migrate users on their next successful login

### Import to WorkOS (Without Passwords)

Use WorkOS User Management API to create users:

```bash
# Example: Create single user
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "John",
    "last_name": "Doe"
  }'
```

**Batch script pattern:**

```javascript
// migrate-users.js
const users = require('./users.json');
const WorkOS = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUsers() {
  for (const user of users.Users) {
    const email = user.Attributes.find(a => a.Name === 'email')?.Value;
    if (!email) continue;
    
    try {
      await workos.userManagement.createUser({
        email,
        emailVerified: user.UserStatus === 'CONFIRMED'
      });
      console.log(`✓ Imported ${email}`);
    } catch (err) {
      console.error(`✗ Failed ${email}:`, err.message);
    }
  }
}

importUsers();
```

Run: `node migrate-users.js`

### Trigger Password Resets

Use WorkOS Send Password Reset Email API:

```bash
# For each imported user
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_reset_url": "https://yourapp.com/reset-password"
  }'
```

**Verify:** Check that password reset emails are delivered. Test with 2-3 users before bulk send.

## Step 4B: Incremental/JIT Migration (1000+ users)

**Pattern:** Keep Cognito running, migrate users on successful login.

### Implementation Flow

```
User logs in
  |
  +-- Check WorkOS for user
  |     |
  |     +-- Exists --> Authenticate with WorkOS
  |     |
  |     +-- Not found --> Authenticate with Cognito
  |           |
  |           +-- Success --> Create user in WorkOS, set password, redirect
  |           |
  |           +-- Failure --> Show error
```

### Code Pattern (Node.js example)

```javascript
// login-handler.js
async function handleLogin(email, password) {
  // 1. Try WorkOS first
  try {
    const session = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID
    });
    return { success: true, source: 'workos', session };
  } catch (err) {
    // User not in WorkOS, try Cognito
  }

  // 2. Fall back to Cognito
  try {
    const cognitoAuth = await authenticateWithCognito(email, password);
    
    // 3. Migrate user to WorkOS
    const user = await workos.userManagement.createUser({
      email,
      emailVerified: true
    });
    
    await workos.userManagement.resetPassword({
      userId: user.id,
      password, // Set the password they just used
      passwordHash: null
    });
    
    // 4. Authenticate with WorkOS for session
    const session = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID
    });
    
    return { success: true, source: 'migrated', session };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

**CRITICAL:** This requires both systems running in parallel. Monitor migration progress:

```bash
# Daily count of users in WorkOS
curl -X GET https://api.workos.com/user_management/users?limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total'
```

## Step 5: OAuth Provider Migration

**CRITICAL:** Migrate OAuth credentials BEFORE migrating users who authenticate via OAuth.

### Cognito OAuth Credentials Export

For each OAuth provider (Google, Facebook, etc.):

1. Log into AWS Cognito Console
2. Navigate to User Pool → App Integration → Identity Providers
3. Document for each provider:
   - Client ID
   - Client Secret
   - Scopes
   - Authorized redirect URIs

### WorkOS OAuth Setup

For each provider:

1. **Add OAuth connection in WorkOS Dashboard:**
   - Go to Authentication → Connections → Add Connection
   - Select provider (e.g., Google OAuth)
   - **Use the SAME Client ID and Client Secret** from Cognito

2. **Update provider redirect URIs:**

   Add WorkOS callback URL to the OAuth provider (e.g., Google Cloud Console):
   
   ```
   https://api.workos.com/sso/oauth/google/callback
   ```

   **Example for Google:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Select your OAuth 2.0 Client ID
   - Add WorkOS redirect URI to "Authorized redirect URIs"
   - Save changes

**Verify OAuth setup:**

```bash
# Test OAuth flow
curl -X GET "https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&provider=GoogleOAuth"
```

Should return 302 redirect to Google login. If 400/401, check Client ID.

### Migrate OAuth Users

After OAuth credentials are migrated:

```javascript
// For each OAuth user in Cognito
const oauthUsers = users.Users.filter(u => 
  u.Attributes.find(a => a.Name === 'identities')
);

for (const user of oauthUsers) {
  const email = user.Attributes.find(a => a.Name === 'email')?.Value;
  const identities = JSON.parse(
    user.Attributes.find(a => a.Name === 'identities')?.Value || '[]'
  );
  
  // Create user in WorkOS
  await workos.userManagement.createUser({
    email,
    emailVerified: true
  });
  
  // User will re-authenticate via OAuth on next login
  // WorkOS will link the OAuth identity automatically
}
```

**CRITICAL:** Users must log in via OAuth once after migration to link their identity.

## Step 6: Custom Attributes Migration

If you have custom Cognito attributes:

```bash
# List custom attributes
aws cognito-idp describe-user-pool --user-pool-id POOL_ID | jq '.UserPool.SchemaAttributes[] | select(.Name | startswith("custom:"))'
```

**Decision tree:**

```
Custom attributes?
  |
  +-- None --> Skip to Step 7
  |
  +-- 1-5 attributes --> Use WorkOS user metadata field
  |
  +-- >5 or complex --> Store in separate database, link by user ID
```

### Store in WorkOS Metadata

WorkOS users have a `metadata` JSON field:

```javascript
await workos.userManagement.updateUser({
  userId: user.id,
  metadata: {
    cognitoCustom1: 'value1',
    cognitoCustom2: 'value2'
  }
});
```

## Step 7: Update Application Code

Replace Cognito SDK calls with WorkOS equivalents:

### Authentication

```javascript
// BEFORE (Cognito)
import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const authDetails = new AuthenticationDetails({ Username: email, Password: password });
cognitoUser.authenticateUser(authDetails, { /* ... */ });

// AFTER (WorkOS)
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const { user, accessToken } = await workos.userManagement.authenticateWithPassword({
  email,
  password,
  clientId: process.env.WORKOS_CLIENT_ID
});
```

### Session Management

```javascript
// BEFORE (Cognito)
cognitoUser.getSession((err, session) => {
  if (session.isValid()) { /* ... */ }
});

// AFTER (WorkOS with AuthKit)
import { getUser } from '@workos-inc/authkit-nextjs'; // Next.js example

const user = await getUser();
if (user) { /* authenticated */ }
```

### Password Reset

```javascript
// BEFORE (Cognito)
cognitoUser.forgotPassword({ /* ... */ });

// AFTER (WorkOS)
await workos.userManagement.sendPasswordResetEmail({
  email: 'user@example.com',
  passwordResetUrl: 'https://yourapp.com/reset-password'
});
```

**Verify:** Test each auth flow after code changes.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. WorkOS API access
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should return user count (>0 after import)

# 2. OAuth providers configured (if applicable)
curl -X GET "https://api.workos.com/user_management/authentication/providers" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.[] | .type'
# Should list OAuth providers (GoogleOAuth, etc.)

# 3. Password reset works
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password_reset_url":"http://localhost:3000/reset"}' \
  | jq '.user_id'
# Should return user_id (not error)

# 4. Application builds
npm run build
# Should exit 0

# 5. Test authentication flow
# Manually test login with migrated user
# Verify session persists across page loads
```

**Migration is complete when:**
- All users can authenticate via WorkOS
- OAuth flows work for linked providers
- Cognito can be decommissioned (or remains as fallback for JIT migration)

## Error Recovery

### "User not found" during password authentication

**Root cause:** User not imported to WorkOS yet.

Fix:
1. Check user exists in WorkOS: `curl https://api.workos.com/user_management/users?email=user@example.com -H "Authorization: Bearer $WORKOS_API_KEY"`
2. If missing, re-run import script for that user
3. For JIT migration, check Cognito authentication is still active as fallback

### OAuth provider "invalid_client" error

**Root cause:** Client ID/Secret mismatch between Cognito and WorkOS, or redirect URI not added.

Fix:
1. Verify Client ID matches: Check WorkOS Dashboard → Connections → [Provider] → Client ID
2. Check Client Secret is correct (re-enter in WorkOS if unsure)
3. Confirm redirect URI added to provider: 
   - Google: `https://api.workos.com/sso/oauth/google/callback`
   - GitHub: `https://api.workos.com/sso/oauth/github/callback`

### "Email already exists" during import

**Root cause:** User imported multiple times, or pre-existing in WorkOS.

Fix:
1. Add duplicate check to import script:
```javascript
const existing = await workos.userManagement.listUsers({ email });
if (existing.data.length > 0) {
  console.log(`Skipping ${email} - already exists`);
  continue;
}
```
2. For manual fixes, list users: `curl https://api.workos.com/user_management/users?email=user@example.com`

### Password reset email not received

**Root cause:** SMTP not configured, or WorkOS email domain not verified.

Fix:
1. Check WorkOS Dashboard → Settings → Email Configuration
2. Verify sender domain DNS records (SPF, DKIM)
3. Test with WorkOS support if needed: support@workos.com
4. Temporary workaround: Use custom password reset flow with your email provider

### Custom attributes lost after migration

**Root cause:** Custom attributes not mapped to WorkOS metadata.

Fix:
1. Export custom attributes from Cognito: `aws cognito-idp admin-get-user --user-pool-id POOL_ID --username EMAIL | jq '.UserAttributes[] | select(.Name | startswith("custom:"))'`
2. Update WorkOS user metadata:
```javascript
await workos.userManagement.updateUser({
  userId: user.id,
  metadata: { customAttr: value }
});
```
3. Update application code to read from `user.metadata.customAttr`

### JIT migration not triggering

**Root cause
