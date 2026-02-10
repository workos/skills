---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### User Data Inventory

Create a spreadsheet or document listing:

1. **Authentication methods in use:**
   - Username/password users (count)
   - Social OAuth providers (Google, Facebook, etc.) — list each
   - SAML SSO connections (if any)
   - MFA-enabled users (count)

2. **User attributes to migrate:**
   - Required: email, email_verified status
   - Optional: name, profile data, custom attributes
   - Groups/roles (map to WorkOS Organizations)

3. **Password hash accessibility:**
   - **CRITICAL:** AWS Cognito does NOT export password hashes for security reasons
   - Users will need to reset passwords after migration
   - Plan user communication strategy (see Step 6)

### Cognito Export Limitations

```
Can you export password hashes from Cognito?
  |
  +-- NO --> Users MUST reset passwords
            (Cognito security policy)
  
Can you export user attributes?
  |
  +-- YES --> Use AWS CLI: aws cognito-idp list-users
  |
  +-- Programmatic --> Use AWS SDK for bulk export
```

**Important:** WorkOS CAN import password hashes from other systems (bcrypt, scrypt, etc.), but AWS Cognito does not provide this data during export. This is a Cognito limitation, not a WorkOS limitation.

## Step 3: Export Users from Cognito

### Option A: AWS CLI (Small user bases <1000)

```bash
# List all users in a user pool
aws cognito-idp list-users \
  --user-pool-id us-east-1_XXXXXX \
  --region us-east-1 \
  > cognito_users.json

# Verify export
jq 'length' cognito_users.json
```

### Option B: Programmatic Export (Large user bases)

Create export script using AWS SDK:

```javascript
// export-cognito-users.js
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const userPoolId = 'us-east-1_XXXXXX';

async function exportUsers() {
  let users = [];
  let paginationToken = null;
  
  do {
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      PaginationToken: paginationToken,
      Limit: 60 // Max per page
    });
    
    const response = await client.send(command);
    users = users.concat(response.Users);
    paginationToken = response.PaginationToken;
  } while (paginationToken);
  
  return users;
}
```

**Verify:** Exported user count matches Cognito dashboard count.

## Step 4: Transform User Data for WorkOS

Map Cognito user attributes to WorkOS format:

```javascript
// transform-users.js
function transformCognitoUser(cognitoUser) {
  const email = cognitoUser.Attributes.find(a => a.Name === 'email')?.Value;
  const emailVerified = cognitoUser.Attributes.find(a => a.Name === 'email_verified')?.Value === 'true';
  const firstName = cognitoUser.Attributes.find(a => a.Name === 'given_name')?.Value;
  const lastName = cognitoUser.Attributes.find(a => a.Name === 'family_name')?.Value;
  
  return {
    email,
    email_verified: emailVerified,
    first_name: firstName,
    last_name: lastName,
    // WorkOS will generate new password - users must reset
  };
}
```

**Critical mapping:**
- `email` (required) → WorkOS `email`
- `email_verified` → WorkOS `email_verified` (bool)
- `given_name`, `family_name` → WorkOS `first_name`, `last_name`
- **Password hashes:** NOT available from Cognito export

## Step 5: Import Users to WorkOS

### Create Users via API

Use WorkOS User Management API to create users:

```javascript
// import-to-workos.js
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(userData) {
  try {
    const user = await workos.userManagement.createUser({
      email: userData.email,
      emailVerified: userData.email_verified,
      firstName: userData.first_name,
      lastName: userData.last_name,
    });
    
    console.log(`Imported: ${user.email}`);
    return user;
  } catch (error) {
    console.error(`Failed to import ${userData.email}:`, error.message);
    return null;
  }
}
```

**Rate limiting:** WorkOS API has rate limits. Add delays between requests:

```javascript
// Batch import with rate limiting
async function batchImport(users, delayMs = 100) {
  for (const user of users) {
    await importUser(user);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

**Verify:** Check WorkOS Dashboard user count matches import count.

## Step 6: Password Reset Strategy (REQUIRED)

Since Cognito does not export password hashes, choose a reset strategy:

```
Password Reset Strategy?
  |
  +-- Immediate (Proactive)
  |   |
  |   +-> Send password reset emails to ALL users
  |   +-> Use WorkOS Send Password Reset Email API
  |   +-> Users receive email before attempting login
  |
  +-- On-Demand (Reactive)
      |
      +-> User attempts login with old password
      +-> Login fails (expected)
      +-> Show "Reset your password" message
      +-> Trigger password reset flow
