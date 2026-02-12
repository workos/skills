---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the fetched documentation, follow the documentation.

## Step 2: Pre-Migration Assessment

### Cognito User Pool Audit

Determine what types of authentication exist in your Cognito User Pool:

```bash
# List Cognito user pools
aws cognito-idp list-user-pools --max-results 60

# Describe specific pool to see auth providers
aws cognito-idp describe-user-pool --user-pool-id <pool-id>
```

Document:

- **Password-based users**: Count and determine reset strategy
- **OAuth providers**: Google, Facebook, Apple, SAML, OIDC (note: Client IDs/Secrets)
- **MFA settings**: SMS, TOTP, hardware tokens
- **Custom attributes**: Will need mapping to WorkOS user metadata

### Critical Cognito Limitation

**Cognito does not export password hashes.** You CANNOT migrate existing passwords directly.

```
Can you export password hashes from Cognito?
  |
  +-- NO --> All password users MUST reset passwords
```

This is a Cognito export limitation, not a WorkOS import limitation. WorkOS supports password hash import, but Cognito doesn't provide the hashes.

## Step 3: WorkOS Environment Setup

### Create Organization and Connection

1. Log into WorkOS Dashboard
2. Navigate to Organizations
3. Create organization for your user base
4. Note the `organization_id` (starts with `org_`)

### Configure Authentication Methods

Based on Step 2 assessment:

#### For Password Users (Decision Tree)

```
Password reset strategy?
  |
  +-- Forced reset on first login
  |     --> Implement login flow that calls Send Password Reset API
  |     --> Store migration flag in user metadata
  |
  +-- Proactive email campaign
        --> Export Cognito users to CSV
        --> Batch call Send Password Reset API
        --> Track sent emails to avoid duplicates
```

#### For OAuth Provider Users

For EACH OAuth provider (Google, Facebook, etc.) in Cognito:

1. **Find Cognito credentials**: AWS Console → Cognito → User Pool → App Integration → Identity Providers
2. **Copy to WorkOS**: Dashboard → Authentication → Connections → Add Connection
3. **Use EXACT SAME Client ID and Client Secret** — do not create new OAuth apps
4. **Add WorkOS redirect URI** to OAuth provider:
   - WorkOS callback URL: `https://api.workos.com/sso/oauth/<provider>/callback`
   - Add this to provider's authorized redirect URIs list

**Example: Google OAuth Migration**

```bash
# Find Cognito Google OAuth settings
aws cognito-idp describe-identity-provider \
  --user-pool-id <pool-id> \
  --provider-name Google

# Note: client_id and client_secret from output
# Then in Google Cloud Console:
# APIs & Services → Credentials → OAuth 2.0 Client ID → Add URI:
# https://api.workos.com/sso/oauth/google/callback
```

**Verification**: User should authenticate to WorkOS without re-authorizing Google.

## Step 4: User Data Export

### Export User List

```bash
# Export all Cognito users
aws cognito-idp list-users \
  --user-pool-id <pool-id> \
  --limit 60 \
  > cognito-users.json

# For pools >60 users, use pagination
aws cognito-idp list-users \
  --user-pool-id <pool-id> \
  --pagination-token <token>
```

### Transform to WorkOS Format

Parse `cognito-users.json` and map fields:

```
Cognito Field              --> WorkOS Field
Username                   --> email (or email attribute if different)
Attributes['email']        --> email
Attributes['given_name']   --> first_name
Attributes['family_name']  --> last_name
Attributes['custom:*']     --> user metadata object
UserCreateDate            --> created_at (informational only)
```

**Critical**: Cognito usernames may not be email addresses. Check `email` attribute explicitly.

## Step 5: User Import to WorkOS

### Import Users via API

Use the User Management API to create users in WorkOS:

```bash
# Example: Create single user
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "email_verified": true,
    "organization_id": "org_123"
  }'
```

**Batch import pattern**:

1. Read transformed user data from Step 4
2. For each user, POST to `/user_management/users`
3. Store mapping: `cognito_user_id` → `workos_user_id` for reference
4. Handle errors: duplicate emails, invalid formats, rate limits

**Do NOT attempt to import passwords** — Cognito does not export them.

## Step 6: Password Reset Strategy Implementation

Choose ONE strategy from Step 3 decision tree:

### Strategy A: Forced Reset on First Login

Implement in your login flow:

```typescript
// Pseudocode: Login handler
async function handleLogin(email: string, password: string) {
  try {
    // Attempt WorkOS authentication
    const session = await authenticateWithWorkOS(email, password);
    return session;
  } catch (error) {
    if (error.code === "invalid_credentials") {
      // Check if user is migrated but hasn't reset password
      const user = await getUserByEmail(email);
      if (user.metadata?.cognitoMigrated && !user.metadata?.passwordReset) {
        // Trigger password reset
        await fetch("https://api.workos.com/user_management/password_reset", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WORKOS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password_reset_url: "https://yourapp.com/reset-password",
          }),
        });
        return { requiresPasswordReset: true };
      }
    }
    throw error;
  }
}
```

