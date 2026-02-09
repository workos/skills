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

## Step 2: Pre-Migration Assessment

### Identify Firebase Auth Methods in Use

Run Firebase CLI to export user data and analyze auth methods:

```bash
# Export Firebase users (requires Firebase CLI and project credentials)
firebase auth:export users.json --format=JSON

# Analyze auth methods in use
cat users.json | jq '[.users[].providerUserInfo[].providerId] | unique'
```

Expected outputs and migration paths:

```
Auth method in Firebase        --> WorkOS equivalent
password                       --> Password import with scrypt
google.com                     --> Google OAuth connection
microsoft.com                  --> Microsoft OAuth connection  
emailLink                      --> Magic Auth
oidc.{provider}                --> OIDC connection
saml.{provider}                --> SAML connection
```

**Decision point:** If output includes `password`, proceed to Step 3. Otherwise skip to Step 4.

## Step 3: Password Hash Migration (If Users Have Passwords)

### 3.1: Retrieve Firebase Password Parameters

Firebase Console → Project Settings → Users and permissions → Password hash parameters

Extract these values (base64-encoded strings):
- `base64_signer_key`
- `base64_salt_separator`
- `rounds` (integer)
- `mem_cost` (integer)

**Verify:** All four parameters are present. If missing, password import will fail.

### 3.2: Export User Password Hashes

```bash
# Export includes passwordHash and salt fields
firebase auth:export firebase_users.json --format=JSON

# Verify password hashes present
cat firebase_users.json | jq '.users[] | select(.passwordHash != null) | {uid, passwordHash, salt}' | head -5
```

**Critical:** The `passwordHash` and `salt` fields must exist for password users. Missing fields mean incomplete export.

### 3.3: Convert to PHC Format

Firebase uses a proprietary scrypt variant. WorkOS accepts PHC-formatted hashes.

**Mapping (from WorkOS migration docs):**

```
Firebase parameter      --> PHC parameter
base64_signer_key       --> sk
base64_salt_separator   --> ss
rounds                  --> (implicit in PHC)
mem_cost                --> (implicit in PHC)
passwordHash            --> (hash component)
salt                    --> (salt component)
```

**PHC format template:**

```
$scrypt-firebase$sk={base64_signer_key}$ss={base64_salt_separator}$rounds={rounds}$mem_cost={mem_cost}${user_salt}${user_password_hash}
```

Create conversion script:

```javascript
// convert-firebase-hashes.js
const fs = require('fs');

const params = {
  sk: process.env.FIREBASE_SIGNER_KEY,
  ss: process.env.FIREBASE_SALT_SEPARATOR,
  rounds: process.env.FIREBASE_ROUNDS,
  mem_cost: process.env.FIREBASE_MEM_COST
};

const users = JSON.parse(fs.readFileSync('firebase_users.json'));

const converted = users.users
  .filter(u => u.passwordHash)
  .map(u => ({
    email: u.email,
    passwordHash: `$scrypt-firebase$sk=${params.sk}$ss=${params.ss}$rounds=${params.rounds}$mem_cost=${params.mem_cost}$${u.salt}$${u.passwordHash}`
  }));

fs.writeFileSync('workos_passwords.json', JSON.stringify(converted, null, 2));
```

Run conversion:

```bash
# Set Firebase parameters from console
export FIREBASE_SIGNER_KEY="your_base64_signer_key"
export FIREBASE_SALT_SEPARATOR="your_base64_salt_separator"
export FIREBASE_ROUNDS="8"
export FIREBASE_MEM_COST="14"

node convert-firebase-hashes.js

# Verify output format
head -20 workos_passwords.json
```

### 3.4: Import to WorkOS

Use WorkOS User Creation API with `password_hash` field:

```bash
# Example: Import single user with password hash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password_hash": "$scrypt-firebase$sk=...$ss=...$rounds=8$mem_cost=14$salt$hash"
  }'
```

**Batch import:** See WorkOS User Management API docs for bulk operations. Process `workos_passwords.json` in batches of 100.

**Verify:** Test login with migrated user credentials before bulk import.

## Step 4: Social Auth Provider Migration

### 4.1: Identify OAuth Providers

From Step 2 analysis, identify OAuth providers in use (google.com, microsoft.com, etc.)

### 4.2: Extract OAuth Credentials from Firebase

