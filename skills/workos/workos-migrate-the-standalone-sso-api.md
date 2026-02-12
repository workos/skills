---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## What This Skill Does

This migrates FROM the old WorkOS SSO API TO the new AuthKit API. You are:

- REPLACING old SSO endpoints with new AuthKit endpoints
- HANDLING new User objects instead of old Profile objects
- ADDING support for email verification and MFA flows (if enabled)

**Critical:** User IDs will CHANGE during migration. Old Profile IDs ≠ new User IDs.

## Step 2: Pre-Migration Assessment

### Identify Current SSO Integration Points

Find all calls to these OLD SSO endpoints in your codebase:

```bash
# Find SSO initiation calls
grep -r "getAuthorizationUrl\|authorization_url" --include="*.{js,ts,jsx,tsx,py,rb,go}" .

# Find callback/exchange calls
grep -r "getProfileAndToken\|getProfile\|profile_and_token" --include="*.{js,ts,jsx,tsx,py,rb,go}" .
```

Note the file paths — these are your migration targets.

### Verify Prerequisites

- WorkOS account exists with `WORKOS_API_KEY` (starts with `sk_`) and `WORKOS_CLIENT_ID` (starts with `client_`)
- WorkOS SDK installed in project (check `package.json`, `requirements.txt`, `go.mod`, etc.)
- Current integration uses SSO connections configured in WorkOS Dashboard

## Step 3: Migration Decision Tree

```
Migration Strategy?
  |
  +-- AuthKit Hosted UI (Recommended)
  |   |
  |   +-- Use prebuilt UI for all auth flows
  |   +-- Minimal code changes
  |   +-- Automatically handles email verification, MFA
  |   +-- See related skill: workos-authkit-nextjs, workos-authkit-react
  |
  +-- Direct AuthKit API (This Skill)
      |
      +-- Full control over UI
      +-- Must handle email verification errors
      +-- Must handle MFA enrollment errors
      +-- Continue below
```

If using Hosted UI: Stop here and switch to an AuthKit integration skill instead.

If using Direct API: Continue to Step 4.

## Step 4: Replace SSO Initiation Endpoint

### OLD SSO API Pattern

```
POST /sso/authorize
{
  "connection": "conn_123",
  "redirect_uri": "https://your-app.com/callback",
  "state": "optional_state"
}
```

### NEW AuthKit API Pattern

```
POST /user_management/authorize
{
  "provider": "authkit",  // or your existing connection_id
  "redirect_uri": "https://your-app.com/callback",
  "state": "optional_state",
  "client_id": "client_xxx"
}
```

**Key Changes:**

- Endpoint path: `/sso/authorize` → `/user_management/authorize`
- Parameter: `connection` → `provider`
- Provider value: Can be `"authkit"` (for hosted UI) OR your existing connection ID

**SDK Method Replacement:**

Check the fetched documentation for the exact method name in your language. Common patterns:

```typescript
// OLD (SSO API)
const url = workos.sso.getAuthorizationUrl({
  connection: "conn_123",
  redirectUri: "https://your-app.com/callback",
});

// NEW (AuthKit API)
const url = workos.userManagement.getAuthorizationUrl({
  provider: "authkit", // or 'conn_123'
  redirectUri: "https://your-app.com/callback",
});
```

**Action:** Replace ALL instances found in Step 2.

## Step 5: Replace Callback Token Exchange

### OLD SSO API Pattern

```
POST /sso/token
{
  "code": "auth_code_123",
  "client_id": "client_xxx"
}

Response: ProfileAndToken object
{
  "profile": {
    "id": "prof_123",  // OLD Profile ID
    "email": "user@example.com",
    "first_name": "Jane"
  },
  "access_token": "...",
  "connection": {...}
}
```

### NEW AuthKit API Pattern

