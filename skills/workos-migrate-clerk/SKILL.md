---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

```
User authentication methods?
  |
  +-- Passwords --> Step 3A: Export passwords via Clerk API
  |
  +-- Social (Google/Microsoft) --> Skip to Step 4 (auto-link by email)
  |
  +-- Mixed --> Complete both paths
```

```
Organization structure?
  |
  +-- B2B with orgs --> Step 5: Export organizations
  |
  +-- B2C (no orgs) --> Skip Step 5
```

```
MFA enabled?
  |
  +-- SMS-based --> Users MUST re-enroll (WorkOS does not support SMS)
  |
  +-- TOTP-based --> Users MUST re-enroll (cannot export secrets)
```

**Critical limitation:** Clerk TOTP secrets and SMS configurations cannot be exported. All MFA users must re-enroll after migration.

## Step 3A: Export Passwords (If Password Auth Used)

### Via Clerk Backend API

Use Clerk's [user export API](https://clerk.com/changelog/2024-10-23-export-users) to generate CSV with password hashes.

**Verify:** CSV contains `password_digest` column with bcrypt hashes before proceeding.

**Important:** Clerk does NOT export plaintext passwords. The CSV contains bcrypt hashes only.

### Field Mapping (Password Export)

```
Clerk CSV Column    --> WorkOS User Creation Field
email_addresses     --> email (primary)
first_name          --> first_name
last_name           --> last_name
password_digest     --> password_hash (with password_hash_type='bcrypt')
```

## Step 3B: Handle Multi-Email Users

Clerk exports multiple emails pipe-separated:
```
"email_addresses": "john@example.com|john.doe@example.com"
```

**Problem:** Export does NOT indicate which is primary.

