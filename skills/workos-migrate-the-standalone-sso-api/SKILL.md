---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Context: What This Migration Is

This skill migrates FROM the legacy WorkOS SSO API TO the new AuthKit API. You are replacing:
- Old: `sso.getAuthorizationUrl()` and `sso.getProfileAndToken()`
- New: `authkit.getAuthorizationUrl()` and `authkit.authenticateWithCode()`

**Critical:** User IDs change during this migration. Old SSO Profile IDs ≠ New AuthKit User IDs. You must handle user re-linking.

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Audit

### Environment Variables

Check existing SSO integration for these env vars:
- `WORKOS_API_KEY` - Required, starts with `sk_`
- `WORKOS_CLIENT_ID` - Required, starts with `client_`
- Redirect URI configured in WorkOS Dashboard

### Code Inventory

Identify all locations calling SSO API:

```bash
# Find SSO initiation calls
grep -r "getAuthorizationUrl\|authorization_url" --include="*.ts" --include="*.js"

# Find callback handlers
grep -r "getProfileAndToken\|profile_and_token" --include="*.ts" --include="*.js"
```

Document these file paths — you will modify them in Steps 3-4.

### SDK Version Check

Verify WorkOS SDK version supports AuthKit:

```bash
# Check package.json for @workos-inc version
grep "@workos-inc" package.json

# AuthKit requires v7.0.0+
```

If SDK version < 7.0.0, upgrade first: `npm install @workos-inc/node@latest`

## Step 3: Update SSO Initiation

### Decision Tree: Provider Type

```
What auth method?
  |
  +-- SSO (enterprise) --> provider: 'GoogleOAuth', 'OktaSAML', etc.
  |
  +-- AuthKit (managed) --> provider: 'authkit'
  |
  +-- Both --> Use 'authkit' as default, pass connection_id for SSO orgs
```

### Code Changes

Replace old SSO initiation:

```typescript
// OLD (SSO API)
const url = workos.sso.getAuthorizationUrl({
  provider: 'GoogleOAuth',
  redirectUri: 'https://example.com/callback',
  state: JSON.stringify({ userId: '123' })
});
```

With new AuthKit initiation:

```typescript
// NEW (AuthKit API)
const url = await workos.userManagement.getAuthorizationUrl({
  provider: 'authkit', // or specific SSO provider
  redirectUri: 'https://example.com/callback',
  state: JSON.stringify({ userId: '123' })
});
```

**Critical:** The method is now `workos.userManagement.getAuthorizationUrl()`, not `workos.sso.getAuthorizationUrl()`.

WebFetch the migration guide for current method signatures if these don't match your SDK version.

## Step 4: Update Callback Handler

### Code Changes

Replace old callback:

```typescript
// OLD (SSO API)
const { profile } = await workos.sso.getProfileAndToken({
  code: req.query.code
});

// profile.id is a Profile ID
```

With new AuthKit callback:

```typescript
// NEW (AuthKit API)
const { user } = await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID
});

// user.id is a User ID (DIFFERENT from old profile.id)
```

**Critical:** The returned object is now `{ user }`, not `{ profile }`. The user object structure differs from profile.

## Step 5: Handle User ID Migration (REQUIRED)

**User IDs change:** Old SSO Profile IDs ≠ New AuthKit User IDs.

### Migration Strategy (Choose One)

#### Option A: Email-Based Re-Linking (Recommended)

If email is unique in your system:

```typescript
// In callback handler
const { user } = await workos.userManagement.authenticateWithCode({ code, clientId });

// Find existing user by email
const existingUser = await db.findUserByEmail(user.email);

if (existingUser) {
  // Update existing record with new WorkOS User ID
  await db.updateUser(existingUser.id, { workosUserId: user.id });
} else {
  // Create new user record
  await db.createUser({ workosUserId: user.id, email: user.email });
}
```

**Assumption:** WorkOS verifies email before completing auth. This is enforced by default.

#### Option B: Migration Table (Complex Orgs)

If email is not unique or users have multiple accounts:

1. Create migration mapping table: `sso_profile_id -> authkit_user_id`
2. Run one-time migration script to pre-populate mappings
3. Reference migration guide for batch migration API (if available)

## Step 6: Handle New Authentication Flows

