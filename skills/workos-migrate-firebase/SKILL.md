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

## Step 2: Pre-Migration Assessment (Decision Tree)

Map Firebase auth features to WorkOS equivalents:

```
Current Firebase Auth Feature?
  |
  +-- Password Auth --> Step 3: Password Hash Import
  |
  +-- Social Auth (Google/Microsoft/GitHub) --> Step 4: Social Provider Migration
  |
  +-- Email Link (Passwordless) --> Step 5: Magic Auth Migration
  |
  +-- OIDC/SAML (Enterprise SSO) --> Step 6: Enterprise Auth Migration
  |
  +-- Phone Auth --> NOT SUPPORTED (manual user notification required)
```

**Critical:** WorkOS supports Firebase's scrypt variant for password hashes. Unlike some systems (e.g., Cognito), Firebase DOES export password hashes via CLI.

## Step 3: Password Hash Import

### 3.1: Export Firebase Hash Parameters

From Firebase Console:

1. Navigate to Authentication > Users
2. Click the three-dot menu (⋮)
3. Select "Export users"
4. Note the hash parameters displayed:
   - `base64_signer_key`
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

**Store these safely** — they are global per Firebase project.

### 3.2: Export User Data

Run Firebase CLI command:

```bash
firebase auth:export users.json --format=json
```

**Verify export:**

```bash
# Check file exists and contains password hashes
jq '[.users[] | select(.passwordHash != null)] | length' users.json

# If output is 0, users don't have passwords or export failed
```

Users with passwords will have `passwordHash` and `salt` fields.

### 3.3: Format PHC Hash String

Firebase scrypt → WorkOS PHC format:

```
$firebase-scrypt$ln={rounds},r={mem_cost}$sk={base64_signer_key}$ss={base64_salt_separator}${salt}${passwordHash}
```

**Parameter mapping:**

| Firebase Field          | PHC Parameter |
| ----------------------- | ------------- |
| `base64_signer_key`     | `sk`          |
| `base64_salt_separator` | `ss`          |
| `rounds`                | `ln`          |
| `mem_cost`              | `r`           |
| User's `salt`           | (raw value)   |
| User's `passwordHash`   | (raw value)   |

**Example transformation:**

```javascript
// Firebase export values (per-project)
const signerKey = 'abc123==';
const saltSeparator = 'xyz789==';
const rounds = 8;
const memCost = 14;

// Per-user values
const userSalt = 'user_salt_base64';
const userHash = 'user_hash_base64';

// WorkOS PHC format
const phcHash = `$firebase-scrypt$ln=${rounds},r=${memCost}$sk=${signerKey}$ss=${saltSeparator}$${userSalt}$${userHash}`;
```

**Critical:** All base64 values must preserve padding (=). Do not strip it.

### 3.4: Import to WorkOS

Use User Management API with the formatted hash:

**POST /user_management/users**

```json
{
  "email": "user@example.com",
  "password_hash": "$firebase-scrypt$ln=8,r=14$sk=abc123==$ss=xyz789==$user_salt$user_hash"
}
```

Or update existing user:

**PUT /user_management/users/:id**

```json
{
  "password_hash": "$firebase-scrypt$ln=8,r=14$sk=abc123==$ss=xyz789==$user_salt$user_hash"
}
```

Check the fetched docs for exact endpoint paths — they may use different naming (e.g., `/reference/authkit/user/create`).

## Step 4: Social Provider Migration

### 4.1: Export Firebase OAuth Credentials

From Firebase Console:

1. Authentication > Sign-in method
2. For each enabled provider (Google, Microsoft, GitHub, etc.):
   - Note the Client ID
   - Reveal and copy the Client Secret

### 4.2: Configure in WorkOS

Navigate to WorkOS Dashboard → Configuration → Authentication Methods.

**For each provider:**

