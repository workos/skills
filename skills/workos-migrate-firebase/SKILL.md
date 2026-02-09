---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- generated -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The documentation is the source of truth. If this skill conflicts with the official docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check environment variables:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify WorkOS SDK is installed:
```bash
# Check package.json for WorkOS SDK
grep -E "@workos-inc/(node|authkit)" package.json || echo "FAIL: WorkOS SDK not installed"
```

### Firebase Access

Verify you have:
- Firebase console access for your project
- Firebase CLI installed: `firebase --version`
- Admin permissions to export user data

## Step 3: Migration Strategy (Decision Tree)

```
What auth methods does Firebase use?
  |
  +-- Passwords only
  |     |
  |     +-- Go to Step 4 (Password Hash Import)
  |
  +-- Social Auth (Google, Microsoft, etc.)
  |     |
  |     +-- Go to Step 5 (Social Provider Migration)
  |
  +-- Email Link (passwordless)
  |     |
  |     +-- Go to Step 6 (Magic Auth Setup)
  |
  +-- OIDC/SAML (Enterprise)
  |     |
  |     +-- Go to Step 7 (Enterprise SSO Migration)
  |
  +-- Multiple methods
        |
        +-- Execute steps 4-7 in sequence as needed
```

## Step 4: Password Hash Import (If Using Firebase Passwords)

### 4.1: Export Firebase Password Parameters

Get project-level password hash parameters from Firebase console:
1. Navigate to Project Settings → Users and permissions
2. Export password hash parameters
3. Save: `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`

**Verify:** All four parameters are base64-encoded strings or integers.

### 4.2: Export User Data

Run Firebase CLI export:
```bash
firebase auth:export firebase-users.json --project YOUR_PROJECT_ID
```

**Verify:** JSON file contains users with `passwordHash` and `salt` fields:
```bash
jq '[.users[] | select(.passwordHash != null)] | length' firebase-users.json
```

This should return the count of users with passwords.

### 4.3: Convert to PHC Format

Transform Firebase hash format to PHC-compatible string:

**Firebase → PHC parameter mapping:**
| Firebase                | PHC param |
|-------------------------|-----------|
| `base64_signer_key`     | `sk`      |
| `base64_salt_separator` | `ss`      |
| `rounds`                | `r`       |
| `mem_cost`              | `m`       |
| User's `passwordHash`   | hash body |
| User's `salt`           | `s`       |

**PHC format structure:**
```
$scrypt-firebase$r=ROUNDS,m=MEMCOST,sk=SIGNERKEY,ss=SALTSEP$s=USERSALT$PASSWORDHASH
```

Example conversion script pattern:
```javascript
const phcHash = `$scrypt-firebase$r=${rounds},m=${mem_cost},sk=${base64_signer_key},ss=${base64_salt_separator}$s=${user.salt}$${user.passwordHash}`;
```

### 4.4: Import to WorkOS

For each user, call WorkOS User Create API with the PHC hash:

```javascript
// Using @workos-inc/node SDK
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const user = await workos.userManagement.createUser({
  email: firebaseUser.email,
  emailVerified: firebaseUser.emailVerified,
  password: phcHashString, // PHC-formatted hash from step 4.3
});
```

**CRITICAL:** The `password` field must be the complete PHC string, not the raw hash.

**Verify import success:**
```bash
# Check user count in WorkOS dashboard matches Firebase export
# Dashboard: Organizations → Users → Total count
```

## Step 5: Social Provider Migration (If Using Social Auth)

### 5.1: Identify Active Providers

Check Firebase console under Authentication → Sign-in method for enabled providers:
- Google
- Microsoft
- GitHub
- Apple
- Others

### 5.2: Extract Client Credentials

For each enabled provider, get from Firebase console:
- **Client ID** (OAuth app identifier)
- **Client Secret** (OAuth app secret)

**Location in Firebase:**
- Google: Authentication → Sign-in method → Google → Web SDK configuration
- Microsoft: Authentication → Sign-in method → Microsoft → OAuth redirect domain
- GitHub: Authentication → Sign-in method → GitHub → Client ID/Secret

### 5.3: Configure in WorkOS

Navigate to WorkOS Dashboard → Connections → Social Connections:

For each provider:
1. Click "Add Connection"
2. Select provider (Google, Microsoft, etc.)
3. Paste Client ID from Firebase
4. Paste Client Secret from Firebase
5. Save

**Critical:** Use the SAME credentials from Firebase to avoid forcing users to re-authorize.

**Verify configuration:**
```bash
# Test sign-in flow with social provider
# User should NOT see new OAuth consent screen if credentials match
```

## Step 6: Magic Auth Setup (If Using Email Link)

Firebase Email Link authentication maps to WorkOS Magic Auth.

### 6.1: Enable Magic Auth

WorkOS Dashboard → Authentication → Magic Auth:
- Toggle "Enable Magic Auth"
- Configure email template (optional)

### 6.2: Update Application Code

Replace Firebase `sendSignInLinkToEmail` with WorkOS Magic Auth:

**Before (Firebase):**
```javascript
firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
```

