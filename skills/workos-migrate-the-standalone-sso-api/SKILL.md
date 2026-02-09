---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### Current Integration Assessment

Identify which SSO API endpoints your application currently uses:

```bash
# Search codebase for SSO API calls
grep -r "GetAuthorizationURL\|getAuthorizationUrl" . --include="*.ts" --include="*.js"
grep -r "GetProfileAndToken\|authenticateWithCode" . --include="*.ts" --include="*.js"
grep -r "/sso/authorize" . --include="*.ts" --include="*.js"
```

**Critical:** Record all locations where SSO API is called. You will need to replace each one.

### Environment Variables

Check for existing WorkOS configuration:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- Redirect URI configuration (stored in code or environment)

### SDK Version

Check WorkOS SDK package version:

```bash
# Node.js
npm list @workos-inc/node

# Python  
pip show workos

# Ruby
bundle show workos
```

**Minimum version required:** Check migration guide for SDK version compatibility. Older SDKs may not support AuthKit APIs.

## Step 3: User ID Migration Strategy (DECISION REQUIRED)

**Critical:** User IDs will change from Profile IDs to User IDs. Choose migration path:

```
User identifier in your app?
  |
  +-- Email (unique) --> Use email as lookup key, update stored IDs on first login
  |
  +-- Profile ID --> Create ID mapping table, dual-read during transition
  |
  +-- External ID --> Map external IDs to new User IDs
```

### Email-Based Migration (Recommended if Email is Unique)

If email is a unique identifier in your application:

1. WorkOS guarantees email verification before successful authentication
2. On user login, look up application user by email
3. Update stored WorkOS ID from old Profile ID to new User ID
4. Log mapping for audit trail

**Implementation pattern:**

```
1. Receive User object from AuthKit API
2. Query local user by user.email
3. If found AND workos_id != user.id:
   - Update local user record: workos_id = user.id
   - Log migration: "Migrated user {email} from {old_id} to {user.id}"
4. Proceed with session creation
```

### ID Mapping Table (If Email Not Unique)

Create migration tracking:

```sql
CREATE TABLE workos_id_migrations (
  old_profile_id VARCHAR PRIMARY KEY,
  new_user_id VARCHAR NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW()
);
```

**Do not proceed** to code changes until migration strategy is chosen and implemented.

## Step 4: Replace SSO Initiation Calls

Locate all SSO authorization URL calls (from Step 2 grep results).

### Old Pattern (SSO API)

```
SDK method: GetAuthorizationURL / getAuthorizationUrl
Endpoint: /sso/authorize
Parameters: connection, organization, domain_hint, login_hint, state
```

### New Pattern (AuthKit API)

```
SDK method: getAuthorizationUrl (same name, different import)
Endpoint: /user_management/authorize  
Parameters: Same as before, PLUS new 'provider' parameter
```

**Replace each call:**

1. Change import from SSO module to AuthKit/UserManagement module (check migration guide for exact import path)
2. Add `provider` parameter with value from this decision tree:

```
Authentication method?
  |
  +-- Enterprise SSO (SAML/OIDC) --> provider: "connection" (same behavior as before)
  |
  +-- AuthKit Hosted UI --> provider: "authkit" (handles email verification, MFA automatically)
  |
  +-- OAuth (Google/Microsoft) --> provider: "GoogleOAuth" / "MicrosoftOAuth" 
```

3. Keep all other parameters unchanged (connection, organization, state, etc.)

**Verify:** Authorization URL contains `/user_management/authorize` not `/sso/authorize`

## Step 5: Replace Callback Authentication

Locate callback handler that exchanges code for user data.

### Old Pattern (SSO API)

```
SDK method: GetProfileAndToken / authenticateWithCode
Endpoint: /sso/token
Input: code, client_secret (deprecated), ip_address (optional)
Output: Profile object (profile.id, profile.email, profile.first_name, etc.)
```

### New Pattern (AuthKit API)

```
SDK method: authenticateWithCode / authenticate
Endpoint: /user_management/authenticate
Input: code, grant_type="authorization_code", ip_address (optional)
Output: User object (user.id, user.email, user.first_name, etc.)
```

**Replace callback code:**

1. Change SDK method from SSO to AuthKit (check migration guide for exact method name per language)
2. Add `grant_type: "authorization_code"` parameter (required by AuthKit API)
3. Update response handling to expect `User` object instead of `Profile` object

**Critical:** User ID mapping happens HERE. Implement chosen strategy from Step 3.

### Response Object Differences

Key fields that changed:

| SSO Profile | AuthKit User | Notes |
|------------|--------------|-------|
| `profile.id` | `user.id` | **Different values** - requires migration |
| `profile.email` | `user.email` | Same value, verified by AuthKit |
| `profile.first_name` | `user.first_name` | Same value |
| `profile.last_name` | `user.last_name` | Same value |
| `profile.connection_type` | Not present | Removed - check organization metadata if needed |

Check migration guide for complete field mapping.

## Step 6: Handle New Authentication Flows (ERROR RECOVERY)

AuthKit API may return additional error responses for security flows:

### Email Verification Required

