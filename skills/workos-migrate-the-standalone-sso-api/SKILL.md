---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- generated -->

# WorkOS Migration: the standalone SSO API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Identify Current SSO Integration Points

Run these commands to find existing SSO API calls:

```bash
# Find SSO authorization URL calls
grep -r "sso.getAuthorizationUrl\|/sso/authorize" --include="*.ts" --include="*.js" .

# Find SSO profile/token exchange calls
grep -r "sso.getProfileAndToken\|/sso/token" --include="*.ts" --include="*.js" .

# Find Profile ID references in database models/types
grep -r "ProfileId\|profile_id" --include="*.ts" --include="*.prisma" .
```

**Record locations** — you will update these files in subsequent steps.

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**CRITICAL:** These remain the same after migration. Do NOT create new keys.

### Verify SDK Version

Check `package.json` for WorkOS SDK version:

```bash
grep '"@workos-inc' package.json
```

AuthKit API requires SDK version **4.0.0+**. Upgrade if needed:

```bash
npm install @workos-inc/node@latest  # Node.js
# OR
npm install @workos-inc/authkit-nextjs@latest  # Next.js
```

## Step 3: User ID Migration Strategy (Decision Tree)

**CRITICAL:** WorkOS User IDs differ from SSO Profile IDs. Choose migration path:

```
Email unique in your app?
  |
  +-- YES --> Use email as join key (recommended)
  |           - No ID migration needed
  |           - WorkOS guarantees verified emails
  |
  +-- NO  --> Create ID mapping table
              - Map old Profile IDs to new User IDs
              - Requires data migration script
```

### Option A: Email as Join Key (Recommended)

If email is unique, your existing user lookup works unchanged:

```typescript
// Before: SSO Profile
const profile = await sso.getProfileAndToken(code);
const user = await db.findByEmail(profile.email);

// After: AuthKit User (same lookup)
const { user: workosUser } = await workos.userManagement.authenticateWithCode({ code });
const user = await db.findByEmail(workosUser.email);
```

**Verification:** WorkOS enforces email verification before auth completes. No additional checks needed.

### Option B: ID Mapping Table

If email is NOT unique, create migration mapping:

1. Create table:
   ```sql
   CREATE TABLE workos_id_migration (
     old_profile_id VARCHAR(255) PRIMARY KEY,
     new_user_id VARCHAR(255) NOT NULL,
     migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. During transition period, log both IDs:
   ```typescript
   const { user } = await workos.userManagement.authenticateWithCode({ code });
   await db.migration.upsert({
     old_profile_id: user.legacyId, // if available
     new_user_id: user.id
   });
   ```

3. Update foreign keys gradually using mapping table

## Step 4: Replace Authorization URL Calls

Find all SSO authorization calls from Step 2 assessment.

**Before (SSO API):**
```typescript
const authorizationUrl = workos.sso.getAuthorizationUrl({
  provider: 'GoogleOAuth',
  redirectUri: 'https://app.com/callback',
  state: 'custom_state'
});
```

**After (AuthKit API):**
```typescript
const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
  provider: 'GoogleOAuth', // OR 'authkit' for hosted UI
  redirectUri: 'https://app.com/callback',
  state: 'custom_state'
});
```

**Key differences:**
- Method is now async (add `await`)
- Supports new `provider: 'authkit'` for Hosted UI
- All other parameters (organization, connection, domain_hint) remain compatible

**Decision: Hosted UI vs Custom UI**

```
Want pre-built auth UI?
  |
  +-- YES --> Use provider: 'authkit'
  |           - Email verification automatic
  |           - MFA enrollment automatic
  |           - Branding configurable in dashboard
  |
  +-- NO  --> Keep existing provider strings
              - Handle new error cases (Step 6)
              - Custom UI for email verification
```

## Step 5: Replace Profile/Token Exchange

Find all profile exchange calls from Step 2 assessment.

**Before (SSO API):**
```typescript
const { profile } = await workos.sso.getProfileAndToken({
  code,
  clientId: process.env.WORKOS_CLIENT_ID!
});

// Profile object: { id, email, first_name, last_name, ... }
const userId = profile.id; // ⚠️ Different from AuthKit User ID
```

**After (AuthKit API):**
```typescript
const { user } = await workos.userManagement.authenticateWithCode({
  code,
  clientId: process.env.WORKOS_CLIENT_ID!
});

// User object: { id, email, firstName, lastName, emailVerified, ... }
const userId = user.id; // ⚠️ New ID format
```

**Schema mapping:**

| SSO Profile       | AuthKit User      | Notes                          |
|-------------------|-------------------|--------------------------------|
| `profile.id`      | `user.id`         | **Different values**           |
| `profile.email`   | `user.email`      | Same (verified by WorkOS)      |
| `profile.first_name` | `user.firstName` | Camel case                   |
| `profile.last_name`  | `user.lastName`  | Camel case                   |
| N/A               | `user.emailVerified` | New field (always true)     |
| N/A               | `user.createdAt`  | New field                      |

## Step 6: Handle New Authentication Flows

AuthKit introduces new challenge-response flows for security. If NOT using `provider: 'authkit'` (Hosted UI), your callback MUST handle these errors:

### Error: Email Verification Required

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({ code });
} catch (error) {
  if (error.code === 'email_verification_required') {
    // User must verify email before continuing
    // error.email contains the unverified email
    // error.pendingAuthenticationToken for resuming after verification
    
    return sendToEmailVerificationPage({
      email: error.email,
      token: error.pendingAuthenticationToken
    });
  }
}
```

