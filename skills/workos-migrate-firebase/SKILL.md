---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- generated -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The migration doc is the source of truth. If this skill conflicts with the doc, follow the doc.

## Step 2: Pre-Migration Assessment

### Inventory Firebase Auth Methods

Determine which Firebase auth methods are currently in use:

```bash
# Export Firebase users to JSON
firebase auth:export users.json --format=JSON

# Analyze auth methods in use
jq '[.users[].providerUserInfo[].providerId] | unique' users.json
```

Expected output includes one or more of:
- `password` - Email/password users
- `google.com` - Google OAuth
- `microsoft.com` - Microsoft OAuth
- `apple.com` - Apple Sign In
- Custom SAML/OIDC provider IDs

**Decision point:** Your migration path depends on this inventory.

## Step 3: Migration Strategy (Decision Tree)

```
Auth method in use?
  |
  +-- password (with hashes) ──> Go to Step 4 (Password Hash Import)
  |
  +-- password (force reset) ──> Go to Step 5 (Password Reset Flow)
  |
  +-- Social OAuth ──> Go to Step 6 (Social Auth Migration)
  |
  +-- Email Link ──> Go to Step 7 (Magic Auth Setup)
  |
  +-- SAML/OIDC ──> Go to Step 8 (Enterprise SSO Migration)
```

Most migrations involve multiple paths. Complete all applicable steps.

## Step 4: Password Hash Import (Firebase Scrypt)

### 4.1: Extract Firebase Hash Parameters

In Firebase Console:
1. Navigate to Authentication > Users
2. Click "⋮" menu > "Export users"
3. Note the displayed hash parameters:
   - `base64_signer_key`
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

**Critical:** These are project-wide parameters. Save them securely.

### 4.2: Export User Password Data

```bash
# Export with password hashes
firebase auth:export users.json --format=JSON
```

Each password user will have:
- `passwordHash` (base64)
- `salt` (base64)

### 4.3: Convert to PHC Format

Firebase uses a custom scrypt variant. Convert to PHC string format:

```
PHC format template:
$firebase-scrypt$sk={base64_signer_key}$ss={base64_salt_separator}$r={rounds}$m={mem_cost}$s={user_salt}${user_hash}
```

**Mapping:**
```
Firebase → PHC parameter
base64_signer_key     → sk
base64_salt_separator → ss
rounds                → r
mem_cost              → m
user.salt             → s (per-user)
user.passwordHash     → password hash (per-user)
```

Example transformation script:

```python
import json

# Load exported users
with open('users.json') as f:
    data = json.load(f)

# Project parameters from Firebase Console
SK = "your_base64_signer_key"
SS = "your_base64_salt_separator"
ROUNDS = "8"  # typical value
MEM_COST = "14"  # typical value

for user in data['users']:
    if 'passwordHash' not in user:
        continue
    
    salt = user['salt']
    hash_val = user['passwordHash']
    
    phc_hash = f"$firebase-scrypt$sk={SK}$ss={SS}$r={ROUNDS}$m={MEM_COST}$s={salt}${hash_val}"
    
    # Store phc_hash for WorkOS import
    user['workos_phc_hash'] = phc_hash
```

### 4.4: Create WorkOS Users with Hashes

For each user with a PHC hash:

```bash
# Example curl - replace with SDK call
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$firebase-scrypt$sk=...",
    "email_verified": true
  }'
```

**Verification:** User can immediately sign in with existing password without reset.

## Step 5: Password Reset Flow (No Hash Import)

If NOT importing password hashes:

1. Create WorkOS users without `password_hash`:
   ```bash
   curl -X POST https://api.workos.com/user_management/users \
     -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     -d '{"email": "user@example.com"}'
   ```

2. Trigger password reset emails:
   ```bash
   curl -X POST https://api.workos.com/user_management/password_reset \
     -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     -d '{"email": "user@example.com"}'
   ```

3. Communicate to users: "We've upgraded our authentication. Please check your email to set a new password."

**Trade-off:** Simpler migration, but users must reset passwords.

## Step 6: Social Auth Migration

### 6.1: Extract Firebase OAuth Credentials

In Firebase Console:
1. Authentication > Sign-in method
2. For each enabled provider (Google, Microsoft, etc.):
   - Copy **OAuth Client ID**
   - Copy **OAuth Client Secret**

### 6.2: Configure in WorkOS Dashboard

For each provider:

1. WorkOS Dashboard > Authentication > Social Connections
2. Select provider (Google, Microsoft, etc.)
3. Enter **same** Client ID and Secret from Firebase
4. Set Redirect URI: `https://api.workos.com/sso/oauth/callback`

**Critical:** Using the same OAuth credentials preserves existing user consent. Users won't need to re-authorize.

### 6.3: Link Existing Users

If a Firebase user has `providerUserInfo` with `providerId: "google.com"`:

```bash
# Create WorkOS user
curl -X POST https://api.workos.com/user_management/users \
  -d '{"email": "user@example.com"}'

# Link OAuth identity (if supported by provider)
# Check WorkOS docs for provider-specific linking
```

**Fallback:** If linking not supported, user re-authenticates once and WorkOS auto-links.

### 6.4: Unsupported Providers

If Firebase provider not in WorkOS (e.g., Twitter, Facebook):

1. Contact support@workos.com with provider name
2. Meanwhile, use password reset flow for those users
3. Or keep Firebase running in parallel during transition

## Step 7: Magic Auth Setup (Email Link Replacement)

If Firebase users sign in via Email Link:

1. WorkOS Dashboard > Authentication > Magic Auth
2. Enable Magic Auth
3. Configure email template (optional)

