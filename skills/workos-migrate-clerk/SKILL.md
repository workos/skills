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

### WorkOS Configuration

- Confirm WorkOS account exists
- Confirm `WORKOS_API_KEY` available (starts with `sk_`)
- Confirm `WORKOS_CLIENT_ID` available (starts with `client_`)
- Check WorkOS Dashboard access at https://dashboard.workos.com

### Clerk Export Access

Determine export method based on your requirements:

```
Need password hashes?
  |
  +-- YES --> Use Clerk Backend API (CSV export)
  |           WebFetch: https://clerk.com/changelog/2024-10-23-export-users
  |
  +-- NO  --> Use Clerk Backend SDK (JSON export)
              WebFetch: https://clerk.com/docs/deployments/exporting-users
```

**Note:** Clerk does NOT provide plaintext passwords. Only bcrypt hashes are exportable.

## Step 3: Export User Data from Clerk

### Decision Tree: Export Method

```
Export method?
  |
  +-- Clerk Backend API --> CSV with password hashes
  |                        (for password migration)
  |
  +-- Clerk Backend SDK  --> JSON without passwords
  |                        (for email/name only)
  |
  +-- Clerk Support      --> Contact for bulk export
                           (large datasets)
```

### Export Fields Mapping

When exporting, ensure these Clerk fields are included:

- `email_addresses` (required) → WorkOS `email`
- `first_name` (optional) → WorkOS `first_name`
- `last_name` (optional) → WorkOS `last_name`
- `password_digest` (if using password auth) → WorkOS `password_hash`

### Handle Multiple Email Addresses (IMPORTANT)

Clerk exports multi-email users as pipe-separated strings:

```json
"email_addresses": "john@example.com|john.doe@example.com"
```

**Problem:** Export does not indicate primary email.

**Solution:** Use Clerk API to fetch User object and identify primary email:

WebFetch: `https://clerk.com/docs/references/javascript/user/user#properties`

Parse primary email field before import.

## Step 4: Import Users into WorkOS

### Decision Tree: Import Method

```
Import method?
  |
  +-- WorkOS Migration Tool --> Use GitHub repo (automated)
  |                            https://github.com/workos/migrate-clerk-users
  |
  +-- Custom Script        --> Use WorkOS API directly (manual control)
```

### Option A: Using WorkOS Migration Tool

1. Clone repository: `git clone https://github.com/workos/migrate-clerk-users`
2. Configure environment variables per repo README
3. Run import script according to repo instructions

**Verify:** Check WorkOS Dashboard for imported users before proceeding.

### Option B: Using WorkOS API (Custom Script)

**CRITICAL:** WorkOS user creation is rate-limited. Check rate limits before bulk import:

WebFetch: `https://workos.com/docs/reference/rate-limits`

**API Reference:** https://workos.com/docs/reference/authkit/user/create

#### Basic User Import (No Passwords)

For each user in Clerk export:

1. Parse email (handle pipe-separated if multiple)
2. Call WorkOS Create User API with:
   - `email` (required)
   - `first_name` (optional)
   - `last_name` (optional)
3. Store Clerk user ID → WorkOS user ID mapping for later steps

#### Password Import (If Exported)

**CRITICAL:** Clerk uses bcrypt. WorkOS supports bcrypt import.

For users with password hashes, include in Create User call:

- `password_hash_type: 'bcrypt'`
- `password_hash: <value from Clerk's password_digest field>`

**Alternative:** Import passwords after user creation using Update User API:

WebFetch: `https://workos.com/docs/reference/authkit/user/update`

## Step 5: Migrate Social Auth Users

**IMPORTANT:** Social auth users automatically link by email. No manual linking required.

### Provider Configuration

For each OAuth provider used in Clerk (Google, Microsoft, etc.):

1. Navigate to WorkOS Dashboard → Integrations
2. Configure provider client credentials
3. Enable provider for your environment

**Reference:** https://workos.com/docs/integrations

**Supported providers (check docs for full list):**

- Google: https://workos.com/docs/integrations/google-oauth
- Microsoft: https://workos.com/docs/integrations/microsoft-oauth

### Auto-Linking Behavior

When a user signs in via social auth:

1. WorkOS extracts email from OAuth provider
2. WorkOS matches email to existing user
3. User is automatically linked (no code required)

**Verify auto-linking:** Have a test user sign in via OAuth provider after import.

## Step 6: Migrate Organizations

Clerk organizations map 1:1 to WorkOS organizations.

### Export Organizations from Clerk

Use Clerk Backend SDK to paginate through organizations:

WebFetch: `https://clerk.com/docs/references/backend/organization/get-organization-list`

### Create Organizations in WorkOS

For each Clerk organization:

1. Call WorkOS Create Organization API
2. Map Clerk org ID to WorkOS org ID
3. Store mapping for membership import

**API Reference:** https://workos.com/docs/reference/organization/create

### Import Organization Memberships

**CRITICAL:** Complete user import (Step 4) before memberships.

Use Clerk Backend SDK to export memberships:

WebFetch: `https://clerk.com/docs/references/backend/organization/get-organization-membership-list`

For each membership:

1. Look up WorkOS user ID from Clerk user ID (from Step 4 mapping)
2. Look up WorkOS org ID from Clerk org ID (from mapping above)
3. Call WorkOS Create Organization Membership API

**API Reference:** https://workos.com/docs/reference/authkit/organization-membership/create

## Step 7: Multi-Factor Auth Migration

**BREAKING CHANGE:** WorkOS does NOT support SMS-based MFA (security reasons).

### Migration Strategy by MFA Type

```
User's current MFA?
  |
  +-- SMS-based       --> User must re-enroll with TOTP or Email Magic Auth
  |                       (no automatic migration possible)
  |
  +-- TOTP-based      --> User must re-enroll with WorkOS TOTP
  |                       (authenticator apps are not transferable)
  |
  +-- None            --> No action needed
```

**Guidance for users:** https://workos.com/docs/authkit/mfa

### User Communication (REQUIRED)

**Before go-live**, notify users with SMS or TOTP MFA:

1. MFA will be reset during migration
2. Users must re-enroll after first login
3. Provide MFA setup instructions

## Verification Checklist (ALL MUST PASS)

Run these commands/checks to confirm migration. **Do not mark complete until all pass:**

### 1. User Import Verification

```bash
# Check WorkOS Dashboard or use API to count users
curl -u "$WORKOS_API_KEY:" \
  https://api.workos.com/user_management/users \
  | jq '.data | length'

# Compare count to Clerk export count
```

Expected: User count matches Clerk export count (within acceptable error margin).

### 2. Password Hash Verification

Log in as test user with password (if passwords were imported):

- Attempt login with known password
- Verify authentication succeeds

**If fails:** Check `password_hash_type` was set to `'bcrypt'`.

### 3. Organization Import Verification

```bash
# Check organization count
curl -u "$WORKOS_API_KEY:" \
  https://api.workos.com/organizations \
  | jq '.data | length'
```

Expected: Organization count matches Clerk export count.

### 4. Membership Verification

Pick a test organization and verify memberships:

```bash
# List members of an organization
curl -u "$WORKOS_API_KEY:" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=<org_id>" \
  | jq '.data | length'
```

Expected: Member count matches Clerk organization membership count.

### 5. Social Auth Verification

Have test user sign in via OAuth provider:

- User should auto-link to existing WorkOS user (no duplicate created)
- User should NOT be prompted to create new account

**If fails:** Check provider is configured in WorkOS Dashboard → Integrations.

## Error Recovery

### "Rate limit exceeded" during bulk import

**Root cause:** WorkOS Create User API has rate limits (see docs).

**Fix:**

1. Check rate limit documentation: https://workos.com/docs/reference/rate-limits
2. Add delays between API calls (e.g., 100ms per request)
3. Implement exponential backoff on 429 responses
4. Consider batching import over multiple hours/days

### "Email already exists" during user import

**Root cause:** User was already imported or email conflict.

**Fix:**

1. Check if user exists in WorkOS before creating
2. Use Update User API instead of Create User
3. Log conflicts for manual review

### Social auth user creates duplicate account

**Root cause:** Email mismatch between Clerk and OAuth provider.

**Fix:**

1. Verify email in WorkOS matches OAuth provider email exactly
2. Check OAuth provider returns email in token (some require scope configuration)
3. Manually merge duplicate accounts if created

### Password login fails after import

**Root cause 1:** `password_hash_type` not set to `'bcrypt'`.

**Fix:** Update user with correct hash type:

```bash
curl -X PATCH https://api.workos.com/user_management/users/<user_id> \
  -u "$WORKOS_API_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"password_hash_type": "bcrypt", "password_hash": "<hash>"}'
```

**Root cause 2:** Password hash corrupted during export/import.

**Fix:** Re-export from Clerk and verify hash format matches bcrypt specification.

### Organization membership creation fails

**Root cause:** User or organization does not exist in WorkOS.

**Fix:**

1. Verify user was successfully imported (check user ID exists)
2. Verify organization was successfully created (check org ID exists)
3. Ensure Step 4 and Step 6 completed before Step 6 memberships

### "Invalid API key" errors

**Root cause:** Using Clerk API key instead of WorkOS API key.

**Fix:**

1. Verify `WORKOS_API_KEY` starts with `sk_` (not Clerk's format)
2. Check API key in WorkOS Dashboard → API Keys
3. Ensure API key has User Management permissions

## Post-Migration Tasks

After verification checklist passes:

1. **Update application code** to use WorkOS SDK instead of Clerk SDK
2. **Configure WorkOS AuthKit** in your application (see related skill: `workos-authkit-nextjs`)
3. **Test end-to-end auth flows** in staging environment
4. **Notify users** about MFA re-enrollment requirements
5. **Monitor WorkOS Dashboard** for authentication errors during rollout

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS authentication in Next.js after migration
- `workos-user-management` - Manage users programmatically after migration
