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

Scan your codebase for SSO API usage:

```bash
# Find SSO initiation calls
grep -r "getAuthorizationUrl\|authorization_url" --include="*.ts" --include="*.js"

# Find SSO callback handlers
grep -r "getProfileAndToken\|profile_and_token" --include="*.ts" --include="*.js"

# Find Profile ID storage
grep -r "profile_id\|profileId" --include="*.ts" --include="*.js"
```

**Document findings:** List all files that need updating.

### Verify Prerequisites

Check environment variables in `.env` or `.env.local`:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Test API connectivity:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/user_management/organizations
```

Expected: 200 response (even if empty list). Not 401/403.

## Step 3: Migration Decision Tree

```
Do you want pre-built auth UI?
  |
  +-- YES --> Use AuthKit Hosted UI (Step 4A)
  |           - Handles email verification automatically
  |           - Handles MFA enrollment automatically
  |           - Custom branding via Dashboard
  |
  +-- NO  --> Use AuthKit API directly (Step 4B)
              - Full control over UI
              - Manual handling of verification flows
              - More implementation complexity
```

## Step 4A: AuthKit Hosted UI Migration (Recommended)

### Update Authorization URL Call

**Find existing SSO initiation:**

```typescript
// OLD - SSO API
const authorizationUrl = sso.getAuthorizationUrl({
  connection: connectionId,
  redirect_uri: callbackUrl,
  state: sessionState,
});
```

**Replace with AuthKit initiation:**

```typescript
// NEW - AuthKit with Hosted UI
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit', // KEY CHANGE - enables hosted UI
  redirect_uri: callbackUrl,
  state: sessionState,
  // connection_id still supported for SSO connections
  connection_id: connectionId, // optional
});
```

**Critical:** `provider: 'authkit'` enables the hosted UI flow with automatic email verification and MFA.

### Update Callback Handler

**Find existing callback:**

```typescript
// OLD - SSO callback
const { profile } = await sso.getProfileAndToken({
  code: authCode,
});
const profileId = profile.id; // WARNING: This ID type is changing
```

**Replace with AuthKit callback:**

```typescript
// NEW - AuthKit callback
const { user } = await workos.userManagement.authenticateWithCode({
  code: authCode,
  clientId: process.env.WORKOS_CLIENT_ID!,
});
const userId = user.id; // Different ID format than profile.id
```

**BREAKING CHANGE:** User IDs are NOT the same as Profile IDs. See Step 5 for migration strategy.

## Step 4B: AuthKit API Direct Integration

**Use this path only if you need custom UI.** You must handle these flows manually:

### Authorization with Specific Providers

```typescript
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'GoogleOAuth', // or 'MicrosoftOAuth', 'GitHubOAuth', etc.
  // NOT 'authkit' - that's for hosted UI
  connection_id: connectionId, // for SSO connections
  redirect_uri: callbackUrl,
  state: sessionState,
});
```

### Handle Email Verification Response

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code: authCode,
    clientId: process.env.WORKOS_CLIENT_ID!,
  });
} catch (error) {
  if (error.code === 'email_verification_required') {
    // User must verify email before proceeding
    // error.email contains the email address
    // error.user_id contains the pending user ID
    // Redirect to custom verification UI
    return redirect(`/verify-email?user_id=${error.user_id}`);
  }
  throw error;
}
```

### Handle MFA Enrollment

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code: authCode,
    clientId: process.env.WORKOS_CLIENT_ID!,
  });
} catch (error) {
  if (error.code === 'mfa_enrollment_required') {
    // User must enroll in MFA
    // Redirect to custom MFA enrollment UI
    return redirect(`/enroll-mfa?user_id=${error.user_id}`);
  }
  throw error;
}
```

**Note:** AuthKit Hosted UI handles both flows automatically. Use 4B only if custom UI is required.

## Step 5: User ID Migration Strategy

**CRITICAL:** WorkOS User IDs ≠ SSO Profile IDs. Choose one migration path:

### Option A: Email-Based Mapping (Recommended)

If email is unique in your application:

```typescript
// Find existing user by email
const workosUser = await workos.userManagement.authenticateWithCode({
  code: authCode,
  clientId: process.env.WORKOS_CLIENT_ID!,
});

