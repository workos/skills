---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- generated -->

# WorkOS Migration: AWS Cognito to AuthKit

## Step 1: Fetch Migration Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard configuration:

- Organization created in WorkOS Dashboard
- Directory Connection configured (if migrating directory sync)
- Authentication methods enabled that match Cognito setup

### Environment Variables

Verify in `.env.local` or equivalent:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` or equivalent callback URL

### Project Prerequisites

- WorkOS SDK installed (`@workos-inc/node` or `@workos-inc/authkit-nextjs`)
- Node.js 18+ (check `node --version`)
- Access to AWS Cognito User Pool export or API credentials

## Step 3: Migration Strategy Decision Tree

```
What are you migrating?
  |
  +-- Passwords + Usernames
  |     |
  |     +-- Export users from Cognito --> Step 4
  |     +-- Set up password reset flow --> Step 5
  |
  +-- OAuth/Social Logins (Google, etc.)
  |     |
  |     +-- Re-use same OAuth credentials --> Step 6
  |     +-- Add WorkOS redirect URIs --> Step 7
  |
  +-- SAML/Directory Sync
        |
        +-- Reconfigure IdP with WorkOS metadata --> Step 8
```

## Step 4: Export and Import Users (Username/Password)

### Export from AWS Cognito

AWS Cognito does not support password hash export. You have two options:

**Option A: User-triggered migration (RECOMMENDED)**

1. Export user list with email/username from Cognito (no passwords)
2. Import users to WorkOS as "password-less" (they'll reset on first login)
3. Configure password reset trigger on first sign-in attempt

**Option B: Bulk password reset**

1. Export user list from Cognito
2. Import to WorkOS
3. Proactively send password reset emails to all users

### Import Users to WorkOS

Use WorkOS User Management API to create users:

```bash
# Verify API access first
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Create users via API (see migration guide for bulk import script examples).

**Critical:** Users imported without passwords MUST go through password reset flow before first login.

## Step 5: Configure Password Reset Flow

### Determine Password Reset Strategy

```
When should users reset passwords?
  |
  +-- On first login attempt
  |     |
  |     +-- Implement "password not set" check in auth callback
  |     +-- Redirect to password reset if needed
  |
  +-- Proactively via email
        |
        +-- Send bulk password reset emails after import
        +-- Use WorkOS Send Password Reset Email API
```

### Implement Password Reset Trigger

**For first-login trigger:**

Add logic in auth callback route to check if user has password set:

```typescript
// Pseudocode - check migration guide for exact API
const user = await getUser();
if (user.passwordNotSet) {
  const resetUrl = await workos.userManagement.sendPasswordResetEmail({
    email: user.email,
  });
  // Redirect or show message
}
```

**For proactive bulk send:**

Script to send password reset emails to all imported users:

```typescript
// Batch process user list
for (const user of importedUsers) {
  await workos.userManagement.sendPasswordResetEmail({
    email: user.email,
    passwordResetUrl: 'https://yourapp.com/reset-password',
  });
}
```

**Verification:**

```bash
# Test password reset email sending
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Step 6: Migrate OAuth/Social Login Providers

### Re-use Existing OAuth Credentials

**CRITICAL:** Use the SAME Client ID and Client Secret in WorkOS that you used in AWS Cognito.

This allows users to maintain their OAuth connections without re-authorizing.

For each OAuth provider (Google, Microsoft, etc.):

1. Copy Client ID from AWS Cognito User Pool
2. Copy Client Secret from AWS Cognito User Pool  
3. Add to WorkOS Dashboard under Authentication → Social Providers

**Do NOT create new OAuth apps** — users would lose access and need to re-authorize.

## Step 7: Update OAuth Redirect URIs

### Add WorkOS Callback URLs to OAuth Providers

For each OAuth provider (example: Google):

1. Go to OAuth provider console (e.g., Google Cloud Console)
2. Find "Authorized redirect URIs" for your OAuth app
3. Add WorkOS callback URL alongside existing Cognito URL:
   - Existing: `https://yourapp.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
   - New: `https://api.workos.com/sso/oauth/google/callback` (check migration guide for exact URL)

**Keep both URLs** during migration period to avoid disruption.

**Verification per provider:**

```bash
# Check Google OAuth config has both redirect URIs
echo "Verify in Google Cloud Console:"
echo "1. APIs & Services → Credentials"
echo "2. Your OAuth 2.0 Client ID"
echo "3. Authorized redirect URIs lists both Cognito and WorkOS URLs"
```