```

### Proactive Password Reset (Recommended)

Send reset emails immediately after import:

```javascript
// send-reset-emails.js
async function sendPasswordResetEmail(email) {
  try {
    await workos.userManagement.sendPasswordResetEmail({
      email,
      passwordResetUrl: 'https://yourapp.com/reset-password', // Your callback URL
    });
    console.log(`Sent password reset to: ${email}`);
  } catch (error) {
    console.error(`Failed to send reset email to ${email}:`, error.message);
  }
}

// Send to all imported users
for (const user of importedUsers) {
  await sendPasswordResetEmail(user.email);
  await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
}
```

**User Communication Template:**

```
Subject: Action Required: Reset Your Password

We've upgraded our authentication system to improve security.

Please reset your password by clicking the link below:
[Reset Password Link]

This is a one-time setup. After resetting, you can sign in normally.
```

### Reactive Password Reset

In your login error handler:

```javascript
// login-handler.js
try {
  const { user } = await workos.userManagement.authenticateWithPassword({
    email,
    password,
    clientId: process.env.WORKOS_CLIENT_ID,
  });
} catch (error) {
  if (error.code === 'invalid_credentials') {
    // Show user-friendly message
    return {
      error: 'Please reset your password',
      resetUrl: await generatePasswordResetUrl(email),
    };
  }
}
```

## Step 7: Migrate OAuth Social Logins (If Applicable)

### Reuse Existing OAuth Credentials

If you have Google, Facebook, or other OAuth providers configured in Cognito:

1. **Copy OAuth credentials:**
   - Client ID from Cognito
   - Client Secret from Cognito

2. **Configure in WorkOS Dashboard:**
   - Navigate to Authentication → Social Connections
   - Add connection (e.g., Google OAuth)
   - Use SAME Client ID and Client Secret

3. **Add WorkOS Redirect URI to OAuth provider:**
   ```
   https://api.workos.com/sso/oauth/google/callback
   ```
   
   For Google specifically, see [Google OAuth integration guide](https://workos.com/docs/integrations/google-oauth) for detailed steps.

**Critical:** Using the same OAuth credentials means users' existing social login connections remain valid — no re-authorization needed.

### Verification for Social Logins

Test each provider:

```bash
# Attempt social login with migrated user
# Should succeed without re-authorization if credentials match
```

## Step 8: Migrate Organizations and Group Memberships

If using Cognito Groups for access control:

```javascript
// Map Cognito Groups to WorkOS Organizations
const groupToOrgMapping = {
  'cognito-group-admins': 'org_admin_team',
  'cognito-group-users': 'org_general_users',
};

async function migrateGroupMembership(cognitoUser, workosUser) {
  const groups = cognitoUser.Groups || [];
  
  for (const group of groups) {
    const orgId = groupToOrgMapping[group.GroupName];
    if (orgId) {
      await workos.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId: workosUser.id,
      });
    }
  }
}
```

## Step 9: Update Application Code

### Replace Cognito SDK Calls

```
Old Cognito Pattern              --> New WorkOS Pattern
-------------------------           ---------------------
CognitoUser.authenticateUser()  --> workos.userManagement.authenticateWithPassword()
CognitoUser.signOut()            --> workos.userManagement.revokeSession()
CognitoUser.getSession()         --> workos.userManagement.getUser() / withAuth()
```

### Environment Variables

Update your `.env` file:

```bash
# Remove Cognito vars
# AWS_COGNITO_USER_POOL_ID=...
# AWS_COGNITO_CLIENT_ID=...

# Add WorkOS vars
WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://yourapp.com/auth/callback
```

### Framework-Specific Integration

After user migration, integrate WorkOS AuthKit for your framework:

- **Next.js:** Reference skill `workos-authkit-nextjs`
- **React (SPA):** Reference skill `workos-authkit-react`
- **Vanilla JS:** Reference skill `workos-authkit-vanilla-js`

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm successful migration:

```bash
# 1. Verify user count matches
# Cognito count
aws cognito-idp list-users --user-pool-id us-east-1_XXXXX | jq '.Users | length'

