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

Before starting migration, determine your data sources:

```
Data Sources?
  |
  +-- Password-based users? --> YES: Export via Clerk Backend API (see Step 3A)
  |                         --> NO:  Skip password export
  |
  +-- Social auth users?    --> YES: Note providers for Step 5
  |                         --> NO:  Skip social auth config
  |
  +-- Organizations?        --> YES: Export via Clerk Backend SDK (see Step 4)
                            --> NO:  Skip organization migration
```

## Step 3: Export User Data from Clerk

### Step 3A: Export Users with Passwords (If Applicable)

**CRITICAL:** Clerk does NOT provide plaintext passwords. You must use their Backend API.

WebFetch: `https://clerk.com/changelog/2024-10-23-export-users`

Export to CSV format including the `password_digest` field (bcrypt hashes).

### Step 3B: Export User Profiles

Use Clerk Backend API to paginate through users. At minimum, capture:
- `email_addresses` (may be pipe-delimited: `email1|email2`)
- `first_name`
- `last_name`
- `id` (for tracking migration progress)

**Verification:** Confirm CSV/JSON file contains all expected user records before proceeding.

## Step 4: Import Users into WorkOS (Decision Tree)

```
Import Method?
  |
  +-- Use automated tool?  --> Use GitHub migration script (Step 4A)
  |
  +-- Custom import?       --> Use WorkOS API directly (Step 4B)
```

### Step 4A: Automated Migration Tool (Recommended)

Clone: `https://github.com/workos/migrate-clerk-users`

Follow repository README for configuration and execution.

**Verification:** After completion, check WorkOS Dashboard for imported user count.

### Step 4B: Manual API Import

WebFetch: `https://workos.com/docs/reference/authkit/user/create`
WebFetch: `https://workos.com/docs/reference/rate-limits`

**Field mapping:**

| Clerk Field       | WorkOS API Parameter |
|-------------------|---------------------|
| `email_addresses` | `email`             |
| `first_name`      | `first_name`        |
| `last_name`       | `last_name`         |
| `password_digest` | `password_hash`     |

**Multi-email handling:**

If `email_addresses` contains pipe-delimited values (`email1|email2`):
1. Split string on `|` character
2. Determine primary email (requires Clerk API User object fetch - see docs)
3. Use primary email for `email` parameter

**Password import parameters:**

For users with passwords, include in Create User request:
- `password_hash_type`: `"bcrypt"` (exact string)
- `password_hash`: Value from Clerk's `password_digest` field

**Rate limiting:** Create User API is rate-limited. Batch requests with exponential backoff if hitting limits. Check rate limit docs for current thresholds.

**Verification command:**

```bash
# Check user creation succeeded (replace with actual user email)
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep "test-migrated-user@example.com"
```

## Step 5: Configure Social Auth Providers (If Applicable)

If users previously authenticated via Clerk's OAuth connections (Google, Microsoft, etc.), configure matching providers in WorkOS.

WebFetch: `https://workos.com/docs/integrations`

**For each provider used in Clerk:**

1. Navigate to WorkOS Dashboard → Integrations
2. Enable the provider (e.g., Google OAuth, Microsoft)
3. Configure client ID and client secret from your OAuth app

**CRITICAL:** WorkOS matches users by **email address** from OAuth provider. Ensure the email used in OAuth matches the `email` field of the imported WorkOS user.

**No code changes required** — users can sign in immediately after provider configuration.

## Step 6: Migrate Organizations (If Applicable)

WebFetch: `https://workos.com/docs/reference/organization/create`

### Step 6A: Export Clerk Organizations

Use Clerk Backend SDK to paginate through organizations.

WebFetch: `https://clerk.com/docs/references/backend/organization/get-organization-list`

Capture organization IDs and names.

### Step 6B: Create WorkOS Organizations

For each Clerk organization, call WorkOS Create Organization API.

**Verification command:**

```bash
# List organizations in WorkOS
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Step 6C: Migrate Organization Memberships

WebFetch: `https://workos.com/docs/reference/authkit/organization-membership/create`

For each user-organization relationship in Clerk:

1. Export memberships via Clerk Backend SDK
   WebFetch: `https://clerk.com/docs/references/backend/organization/get-organization-membership-list`
2. Call WorkOS Organization Membership API to link user to organization

Map Clerk user ID → WorkOS user ID (track during Step 4 import).

