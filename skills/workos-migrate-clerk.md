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

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env.local` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist and are non-empty before proceeding.

### WorkOS SDK Installation

```bash
# Check SDK is installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

If not installed, run: `npm install @workos-inc/node` (or yarn/pnpm equivalent)

## Step 3: Password Export Decision Tree (CRITICAL)

```
Do users sign in with passwords?
  |
  +-- YES --> Proceed to Step 3A (export required)
  |
  +-- NO  --> Skip to Step 4 (no password export needed)
```

### Step 3A: Export Passwords from Clerk

**CRITICAL:** Clerk does not expose plaintext passwords. You MUST use the Clerk Backend API to export password hashes.

**Action:** Use Clerk's [user export API](https://clerk.com/changelog/2024-10-23-export-users) to generate CSV with password digests.

**Expected output:** CSV file containing:

- `email_addresses` column
- `first_name` column
- `last_name` column
- `password_digest` column (bcrypt hashes)

**Verification:** Confirm CSV contains `password_digest` column with bcrypt-format hashes (start with `$2a$` or `$2b$`).

## Step 4: User Import Strategy (Decision Tree)

```
Choose import method:
  |
  +-- (A) WorkOS migration tool (recommended for bulk imports)
  |       └─> Go to Step 5A
  |
  +-- (B) Custom script with WorkOS APIs (for custom logic)
          └─> Go to Step 5B
```

## Step 5A: Using WorkOS Migration Tool

**Repository:** `https://github.com/workos/migrate-clerk-users`

**Action:**

1. Clone repository
2. Configure with your WorkOS API key
3. Point to Clerk export CSV
4. Run migration script

**Verification:**

```bash
# Check users were created
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
```

Expected: User count matches CSV row count.

## Step 5B: Using WorkOS APIs (Custom Import)

### Rate Limit Awareness

**CRITICAL:** User creation is rate-limited. Check https://workos.com/docs/reference/rate-limits for current limits.

For bulk imports, add rate limit handling (e.g., exponential backoff).

### Field Mapping

Map Clerk CSV columns to WorkOS User API parameters:

| Clerk CSV Column  | WorkOS API Parameter |
| ----------------- | -------------------- |
| `email_addresses` | `email`              |
| `first_name`      | `first_name`         |
| `last_name`       | `last_name`          |
| `password_digest` | `password_hash`      |

### Handle Multiple Email Addresses

**Problem:** Clerk exports multiple emails pipe-separated: `john@example.com|john.doe@example.com`

**Solution (Decision Tree):**

```
Multiple emails detected (contains '|')?
  |
  +-- YES --> Split on '|', determine primary email
  |           |
  |           +-- Option 1: Fetch User from Clerk API to get primary
  |           +-- Option 2: Use first email as primary (risky - ask user)
  |
  +-- NO  --> Use email directly
```

**Clerk API endpoint for primary email:** `GET /v1/users/{user_id}` returns `primary_email_address_id`.

### Import Script Structure

```javascript
// Pseudocode - adapt to your language/SDK
const workos = new WorkOS(process.env.WORKOS_API_KEY);

for (const row of clerkExport) {
  // Parse email (handle multiple)
  const email = parseEmail(row.email_addresses);

  // Prepare user data
  const userData = {
    email: email,
    first_name: row.first_name,
    last_name: row.last_name,
  };

  // Add password hash if present
  if (row.password_digest) {
    userData.password_hash = row.password_digest;
    userData.password_hash_type = "bcrypt";
  }

  // Create user
  try {
    await workos.userManagement.createUser(userData);
  } catch (error) {
    // Log error, implement retry logic
  }

  // Rate limit handling
  await sleep(rateLimitDelay);
}
```

**Password import parameters (REQUIRED for password users):**

