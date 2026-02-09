---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

Map your Auth0 setup to determine migration path:

```
Auth0 Authentication Type?
  |
  +-- Password-based users?
  |     |
  |     +-- YES --> Contact Auth0 support for password export (1+ week lead time)
  |     +-- NO  --> Skip password export, proceed to Step 3
  |
  +-- Social auth users (Google, Microsoft)?
  |     |
  |     +-- YES --> Configure OAuth providers in WorkOS (Step 6)
  |     +-- NO  --> Skip social auth setup
  |
  +-- SMS-based MFA users?
  |     |
  |     +-- YES --> CRITICAL: WorkOS does not support SMS MFA
  |     |           Users must re-enroll with TOTP or use Magic Auth
  |     +-- NO  --> Continue
  |
  +-- Organizations configured?
        |
        +-- YES --> Export organizations via Auth0 Management API (Step 4)
        +-- NO  --> Skip organization migration
```

**CRITICAL: SMS MFA is not supported by WorkOS** — users with SMS second factors will need to re-enroll using authenticator apps (TOTP) or switch to email-based Magic Auth. This is not optional.

## Step 3: Export Auth0 User Data

### Basic User Export (REQUIRED)

Use Auth0 Dashboard → User Import/Export Extension:

1. Navigate to Extensions → User Import/Export
2. Run "Bulk User Export" job
3. Download newline-delimited JSON file

**Fields to verify in export:**
- `email` (required)
- `email_verified` (boolean)
- `given_name` (optional, maps to `first_name`)
- `family_name` (optional, maps to `last_name`)

### Password Export (CONDITIONAL)

**Only if** you have password-based authentication users:

1. Contact Auth0 support via https://auth0.com/docs/troubleshoot/customer-support
2. Request password hash export
3. **Expect 1+ week processing time** — start this early
4. Receive separate JSON file with `passwordHash` field

**Password export note:** Auth0 does NOT export plaintext passwords. Hashes only, using bcrypt algorithm.

## Step 4: Export Auth0 Organizations (CONDITIONAL)

**Only if** you use Auth0 Organizations feature.

Use Auth0 Management API to paginate organizations:

```bash
# Get access token
curl -X POST https://YOUR_DOMAIN.auth0.com/oauth/token \
  -H 'content-type: application/json' \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://YOUR_DOMAIN.auth0.com/api/v2/",
    "grant_type": "client_credentials"
  }'

# Export organizations (paginate as needed)
curl -X GET https://YOUR_DOMAIN.auth0.com/api/v2/organizations \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Save organization list for Step 7.

**Organization memberships:** These are included in the user export from Step 3 if you used the Import/Export extension.

## Step 5: Import Users to WorkOS (Decision Tree)

Choose ONE of these approaches:

```
Import method?
  |
  +-- Use WorkOS migration tool (recommended)
  |     |
  |     --> GitHub: https://github.com/workos/migrate-auth0-users
  |     --> Follow repository README for automated import
  |
  +-- Use WorkOS APIs directly
        |
        --> Continue to manual import steps below
```

### Manual Import via WorkOS API

**Field mapping (Auth0 → WorkOS):**

| Auth0 Export Field | WorkOS API Parameter |
|--------------------|----------------------|
| `email`            | `email`              |
| `email_verified`   | `email_verified`     |
| `given_name`       | `first_name`         |
| `family_name`      | `last_name`          |

**Basic user creation (no password):**

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

**User creation with password hash:**

If you have password export from Step 3:

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Doe",
    "password_hash": "BCRYPT_HASH_FROM_AUTH0",
    "password_hash_type": "bcrypt"
  }'
```

**CRITICAL:** Set `password_hash_type` to `"bcrypt"` — Auth0 uses bcrypt algorithm. WorkOS supports this directly.

**Verify import progress:**

```bash
# Count users in WorkOS
curl -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.list_metadata.total'
```

## Step 6: Configure Social Auth Providers (CONDITIONAL)

**Only if** you have users who sign in via Google, Microsoft, or other OAuth providers.

For each provider your users use:

1. Navigate to WorkOS Dashboard → Integrations
2. Configure provider client credentials (see provider-specific docs at https://workos.com/docs/integrations)
3. Users will auto-link on first sign-in **via email address match**

**Email verification note:** Some users may need to verify email after social auth sign-in, depending on provider trust level:
- Google OAuth with `@gmail.com` → No verification required
- Other providers → May require verification if WorkOS environment has email verification enabled

**Check your email verification settings:**
WorkOS Dashboard → Authentication Settings → Email Verification

## Step 7: Migrate Organizations (CONDITIONAL)

**Only if** you exported organizations in Step 4.

Create WorkOS organizations for each Auth0 organization:

```bash
# For each organization from Step 4 export
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organization Name from Auth0",
    "domains": ["domain.com"]
  }'
```

**Save organization IDs** returned from WorkOS for membership import.

### Add Organization Memberships

For each user-organization relationship from Auth0 export:

```bash
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_WORKOS_ID",
    "organization_id": "org_WORKOS_ID"
  }'
```

**Verify memberships:**

```bash
# Check memberships for a user
curl -X GET "https://api.workos.com/user_management/organization_memberships?user_id=user_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 8: MFA Transition Plan

**SMS MFA users cannot migrate directly** — WorkOS does not support SMS due to security vulnerabilities.

Action required for affected users:

1. **Option A: TOTP Migration**
   - User re-enrolls in MFA using authenticator app (Google Authenticator, Authy, etc.)
   - TOTP is the recommended secure alternative

2. **Option B: Magic Auth**
   - User switches to email-based passwordless authentication
   - No MFA enrollment required (email verification serves as second factor)

**Communication template for SMS MFA users:**

```
Subject: Action Required - MFA Update

We're upgrading our authentication system. Your SMS-based two-factor 
authentication will no longer work after [DATE].

Please set up authenticator app MFA at your next login:
[LINK TO MFA ENROLLMENT PAGE]

Alternatively, you can switch to passwordless email authentication.
```

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm successful migration:

```bash
# 1. Verify user count matches Auth0 export
AUTH0_COUNT=$(wc -l < auth0_users_export.json)
WORKOS_COUNT=$(curl -s -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.list_metadata.total')
echo "Auth0: $AUTH0_COUNT, WorkOS: $WORKOS_COUNT"

# 2. Test password-based login (if passwords were imported)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_user@example.com",
    "password": "their_original_password"
  }'

# 3. Verify organization count (if migrated)
curl -s -X GET "https://api.workos.com/organizations?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.list_metadata.total'

# 4. Check social auth provider configuration
# Navigate to: WorkOS Dashboard → Integrations
# Verify: Each provider shows "Connected" status

# 5. Test end-to-end sign-in flow
# Manual: Attempt login via your application using WorkOS AuthKit
```

**All checks must pass before decommissioning Auth0.**

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in import data or user already created in WorkOS.

**Fix:**
```bash
# Check if user exists
curl -X GET "https://api.workos.com/user_management/users?email=user@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# If exists, skip or use Update User API instead
```

### Password authentication fails after migration

**Root cause:** `password_hash_type` not set to `"bcrypt"` or hash corrupted.

**Fix:**
1. Verify Auth0 password export used bcrypt (check with Auth0 support if unclear)
2. Re-import affected users with correct `password_hash_type` parameter
3. Use WorkOS Update User API to fix existing users:

```bash
curl -X PATCH https://api.workos.com/user_management/users/USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "password_hash": "CORRECT_HASH",
    "password_hash_type": "bcrypt"
  }'
```

### Social auth users not auto-linking

**Root cause:** Email mismatch between provider and WorkOS user record, or provider not configured.

**Fix:**
1. Verify provider is configured in WorkOS Dashboard → Integrations
2. Check that WorkOS user `email` exactly matches email from social provider
3. Ensure `email_verified` is `true` on WorkOS user record

**Check provider email:**
```bash
# After user signs in via provider, check profile
curl -X GET https://api.workos.com/user_management/users/USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.email, .email_verified'
```

### Organization membership import fails

**Root cause:** User ID or Organization ID not found, or membership already exists.

**Fix:**
1. Verify both user and organization exist in WorkOS first
2. Check for duplicate memberships before creating:

```bash
curl -X GET "https://api.workos.com/user_management/organization_memberships?user_id=USER_ID&organization_id=ORG_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### "Invalid API key" errors

**Root cause:** Wrong key type or missing permissions.

**Fix:**
- Verify `WORKOS_API_KEY` starts with `sk_` (secret key for API operations)
- Do NOT use client ID (`client_` prefix) for API calls
- Check key permissions in WorkOS Dashboard → API Keys

### Auth0 password export delayed

**Root cause:** Auth0 support backlog, not WorkOS issue.

**Workaround:**
1. Proceed with user migration WITHOUT passwords
2. Users can reset password via WorkOS after migration
3. Or use passwordless/social auth until hashes arrive
4. Import passwords later using Update User API

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit into Next.js application after migration
- `workos-organizations` - Advanced organization management features post-migration