1. Enable the provider
2. Enter the SAME Client ID from Firebase
3. Enter the SAME Client Secret from Firebase
4. Configure redirect URIs (must match your application's callback routes)

**Supported providers:**

- Google (https://workos.com/docs/integrations/google-oauth)
- Microsoft (https://workos.com/docs/integrations/microsoft-oauth)
- GitHub (check docs for availability)

**If provider not listed:** Email support@workos.com with provider name and use case.

### 4.3: Update Application Code

Replace Firebase OAuth calls with WorkOS AuthKit:

```javascript
// Before (Firebase)
signInWithPopup(auth, new GoogleAuthProvider());

// After (WorkOS AuthKit)
// Use getAuthorizationUrl with provider hint
const authUrl = getAuthorizationUrl({
  provider: 'GoogleOAuth',
  redirectUri: 'https://yourapp.com/callback',
});
window.location.href = authUrl;
```

Check fetched docs for exact method names — syntax may differ by SDK.

## Step 5: Magic Auth Migration (Email Link)

Firebase Email Link → WorkOS Magic Auth:

### 5.1: Remove Firebase Email Link Code

Delete calls to:

- `sendSignInLinkToEmail()`
- `isSignInWithEmailLink()`
- `signInWithEmailLink()`

### 5.2: Implement WorkOS Magic Auth

Use Magic Auth API:

**POST /user_management/magic_auth/send**

```json
{
  "email": "user@example.com"
}
```

**User flow:**

1. User enters email
2. App calls Magic Auth API
3. User clicks link in email
4. Link redirects to your callback route
5. Exchange code for session (standard AuthKit flow)

Check fetched docs for exact endpoint and parameter names.

## Step 6: Enterprise Auth Migration (OIDC/SAML)

### 6.1: Export Firebase Enterprise Connections

From Firebase Console:

1. Authentication > Sign-in method
2. For each OIDC/SAML provider:
   - Note the provider configuration (issuer URL, client ID, etc.)
   - Export any custom claim mappings

### 6.2: Recreate in WorkOS

WorkOS supports the SAME identity providers:

**OIDC:** https://workos.com/docs/integrations/oidc

**SAML:** https://workos.com/docs/integrations/saml

**Critical:** WorkOS uses a per-organization connection model. If Firebase used a single global OIDC/SAML config for all users, you'll need to create a "default" organization in WorkOS and assign all migrated users to it.

### 6.3: Update Identity Provider Configuration

In your IdP (Okta, Azure AD, etc.):

1. Update redirect URIs to WorkOS endpoints (shown in WorkOS Dashboard after connection creation)
2. Update issuer/audience if changed
3. Test SSO flow before migrating production users

## Step 7: User Data Migration

### 7.1: Export User Profiles

```bash
firebase auth:export users.json --format=json
```

### 7.2: Map Firebase Fields to WorkOS

| Firebase Field | WorkOS Field         | Notes                          |
| -------------- | -------------------- | ------------------------------ |
| `localId`      | N/A (new ID)         | WorkOS generates new user IDs  |
| `email`        | `email`              | Required                       |
| `displayName`  | `first_name`/`last_name` | Split if needed            |
| `photoUrl`     | Custom metadata      | Store in user metadata         |
| `emailVerified`| `email_verified`     | Boolean flag                   |
| `disabled`     | N/A                  | Handle separately (do not import disabled users) |

### 7.3: Import Users

Batch import script pattern:

```javascript
const users = JSON.parse(fs.readFileSync('users.json'));

for (const user of users.users) {
  if (user.disabled) continue; // Skip disabled accounts
  
  const payload = {
    email: user.email,
    email_verified: user.emailVerified || false,
    first_name: user.displayName?.split(' ')[0],
    last_name: user.displayName?.split(' ').slice(1).join(' '),
  };
  
  // Add password hash if exists (see Step 3.3)
  if (user.passwordHash) {
    payload.password_hash = formatFirebaseScryptHash(user);
  }
  
  await workos.userManagement.createUser(payload);
}
```

Check fetched docs for exact SDK method names.

## Step 8: Application Code Migration

### 8.1: Replace Firebase SDK Imports

```javascript
// Remove Firebase
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Add WorkOS AuthKit
import { WorkOS } from '@workos-inc/node'; // or appropriate SDK
```

### 8.2: Authentication Flow Changes

**Before (Firebase):**

```javascript
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();
```

**After (WorkOS):**

```javascript
// Redirect to WorkOS auth
const authUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  redirectUri: 'https://yourapp.com/callback',
});

// Handle callback
const { user } = await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});
```

Check fetched docs for exact patterns — they may use different method names or flows.

### 8.3: Session Management Changes

**Firebase uses client-side sessions** via `onAuthStateChanged()`.

**WorkOS uses server-side sessions** via encrypted cookies (AuthKit SDK).

If migrating a Next.js app from Firebase, follow the **workos-authkit-nextjs** skill for session handling patterns.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check password hash format (sample)
echo "$firebase-scrypt$ln=8,r=14$sk=test$ss=test$salt$hash" | grep -E '^\$firebase-scrypt\$ln=[0-9]+,r=[0-9]+\$sk=.+\$ss=.+\$.+\$.+$'

# 2. Verify WorkOS user creation endpoint responds
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  | jq -e '.id'

# 3. Check social provider config exists in Dashboard
# (Manual: verify via WorkOS Dashboard UI)

# 4. Verify app builds without Firebase SDK
npm run build 2>&1 | grep -i firebase && echo "FAIL: Firebase still referenced"

# 5. Test auth flow end-to-end
# (Manual: sign in with migrated credentials)
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC string malformed or missing parameters.

**Fix:**

1. Verify rounds, memCost, signerKey, saltSeparator are all present
2. Check base64 padding preserved (= signs)
3. Validate format: `$firebase-scrypt$ln=X,r=Y$sk=Z$ss=W$salt$hash`
4. Use a test hash to verify API accepts format before batch import

### "User already exists"

**Root cause:** Email collision during import.

**Fix:**

1. Check if user already imported (query by email)
2. If duplicate, skip or update with `PUT /users/:id`
3. For batch imports, implement idempotency check before create

### "OAuth redirect URI mismatch"

**Root cause:** WorkOS callback URL doesn't match registered redirect URIs.

**Fix:**

1. WorkOS Dashboard → Configuration → Redirect URIs
2. Add your callback URL (e.g., `https://yourapp.com/auth/callback`)
3. Verify protocol (https vs http), subdomain, and path match exactly

### "Provider not configured"

**Root cause:** Social auth provider not enabled in WorkOS Dashboard.

**Fix:**

1. Dashboard → Authentication Methods
2. Enable the provider (Google, Microsoft, etc.)
3. Enter Client ID and Client Secret from Firebase Console
4. Save and retry

### "SAML/OIDC connection not working after migration"

**Root cause:** Identity provider still pointing to Firebase URLs.

**Fix:**

1. Get WorkOS SSO URLs from Dashboard (shown after creating connection)
2. Update IdP configuration:
   - ACS URL / Redirect URI → WorkOS callback URL
   - Entity ID / Audience → WorkOS value
3. Test SSO flow with a test user before migrating production

### "Session not persisting after login"

**Root cause:** Missing AuthKit session middleware or cookies not configured.

**Fix:**

1. Check middleware.ts or proxy.ts exists (see workos-authkit-nextjs skill)
2. Verify `WORKOS_COOKIE_PASSWORD` is set (32+ characters)
3. Ensure callback route properly handles session creation
4. For Next.js 15+, verify async/await on cookie operations

## Related Skills

- **workos-authkit-nextjs** - If migrating a Next.js + Firebase app
- **workos-authkit-react** - If migrating a React SPA with Firebase
- **workos-magic-link** - Deep dive on Magic Auth (Email Link replacement)
- **workos-api-sso** - Enterprise SSO migration (OIDC/SAML)
- **workos-api-authkit** - User Management API reference
