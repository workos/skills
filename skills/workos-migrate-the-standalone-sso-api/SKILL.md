---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- generated -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Identify Current Integration Points

Locate all places in your codebase that call WorkOS SSO APIs:

```bash
# Find SSO initiation calls
grep -r "getAuthorizationUrl\|GetAuthorizationURL" . --include="*.ts" --include="*.js" --include="*.go" --include="*.py"

# Find callback/token exchange
grep -r "getProfileAndToken\|GetProfileAndToken\|authenticateWithCode" . --include="*.ts" --include="*.js" --include="*.go" --include="*.py"
```

**Record locations:** You'll need to update each one.

### User ID Migration Strategy (CRITICAL DECISION)

WorkOS AuthKit issues **different User IDs** than SSO Profile IDs.

```
Migration strategy?
  |
  +-- Email is unique identifier --> Map by email (Step 3A)
  |
  +-- Profile ID stored in DB     --> Dual-lookup migration (Step 3B)
  |
  +-- Fresh start acceptable      --> Direct replacement (Step 3C)
```

**Decide now** — this affects all subsequent steps.

## Step 3A: Email-Based Migration

**Use when:** Email is unique across all users in your system.

### Database Schema Check

Verify email column exists and is indexed:

```sql
-- Example for PostgreSQL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'email';

-- Check for index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'users' AND indexdef LIKE '%email%';
```

If no email column or no index: **Add them before proceeding.**

### Migration Pattern

When exchanging code for user:

1. Receive WorkOS User object (has `user.email`)
2. Query local DB by email: `SELECT * FROM users WHERE email = ?`
3. If found: Update with new `workos_user_id`
4. If not found: Create new user record

**Skip to Step 4.**

## Step 3B: Dual-Lookup Migration (Advanced)

**Use when:** You must preserve existing Profile IDs during transition.

### Add User ID Mapping Table

```sql
CREATE TABLE workos_user_migrations (
  old_profile_id VARCHAR(255) PRIMARY KEY,
  new_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email ON workos_user_migrations(email);
```

### Migration Pattern

1. First auth after migration: User authenticates via AuthKit
2. Receive new WorkOS User object
3. Query mapping table by email
4. If not found: Insert mapping from old Profile ID to new User ID
5. Application uses new User ID going forward

**Requires:** Knowing old Profile IDs (export from DB before migration).

**Skip to Step 4.**

## Step 3C: Direct Replacement

**Use when:** Fresh start is acceptable (dev environments, new features).

Simply replace User ID storage with AuthKit User IDs. No migration logic needed.

## Step 4: Update SSO Initiation

### Locate Initiation Calls

Find where you call SSO's `getAuthorizationUrl`:

```bash
# Language-specific search
grep -r "sso\.getAuthorizationUrl\|GetAuthorizationURL" . --include="*.ts" --include="*.js"
```

### Replace with AuthKit Initiation

**Before (SSO API):**

```typescript
const url = await workos.sso.getAuthorizationUrl({
  organization: 'org_123',
  redirectUri: 'https://app.com/callback',
  state: 'session_token'
});
```

**After (AuthKit API):**

```typescript
const url = await workos.userManagement.getAuthorizationUrl({
  provider: 'authkit', // Or 'GoogleOAuth', 'MicrosoftOAuth', organization ID, etc.
  redirectUri: 'https://app.com/callback',
  state: 'session_token'
});
```

**Key differences:**

- API namespace: `sso` → `userManagement`
- Parameter: `organization` → `provider` (supports more types)
- `provider: 'authkit'` enables Hosted UI with all flows

**Supported provider values:** Check migration guide for full list (organization IDs, OAuth provider strings, 'authkit').

## Step 5: Update Callback Handler

### Locate Callback Route

Find where you exchange code for user profile:

```bash
# Find token exchange calls
grep -r "getProfileAndToken\|GetProfileAndToken" . --include="*.ts" --include="*.js"
```

### Replace Token Exchange

**Before (SSO API):**

```typescript
const { profile } = await workos.sso.getProfileAndToken({
  code,
  clientId: process.env.WORKOS_CLIENT_ID
});

// profile.id was SSO Profile ID
const userId = profile.id;
```

**After (AuthKit API):**

```typescript
const { user } = await workos.userManagement.authenticateWithCode({
  code,
  clientId: process.env.WORKOS_CLIENT_ID
});

// user.id is AuthKit User ID (DIFFERENT from old profile.id)
const userId = user.id;
```

**Object structure changes:**

| SSO Profile | AuthKit User | Notes |
|-------------|--------------|-------|
| `profile.id` | `user.id` | **IDs are different** |
| `profile.email` | `user.email` | Same, verified by WorkOS |
| `profile.first_name` | `user.firstName` | Casing changed |
| `profile.last_name` | `user.lastName` | Casing changed |

