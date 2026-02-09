---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- generated -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This document contains the latest migration patterns and API endpoints. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

Map your current auth system to determine migration path:

```
Current auth system?
  |
  +-- Custom password auth with exportable hashes --> Section 3: Full Migration
  |
  +-- Custom password auth (cannot export hashes) --> Section 4: Reset-Based Migration
  |
  +-- Social auth only (Google, Microsoft, etc.) --> Section 5: Social Auth Migration
  |
  +-- Mixed (passwords + social) --> Combine Section 3/4 + Section 5
```

### Signup Timing Strategy

Decide how to handle users who sign up during migration:

```
Can you disable signups temporarily?
  |
  YES --> Use "big-bang" migration (Section 6A)
  |
  NO  --> Use dual-write strategy (Section 6B)
```

## Step 3: Full Migration (With Password Hashes)

### Prerequisites Check

Verify you can export password hashes in one of these formats:
- bcrypt
- scrypt
- firebase-scrypt
- ssha
- pbkdf2
- argon2

**If none supported:** Skip to Section 4 (reset-based migration).

### Export Current Users

Extract from your database:
- Email address (primary key for matching)
- Password hash + algorithm parameters
- Any existing OAuth provider links
- Email verification status

### Create Users in WorkOS

For each user, call Create User API with password hash:

```bash
# Example using curl (replace with SDK call in production)
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$2b$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**CRITICAL:** Store the returned `user_01E4ZCR3C56J083X43JQXF3JK5` ID alongside your local user record. This links your user to WorkOS.

### Verification Command

```bash
# Check user was created (requires WORKOS_API_KEY in env)
curl -s https://api.workos.com/user_management/users/user_01E4ZCR3C56J083X43JQXF3JK5 \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.email'
```

Should return the user's email address.

## Step 4: Reset-Based Migration (Without Password Hashes)

Use this if you cannot export password hashes.

### Create Users Without Passwords

Call Create User API with email only (no password_hash):

```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

Store returned WorkOS user ID.

### Trigger Password Reset Flow

For each user, send password reset email via WorkOS:

```bash
curl https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_reset_url": "https://yourapp.com/reset-password"
  }'
```

**Timing:** This can happen immediately after user creation OR later (e.g., batch email campaign).

### Communication Strategy

Send users an email explaining:
1. Your app is upgrading authentication
2. They need to set a new password via the reset link
3. Their account data is unchanged

## Step 5: Social Auth Migration

### Configure OAuth Providers in WorkOS

For each provider you currently support (Google, Microsoft, GitHub, etc.):

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. Add provider and enter client credentials
3. Test OAuth flow

Check WorkOS docs for provider-specific setup: WebFetch integrations page from docs.

### Email Matching Behavior

**CRITICAL:** WorkOS links OAuth logins to existing users by email address.

```
User signs in with Google OAuth
  |
  +-- Email matches existing WorkOS user --> Auto-link (no new user created)
  |
  +-- Email is new --> Create new user
```

**Email verification note:** If your WorkOS environment requires email verification, some users may need to verify even after OAuth login. This depends on provider trust level:
- `gmail.com` via Google OAuth → No verification needed
- Custom domain via Google OAuth → May need verification
- Check WorkOS Dashboard → Authentication → Settings for current rules

### No Action Required for Users

Unlike password migration, social auth requires NO user action. They simply:
1. Click "Sign in with Google" (or other provider)
2. Authorize WorkOS app
3. Get logged in and linked to existing WorkOS user record

## Step 6A: Big-Bang Migration (Disable Signups)

Best for: Smaller apps, or those that can tolerate brief signup downtime.

### Timeline

```
T-0: Begin migration
  |
  +-- Deploy code to disable signups (feature flag recommended)
  |
  +-- Export all users from current system
  |
  +-- Import users into WorkOS (Section 3 or 4)
  |
  +-- Switch auth flow to WorkOS
  |
  +-- Re-enable signups (now using WorkOS)
```

### Disable Signups Pattern

```javascript
// Example feature flag check
if (process.env.MIGRATION_IN_PROGRESS === 'true') {
  return res.status(503).json({
    error: 'Signups temporarily disabled during system upgrade'
  });
}
```

**Verify:** Attempt signup during migration — should fail with 503.

## Step 6B: Dual-Write Strategy (Keep Signups Active)