```
POST /user_management/authenticate
{
  "code": "auth_code_123",
  "client_id": "client_xxx",
  "grant_type": "authorization_code"  // REQUIRED parameter
}

Response: AuthenticationResponse object
{
  "user": {
    "id": "user_456",  // NEW User ID (DIFFERENT from prof_123)
    "email": "user@example.com",
    "first_name": "Jane",
    "email_verified": true
  },
  "access_token": "...",
  "organization_id": "..."
}
```

**CRITICAL ID Migration:** The User ID in the new response (`user_456`) is NOT the same as the old Profile ID (`prof_123`). You MUST update your database mapping.

**SDK Method Replacement:**

```typescript
// OLD (SSO API)
const { profile } = await workos.sso.getProfileAndToken({ code });

// NEW (AuthKit API)
const { user } = await workos.userManagement.authenticateWithCode({
  code,
  clientId: "client_xxx",
});
```

**Action:** Replace ALL instances found in Step 2.

## Step 6: Handle New Error Cases (CRITICAL)

The AuthKit API returns NEW error types that the SSO API did not. Your callback handler MUST handle these:

### Email Verification Required Error

```json
{
  "error": "email_verification_required",
  "error_description": "User must verify email",
  "email": "user@example.com",
  "pending_authentication_token": "token_xyz"
}
```

**What this means:** User authenticated successfully, but email is not verified.

**Required action:**

1. Store `pending_authentication_token`
2. Send verification email using WorkOS API
3. Wait for user to verify email
4. Exchange `pending_authentication_token` for final User object

See fetched docs for `POST /user_management/email_verification/send` endpoint.

**Disabling this check:** If your app doesn't require verified emails, disable "Require Email Verification" in WorkOS Dashboard → Authentication settings.

### MFA Enrollment Required Error

```json
{
  "error": "mfa_enrollment_required",
  "error_description": "User must enroll in MFA",
  "pending_authentication_token": "token_abc"
}
```

**What this means:** MFA is enabled in Dashboard settings, but user hasn't enrolled yet.

**Required action:**

1. Store `pending_authentication_token`
2. Guide user through MFA enrollment flow
3. Exchange `pending_authentication_token` for final User object

See fetched docs for MFA enrollment endpoints.

**Disabling this check:** If your app doesn't require MFA, disable "Require MFA Enrollment" in WorkOS Dashboard → Authentication settings.

### Code Example: Error Handling

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code,
    clientId,
  });
  // Success - proceed with user object
} catch (error) {
  if (error.error === "email_verification_required") {
    // Handle email verification flow
    const { email, pending_authentication_token } = error;
    // Store token, send verification email
  } else if (error.error === "mfa_enrollment_required") {
    // Handle MFA enrollment flow
    const { pending_authentication_token } = error;
    // Store token, show MFA enrollment UI
  } else {
    // Other authentication errors
    throw error;
  }
}
```

**Decision Tree:**

```
authenticateWithCode() result?
  |
  +-- Success (user object) --> Continue to Step 7
  |
  +-- email_verification_required --> Send verification email, wait for completion
  |
  +-- mfa_enrollment_required --> Show MFA enrollment UI
  |
  +-- Other error --> Standard error handling
```

## Step 7: Update Database User ID Mapping

**CRITICAL:** Old Profile IDs are NOT compatible with new User IDs.

### Migration Strategy A: Email-Based Lookup (Recommended if email is unique)

```sql
-- Find existing user by email instead of ID
UPDATE users
SET workos_user_id = 'user_456'  -- new User ID
WHERE email = 'user@example.com'  -- from AuthKit response
AND workos_profile_id = 'prof_123';  -- old Profile ID

-- Clean up old column (optional)
ALTER TABLE users DROP COLUMN workos_profile_id;
```

WorkOS guarantees that `user.email` is verified before returning a User object, so email is a safe lookup key.

### Migration Strategy B: Dual ID Storage (If email is not unique)

```sql
-- Add new column, keep old one temporarily
ALTER TABLE users ADD COLUMN workos_user_id VARCHAR(255);

