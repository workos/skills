---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This documentation is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## What This Skill Does

This skill migrates FROM the **legacy WorkOS SSO API** TO the **new AuthKit API**.

**Critical distinction:**
- **Old system:** Standalone SSO API (Get Authorization URL, Get Profile and Token)
- **New system:** AuthKit API (Get Authorization URL, Authenticate with User objects)

This is NOT about migrating from external providers like Auth0 — this is upgrading within WorkOS itself.

## Step 2: Pre-Flight Assessment

### Check Current Integration

Identify which legacy SSO endpoints your codebase uses:

```bash
# Search for old SSO API calls
grep -r "sso.workos.com" . --include="*.ts" --include="*.js" --include="*.py"
grep -r "getAuthorizationUrl.*sso" . --include="*.ts" --include="*.js"
grep -r "getProfileAndToken" . --include="*.ts" --include="*.js"
```

**Output interpretation:**
- If found → You have legacy SSO code to migrate
- If not found → Check API logs to confirm no SSO usage

### Environment Variables

Verify these exist (same across both APIs):
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

## Step 3: Migration Decision Tree

```
Your codebase uses:
  |
  +-- SSO initiation ONLY (no callback handling)
  |     |
  |     +-- Migrate: Step 4 only
  |
  +-- SSO callback ONLY (no initiation)
  |     |
  |     +-- Migrate: Step 5 only
  |
  +-- Both initiation AND callback
        |
        +-- Migrate: Steps 4 and 5 (most common)
```

## Step 4: Replace SSO Initiation

### Before (Legacy SSO API):

```typescript
// OLD - Do not use
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const authorizationUrl = workos.sso.getAuthorizationUrl({
  provider: 'GoogleOAuth',
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  state: JSON.stringify({ userId: '123' }),
});
```

### After (New AuthKit API):

```typescript
// NEW - Use this
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
  provider: 'GoogleOAuth', // Same provider values work
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  state: JSON.stringify({ userId: '123' }),
});
```

**Key changes:**
- Method path: `sso.getAuthorizationUrl` → `userManagement.getAuthorizationUrl`
- Parameters: **Identical** — all SSO initiation params are supported
- New option: `provider: 'authkit'` enables AuthKit Hosted UI (see Step 6)

**Verify:** Run your auth initiation flow and confirm redirect to WorkOS succeeds.

## Step 5: Replace Callback Handling (CRITICAL)

This step changes your **user identifier** — read the breaking change notice carefully.

### Before (Legacy SSO API):

```typescript
// OLD - Returns Profile object
const { profile } = await workos.sso.getProfileAndToken({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// profile.id was used as user identifier
// profile.email, profile.firstName, etc.
```

### After (New AuthKit API):

```typescript
// NEW - Returns User object
const { user } = await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// user.id is DIFFERENT from old profile.id
// user.email, user.firstName, etc. (same field names)
```

**BREAKING CHANGE:** User IDs are different from Profile IDs.

### Handling the ID Change (Decision Tree)

```
How does your app identify users?
  |
  +-- By email (email is unique in your DB)
  |     |
  |     +-- Lookup user by user.email (WorkOS verifies email)
  |     +-- Update stored WorkOS ID from profile.id → user.id
  |
  +-- By WorkOS Profile ID stored in your DB
        |
        +-- Migration required:
              1. Create mapping table: old profile.id → new user.id
              2. Fetch all users from AuthKit API
              3. Match by email to populate mapping
              4. Update all profile.id references to user.id
```

**Email verification note:** WorkOS ensures `user.email` is verified before completing authentication. If verification is needed, the API returns an `email_verification_required` error (see Step 7).

**Verify:** After first successful callback with new API, confirm `user.id` format starts with `user_` (not `prof_`).

## Step 6: Enable AuthKit Hosted UI (Optional)

Instead of building custom auth UI, use AuthKit's pre-built flows for email verification, MFA enrollment, and organization selection.

### Enable in Dashboard:

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/) → Authentication
2. Enable "AuthKit Hosted UI"
3. Configure branding, logo, custom domain

### Update Initiation Call:

```typescript
// Use 'authkit' provider to trigger hosted UI
const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
  provider: 'authkit', // This is the only change
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  state: JSON.stringify({ userId: '123' }),
});
```

**When to use `authkit` provider:**
- You want WorkOS to handle email verification UI
- You want WorkOS to handle MFA enrollment UI
- You don't want to build custom error handling for Step 7

**When to use specific provider (e.g., `GoogleOAuth`):**
- You want full control over authentication UI
- You handle email verification and MFA in your own UI

## Step 7: Handle New Error Cases

AuthKit API returns additional error codes for advanced security flows. These did NOT exist in the old SSO API.

