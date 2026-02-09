---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Identify Firebase Auth Methods in Use

Audit your Firebase project to determine which authentication methods are active:

```bash
# Export Firebase user data to analyze auth methods
firebase auth:export users.json --project <project-id>

# Count users by auth method
jq '[.users[] | .providerUserInfo[0].providerId] | group_by(.) | map({provider: .[0], count: length})' users.json
```

This reveals which migration paths you need (password, social, email link, SSO).

### Retrieve Firebase Configuration

**For password migration**, fetch hash parameters from Firebase Console:
1. Navigate to Authentication > Users
2. Click menu (⋮) > "Password hash parameters"
3. Copy: `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`

**For social providers**, collect OAuth credentials:
- Google: Client ID and Client Secret from Firebase Console > Authentication > Sign-in method > Google
- Microsoft: Client ID and Client Secret from Firebase Console > Authentication > Sign-in method > Microsoft
- Repeat for each active social provider

**For OIDC/SAML**, document:
- Identity provider metadata URLs or XML files
- Client IDs / Entity IDs
- Redirect URIs currently configured

## Step 3: WorkOS Environment Setup

### Create WorkOS Account and Environment

1. Sign up at https://dashboard.workos.com
2. Create new environment (Development or Production)
3. Note API keys: `WORKOS_API_KEY` (starts with `sk_`) and `WORKOS_CLIENT_ID` (starts with `client_`)

### Configure Social Providers (if applicable)

**Decision tree for social auth:**

```
Social providers in Firebase?
  |
  +-- Yes --> Copy Firebase OAuth credentials to WorkOS Dashboard
  |           (see provider-specific integration guides)
  |
  +-- No  --> Skip to Step 4
```

For each active social provider:
- Navigate to WorkOS Dashboard > Authentication > Social Connections
- Select provider (Google, Microsoft, etc.)
- Paste Client ID and Client Secret from Firebase
- Verify redirect URI matches your application

WebFetch provider-specific guides:
- Google: https://workos.com/docs/integrations/google-oauth
- Microsoft: https://workos.com/docs/integrations/microsoft-oauth

Check migration docs for complete list of supported providers.

## Step 4: Export Firebase User Data

Export all user data including password hashes:

```bash
# Export complete user database
firebase auth:export firebase-users.json --project <project-id>

# Verify export contains password hashes
jq '[.users[] | select(.passwordHash != null)] | length' firebase-users.json
```

**Expected output:** Count of users with password hashes. If 0 and you expect password users, re-check export command.

## Step 5: Transform Password Hashes (if applicable)

Firebase uses forked scrypt. WorkOS requires PHC format.

### Build PHC Hash Strings

For each user with a password, construct PHC hash using this mapping:

```
Firebase parameter       --> PHC parameter
base64_signer_key        --> sk
base64_salt_separator    --> ss
rounds                   --> r
mem_cost                 --> m
```

**PHC format pattern:**

```
$firebase-scrypt$m=<mem_cost>,r=<rounds>,ss=<base64_salt_separator>,sk=<base64_signer_key>$<user_salt>$<user_hash>
```

**Example transformation script:**

```javascript
function buildPHCHash(firebaseUser, projectParams) {
  const { base64_signer_key, base64_salt_separator, rounds, mem_cost } = projectParams;
  const { salt, passwordHash } = firebaseUser;
  
  return `$firebase-scrypt$m=${mem_cost},r=${rounds},ss=${base64_salt_separator},sk=${base64_signer_key}$${salt}$${passwordHash}`;
}
```

Run transformation on exported user data. Output should be array of user objects with PHC-formatted password hashes.

## Step 6: Import Users to WorkOS

### Decision Tree: Import Strategy

```
How many users?
  |
  +-- <1000   --> Single batch import via Dashboard
  |
  +-- 1000+   --> Programmatic import via API
```

### Option A: Dashboard Import (Small Scale)

1. WorkOS Dashboard > Users > Import
2. Upload transformed user data (CSV or JSON)
3. Map fields: email, password_hash, metadata

**Verify:** Check Dashboard shows correct user count after import.

### Option B: API Import (Large Scale)

WebFetch: https://workos.com/docs/reference/authkit/user/create

Use User Creation API with password hash:

```bash
# Example API call structure (check docs for exact method)
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$firebase-scrypt$m=...",
    "email_verified": true
  }'
```

**Rate limit handling:** Docs specify rate limits. Batch requests accordingly.

