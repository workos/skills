---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This documentation is the source of truth for migrating FROM the old WorkOS SSO API TO the new AuthKit API.

## Understanding This Migration

**What you're migrating:**

- **FROM:** WorkOS Standalone SSO API (old API)
- **TO:** WorkOS AuthKit API (new authentication system)

**Key terminology:**

- "SSO API" = the old WorkOS single sign-on API you're migrating away from
- "AuthKit API" = the new WorkOS authentication API you're migrating to
- "AuthKit Hosted UI" = optional pre-built UI for AuthKit (not required for API-only migration)

**Critical breaking change:** User IDs will be different. The old API returned Profile IDs, the new API returns User IDs. You must handle this identity mapping.

## Step 2: Pre-Migration Validation

### Environment Variables

Check that these exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Current Integration Points

Identify where your code currently calls these old SSO API endpoints:

```bash
# Find SSO initiation calls
grep -r "sso/authorize" . --include="*.ts" --include="*.js" --include="*.py"
grep -r "GetAuthorizationURL" . --include="*.ts" --include="*.js"

# Find callback/profile exchange calls
grep -r "sso/token" . --include="*.ts" --include="*.js" --include="*.py"
grep -r "GetProfileAndToken" . --include="*.ts" --include="*.js"
```

**Document these locations** — you will modify them in Steps 3 and 4.

## Step 3: Migrate SSO Initiation

### Find Initiation Code

Locate where your app calls the old SSO Get Authorization URL endpoint. This typically looks like:

- REST: `POST https://api.workos.com/sso/authorize`
- SDK: `workos.sso.getAuthorizationUrl({...})`

### Replace With AuthKit Authorization

**Old SSO API pattern:**

```
workos.sso.getAuthorizationUrl({
  provider: "GoogleOAuth",
  connection: "conn_123",
  organization: "org_123",
  redirectUri: "https://yourapp.com/callback",
  state: "optional_state"
})
```

**New AuthKit API pattern:**

```
workos.userManagement.getAuthorizationUrl({
  provider: "GoogleOAuth",  // Same parameter
  connection: "conn_123",    // Same parameter
  organization: "org_123",   // Same parameter
  redirectUri: "https://yourapp.com/callback",  // Same parameter
  state: "optional_state"    // Same parameter
})
```

**Key differences:**

- Method changes from `workos.sso.*` to `workos.userManagement.*`
- All parameters remain compatible
- **New capability:** Can pass `provider: "authkit"` for AuthKit Hosted UI flow (optional)

### Verification

After modifying initiation code:

```bash
# Confirm old SSO calls are removed
! grep -r "workos.sso.getAuthorizationUrl" . --include="*.ts" --include="*.js"

# Confirm new AuthKit calls exist
grep -r "workos.userManagement.getAuthorizationUrl" . --include="*.ts" --include="*.js"
```

## Step 4: Migrate Callback Handler

### Find Callback Code

Locate where your app exchanges the authorization code for user data. This is typically in your redirect URI endpoint.

**Old pattern:** Calls `workos.sso.getProfileAndToken()` or POSTs to `/sso/token`

### Replace With AuthKit Authentication

**Old SSO API:**

```
workos.sso.getProfileAndToken({
  code: req.query.code
})
// Returns: { profile, accessToken }
// profile.id = "prof_123" (Profile ID)
```

**New AuthKit API:**

```
workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID
})
// Returns: { user, accessToken, refreshToken }
// user.id = "user_456" (User ID - DIFFERENT from Profile ID)
```

**CRITICAL:** The `user.id` is NOT the same as the old `profile.id`. You must handle identity mapping.

### User ID Migration Strategy (Decision Tree)

```
Does your app use email as primary identifier?
  |
  +-- YES --> Use user.email to match existing users
  |           (WorkOS guarantees verified email)
  |
  +-- NO --> You must maintain a mapping table:
             old_profile_id -> new_user_id

             Options:
             1. One-time migration: bulk convert profile_id to user_id via API
             2. Lazy migration: look up on first login, store mapping
             3. Dual storage: store both IDs during transition period
```

**Email-based identification (recommended if applicable):**

If your application already treats email as a unique, stable identifier:

```typescript
const { user } = await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// Find or create local user by email
const localUser = await db.users.findByEmail(user.email);
if (localUser) {
  // Update WorkOS user ID reference
  await db.users.update(localUser.id, { workosUserId: user.id });
}
```

**ID mapping table (required if email is not unique identifier):**

Create migration table to track old → new identity:

```sql
CREATE TABLE workos_user_migrations (
  old_profile_id VARCHAR(255) PRIMARY KEY,
  new_user_id VARCHAR(255) NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW()
);
```

### Verification

```bash
# Confirm old profile exchange calls are removed
! grep -r "getProfileAndToken" . --include="*.ts" --include="*.js"

# Confirm new authentication calls exist
grep -r "authenticateWithCode" . --include="*.ts" --include="*.js"

# Test callback flow
curl -i "http://localhost:3000/auth/callback?code=test_code_123"
```

## Step 5: Handle New Authentication Flows

AuthKit introduces additional security flows that the old SSO API did not have.

### New Error Cases

The `authenticateWithCode()` call can now return these additional errors:

**Email Verification Required:**

```json
{
  "error": "email_verification_required",
  "error_description": "User must verify their email",
  "email": "user@example.com",
  "pending_authentication_token": "pat_..."
}
```

**MFA Enrollment Required:**

```json
{
  "error": "mfa_enrollment_required",
  "error_description": "User must enroll in MFA"
}
```

### Decision Tree: Handle or Disable?

