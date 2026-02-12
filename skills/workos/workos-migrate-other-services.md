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

## Step 2: Migration Strategy Decision Tree

```
What is your migration constraint?
  |
  +-- Can disable signups for 1-2 hours
  |     --> Use "big-bang" migration (simpler)
  |     --> Go to Step 3
  |
  +-- Cannot disable signups (critical path app)
        --> Use "dual-write" strategy (complex)
        --> Go to Step 4
```

**Timeline consideration:** Big-bang is viable for <10K users. Dual-write recommended for >10K users or 24/7 availability requirements.

## Step 3: Big-Bang Migration Path

### 3.1: Pre-Migration Setup

Check environment variables in `.env` or `.env.local`:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify API key permissions:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1
```

Expected: 200 response. If 401, key lacks User Management scope.

### 3.2: Export User Data

Export your user table to JSON/CSV with these REQUIRED fields:

- `email` (REQUIRED for all users)
- `first_name` (optional)
- `last_name` (optional)
- `email_verified` (boolean)
- `password_hash` (if migrating passwords)
- `password_hash_type` (one of: bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)

**Critical:** Some systems (e.g., Auth0, Cognito) do NOT export password hashes for security reasons. If your system doesn't export hashes, go to Step 3.4 for password reset approach.

### 3.3: Password Hash Decision Tree

```
Can you export password hashes?
  |
  +-- YES --> Import hashes during user creation (Step 3.3a)
  |
  +-- NO (security policy blocks export)
        --> Use password reset flow (Step 3.4)
```

#### 3.3a: Import with Password Hashes

For each user, call WorkOS Create User API with hash:

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true,
    "password_hash": "$2a$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**Critical:** Supported hash types are bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2. If your hash type is not in this list, you MUST use password reset flow (Step 3.4).

**Store the returned WorkOS user ID** alongside your local user record:

```json
{
  "id": "user_01E4ZCR3C56J083X43JQXF3JK5"
}
```

Most apps add a `workos_user_id` column to their users table.

### 3.4: Password Reset Flow (No Hash Export)

If you cannot export password hashes, trigger password resets programmatically:

```bash
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**When to trigger:**

- Option A: Immediately after creating each user (users receive reset email during migration)
- Option B: On first login attempt post-migration (just-in-time reset)

**Trade-off:** Option A = higher email volume, Option B = smoother UX but requires login flow handling.

### 3.5: Social Auth Users (Google, Microsoft, etc.)

If users previously signed in via OAuth providers:

1. Configure provider in WorkOS Dashboard (see [Integrations](https://workos.com/docs/integrations))
2. Create users WITHOUT passwords:

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true
  }'
```

**Auto-linking:** When user signs in via OAuth post-migration, WorkOS matches by email and links automatically.

**Email verification note:** Users from non-verified providers (custom OAuth) may need to verify email. Gmail/Outlook domains skip verification.

### 3.6: Disable Signups (CRITICAL)

**Before starting import, add feature flag to disable signups:**

```javascript
// Example feature flag check
if (process.env.MIGRATION_IN_PROGRESS === "true") {
  throw new Error("Signups temporarily disabled for maintenance");
}
```

Set `MIGRATION_IN_PROGRESS=true` before Step 3.7.

### 3.7: Batch Import Users

Use SDK or API to create users. Example with Node.js SDK:

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

for (const user of users) {
  try {
    const workosUser = await workos.userManagement.createUser({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      emailVerified: user.email_verified,
      passwordHash: user.password_hash,
      passwordHashType: user.password_hash_type,
    });

    // Store workosUser.id in your database
    await updateLocalUser(user.id, { workos_user_id: workosUser.id });
  } catch (error) {
    console.error(`Failed to import ${user.email}:`, error.message);
    // Log failures for manual review
  }
}
```

**Rate limiting:** WorkOS supports 100 requests/second. For >10K users, add delay or use batch import API if available (check docs).

### 3.8: Switch Auth to WorkOS

After import completes:

1. Update login flow to use WorkOS AuthKit (see related skills below)
2. Remove old authentication code
3. Set `MIGRATION_IN_PROGRESS=false` to re-enable signups

## Step 4: Dual-Write Migration Path

### 4.1: Implement Dual-Write

**Before exporting existing users, update signup flow:**

```javascript
async function createUser(userData) {
  // 1. Create in your database (existing logic)
  const localUser = await db.users.create(userData);

  // 2. Create in WorkOS (NEW)
  const workosUser = await workos.userManagement.createUser({
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    emailVerified: false, // Let WorkOS handle verification
  });

  // 3. Store WorkOS ID
  await db.users.update(localUser.id, {
    workos_user_id: workosUser.id,
  });

  return localUser;
}
```

**Also dual-write for:**

- Email updates: call `workos.userManagement.updateUser()`
- Password changes: call `workos.userManagement.updateUser()` with new hash

### 4.2: Export and Import Historical Users

Follow Steps 3.2-3.5, but:

- **Skip users where `workos_user_id` already exists** (dual-write already handled them)
- Expect "user already exists" errors for some users — this is NORMAL, log and continue

### 4.3: Decommission Dual-Write

After all historical users are imported:

1. Switch auth to WorkOS (Step 3.8)
2. Remove dual-write code (WorkOS is now source of truth)
3. Keep local `workos_user_id` column for reference

## Step 5: Field Mapping Decision Tree

```
What user fields do you have?
  |
  +-- Only email
  |     --> Create with email only (minimal viable migration)
  |
  +-- Email + name
  |     --> Map first_name, last_name if available
  |
  +-- Email + custom metadata (role, preferences, etc.)
        --> Store custom fields in your database
        --> Link via workos_user_id
        --> WorkOS does NOT store arbitrary metadata
```

**Critical:** WorkOS User object has fixed schema. Custom fields (user roles, preferences, app-specific data) stay in YOUR database, linked by `workos_user_id`.

## Step 6: Cutover Strategy Decision Tree

```
How do you want to handle cutover?
  |
  +-- Instant cutover (all users switch at deployment)
  |     --> Deploy new auth code, old system becomes read-only
  |     --> Higher risk, faster completion
  |
  +-- Gradual rollout (percentage-based)
        --> Use feature flag to route X% of users to WorkOS
        --> Increase percentage over days/weeks
        --> Lower risk, longer dual-maintenance period
```

**Gradual rollout requires:**

- Feature flag system (LaunchDarkly, Split, custom)
- Ability to route users between old/new auth based on flag
- Continued maintenance of old auth system during rollout

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check WorkOS API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1

# 2. Verify at least one user imported
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?email=test@example.com

# 3. Check local database has workos_user_id column
# (Replace with your DB query)
psql -c "SELECT workos_user_id FROM users LIMIT 1"

# 4. Verify social provider configured (if using OAuth)
# Check WorkOS Dashboard > Authentication > Social Connections

# 5. Test login with migrated user
# (Manual test in browser/Postman with AuthKit)
```

**All checks must pass before decommissioning old auth system.**

## Error Recovery

### "User already exists" during import

**Cause:** Dual-write already created this user, OR email collision from previous failed import.

**Fix:**

- Check if `workos_user_id` exists in your database for this email
- If yes: skip, already imported
- If no: user exists in WorkOS but not linked — fetch WorkOS user by email and store ID

```bash
# Fetch existing WorkOS user
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?email=user@example.com"
```

### "Invalid password hash type"

**Cause:** Your hash algorithm is not in WorkOS supported list (bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2).

**Fix:** Use password reset flow (Step 3.4). Do NOT attempt to rehash passwords — security risk.

### "Rate limit exceeded" (429 response)

**Cause:** Importing too fast (>100 requests/second).

**Fix:** Add delay between requests:

```javascript
await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay = ~10 req/sec
```

### Social auth user cannot sign in post-migration

**Cause:** Email from OAuth provider doesn't match imported email (case mismatch, typo).

**Fix:**

- WorkOS email matching is case-insensitive
- Check for whitespace in imported emails: `email.trim().toLowerCase()`
- If mismatch persists, manually update WorkOS user email via Update User API

### "Email not verified" blocking login

**Cause:** Created user with `email_verified: false` but WorkOS environment requires verified emails.

**Fix:** Update users to verified:

```bash
curl -X PUT https://api.workos.com/user_management/users/{user_id} \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email_verified": true}'
```

### Dual-write creates duplicate users

**Cause:** Race condition between signup and import process.

**Fix:**

- Add unique constraint on email in import script (skip if exists)
- Implement idempotency: check WorkOS for existing user before creating

## Related Skills

- workos-authkit-nextjs - Integrate WorkOS auth in Next.js apps
- workos-authkit-react - Integrate WorkOS auth in React apps
- workos-authkit-vanilla-js - Integrate WorkOS auth without frameworks
