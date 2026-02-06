---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- generated -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

- Confirm WorkOS account exists with access to dashboard
- Verify environment variables:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`
- Confirm WorkOS SDK installed in project

**Verify SDK:**
```bash
npm list @workos-inc/node || yarn list @workos-inc/node || pnpm list @workos-inc/node
```

### Existing User Store

Determine your current authentication system:
- Custom database (PostgreSQL, MySQL, MongoDB, etc.)
- Auth0, Firebase Auth, Supabase Auth, Clerk, or other provider
- Self-hosted solution (Keycloak, Ory, etc.)

**Critical:** You need read access to:
1. User IDs and email addresses
2. Password hashes (if using password auth)
3. Social auth provider links (if using OAuth)

## Step 3: Migration Strategy Decision Tree (REQUIRED)

```
Can you disable signups during migration?
  |
  +-- YES --> Simple Migration Path (go to Step 4A)
  |           - Schedule maintenance window
  |           - Export all users at once
  |           - Import to WorkOS
  |           - Switch to WorkOS auth
  |
  +-- NO  --> Dual-Write Strategy (go to Step 4B)
              - Implement dual-write for new signups
              - Migrate historical users in background
              - Handle deduplication
```

**Choose based on:**
- User base size (< 10k users = simple path usually feasible)
- Downtime tolerance (can you disable signups for 1-4 hours?)
- Engineering resources (dual-write requires more code)

## Step 4A: Simple Migration Path

### Phase 1: Export Users

Write a script to extract from your user store:

```javascript
// Required fields per user:
{
  email: string,           // REQUIRED
  email_verified: boolean, // REQUIRED - affects first login flow
  first_name?: string,
  last_name?: string,
  password_hash?: string,  // Only if migrating passwords
  password_algorithm?: 'bcrypt' | 'scrypt' | 'firebase-scrypt' | 'ssha' | 'pbkdf2' | 'argon2'
}
```

**Output format:** JSONL (one user per line) for streaming import.

**Verify export:**
```bash
# Check user count matches your database
wc -l users_export.jsonl
# Spot check first 5 users have required fields
head -5 users_export.jsonl | jq '.email, .email_verified'
```

### Phase 2: Import to WorkOS

Use the [Create User API](https://workos.com/docs/reference/authkit/user/create) for each user:

```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(userData) {
  const user = await workos.userManagement.createUser({
    email: userData.email,
    emailVerified: userData.email_verified,
    firstName: userData.first_name,
    lastName: userData.last_name,
    ...(userData.password_hash && {
      passwordHash: userData.password_hash,
      passwordHashType: userData.password_algorithm
    })
  });
  
  // CRITICAL: Save WorkOS user ID to your database
  await saveWorkOSUserId(userData.id, user.id);
  
  return user.id;
}
```

**Rate limiting:** WorkOS API has rate limits. Batch imports in chunks:
- Start with 10 requests/second
- Monitor for 429 responses
- Add exponential backoff if needed

**Progress tracking:**
```bash
# Log each successful import
echo "user_local_123,user_01ABC123" >> migration_mapping.csv
```

### Phase 3: Switch Authentication

1. Update login endpoints to use WorkOS AuthKit
2. Map existing user IDs to WorkOS user IDs using saved mappings
3. Disable old auth system

## Step 4B: Dual-Write Strategy

### Phase 1: Implement Dual-Write for New Users

Modify signup endpoint to create users in BOTH systems:

```javascript
async function createNewUser(signupData) {
  // 1. Create in existing system (unchanged)
  const localUser = await yourUserDB.create(signupData);
  
  // 2. Also create in WorkOS
  try {
    const workosUser = await workos.userManagement.createUser({
      email: signupData.email,
      emailVerified: false, // They'll verify via WorkOS flow
      firstName: signupData.firstName,
      lastName: signupData.lastName
    });
    
    // 3. Link the two IDs
    await yourUserDB.update(localUser.id, {
      workos_user_id: workosUser.id
    });
  } catch (error) {
    // Log but don't fail signup - you'll backfill later
    console.error('WorkOS dual-write failed:', error);
  }
  
  return localUser;
}
```

**Deploy this change BEFORE starting historical migration.**

### Phase 2: Backfill Historical Users

Same as Step 4A Phase 1-2, but add deduplication:

```javascript
async function importUserWithDedup(userData) {
  // Check if user already exists from dual-write
  const existing = await workos.userManagement.listUsers({
    email: userData.email
  });
  
  if (existing.data.length > 0) {
    console.log(`User ${userData.email} already exists, skipping`);
    await saveWorkOSUserId(userData.id, existing.data[0].id);
    return existing.data[0].id;
  }
  
  // Otherwise create
  return await importUser(userData);
}
```

### Phase 3: Handle Updates During Migration

If users can update email/password during migration, dual-write those too:

```javascript
async function updateUserEmail(userId, newEmail) {
  // 1. Update in existing system
  await yourUserDB.updateEmail(userId, newEmail);
  
  // 2. Also update in WorkOS if linked
  const workosId = await getWorkOSUserId(userId);
  if (workosId) {
    await workos.userManagement.updateUser({
      userId: workosId,
      email: newEmail
    });
  }
}
```

## Step 5: Password Migration Decision

```
Do you have access to password hashes?
  |
  +-- YES --> Import password hashes (go to 5A)
  |
  +-- NO  --> Trigger password resets (go to 5B)
  |
  +-- N/A --> Removing password auth entirely (skip to Step 6)