Best for: Larger apps, or those on critical path for customers.

### Implementation Flow

```
New user signs up
  |
  +-- Create user in CURRENT system (existing logic)
  |
  +-- ALSO create user in WorkOS (dual-write)
      |
      +-- Store WorkOS user ID alongside local user
```

### Example Code Pattern

```javascript
async function createUser(email, password) {
  // 1. Create in existing system
  const localUser = await db.users.create({ email, password });
  
  // 2. ALSO create in WorkOS
  const workosUser = await workos.userManagement.createUser({
    email,
    password,
  });
  
  // 3. Link them
  await db.users.update(localUser.id, {
    workos_user_id: workosUser.id
  });
  
  return localUser;
}
```

### Migration Process With Dual-Write

1. Deploy dual-write code (new signups go to both systems)
2. Wait for code to be live in production
3. Export historical users (those created before dual-write)
4. Import historical users to WorkOS
   - **Handle collisions:** Some users may already exist from dual-write
   - Use "list users" API to check before creating
5. Switch auth flow to WorkOS-only
6. Remove dual-write code

**Collision handling:**

```bash
# Check if user exists before creating
curl -s "https://api.workos.com/user_management/users?email=user@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# If returns 0 --> Create user
# If returns 1 --> User already exists from dual-write, skip
```

### Complexity Tradeoff

Dual-write adds complexity:
- Email changes must update both systems
- Password changes must update both systems
- Auth method changes must update both systems

This complexity ONLY lasts until migration is complete. After switching to WorkOS-only auth, remove dual-write logic.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. Verify WorkOS API key is set and valid
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS" || echo "FAIL: Invalid API key format"

# 2. Check sample user was migrated (replace user_id)
curl -s https://api.workos.com/user_management/users/user_01EXAMPLE \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -e '.id' && echo "PASS" || echo "FAIL"

# 3. Verify user count matches (replace N with expected count)
WORKOS_COUNT=$(curl -s https://api.workos.com/user_management/users?limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total')
echo "WorkOS has $WORKOS_COUNT users (expect N)"

# 4. Test password authentication (if using password migration)
# Attempt login via WorkOS with known user credentials - should succeed

# 5. Test social auth linking (if using OAuth providers)
# Sign in with Google/Microsoft - should link to existing user by email

# 6. Check your app no longer queries old auth system
grep -r "old_user_table" app/ && echo "FAIL: Still referencing old system" || echo "PASS"
```

## Error Recovery

### "User already exists" (409 Conflict)

**Cause:** Attempting to create user with email that's already in WorkOS.

**Fix:** 
- Query existing user: `GET /user_management/users?email=user@example.com`
- Store returned user ID if this is expected (dual-write collision)
- OR investigate duplicate migration if unexpected

### "Invalid password_hash_type"

**Cause:** Unsupported hash algorithm.

**Fix:**
- Check supported algorithms: bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2
- If your algorithm isn't supported, use reset-based migration (Section 4)

### "Email verification required" after OAuth login

**Cause:** OAuth provider domain not in WorkOS trusted list.

**Expected behavior:** User receives verification email after OAuth login.

**Fix:** 
- Check WorkOS Dashboard → Authentication → Email Verification settings
- Either: Add domain to trusted list OR let users complete verification flow

### Password reset email not sent

**Cause 1:** Invalid password_reset_url parameter.

**Fix:** Ensure URL is HTTPS and points to valid route in your app.

**Cause 2:** User doesn't exist in WorkOS yet.

**Fix:** Verify user was created first (check user_management/users API).

### Social auth not linking to existing user

**Cause:** Email mismatch between OAuth provider and WorkOS user record.

**Fix:**
- Check exact email stored in WorkOS: `GET /user_management/users/{user_id}`
- OAuth provider emails are case-sensitive - ensure exact match
- Check for typos in original user import

### Dual-write creating duplicate users

**Cause:** Race condition between signup and migration import.

**Fix:**
- Before creating user in WorkOS, query: `GET /user_management/users?email=...`
- If user exists, just store the existing WorkOS user ID
- Use database transactions to ensure atomic create-or-link operation

## Related Skills

- `workos-authkit-nextjs` - Implementing WorkOS auth in Next.js after migration
- `workos-user-management` - Managing users post-migration
- `workos-magic-auth` - Adding passwordless auth as alternative to passwords
