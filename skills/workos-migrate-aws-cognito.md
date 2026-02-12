---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### AWS Cognito Export Capabilities (CRITICAL)

**Cognito limitation:** AWS Cognito does NOT export password hashes. This is a Cognito restriction, not a WorkOS limitation.

Migration strategy depends on what Cognito provides:

```
What can you export from Cognito?
  |
  +-- User profiles only (no passwords)
  |     --> Bulk import users to WorkOS
  |     --> Trigger password resets for all users
  |
  +-- OAuth provider connections (Google, etc.)
        --> Migrate provider credentials to WorkOS
        --> No password reset needed for OAuth users
```

**Action:** Export user data from AWS Cognito using AWS CLI or Console. Check what fields are available.

### WorkOS Prerequisites

Verify in WorkOS Dashboard before proceeding:

- Organization created
- Environment ID noted (starts with `org_`)
- API key generated (starts with `sk_`)

## Step 3: User Profile Import Decision Tree

```
User authentication method?
  |
  +-- Email/Password
  |     |
  |     +-- Cognito exports hashes? (NO - Cognito doesn't support this)
  |     |     --> Import profiles only
  |     |     --> Plan password reset strategy (Step 4)
  |     |
  |     +-- Using passwordless/magic links?
  |           --> Import profiles only
  |           --> No password reset needed
  |
  +-- OAuth (Google, GitHub, etc.)
  |     --> Migrate provider credentials (Step 5)
  |     --> Import user profiles
  |     --> Link existing OAuth tokens
  |
  +-- SAML SSO
        --> Migrate SAML connection to WorkOS
        --> Import user profiles
        --> No password handling needed
```

## Step 4: Password Reset Strategy (REQUIRED for email/password users)

Since Cognito doesn't export password hashes, you MUST choose a password reset approach:

### Option A: Reset on First Login (Recommended)

**Pattern:**

1. Import users without passwords
2. On first login attempt, detect missing password
3. Redirect to password reset flow
4. User sets new password via WorkOS

**Implementation:**

```bash
# After user import, trigger password reset on first login
# Use WorkOS Password Reset API
curl https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Option B: Proactive Email Campaign

**Pattern:**

1. Import all users
2. Send password reset emails to all users immediately
3. Users click link and set new password before needing to log in

**Implementation:**

Batch process all imported users:

```bash
# Loop through user list and send reset emails
while read email; do
  curl https://api.workos.com/user_management/password_reset \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\"}"
done < user_emails.txt
```

**Choose based on:**

- User count (proactive email = high volume risk)
- Support capacity (reset-on-login = more support tickets)
- User experience preference

## Step 5: OAuth Provider Migration

If users authenticate via Google, GitHub, Microsoft, etc., migrate provider credentials to WorkOS.

### Critical Requirement

**MUST use identical OAuth credentials** in WorkOS as used in Cognito:

- Same Client ID
- Same Client Secret

**Why:** This allows existing OAuth sessions to work without re-authorization.

### Add WorkOS Redirect URI

For each OAuth provider (example: Google):

1. Go to provider's developer console (e.g., Google Cloud Console)
2. Find your OAuth application
3. Add WorkOS callback URL to authorized redirect URIs:
   - Format: `https://api.workos.com/sso/oauth/google/callback`
   - Exact URL from: WebFetch docs for provider-specific callback

**Verification:**

```bash
# Test OAuth flow redirects to WorkOS
curl -I "https://api.workos.com/sso/authorize?..." \
  | grep -i location
# Should contain your OAuth provider's authorization URL
```

## Step 6: Bulk User Import

### Prepare User Data

Export from Cognito and transform to WorkOS format:

```json
{
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true
}
```

### Import via API

```bash
# Import single user
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true
  }'
```

**For bulk import:** Use WorkOS bulk import API if available (check fetched docs), or script the above in a loop with rate limiting.

## Step 7: Migration Cutover

### Pre-Cutover Checklist

Run these commands to verify readiness:

```bash
# 1. Verify WorkOS API connectivity
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -s -o /dev/null -w "%{http_code}\n"
# Expected: 200

# 2. Check user import count
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Expected: Match your Cognito user count

# 3. Verify OAuth redirect URIs (for each provider)
curl -I "https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https://api.workos.com/sso/oauth/google/callback" \
  | grep -i location
# Should not return 400 (invalid redirect_uri)

# 4. Test password reset flow
curl https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  -s -o /dev/null -w "%{http_code}\n"
# Expected: 201
```

### Cutover Steps

1. **Enable WorkOS authentication** in your application
2. **Disable Cognito authentication** (keep Cognito read-only for rollback)
3. **Monitor error logs** for authentication failures
4. **Track password reset volume** (expect spike if using reset-on-login)

### Rollback Plan

If cutover fails:

1. Re-enable Cognito authentication
2. Disable WorkOS authentication
3. Investigate errors from logs
4. Fix issues and retry cutover

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches Cognito export
COGNITO_USERS=$(aws cognito-idp list-users --user-pool-id YOUR_POOL_ID | jq '.Users | length')
WORKOS_USERS=$(curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
[ "$COGNITO_USERS" -eq "$WORKOS_USERS" ] && echo "PASS" || echo "FAIL: User count mismatch"

# 2. OAuth providers configured (example: Google)
curl -I "https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https://api.workos.com/sso/oauth/google/callback" \
  | grep -q "302 Found" && echo "PASS" || echo "FAIL: OAuth redirect not configured"

# 3. Password reset API functional
curl https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  -s -o /dev/null -w "%{http_code}\n" \
  | grep -q "201" && echo "PASS" || echo "FAIL: Password reset API error"

# 4. Application authenticates via WorkOS
# (Test login flow in your app - check network tab for workos.com API calls)
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in import batch or user already imported.

**Fix:**

1. Check WorkOS Dashboard for existing user
2. Update existing user instead of creating new:

```bash
curl -X PUT https://api.workos.com/user_management/users/USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Updated"}'
```

### "Invalid redirect_uri" for OAuth provider

**Cause:** WorkOS callback URL not added to provider's allowlist.

**Fix:**

1. Go to OAuth provider console (Google, GitHub, etc.)
2. Add exact callback URL from WorkOS docs
3. Wait 5 minutes for propagation
4. Retry OAuth flow

### Password reset emails not sending

**Cause:** Email configuration missing in WorkOS Dashboard.

**Fix:**

1. Go to WorkOS Dashboard > Authentication > Email Settings
2. Configure email provider (SendGrid, AWS SES, etc.)
3. Verify sender domain
4. Test email delivery

### High authentication failure rate after cutover

**Cause:** Users attempting old passwords (Cognito passwords not migrated).

**Expected:** This is normal if using reset-on-login strategy.

**Fix:**

1. Display clear password reset instructions on login page
2. Monitor password reset completion rate
3. Send proactive email campaign if reset rate is low

### OAuth users unable to sign in

**Cause:** OAuth Client ID/Secret mismatch between Cognito and WorkOS.

**Fix:**

1. Verify EXACT same credentials in both systems
2. Check OAuth provider console for credential issues
3. Test OAuth flow in isolation (bypass your app):

```bash
# Direct OAuth test
curl "https://api.workos.com/sso/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK&response_type=code&provider=google"
```

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS authentication UI in Next.js after migration
- workos-authkit-react — Integrate WorkOS authentication UI in React after migration
- workos-directory-sync.rules.yml — Sync users from corporate directories post-migration
- workos-migrate-other-services.rules.yml — Generic migration patterns for other identity providers
