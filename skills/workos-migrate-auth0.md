---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

This is the migration source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

Before starting the migration, determine which Auth0 features you need to migrate:

```
What are you migrating?
  |
  +-- Password-based users --> Go to Step 3A (password export required)
  |
  +-- Social auth users only --> Skip to Step 5 (no password export)
  |
  +-- Organizations --> Also complete Step 6
  |
  +-- MFA users --> Read Step 7 (SMS not supported by WorkOS)
```

**Critical decisions:**

1. Do users sign in with passwords? → If YES, contact Auth0 support NOW (1+ week wait)
2. Do you use Auth0 Organizations? → If YES, you'll need to export and recreate them
3. Do users have SMS-based MFA? → If YES, they must re-enroll (WorkOS doesn't support SMS)

## Step 3: Export Auth0 User Data

### Step 3A: Basic User Export

**Method 1: Auth0 Dashboard (Bulk User Export Extension)**

1. Install "User Import/Export" extension in Auth0 Dashboard
2. Run bulk export job
3. Download newline-delimited JSON file

**Method 2: Auth0 Management API**

Use pagination to fetch all users programmatically. See Auth0 docs for API endpoints.

**Verify export:** Check JSON file contains these fields:

- `email`
- `email_verified`
- `given_name` (optional)
- `family_name` (optional)

### Step 3B: Password Export (CONDITIONAL - LONG LEAD TIME)

**ONLY if migrating password-based users.**

**Action:** Contact Auth0 support immediately. Explicitly request password hash export.

**Wait time:** 1+ weeks for Auth0 to process request.

**Output:** Newline-delimited JSON file with `passwordHash` field per user.

**Auth0 limitation:** Plaintext passwords are NOT available. You will receive bcrypt hashes.

**Verify password export:** Check file contains `passwordHash` field (bcrypt format).

## Step 4: WorkOS Environment Setup

### Environment Variables

Set these before importing:

```bash
WORKOS_API_KEY=sk_...        # From WorkOS Dashboard > API Keys
WORKOS_CLIENT_ID=client_...  # From WorkOS Dashboard
```

**Verify:** Run this command to test API connectivity:

```bash
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with user list (may be empty).

### SDK Installation (OPTIONAL)

If using the WorkOS import tool or writing custom import code:

```bash
# Detect package manager and install
npm install @workos-inc/node  # or yarn/pnpm equivalent
```

## Step 5: Import Users into WorkOS (Two Paths)

### Path A: Use WorkOS Import Tool (Recommended)

**Tool location:** https://github.com/workos/migrate-auth0-users

1. Clone repository
2. Configure environment variables in `.env`
3. Place Auth0 export files in specified directory
4. Run import script

**Advantages:**

- Handles pagination automatically
- Built-in error recovery
- Idempotent (safe to re-run)

**Verify:** Check WorkOS Dashboard > Users for imported count matching export.

### Path B: Custom Import Script (Advanced)

If writing your own import code, use these API mappings:

**Field mapping (Auth0 → WorkOS):**

```
Auth0 Export Field    WorkOS API Parameter
------------------    --------------------
email              →  email
email_verified     →  email_verified
given_name         →  first_name
family_name        →  last_name
```

**API endpoint:** `POST https://api.workos.com/user_management/users`

**Sample request body:**

```json
{
  "email": "user@example.com",
  "email_verified": true,
  "first_name": "John",
  "last_name": "Doe"
}
```

**Password import (CONDITIONAL):**

If you have password hashes from Step 3B, add these fields:

```json
{
  "email": "user@example.com",
  "password_hash": "$2a$10$...", // from Auth0 passwordHash field
  "password_hash_type": "bcrypt"
}
```

**Critical:** Auth0 uses bcrypt. WorkOS supports bcrypt natively. DO NOT attempt to re-hash.

**Verification command:**

```bash
# Count users in WorkOS
curl -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total_count'
```

Compare count to Auth0 export line count:

```bash
wc -l auth0_users.json
```

Counts should match (±1 for headers).

## Step 6: Migrate Social Auth Users

**Context:** Users who signed in via Google, Microsoft, etc. through Auth0.

### Step 6A: Configure OAuth Providers in WorkOS

For each social provider used in Auth0:

1. Go to WorkOS Dashboard > Integrations
2. Configure provider client credentials (see provider-specific docs at https://workos.com/docs/integrations)
3. Enable provider for your environment

**Common providers:**

- Google OAuth: https://workos.com/docs/integrations/google-oauth
- Microsoft OAuth: https://workos.com/docs/integrations/microsoft-oauth

### Step 6B: User Linking (Automatic)

**How it works:**

1. User signs in with social provider through WorkOS
2. WorkOS matches by **email address** to existing imported user
3. Provider identity is linked automatically

**Email verification note:**

- Verified providers (e.g., `@gmail.com` via Google OAuth) → no extra verification
- Unverified providers → user may need to verify email if WorkOS email verification is enabled

**No manual linking required** — WorkOS handles this at first sign-in.

## Step 7: Migrate Organizations (CONDITIONAL)

**ONLY if using Auth0 Organizations.**

### Step 7A: Export Auth0 Organizations

Use Auth0 Management API to paginate through organizations:

**API endpoint:** `GET https://{auth0_domain}/api/v2/organizations`

**Required data per organization:**

- Organization ID (for reference mapping)
- Organization name
- Organization metadata (optional)

### Step 7B: Create Organizations in WorkOS

**API endpoint:** `POST https://api.workos.com/organizations`

**Request body:**

```json
{
  "name": "Acme Corp",
  "domains": ["acme.com"], // optional
  "allow_profiles_outside_organization": false // optional
}
```

**Store mapping:** Keep a map of `auth0_org_id → workos_org_id` for membership import.

### Step 7C: Import Organization Memberships

For each user-organization relationship in Auth0:

**API endpoint:** `POST https://api.workos.com/user_management/organization_memberships`

**Request body:**

```json
{
  "user_id": "user_01H...", // WorkOS user ID from Step 5
  "organization_id": "org_01H...", // WorkOS org ID from Step 7B
  "role_slug": "member" // or "admin" - map from Auth0 roles
}
```

**Verify memberships:**

```bash
# List memberships for an organization
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id=org_01H..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 8: Multi-Factor Auth (MFA) Migration

**Critical limitation:** WorkOS does NOT support SMS-based MFA (security concerns).

### MFA Strategy Decision Tree

```
User's Auth0 MFA method?
  |
  +-- SMS (text message) --> User MUST re-enroll
  |                          Options: TOTP app OR email-based Magic Auth
  |
  +-- TOTP (authenticator app) --> CANNOT migrate enrollment
  |                                User MUST re-enroll in WorkOS
  |
  +-- Email (magic link) --> WorkOS supports this natively
                             User will receive WorkOS magic links
```

**Action required:**

1. Identify users with SMS MFA enabled in Auth0
2. Send migration announcement explaining MFA re-enrollment
3. Direct users to re-enroll after first WorkOS sign-in

**No programmatic MFA migration** — all users must re-enroll.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify migration:

```bash
# 1. Check user count matches export
AUTH0_COUNT=$(wc -l < auth0_users.json)
WORKOS_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" | jq '.list_metadata.total_count')
[ "$AUTH0_COUNT" -eq "$WORKOS_COUNT" ] && echo "PASS: User count matches" || echo "FAIL: User count mismatch"

# 2. Verify a sample user exists with correct email
curl -X GET "https://api.workos.com/user_management/users?email=test@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[0].email'

# 3. Check organization count (if applicable)
curl -X GET "https://api.workos.com/organizations?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total_count'

# 4. Verify OAuth providers configured (check Dashboard manually)
# Go to WorkOS Dashboard > Integrations and confirm each provider is enabled
```

**Manual checks:**

- [ ] Test password login for migrated user
- [ ] Test social auth login (should auto-link to existing user)
- [ ] Test organization membership permissions
- [ ] Verify MFA re-enrollment flow works

## Error Recovery

### "User already exists" during import

**Cause:** Re-running import without idempotency handling.

**Fix:** Check if user exists before creating:

```bash
# Query by email first
curl -X GET "https://api.workos.com/user_management/users?email=$EMAIL" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If user exists, skip creation or use Update API instead.

### "Invalid password hash format"

**Cause 1:** Passing Auth0 hash without `password_hash_type: "bcrypt"`.

**Fix:** Always include both fields:

```json
{
  "password_hash": "$2a$10$...",
  "password_hash_type": "bcrypt"
}
```

**Cause 2:** Auth0 hash is not bcrypt (rare - Auth0 defaults to bcrypt).

**Fix:** Contact Auth0 support to confirm hash algorithm. WorkOS supports bcrypt only for Auth0 migrations.

### "Email verification required" blocking social auth users

**Context:** WorkOS email verification setting is enabled, but social provider doesn't verify emails.

**Fix 1:** Disable email verification in WorkOS Dashboard > Authentication Settings (not recommended for production).

**Fix 2:** Pre-verify emails during import by setting `email_verified: true` in Create User API.

**Fix 3:** Whitelist specific email domains (e.g., `@gmail.com`) that are verified by their OAuth provider.

### Social auth user creates duplicate account instead of linking

**Cause:** Email mismatch between Auth0 export and social provider email.

**Root cause:** User may have changed email in social provider after Auth0 export.

**Fix:** Update WorkOS user email to match social provider, or instruct user to use original email for first WorkOS sign-in.

### Organization membership API returns 404

**Cause:** User ID or Organization ID doesn't exist in WorkOS.

**Fix:** Verify both IDs exist first:

```bash
# Check user exists
curl -X GET "https://api.workos.com/user_management/users/$USER_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Check org exists
curl -X GET "https://api.workos.com/organizations/$ORG_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If either 404s, complete Step 5 or Step 7B first.

### Import tool fails with "rate limit exceeded"

**Cause:** Auth0 export is large, hitting WorkOS API rate limits.

**Fix:** Add delay between requests (import tool should handle this automatically). If using custom script, add 100ms delay between user creations.

### "passwordHash field not found" in Auth0 export

**Cause:** Auth0 support did not include password hashes in export (Step 3B incomplete).

**Fix:** Re-open ticket with Auth0 support explicitly requesting password hash export. Emphasize "passwordHash field required for migration."

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS AuthKit into Next.js after migration
- workos-authkit-react — Integrate WorkOS AuthKit into React apps
- workos-directory-sync.rules.yml — Sync organizations from external directory providers