**Verification:** Check WorkOS Dashboard → Organizations → Members list matches Clerk.

## Step 7: Handle MFA Migration

**CRITICAL:** WorkOS does NOT support SMS-based MFA (security reasons).

```
User has MFA?
  |
  +-- SMS-based?      --> User MUST re-enroll using TOTP or email Magic Auth
  |
  +-- TOTP-based?     --> Migration not automatic - user MUST re-enroll
```

**Action required:**

1. Identify users with MFA enrolled in Clerk
2. Email these users instructing them to re-enroll MFA after migration
3. Provide link to MFA enrollment flow in your app

WebFetch: `https://workos.com/docs/authkit/mfa` for enrollment implementation guide.

**Do NOT attempt to export/import MFA secrets** — this is not supported.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify WorkOS API key is configured
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key format valid" || echo "FAIL: Invalid API key"

# 2. Count imported users (replace EXPECTED_COUNT)
USER_COUNT=$(curl -s -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep -o '"list_metadata":{"after":null,"before":null}' | wc -l)
echo "Imported users: Check WorkOS Dashboard for count"

# 3. Test password auth for migrated user (replace with test credentials)
curl -X POST "https://api.workos.com/user_management/authenticate" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test-password","client_id":"'$WORKOS_CLIENT_ID'"}' \
  | grep -q "access_token" && echo "PASS: Password auth works" || echo "FAIL: Password auth failed"

# 4. Verify OAuth providers configured (if applicable)
# Check WorkOS Dashboard → Integrations manually

# 5. Test organization membership (replace IDs)
curl -s -X GET "https://api.workos.com/user_management/organization_memberships?organization_id=org_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep -q "user_id" && echo "PASS: Org memberships exist" || echo "FAIL: No memberships found"
```

**Manual checks:**

- [ ] WorkOS Dashboard shows correct user count
- [ ] Test login with migrated password user
- [ ] Test login with OAuth user (if applicable)
- [ ] Organization list in Dashboard matches Clerk
- [ ] Users notified about MFA re-enrollment requirement

## Error Recovery

### "User creation rate limit exceeded"

**Cause:** Exceeding Create User API rate limit during bulk import.

**Fix:**
1. Check current rate limits: WebFetch `https://workos.com/docs/reference/rate-limits`
2. Implement exponential backoff between batches
3. Split import into smaller batches (e.g., 100 users per batch)
4. Contact WorkOS support for temporary rate limit increase if needed

### "Email already exists" during import

**Cause:** User already exists in WorkOS or duplicate in Clerk export.

**Fix:**
1. Check WorkOS Dashboard for existing user with that email
2. Use Update User API instead of Create User for existing users
3. Deduplicate Clerk export file before importing

### Password authentication fails after import

**Cause:** Incorrect `password_hash_type` or malformed `password_hash`.

**Fix:**
1. Verify `password_hash_type` is exactly `"bcrypt"` (string, lowercase)
2. Verify `password_hash` is the raw bcrypt hash from Clerk's `password_digest` field
3. Do NOT include any salt prefixes or modifications — use Clerk's hash as-is
4. Re-import affected users with correct password parameters

### OAuth users cannot sign in after migration

**Cause:** Email mismatch or provider not configured in WorkOS.

**Fix:**
1. Check WorkOS Dashboard → Integrations: Ensure provider is enabled
2. Verify OAuth provider returns email that matches imported user's `email` field
3. Test OAuth flow in provider's test console to confirm email claim
4. If emails don't match, update user email in WorkOS to match OAuth email

### Organization memberships not showing

**Cause:** User ID or Organization ID mismatch in membership creation.

**Fix:**
1. Verify WorkOS user ID matches the ID used in membership API call
2. Verify WorkOS organization ID exists (call List Organizations API)
3. Check API response for membership creation — may be silently failing
4. Re-create memberships with correct IDs

### MFA users locked out

**Cause:** MFA factors not migrated (expected behavior).

**Fix:**
1. Provide password reset flow for locked users
2. Email users with MFA enrollment instructions
3. Temporarily disable MFA requirement during migration period (optional)
4. Direct users to your app's MFA enrollment page

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit after migration
- workos-authkit-react - Client-side auth UI after migration
- workos-api-authkit - Authentication API reference
- workos-api-organization - Organization management API
- workos-mfa - MFA enrollment and management
- workos-magic-link - Email-based authentication alternative to SMS MFA
