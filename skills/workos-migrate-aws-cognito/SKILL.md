---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

This is the source of truth for migration patterns. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Cognito User Pool Analysis

Identify what needs migration:

```bash
# 1. Count total users in Cognito pool
aws cognito-idp list-users --user-pool-id <POOL_ID> --query 'length(Users)'

# 2. Check authentication methods in use
aws cognito-idp describe-user-pool --user-pool-id <POOL_ID> \
  --query 'UserPool.{Providers:SupportedIdentityProviders,MFA:MfaConfiguration}'
```

### Authentication Methods Decision Tree

```
What auth methods are users using?
  |
  +-- Username/Password only
  |     --> Path A: Direct user import with password reset
  |
  +-- OAuth providers (Google, Facebook, etc.)
  |     --> Path B: Provider credential reuse
  |
  +-- MFA enabled
  |     --> Path C: MFA migration considerations
  |
  +-- Multiple methods
        --> Combination of above paths
```

## Step 3: WorkOS Environment Setup

### Dashboard Configuration

1. Log into WorkOS Dashboard
2. Navigate to Authentication → Settings
3. Note your environment values:
   - API Key (starts with `sk_`)
   - Client ID (starts with `client_`)

### Environment Variables

Add to `.env.local` or equivalent:

```bash
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
```

**Verify:**

```bash
# Check env vars are set (no empty output)
printenv | grep WORKOS_API_KEY
printenv | grep WORKOS_CLIENT_ID
```

## Step 4: Path A - Username/Password Migration

### Export Users from Cognito

```bash
# Export user data to JSON
aws cognito-idp list-users --user-pool-id <POOL_ID> \
  --output json > cognito_users.json
```

### Import Users into WorkOS

Use WorkOS Management API to create users. WebFetch the docs for current API endpoint:

WebFetch: `https://workos.com/docs/reference/user-management`

**Pattern:**

```typescript
// For each user from Cognito export
for (const cognitoUser of users) {
  await workos.userManagement.createUser({
    email: cognitoUser.Username,
    // Additional attributes per WorkOS API schema
  });
}
```

**Critical:** WorkOS does NOT support importing password hashes. Users MUST reset passwords.

### Trigger Password Resets

Choose reset strategy:

**Option 1: Reset on next sign-in**

Set a flag in your database marking users as "requires password reset". Check this flag during authentication and redirect to password reset flow.

**Option 2: Proactive password reset emails**

Send reset emails immediately after import:

```typescript
// For each imported user
await workos.userManagement.sendPasswordResetEmail({
  email: user.email,
  passwordResetUrl: 'https://yourdomain.com/reset-password'
});
```

WebFetch the Send Password Reset Email API for current parameters: `https://workos.com/docs/reference/user-management/password-reset/send`

## Step 5: Path B - OAuth Provider Migration

### Provider Credential Reuse

**CRITICAL:** Use the SAME OAuth credentials (Client ID, Client Secret) in WorkOS that you used in Cognito. This allows seamless migration without re-requesting user consent.

### Steps per Provider

1. In WorkOS Dashboard: Authentication → Social Providers
2. Configure provider (e.g., Google OAuth)
3. Use EXISTING Client ID and Client Secret from Cognito
4. Add WorkOS redirect URI to provider's allowed list

### Google OAuth Example

**Add WorkOS Redirect URI to Google Console:**

```
Cognito redirect URI: https://your-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
WorkOS redirect URI: https://api.workos.com/sso/oauth/google/callback
```

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Select your OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs": `https://api.workos.com/sso/oauth/google/callback`
4. Save

**Repeat for other providers** (Facebook, Apple, etc.). Each has a similar process.

WebFetch provider-specific guides: `https://workos.com/docs/integrations`

## Step 6: Path C - MFA Migration

### MFA Strategy Decision

```
Does Cognito pool use MFA?
  |
  +-- Yes, SMS-based
  |     --> Users must re-enroll phone numbers in WorkOS
  |
  +-- Yes, TOTP/Authenticator apps
  |     --> Users must re-scan QR codes in WorkOS
  |
  +-- Optional MFA
        --> Migrate users, prompt for MFA enrollment
```

**Important:** MFA secrets cannot be exported from Cognito. Users MUST re-enroll.

### MFA Enrollment Flow