AuthKit introduces new error cases not present in SSO API. These occur during code exchange.

### Error Decision Tree

```
authenticateWithCode() response?
  |
  +-- { user } --> Success, proceed
  |
  +-- email_verification_required --> User must verify email
  |     └─> Redirect to verification URL in error response
  |
  +-- mfa_enrollment_required --> User must enroll in MFA
  |     └─> Redirect to enrollment URL in error response
  |
  +-- invalid_grant --> Code expired (10 min timeout)
        └─> Restart auth flow
```

### Error Handling Code

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({ code, clientId });
  // Success path
} catch (error) {
  if (error.code === 'email_verification_required') {
    // Redirect to verification flow
    return redirect(error.verificationUrl);
  }
  if (error.code === 'mfa_enrollment_required') {
    // Redirect to MFA enrollment
    return redirect(error.enrollmentUrl);
  }
  // Other errors
  throw error;
}
```

WebFetch the migration guide for exact error code strings if these don't match.

### Disabling Extra Flows

If you don't need email verification or MFA:
1. Go to WorkOS Dashboard → Authentication
2. Toggle off "Require Email Verification"
3. Toggle off "Require MFA"

**Note:** If using AuthKit hosted UI (not API-only integration), these flows are handled automatically. You won't need error handling code.

## Step 7: Optional - Enable AuthKit Hosted UI

If you want a pre-built auth UI instead of custom forms:

### Enable in Dashboard

1. WorkOS Dashboard → Authentication → Enable AuthKit
2. Configure branding (logo, colors, custom domain)
3. Set redirect URI to your callback endpoint

### Update Initiation Code

Change provider to `'authkit'`:

```typescript
const url = await workos.userManagement.getAuthorizationUrl({
  provider: 'authkit', // Uses hosted UI
  redirectUri: 'https://example.com/callback'
});
```

**Benefit:** Email verification, MFA enrollment, account linking are handled by UI. No error handling needed in your callback.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Check old SSO calls removed
! grep -r "sso\.getAuthorizationUrl\|sso\.getProfileAndToken" --include="*.ts" --include="*.js" || echo "FAIL: Old SSO API calls still present"

# 2. Check new AuthKit calls present
grep -r "userManagement\.getAuthorizationUrl" --include="*.ts" --include="*.js" && echo "PASS: New initiation found"
grep -r "userManagement\.authenticateWithCode" --include="*.ts" --include="*.js" && echo "PASS: New callback found"

# 3. Check user ID migration logic exists
grep -r "workosUserId.*user\.id\|findUserByEmail" --include="*.ts" --include="*.js" && echo "PASS: Migration logic found"

# 4. Build succeeds
npm run build
```

**If check #3 fails:** You MUST add user ID migration logic. Skipping this will break existing user logins.

## Error Recovery

### "User ID not found" after migration

**Root cause:** Old Profile IDs don't match new User IDs.

**Fix:** Add email-based re-linking in callback handler (see Step 5, Option A).

### "email_verification_required" error in production

**Root cause:** Email verification enabled in Dashboard but no error handling in code.

**Fix options:**
1. Add error handling code (see Step 6)
2. Disable email verification in Dashboard (WorkOS → Authentication)
3. Use AuthKit hosted UI which handles this automatically

### "invalid_grant" on code exchange

**Root cause:** Authorization code expired (10 minute timeout) or already used.

**Fix:** Codes are single-use and time-limited. User must restart auth flow. Do not cache codes.

### "Method not found" on authenticateWithCode

**Root cause:** SDK version < 7.0.0 doesn't have AuthKit methods.

**Fix:** Upgrade SDK: `npm install @workos-inc/node@latest`

WebFetch the migration guide to confirm current method names if errors persist.

### Build fails after code changes

**Root cause:** Import path incorrect for SDK version.

**Fix:** Check SDK version, adjust imports:
- v7.0.0+: `workos.userManagement.authenticateWithCode()`
- Earlier: Not supported, must upgrade

## Related Skills

- workos-authkit-nextjs - Full AuthKit integration for Next.js
- workos-authkit-react - AuthKit with React
- workos-sso - Legacy SSO API reference (being replaced by this migration)
- workos-api-authkit - AuthKit API reference
