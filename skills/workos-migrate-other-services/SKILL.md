---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Planning (Decision Tree)

Answer this question before writing code:

```
Can you disable user signups during migration?
  |
  +-- YES --> Use "Big Bang" strategy (Section 3A)
  |           - Simpler implementation
  |           - Requires maintenance window
  |           - All users migrated at once
  |
  +-- NO  --> Use "Dual Write" strategy (Section 3B)
              - More complex implementation
              - No maintenance window required
              - Must handle duplicate users
```

**Record your choice** — it affects all subsequent steps.

## Step 3: Environment Validation

Check `.env.local` or `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Confirm WorkOS SDK is installed before proceeding.

```bash
# Check SDK exists
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 4: Export Existing Users

**This is your application-specific code.** The skill cannot automate this step.

Create a script that exports your users to a structured format (JSON/CSV). Required fields per user:

- Email (required)
- First name (optional)
- Last name (optional)
- Password hash (if applicable)
- Social auth provider info (if applicable)

**Output format example:**

```json
{
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "passwordHash": "$2b$10$...",
  "passwordHashType": "bcrypt",
  "emailVerified": true
}
```

## Step 5: Create Users in WorkOS

For each user in your export, call the WorkOS Create User API.

**Critical:** Store the returned WorkOS `user_id` alongside your local user record. You will need this mapping for authentication.

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function migrateUser(userData) {
  const workosUser = await workos.users.createUser({
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    emailVerified: userData.emailVerified,
    // Include password hash if available (see Step 6)
  });

  // CRITICAL: Store workosUser.id with your local user record
  return workosUser.id;
}
```

**API Reference:** `https://workos.com/docs/reference/authkit/user/create`

## Step 6: Password Migration (Decision Tree)

```
Can you export password hashes from existing system?
  |
  +-- YES --> Include in createUser() call
  |           Supported algorithms:
  |           - bcrypt
  |           - scrypt
  |           - firebase-scrypt
  |           - ssha
  |           - pbkdf2
  |           - argon2
  |
  +-- NO  --> Trigger password reset after migration (Step 6A)
```

### Step 6A: Trigger Password Resets (If No Hash Export)

Use WorkOS Password Reset API to send reset emails:

```typescript
await workos.users.sendPasswordResetEmail({
  email: userData.email,
});
```

**API Reference:** `https://workos.com/docs/reference/authkit/password-reset`

**Note:** If you're removing password auth entirely in favor of Magic Auth, skip password handling.

## Step 7: Social Auth Provider Configuration

If your users authenticate via Google, Microsoft, or other OAuth providers:

1. **Configure provider in WorkOS Dashboard** (cannot be automated)
   - Go to WorkOS Dashboard → Authentication → Social Connections
   - Add client credentials for each provider

2. **User linking happens automatically**
   - WorkOS matches users by email address
   - Users sign in with provider → WorkOS links to existing user
   - Email verification may be required (depends on provider trust level)

**Verify:** Test social auth flow with a migrated user before bulk migration.

## Step 8: Handling Interim Users (Implementation)

### Strategy A: Big Bang (Disable Signups)

Add feature flag to disable signups during migration:

```typescript
// In signup route
if (process.env.MIGRATION_IN_PROGRESS === 'true') {
  return res.status(503).json({
    error: 'Signups temporarily disabled during system upgrade',
  });
}
```

**Timeline:**

1. Enable flag → Disable signups
2. Run export script (Step 4)
3. Run import script (Step 5)
4. Switch auth to WorkOS
5. Disable flag → Re-enable signups

### Strategy B: Dual Write (No Downtime)

Create a user creation wrapper that writes to both systems:

```typescript
async function createUser(userData) {
  // 1. Create in existing system
  const localUser = await db.users.create(userData);

  // 2. Create in WorkOS
  const workosUser = await workos.users.createUser({
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
  });

  // 3. Store WorkOS ID
  await db.users.update(localUser.id, {
    workosUserId: workosUser.id,
  });

  return localUser;
}
```

**When running bulk migration:**

- Check if user already exists in WorkOS before creating
- Handle duplicate creation gracefully

```typescript
try {
  const workosUser = await workos.users.createUser(userData);
} catch (error) {
  if (error.code === 'user_already_exists') {
    // User was created via dual-write, skip
    console.log(`User ${userData.email} already exists, skipping`);
  } else {
    throw error;
  }
}
```

## Step 9: Update Email Changes (Dual Write Only)

If using dual write, sync email updates to WorkOS:

```typescript
async function updateUserEmail(userId, newEmail) {
  // 1. Update local system
  await db.users.update(userId, { email: newEmail });

  // 2. Update WorkOS (only if user has workosUserId)
  const user = await db.users.findById(userId);
  if (user.workosUserId) {
    await workos.users.updateUser(user.workosUserId, {
      email: newEmail,
    });
  }
}
```

**API Reference:** `https://workos.com/docs/reference/authkit/user/update`

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify WorkOS user count matches export
# (Manual check via WorkOS Dashboard → Users)

# 2. Test authentication with migrated user
# (Manual test: Sign in with email/password or social auth)

# 3. Verify WorkOS ID mapping exists
psql -d yourdb -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NOT NULL;"
# Should match total migrated users

# 4. Test password reset flow (if using password auth)
# (Manual test: Trigger reset, check email delivery)

# 5. Test social auth linking (if applicable)
# (Manual test: Sign in with Google/Microsoft, verify correct user)
```

## Error Recovery

### "user_already_exists" during createUser

**Root cause:** Duplicate email in WorkOS (common with dual write).

**Fix:**

```typescript
// Fetch existing user instead of creating
const existingUsers = await workos.users.listUsers({
  email: userData.email,
});

if (existingUsers.data.length > 0) {
  return existingUsers.data[0].id;
}
```

### "Invalid password hash format"

**Root cause:** Password hash algorithm not supported or malformed.

**Fix:**

1. Verify algorithm is in supported list: bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2
2. Check hash format matches algorithm spec (e.g., bcrypt starts with `$2a$`, `$2b$`, or `$2y$`)
3. If unsupported algorithm, use password reset flow (Step 6A)

### "Email verification required" blocks social auth users

**Root cause:** Provider doesn't verify emails, or domain not trusted by WorkOS.

**Fix:**

- Check WorkOS Dashboard → Authentication → Email Verification settings
- Disable email verification temporarily during migration, or
- Manually verify emails via Update User API:

```typescript
await workos.users.updateUser(userId, {
  emailVerified: true,
});
```

### Rate limiting during bulk import

**Root cause:** Creating users too quickly.

**Fix:**

```typescript
// Add delay between user creations
async function migrateUsers(users) {
  for (const user of users) {
    await migrateUser(user);
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
  }
}
```

### Missing WorkOS ID mapping after migration

**Root cause:** Migration script didn't store returned `user_id`.

**Fix:**

1. Re-run migration script with ID storage (Step 5)
2. Or fetch users by email and backfill IDs:

```typescript
const workosUsers = await workos.users.listUsers({ email: localUser.email });
if (workosUsers.data.length > 0) {
  await db.users.update(localUser.id, {
    workosUserId: workosUsers.data[0].id,
  });
}
```

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS authentication in Next.js after migration
- `workos-user-management` - Manage users via WorkOS APIs post-migration