**Verify import:** Query WorkOS API for user count matches Firebase export count.

## Step 7: Configure Enterprise SSO (if applicable)

**Skip this step if no OIDC/SAML connections in Firebase.**

For each enterprise connection:

### OIDC Connections

WebFetch: https://workos.com/docs/integrations/oidc

1. WorkOS Dashboard > SSO > OIDC
2. Enter same IdP metadata URL from Firebase config
3. Copy WorkOS callback URL to identity provider

### SAML Connections

WebFetch: https://workos.com/docs/integrations/saml

1. WorkOS Dashboard > SSO > SAML
2. Upload IdP metadata XML or enter URL
3. Configure service provider settings using WorkOS values

**Verify:** Test login flow for one user per connection before full migration.

## Step 8: Update Application Code

### Install WorkOS SDK

Detect framework and install appropriate SDK:

```bash
# Determine framework from package.json or project structure
# Then install matching SDK (see related skills for framework-specific steps)
```

### Replace Firebase Auth Calls

Map Firebase SDK calls to WorkOS equivalents:

```
Firebase call                    --> WorkOS replacement skill
signInWithEmailAndPassword()     --> workos-authkit-* (framework-specific)
signInWithPopup(GoogleProvider)  --> Social connection via AuthKit
sendSignInLinkToEmail()          --> workos-magic-link
signInWithRedirect()             --> SSO connection via AuthKit
```

**Critical:** Do NOT attempt direct SDK translation. Use framework-specific WorkOS skills:
- Next.js: See `workos-authkit-nextjs`
- React: See `workos-authkit-react`
- Vanilla JS: See `workos-authkit-vanilla-js`

### Update Environment Variables

Replace Firebase config with WorkOS equivalents:

```bash
# Remove or comment out
# FIREBASE_API_KEY=...
# FIREBASE_AUTH_DOMAIN=...

# Add WorkOS config
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://yourapp.com/auth/callback
```

Exact variable names depend on SDK (see framework-specific skill).

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. User count matches
echo "Firebase users:" $(jq '.users | length' firebase-users.json)
echo "WorkOS users:" # Query WorkOS API for count

# 2. WorkOS credentials valid
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/users | jq '.data | length'

# 3. Social connections configured (if applicable)
# Check WorkOS Dashboard > Authentication > Social Connections shows expected providers

# 4. Test login flow
# Attempt login with:
# - Password user (if applicable)
# - Social auth user (if applicable)
# - Magic link user (if applicable)
# - SSO user (if applicable)

# 5. Application builds
npm run build  # or equivalent for your framework
```

**All tests must pass before decommissioning Firebase.**

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC hash string malformed.

**Fix:**
1. Verify Firebase hash parameters copied correctly (no truncation)
2. Check user's salt and passwordHash are base64-encoded
3. Ensure no newlines or spaces in PHC string
4. Test PHC format: must start with `$firebase-scrypt$`

### "User import fails with 400 error"

**Root cause:** Missing required fields or invalid email format.

**Fix:**
1. Check API docs for required user fields: WebFetch https://workos.com/docs/reference/authkit/user/create
2. Validate all emails with regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
3. Ensure `email_verified: true` for migrated users (they already verified in Firebase)

### "Social login redirects to Firebase"

**Root cause:** Application code still using Firebase SDK.

**Fix:**
1. Search codebase for Firebase imports: `grep -r "firebase/auth" .`
2. Replace with WorkOS SDK (see Step 8)
3. Update OAuth redirect URIs in provider console to point to WorkOS

### "SAML connection fails with metadata error"

**Root cause:** IdP metadata URL expired or changed.

**Fix:**
1. Re-fetch IdP metadata from identity provider admin console
2. Upload fresh XML to WorkOS Dashboard
3. Verify WorkOS callback URL is registered with IdP

### "Rate limit exceeded during import"

**Root cause:** Too many API calls too quickly.

**Fix:**
1. Check docs for current rate limits
2. Add delay between requests: `sleep 0.1` (100ms)
3. Implement exponential backoff on 429 responses

## Related Skills

- `workos-authkit-nextjs` - Next.js implementation after migration
- `workos-authkit-react` - React implementation after migration
- `workos-authkit-vanilla-js` - Vanilla JS implementation after migration
- `workos-magic-link` - Email link replacement for Firebase Email Link
- `workos-sso` - Enterprise SSO setup for OIDC/SAML
