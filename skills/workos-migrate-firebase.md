---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys exist before continuing.

### Firebase Export Access

Confirm you have:

- Firebase Console access for password hash parameters
- Firebase CLI installed (`firebase --version`)
- Admin permissions to export user data

## Step 3: Identify Migration Scope (Decision Tree)

Determine which Firebase Auth methods are in use:

```
Firebase Auth Methods?
  |
  +-- Password Auth --> Go to Step 4 (Password Hash Import)
  |
  +-- Social Providers (Google, Microsoft, etc.) --> Go to Step 5 (Social Auth)
  |
  +-- Email Link (Passwordless) --> Go to Step 6 (Magic Auth)
  |
  +-- OIDC/SAML --> Go to Step 7 (Enterprise SSO)
```

**Multiple methods:** Complete all applicable steps sequentially.

## Step 4: Password Hash Import

### 4.1: Export Firebase Hash Parameters

Firebase uses a forked version of `scrypt`. You need project-wide parameters first.

1. Open Firebase Console → Authentication → Users
2. Click three-dot menu → "Export users (with passwords)"
3. Firebase will show password hash parameters:
   - `base64_signer_key`
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

**Save these** — you'll need them for every user import.

### 4.2: Export User Data

Run Firebase CLI command:

```bash
firebase auth:export users.json --format=JSON --project YOUR_PROJECT_ID
```

**Check output:** Users with passwords will have `passwordHash` and `salt` fields.

### 4.3: Format PHC Hashes

WorkOS accepts PHC-format hashes. Map Firebase parameters:

| Firebase field          | PHC parameter |
| ----------------------- | ------------- |
| `base64_signer_key`     | `sk`          |
| `base64_salt_separator` | `ss`          |
| `rounds`                | `r`           |
| `mem_cost`              | `m`           |

**PHC format structure:**

```
$firebase-scrypt$r={rounds},m={mem_cost},sk={base64_signer_key},ss={base64_salt_separator}${salt}${passwordHash}
```

Example PHC hash:

```
$firebase-scrypt$r=8,m=14,sk=jxspr8Ki0RYycVU8zykbdLGjFQ3M,ss=Bw==$lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC6dzw==$NjFBPD...
```

### 4.4: Import Users with Hashes

Use WorkOS User Management API. For each Firebase user:

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$firebase-scrypt$r=8,m=14,sk=...$...$...",
    "email_verified": true
  }'
```

**Critical:** Set `email_verified: true` for migrated users to avoid re-verification.

**Alternative:** Use [Update User API](https://workos.com/docs/reference/user-management/user/update) to add hashes to existing WorkOS users.

## Step 5: Social Auth Provider Migration

### 5.1: List Active Providers

Check Firebase Console → Authentication → Sign-in method for enabled providers (Google, Microsoft, GitHub, etc.).

### 5.2: Extract OAuth Credentials

For each enabled provider:

1. Find provider settings in Firebase Console
2. Copy Client ID and Client Secret
3. Note redirect URIs currently configured

**Critical:** You need the SAME credentials Firebase uses. Do not create new OAuth apps — this will break existing user sessions.

### 5.3: Configure in WorkOS

Navigate to WorkOS Dashboard → Configuration → Authentication Methods.

**For each provider:**

1. Enable the provider
2. Paste Client ID and Client Secret from Firebase
3. Add redirect URI: `https://api.workos.com/sso/oauth/callback`

**Supported providers (check fetched docs for latest):**