-- Populate during migration
UPDATE users
SET workos_user_id = 'user_456'
WHERE workos_profile_id = 'prof_123';

-- After migration complete, drop old column
ALTER TABLE users DROP COLUMN workos_profile_id;
```

### Migration Strategy C: One-Time Mapping (If you have Profile → Email data)

If you stored Profile IDs but NOT emails, export your old Profile data first:

```bash
# Export old Profile IDs and emails before migrating
curl https://api.workos.com/sso/profile/{profile_id} \
  -H "Authorization: Bearer $WORKOS_API_KEY" > profiles.json
```

Then map on first AuthKit login per user.

## Step 8: Update Downstream API Calls (If Applicable)

If your application makes other WorkOS API calls using the old Profile ID, update them:

### OLD: SSO Directory Sync with Profile ID

```
GET /directory_sync/users/{profile_id}
```

### NEW: User Management with User ID

```
GET /user_management/users/{user_id}
```

Check your codebase for any hardcoded Profile ID references:

```bash
grep -r "prof_[a-zA-Z0-9]" --include="*.{js,ts,jsx,tsx,py,rb,go}" .
```

## Verification Checklist (ALL MUST PASS)

Run these checks in order. Do not skip any.

```bash
# 1. Confirm SSO endpoint calls removed
! grep -r "sso\.getAuthorizationUrl\|sso/authorize" --include="*.{js,ts,jsx,tsx}" . || echo "FAIL: Old SSO calls still present"

# 2. Confirm AuthKit endpoint calls added
grep -r "userManagement\.getAuthorizationUrl\|user_management/authorize" --include="*.{js,ts,jsx,tsx}" . || echo "FAIL: AuthKit calls not found"

# 3. Confirm callback uses authenticateWithCode
grep -r "authenticateWithCode\|user_management/authenticate" --include="*.{js,ts,jsx,tsx}" . || echo "FAIL: Callback not updated"

# 4. Confirm error handling added
grep -r "email_verification_required\|mfa_enrollment_required" --include="*.{js,ts,jsx,tsx}" . || echo "FAIL: New error cases not handled"

# 5. Test authentication flow end-to-end
# (Manual test: Initiate auth, complete callback, verify User object received)

# 6. Verify database migration
# (Manual check: Confirm workos_user_id column exists and is populated)
```

**Additional manual verification:**

- Log in via WorkOS Dashboard → Users tab and confirm new User records appear (not old Profiles)
- Check that user sessions persist across requests with new User IDs
- Verify existing user data migrated correctly (email-based lookup worked)

## Error Recovery

### "User ID not found in database"

**Root cause:** Database still uses old Profile IDs, but AuthKit returns new User IDs.

**Fix:** Complete Step 7 database migration. Use email-based lookup to map old → new IDs.

### "email_verification_required error not handled"

**Root cause:** Email verification is enabled in Dashboard, but callback doesn't handle the error.

**Fix:**

- Option A: Disable email verification in WorkOS Dashboard → Authentication
- Option B: Add error handling from Step 6

### "Invalid grant_type"

**Root cause:** Missing or incorrect `grant_type` parameter in authenticate call.

**Fix:** Ensure `grant_type: "authorization_code"` is passed to `authenticateWithCode()`. Check SDK documentation from Step 1 for exact method signature.

### "Connection not found" after migration

**Root cause:** Passing old `connection` parameter name instead of `provider`.

**Fix:** Change `connection: 'conn_123'` to `provider: 'conn_123'` in authorization URL call.

### "Email already in use" during new user signup

**Root cause:** Existing user with same email has old Profile ID, new signup creates User ID, conflict occurs.

**Fix:** Implement email-based lookup in Step 7 to merge old Profile data with new User data.

## Related Skills

- workos-authkit-nextjs — Full AuthKit integration with Next.js App Router (Hosted UI option)
- workos-authkit-react — AuthKit integration with React (Hosted UI option)
- workos-authkit-vanilla-js — AuthKit integration with vanilla JavaScript (Hosted UI option)
