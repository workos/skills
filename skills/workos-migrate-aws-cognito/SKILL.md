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

### Cognito User Pool Audit

Run AWS CLI to inventory what you're migrating:

```bash
# List user pools
aws cognito-idp list-user-pools --max-results 20

# Get pool details (replace POOL_ID)
aws cognito-idp describe-user-pool --user-pool-id POOL_ID

# Count users
aws cognito-idp list-users --user-pool-id POOL_ID --query 'Users | length(@)'
```

Document for each pool:
- Total user count
- Authentication methods in use (password, social providers, SAML)
- Custom attributes
- MFA configuration (SMS, TOTP, neither)

### Password Hash Reality Check (CRITICAL)

**Important limitation:** AWS Cognito does NOT export password hashes. You have two options:

1. **Force password reset** (recommended) - Import users WITHOUT passwords, trigger reset flow
2. **Just-in-time migration** - Keep Cognito running, migrate on first login

This skill covers Option 1 (bulk import + password reset). For Option 2, see Related Skills.

**Verify WorkOS support:** WorkOS CAN import password hashes from systems that export them (bcrypt, scrypt, etc.). The limitation here is Cognito's inability to export, not WorkOS's ability to import.

## Step 3: Export User Data

### Basic User Export

```bash
# Export to JSON (replace POOL_ID)
aws cognito-idp list-users \
  --user-pool-id POOL_ID \
  --output json > cognito-users.json
```

### Parse for WorkOS Format

Transform Cognito JSON to WorkOS import format:

```bash
# Extract key fields
jq '[.Users[] | {
  email: (.Attributes[] | select(.Name == "email") | .Value),
  first_name: (.Attributes[] | select(.Name == "given_name") | .Value // null),
  last_name: (.Attributes[] | select(.Name == "family_name") | .Value // null),
  email_verified: (.UserStatus == "CONFIRMED")
}]' cognito-users.json > workos-import.json
```

**Verify:** Output file contains valid JSON array with email field for each user.

## Step 4: WorkOS Organization Setup

### Decision Tree: Organization Structure

```
How are Cognito users organized?
  |
  +-- Single tenant (all users in one pool)
      --> Create ONE WorkOS organization
      --> Import all users to that org
  |
  +-- Multi-tenant (pool per customer)
      --> Create ONE WorkOS org per pool
      --> Map Cognito pool IDs to WorkOS org IDs
  |
  +-- Shared pool with custom attributes
      --> Create orgs based on custom:tenant_id attribute
      --> Filter users by attribute during import
```

Create organizations via Dashboard or API:

```bash
# API method (replace YOUR_API_KEY)
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Migrated from Cognito Pool XYZ",
    "domains": ["example.com"]
  }'
```

**Capture:** Save organization ID for import step.

## Step 5: Bulk User Import

### Import Users WITHOUT Passwords

Use WorkOS Admin Portal bulk import or Management API:

```bash
# Bulk import via API (requires organization_id)
curl -X POST https://api.workos.com/user_management/users/batch \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @workos-import.json
```

**CRITICAL:** Set `email_verified: true` for confirmed Cognito users to avoid re-verification emails.

### Import Rate Limits

- API: 100 users per request max
- For >10k users, use Admin Portal CSV upload (no rate limit)

**Verify import:**

```bash
# Check user count in WorkOS
curl https://api.workos.com/user_management/users?organization_id=ORG_ID \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  | jq '.data | length'
```

Compare with Cognito user count from Step 2.

## Step 6: Password Reset Strategy (DECISION REQUIRED)

Choose ONE approach:

### Option A: Force Reset on Next Login

Implement check in your auth flow:

```javascript
// After WorkOS authentication succeeds
if (user.password_reset_required) {
  // Redirect to password reset page
  const resetUrl = await getPasswordResetUrl(user.email);
  return redirect(resetUrl);
}
```

Mark users as needing reset during import (custom attribute or database flag).

### Option B: Proactive Email Campaign

Send reset emails immediately after import:

```bash
# Batch send password reset emails
cat workos-import.json | jq -r '.[].email' | while read email; do
  curl -X POST https://api.workos.com/user_management/password_reset \
    -H "Authorization: Bearer sk_YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\"}"
  sleep 0.1  # Rate limit safety
done
```