See migration guide for provider-specific redirect URI formats.

## Step 8: Migrate SAML/Enterprise Connections (If Applicable)

If you have SAML connections in Cognito:

1. Get WorkOS SAML metadata URL from Dashboard
2. Reconfigure IdP (Okta, Azure AD, etc.) with WorkOS metadata
3. Test connection before removing Cognito metadata

**Parallel operation:** Keep both Cognito and WorkOS configured during migration window.

## Step 9: Update Application Code

### Replace Cognito SDK Calls

Identify all Cognito SDK usage:

```bash
# Find Cognito imports
grep -r "amazon-cognito-identity-js\|aws-sdk.*CognitoIdentityServiceProvider" .
```

Map Cognito functions to WorkOS equivalents:

```
Cognito                          --> WorkOS
CognitoUser.signIn()             --> AuthKit sign-in flow
CognitoUser.signOut()            --> workos.signOut()
CognitoUser.forgotPassword()     --> workos.userManagement.sendPasswordResetEmail()
getUserAttributes()              --> workos.userManagement.getUser()
```

Replace imports and function calls. See migration guide for code examples.

### Update Authentication Flows

If using AWS Amplify or Cognito Hosted UI:

1. Remove Amplify configuration
2. Implement WorkOS AuthKit (see `workos-authkit-nextjs` skill for Next.js)
3. Update login/logout UI to use WorkOS SDK

## Verification Checklist (ALL MUST PASS)

Run these checks before going live:

```bash
# 1. Verify WorkOS API connectivity
curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[0].email'

# 2. Check users imported successfully
curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should return count matching export from Cognito

# 3. Verify OAuth providers configured
echo "Check WorkOS Dashboard → Authentication → Social Providers"
echo "Each provider should show 'Connected' status"

# 4. Test password reset email
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_TEST_EMAIL"}' && echo "Check email inbox"

# 5. Verify no Cognito SDK imports remain
! grep -r "amazon-cognito-identity-js\|aws-sdk.*Cognito" src/ || echo "FAIL: Cognito SDK still in use"

# 6. Application builds successfully
npm run build
```

**Critical:** Test with real user accounts in staging before production migration.

## Error Recovery

### "User not found" after import

**Root cause:** User import API call failed or email mismatch.

Fix:

1. Check import script logs for API errors
2. Verify email format matches exactly (case-sensitive)
3. Re-run import for failed users

```bash
# Check if specific user exists
curl https://api.workos.com/user_management/users?email=user@example.com \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### "Invalid OAuth credentials"

**Root cause:** OAuth Client ID/Secret not copied correctly from Cognito.

Fix:

1. Go to AWS Cognito → User Pool → App Integration → App clients
2. Copy EXACT Client ID and Secret
3. Update in WorkOS Dashboard
4. Wait 5 minutes for propagation

### "Redirect URI mismatch" on OAuth login

**Root cause:** WorkOS callback URL not added to OAuth provider.

Fix:

1. Get exact callback URL from migration guide
2. Add to OAuth provider's authorized redirect URIs
3. Keep Cognito URL also listed (don't remove until migration complete)

### Password reset emails not sending

**Root cause:** Email provider not configured or invalid email template.

Fix:

1. Check WorkOS Dashboard → Authentication → Email Templates
2. Verify "From" address is verified
3. Test with different email domain (check spam folder)

```bash
# Verify email API responds
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' -v
# Should return 201 Created
```

### Users report "account doesn't exist" after migration

**Root cause:** OAuth connection not maintained (wrong credentials used).

Fix:

1. Verify you used SAME Client ID/Secret from Cognito (not new ones)
2. Re-import OAuth users with correct provider mapping
3. Check migration guide for provider-specific quirks

## Migration Cutover Checklist

Before removing Cognito:

- [ ] All users imported to WorkOS (count matches)
- [ ] Password reset emails tested and working
- [ ] OAuth logins tested for each provider
- [ ] Application code fully migrated (no Cognito SDK imports)
- [ ] Staging environment tested with real user accounts
- [ ] Rollback plan documented (keep Cognito active for 30 days)
- [ ] User communication sent (password reset instructions, new login URL if applicable)

**Parallel operation period:** Run both Cognito and WorkOS for 7-30 days before full cutover.

## Related Skills

- `workos-authkit-nextjs` - Implementing WorkOS authentication in Next.js
- `workos-user-management` - Managing users after migration