**Error code:** `email_verification_required`

**Returned when:** User's email is not verified and email verification is enabled in WorkOS Dashboard.

**Recovery:**

```
IF using AuthKit Hosted UI (provider: "authkit"):
  - Automatic: AuthKit UI handles verification flow, no code changes needed
  
IF using headless API:
  1. Receive error with pending_authentication_token
  2. Direct user to verify email
  3. Re-authenticate with pending_authentication_token after verification
```

Check migration guide for exact error response format and pending token usage.

### MFA Required

**Error code:** `mfa_enrollment_required` or `mfa_challenge_required`

**Returned when:** Organization requires MFA and user hasn't enrolled/completed challenge.

**Recovery:**

```
IF using AuthKit Hosted UI (provider: "authkit"):
  - Automatic: AuthKit UI handles MFA enrollment/challenge, no code changes needed
  
IF using headless API:
  1. Receive error with pending_authentication_token
  2. Direct user to MFA enrollment/challenge flow
  3. Re-authenticate with pending_authentication_token after completion
```

### Account Linking Required

**Error code:** `account_linking_required`

**Returned when:** User attempts to authenticate with different SSO provider for same email.

**Recovery:** Check migration guide for account linking flow - this is a new security feature not present in standalone SSO.

## Step 7: Dashboard Configuration Review

AuthKit introduces new security settings not present in standalone SSO:

```bash
# Open WorkOS Dashboard Authentication settings
# https://dashboard.workos.com/configuration/authentication
```

**Review these settings:**

1. **Email Verification:** Enabled by default. Disable if not required.
2. **MFA:** Optional by default. Ensure application handles MFA errors if enabled.
3. **Session Duration:** New setting for AuthKit sessions.
4. **Account Linking:** Controls behavior when same email authenticates via different providers.

**If you receive unexpected authentication errors,** check these settings first.

## Step 8: AuthKit Hosted UI Migration (OPTIONAL)

If you want to offload authentication UI entirely (recommended path):

1. Enable AuthKit in WorkOS Dashboard
2. Configure branding (logo, colors, custom domain)
3. Change initiation calls to use `provider: "authkit"`
4. **Remove custom UI code** for login, email verification, MFA enrollment

**AuthKit Hosted UI handles:**
- Email verification challenges automatically
- MFA enrollment and challenges automatically  
- Account linking flows automatically
- Consistent branding across all auth flows

Check migration guide for AuthKit setup instructions.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. No SSO API endpoints remain in code
! grep -r "/sso/authorize\|/sso/token" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb"

# 2. All authorization calls use AuthKit API
grep -r "user_management/authorize\|getAuthorizationUrl.*authkit" . --include="*.ts" --include="*.js" | wc -l

# 3. All callback handlers use AuthKit authenticate
grep -r "authenticateWithCode\|user_management/authenticate" . --include="*.ts" --include="*.js" | wc -l

# 4. User ID migration code exists in callback handler
grep -r "workos_id\|user.id" app/auth/callback --include="*.ts" --include="*.js"

# 5. Application builds without errors
npm run build  # or equivalent for your stack
```

**If any check fails,** return to corresponding step and fix before proceeding.

## Error Recovery

### "Invalid grant_type" during authentication

**Cause:** AuthKit API requires explicit `grant_type: "authorization_code"` parameter.

**Fix:** Add grant_type parameter to authenticate call (see Step 5).

### "Email verification required" error in production

**Cause:** Email verification is enabled in Dashboard but application doesn't handle the flow.

**Fix (choose one):**
1. Disable email verification in Dashboard → Authentication settings (if not required)
2. Switch to AuthKit Hosted UI (`provider: "authkit"`) to handle automatically
3. Implement headless email verification flow per migration guide

### User not found after migration

**Cause:** User ID changed from Profile ID to User ID, lookup failed.

**Fix:** 
1. Check User ID migration code from Step 3 is executed in callback
2. Verify email-based lookup works: `SELECT * FROM users WHERE email = ?`
3. Check migration audit logs for this user's email
4. Manually map old Profile ID to new User ID in database if needed

### Authorization URL returns 404

**Cause:** SDK version does not support AuthKit APIs.

**Fix:**
```bash
# Check SDK version
npm list @workos-inc/node  # or equivalent

# Update to latest
npm install @workos-inc/node@latest
```

Minimum version required: Check migration guide compatibility table.

### "Unknown provider: authkit" error

**Cause:** AuthKit not enabled in WorkOS Dashboard.

**Fix:**
1. Go to https://dashboard.workos.com/get-started
2. Enable AuthKit
3. Configure branding and redirect URIs
4. Retry authorization with `provider: "authkit"`

### Session expires immediately after login

**Cause:** Session duration not configured for AuthKit.

**Fix:**
1. Go to Dashboard → Authentication → Session Duration
2. Set appropriate session lifetime (default: 7 days)
3. Ensure application respects session tokens from AuthKit API

## Related Skills

- `workos-authkit-nextjs` - Full AuthKit integration with Next.js App Router
- `workos-user-management` - Advanced user management features beyond SSO migration