**Disable in Dashboard:** If you don't want email verification, go to WorkOS Dashboard → Authentication → uncheck "Require email verification"

### Error: MFA Required

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({ code });
} catch (error) {
  if (error.code === 'mfa_required') {
    // User must complete MFA challenge
    // error.pendingAuthenticationToken for resuming after MFA
    
    return sendToMfaChallengePage({
      token: error.pendingAuthenticationToken
    });
  }
}
```

**Disable in Dashboard:** WorkOS Dashboard → Authentication → uncheck "Require MFA enrollment"

### Error: Account Linking Required

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({ code });
} catch (error) {
  if (error.code === 'user_account_linking_required') {
    // Multiple accounts exist for this email
    // error.pendingAuthenticationToken to resolve conflict
    
    return sendToAccountLinkingPage({
      token: error.pendingAuthenticationToken
    });
  }
}
```

**Bypass:** If Hosted UI is enabled (`provider: 'authkit'`), these challenges are handled automatically. No error handling needed.

## Step 7: Update Type Definitions

If using TypeScript, update type imports:

**Before:**
```typescript
import type { Profile } from '@workos-inc/node';
```

**After:**
```typescript
import type { User } from '@workos-inc/node';
```

Search for `Profile` type references:

```bash
grep -r ": Profile\|<Profile>" --include="*.ts" .
```

Replace with `User` type, accounting for field name changes (snake_case → camelCase).

## Step 8: Dashboard Configuration (If Using Hosted UI)

If you chose `provider: 'authkit'` in Step 4:

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/) → Authentication
2. Enable "AuthKit"
3. Configure branding (logo, colors, button text)
4. Optional: Set up custom domain for auth pages

**Verify:** Visit authorization URL in browser — should show WorkOS-hosted login page.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. No old SSO API calls remain
! grep -r "sso\.getAuthorizationUrl\|sso\.getProfileAndToken" --include="*.ts" --include="*.js" . || echo "FAIL: Old SSO calls found"

# 2. New AuthKit API calls present
grep -r "userManagement\.getAuthorizationUrl" --include="*.ts" --include="*.js" . || echo "FAIL: No AuthKit authorization calls"
grep -r "userManagement\.authenticateWithCode" --include="*.ts" --include="*.js" . || echo "FAIL: No AuthKit authenticate calls"

# 3. Error handling present (unless using Hosted UI)
grep -r "email_verification_required\|mfa_required" --include="*.ts" --include="*.js" . || echo "WARNING: No error handling (OK if using authkit provider)"

# 4. Application builds
npm run build || echo "FAIL: Build errors"

# 5. Test authentication flow
echo "MANUAL: Log in via authorization URL and confirm callback succeeds"
```

## Error Recovery

### "Invalid code" after migration

**Root cause:** Code was generated with old SSO API, trying to exchange with new AuthKit API.

**Fix:** Clear all in-flight auth sessions, regenerate authorization URLs with new API.

### "User ID mismatch" in database lookups

**Root cause:** Using old Profile IDs with new User IDs (Step 3 migration path not completed).

**Fix:** 
- Short-term: Switch to email-based lookup if possible
- Long-term: Complete ID mapping table (Step 3, Option B)

### "Email verification required" error in production

**Root cause:** Email verification enabled but error handling not implemented.

**Fix (choose one):**
- Option A: Implement email verification flow (Step 6)
- Option B: Disable in Dashboard (WorkOS Dashboard → Authentication)
- Option C: Switch to `provider: 'authkit'` for automatic handling

### Build errors: "Property 'first_name' does not exist"

**Root cause:** TypeScript types still reference old Profile schema.

**Fix:** Update to `User` type, change `first_name` → `firstName`, `last_name` → `lastName`.

### "Cannot find module '@workos-inc/node'"

**Root cause:** SDK not installed or wrong version.

**Fix:** 
```bash
npm install @workos-inc/node@latest
```

Minimum version: 4.0.0 for AuthKit API support.

### Hosted UI not showing after enabling in dashboard

**Root cause:** `provider` parameter still set to specific provider (e.g., 'GoogleOAuth').

**Fix:** Change `provider: 'GoogleOAuth'` to `provider: 'authkit'` in authorization URL call.

### "Missing redirect_uri parameter"

**Root cause:** Same as before — callback URL not provided.

**Fix:** Ensure `redirectUri` passed to `getAuthorizationUrl()`. No changes needed from SSO API.

## Related Skills

- `workos-authkit-nextjs` - Full AuthKit integration for Next.js (if migrating to Hosted UI)
- `workos-directory-sync` - WorkOS Directory Sync for user provisioning
- `workos-user-management` - AuthKit User Management API reference
