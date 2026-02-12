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

### WorkOS Configuration

- Confirm WorkOS account exists
- Confirm API keys set in environment:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`

### Firebase Access

- Confirm Firebase CLI installed: `firebase --version`
- Confirm Firebase project access: `firebase projects:list`
- Confirm admin permissions for target project

**Verify:** All keys present before continuing.

## Step 3: Authentication Method Inventory (Decision Tree)

Audit Firebase Authentication settings to determine migration path:

```
Firebase Auth Methods Used?
  |
  +-- Password Auth (Email/Password)
  |     |
  |     +-- YES --> Step 4: Password Hash Migration
  |     +-- NO  --> Skip to Step 5
  |
  +-- Social Auth (Google, Microsoft, etc.)
  |     |
  |     +-- YES --> Step 5: Social Provider Migration
  |     +-- NO  --> Skip to Step 6
  |
  +-- Email Link (Passwordless)
  |     |
  |     +-- YES --> Step 6: Magic Auth Setup
  |     +-- NO  --> Skip to Step 7
  |
  +-- OIDC / SAML (Enterprise SSO)
        |
        +-- YES --> Step 7: Enterprise Connection Migration
        +-- NO  --> Complete
```

Document which auth methods are active. Multiple methods can coexist.

## Step 4: Password Hash Migration (If Using Password Auth)

### 4.1: Extract Firebase Hash Parameters

**CRITICAL:** Firebase uses a forked version of `scrypt`. WorkOS supports direct import.

Navigate to Firebase Console → Project Settings → Users and Permissions → Password Hashing Settings.

Extract these values (you will need ALL of them):

- `base64_signer_key`
- `base64_salt_separator`
- `rounds`
- `mem_cost`

**Verify:** All four parameters retrieved before continuing.

### 4.2: Export User Password Data

Run Firebase CLI command:

```bash
firebase auth:export users.json --format=JSON --project <PROJECT_ID>
```

**Verify:**

```bash
# Check export contains password data
jq '[.users[] | select(.passwordHash != null)] | length' users.json
# Should return count > 0 if password users exist
```

Each user with password auth will have:

- `passwordHash` field
- `salt` field

Users without these fields use other auth methods (social, etc.).

### 4.3: Convert to PHC Hash Format

**CRITICAL:** WorkOS requires PHC-compatible format. Firebase parameters map to PHC as follows:

| Firebase Parameter      | PHC Parameter |
| ----------------------- | ------------- |
| `base64_signer_key`     | `sk`          |
| `base64_salt_separator` | `ss`          |
| `rounds`                | `rounds`      |
| `mem_cost`              | `mem_cost`    |

Individual user values (from JSON export):
| Firebase Field | PHC Parameter |
|-----------------|---------------|
| `passwordHash` | hash value |
| `salt` | salt value |

PHC format structure:

```
$firebase-scrypt$sk=<base64_signer_key>$ss=<base64_salt_separator>$rounds=<rounds>$mem_cost=<mem_cost>$salt=<user_salt>$<user_passwordHash>
```

**Example conversion script pattern:**

```javascript
// Pseudo-code - adapt to your language
const firebaseHashParams = {
  sk: "base64_signer_key_from_console",
  ss: "base64_salt_separator_from_console",
  rounds: 8, // from console
  mem_cost: 14, // from console
};

users.forEach((user) => {
  if (user.passwordHash && user.salt) {
    const phcHash = `$firebase-scrypt$sk=${firebaseHashParams.sk}$ss=${firebaseHashParams.ss}$rounds=${firebaseHashParams.rounds}$mem_cost=${firebaseHashParams.mem_cost}$salt=${user.salt}$${user.passwordHash}`;

    // Use phcHash in WorkOS User Create/Update API
  }
});
```

### 4.4: Import Users to WorkOS

For each user with password:

1. Call WorkOS User Create API with PHC hash:

   ```bash
   curl -X POST https://api.workos.com/user_management/users \
     -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password_hash": "$firebase-scrypt$sk=...$ss=...$rounds=8$mem_cost=14$salt=...$...",
       "email_verified": true
     }'
   ```

2. Or update existing WorkOS users:
   ```bash
   curl -X PUT https://api.workos.com/user_management/users/{user_id} \
     -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "password_hash": "$firebase-scrypt$..."
     }'
   ```

**CRITICAL:** Set `email_verified: true` if Firebase user had `emailVerified: true`. Do NOT force re-verification for migrated users.

**Verify:**

```bash
# Test login with migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_user@example.com",
    "password": "original_firebase_password",
    "client_id": "'"${WORKOS_CLIENT_ID}"'"
  }'