```

### Step 5A: Import Password Hashes

**Supported algorithms:** bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2

Include in Create User API call:
```javascript
{
  passwordHash: "hashedPasswordString",
  passwordHashType: "bcrypt" // or other supported algorithm
}
```

**Verify algorithm compatibility:**
```bash
# Check your current hashing algorithm
grep -r "bcrypt\|scrypt\|argon2" your-auth-code/
```

If unsupported algorithm: Use Step 5B instead.

### Step 5B: Trigger Password Resets

Use [Password Reset API](https://workos.com/docs/reference/authkit/password-reset) to email users:

```javascript
async function triggerPasswordReset(email) {
  await workos.userManagement.sendPasswordResetEmail({
    email: email,
    passwordResetUrl: 'https://yourapp.com/reset-password'
  });
}
```

**Timing options:**
1. **Immediate:** Send resets during import (users get email right away)
2. **On first login:** Send reset when user tries old password
3. **Bulk later:** Send resets in batches after migration complete

## Step 6: Social Auth Provider Migration

If users sign in with Google, Microsoft, GitHub, etc.:

### Configure Providers in WorkOS

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. Add each provider you currently support
3. Get OAuth credentials from provider (Google Cloud Console, etc.)
4. Configure redirect URIs

**Verify provider setup:**
```bash
# Test OAuth flow manually before migration
# Visit: https://your-workos-env.authkit.com/sign-in
# Click each social provider button
```

### Email Matching Behavior

WorkOS automatically links social auth users by email address:

- User signs in with Google → WorkOS checks email → Matches existing user
- **Email must match exactly** (case-insensitive)
- Verified email domains (gmail.com, etc.) skip extra verification

**Critical:** If your existing system allows multiple auth methods per email (e.g., user has both password and Google), verify the WorkOS user record has all methods after first social login.

## Step 7: Handle Email Verification

WorkOS may require email verification on first login if:
- User's email was not verified in old system (`email_verified: false`)
- Social provider doesn't auto-verify (non-gmail.com Google accounts, etc.)

**Configure verification behavior:**
1. WorkOS Dashboard → Authentication → Settings
2. Set "Email Verification" policy:
   - Required: All users must verify
   - Optional: Only unverified emails
   - Disabled: Skip verification (not recommended)

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. Count users in WorkOS matches export
# Expected: Same count as users_export.jsonl
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length'

# 2. Spot check user mapping exists
grep "user_01ABC123" migration_mapping.csv || echo "FAIL: Mapping missing"

# 3. Test login with migrated user
# Manual: Try logging in at https://your-app.com/login
# Expected: User can authenticate via WorkOS

# 4. Check social auth providers configured
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/authentication_providers" | jq '.data[].name'

# 5. Verify no users left behind
# Compare user counts: old DB vs WorkOS vs mapping file
wc -l migration_mapping.csv
```

**If any check fails:** Do not proceed to production cutover.

## Production Cutover Steps

1. **Announce maintenance window** (if using simple migration path)
2. **Disable old authentication endpoints** (return 503 or maintenance page)
3. **Deploy WorkOS AuthKit integration** (see related skill: workos-authkit-nextjs)
4. **Update environment variables** in production
5. **Enable new authentication endpoints**
6. **Monitor error logs** for auth failures

**Rollback plan:** Keep old auth system deployable for 24-48 hours in case of issues.

## Error Recovery

### "User already exists with email"

**Cause:** Duplicate import or email conflict.

**Fix:**
```javascript
// Use listUsers to find existing user, then update instead
const existing = await workos.userManagement.listUsers({ email });
if (existing.data.length > 0) {
  await workos.userManagement.updateUser({
    userId: existing.data[0].id,
    ...updateData
  });
}
```

### "Invalid password hash format"

**Cause:** Password hash doesn't match expected format for algorithm.

**Fix:**
- Verify hash extraction from database is correct (no truncation)
- Check algorithm type matches actual hashing method
- If unsure, fall back to password reset flow (Step 5B)

### "Rate limit exceeded" (429 response)

**Cause:** Importing too fast.

**Fix:**
```javascript
// Add exponential backoff
async function importWithBackoff(user, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await importUser(user);
    } catch (err) {
      if (err.status === 429 && i < retries - 1) {
        await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
        continue;
      }
      throw err;
    }
  }
}
```

### "Email verification required" blocks users

**Cause:** Users imported with `email_verified: false` must verify before access.

**Fix:**
- Re-import with `email_verified: true` if you trust your old system's verification
- OR communicate to users they'll receive verification email on first login
- OR disable email verification in WorkOS Dashboard (not recommended for production)

### Social auth user creates duplicate account

**Cause:** Email mismatch between old system and OAuth provider.

**Fix:**
- Check for email aliases (user+tag@gmail.com vs user@gmail.com)
- WorkOS uses exact email match - normalize emails before import
- Manually merge accounts via WorkOS API if needed

## Related Skills

- **workos-authkit-nextjs** - Integrate WorkOS AuthKit with Next.js after migration
- **workos-directory-sync** - Set up SSO/SCIM for enterprise customers post-migration