- Google: [Integration guide](https://workos.com/docs/integrations/google-oauth)
- Microsoft: [Integration guide](https://workos.com/docs/integrations/microsoft-oauth)

**Unsupported provider?** Contact support@workos.com before proceeding.

### 5.4: Update OAuth Redirect URIs

In each provider's OAuth app settings (Google Cloud Console, Azure Portal, etc.):

1. Add WorkOS callback: `https://api.workos.com/sso/oauth/callback`
2. Keep existing Firebase redirect URIs during migration
3. Remove Firebase URIs only after migration is complete

## Step 6: Email Link (Passwordless) Migration

Firebase Email Link → WorkOS Magic Auth

### 6.1: Enable Magic Auth

WorkOS Dashboard → Configuration → Authentication Methods → Enable "Magic Auth"

### 6.2: Update Application Code

Replace Firebase `sendSignInLinkToEmail` with WorkOS Magic Auth:

**Before (Firebase):**

```javascript
firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
```

**After (WorkOS - check fetched docs for exact API):**

```javascript
// Magic Auth initiation - see WorkOS Magic Auth reference docs
```

WebFetch: `https://workos.com/docs/reference/magic-auth` for exact implementation.

### 6.3: Email Template Migration

1. Export Firebase email templates
2. Recreate templates in WorkOS Dashboard → Configuration → Email Templates
3. Match branding and copy for user familiarity

## Step 7: OIDC/SAML Enterprise SSO Migration

### 7.1: List Enterprise Connections

From Firebase Console → Authentication → Sign-in method, export:

- OIDC provider configurations (issuer URL, client ID/secret)
- SAML provider configurations (metadata URL or XML)
- Associated email domains

### 7.2: Recreate Connections in WorkOS

**For OIDC:**

1. WorkOS Dashboard → Connections → Add Connection → OIDC
2. Enter issuer URL, client ID, client secret from Firebase config
3. Assign to organization

**For SAML:**

1. WorkOS Dashboard → Connections → Add Connection → SAML
2. Upload metadata XML or enter metadata URL
3. Assign to organization

**Detailed guides:**

- OIDC setup: `https://workos.com/docs/integrations/oidc`
- SAML setup: `https://workos.com/docs/integrations/saml`

### 7.3: Test Enterprise Logins

Before cutover:

1. Create test user in enterprise IdP
2. Initiate SSO flow through WorkOS
3. Verify attributes map correctly (email, name, groups)

## Step 8: Cutover Strategy

### 8.1: Parallel Run (Recommended)

Run Firebase and WorkOS auth simultaneously:

```
User login attempt
  |
  +-- Try WorkOS auth first
  |     |
  |     +-- Success --> Continue with WorkOS
  |     |
  |     +-- User not found --> Fall back to Firebase
  |           |
  |           +-- Success --> Migrate user to WorkOS
  |           |
  |           +-- Fail --> Show error
```

This allows incremental migration without forcing all users to reset passwords.

### 8.2: Monitor Migration Progress

Track daily:

```bash
# Count Firebase logins (check your app logs)
grep "firebase.auth().signIn" app.log | wc -l

# Count WorkOS logins (check WorkOS Dashboard or API)
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/users | jq '.data | length'
```

**Target:** 90%+ of active users migrated before full cutover.

### 8.3: Final Cutover

When migration threshold is met:

1. Disable Firebase Authentication in console
2. Remove Firebase SDK from application
3. Update all auth calls to WorkOS only
4. Monitor error rates for 48 hours

## Verification Checklist (ALL MUST PASS)

Run these checks after each migration step:

```bash
# 1. Environment variables set
[ -n "$WORKOS_API_KEY" ] && echo "API key: OK" || echo "FAIL: Missing WORKOS_API_KEY"
[ -n "$WORKOS_CLIENT_ID" ] && echo "Client ID: OK" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 2. Test user creation with password hash (replace with real hash)
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password_hash":"$firebase-scrypt$..."}' \
  && echo "Hash import: OK" || echo "FAIL: Hash import rejected"

# 3. Social provider configured (check Dashboard manually)
echo "Verify Google/Microsoft enabled in WorkOS Dashboard"

# 4. Magic Auth enabled (check Dashboard manually)
echo "Verify Magic Auth enabled in WorkOS Dashboard"

# 5. Application builds
npm run build && echo "Build: OK" || echo "FAIL: Build errors"
```

**All checks must pass** before proceeding to production cutover.

## Error Recovery

### "Invalid password hash format"

**Cause:** PHC hash string malformed or missing required parameters.

**Fix:**

1. Verify all four parameters present: `r`, `m`, `sk`, `ss`
2. Check base64 encoding has no line breaks or spaces
3. Ensure delimiter is `$` not `:` or other character
4. Test with a single user before bulk import

**Example debug:**

```bash
echo "$firebase-scrypt$r=8,m=14,sk=abc,ss=def$salt$hash" | grep -E '^\$firebase-scrypt\$r=[0-9]+,m=[0-9]+,sk=.+,ss=.+\$.+\$.+$'
```

### "Firebase hash parameters not found"

**Cause:** Firebase Console doesn't show password hash params for projects without password auth enabled.

**Fix:**

1. Verify password authentication is enabled: Firebase Console → Authentication → Sign-in method → Email/Password
2. If no password users exist, skip Step 4 entirely
3. Check Firebase plan limits — some legacy plans restrict exports

### Social auth "Invalid client credentials"

**Cause:** OAuth credentials copied incorrectly, or Firebase and WorkOS are using different OAuth apps.

**Fix:**

1. Copy credentials directly from Firebase Console (not from provider console)
2. Ensure you copied Client Secret, not Client ID twice
3. Verify OAuth app has both Firebase AND WorkOS redirect URIs registered
4. Test credentials with provider's OAuth playground before WorkOS import

### "User already exists" during migration

**Cause:** User exists in WorkOS but without password hash.

**Fix:** Use Update User API instead of Create User:

```bash
curl -X PATCH https://api.workos.com/user_management/users/{user_id} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{"password_hash":"$firebase-scrypt$..."}'
```

### Magic Auth emails not sending

**Cause:** Email domain not verified in WorkOS.

**Fix:**

1. WorkOS Dashboard → Configuration → Email Settings
2. Verify sending domain with DNS records
3. Check spam folder for test emails
4. Review WorkOS email logs for delivery errors

### Enterprise SSO "Invalid SAML response"

**Cause:** SAML attribute mapping mismatch between Firebase and WorkOS.

**Fix:**

1. Export SAML metadata from identity provider
2. Compare attribute names in Firebase vs WorkOS configuration
3. Adjust attribute mappings in WorkOS Dashboard → Connection settings
4. Common attributes: `email`, `firstName`, `lastName` (check fetched SAML docs for exact names)

### Build fails after Firebase SDK removal

**Cause:** Lingering Firebase imports in code.

**Fix:**

```bash
# Find remaining Firebase imports
grep -r "firebase" src/ --include="*.js" --include="*.ts"

# Remove Firebase package
npm uninstall firebase

# Clear build cache
rm -rf .next node_modules/.cache
npm run build
```

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS AuthKit UI after migration
- workos-authkit-react — React-specific AuthKit implementation
- workos-directory-sync.rules.yml — Sync enterprise user directories
- workos-migrate-other-services.rules.yml — Generic migration patterns