# Should return 200 with session token
```

## Step 5: Social Provider Migration (If Using Social Auth)

### 5.1: Extract Firebase OAuth Credentials

For each social provider (Google, Microsoft, etc.) enabled in Firebase:

1. Navigate to Firebase Console → Authentication → Sign-in method
2. Click on each enabled provider
3. Extract:
   - Client ID
   - Client Secret
   - Redirect URI (if custom)

**Common providers:**

- Google OAuth
- Microsoft OAuth
- GitHub OAuth
- Apple OAuth

### 5.2: Configure in WorkOS

For each provider, follow provider-specific guide:

```
Provider?
  |
  +-- Google    --> WebFetch: https://workos.com/docs/integrations/google-oauth
  +-- Microsoft --> WebFetch: https://workos.com/docs/integrations/microsoft-oauth
  +-- GitHub    --> Contact support@workos.com (check if supported)
  +-- Apple     --> Contact support@workos.com (check if supported)
  +-- Other     --> Contact support@workos.com
```

**CRITICAL:** Use the SAME Client ID and Client Secret from Firebase. Do NOT generate new credentials unless you want users to re-authorize.

### 5.3: Update Redirect URIs

If Firebase used custom redirect URIs:

1. Update provider's OAuth app settings (Google Console, Microsoft Azure, etc.)
2. Add WorkOS redirect URI: `https://api.workos.com/sso/oauth/callback`
3. Keep Firebase redirect URI active during migration period

**Verify:**

```bash
# Test OAuth flow
# 1. Get authorization URL from WorkOS
curl -X GET "https://api.workos.com/sso/authorize?client_id=${WORKOS_CLIENT_ID}&redirect_uri=YOUR_APP_CALLBACK&provider=GoogleOAuth"
# 2. Visit URL in browser, complete OAuth flow
# 3. Should redirect with code parameter
```

## Step 6: Magic Auth Setup (If Using Email Link)

Firebase Email Link → WorkOS Magic Auth equivalent.

### 6.1: Configure Magic Auth

WebFetch: `https://workos.com/docs/reference/magic-auth`

Enable Magic Auth in WorkOS Dashboard:

1. Go to Authentication → Magic Auth
2. Enable for your environment
3. Configure email template (optional - WorkOS provides default)

### 6.2: Update Application Code

Replace Firebase `sendSignInLinkToEmail` with WorkOS Magic Auth:

**Before (Firebase):**

```javascript
firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
```

**After (WorkOS):**

```javascript
// See WebFetch docs for exact API - typically:
// POST /user_management/magic_auth with email parameter
```

**Verify:**

```bash
# Test magic link send
curl -X POST https://api.workos.com/user_management/magic_auth \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
# Check email for magic link
```

## Step 7: Enterprise Connection Migration (If Using OIDC/SAML)

### 7.1: Inventory Enterprise Connections

List all OIDC/SAML configurations in Firebase:

1. Firebase Console → Authentication → Sign-in method
2. Document each enterprise connection:
   - Protocol (OIDC or SAML)
   - Identity Provider details
   - Metadata URL or certificate
   - Attribute mappings

### 7.2: Configure in WorkOS

For each connection:

```
Protocol?
  |
  +-- OIDC --> WebFetch: https://workos.com/docs/integrations/oidc
  |              Then: Create connection in WorkOS Dashboard with same IDP settings
  |
  +-- SAML --> WebFetch: https://workos.com/docs/integrations/saml
                 Then: Create connection in WorkOS Dashboard with same IDP metadata
```

**CRITICAL:** Use the SAME entity ID / metadata URL from Firebase. Coordinate with enterprise customer IT teams to update their IDP if WorkOS entity ID differs.

### 7.3: Update Application Integration

Replace Firebase OIDC/SAML sign-in flow with WorkOS SSO:

1. Remove Firebase `signInWithPopup` or `signInWithRedirect` for enterprise providers
2. Implement WorkOS SSO authorization flow (see fetched docs)
3. Handle WorkOS SSO callback

**Verify:**

```bash
# Test enterprise SSO (requires live IDP)
# 1. Get SSO authorization URL
curl -X GET "https://api.workos.com/sso/authorize?connection_id=CONNECTION_ID&client_id=${WORKOS_CLIENT_ID}&redirect_uri=YOUR_APP_CALLBACK"
# 2. Complete SSO flow with test user
# 3. Verify callback with valid code
```

