---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

Map your current auth system to determine migration complexity:

```
Current auth system?
  |
  +-- Password hashes exportable?
  |     |
  |     +-- YES (bcrypt/scrypt/pbkdf2/argon2/firebase-scrypt/ssha)
  |     |     --> Path A: Import passwords directly
  |     |
  |     +-- NO (proprietary format / not exportable)
  |           --> Path B: Trigger password resets
  |
  +-- Social auth only (Google/Microsoft)?
        --> Path C: Email-based auto-linking
  |
  +-- Mixed (passwords + social)?
        --> Combine Path A/B + Path C
```

**Critical questions to answer:**

1. Can you export password hashes? (Not all systems allow this for security reasons)
2. What hash algorithm? (WorkOS supports: bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)
3. Do you have social auth users? Which providers?
4. Can you disable signups during migration?

## Step 3: Environment Setup

### WorkOS Dashboard

1. Log into WorkOS Dashboard
2. Navigate to Authentication settings
3. Note your environment ID and API key location
4. Configure social auth providers if needed (see "Related Skills" for provider-specific guides)

### Local Environment

Set these environment variables:

```bash
WORKOS_API_KEY=sk_...        # From WorkOS Dashboard
WORKOS_CLIENT_ID=client_...  # From WorkOS Dashboard
```

**Verify:**

```bash
# Check env vars are set
printenv | grep WORKOS_ || echo "FAIL: Missing WorkOS credentials"
```

## Step 4: User Data Export

Export your current user database to a structured format. You need:

**Required fields:**

- Email address (primary identifier for WorkOS)
- User ID (your internal ID to maintain mapping)

**Optional but recommended:**

- First name
- Last name
- Email verification status
- Password hash + algorithm parameters (if Path A)
- Social auth provider IDs (if Path C)

**Export format example (JSON):**

```json
[
  {
    "internal_id": "user_123",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true,
    "password_hash": "$2b$10$...",
    "password_algorithm": "bcrypt",
    "google_provider_id": "1234567890"
  }
]
```

**Verify export:**

```bash
# Check JSON is valid
jq empty users_export.json && echo "PASS: Valid JSON" || echo "FAIL: Invalid JSON"

# Check required fields present
jq -e '.[0] | has("email") and has("internal_id")' users_export.json || echo "FAIL: Missing required fields"
```

## Step 5: Migration Timing Strategy (Decision Tree)

```
Can you tolerate signup downtime?
  |
  +-- YES (< 1 hour acceptable)
  |     --> Strategy A: Disable signups during migration
  |     --> Simpler implementation, guaranteed consistency
  |
  +-- NO (zero downtime required)
        --> Strategy B: Dual-write approach
        --> More complex, requires sync logic
```

### Strategy A: Disable Signups (Recommended for most apps)

**Steps:**

1. Schedule migration window (off-peak hours recommended)
2. Deploy feature flag to disable new user signups
3. Export all users from current system
4. Import users to WorkOS (Step 6)
5. Switch authentication to WorkOS (Step 7)
6. Re-enable signups

**Implementation pattern:**

```javascript
// In signup handler
if (process.env.MIGRATION_IN_PROGRESS === "true") {
  return res.status(503).json({
    error: "Signups temporarily disabled for maintenance",
  });
}
```

### Strategy B: Dual-Write (For zero downtime)

**IMPORTANT:** This is more complex and requires careful sync handling.

**Steps:**

1. Deploy dual-write logic to signup flow (see pattern below)
2. Test dual-write with new signups
3. Perform bulk import of historical users (Step 6)
4. Handle duplicates gracefully (WorkOS returns error for existing emails)
5. Switch authentication to WorkOS (Step 7)
6. Remove dual-write logic after confirming all users migrated

**Dual-write pattern:**

```javascript
// In signup handler
async function createUser(email, password, profile) {
  // 1. Create in your existing system
  const localUser = await yourDb.createUser({ email, password, profile });

  try {
    // 2. Create in WorkOS immediately
    const workosUser = await workos.userManagement.createUser({
      email,
      password,
      firstName: profile.firstName,
      lastName: profile.lastName,
      emailVerified: true, // Match your current state
    });

    // 3. Store WorkOS ID in your database
    await yourDb.updateUser(localUser.id, {
      workos_user_id: workosUser.id,
    });
  } catch (error) {
    // Handle WorkOS creation failure
    // Decide: rollback local user or retry later?
    console.error("WorkOS user creation failed:", error);
  }

  return localUser;
}
```