**After (WorkOS):**
```javascript
// Using @workos-inc/authkit-nextjs or equivalent
const { url } = await workos.userManagement.createMagicAuth({
  email: email,
  invitationUrl: 'https://yourapp.com/auth/callback',
});
// Send url via email
```

Check WebFetch docs for exact SDK method names.

## Step 7: Enterprise SSO Migration (If Using OIDC/SAML)

### 7.1: Inventory Enterprise Connections

List all OIDC/SAML integrations configured in Firebase:
- Authentication → Sign-in method → SAML/OIDC providers
- Document: Provider name, metadata URL/XML, client credentials

### 7.2: Migrate Each Connection

For OIDC connections:
1. WorkOS Dashboard → Connections → Add Connection → OIDC
2. Enter Client ID, Client Secret, Discovery Endpoint from Firebase config
3. Save and test

For SAML connections:
1. WorkOS Dashboard → Connections → Add Connection → SAML
2. Upload IdP metadata XML from Firebase config
3. Provide ACS URL and Entity ID to IdP admin (WorkOS will display these)
4. Test connection

**Critical:** Coordinate with enterprise customer IT teams for SAML metadata updates if Entity ID changes.

### 7.3: Update Domain Routing

If Firebase used domain-based routing for enterprise connections:
1. WorkOS Dashboard → Organizations → [Org Name] → Domains
2. Add verified domains that should route to this SSO connection

## Step 8: Authentication Flow Update

Replace Firebase SDK calls in application code:

### 8.1: Sign In Flow

**Before (Firebase):**
```javascript
const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
```

**After (WorkOS):**
```javascript
// Using AuthKit - redirect to hosted auth
const authUrl = getSignInUrl();
window.location.href = authUrl;
```

### 8.2: Session Management

**Before (Firebase):**
```javascript
firebase.auth().onAuthStateChanged((user) => {
  // Handle user state
});
```

**After (WorkOS):**
```javascript
// Server-side in Next.js
const { user } = await getUser();
// Or client-side with AuthKitProvider
const { user } = useUser();
```

### 8.3: Sign Out

**Before (Firebase):**
```javascript
await firebase.auth().signOut();
```

**After (WorkOS):**
```javascript
const url = await getSignOutUrl();
window.location.href = url;
```

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Check WorkOS SDK is installed
npm list @workos-inc/node @workos-inc/authkit-nextjs 2>/dev/null || echo "FAIL: SDK not found"

# 2. Verify environment variables
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: Missing env vars"

# 3. Check API key format
echo $WORKOS_API_KEY | grep -E "^sk_" || echo "FAIL: Invalid API key format"

# 4. Verify Firebase exports exist (if doing password import)
test -f firebase-users.json && echo "PASS: Firebase export found" || echo "SKIP: No password import"

# 5. Test WorkOS API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1 \
  && echo "PASS: API accessible" || echo "FAIL: Cannot reach WorkOS API"
```

**Manual verification steps:**

1. **Password users:** Test login with migrated credentials - should succeed without password reset
2. **Social auth users:** Test OAuth flow - should NOT show new consent screen
3. **Magic Auth users:** Test email link - should receive and verify successfully
4. **Enterprise SSO users:** Test with enterprise email - should route to correct IdP

## Error Recovery

### "Invalid password hash format"

**Cause:** PHC string malformed or missing parameters.

**Fix:**
1. Verify PHC format: `$scrypt-firebase$r=X,m=Y,sk=Z,ss=W$s=SALT$HASH`
2. Check all commas and dollar signs are in correct positions
3. Ensure base64 values have no whitespace
4. Test with single user before bulk import

### "OAuth consent screen shown to existing users"

**Cause:** Client ID/Secret in WorkOS doesn't match Firebase.

**Fix:**
1. Re-check credentials copied from Firebase console
2. Verify no extra spaces in Client Secret
3. Delete and recreate connection in WorkOS with exact credentials
4. Clear browser OAuth consent cache for testing

### "SAML assertion failed"

**Cause:** Entity ID or ACS URL changed during migration.

**Fix:**
1. Get WorkOS Entity ID and ACS URL from Dashboard → Connection details
2. Contact IdP admin to update SAML configuration
3. Re-upload IdP metadata to WorkOS if IdP regenerated it
4. Test with SSO doctor tool in WorkOS Dashboard

### "User not found" after migration

**Cause:** Email mismatch or user not imported.

**Fix:**
1. Check Firebase export: `jq '.users[] | select(.email=="user@example.com")' firebase-users.json`
2. Check WorkOS API: `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/user_management/users?email=user@example.com`
3. Verify email normalization (lowercase, trimmed) matches between systems
4. Re-import user if missing

### "Firebase SDK still initializing"

**Cause:** Firebase SDK not fully removed from application.

**Fix:**
1. Search for Firebase imports: `grep -r "firebase" src/`
2. Remove `firebase` from package.json dependencies
3. Delete `firebase.json` and `.firebaserc` if present
4. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Related Skills

- `workos-authkit-nextjs` - Setting up AuthKit in Next.js projects
- `workos-user-management` - Managing users via WorkOS API
- `workos-organizations` - Multi-tenant organization setup