# WorkOS count (check Dashboard or API)
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 2. Test password reset flow
# Attempt login with old password (should fail)
# Request password reset (should receive email)
# Complete reset (should succeed)

# 3. Test social login (if applicable)
# Login with Google/Facebook (should work without re-auth)

# 4. Verify organization memberships migrated
# Check user has correct roles in WorkOS Dashboard

# 5. Test authentication in application
npm run build && npm start
# Attempt login with NEW password (should succeed)
```

**If check #1 fails:** Review import logs for errors. Check API rate limiting.

**If check #2 fails:** Verify `passwordResetUrl` in API call matches your app's reset route.

**If check #3 fails:** Confirm OAuth credentials match exactly between Cognito and WorkOS. Check redirect URI is whitelisted.

**If check #4 fails:** Review group-to-organization mapping logic.

**If check #5 fails:** Check environment variables are loaded. Verify SDK method signatures.

## Error Recovery

### "Email already exists" during import

**Root cause:** User was already imported, or email conflicts with existing WorkOS user.

**Fix:**
```javascript
// Add duplicate check
const existingUser = await workos.userManagement.getUser({ email });
if (existingUser) {
  console.log(`Skipping duplicate: ${email}`);
  return existingUser;
}
```

### "Invalid email format"

**Root cause:** Cognito allowed emails that WorkOS validation rejects (e.g., missing TLD).

**Fix:**
```javascript
// Validate before import
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

if (!isValidEmail(userData.email)) {
  console.error(`Invalid email format: ${userData.email}`);
  return null; // Skip or flag for manual review
}
```

### "Rate limit exceeded"

**Root cause:** Importing too many users too quickly.

**Fix:**
```javascript
// Increase delay between requests
const delayMs = 200; // Was 100, now 200
await new Promise(resolve => setTimeout(resolve, delayMs));
```

### Password reset emails not received

**Root cause:** Email provider blocking, incorrect `passwordResetUrl`, or email not verified in WorkOS.

**Fix:**
1. Check spam folder
2. Verify `passwordResetUrl` is publicly accessible
3. Confirm email is marked `emailVerified: true` during import
4. Check WorkOS Dashboard → Settings → Email provider configuration

### Social login fails with "invalid_client"

**Root cause:** OAuth credentials don't match, or redirect URI not whitelisted.

**Fix:**
1. Copy exact Client ID and Secret from Cognito
2. Add WorkOS callback URL to OAuth provider's allowed redirect URIs:
   ```
   https://api.workos.com/sso/oauth/{provider}/callback
   ```
3. Wait 5-10 minutes for OAuth provider to propagate changes

### "User not found" after migration

**Root cause:** User ID references in your database still point to Cognito IDs.

**Fix:**
```javascript
// Maintain ID mapping during migration
const idMapping = {};

async function importWithMapping(cognitoUser) {
  const workosUser = await importUser(cognitoUser);
  idMapping[cognitoUser.Username] = workosUser.id;
  
  // Update your database
  await db.users.update({
    where: { cognitoId: cognitoUser.Username },
    data: { workosId: workosUser.id },
  });
}
```

## Post-Migration Cleanup

After confirming successful migration (1-2 weeks):

1. **Disable Cognito User Pool** (do not delete yet)
2. **Remove Cognito SDK** from package.json
3. **Archive Cognito export data** (for compliance/audit)
4. **Update monitoring/logging** to track WorkOS auth metrics

**Do NOT delete Cognito User Pool immediately** — keep as backup for 30-90 days in case of rollback need.

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit with Next.js after migration
- `workos-authkit-react` - Integrate WorkOS AuthKit with React SPA after migration
- `workos-authkit-vanilla-js` - Integrate WorkOS AuthKit with vanilla JavaScript
- `workos-api-authkit` - Low-level AuthKit API reference for custom implementations
- `workos-mfa` - Add multi-factor authentication after migration
- `workos-sso` - Add enterprise SSO after migration
- `workos-admin-portal` - Enable self-service admin portal for migrated organizations
