---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables or configuration:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Test API key with a simple API call before starting migration.

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package.json contains workos dependency
grep '"@workos-inc/node"' package.json || echo "FAIL: WorkOS SDK not installed"
```

## Step 3: Export User Data

### Identify User Attributes

From your existing user store, extract for each user:

- Email address (REQUIRED)
- Password hash (if using password auth)
- First name, last name (optional)
- Email verification status
- Social auth provider identifiers (Google, Microsoft, etc.)

**CRITICAL:** Email address is the matching key for social auth linking. Users with duplicate emails will cause conflicts.

### Password Hash Compatibility Check

If exporting passwords, verify your hashing algorithm is supported:

```
Your hash algorithm?
  |
  +-- bcrypt --> Compatible, proceed
  |
  +-- scrypt --> Compatible, proceed
  |
  +-- firebase-scrypt --> Compatible, proceed
  |
  +-- ssha --> Compatible, proceed
  |
  +-- pbkdf2 --> Compatible, proceed
  |
  +-- argon2 --> Compatible, proceed
  |
  +-- Other --> STOP. Email support@workos.com for options
```

If unsupported algorithm, see "Triggering Password Resets" decision tree.

## Step 4: User Creation Strategy (Decision Tree)

Choose based on application uptime requirements:

```
Can you disable signups during migration?
  |
  +-- YES --> Use Big-Bang Strategy (simpler)
  |           - Schedule maintenance window
  |           - Disable signups/logins
  |           - Export all users
  |           - Import to WorkOS
  |           - Deploy WorkOS auth
  |           - Re-enable access
  |
  +-- NO  --> Use Dual-Write Strategy (complex)
              - Implement dual-write for new signups
              - Migrate historical users in background
              - Handle sync conflicts during overlap
```

### Big-Bang Strategy Steps

1. Add feature flag to disable signup endpoint
2. Schedule maintenance window announcement
3. Enable flag to block new users
4. Run export script (capture all users)
5. Run import script (create WorkOS users)
6. Deploy WorkOS auth integration
7. Disable flag to restore access

### Dual-Write Strategy Steps

1. Deploy code to create WorkOS user on every new signup:
   ```
   Local DB: Create user → Success?
                            |
                            +-- YES --> WorkOS: Create user
                            |
                            +-- NO --> Rollback, return error
   ```
2. Track dual-write start timestamp
3. Export users created BEFORE timestamp
4. Import to WorkOS (skip existing users)
5. Deploy WorkOS auth integration
6. Remove dual-write code after cutover

**CRITICAL for Dual-Write:** You must also dual-write updates (email changes, password resets) until migration completes.

## Step 5: Import Users to WorkOS

### Create User API Call Pattern

For each exported user, call WorkOS Create User API. WebFetch docs for exact endpoint and parameters.

**Response contains:**
- `id` field with WorkOS user ID (format: `user_*`)

**REQUIRED ACTION:** Persist this WorkOS user ID alongside your local user record. You will need it for auth lookups.

### Password Import (If Applicable)

Decision tree for password handling:

```
Can you export password hashes?
  |
  +-- YES, algorithm supported --> Include hash in Create User call
  |                                 (field name in fetched docs)
  |
  +-- NO, security policy blocks --> Skip password import,
  |                                   trigger resets in Step 6
  |
  +-- NO, technical limitation --> Skip password import,
                                    trigger resets in Step 6
```

### Social Auth Preparation

For users who authenticate with OAuth providers (Google, Microsoft, etc.):

1. WebFetch integration docs for each provider your users use
2. Configure provider credentials in WorkOS Dashboard (see fetched docs)
3. Import users with email addresses - WorkOS will auto-link on first sign-in

**Auto-linking logic:** WorkOS matches by email address. If user signs in with Google and email matches imported user, accounts link automatically.

**Email verification note:** Some users may need to verify email if provider doesn't guarantee verification (e.g., non-Gmail Google accounts).

## Step 6: Handle Missing Passwords (If Needed)

If passwords were NOT imported (Step 5 decision), trigger password resets:

1. WebFetch Password Reset API docs for endpoint details
2. For each user without password, call Password Reset API
3. User receives email with reset link
4. User sets new password on first login

**Alternative:** If moving away from password auth entirely (e.g., to Magic Auth), skip password handling completely.

## Step 7: Deploy WorkOS Auth Integration

**CRITICAL:** This is the cutover point. After deployment, your app uses WorkOS for authentication.

1. Update login endpoint to use WorkOS AuthKit (see related skill: `workos-authkit-base`)
2. Update signup endpoint to create WorkOS users (dual-write can be removed if used)
3. Deploy to production
4. Monitor error logs for auth failures

**Rollback plan:** Keep old auth code behind feature flag for 48 hours in case of critical issues.

## Step 8: Post-Migration Validation

Run these checks immediately after cutover:

```bash
# 1. Verify new logins create WorkOS sessions
curl -X POST https://yourapp.com/api/login \
  -d '{"email":"test@example.com","password":"..."}' \
  | grep -q "workos" || echo "FAIL: Login not using WorkOS"

# 2. Check error rate spike in logs (adjust path)
tail -n 100 /var/log/app.log | grep -c "auth.*error"

# 3. Verify social auth redirect URLs configured
curl -s https://api.workos.com/user_management/provider_configuration \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[].redirect_uri'
```

## Verification Checklist (ALL MUST PASS)

- [ ] All exported users have WorkOS user IDs persisted in local DB
- [ ] Password import completed OR password reset emails sent
- [ ] Social auth providers configured in WorkOS Dashboard
- [ ] Login endpoint successfully authenticates via WorkOS
- [ ] Signup endpoint creates users in WorkOS
- [ ] No spike in authentication error rate post-cutover
- [ ] Test user can login with password (if using password auth)
- [ ] Test user can login with social auth (if configured)

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email or dual-write already created user.

**Fix:** Skip user creation for that email, retrieve existing WorkOS user ID, update local mapping.

### Social auth not auto-linking

**Cause 1:** Email mismatch between imported user and OAuth provider email.

**Fix:** Verify email addresses match exactly (case-sensitive).

**Cause 2:** Email verification required but not completed.

**Fix:** User must verify email before social auth links. Check WorkOS Dashboard for verification settings.

### Password reset emails not sending

**Cause:** Password Reset API call failed or email delivery issue.

**Fix 1:** Check API response for errors (invalid user ID, rate limit).

**Fix 2:** Verify SMTP/email provider configured in WorkOS Dashboard.

### "Invalid grant" or "User not found" after cutover

**Cause:** WorkOS user ID not correctly mapped to local user.

**Fix:** Query WorkOS API by email to retrieve user ID, update local DB mapping.

### Dual-write sync conflicts

**Cause:** User updated email in old system during migration, new email not synced to WorkOS.

**Fix:** Implement webhook or polling to catch updates, or extend dual-write to cover updates until cutover.

## Related Skills

- `workos-authkit-base` - Core AuthKit integration patterns
- `workos-authkit-nextjs` - Next.js-specific AuthKit setup
- `workos-authkit-react` - React-specific AuthKit setup
- `workos-magic-link` - Alternative to password auth
- `workos-sso` - Enterprise SSO for migrated organizations
- `workos-migrate-auth0` - Auth0-specific migration patterns
- `workos-migrate-clerk` - Clerk-specific migration patterns
- `workos-migrate-firebase` - Firebase-specific migration patterns
