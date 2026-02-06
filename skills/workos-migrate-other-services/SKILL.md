---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- generated -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The migration docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Planning (Decision Tree)

Determine your migration strategy based on user signup patterns:

```
Can you disable signups temporarily?
  |
  +-- YES --> Use "big-bang" migration (simpler, recommended)
  |           - Schedule maintenance window
  |           - Disable signups during export/import
  |           - Re-enable after migration complete
  |
  +-- NO  --> Use dual-write strategy (complex)
              - Create users in BOTH systems during transition
              - Handle updates in both systems
              - Export/import historical users while dual-writing new ones
```

**If dual-write:** You MUST maintain consistency for email updates, password changes, and auth method changes across both systems until migration completes.

## Step 3: Export Existing Users

Extract user data from your current data store. Required fields for each user:

- **Email address** (primary identifier for matching)
- **First name** (optional)
- **Last name** (optional)
- **Email verified status** (boolean)

**If using password auth:** Also export password hashes. WorkOS supports:
- bcrypt
- scrypt
- firebase-scrypt
- ssha
- pbkdf2
- argon2

**If using social auth:** Export which provider each user uses (Google, Microsoft, etc.). WorkOS matches users by email address when they sign in via OAuth providers.

Save export as structured data (JSON, CSV, or database dump).

## Step 4: Verify WorkOS Prerequisites

Check environment variables:

```bash
# These MUST exist before proceeding
grep -q "WORKOS_API_KEY=sk_" .env.local && echo "✓ API key present" || echo "✗ Missing API key"
grep -q "WORKOS_CLIENT_ID=client_" .env.local && echo "✓ Client ID present" || echo "✗ Missing client ID"
```

Confirm SDK installed:

```bash
# One of these should pass
npm list @workos-inc/node 2>/dev/null || echo "SDK not installed"
```

## Step 5: Configure Social Auth Providers (If Applicable)

**Skip this step if you only use passwords or email magic links.**

If your users sign in with Google, Microsoft, or other OAuth providers:

1. Navigate to WorkOS Dashboard → Authentication → Social Providers
2. For each provider your app uses:
   - Add provider client credentials
   - Configure redirect URLs
   - Enable the provider

**Critical:** WorkOS links social auth users by **email address**. If a user signs in via Google with `user@example.com`, WorkOS will match them to the imported user record with that email.

## Step 6: Import Users to WorkOS