### Strategy B: Proactive Email Campaign

Batch trigger password resets:

```bash
# For each migrated user
while IFS=, read -r email; do
  curl -X POST https://api.workos.com/user_management/password_reset \
    -H "Authorization: Bearer ${WORKOS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password_reset_url\": \"https://yourapp.com/reset-password\"
    }"
  sleep 0.1  # Rate limit protection
done < migrated-users.csv
```

## Step 7: Application Code Migration

### Update Authentication Calls

Replace Cognito SDK calls with WorkOS SDK:

```
Cognito Pattern                          --> WorkOS Pattern
InitiateAuth (username/password)        --> AuthKit sign-in flow
GetUser (access token validation)       --> getUser() with session
AdminCreateUser                         --> User Management API
ConfirmSignUp (email verification)      --> Email verification via AuthKit
```

**Example: Sign-in flow migration**

Before (Cognito):

```typescript
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
const command = new InitiateAuthCommand({
  AuthFlow: "USER_PASSWORD_AUTH",
  ClientId: process.env.COGNITO_CLIENT_ID,
  AuthParameters: {
    USERNAME: email,
    PASSWORD: password,
  },
});
const response = await client.send(command);
```

After (WorkOS - use AuthKit):

```typescript
// Redirect to AuthKit hosted UI
const authUrl = getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  provider: "authkit",
});
```

For server-side authentication, see `Related Skills` section.

### Update Session Management

Replace Cognito tokens with WorkOS sessions:

- **Cognito Access Token** → WorkOS session cookie (managed by AuthKit middleware)
- **Cognito Refresh Token** → WorkOS handles refresh automatically
- **Cognito ID Token claims** → `session.user` object from `getUser()`

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration readiness:

```bash
# 1. Verify WorkOS API credentials
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/organizations | jq '.data[0].id'
# Should return organization ID

# 2. Verify OAuth connections (if migrating OAuth users)
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/connections" | jq '.data[] | {type, state}'
# Should show active connections for each OAuth provider

# 3. Verify user import (spot check)
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/users?email=test@example.com" | jq '.data[0].id'
# Should return user ID if user was imported

# 4. Verify password reset API access
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password_reset_url":"https://test.com"}' \
  -o /dev/null -w "%{http_code}\n"
# Should return 201

# 5. Verify application builds
npm run build
# or
yarn build
```

## Error Recovery

### "User already exists" during import

**Cause**: Duplicate email in WorkOS organization.

**Fix**:

1. Fetch existing user: `GET /user_management/users?email={email}`
2. Update user metadata instead: `PUT /user_management/users/{id}`
3. Skip import, log for reconciliation

### OAuth users cannot authenticate

**Root cause**: WorkOS redirect URI not added to OAuth provider.

**Fix**:

1. Check provider's OAuth app settings (Google Console, Facebook App, etc.)
2. Add `https://api.workos.com/sso/oauth/<provider>/callback` to authorized redirect URIs
3. Verify Client ID/Secret match Cognito's EXACTLY

### Password reset emails not sending

**Cause 1**: `password_reset_url` domain not verified in WorkOS Dashboard.

**Fix**: Dashboard → Settings → Domains → Add domain

**Cause 2**: User email not verified in WorkOS.

**Fix**: Set `email_verified: true` during user import (Step 5)

### "Invalid credentials" for OAuth-only users

**Root cause**: User has no password in WorkOS (correct behavior).

**Fix**: Do not prompt for password. Redirect directly to OAuth provider:

```typescript
// Detect OAuth-only user
if (user.identities.length > 0 && !user.passwordSet) {
  // Redirect to OAuth provider flow
  redirectToOAuthProvider(user.identities[0].type);
}
```

### Rate limit errors during batch import

**Cause**: Exceeding WorkOS API rate limits.

**Fix**: Add exponential backoff:

```bash
# Retry with backoff
for i in {1..5}; do
  response=$(curl -w "%{http_code}" -o /dev/null ...)
  if [ "$response" -eq 201 ]; then break; fi
  sleep $((2**i))
done
```

### Cognito users have custom attributes not in WorkOS

**Cause**: Cognito allows custom user attributes (`custom:*`), WorkOS uses freeform metadata.

**Fix**: Map to WorkOS user metadata object:

```json
{
  "email": "user@example.com",
  "user_metadata": {
    "cognitoCustomField": "value",
    "department": "engineering"
  }
}
```

## Related Skills

- **workos-authkit-nextjs**: If using Next.js for application (recommended)
- **workos-authkit-react**: If using React SPA
- **workos-authkit-base**: For other frameworks