Check migration guide for full field mapping.

## Step 6: Handle New Error Cases

AuthKit returns new error types for security flows:

### Email Verification Required

**Error code:** `email_verification_required`

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code,
    clientId: process.env.WORKOS_CLIENT_ID
  });
} catch (error) {
  if (error.code === 'email_verification_required') {
    // Redirect user to verify email
    // If using Hosted UI (provider: 'authkit'), this is handled automatically
    return redirect(error.email_verification_url);
  }
}
```

### MFA Enrollment Required

**Error code:** `mfa_enrollment_required`

### Account Linking Required

**Error code:** `account_linking_required`

**Decision tree:**

```
Using AuthKit Hosted UI?
  |
  +-- YES (provider: 'authkit') --> Errors handled automatically, just redirect to authkit URL
  |
  +-- NO (custom UI) --> Handle each error case in callback
```

### Disable Advanced Flows (Optional)

If your app doesn't need email verification or MFA:

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to **Authentication** section
3. Toggle off unwanted features

This prevents the error cases from occurring.

## Step 7: Test Migration Path

### Test User Journey

```
Test flow:
  |
  1. User initiates auth (Step 4 code)
  |
  2. User completes auth flow
  |
  3. Callback receives code
  |
  4. Code exchanged for User object (Step 5 code)
  |
  5. Verify User ID lookup works (Step 3A/3B/3C logic)
```

### Verify User ID Mapping

```bash
# Check database for new User IDs
# Example SQL for Step 3A pattern
SELECT email, workos_user_id, updated_at FROM users 
WHERE updated_at > NOW() - INTERVAL '1 hour';

# Example SQL for Step 3B pattern
SELECT * FROM workos_user_migrations 
WHERE migrated_at > NOW() - INTERVAL '1 hour';
```

**Expected:** New WorkOS User IDs appear in database after successful auth.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration:

```bash
# 1. Verify SSO API calls removed
! grep -r "sso\.getAuthorizationUrl\|sso\.getProfileAndToken" . --include="*.ts" --include="*.js" || echo "FAIL: Old SSO API calls still present"

# 2. Verify AuthKit API calls present
grep -r "userManagement\.getAuthorizationUrl\|userManagement\.authenticateWithCode" . --include="*.ts" --include="*.js" || echo "FAIL: AuthKit API calls not found"

# 3. Verify User ID handling updated
grep -r "user\.id\|user\.email" . --include="*.ts" --include="*.js" || echo "FAIL: User object fields not accessed"

# 4. Application builds
npm run build || echo "FAIL: Build errors"

# 5. Test authentication flow
curl -X POST http://localhost:3000/api/auth/callback?code=test_code || echo "FAIL: Callback endpoint error"
```

## Error Recovery

### "Invalid client ID" during auth

**Root cause:** Using SSO endpoint URLs instead of AuthKit endpoints.

**Fix:**

1. Verify using `userManagement.getAuthorizationUrl` not `sso.getAuthorizationUrl`
2. Check `WORKOS_CLIENT_ID` env var is set correctly

### "User ID not found in database" after auth

**Root cause:** User ID mapping logic not applied (Step 3 incomplete).

**Fix:**

1. Check which migration strategy you chose (3A/3B/3C)
2. Verify database query uses correct field (`email` for 3A, mapping table for 3B)
3. Add logging to callback to see what User ID is received vs. what's queried

### "email_verification_required" error loop

**Root cause:** Not redirecting user to verification URL.

**Fix:**

1. If using AuthKit Hosted UI (`provider: 'authkit'`): Ensure initiation URL is used correctly
2. If using custom UI: Add error handling in Step 6 to redirect to `error.email_verification_url`
3. Or disable email verification in Dashboard (Step 6)

### Different User IDs breaking existing sessions

**Root cause:** Old Profile IDs stored in session tokens, new User IDs don't match.

**Fix:**

1. Force session logout for all users during migration window
2. Or implement Step 3B dual-lookup to map old → new IDs
3. Update session creation to use new User IDs from AuthKit

### "provider not supported" error

**Root cause:** Invalid provider value in `getAuthorizationUrl`.

**Fix:**

1. Check migration guide for valid provider values
2. Organization IDs should be used directly (e.g., `org_123`)
3. For Hosted UI, use `provider: 'authkit'`
4. For OAuth, use provider strings like `'GoogleOAuth'`

## Related Skills

- `workos-authkit-nextjs` - For Next.js-specific AuthKit integration with middleware
- `workos-directory-sync` - If also migrating Directory Sync alongside SSO
