---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- generated -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

Identify which Firebase auth methods you currently use:

```
Firebase Auth Methods?
  |
  +-- Password Auth
  |     |
  |     +-- Export password hashes --> Go to Step 3
  |
  +-- Social Auth (Google, Microsoft, etc.)
  |     |
  |     +-- Migrate OAuth credentials --> Go to Step 4
  |
  +-- Email Link (Passwordless)
  |     |
  |     +-- Switch to Magic Auth --> Go to Step 5
  |
  +-- OIDC/SAML (Enterprise SSO)
        |
        +-- Reconfigure connections --> Go to Step 6
```

**You may have multiple methods.** Complete all relevant steps.

## Step 3: Migrate Password Hashes (If Using Password Auth)

### 3.1: Extract Firebase Hash Parameters

**Action:** Open Firebase Console → Project Settings → Service Accounts → Scroll to "Password Hash Parameters"

**Required values:**
- `base64_signer_key`
- `base64_salt_separator`
- `rounds`
- `mem_cost`

**Store these securely** — you'll need them for every user import.

### 3.2: Export User Data

Run Firebase CLI export:

```bash
firebase auth:export users.json --project YOUR_PROJECT_ID
```

**Verify export:**
```bash
# Check file exists and contains password data
jq '.users[] | select(.passwordHash != null) | {email, passwordHash, salt}' users.json | head -n 20
```

If `passwordHash` and `salt` fields are missing, users don't have passwords set.

### 3.3: Format PHC Hash String

For EACH user with a password, construct a PHC-compatible hash:

**Format:**
```
$scrypt$ln=ROUNDS,r=8,p=1,ss=BASE64_SALT_SEPARATOR,sk=BASE64_SIGNER_KEY$USER_SALT$USER_PASSWORD_HASH
```

**Mapping:**
- Firebase `rounds` → PHC `ln` (natural log of N)
- Firebase `base64_salt_separator` → PHC `ss`
- Firebase `base64_signer_key` → PHC `sk`
- User's `salt` → Fourth field (base64)
- User's `passwordHash` → Fifth field (base64)

**Example transformation:**
```javascript
// Firebase values
const firebaseParams = {
  rounds: 8,
  base64_signer_key: "jxspr8Ki0RYycVU8zykbdLG...",
  base64_salt_separator: "Bw=="
};

const user = {
  email: "user@example.com",
  salt: "42xQmnha0Ves...",
  passwordHash: "lSrfV15cpx95/..."
};

// PHC format for WorkOS
const phcHash = `$scrypt$ln=${firebaseParams.rounds},r=8,p=1,ss=${firebaseParams.base64_salt_separator},sk=${firebaseParams.base64_signer_key}$${user.salt}$${user.passwordHash}`;
```

### 3.4: Import Users to WorkOS

Use WorkOS User Management API to create users with password hashes:

```bash
# Create user with migrated password
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$scrypt$ln=8,r=8,p=1,ss=Bw==,sk=jxspr8Ki0RYy...$42xQmnha0Ves...$lSrfV15cpx95/...",
    "password_hash_type": "firebase_scrypt"
  }'
```

**Batch import:** Loop through `users.json` and POST each user.

**Verification command:**
```bash
# Check user was created with email
curl https://api.workos.com/user_management/users?email=user@example.com \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[0].email'
```

## Step 4: Migrate Social Auth (If Using OAuth Providers)

### 4.1: Extract Firebase OAuth Credentials

**For each provider (Google, Microsoft, etc.):**

Firebase Console → Authentication → Sign-in method → Provider configuration

**Copy:**
- Client ID
- Client Secret

### 4.2: Configure WorkOS Connections

**Decision tree for provider type:**
```
OAuth Provider?
  |
  +-- Google --> WorkOS Dashboard → Configuration → Authentication → Google OAuth
  |
  +-- Microsoft --> WorkOS Dashboard → Configuration → Authentication → Microsoft OAuth
  |
  +-- GitHub --> WorkOS Dashboard → Configuration → Authentication → GitHub OAuth
  |
  +-- Other --> Check https://workos.com/docs/integrations for supported providers
```

**For each provider:**
1. Open WorkOS Dashboard → Configuration → Authentication
2. Enable provider
3. Paste Client ID from Firebase
4. Paste Client Secret from Firebase
5. Set redirect URI to your WorkOS callback URL (e.g., `https://yourapp.com/auth/callback`)

**Verification:**
```bash
# Test OAuth flow (replace with your provider)
curl -I https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=https://yourapp.com/auth/callback&response_type=code&provider=google
# Should return 302 redirect to provider
```

### 4.3: Update Application Code

Replace Firebase OAuth initialization with WorkOS AuthKit SDK calls.

**See related skill:** `workos-authkit-nextjs` for full SDK integration steps.

## Step 5: Migrate Email Link to Magic Auth (If Using Passwordless)

### 5.1: Enable Magic Auth in WorkOS

WorkOS Dashboard → Configuration → Authentication → Enable "Magic Auth"