After user migration, prompt users to enroll MFA:

WebFetch MFA API docs: `https://workos.com/docs/reference/mfa`

**Pattern:**

```typescript
// Check if user has MFA enrolled
const factors = await workos.mfa.listFactors({ userId: user.id });

if (factors.length === 0) {
  // Prompt user to enroll MFA
  // Redirect to WorkOS MFA enrollment flow
}
```

## Step 7: Update Application Code

### Replace Cognito SDK Calls

**Before (Cognito):**

```typescript
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
```

**After (WorkOS):**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### Authentication Flow Changes

**Sign In:**

```typescript
// Cognito: InitiateAuth command
// WorkOS: Redirect to WorkOS AuthKit

const authUrl = workos.userManagement.getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourdomain.com/callback',
  provider: 'authkit'
});
```

**Sign Out:**

Replace Cognito `globalSignOut` with WorkOS session termination.

WebFetch current session management patterns: `https://workos.com/docs/user-management/sign-out`

## Step 8: Cutover Strategy

### Parallel Run (Recommended)

1. Deploy WorkOS integration alongside Cognito (do not remove Cognito yet)
2. Direct NEW users to WorkOS
3. Migrate existing users in batches
4. Monitor error rates for both systems
5. Once all users migrated and stable, remove Cognito

### Big Bang (Higher Risk)

1. Export all Cognito users
2. Import all to WorkOS
3. Deploy new code with WorkOS
4. Send password reset emails to all users
5. Disable Cognito pool

**Decision criteria:** Use parallel run if you have >10k users or critical uptime requirements.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables are set
printenv | grep -E 'WORKOS_(API_KEY|CLIENT_ID)' || echo "FAIL: Missing WorkOS env vars"

# 2. WorkOS SDK is installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 3. Can authenticate with WorkOS API
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1 \
  | grep -q '"object":"list"' && echo "PASS: API auth works" || echo "FAIL: API auth failed"

# 4. OAuth providers configured (if using)
# Manual check: WorkOS Dashboard → Authentication → Social Providers
# Should see providers with "Connected" status

# 5. Test user can sign in with new WorkOS flow
# Manual test: Attempt sign-in at your application with test user
```

**Do not mark complete until checks 1-3 pass and manual checks succeed.**

## Error Recovery

### "Invalid API key" during user import

**Root cause:** Wrong API key environment (test vs production).

**Fix:**

1. Verify key starts with `sk_test_` or `sk_live_`
2. Check WorkOS Dashboard environment matches your app environment
3. Regenerate key if compromised

### "User already exists" during import

**Root cause:** Duplicate import attempt or user created via another method.

**Fix:**

```typescript
// Wrap create calls in try-catch
try {
  await workos.userManagement.createUser({ email });
} catch (error) {
  if (error.code === 'user_already_exists') {
    console.log(`Skipping existing user: ${email}`);
    continue;
  }
  throw error;
}
```

### OAuth provider "Redirect URI mismatch"

**Root cause:** WorkOS callback URL not added to provider's allowed list.

**Fix:**

1. Copy exact callback URL from WorkOS Dashboard (e.g., `https://api.workos.com/sso/oauth/google/callback`)
2. Add to provider console (Google Cloud, Facebook Developer, etc.)
3. Wait up to 5 minutes for provider to propagate changes
4. Retry authentication

### Users report "Invalid password" after migration

**Root cause:** Passwords cannot be migrated from Cognito to WorkOS.

**Expected behavior:** This is not an error. Users MUST reset passwords.

**Fix:**

1. Confirm password reset emails were sent
2. Check spam folders if users claim no email received
3. Provide clear UI messaging: "As part of our security upgrade, please reset your password"

### "Rate limit exceeded" during bulk import

**Root cause:** Too many API calls in short time window.

**Fix:**

```typescript
// Add delay between user imports
for (const user of users) {
  await importUser(user);
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
}
```

Or use WorkOS bulk import API if available (check fetched docs).

## Related Skills

- **workos-authkit-nextjs** - If migrating a Next.js app
- **workos-authkit-react** - If migrating a React SPA
- **workos-mfa** - For multi-factor authentication setup
- **workos-sso** - For enterprise SSO (if upgrading from Cognito user pools)
- **workos-magic-link** - Alternative passwordless authentication