Client-side code change:

```typescript
// Before (Firebase)
await sendSignInLinkToEmail(auth, email);

// After (WorkOS - exact API depends on SDK)
const { code } = await workos.userManagement.sendMagicAuthCode({ email });
```

**Verification:** User receives email, clicks link, signs in without password.

## Step 8: Enterprise SSO Migration (SAML/OIDC)

### 8.1: Inventory Enterprise Connections

In Firebase Console:
1. Authentication > Sign-in method > SAML or OpenID Connect
2. For each connection, note:
   - Identity Provider metadata/config
   - Entity ID / Issuer
   - SSO URL
   - Certificate (if SAML)

### 8.2: Recreate in WorkOS

For each enterprise connection:

1. WorkOS Dashboard > SSO > Connections
2. Select protocol (SAML or OIDC)
3. Enter configuration matching Firebase setup
4. Provide new WorkOS ACS URL to IdP admin (SAML only)

**Critical:** For SAML, the ACS URL changes. IdP admin must update their configuration.

**For OIDC:** If Client ID/Secret unchanged, no IdP changes needed.

### 8.3: Test Connection

Before full cutover:

```bash
# Initiate SSO test flow
curl -X POST https://api.workos.com/sso/authorize \
  -d "organization=org_12345" \
  -d "redirect_uri=https://yourapp.com/callback"
```

**Verify:** SSO flow completes successfully with test user.

### 8.4: Communication Plan

Coordinate with enterprise customer:
1. Notify of planned change
2. Provide new metadata/ACS URL (if SAML)
3. Schedule cutover window
4. Test with pilot users before full rollout

## Step 9: Bulk User Creation Script

Combine all migration paths into bulk import:

```python
import requests
import json

WORKOS_API_KEY = "sk_..."
WORKOS_BASE_URL = "https://api.workos.com/user_management"

with open('users.json') as f:
    firebase_users = json.load(f)['users']

for user in firebase_users:
    payload = {"email": user['email']}
    
    # Add password hash if available
    if 'workos_phc_hash' in user:
        payload['password_hash'] = user['workos_phc_hash']
    
    # Set email verification status
    payload['email_verified'] = user.get('emailVerified', False)
    
    response = requests.post(
        f"{WORKOS_BASE_URL}/users",
        headers={"Authorization": f"Bearer {WORKOS_API_KEY}"},
        json=payload
    )
    
    if response.status_code != 201:
        print(f"Failed to create {user['email']}: {response.text}")
```

**Rate limiting:** WorkOS API has rate limits. Add delay between requests:

```python
import time
time.sleep(0.1)  # 10 req/sec max
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. WorkOS API key is valid
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/users | jq '.data | length'
# Expected: Number of migrated users

# 2. Password users can sign in (test one)
# Manual: Try logging in with pre-migration password

# 3. Social auth works (test one)
# Manual: Click "Sign in with Google" and verify

# 4. Magic auth works (if applicable)
# Manual: Request magic link, check email arrives

# 5. Enterprise SSO works (test one connection)
# Manual: Initiate SSO flow from admin test panel

# 6. Firebase Auth can be disabled (LAST STEP)
# Only after confirming all migration paths work
```

**Do not disable Firebase Auth until all checks pass.**

## Error Recovery

### "Invalid password_hash format"

**Root cause:** PHC string malformed or Firebase parameters incorrect.

**Fix:**
1. Verify project parameters match Firebase Console exactly
2. Check per-user salt and hash are base64 encoded
3. Test PHC string format with WorkOS API test endpoint (if available)

Example correct format:
```
$firebase-scrypt$sk=ABC123$ss=XYZ789$r=8$m=14$s=userSalt$userHashValue
```

### "User already exists" during bulk import

**Root cause:** User email already in WorkOS (duplicate run or partial import).

**Fix:**
1. Fetch existing users: `GET /user_management/users?email=user@example.com`
2. If user exists, use `PATCH /user_management/users/{id}` to update instead of `POST`
3. Or add deduplication logic to script:
   ```python
   existing = requests.get(f"{WORKOS_BASE_URL}/users", params={"email": email})
   if existing.json()['data']:
       user_id = existing.json()['data'][0]['id']
       # Update instead of create
   ```

### Social auth prompts user to re-authorize

**Root cause:** Different OAuth Client ID used in WorkOS than Firebase.

**Fix:**
1. Verify Client ID in WorkOS Dashboard matches Firebase exactly
2. Check Client Secret also matches
3. If changed, existing consent is invalidated — user must re-auth once

### Enterprise SSO fails with "Invalid ACS URL"

**Root cause:** IdP still configured with Firebase ACS URL.

**Fix:**
1. Get WorkOS ACS URL from Dashboard (looks like: `https://api.workos.com/sso/saml/acs/conn_123`)
2. Provide to IdP admin for configuration update
3. Re-test after IdP update

### "Rate limit exceeded" during bulk import

**Root cause:** Importing users too quickly.

**Fix:**
1. Add `time.sleep(0.2)` between requests (5 req/sec)
2. Or batch into smaller chunks with delays
3. Contact support@workos.com for temporary limit increase if migrating 10k+ users

### Users can't find password reset email

**Root cause:** WorkOS email domain not allowlisted or in spam.

**Fix:**
1. Check WorkOS Dashboard > Authentication > Email settings
2. Configure custom sending domain if available
3. Ask users to check spam folder
4. Test with your own email first before bulk rollout

## Related Skills

- `workos-authkit-nextjs` - Integrating WorkOS AuthKit after migration
- `workos-user-management` - Managing users post-migration