**Recommended:** Option A for better UX (users reset when they need to login, not immediately).

Reference: https://workos.com/docs/reference/user-management/password-reset/send-password-reset-email

## Step 7: Migrate Social Providers (If Applicable)

### OAuth Provider Migration

For each Cognito identity provider (Google, Facebook, etc.):

1. **Reuse OAuth credentials** — Use SAME Client ID and Client Secret in WorkOS
2. **Add WorkOS redirect URI** to provider's allowed callback list

Example for Google:

```
Cognito redirect:
  https://YOUR_DOMAIN.auth.REGION.amazoncognito.com/oauth2/idpresponse

WorkOS redirect (ADD this, keep Cognito):
  https://api.workos.com/sso/oauth/google/callback
```

Reference: https://workos.com/docs/integrations/google-oauth

**CRITICAL:** Do NOT regenerate OAuth credentials — this would break existing social logins during migration window.

### Provider-Specific Steps

```
Which providers are you migrating?
  |
  +-- Google --> Follow Google OAuth guide, add redirect URI
  |
  +-- Microsoft --> Follow Microsoft OAuth guide, update Azure AD app
  |
  +-- Facebook --> Update Facebook App allowed OAuth redirects
  |
  +-- SAML --> Export Cognito SAML metadata, import to WorkOS SSO
```

**Verify:** Test social login with migrated user before disabling Cognito.

## Step 8: Update Application Code

### Replace Cognito SDK Calls

Map common Cognito operations to WorkOS equivalents:

```
Cognito Method                    --> WorkOS Equivalent
initiateAuth()                    --> AuthKit sign-in flow
getUser()                         --> getUser() from AuthKit
changePassword()                  --> Update password via Admin Portal
adminGetUser()                    --> GET /user_management/users/:id
adminUpdateUserAttributes()       --> PATCH /user_management/users/:id
```

**Decision tree for auth implementation:**

```
What framework are you using?
  |
  +-- Next.js App Router --> Use workos-authkit-nextjs skill
  |
  +-- React (client-side) --> Use workos-authkit-react skill
  |
  +-- Other / API-only --> Use workos-api-authkit skill
```

See Related Skills for framework-specific instructions.

## Step 9: MFA Migration (If Enabled)

### Cognito MFA Types

```
What MFA did Cognito users have?
  |
  +-- SMS --> NOT supported by WorkOS — users must re-enroll with TOTP
  |
  +-- TOTP (app-based) --> NOT transferable — users must re-enroll
  |
  +-- None --> No action required
```

**Reality check:** MFA secrets cannot be exported from Cognito. ALL users with MFA must re-enroll.

**Mitigation strategy:**

1. Import users with MFA disabled initially
2. Prompt for MFA enrollment on first login post-migration
3. Use Admin Portal to track enrollment progress

Reference: https://workos.com/docs/mfa

## Step 10: Parallel Run (Recommended)

Run Cognito and WorkOS in parallel during transition:

### Dual-Write Pattern

```javascript
// On user registration
await createCognitoUser(email, password);
await createWorkOSUser(email, { email_verified: false });

// On user update
await updateCognitoUser(userId, attributes);
await updateWorkOSUser(userId, attributes);
```

**Duration:** Run dual-write for 1-2 weeks before cutover.

**Benefits:** Zero-downtime migration, easy rollback, data consistency validation.

## Verification Checklist (ALL MUST PASS)

Run these checks before cutting over to WorkOS:

```bash
# 1. User count matches
COGNITO_COUNT=$(aws cognito-idp list-users --user-pool-id POOL_ID --query 'Users | length(@)')
WORKOS_COUNT=$(curl -s https://api.workos.com/user_management/users?organization_id=ORG_ID \
  -H "Authorization: Bearer sk_YOUR_API_KEY" | jq '.data | length')
[ "$COGNITO_COUNT" -eq "$WORKOS_COUNT" ] || echo "FAIL: User count mismatch"

# 2. Social provider redirects configured
curl -s https://accounts.google.com/.well-known/openid-configuration | \
  grep -q "api.workos.com" || echo "FAIL: Google redirect URI not added"

# 3. Test authentication end-to-end
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPassword123"}' \
  | jq -e '.user.id' || echo "FAIL: Auth test failed"

# 4. Application builds with WorkOS SDK
npm run build || echo "FAIL: Build failed"

# 5. Password reset flow works
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  | jq -e '.success' || echo "FAIL: Password reset broken"
```