Create a migration script using the [Create User API](https://workos.com/docs/reference/authkit/user/create).

### Basic User Creation (No Password)

```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(user) {
  const workosUser = await workos.userManagement.createUser({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
  });
  
  // IMPORTANT: Store workosUser.id alongside your local user record
  return workosUser.id; // Format: "user_01E4ZCR3C56J083X43JQXF3JK5"
}
```

### With Password Import

```javascript
async function importUserWithPassword(user) {
  const workosUser = await workos.userManagement.createUser({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
    password: user.passwordHash,
    passwordHashType: 'bcrypt', // or scrypt, pbkdf2, etc.
  });
  
  return workosUser.id;
}
```

**CRITICAL:** Store the returned WorkOS user ID (`user_01...`) in your database alongside the existing user record. You'll need this for future WorkOS API calls.

Run migration script in batches to avoid rate limits:

```javascript
const BATCH_SIZE = 100;
const DELAY_MS = 1000; // 1 second between batches

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(importUser));
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
}
```

## Step 7: Handle Password Migration Edge Cases (Decision Tree)

```
Can you export password hashes?
  |
  +-- YES --> Import during user creation (see Step 6)
  |
  +-- NO  --> Trigger password resets after import
              |
              +-- Do you want to keep passwords?
                  |
                  +-- YES --> Use Password Reset API for each user
                  |
                  +-- NO  --> Switch to Magic Auth, skip password handling
```

### Triggering Password Resets (If Needed)

If you cannot export passwords but want to keep password auth:

```javascript
async function triggerPasswordReset(email) {
  await workos.userManagement.sendPasswordResetEmail({
    email: email,
  });
}

// Can be done immediately or later - doesn't block migration
for (const user of usersWithoutPasswords) {
  await triggerPasswordReset(user.email);
}
```

## Step 8: Implement Dual-Write (If Required)

**Skip this step if you did a big-bang migration with signups disabled.**

If you chose dual-write strategy, modify your signup flow:

```javascript
async function createUser(email, password) {
  // 1. Create in your existing system
  const localUser = await db.users.create({ email, password });
  
  // 2. IMMEDIATELY create in WorkOS
  try {
    const workosUser = await workos.userManagement.createUser({
      email: email,
      password: password,
      passwordHashType: 'bcrypt', // or your hash algorithm
    });
    
    // 3. Store WorkOS ID with local user
    await db.users.update(localUser.id, { 
      workosUserId: workosUser.id 
    });
  } catch (error) {
    // Handle WorkOS failure - rollback or retry
    console.error('WorkOS creation failed:', error);
  }
  
  return localUser;
}
```

**Also dual-write for:**
- Email updates
- Password changes
- Email verification status

## Step 9: Verify Social Auth Linking

After migration and provider setup, test that social auth users can sign in:

1. Go to your app's login page
2. Click "Sign in with Google" (or other provider)
3. Use credentials for a migrated user
4. Verify successful login

**Expected behavior:** WorkOS automatically links the OAuth identity to the imported user via email address match.

**If email verification is enabled:** Some users may need to verify their email first (depends on provider trust settings).

## Step 10: Switch to WorkOS Authentication

After all users are imported:

1. Update your app's authentication logic to use WorkOS SDK
2. Remove old authentication code
3. If using dual-write, remove the dual-write logic
4. Re-enable signups (if disabled)

See the `workos-authkit-nextjs` skill for full authentication integration steps.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check all users were imported
echo "SELECT COUNT(*) FROM users WHERE workos_user_id IS NULL;" | your-db-cli
# Expected: 0 (all users have WorkOS IDs)

# 2. Verify WorkOS user count matches
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users \
  | jq '.data | length'
# Compare to your user count

# 3. Test authentication flow
curl -X POST https://your-app.com/auth/login \
  -d "email=test@example.com&password=testpass"
# Should succeed for migrated user

# 4. Check social auth providers configured (if applicable)
# Log into WorkOS Dashboard → Authentication → Social Providers
# Verify enabled providers match your exported social auth users
```

## Error Recovery

### "User already exists" during import

**Cause:** User email already in WorkOS (common with dual-write).

**Fix:** Use Update User API instead of Create User:

```javascript
try {
  workosUser = await workos.userManagement.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    // Get existing user and update if needed
    const existing = await workos.userManagement.getUser({ email: user.email });
    workosUser = existing;
  }
}
```

### "Invalid password hash type"

**Cause:** Password hash algorithm not supported or incorrectly specified.

**Fix:** Check supported algorithms in Step 3. Ensure `passwordHashType` matches your actual hash format (e.g., 'bcrypt' not 'bcrypt2').

### Social auth user cannot sign in after migration

**Cause 1:** Provider not configured in WorkOS Dashboard.

**Fix:** Complete Step 5 - add provider credentials.

**Cause 2:** Email mismatch between provider and imported user.

**Fix:** Check that the email from OAuth provider exactly matches the email in your user export. Case-sensitive.

**Cause 3:** Email verification required.

**Fix:** User must verify email first. Check WorkOS Dashboard → Authentication → Settings for verification requirements.

### Rate limit errors during import

**Cause:** Too many requests to WorkOS API.

**Fix:** Reduce `BATCH_SIZE` or increase `DELAY_MS` in Step 6 migration script.

### Dual-write synchronization failures

**Cause:** Network issues or one system down during user creation.

**Fix:** Implement retry logic with exponential backoff:

```javascript
async function createWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Missing WorkOS user IDs after migration

**Cause:** Migration script didn't persist WorkOS user IDs to local database.

**Fix:** Re-run migration with proper ID storage (Step 6). WorkOS Create User API is idempotent for existing emails - it will return the existing user.

## Related Skills

- `workos-authkit-nextjs` - Implementing WorkOS authentication in Next.js apps
- `workos-directory-sync` - Syncing users from external directories (SCIM, Azure AD, etc.)