### Error Response Structure:

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code: req.query.code,
    clientId: process.env.WORKOS_CLIENT_ID,
  });
} catch (error) {
  // error.code contains specific error type
  // error.message contains human-readable description
}
```

### Error Code → Action Mapping:

| Error Code | Meaning | Action |
|-----------|---------|--------|
| `email_verification_required` | User must verify email before completing auth | Show verification UI or use `authkit` provider |
| `mfa_enrollment_required` | User must enroll in MFA (if MFA required in dashboard) | Show MFA enrollment UI or use `authkit` provider |
| `organization_selection_required` | User belongs to multiple orgs and must choose one | Show org selection UI or use `authkit` provider |

### Disabling Advanced Flows:

If you don't need email verification or MFA:

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/) → Authentication
2. Uncheck "Require email verification"
3. Uncheck "Require MFA enrollment"

**Important:** If using `authkit` provider, you do NOT need to handle these errors — the hosted UI handles them automatically before redirecting to your callback.

**Verify:** Trigger each error case (test with unverified email, MFA-required org, multi-org user) and confirm your app handles or delegates to AuthKit.

## Step 8: Update User Object Field Access

Profile and User objects have similar fields but may differ in structure. Check the fetched docs for complete field mappings.

### Common Field Changes:

```typescript
// OLD (Profile)
profile.id          // prof_...
profile.email       // string
profile.firstName   // string | null
profile.lastName    // string | null

// NEW (User)
user.id             // user_... (DIFFERENT ID)
user.email          // string (always verified)
user.firstName      // string | null
user.lastName       // string | null
user.emailVerified  // boolean (new field)
user.createdAt      // ISO timestamp (new field)
user.updatedAt      // ISO timestamp (new field)
```

**Verify:** Search codebase for `profile.` access and replace with `user.`:

```bash
grep -r "profile\." . --include="*.ts" --include="*.js" | grep -v node_modules
```

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. No old SSO API calls remain
! grep -r "sso\.getAuthorizationUrl\|sso\.getProfileAndToken" . --include="*.ts" --include="*.js" --exclude-dir=node_modules
echo "PASS: No legacy SSO API calls found"

# 2. New AuthKit API calls present
grep -r "userManagement\.getAuthorizationUrl\|userManagement\.authenticateWithCode" . --include="*.ts" --include="*.js" --exclude-dir=node_modules
echo "PASS: AuthKit API calls found"

# 3. No profile.id usage (should be user.id)
! grep -r "profile\.id" . --include="*.ts" --include="*.js" --exclude-dir=node_modules | grep -v "// OLD"
echo "PASS: No profile.id references (except in comments)"

# 4. Application builds
npm run build || echo "FAIL: Build errors"

# 5. Test auth flow end-to-end
# Manual: Initiate auth → complete callback → verify user.id returned
```

**If check #3 fails:** You still have code using old Profile IDs. Update to `user.id`.

## Error Recovery

### "User ID not found in database" after migration

**Root cause:** Your DB still stores old `prof_...` IDs, but new API returns `user_...` IDs.

**Fix:**
1. Add new column `workos_user_id` to user table
2. Keep old `workos_profile_id` temporarily
3. On first login with new API, match by email and populate `workos_user_id`
4. Update all ID lookups to use `workos_user_id`
5. After all users migrated, drop `workos_profile_id` column

### "email_verification_required" error in production

**Root cause:** Email verification is enabled in dashboard but your app doesn't handle it.

**Fix (choose one):**
1. **Easiest:** Use `authkit` provider in Step 4 — WorkOS handles verification UI
2. **Custom UI:** Build email verification flow in your app (see fetched docs for API)
3. **Disable:** Turn off email verification in dashboard (not recommended for security)

### "Invalid authorization code" errors

**Root cause:** Same as before — codes expire after 10 minutes or single use.

**Fix:**
- Check: Code exchange happens immediately after redirect
- Check: No retry logic that reuses same code
- Check: User isn't refreshing callback page (generates new code)

### Import error: "userManagement is not a function"

**Root cause:** SDK version too old to support AuthKit API.

**Fix:**
1. Check SDK version: `npm list @workos-inc/node`
2. Update to latest: `npm install @workos-inc/node@latest`
3. Verify `userManagement` namespace exists in SDK docs

### AuthKit provider returns SSO error

**Root cause:** AuthKit not enabled in dashboard.

**Fix:**
1. Go to [WorkOS Dashboard](https://dashboard.workos.com/) → Authentication
2. Enable "AuthKit Hosted UI"
3. Wait 1-2 minutes for propagation
4. Retry auth flow

## Related Skills

- **workos-authkit-nextjs** — If using Next.js App Router, use this instead of direct API calls
- **workos-authkit-react** — If using React, use this for client-side auth patterns
- **workos-api-authkit** — Lower-level AuthKit API reference for custom integrations
- **workos-sso** — If setting up SSO for the FIRST time (not migrating from old API)