**If ANY check fails:** Do NOT proceed to cutover. Resolve issue first.

## Step 11: Cutover

### Pre-Cutover Checklist

- [ ] All verification checks pass
- [ ] Rollback plan documented
- [ ] Support team briefed on password reset process
- [ ] User communication sent (expect password reset emails)

### Cutover Steps

1. **Enable maintenance mode** (optional but recommended)
2. **Update environment variables** — swap Cognito keys for WorkOS keys
3. **Deploy application** with WorkOS SDK integration
4. **Disable Cognito user pool** (do NOT delete yet — keep for rollback)
5. **Monitor logs** for authentication errors

### Post-Cutover Monitoring

```bash
# Watch for auth failures
grep -i "authentication failed" /var/log/app.log | tail -20

# Monitor password reset requests
curl -s https://api.workos.com/events?event=user_management.password_reset.requested \
  -H "Authorization: Bearer sk_YOUR_API_KEY" | jq '.data | length'
```

**Wait 7 days** before deleting Cognito user pool (rollback window).

## Error Recovery

### "User not found" After Import

**Root cause:** Import failed silently or user filtered out during transform.

**Fix:**

1. Check WorkOS import logs in Admin Portal
2. Verify user email in `workos-import.json`
3. Re-run import for missing users only:

```bash
# Find missing users
comm -23 <(jq -r '.[].email' cognito-users.json | sort) \
         <(curl -s https://api.workos.com/user_management/users?organization_id=ORG_ID \
           -H "Authorization: Bearer sk_YOUR_API_KEY" | jq -r '.data[].email' | sort) \
  > missing-users.txt

# Re-import
cat missing-users.txt | while read email; do
  # ... import logic
done
```

### Social Login Fails After Migration

**Root cause:** OAuth redirect URI not added to provider, OR credentials regenerated.

**Fix:**

1. Check provider dashboard (Google Console, Azure AD, etc.) for WorkOS callback URL
2. Verify Client ID/Secret match Cognito exactly (do NOT regenerate)
3. Test with browser DevTools Network tab to see redirect chain

### Password Reset Emails Not Sending

**Root cause:** WorkOS email domain not verified, OR rate limit hit.

**Fix:**

1. Check WorkOS Dashboard → Settings → Email for verification status
2. Verify custom domain configuration if using custom sender
3. Check rate limit headers in API response:

```bash
curl -v https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer sk_YOUR_API_KEY" \
  ... | grep -i "rate-limit"
```

Reference: https://workos.com/docs/user-management/email-domain-verification

### MFA Users Locked Out

**Root cause:** MFA secrets not transferred (impossible to transfer from Cognito).

**Expected behavior:** Users MUST re-enroll MFA. This is not a bug.

**Fix:**

1. Disable MFA requirement temporarily via Admin Portal
2. Prompt users to re-enroll on next login
3. Track enrollment progress with events API

### Import Fails with "Invalid email format"

**Root cause:** Cognito allows emails Cognito allows that WorkOS rejects (e.g., punycode domains).

**Fix:**

1. Identify problematic emails:

```bash
jq -r '.[] | select(.email | test("xn--")) | .email' workos-import.json
```

2. Sanitize or contact users to update email before import

### "Organization not found" During Import

**Root cause:** Organization ID typo, or org deleted.

**Fix:**

1. List organizations to verify ID:

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer sk_YOUR_API_KEY" | jq '.data[] | {id, name}'
```

2. Use correct organization ID in import request

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS auth in Next.js (replaces Amplify UI)
- `workos-authkit-react` - Client-side React auth integration
- `workos-api-authkit` - API-only authentication patterns
- `workos-mfa` - Configuring MFA after migration
- `workos-sso` - Enterprise SSO setup (if migrating SAML users)
- `workos-admin-portal` - User management via Admin Portal
- `workos-api-organization` - Organization management API