Firebase Console → Authentication → Sign-in method → [Provider]

For each OAuth provider, retrieve:
- Client ID
- Client Secret

**Critical:** Use the SAME credentials in WorkOS. Do NOT regenerate — this breaks existing user sessions.

### 4.3: Configure in WorkOS

WorkOS Dashboard → Authentication → Connections → Add Connection

**Google OAuth:**
- Connection type: Google OAuth
- Client ID: (from Firebase)
- Client Secret: (from Firebase)
- Redirect URI: `https://api.workos.com/sso/oauth/google/callback`

**Microsoft OAuth:**
- Connection type: Microsoft OAuth  
- Client ID: (from Firebase)
- Client Secret: (from Firebase)
- Redirect URI: `https://api.workos.com/sso/oauth/microsoft/callback`

**Verify:** Test OAuth flow with a Firebase user account before migration.

### 4.4: Update OAuth Redirect URIs

**CRITICAL:** Update redirect URIs in provider consoles (Google Cloud Console, Azure Portal, etc.)

Add WorkOS callback URL:
- Google: `https://api.workos.com/sso/oauth/google/callback`
- Microsoft: `https://api.workos.com/sso/oauth/microsoft/callback`

**Do NOT remove Firebase redirect URIs** until migration is complete and verified.

## Step 5: Email Link → Magic Auth Migration

If Firebase Email Link is in use (passwordless authentication):

### 5.1: Enable Magic Auth in WorkOS

WorkOS Dashboard → Authentication → Magic Auth → Enable

Configure:
- Email template (customize or use default)
- Link expiration (default: 10 minutes)

### 5.2: Update Application Code

Replace Firebase `sendSignInLinkToEmail` with WorkOS Magic Auth:

**Before (Firebase):**
```typescript
import { sendSignInLinkToEmail } from 'firebase/auth';
await sendSignInLinkToEmail(auth, email, actionCodeSettings);
```

**After (WorkOS):**
```typescript
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);

await workos.userManagement.sendMagicAuthCode({
  email: email
});
```

**Verify:** WebFetch `https://workos.com/docs/reference/authkit/magic-auth` for exact API usage.

## Step 6: OIDC/SAML Enterprise Connection Migration

### 6.1: Export OIDC/SAML Configurations from Firebase

Firebase Console → Authentication → Sign-in method → SAML/OIDC providers

For each enterprise connection, document:
- Provider name
- SSO URL / Issuer URL
- Entity ID
- X.509 Certificate (for SAML)
- Client ID / Client Secret (for OIDC)

### 6.2: Recreate in WorkOS

WorkOS Dashboard → Connections → Add Connection

**SAML:**
- Connection type: SAML
- Identity Provider SSO URL: (from Firebase)
- X.509 Certificate: (from Firebase)
- Entity ID: (from Firebase or generate new)

**OIDC:**
- Connection type: Generic OIDC
- Issuer URL: (from Firebase)
- Client ID: (from Firebase)
- Client Secret: (from Firebase)

**Verify:** Test SSO flow with enterprise user before migrating production traffic.

### 6.3: Update Service Provider Metadata

Provide updated metadata to enterprise customer's IT team:

- WorkOS Entity ID: (from WorkOS Dashboard)
- WorkOS ACS URL: `https://api.workos.com/sso/saml/acs/{organization_id}`
- WorkOS Login URL: `https://api.workos.com/sso/authorize`

**Coordination required:** Schedule cutover window with customer to update IdP configuration.

## Step 7: User Data Migration

### 7.1: Map Firebase User Fields to WorkOS

```
Firebase field          --> WorkOS field
uid                     --> external_id (optional)
email                   --> email
emailVerified           --> email_verified
displayName             --> first_name + last_name (split)
photoURL                --> profile_picture_url
phoneNumber             --> (custom attribute)
metadata.creationTime   --> (audit log)
```

### 7.2: Bulk User Import

Create import script using WorkOS User Management API:

```javascript
// import-users.js
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const firebaseUsers = require('./firebase_users.json');

async function importUser(firebaseUser) {
  const [firstName, ...lastNameParts] = (firebaseUser.displayName || '').split(' ');
  
  return await workos.userManagement.createUser({
    email: firebaseUser.email,
    emailVerified: firebaseUser.emailVerified,
    firstName: firstName,
    lastName: lastNameParts.join(' '),
    // Include password_hash if from Step 3.4
  });
}

// Process in batches
async function main() {
  for (const user of firebaseUsers.users) {
    try {
      await importUser(user);
      console.log(`Imported: ${user.email}`);
    } catch (error) {
      console.error(`Failed: ${user.email}`, error.message);
    }
  }
}

main();
```

