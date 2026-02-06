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

### Data Inventory

Determine what you're migrating:

```
User authentication method?
  |
  +-- Username/Password --> Proceed to Step 3 (Export users)
  |
  +-- OAuth (Google, etc.) --> Proceed to Step 4 (Identity provider migration)
  |
  +-- Both --> Complete both Step 3 AND Step 4
```

### WorkOS Environment Check

Verify in `.env` or `.env.local`:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_ORGANIZATION_ID` - required for user import

**Verify:** Run `grep WORKOS_ .env* 2>/dev/null` — all three variables must exist.

## Step 3: Username/Password Migration

### Export Users from AWS Cognito

**CRITICAL:** AWS Cognito password hashes are NOT exportable. You have two migration strategies:

**Strategy A: Forced Password Reset (Recommended)**
- Export user emails/identities only
- Import to WorkOS without passwords
- Trigger password reset for all users

**Strategy B: Just-In-Time Migration**
- Keep Cognito running temporarily
- Migrate users on first successful login
- Requires custom authentication proxy

Choose Strategy A unless you have regulatory requirements for seamless migration.

### Export User Data

Use AWS CLI to export Cognito user pool:

```bash
# List users (paginated)
aws cognito-idp list-users \
  --user-pool-id <YOUR_POOL_ID> \
  --attributes-to-get email,name,email_verified \
  > cognito-users.json
```

**Transform to WorkOS format:**

Parse `cognito-users.json` and create NDJSON (newline-delimited JSON):

```json
{"email":"user@example.com","email_verified":true,"first_name":"John","last_name":"Doe"}
{"email":"user2@example.com","email_verified":false,"first_name":"Jane","last_name":"Smith"}
```

Key field mappings:
- `Username` → `email` (if using email as username)
- `Attributes.email` → `email`
- `Attributes.email_verified` → `email_verified`
- `Attributes.name` → `first_name` / `last_name` (split if needed)

### Import to WorkOS

Use WorkOS User Management API to bulk import:

```bash
# Create import job
curl -X POST https://api.workos.com/user_management/organization_memberships/import \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"${WORKOS_ORGANIZATION_ID}"'",
    "users": [...array of user objects...]
  }'
```

**Verify:** Check WorkOS Dashboard → Users — imported users appear with "Password reset required" status.

## Step 4: OAuth Provider Migration

**Key insight:** You do NOT need to re-authenticate users. Reuse existing OAuth credentials.

### For Each OAuth Provider (Google, Facebook, etc.)

#### Copy Credentials

1. Log into AWS Cognito Console
2. Navigate to: User Pools → Your Pool → App Integration → Identity Providers
3. For each provider, note:
   - Client ID
   - Client Secret
   - Authorized scopes

#### Configure in WorkOS

1. Go to WorkOS Dashboard → Connections → Create Connection
2. Select same provider (e.g., Google OAuth)
3. **Use identical credentials:**
   - Paste same Client ID from Cognito
   - Paste same Client Secret from Cognito
4. Configure authorized domains

#### Update OAuth Provider Settings

**CRITICAL:** Add WorkOS callback URL to provider's authorized redirect URIs.

For Google (example):
1. Go to Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs
2. Find your Client ID (same one used in Cognito)
3. Add to "Authorized redirect URIs":
   ```
   https://api.workos.com/sso/oauth/google/callback
   ```

Repeat for each provider. Do NOT remove Cognito callback URLs yet — keep both during migration.

**Verify:** Test sign-in flow via WorkOS — users should authenticate without re-authorizing.

## Step 5: Password Reset Strategy

**Decision Tree:**

```
When to reset passwords?
  |
  +-- Proactive (email all users) --> Use WorkOS Password Reset API
  |
  +-- On-demand (at next login)   --> Configure in WorkOS Dashboard
```

### Proactive Password Reset

For each imported user, trigger reset email:

```bash
# Send password reset email
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Batch this with rate limiting (max 10 req/sec recommended).

### On-Demand Password Reset

Configure in WorkOS Dashboard:
1. Settings → Authentication → Security
2. Enable "Require password reset on first login"
3. Customize reset email template

## Step 6: Update Application Code

### Remove AWS Cognito SDK

Find and remove:

```bash
# Check for Cognito dependencies
grep -r "amazon-cognito-identity-js\|aws-sdk.*cognito" package.json

# Check for Cognito imports
grep -r "CognitoUser\|CognitoUserPool" src/ app/
```

Uninstall packages:

```bash
npm uninstall amazon-cognito-identity-js aws-sdk
# or
yarn remove amazon-cognito-identity-js aws-sdk
```

### Replace Authentication Calls

**Pattern mapping:**