**Solution:** If multiple emails detected, fetch User object via [Clerk User API](https://clerk.com/docs/references/javascript/user/user#properties) to determine primary email before WorkOS import.

## Step 4: Import Users into WorkOS

### Rate Limit Warning

User creation is rate-limited. Check https://workos.com/docs/reference/rate-limits for current limits.

**Pattern:** Batch imports with delay between batches to avoid 429 errors.

### Import Method (Choose One)

**Option A:** Use WorkOS migration tool: https://github.com/workos/migrate-clerk-users

**Option B:** Write custom import using WorkOS User Creation API

### User Creation Parameters

For each Clerk user, call [Create User API](https://workos.com/docs/reference/authkit/user/create):

**Required fields:**
- `email` - from Clerk `email_addresses` (primary only)
- `first_name` - from Clerk `first_name`
- `last_name` - from Clerk `last_name`

**Password import (if exported):**
- `password_hash_type` - MUST be `'bcrypt'` (Clerk's hash algorithm)
- `password_hash` - from Clerk `password_digest` field (the bcrypt hash)

**Example payload:**
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password_hash_type": "bcrypt",
  "password_hash": "$2a$10$..."
}
```

**Verification command:**
```bash
# Check that imported user can authenticate
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=user@example.com" \
  -d "password=<test_password>"
```

## Step 5: Migrate Social Auth Users

### Supported Providers

WorkOS supports [Google OAuth](https://workos.com/docs/integrations/google-oauth) and [Microsoft OAuth](https://workos.com/docs/integrations/microsoft-oauth). Configure providers in WorkOS Dashboard before migration.

### Auto-Linking Mechanism

**No manual action required for social auth users.** WorkOS auto-links by email:

1. User signs in with Google/Microsoft via WorkOS
2. WorkOS extracts email from OAuth provider
3. WorkOS matches email to existing user created in Step 4
4. User is linked automatically

**Critical:** Ensure users from Step 4 have correct email addresses. Mismatch = failed auto-link.

## Step 6: Create Organizations (If B2B)

### Export Clerk Organizations

Use [Clerk Organization List API](https://clerk.com/docs/references/backend/organization/get-organization-list) to paginate through organizations.

**Pattern:**
```javascript
// Pseudocode - use Clerk Backend SDK
let hasMore = true;
let offset = 0;
while (hasMore) {
  const { data, totalCount } = await clerkClient.organizations.getOrganizationList({ 
    limit: 100, 
    offset 
  });
  // Process data
  hasMore = (offset + data.length) < totalCount;
  offset += data.length;
}
```

### Create WorkOS Organizations

For each Clerk organization, call [Create Organization API](https://workos.com/docs/reference/organization/create).

**Minimum required:**
- `name` - organization display name

**Verification command:**
```bash
# List created organizations
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 7: Add Organization Memberships

### Export Clerk Memberships

Use [Clerk Membership List API](https://clerk.com/docs/references/backend/organization/get-organization-membership-list) for each organization.

### Create WorkOS Memberships

For each membership, call [Create Organization Membership API](https://workos.com/docs/reference/authkit/organization-membership/create).

**Required parameters:**
- `user_id` - WorkOS user ID (from Step 4 import mapping)
- `organization_id` - WorkOS organization ID (from Step 6 mapping)

**Critical:** Maintain mapping of Clerk user IDs → WorkOS user IDs and Clerk org IDs → WorkOS org IDs for this step.

## Step 8: Handle MFA Re-Enrollment

### SMS-Based MFA (Not Supported)

**WorkOS does NOT support SMS-based MFA due to security concerns.**

Users with SMS MFA MUST:
1. Re-enroll using TOTP authenticator app, OR
2. Use Magic Link authentication instead

Notify affected users before migration.

### TOTP-Based MFA (Cannot Migrate)

**Clerk does not export TOTP secrets.** All TOTP users must re-enroll.

**Re-enrollment flow:**
1. User signs in with password (migrated in Step 4)
2. User navigates to MFA settings
3. User scans new QR code to enroll TOTP

See [WorkOS MFA guide](https://workos.com/docs/authkit/mfa) for enrollment implementation.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking migration complete:

```bash
# 1. Verify users imported
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match Clerk user count

# 2. Test password authentication for imported user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=test@example.com" \
  -d "password=<known_password>"
# Should return 200 with user object

# 3. Verify organizations imported (if B2B)
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match Clerk organization count

# 4. Verify memberships created (if B2B)
curl "https://api.workos.com/user_management/organization_memberships?user_id=<user_id>" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
# Should return memberships for test user

# 5. Test social auth auto-link
# Sign in via Google/Microsoft with email matching imported user
# Should link to existing WorkOS user, not create duplicate
```

## Error Recovery

### "User already exists" on import

**Cause:** Duplicate email addresses in import batch or re-running import.

**Fix:** Check for existing user before creation:
```bash
curl "https://api.workos.com/user_management/users?email=user@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```
If exists, use [Update User API](https://workos.com/docs/reference/authkit/user/update) instead of Create.

### "Invalid password hash" on user creation

**Cause:** 
- `password_hash_type` not set to `'bcrypt'`
- `password_hash` field missing `$2a$` prefix (malformed bcrypt hash)

**Fix:** Verify Clerk export contains valid bcrypt hashes. They MUST start with `$2a$` or `$2b$`.

### Rate limit 429 on batch import

**Cause:** Exceeding WorkOS user creation rate limit.

**Fix:** Add delay between batches:
```javascript
// Pseudocode
for (const batch of userBatches) {
  await importBatch(batch);
  await sleep(1000); // 1 second delay between batches
}
```

Check https://workos.com/docs/reference/rate-limits for current limits and adjust delay accordingly.

### Social auth user creates duplicate instead of linking

**Cause:** Email mismatch between WorkOS user and OAuth provider email.

**Fix:** 
1. Check OAuth provider email: `curl` the OAuth token endpoint
2. Check WorkOS user email: Use Users API
3. If mismatch, update WorkOS user email via [Update User API](https://workos.com/docs/reference/authkit/user/update)

### Organization membership creation fails with "User not found"

**Cause:** Attempting to create membership before user import completes, or using wrong user ID.

**Fix:** 
1. Verify user exists: `curl` Users API with email filter
2. Ensure you're using WorkOS user ID, not Clerk user ID
3. Maintain ID mapping file: `clerk_user_id → workos_user_id`

### MFA users cannot sign in after migration

**Expected behavior.** All MFA users MUST re-enroll:
1. Disable MFA requirement temporarily in WorkOS Dashboard
2. Notify users to re-enroll via app settings
3. Re-enable MFA requirement after re-enrollment window

## Related Skills

- workos-authkit-nextjs - Integrate WorkOS AuthKit into Next.js after migration
- workos-authkit-react - Integrate WorkOS AuthKit into React after migration
- workos-mfa - Implement MFA re-enrollment flow
- workos-magic-link - Alternative to password auth for users who can't migrate
- workos-api-authkit - Core AuthKit API reference for custom integrations
- workos-api-organization - Organization management API details
- workos-sso - Configure SSO for migrated organizations