```
Do you want to enforce email verification and MFA?
  |
  +-- NO --> Disable in WorkOS Dashboard:
  |          1. Go to dashboard.workos.com
  |          2. Navigate to Authentication section
  |          3. Disable "Email Verification" toggle
  |          4. Disable "MFA" toggle
  |          5. No code changes needed
  |
  +-- YES, using AuthKit Hosted UI --> No handling needed
  |                                     (UI handles flows automatically)
  |
  +-- YES, using API directly --> Add error handlers:

      if (error === "email_verification_required") {
        // Send user to email verification flow
        // Use pending_authentication_token to complete later
      }

      if (error === "mfa_enrollment_required") {
        // Send user to MFA enrollment flow
      }
```

**Recommendation:** If you don't need these features, disable them in the Dashboard. This is the simplest migration path and requires no code changes.

### Verification

```bash
# If disabled: Confirm authentication succeeds without extra challenges
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "client_id=$WORKOS_CLIENT_ID" \
  -d "code=test_code" \
  -d "grant_type=authorization_code"

# Response should be { user, accessToken, refreshToken } with no errors
```

## Step 6: Optional - Enable AuthKit Hosted UI

**Only do this if you want WorkOS to host your login UI.**

### When to Use AuthKit Hosted UI

- You want to avoid building custom login forms
- You want built-in email verification and MFA flows
- You want WorkOS-hosted branding customization

### When to Skip

- You need full control over login UI
- You already have custom authentication flows
- You're only migrating API calls (not UI)

### Enable Hosted UI

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to Authentication → AuthKit
3. Enable "AuthKit Hosted UI"
4. Configure branding (logo, colors, custom domain)

### Update Initiation to Use Hosted UI

Change provider parameter:

```typescript
// Before: specific provider
workos.userManagement.getAuthorizationUrl({
  provider: "GoogleOAuth", // Specific SSO provider
  redirectUri: "https://yourapp.com/callback",
});

// After: AuthKit Hosted UI (shows all enabled providers)
workos.userManagement.getAuthorizationUrl({
  provider: "authkit", // WorkOS Hosted UI
  redirectUri: "https://yourapp.com/callback",
});
```

**No callback changes needed** — the callback handler remains the same.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Old SSO API calls removed
! grep -r "workos.sso" . --include="*.ts" --include="*.js" --include="*.py" || echo "FAIL: Old SSO API still referenced"

# 2. New AuthKit API calls present
grep -r "workos.userManagement" . --include="*.ts" --include="*.js" || echo "FAIL: AuthKit API not found"

# 3. User ID handling implemented
grep -r "user\.id" . --include="*.ts" --include="*.js" | head -5 || echo "FAIL: No user ID handling found"

# 4. Application builds
npm run build || echo "FAIL: Build failed"

# 5. Authentication flow works end-to-end
# (Manual test: complete login flow and verify user object returned)
```

## Error Recovery

### "User ID not found in database"

**Root cause:** New AuthKit `user.id` doesn't match old `profile.id` in your database.

**Fix:**

1. Check if user email exists in database instead: `SELECT * FROM users WHERE email = ?`
2. If found, update with new WorkOS user ID: `UPDATE users SET workos_user_id = ? WHERE email = ?`
3. If implementing mapping table, query: `SELECT new_user_id FROM workos_user_migrations WHERE old_profile_id = ?`

### "email_verification_required" error

**Root cause:** Email verification is enabled in WorkOS Dashboard, but your app doesn't handle the flow.

**Fix (choose one):**

1. **Disable email verification:** Dashboard → Authentication → Email Verification → OFF
2. **Use AuthKit Hosted UI:** Change `provider` to `"authkit"` in initiation call (Step 6)
3. **Implement verification handler:** See WebFetch docs for email verification API endpoints

Reference: https://workos.com/docs/migrate/standalone-sso (section "Handling new authentication flows")

### "Invalid client_id" in authenticateWithCode

**Root cause:** `clientId` parameter is required in AuthKit API but was optional in old SSO API.

**Fix:**

```typescript
// Add clientId parameter
await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID, // REQUIRED
});
```

### "State mismatch" errors

**Root cause:** State parameter handling works the same, but may be more strictly validated.

**Fix:**

1. Store state in session before initiation: `session.oauthState = generateRandomString()`
2. Pass state in authorization URL: `getAuthorizationUrl({ state: session.oauthState })`
3. Verify in callback: `if (req.query.state !== session.oauthState) throw new Error("State mismatch")`

### Build fails with "workos.sso is not defined"

**Root cause:** Old SSO API no longer exists in updated SDK version.

**Fix:**

1. Complete Steps 3 and 4 to replace all `workos.sso.*` calls with `workos.userManagement.*`
2. Search for remaining references: `grep -r "workos.sso" .`
3. Update each occurrence to use AuthKit API

### Authentication succeeds but user data is missing fields

**Root cause:** User object structure differs from old Profile object.

**Profile object (old):**

```json
{
  "id": "prof_123",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "connection_id": "conn_123",
  "organization_id": "org_123"
}
```

**User object (new):**

```json
{
  "id": "user_456",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "emailVerified": true,
  "profilePictureUrl": "https://..."
}
```

**Fix:** Update field access:

- `profile.first_name` → `user.firstName`
- `profile.last_name` → `user.lastName`
- Connection/org data: query via Directory Sync API if needed

## Related Skills

- workos-authkit-nextjs - Use AuthKit with Next.js App Router
- workos-authkit-react - Use AuthKit with React SPA
- workos-directory-sync.rules.yml - Sync organization/user data
- workos-migrate-auth0.rules.yml - Similar migration patterns from Auth0