**Configure:**
- Email verification method (link vs. code)
- Link expiration time
- Email template customization

### 5.2: Replace Firebase Email Link Code

**Before (Firebase):**
```javascript
// Firebase Email Link
firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
```

**After (WorkOS):**
```javascript
// WorkOS Magic Auth
const { createMagicAuth } = workos.userManagement;
await createMagicAuth({ email });
```

**Verification:**
```bash
# Send test magic auth email
curl https://api.workos.com/user_management/magic_auth \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' | jq '.code'
```

Check email inbox for delivery.

## Step 6: Migrate Enterprise SSO (If Using OIDC/SAML)

### 6.1: Document Current Firebase Connections

For each enterprise customer using SSO:

**Extract from Firebase:**
- Provider type (OIDC or SAML)
- Provider identifier
- Issuer URL (OIDC) or IdP Entity ID (SAML)
- Client ID/Secret (OIDC) or Certificate (SAML)
- Attribute mappings

### 6.2: Recreate in WorkOS

**For OIDC connections:**
1. WorkOS Dashboard → Organizations → Select organization
2. Add connection → OIDC
3. Enter provider details from Firebase
4. Test connection before migrating

**For SAML connections:**
1. WorkOS Dashboard → Organizations → Select organization
2. Add connection → SAML
3. Upload IdP metadata or manually configure
4. Download WorkOS SP metadata and provide to customer

**Verification per connection:**
```bash
# List connections for organization
curl https://api.workos.com/connections?organization_id=$ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | {name, state}'
```

All connections should show `state: "active"`.

## Step 7: Update Application Integration

### 7.1: Install WorkOS SDK

Detect package manager and install SDK:

```bash
# npm
npm install @workos-inc/node

# yarn
yarn add @workos-inc/node

# pnpm
pnpm add @workos-inc/node
```

**Verify:**
```bash
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK not installed"
```

### 7.2: Replace Firebase Auth Calls

**Key replacements:**

| Firebase | WorkOS |
|----------|--------|
| `firebase.auth().signInWithEmailAndPassword()` | `workos.userManagement.authenticateWithPassword()` |
| `firebase.auth().createUserWithEmailAndPassword()` | `workos.userManagement.createUser()` |
| `firebase.auth().signOut()` | Clear session tokens (implementation depends on session management) |
| `firebase.auth().onAuthStateChanged()` | Check session on each request using `workos.userManagement.getUser()` |

**For framework-specific integration (Next.js, Express, etc.):** See related skills for AuthKit integration patterns.

### 7.3: Update Environment Variables

Add to `.env` or `.env.local`:

```bash
WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
```

**Remove Firebase config:**
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- etc.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration readiness:

```bash
# 1. Check WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: WorkOS SDK missing"

# 2. Check environment variables set
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: WorkOS env vars missing"

# 3. Verify users imported (if using password migration)
curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match number of Firebase users

# 4. Check OAuth connections configured (if applicable)
curl -s https://api.workos.com/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[] | {name, state}'
# All should show "active"

# 5. Test authentication flow
npm run dev
# Manually test login at http://localhost:3000
```

## Error Recovery

### "Invalid password_hash format"

**Root cause:** PHC hash string incorrectly formatted.

**Fix:**
1. Verify Firebase hash parameters are base64-encoded strings (not decoded bytes)
2. Check PHC format matches: `$scrypt$ln=X,r=8,p=1,ss=...,sk=...$SALT$HASH`
3. Ensure no spaces or line breaks in hash string
4. Test with single user before batch import

### "Connection state: inactive"

**Root cause:** OAuth credentials invalid or callback URLs misconfigured.

**Fix:**
1. Verify Client ID and Secret exactly match Firebase values
2. Check redirect URI in WorkOS matches your application's callback URL
3. Test OAuth flow manually in browser
4. Check WorkOS Dashboard → Connections → View logs for specific error

### "User not found" after migration

**Root cause:** User import failed silently or email mismatch.

**Fix:**
1. Check WorkOS API response during import for errors
2. Verify email addresses match exactly (Firebase may have normalized emails)
3. Re-run import for missing users with error logging enabled
4. Query WorkOS API to confirm user exists: `GET /user_management/users?email=...`

### "Email already exists"

**Root cause:** Attempting to re-import already migrated user.

**Fix:**
1. Query WorkOS first: `GET /user_management/users?email=...`
2. If user exists, use `PATCH /user_management/users/:id` to update password hash
3. Add idempotency check to import script (skip if user exists)

### Firebase sessions still active after migration

**Root cause:** Application still validating Firebase tokens.

**Fix:**
1. Remove all Firebase SDK initialization code
2. Force logout all users by invalidating existing sessions
3. Update middleware to validate WorkOS sessions only
4. Clear browser cookies/localStorage containing Firebase tokens

## Related Skills

- `workos-authkit-nextjs` - Full AuthKit integration for Next.js
- `workos-user-management` - User Management API patterns
- `workos-organizations` - Managing organizations and connections