```javascript
// OLD - AWS Cognito
import { CognitoUserPool } from 'amazon-cognito-identity-js';
const userPool = new CognitoUserPool({...});
const session = await userPool.getCurrentUser();

// NEW - WorkOS
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const session = await workos.userManagement.getUser(userId);
```

**Critical endpoints to update:**

1. Sign in → Use WorkOS AuthKit redirect
2. Sign up → Use WorkOS User Management API
3. Get user profile → Use WorkOS `getUser()`
4. Sign out → Clear WorkOS session

See [workos-authkit-nextjs](workos-authkit-nextjs) skill for full integration pattern.

## Step 7: Parallel Run (Recommended)

**Strategy for zero-downtime migration:**

```
Phase 1 (Week 1): Deploy WorkOS integration alongside Cognito
  - Both auth systems operational
  - New users go to WorkOS
  - Existing users still use Cognito

Phase 2 (Week 2): Start migrating active users
  - Trigger password resets in batches
  - Monitor error rates
  - Keep Cognito as fallback

Phase 3 (Week 3): Complete migration
  - Migrate remaining users
  - Disable Cognito sign-ins
  - Monitor for 48 hours

Phase 4 (Week 4): Cleanup
  - Remove Cognito SDK
  - Delete Cognito user pool
  - Remove fallback code
```

**Rollback plan:** Keep Cognito pool active but read-only for 30 days minimum.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Cognito SDK removed
! grep -r "amazon-cognito-identity" package.json && echo "PASS" || echo "FAIL: Cognito still installed"

# 2. WorkOS env vars set
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS" || echo "FAIL: API key missing or invalid"

# 3. WorkOS SDK imported
grep -r "@workos-inc" src/ app/ && echo "PASS" || echo "FAIL: WorkOS SDK not used"

# 4. User count matches
# Compare: AWS Cognito user count vs. WorkOS Dashboard user count
aws cognito-idp list-users --user-pool-id <POOL_ID> --max-results 1 | grep -o '"PaginationToken"' | wc -l

# 5. OAuth providers configured
# Verify in WorkOS Dashboard: Connections → count matches Cognito provider count

# 6. Application builds
npm run build && echo "PASS" || echo "FAIL: Build errors"
```

**If verification #4 fails:** User counts don't match. Check import job status in WorkOS Dashboard → Imports.

## Error Recovery

### "User not found" after migration

**Root cause:** User email doesn't match between Cognito and WorkOS.

Fix:
1. Check Cognito export: `jq '.Users[].Attributes[] | select(.Name=="email")' cognito-users.json`
2. Verify WorkOS import used lowercase emails (WorkOS is case-sensitive)
3. Re-import with normalized emails: `email.toLowerCase()`

### "Invalid OAuth configuration"

**Root cause:** WorkOS callback URL not added to provider settings.

Fix:
1. Check provider error message for redirect_uri
2. Add WorkOS callback URL to provider console (see Step 4)
3. Wait 5 minutes for DNS propagation
4. Retry authentication

### "Password reset emails not sending"

**Root cause:** Email domain not verified or rate limit exceeded.

Fix:
1. Check WorkOS Dashboard → Settings → Email → Domain Verification
2. If hitting rate limits: Batch sends with delays
   ```bash
   while read email; do
     curl -X POST ... -d "{\"email\":\"$email\"}"
     sleep 0.5  # 2 req/sec max
   done < emails.txt
   ```

### "Users can still sign in with Cognito"

**Root cause:** Application still has Cognito authentication code paths.

Fix:
1. Search for Cognito imports: `grep -r "CognitoUser" src/`
2. Remove or wrap in feature flag for graceful deprecation
3. Update environment to prioritize WorkOS: Check auth flow order

### OAuth users lose access after migration

**Root cause:** Provider Client ID/Secret mismatch or callback URL not added.

Fix:
1. Verify identical credentials: Cognito Client ID === WorkOS Connection Client ID
2. Check provider's authorized redirect URIs includes WorkOS callback
3. Test with fresh incognito session (clear cookies/tokens)
4. If still failing: Create new connection in WorkOS and re-authorize users

### Import job stuck or failed

**Root cause:** Invalid user data format or API rate limiting.

Fix:
1. Check WorkOS Dashboard → Imports → View Details for specific errors
2. Common issues:
   - Invalid email format → Validate with regex before import
   - Duplicate emails → Deduplicate in preprocessing
   - Missing required fields → Check NDJSON has `email` for every user
3. For large imports (>10K users): Use pagination and retry logic

## Related Skills

- [workos-authkit-nextjs](workos-authkit-nextjs) - Full WorkOS AuthKit integration for Next.js
- [workos-user-management](workos-user-management) - Managing users and organizations after migration