**Critical considerations for dual-write:**

- If a user updates email/password between dual-write start and migration completion, you must sync to WorkOS
- If WorkOS creation fails, decide: rollback local user or queue for retry?
- During bulk import, use `409 Conflict` errors to detect already-migrated users

## Step 6: Import Users to WorkOS

### Path A: Import with Password Hashes

For each user with an exportable password hash:

```bash
# Example using WorkOS API directly
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true,
    "password_hash": "$2b$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**Supported hash types:**

- `bcrypt`
- `scrypt` (requires additional parameters)
- `firebase-scrypt` (requires Firebase-specific parameters)
- `ssha`
- `pbkdf2` (requires iteration count, salt)
- `argon2`

**IMPORTANT:** Check fetched docs for exact parameter names for each hash type. Firebase-scrypt and scrypt require additional config.

**Batch import pattern:**

```javascript
// Import in batches to avoid rate limits
const BATCH_SIZE = 100;
const users = JSON.parse(fs.readFileSync("users_export.json"));

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);

  await Promise.all(
    batch.map(async (user) => {
      try {
        const workosUser = await workos.userManagement.createUser({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: user.email_verified,
          passwordHash: user.password_hash,
          passwordHashType: user.password_algorithm,
        });

        // Store mapping for reference
        await yourDb.updateUser(user.internal_id, {
          workos_user_id: workosUser.id,
        });
      } catch (error) {
        // Log failures for retry
        console.error(`Failed to import ${user.email}:`, error);
        fs.appendFileSync("failed_imports.log", `${user.email}\n`);
      }
    }),
  );

  // Rate limit pause between batches
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
```

### Path B: Import Without Passwords (Trigger Resets)

If you cannot export password hashes:

1. Create users in WorkOS WITHOUT password fields
2. Programmatically trigger password reset for each user

```javascript
// 1. Create user without password
const workosUser = await workos.userManagement.createUser({
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  emailVerified: user.email_verified,
  // No password fields
});

// 2. Trigger password reset email
await workos.userManagement.sendPasswordResetEmail({
  email: user.email,
});
```

**User experience consideration:** Users will receive a "set your new password" email. Communicate this clearly in migration announcement.

### Path C: Social Auth Users

For users who authenticated via Google/Microsoft/etc:

1. Ensure social auth provider is configured in WorkOS Dashboard (see "Related Skills")
2. Create user in WorkOS with email only (no password)
3. User signs in with social provider → WorkOS auto-links by email

```javascript
// Just create the user record - no password needed
const workosUser = await workos.userManagement.createUser({
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  emailVerified: true, // CRITICAL: Set true to avoid extra verification step
});
```

**Email verification behavior:**

- If `emailVerified: true` AND provider is trusted (e.g., gmail.com via Google OAuth), user signs in immediately
- If `emailVerified: false` OR untrusted domain, user must verify email even if they use social auth

**Verify social auth setup:**

```bash
# Check provider is configured in WorkOS Dashboard
# (Manual step - cannot be verified via CLI)
echo "Visit WorkOS Dashboard > Authentication > Social Providers"
echo "Confirm Google/Microsoft/etc. shows 'Configured' status"
```

## Step 7: Switch Authentication to WorkOS

**CRITICAL:** Do not perform this step until user import is verified complete.

### Pre-Cutover Checklist

```bash
# 1. Check all users imported successfully
wc -l users_export.json
wc -l failed_imports.log  # Should be 0 or minimal

# 2. Verify WorkOS API connectivity
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/users?limit=1 \
  | jq '.data | length' || echo "FAIL: Cannot reach WorkOS API"

# 3. Check AuthKit integration exists (see Related Skills)
grep -r "AuthKitProvider" app/ || echo "WARN: AuthKit not integrated yet"
```

### Cutover Steps

1. Deploy authentication code changes (use AuthKit integration - see "Related Skills")
2. Monitor login success/failure rates
3. Keep fallback to old auth system for 24-48 hours if possible
4. After validation period, decommission old auth system

**Example cutover pattern with fallback:**

```javascript
async function authenticateUser(email, password) {
  try {
    // Try WorkOS first
    const session = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID,
    });
    return { success: true, session };
  } catch (error) {
    if (process.env.ENABLE_AUTH_FALLBACK === "true") {
      // Fallback to old system temporarily
      console.warn("WorkOS auth failed, falling back to legacy auth");
      return await legacyAuth(email, password);
    }
    throw error;
  }
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands after import:

```bash
# 1. Check import completion rate
echo "Imported: $(wc -l < users_export.json) users"
echo "Failed: $(wc -l < failed_imports.log) users"

# 2. Test authentication for sample users
# (Manual - login via your app with a test account)

# 3. Verify WorkOS user count matches export
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/users?limit=1" \
  | jq '.list_metadata.total'

# 4. Check social auth provider configuration (if applicable)
# (Manual - verify in WorkOS Dashboard)

# 5. Test password reset flow (if Path B)
# (Manual - request password reset for test user)

# 6. Validate AuthKit integration (if applicable)
npm run build && echo "PASS: Build succeeds" || echo "FAIL: Build fails"
```

**Success criteria:**

- Import failure rate < 1%
- Test user can authenticate successfully
- WorkOS user count matches your export count
- Social auth users can sign in if applicable
- Application builds without errors

## Error Recovery

### "User already exists" (409 Conflict)

**Root cause:** Email already imported (common with dual-write strategy).

**Fix:**

- If using dual-write: This is expected, skip user
- If bulk import only: Check for duplicate emails in export
- Pattern: Catch 409 errors and continue

```javascript
try {
  await workos.userManagement.createUser({ email: user.email, ... });
} catch (error) {
  if (error.status === 409) {
    console.log(`User ${user.email} already exists, skipping`);
  } else {
    throw error;  // Re-throw other errors
  }
}
```

### "Invalid password hash format"

**Root cause:** Hash type mismatch or missing parameters.

**Fix:**

1. Check `password_hash_type` matches actual hash algorithm
2. For scrypt/firebase-scrypt/pbkdf2: Verify all required parameters are provided
3. Check fetched docs for exact parameter names and formats
4. If hash type is unsupported, switch to Path B (password reset)

### Password reset emails not sending

**Root cause:** Email provider not configured in WorkOS Dashboard.

**Fix:**

1. Log into WorkOS Dashboard
2. Navigate to Authentication > Email Settings
3. Configure email provider (or use WorkOS default)
4. Test send from Dashboard

### Social auth users cannot sign in

**Root cause 1:** Provider not configured in WorkOS Dashboard.

**Fix:** See "Related Skills" for provider-specific integration guides.

**Root cause 2:** Email mismatch between provider and WorkOS user.

**Fix:**

- Check provider returns same email as imported user
- Verify `emailVerified: true` was set during import

**Root cause 3:** User's social auth email doesn't match imported email.

**Fix:**

- Export social provider IDs during Step 4
- Use WorkOS API to link social identities explicitly (check fetched docs for identity linking API)

### Import fails with "Invalid API key"

**Root cause:** Wrong key or key lacks permissions.

**Fix:**

```bash
# 1. Verify key starts with correct prefix
echo $WORKOS_API_KEY | grep -E '^sk_' || echo "FAIL: API key format incorrect"

# 2. Test key with simple API call
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/users?limit=1

# 3. Check key permissions in WorkOS Dashboard
# (Manual - ensure key has "User Management" scope)
```

### Dual-write creates orphaned users

**Root cause:** WorkOS user created but mapping not stored (database write failure).

**Fix:**

- Query WorkOS for users without mapping in your database
- Backfill mappings by matching on email

```javascript
// Find orphaned WorkOS users
const workosUsers = await workos.userManagement.listUsers();
for (const workosUser of workosUsers.data) {
  const localUser = await yourDb.findByEmail(workosUser.email);
  if (localUser && !localUser.workos_user_id) {
    // Backfill mapping
    await yourDb.updateUser(localUser.id, {
      workos_user_id: workosUser.id,
    });
  }
}
```

### Users report "email verification required" after social sign-in

**Root cause:** `emailVerified` was not set to `true` during import.

**Fix:**

- Update users in WorkOS to set email verified:

```bash
# Bulk update via API
curl -X PATCH https://api.workos.com/user_management/users/{user_id} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email_verified": true}'
```

## Related Skills

For specific integrations after migration:

- **workos-authkit-nextjs** - Next.js App Router integration
- **workos-authkit-react** - React SPA integration
- **workos-authkit-vanilla-js** - Plain JavaScript integration

For social auth provider setup:

- Check WorkOS Integrations documentation (fetched URL has provider guides)

For other migration sources:

- **workos-migrate-aws-cognito.rules.yml** - AWS Cognito-specific migration
- **workos-migrate-descope.rules.yml** - Descope-specific migration
