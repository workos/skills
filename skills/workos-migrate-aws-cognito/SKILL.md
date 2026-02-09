---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

This documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Assessment

### AWS Cognito Inventory

Identify what you're migrating FROM Cognito:

```bash
# Check Cognito User Pool configuration
aws cognito-idp describe-user-pool --user-pool-id <YOUR_POOL_ID>
```

Document current auth methods:
- Username/password users
- OAuth provider connections (Google, Facebook, etc.)
- MFA settings
- Custom attributes

### WorkOS Prerequisites

Verify in WorkOS Dashboard:
- Organization exists
- Environment created (dev/staging/prod)
- API keys generated (`WORKOS_API_KEY` starts with `sk_`)
- Directory sync connection configured if migrating to managed users

## Step 3: Migration Strategy (Decision Tree)

Choose migration approach based on user authentication method:

```
User auth method?
  |
  +-- Username/Password --> Bulk import (Step 4) + password reset (Step 5)
  |
  +-- OAuth (Google, etc.) --> Recreate OAuth connections (Step 6)
  |
  +-- Mixed --> Follow both paths
```

## Step 4: Bulk User Import (Username/Password)

### Export from Cognito

**CRITICAL:** Cognito does not export password hashes. You MUST trigger password resets after import.

Export user data:

```bash
# List all users from Cognito
aws cognito-idp list-users --user-pool-id <YOUR_POOL_ID> > cognito_users.json
```

Extract required fields:
- Email address (primary identifier)
- Username (if different from email)
- Custom attributes you want to preserve

### Import to WorkOS

Use WorkOS Management API to create users. Check migration docs for exact endpoint and payload format.

**Pattern for bulk import script:**

```bash
# Example structure - verify exact API from docs
curl -X POST "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true
  }'
```

**Verify import:** Check WorkOS Dashboard → Users to confirm imported count matches export count.

## Step 5: Password Reset Strategy (REQUIRED)

**CRITICAL:** Since Cognito password hashes cannot be exported, you MUST implement a password reset flow.

### Option A: Force Reset on Next Login

1. Mark all imported users as requiring password reset
2. Intercept first login attempt
3. Redirect to password reset flow using WorkOS Password Reset API

**Check docs for:** `POST /user_management/password_reset` endpoint usage

### Option B: Proactive Password Reset Emails

Send password reset emails to all migrated users:

```bash
# Example pattern - verify exact API from docs
for email in $(cat migrated_emails.txt); do
  curl -X POST "https://api.workos.com/user_management/password_reset" \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\"}"
done
```

**Decision criteria:**
- Small user base (<1000) → Proactive emails
- Large user base → Force reset on login (avoids email fatigue)

## Step 6: OAuth Provider Migration

For users who authenticate via Google, Facebook, etc.:

### Preserve OAuth Connections

**CRITICAL:** Use the SAME OAuth credentials in WorkOS as you used in Cognito.

For each OAuth provider in Cognito:

1. Export OAuth config from Cognito:
   ```bash
   aws cognito-idp describe-identity-provider \
     --user-pool-id <POOL_ID> \
     --provider-name <PROVIDER_NAME>
   ```

2. Note the Client ID and Client Secret

3. Configure OAuth connection in WorkOS Dashboard:
   - Go to Authentication → Social Connections
   - Add provider (e.g., Google OAuth)
   - Use SAME Client ID and Client Secret from Cognito
   - **CRITICAL:** Add WorkOS redirect URI to provider's allowed list

### Update Redirect URIs

**For Google OAuth example:**

1. Go to Google Cloud Console → OAuth consent screen
2. Find your OAuth Client ID used in Cognito
3. Add WorkOS redirect URI: `https://api.workos.com/sso/oauth/google/callback`
   (Check WorkOS docs for exact redirect URI format)

**Repeat for each OAuth provider** (Facebook, GitHub, etc.)

**Verification:** Test OAuth login for each provider to confirm connection works.

## Step 7: Update Application Code

### Replace Cognito SDK Calls

Map Cognito SDK calls to WorkOS equivalents:

```
Cognito Function             --> WorkOS Equivalent
-------------------------        -------------------
signIn()                     --> Use AuthKit sign-in flow
signOut()                    --> Use AuthKit sign-out
getCurrentUser()             --> getUser() from AuthKit
getSession()                 --> Session from middleware/route
```

Check WorkOS docs for exact SDK method names and signatures.

### Environment Variables

Remove Cognito variables, add WorkOS variables:

```bash
# Remove
- AWS_COGNITO_USER_POOL_ID
- AWS_COGNITO_CLIENT_ID
- AWS_REGION

# Add
+ WORKOS_API_KEY=sk_...
+ WORKOS_CLIENT_ID=client_...
+ NEXT_PUBLIC_WORKOS_REDIRECT_URI=...
+ WORKOS_COOKIE_PASSWORD=...  # 32+ characters
```

## Step 8: Cutover Plan

### Pre-Cutover Checklist

- [ ] All users imported to WorkOS
- [ ] OAuth connections tested for each provider
- [ ] Password reset emails queued or flow implemented
- [ ] Application code updated and tested in staging
- [ ] Rollback plan documented

### Cutover Steps

1. **Announce maintenance window** (if forcing simultaneous logout)
2. **Deploy application with WorkOS SDK** (replace Cognito calls)
3. **Update DNS/routing** to point to new auth endpoints
4. **Trigger password resets** (if using Option B from Step 5)
5. **Monitor error logs** for auth failures

### Rollback Plan

If migration fails:
- Revert application deployment to Cognito SDK version
- Re-enable Cognito User Pool
- Communicate incident to users

## Verification Checklist (ALL MUST PASS)

Run these checks after cutover:

```bash
# 1. Verify WorkOS API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | grep -q "data" && echo "PASS: API connected"

# 2. Check no Cognito SDK imports remain
grep -r "aws-amplify\|amazon-cognito-identity-js" src/ && echo "FAIL: Cognito SDK still imported" || echo "PASS: Cognito SDK removed"

# 3. Verify environment variables set
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" | wc -l | grep -q "2" && echo "PASS: WorkOS env vars set"

# 4. Check OAuth redirect URIs updated
# Manual: Log into each OAuth provider console and verify WorkOS redirect URI is present

# 5. Test full auth flow
# Manual: Sign in with username/password, sign in with OAuth, sign out
```

**If any check fails:** Do not proceed. Fix the issue before considering migration complete.

## Error Recovery

### "Invalid credentials" after cutover

**Root cause:** Password hashes not migrated (Cognito limitation)

**Fix:**
1. Confirm user exists in WorkOS Dashboard
2. Trigger password reset email for the user
3. User must complete password reset flow before signing in

### "OAuth provider connection failed"

**Root cause:** WorkOS redirect URI not added to OAuth provider's allowed list

**Fix:**
1. Check OAuth provider console (Google Cloud Console, Facebook App Dashboard, etc.)
2. Add WorkOS redirect URI to allowed callback URLs
3. Verify Client ID/Secret match between Cognito and WorkOS

Reference: See Step 6 for provider-specific instructions.

### "User not found" errors

**Root cause:** User import incomplete or failed

**Fix:**
1. Check WorkOS Dashboard user count vs. Cognito export count
2. Re-run import for missing users
3. Verify email addresses match exactly (case-sensitive)

### "Session expired immediately"

**Root cause:** `WORKOS_COOKIE_PASSWORD` not set or too short

**Fix:**
1. Generate 32+ character random string: `openssl rand -base64 32`
2. Set `WORKOS_COOKIE_PASSWORD` environment variable
3. Restart application

### Build fails with "WORKOS_API_KEY not found"

**Root cause:** Environment variable not loaded in build environment

**Fix:**
1. Add to `.env.local` for local development
2. Add to CI/CD pipeline environment variables
3. Confirm variable is available: `echo $WORKOS_API_KEY`

## Related Skills

- `workos-authkit-nextjs` — Implement WorkOS AuthKit in Next.js projects
- `workos-directory-sync` — Set up directory sync for enterprise SSO