**Rate limiting:** Process max 10 users/second to avoid API throttling.

## Verification Checklist (ALL MUST PASS)

Run these checks before cutting over production traffic:

```bash
# 1. Verify WorkOS API key is set
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS: API key valid" || echo "FAIL: API key missing or invalid"

# 2. Test password login (if passwords migrated)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}' \
  | jq -r '.user.id' || echo "FAIL: Password auth"

# 3. Verify OAuth connections configured
curl https://api.workos.com/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | {type: .connection_type, name: .name}'

# 4. Check user count matches Firebase export
WORKOS_COUNT=$(curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
FIREBASE_COUNT=$(cat firebase_users.json | jq '.users | length')
echo "Firebase: $FIREBASE_COUNT, WorkOS: $WORKOS_COUNT"

# 5. Test Magic Auth (if applicable)
curl -X POST https://api.workos.com/user_management/magic_auth/send \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' \
  && echo "PASS: Magic Auth" || echo "FAIL: Magic Auth"
```

**All checks must pass** before proceeding to Step 8.

## Step 8: Application Code Migration

### 8.1: Replace Firebase SDK Imports

**Before:**
```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
```

**After:**
```typescript
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### 8.2: Update Authentication Flows

See related skill `workos-authkit-nextjs` for complete integration guide.

**Critical:** Update ALL authentication flows:
- Login
- Signup  
- Password reset
- OAuth redirects
- Session management

### 8.3: Update Security Rules

Firebase Security Rules → WorkOS Roles & Permissions

Map Firebase custom claims to WorkOS organizations and roles:

```
Firebase custom claim    --> WorkOS concept
customClaims.role        --> User role in organization
customClaims.orgId       --> Organization membership
```

**Verify:** WebFetch `https://workos.com/docs/user-management/authorization` for authorization patterns.

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC hash string malformed or Firebase parameters incorrect.

**Fix:**
1. Verify Firebase parameters match console exactly (copy-paste, no manual transcription)
2. Check PHC format: `$scrypt-firebase$sk={key}$ss={separator}$rounds={rounds}$mem_cost={cost}${salt}${hash}`
3. Ensure no line breaks or whitespace in hash string
4. Test with single user before bulk import

### "OAuth connection failed" during provider test

**Root cause:** Client credentials mismatch or redirect URI not updated in provider console.

**Fix:**
1. Verify Client ID/Secret copied EXACTLY from Firebase (trailing spaces cause failures)
2. Check provider console (Google Cloud, Azure) has WorkOS callback URL added
3. Ensure callback URL format exact: `https://api.workos.com/sso/oauth/{provider}/callback`
4. Wait 5 minutes after updating redirect URIs (DNS/cache propagation)

### "User already exists" during import

**Root cause:** Duplicate email or previous partial import.

**Fix:**
1. Check if user already in WorkOS: `curl https://api.workos.com/user_management/users?email={email}`
2. Use Update User API instead of Create User for duplicates
3. Track imported UIDs to resume failed batch imports

### Firebase users cannot log in after migration

**Root cause:** Password hash conversion error or OAuth provider misconfiguration.

**Fix:**
1. For password users: Test hash format with known-good credentials first
2. For OAuth users: Verify provider credentials identical to Firebase (regenerating breaks sessions)
3. Check WorkOS Dashboard → Users → [user] → Authentication Methods shows expected method
4. Review WorkOS API logs for specific auth failure reasons

### SAML/OIDC enterprise connection fails

**Root cause:** Service Provider metadata not updated at Identity Provider.

**Fix:**
1. Confirm IT team updated IdP with WorkOS Entity ID and ACS URL
2. Check certificate expiration (SAML)
3. Verify Issuer URL exact match (OIDC)
4. Test with WorkOS Dashboard → Connections → Test Connection before user migration

## Related Skills

- `workos-authkit-nextjs` - Complete Next.js integration after migration
- `workos-user-management` - User CRUD operations and role management
- `workos-organizations` - Multi-tenant setup for migrated users