## Step 8: Dual-Write Migration Period (RECOMMENDED)

To minimize user disruption:

1. **Phase 1:** Deploy WorkOS alongside Firebase
   - Keep Firebase Auth active
   - Write new users to WorkOS
   - Existing users still use Firebase

2. **Phase 2:** Lazy migration on login
   - User logs in via Firebase → migrate to WorkOS + create session
   - User logs in via WorkOS → standard flow
   - Mark migrated users in database

3. **Phase 3:** Cutover
   - Disable Firebase Authentication
   - All users now on WorkOS

**Migration tracking query example:**

```bash
# Check migration progress
jq '[.users[] | select(.migrated_to_workos == true)] | length' migration_log.json
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. WorkOS API keys configured
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID || echo "FAIL: Missing keys"

# 2. Password users can authenticate (if migrated)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"migrated_user@example.com","password":"test_password","client_id":"'"${WORKOS_CLIENT_ID}"'"}' \
  | grep -q "session_token" && echo "PASS: Password auth works" || echo "FAIL: Password auth broken"

# 3. Social OAuth redirects to WorkOS (if configured)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.workos.com/sso/authorize?client_id=${WORKOS_CLIENT_ID}&redirect_uri=http://localhost:3000/callback&provider=GoogleOAuth" \
  | grep -q "302" && echo "PASS: OAuth redirect works" || echo "FAIL: OAuth not configured"

# 4. Magic Auth sends email (if enabled)
curl -X POST https://api.workos.com/user_management/magic_auth \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  | grep -q "success" && echo "PASS: Magic auth works" || echo "FAIL: Magic auth broken"

# 5. No Firebase SDK imports remain in production code
grep -r "firebase/auth" src/ && echo "FAIL: Firebase still imported" || echo "PASS: Firebase removed"
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC hash string malformed or missing parameters.

**Fix:**

1. Verify all Firebase hash parameters retrieved from console
2. Check user `salt` and `passwordHash` fields exist in export
3. Verify PHC format: `$firebase-scrypt$sk=...$ss=...$rounds=...$mem_cost=...$salt=...$...`
4. Ensure no whitespace/newlines in hash string

### "OAuth redirect_uri_mismatch"

**Root cause:** Provider OAuth app not configured with WorkOS callback URL.

**Fix:**

1. Go to provider's developer console (Google Cloud, Azure, etc.)
2. Add WorkOS redirect URI: `https://api.workos.com/sso/oauth/callback`
3. Keep Firebase redirect URI active during migration
4. Wait 5-10 minutes for provider cache refresh

### "SAML authentication failed"

**Root cause:** WorkOS entity ID differs from Firebase, IDP not updated.

**Fix:**

1. Get WorkOS entity ID from Dashboard → Connections → [Your Connection]
2. Coordinate with enterprise customer IT team
3. Update IDP configuration with new entity ID
4. Test with customer IT admin account first

### "User not found" after password migration

**Root cause:** User created in WorkOS but email doesn't match Firebase exactly.

**Fix:**

1. Check case sensitivity: Firebase `User@Example.com` vs WorkOS `user@example.com`
2. WorkOS normalizes emails to lowercase - ensure Firebase export lowercase
3. Check for whitespace in exported emails
4. Query WorkOS users API to confirm user exists:
   ```bash
   curl -X GET "https://api.workos.com/user_management/users?email=user@example.com" \
     -H "Authorization: Bearer ${WORKOS_API_KEY}"
   ```

### "Magic link not received"

**Root cause:** Email provider blocking or WorkOS sender not whitelisted.

**Fix:**

1. Check spam folder
2. Verify email address valid and deliverable
3. Check WorkOS Dashboard → Email Settings for sender domain
4. Whitelist `@workos.com` sender domain with email provider
5. Test with different email provider (Gmail, Outlook, etc.)

### Firebase users have no `passwordHash` field

**Root cause:** Users created via social auth or email link, not email/password.

**Fix:**

1. This is EXPECTED for non-password users
2. Filter export: `jq '.users[] | select(.passwordHash != null)' users.json`
3. Migrate social auth users via Step 5 instead
4. Migrate email link users via Step 6 instead
5. Users can set new passwords after migration via password reset flow

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit UI in Next.js after migration
- workos-authkit-react - Integrate AuthKit UI in React after migration
- workos-authkit-vanilla-js - Integrate AuthKit UI in vanilla JS after migration