- `password_hash_type`: Set to `'bcrypt'` (Clerk's algorithm)
- `password_hash`: Value from `password_digest` column

**Verification:**

```bash
# Check a sample user was created with password
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data[0] | {email, has_password}'
```

Expected: `has_password: true` for users with imported hashes.

## Step 6: Social Auth Users (OAuth Migration)

**Key Insight:** Social auth users require NO special migration. They auto-link on first sign-in via email match.

### Configure OAuth Providers in WorkOS

**Action:** For each OAuth provider your users use (Google, Microsoft, GitHub, etc.):

1. Go to WorkOS Dashboard → Integrations
2. Configure provider client credentials (see [integrations page](https://workos.com/docs/integrations))
3. Enable provider for your environment

**Common providers:**

- [Google OAuth](https://workos.com/docs/integrations/google-oauth)
- [Microsoft OAuth](https://workos.com/docs/integrations/microsoft-oauth)

### Auto-Linking Mechanism

**How it works:** When a user signs in with OAuth:

1. WorkOS receives email from provider (e.g., `user@example.com`)
2. WorkOS searches for existing user with that email
3. If found, links OAuth identity to existing user
4. User can now sign in with either password OR OAuth

**No action required** — linking is automatic.

**Verification:**

```bash
# After a social auth user signs in, check they have both identities
curl -X GET "https://api.workos.com/user_management/users/{user_id}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.identity_provider'
```

Expected: Shows both `password` and OAuth provider (e.g., `google`).

## Step 7: Organizations Export (Optional)

```
Do you use Clerk Organizations?
  |
  +-- YES --> Proceed to Step 7A
  |
  +-- NO  --> Skip to Step 8
```

### Step 7A: Export Organizations from Clerk

**Clerk API:** Use [Backend SDK](https://clerk.com/docs/references/backend/organization/get-organization-list) to paginate organizations.

**Expected data per organization:**

- Organization ID (for membership lookups)
- Organization name
- Organization metadata (optional)

### Step 7B: Create Organizations in WorkOS

```javascript
// Pseudocode
const workos = new WorkOS(process.env.WORKOS_API_KEY);

for (const clerkOrg of clerkOrganizations) {
  const workosOrg = await workos.organizations.createOrganization({
    name: clerkOrg.name,
    // Map other fields as needed
  });

  // Store mapping: clerkOrg.id -> workosOrg.id (for memberships)
  orgIdMap[clerkOrg.id] = workosOrg.id;
}
```

**Verification:**

```bash
# Check organizations were created
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
```

### Step 7C: Import Organization Memberships

**Clerk API:** Use [Backend SDK](https://clerk.com/docs/references/backend/organization/get-organization-membership-list) to get memberships per organization.

```javascript
// Pseudocode
for (const clerkOrgId of clerkOrganizationIds) {
  const memberships = await clerkSDK.getOrganizationMemberships(clerkOrgId);

  for (const membership of memberships) {
    const workosOrgId = orgIdMap[clerkOrgId];
    const workosUserId = userIdMap[membership.userId]; // from Step 5

    await workos.userManagement.createOrganizationMembership({
      organization_id: workosOrgId,
      user_id: workosUserId,
      // role_slug if applicable
    });
  }
}
```

**Verification:**

```bash
# Check memberships for a sample organization
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id={org_id}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
```

## Step 8: MFA Migration (IMPORTANT LIMITATION)

**CRITICAL:** Clerk SMS-based MFA is NOT supported by WorkOS (security reasons).

### Decision Tree for MFA Users

```
Clerk user has MFA enabled?
  |
  +-- SMS-based --> User MUST re-enroll (no migration path)
  |                 └─> Options:
  |                     • Switch to Email Magic Auth
  |                     • Re-enroll with TOTP authenticator
  |
  +-- TOTP-based --> User MUST re-enroll (secrets not exportable)
                     └─> User re-scans QR code in new app
```

**Communication Plan (REQUIRED):**

1. Identify users with MFA enabled in Clerk
2. Email them before migration with re-enrollment instructions
3. Link to WorkOS MFA guide: https://workos.com/docs/authkit/mfa

**Post-migration:** Users will be prompted to re-enroll in MFA on first sign-in.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration success:

```bash
# 1. Check users imported
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
# Expected: Non-zero, matches Clerk user count

# 2. Check sample user has password (if applicable)
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data[0].has_password'
# Expected: true (if passwords were imported)

# 3. Check organizations imported (if applicable)
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
# Expected: Non-zero, matches Clerk org count

# 4. Check sample organization has memberships
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id={sample_org_id}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data | length'
# Expected: Non-zero

# 5. Check OAuth provider configured (if applicable)
# Manual: Visit WorkOS Dashboard → Integrations → [Provider]
# Expected: Provider shows "Connected" status

# 6. Test login with sample user
# Manual: Attempt sign-in with migrated user credentials
# Expected: Successful authentication
```

## Error Recovery

### "Rate limit exceeded" during import

**Root cause:** Bulk user creation hitting API rate limits.

**Fix:**

1. Add exponential backoff to import script
2. Batch imports with delays between batches
3. Check current rate limits: https://workos.com/docs/reference/rate-limits

### "Invalid password hash" error

**Root cause:** Incorrect `password_hash_type` parameter or malformed hash.

**Fix:**

1. Verify `password_hash_type` is set to `'bcrypt'` (Clerk's algorithm)
2. Verify hashes start with `$2a$` or `$2b$` (bcrypt format)
3. Check for empty/null `password_digest` values in export

### Social auth user cannot sign in after migration

**Root cause:** OAuth provider not configured in WorkOS.

**Fix:**

1. Go to WorkOS Dashboard → Integrations
2. Configure missing provider (Google, Microsoft, etc.)
3. Verify redirect URIs match your application

### User email mismatch (multiple emails case)

**Root cause:** Wrong email chosen as primary during import.

**Fix:**

1. Fetch correct primary email from Clerk API: `GET /v1/users/{user_id}`
2. Update user in WorkOS: `PATCH /user_management/users/{user_id}` with correct email

### Organization memberships missing

**Root cause:** User ID mapping lost between user import and membership import.

**Fix:**

1. Rebuild user ID map: Clerk User ID → WorkOS User ID
2. Re-run membership import with correct mapping
3. Store mapping persistently during user import phase

### MFA users locked out

**Root cause:** SMS MFA not supported, users didn't re-enroll.

**Fix:**

1. Temporarily disable MFA requirement in WorkOS Dashboard (if applicable)
2. Contact affected users with re-enrollment instructions
3. Link to MFA guide: https://workos.com/docs/authkit/mfa

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit in Next.js after migration
- workos-authkit-react - Integrate AuthKit in React apps after migration
- workos-directory-sync.rules.yml - Set up Directory Sync for organizations
