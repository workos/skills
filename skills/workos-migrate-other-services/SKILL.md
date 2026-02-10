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

## Step 2: Pre-Migration Assessment (Decision Tree)

Answer these questions to determine your migration path:

```
Can you export password hashes?
  |
  +-- YES --> Which algorithm?
  |            |
  |            +-- bcrypt/scrypt/pbkdf2/argon2/ssha/firebase-scrypt
  |            |    --> Import passwords during user creation (Step 5)
  |            |
  |            +-- Other algorithm
  |                 --> Trigger password reset flow (Step 6)
  |
  +-- NO  --> Options:
               |
               +-- Security policy prevents export
               |    --> Trigger password reset flow (Step 6)
               |
               +-- Users use social auth (Google/Microsoft)
               |    --> Configure OAuth providers (Step 7)
               |
               +-- Remove passwords entirely
                    --> Skip password steps, use Magic Auth
```

**Critical**: WorkOS supports password hash IMPORT even if your source system doesn't export them. The source system limitation (cannot export) is NOT a WorkOS limitation.

## Step 3: User Signup Strategy (MUST CHOOSE ONE)

During migration, new users signing up create a data consistency problem. Choose a strategy:

```
Migration timeline + user tolerance?
  |
  +-- Small app OR short migration window (< 24 hours)
  |    --> Strategy A: Disable signups during migration
  |
  +-- Large app OR critical path OR long migration (days/weeks)
       --> Strategy B: Dual-write strategy
```

### Strategy A: Disable Signups (Simpler)

**Pattern:**
1. Schedule maintenance window
2. Add feature flag to disable signup endpoints
3. Export all users (Step 4)
4. Import into WorkOS (Step 5)
5. Switch auth to WorkOS
6. Remove feature flag

**Pros:** Guarantees consistency, simpler implementation  
**Cons:** User disruption during window

### Strategy B: Dual-Write (Complex)

**Pattern:**
1. Add WorkOS user creation to existing signup flow
2. Store WorkOS user ID alongside local user record
3. Mirror ALL user updates (email, password) to WorkOS
4. Export historical users (Step 4)
5. Import into WorkOS (Step 5) — skip existing users
6. Switch auth to WorkOS
7. Remove dual-write logic

**Pros:** No downtime, gradual migration  
**Cons:** More code complexity, must handle sync failures

**Critical for dual-write:** If user updates email/password after dual-write begins but BEFORE migration completes, you MUST update WorkOS or that user will have stale data.

Document your choice before proceeding:
```bash
echo "STRATEGY_CHOICE=A" >> migration.log  # or B
```

## Step 4: Export User Data

Export from your data store. Required fields per user:

**Minimum required:**
- Email address (primary key for WorkOS matching)
- First name / Last name (optional but recommended)

**Optional but valuable:**
- Email verification status (prevents re-verification)
- Password hash + algorithm (if available)
- OAuth provider linkages (e.g., "signed up via Google")
- WorkOS user ID (if using dual-write strategy)

**Export to JSON format:**
```json
[
  {
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "emailVerified": true,
    "passwordHash": "$2a$10$...",
    "passwordAlgorithm": "bcrypt",
    "oauthProvider": "google"
  }
]
```

**Verify export completeness:**
```bash
# Count exported users
jq 'length' users_export.json

# Check for required fields
jq '.[] | select(.email == null or .email == "")' users_export.json
# Should return empty - if not, fix missing emails
```

## Step 5: Import Users into WorkOS

Use Create User API for each exported user:

**CRITICAL:** Preserve the WorkOS user ID returned in response — you will need it for your user table.

```typescript
// Example import loop (NOT production code - add retries/rate limiting)
for (const user of exportedUsers) {
  const response = await workos.users.createUser({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
    // If you have password hash:
    password: user.passwordHash,
    passwordHashType: user.passwordAlgorithm, // bcrypt/scrypt/pbkdf2/etc
  });
  
  // CRITICAL: Store this mapping
  await saveWorkOSMapping(user.localId, response.id);
}
```

**Dual-write users:** Check if user already exists in WorkOS (they have a WorkOS ID in your DB). If yes, skip creation.

**Error handling during import:**
- `409 Conflict` (user exists) — if dual-write, log and skip; if not, investigate
- `400 Bad Request` (invalid hash format) — check algorithm name matches WorkOS supported list
- `429 Rate Limit` — implement exponential backoff

**Verify import:**
```bash
# Count users in WorkOS (via Admin Portal or API)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length'

# Compare to export count
diff <(jq 'length' users_export.json) <(echo "$WORKOS_COUNT")
```

## Step 6: Password Reset Flow (If No Hashes)

If you cannot export password hashes, trigger password reset for each user:

**Timing decision:**
```
When to trigger resets?
  |
  +-- During import (Step 5)
  |    --> User gets reset email immediately
  |    --> Pros: Done upfront
  |    --> Cons: May confuse users before cutover
  |
  +-- After cutover (post Step 8)
       --> Trigger on first login attempt
       --> Pros: Less confusing, on-demand
       --> Cons: Adds complexity to login flow
```

**Triggering reset:**
```typescript
// Option 1: Batch trigger during import
await workos.users.sendPasswordResetEmail({
  email: user.email,
});

// Option 2: Lazy trigger on first login
// In your login handler:
if (loginFailed && userExistsInWorkOS && !hasWorkOSPassword) {
  await workos.users.sendPasswordResetEmail({ email });
  return "Check your email to set a new password";
}
```

**Critical:** Communicate to users BEFORE cutover that they will need to reset passwords. Sudden reset emails cause support tickets.

## Step 7: Social Auth Configuration (If Applicable)

If your users sign in via Google/Microsoft/GitHub OAuth:

**For each provider:**
1. Go to WorkOS Dashboard → Authentication → Social Connections
2. Configure provider client ID/secret (see integrations docs for provider-specific steps)
3. Set redirect URI to match your WorkOS callback

**Email matching behavior:**
- WorkOS links OAuth sign-ins to existing users by email address
- If email from provider matches imported user email → automatic link
- If email verified by provider (e.g., @gmail.com from Google) → no re-verification
- If email NOT verified by provider → WorkOS may require verification (check Dashboard settings)

**Test OAuth linking:**
```bash
# Before cutover, test with a dummy account:
# 1. Import user with email test@example.com
# 2. Sign in via OAuth with same email
# 3. Verify WorkOS links to existing user (check user ID matches)
```

## Step 8: Switch Authentication to WorkOS

**This is the cutover point.** After this step, all auth flows use WorkOS.

**Code changes required:**

1. **Login endpoint** — replace existing auth with WorkOS sign-in redirect
2. **Signup endpoint** — replace with WorkOS sign-up redirect (or disable if strategy A)
3. **Session management** — replace session tokens with WorkOS session cookies
4. **Logout endpoint** — call WorkOS sign-out

**Verification before cutover:**
```bash
# Ensure all users imported
[ $(jq 'length' users_export.json) -eq $WORKOS_USER_COUNT ] || echo "MISMATCH"

# Ensure OAuth providers configured (if applicable)
grep "oauth_provider_configured=true" migration.log

# Ensure dual-write logic handles sync (if strategy B)
grep "dual_write_tested=true" migration.log
```

**Deploy auth changes:**
- Use feature flag or deploy during low-traffic window
- Monitor login success rate immediately after deploy
- Have rollback plan ready (restore old auth endpoints)

## Step 9: Post-Migration Cleanup

After cutover is stable (24-48 hours):

**If dual-write strategy:**
- Remove dual-write code from signup/update flows
- Remove WorkOS user ID sync logic

**Database cleanup:**
- Archive old password hashes (do NOT delete immediately — keep for rollback)
- Archive old session tokens
- Keep WorkOS user ID mapping permanently

**Monitoring:**
```bash
# Check login success rate
# Expected: >95% success after migration settles

# Check password reset volume
# Expected: Spike if no hashes imported, then decline

# Check support tickets for auth issues
# Expected: Temporary increase, then return to baseline
```

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. User count matches export
EXPORT_COUNT=$(jq 'length' users_export.json)
WORKOS_COUNT=$(curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length')
[ "$EXPORT_COUNT" -eq "$WORKOS_COUNT" ] || echo "FAIL: User count mismatch"

# 2. Test user can log in via WorkOS
# Manual test: Sign in as test user, verify session works

# 3. OAuth linking works (if applicable)
# Manual test: Sign in via Google with existing user email, verify links

# 4. Password reset flow works (if no hashes)
# Manual test: Request password reset, verify email received

# 5. Application builds without old auth code
npm run build | grep -i "auth.*error" && echo "FAIL: Auth code errors"
```

## Error Recovery

### "User already exists" during import (409 Conflict)

**Root cause:** User created by dual-write before batch import

**Fix:**
```typescript
// During import, check for existing user
try {
  await workos.users.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    // Dual-write user - skip creation, fetch existing ID
    const existing = await workos.users.listUsers({ email: user.email });
    await saveWorkOSMapping(user.localId, existing.data[0].id);
  }
}
```

### "Invalid password hash" during import (400 Bad Request)

**Root cause:** Hash algorithm name mismatch

**Fix:** Verify algorithm name matches WorkOS supported list:
- `bcrypt` (NOT `bcrypt2` or `blowfish`)
- `scrypt` (NOT `scrypt-js`)
- `firebase-scrypt` (Firebase-specific variant)
- `pbkdf2` (specify rounds/key length in docs)
- `argon2` (specify variant in docs)
- `ssha` (salted SHA)

Check WebFetched docs for exact parameter format.

### "Email not verified" blocking login

**Root cause:** Email verification enabled in WorkOS, user imported with `emailVerified: false`

**Fix:**
```typescript
// Option 1: Update user after import
await workos.users.updateUser(userId, { emailVerified: true });

// Option 2: Trigger verification email
await workos.users.sendVerificationEmail({ userId });
```

**Prevention:** Set `emailVerified: true` during import if your old system verified emails.

### OAuth sign-in creates duplicate user

**Root cause:** Email address mismatch between OAuth provider and imported user

**Fix:**
- Check: OAuth provider email matches imported user email exactly (case-sensitive)
- Check: User imported BEFORE OAuth sign-in attempt (timing issue)
- If mismatch, manually merge users via WorkOS Admin Portal

### Dual-write sync failures

**Root cause:** Race condition — user updated between dual-write and migration

**Fix:**
```typescript
// Add sync verification step after import
for (const user of dualWriteUsers) {
  const workosUser = await workos.users.getUser(user.workosId);
  if (workosUser.email !== user.email) {
    // Stale data - update WorkOS
    await workos.users.updateUser(user.workosId, { email: user.email });
  }
}
```

### High volume of password reset requests post-migration

**Root cause:** Users don't remember passwords OR hashes weren't imported

**Fix:**
- Check: Password hashes were actually imported (verify API responses logged success)
- Check: Users received pre-migration communication about potential resets
- If expected, monitor volume and ensure email delivery is working

**Support response template:** "We've upgraded our authentication system. Please reset your password using the email link."

## Related Skills

- `workos-authkit-nextjs` — Integrate WorkOS auth in Next.js after migration
- `workos-authkit-react` — Client-side auth UI for React apps
- `workos-api-authkit` — Direct API usage for custom auth flows
- `workos-magic-link` — Alternative to passwords for passwordless auth