// Map to application user
const appUser = await findUserByEmail(workosUser.user.email);
if (appUser) {
  // Update stored WorkOS ID
  await updateUser(appUser.id, {
    workos_user_id: workosUser.user.id,
  });
} else {
  // Create new user
  await createUser({
    email: workosUser.user.email,
    workos_user_id: workosUser.user.id,
    // ... other fields
  });
}
```

**WorkOS guarantees:** Email is verified before authentication succeeds.

### Option B: Profile ID → User ID Lookup Table

If email is NOT unique or you need exact ID mapping:

```sql
-- Create migration mapping table
CREATE TABLE workos_id_migrations (
  old_profile_id VARCHAR(255) PRIMARY KEY,
  new_user_id VARCHAR(255) NOT NULL,
  migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```typescript
// During first AuthKit login, store mapping
const { user } = await workos.userManagement.authenticateWithCode({
  code: authCode,
  clientId: process.env.WORKOS_CLIENT_ID!,
});

// Look up which old profile this corresponds to
const oldProfileId = await findProfileIdByEmail(user.email);
if (oldProfileId) {
  await db.query(
    'INSERT INTO workos_id_migrations (old_profile_id, new_user_id) VALUES ($1, $2)',
    [oldProfileId, user.id]
  );
}
```

**Migration window:** Run both systems in parallel, gradually building the mapping table.

## Step 6: Configure AuthKit Settings

**Dashboard location:** https://dashboard.workos.com/authkit

### Required Settings

Navigate to Dashboard → AuthKit → Authentication:

- **Email Verification:** Enable if emails must be verified (recommended)
- **MFA Requirement:** Enable if multi-factor auth is required
- **Account Linking:** Configure how duplicate emails are handled

**If disabled:** AuthKit API will not return `email_verification_required` or `mfa_enrollment_required` errors.

**If enabled and using Hosted UI (Step 4A):** Flows handled automatically.

**If enabled and using API directly (Step 4B):** You must implement error handlers.

### Branding Configuration (Optional)

Dashboard → AuthKit → Branding:

- Logo URL
- Brand color
- Custom domain (requires DNS setup)

## Step 7: Update Error Handling

### Add New Error Cases

```typescript
try {
  const { user } = await workos.userManagement.authenticateWithCode({
    code: authCode,
    clientId: process.env.WORKOS_CLIENT_ID!,
  });
} catch (error) {
  switch (error.code) {
    case 'email_verification_required':
      // Only if NOT using AuthKit Hosted UI
      return handleEmailVerification(error.user_id, error.email);

    case 'mfa_enrollment_required':
      // Only if NOT using AuthKit Hosted UI
      return handleMfaEnrollment(error.user_id);

    case 'invalid_grant':
      // Code expired or already used
      return redirect('/login?error=expired');

    case 'invalid_client':
      // Wrong client_id
      console.error('WORKOS_CLIENT_ID mismatch');
      return redirect('/login?error=config');

    default:
      throw error;
  }
}
```

**If using AuthKit Hosted UI:** Only `invalid_grant` and `invalid_client` are relevant.

## Step 8: Test Migration

### Create Test User

Dashboard → User Management → Users → Create User

Create a test user with known email.

### Test Authentication Flow

```bash
# 1. Generate authorization URL
curl -X POST https://api.workos.com/user_management/authorize \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$WORKOS_CLIENT_ID"'",
    "redirect_uri": "http://localhost:3000/callback",
    "provider": "authkit"
  }'

# 2. Visit authorization_url in browser
# 3. Complete auth flow
# 4. Verify callback receives code parameter
# 5. Exchange code for user (test in your callback handler)
```

### Verify User Object Structure

```typescript
// Log user object to confirm fields
console.log('WorkOS User:', JSON.stringify(user, null, 2));

// Confirm expected fields exist:
// - user.id (NOT profile.id)
// - user.email
// - user.firstName / user.lastName
// - user.emailVerified (boolean)
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. No SSO API calls remain
! grep -r "getProfileAndToken\|profile_and_token" --include="*.ts" --include="*.js" || \
  echo "FAIL: Still using SSO API"

# 2. Using AuthKit authorization
grep -r "getAuthorizationUrl.*authkit\|provider.*authkit" --include="*.ts" --include="*.js" || \
  echo "FAIL: Not using AuthKit provider"

# 3. Using authenticateWithCode
grep -r "authenticateWithCode" --include="*.ts" --include="*.js" || \
  echo "FAIL: Not using AuthKit authentication"

# 4. No direct profile.id references
! grep -r "profile\.id\|profile\[.id.\]" --include="*.ts" --include="*.js" || \
  echo "FAIL: Still referencing profile.id (should be user.id)"

# 5. Test authentication succeeds
npm run test -- --grep "authentication"
```

**All checks must pass** before deploying to production.

## Error Recovery

### "email_verification_required" error in production

**Root cause:** Email verification enabled in Dashboard, but not handled in code.

**Fix path:**

```
Using AuthKit Hosted UI?
  |
  +-- YES --> This error should never occur with Hosted UI
  |           Check: provider is set to 'authkit' (not a specific provider)
  |
  +-- NO  --> Implement email verification handler (see Step 4B)
              OR switch to AuthKit Hosted UI (Step 4A)
```

### "invalid_client" error

**Root cause:** `client_id` parameter doesn't match `WORKOS_CLIENT_ID`.

**Fix:**

```bash
# Verify client_id from Dashboard
echo "Expected: $(grep WORKOS_CLIENT_ID .env | cut -d= -f2)"

# Check what's being sent in authenticateWithCode call
# Add logging before the call:
console.log('Using client_id:', process.env.WORKOS_CLIENT_ID);
```

### "User not found" after migration

**Root cause:** Old profile IDs don't map to new user IDs.

**Fix:** Implement Option A or B from Step 5. Check if email mapping logic is correct.

### Users stuck in email verification loop

**Root cause:** Email verification handler not redirecting properly.

**Fix:**

```typescript
// After email verified, redirect back to auth flow
const verificationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  redirect_uri: callbackUrl,
  login_hint: verifiedEmail, // Pre-fill email
});
```

### Code exchange fails with "invalid_grant"

**Root causes (in order of likelihood):**

1. **Code already used:** Callback handler called twice (check for duplicate requests)
2. **Code expired:** User took >10 minutes to complete auth
3. **Wrong redirect_uri:** Callback URL doesn't match initiation URL exactly

**Debug:**

```bash
# Check callback is only called once
grep "authenticateWithCode" logs/app.log | wc -l  # Should equal number of logins

# Verify redirect_uri matches exactly (including trailing slash)
echo "Initiation: $REDIRECT_URI"
echo "Callback:   $ACTUAL_CALLBACK_URL"
```

### Dashboard shows "AuthKit not configured"

**Fix:** Navigate to Dashboard → AuthKit → Enable AuthKit

**Required steps:**

1. Enable AuthKit toggle
2. Configure at least one authentication method
3. Set redirect URI in allowed list

## Related Skills

- `workos-authkit-nextjs` - Full Next.js integration with AuthKit
- `workos-directory-sync` - Sync user directories from identity providers
- `workos-admin-portal` - Self-serve SSO configuration for customers
