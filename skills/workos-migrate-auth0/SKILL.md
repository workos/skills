---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- generated -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

This doc is the source of truth for data mappings and API parameters. If this skill conflicts with the doc, follow the doc.

## Step 2: Pre-Migration Assessment

### Inventory Check

Run these queries against your Auth0 tenant to determine migration scope:

```bash
# Count total users
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/users?search_engine=v3" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" | jq '. | length'

# Count users with passwords (vs social auth only)
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/users?search_engine=v3&q=identities.connection:Username-Password-Authentication" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" | jq '. | length'

# Count organizations
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/organizations" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" | jq '. | length'
```

**Decision Tree:**

```
Do you need password hashes?
  |
  +-- YES --> Contact Auth0 support NOW (1+ week lead time)
  |           Ticket must request: "Bulk user export with password hashes"
  |           Expected format: NDJSON with passwordHash field
  |
  +-- NO  --> Proceed to Step 3
```

### WorkOS Environment Setup

Verify in WorkOS Dashboard:

- [ ] Environment created (staging/production)
- [ ] API keys generated (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)
- [ ] Redirect URIs configured for your app

**Test API access:**

```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with `{"data": [], ...}` (empty list is fine)

## Step 3: Export Auth0 Data

### User Export

Use Auth0 Management API v2 (NOT the deprecated User Import/Export Extension):

```bash
# Generate management token first
curl -X POST "https://YOUR_DOMAIN.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://YOUR_DOMAIN.auth0.com/api/v2/",
    "grant_type": "client_credentials"
  }' | jq -r '.access_token'

# Export users (paginate if >100 users)
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/users?per_page=100&page=0" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" > auth0_users_page0.json
```

**Critical fields to verify in export:**

- `email` - REQUIRED for WorkOS
- `email_verified` - Boolean
- `given_name` - Maps to first_name
- `family_name` - Maps to last_name
- `user_id` - Store for reference mapping

**If you have password hashes:**

Auth0 support will provide a separate NDJSON file. Each line should contain:

```json
{"_id": "auth0|...", "passwordHash": "$2b$10$..."}
```

Merge this with your user export by matching `_id` to `user_id`.

### Organization Export (if applicable)

```bash
# Export organizations
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/organizations?per_page=100" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" > auth0_orgs.json

# For each org, export members
curl -X GET "https://YOUR_DOMAIN.auth0.com/api/v2/organizations/{org_id}/members" \
  -H "Authorization: Bearer YOUR_MGMT_TOKEN" > auth0_org_{org_id}_members.json
```

## Step 4: Choose Import Method

**Option A: Use WorkOS import tool (RECOMMENDED for >1000 users)**

```bash
# Clone the official migration tool
git clone https://github.com/workos/migrate-auth0-users.git
cd migrate-auth0-users

# Install dependencies
npm install

# Configure environment
cat > .env <<EOF
WORKOS_API_KEY=sk_...
AUTH0_USERS_FILE=path/to/auth0_users.json
AUTH0_PASSWORDS_FILE=path/to/auth0_passwords.ndjson
EOF

# Run import
npm start
```

The tool handles:
- Pagination
- Rate limiting
- Error retry logic
- Progress tracking
- Mapping Auth0 → WorkOS fields

**Option B: Manual API import (for <1000 users or custom logic)**

Proceed to Step 5.

## Step 5: Manual Import via WorkOS API

### Field Mapping (Auth0 → WorkOS)

| Auth0 Field      | WorkOS API Parameter | Notes                          |
|------------------|----------------------|--------------------------------|
| `email`          | `email`              | REQUIRED                       |
| `email_verified` | `email_verified`     | Boolean                        |
| `given_name`     | `first_name`         | Optional                       |
| `family_name`    | `last_name`          | Optional                       |
| `user_id`        | N/A                  | Store externally for reference |
| `passwordHash`   | `password_hash`      | Only if bcrypt format          |

### Import Users

```bash
# For each user in auth0_users.json:
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Doe",
    "password_hash": "$2b$10$...",
    "password_hash_type": "bcrypt"
  }'
```

**CRITICAL for password imports:**

- `password_hash_type` MUST be `"bcrypt"` (Auth0's default)
- `password_hash` MUST be the raw hash string from Auth0 export
- Do NOT attempt to re-hash the hash

**Error handling pattern:**

```bash
# Check response status
HTTP_STATUS=$(curl -s -o /tmp/response.json -w "%{http_code}" \
  -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @user_payload.json)

if [ "$HTTP_STATUS" -eq 201 ]; then
  echo "✓ User created"
elif [ "$HTTP_STATUS" -eq 409 ]; then
  echo "⚠ User already exists (safe to skip)"
else
  echo "✗ Error $HTTP_STATUS: $(cat /tmp/response.json)"
fi
```

### Import Organizations

```bash
# Create each organization
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "domains": ["acme.com"]
  }' | jq -r '.id' > workos_org_id.txt

# Add members to organization
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_...",
    "user_id": "user_..."
  }'
```

## Step 6: Social Auth Provider Configuration

**Decision Tree:**

```
Do users sign in with social providers? (Google, Microsoft, etc.)
  |
  +-- YES --> Configure providers in WorkOS Dashboard
  |           |
  |           +-- Google OAuth: Get client ID/secret from Google Cloud Console
  |           +-- Microsoft OAuth: Get client ID/secret from Azure Portal
  |           |
  |           WorkOS will auto-link users by email address
  |
  +-- NO --> Skip to Step 7
```

**Email verification behavior:**

- Known verified domains (e.g., `@gmail.com` via Google OAuth): No extra verification
- Unknown domains: Users must verify email if verification is enabled

**Test social auth linking:**

```bash
# After configuring provider, test sign-in flow
# User signs in with Google → WorkOS checks email → Links to existing user

# Verify linking worked:
curl https://api.workos.com/user_management/users/user_XXX \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.identities'

# Should show both password and oauth identities
```

## Step 7: MFA Migration

**CRITICAL DIFFERENCE:**

Auth0 supports SMS MFA → WorkOS does NOT support SMS MFA (security reasons)

**Migration paths:**

```
Auth0 MFA Type?
  |
  +-- SMS/Phone --> Users MUST re-enroll in WorkOS using TOTP authenticator
  |                 (Google Authenticator, Authy, 1Password, etc.)
  |
  +-- TOTP/App  --> Users MUST re-enroll (TOTP secrets cannot be exported)
  |
  +-- Email     --> WorkOS supports email-based Magic Auth (no re-enrollment)
```

**Communication plan for users:**

1. Send pre-migration email: "We're upgrading auth. If you use SMS MFA, please re-enroll after [date]."
2. Post-migration: Force MFA re-enrollment on first sign-in
3. Provide in-app setup guide for TOTP authenticators

## Verification Checklist (ALL MUST PASS)

Run these after migration completes:

```bash
# 1. Count imported users
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Compare to Auth0 user count from Step 2

# 2. Test password auth (pick a known user)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "known_password",
    "client_id": "'"$WORKOS_CLIENT_ID"'"
  }'
# Expected: 200 OK with session token

# 3. Verify organizations imported (if applicable)
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 4. Check organization memberships
curl https://api.workos.com/user_management/organization_memberships?organization_id=org_XXX \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 5. Test social auth (manual test in browser)
# Navigate to your app's sign-in page → Click "Sign in with Google"
# Should redirect to WorkOS → Google → Back to app (signed in)
```

**Do not mark migration complete until all checks pass.**

## Error Recovery

### "Invalid password hash format"

**Cause:** Wrong `password_hash_type` or malformed hash string.

**Fix:**

1. Verify Auth0 uses bcrypt: Check Auth0 tenant settings → Password policy
2. Confirm hash string starts with `$2a$`, `$2b$`, or `$2y$`
3. Ensure no newlines or whitespace in hash string
4. If Auth0 used different algorithm, contact WorkOS support

### "User already exists" (409 Conflict)

**Cause:** Duplicate email in import.

**Fix:**

- Safe to skip if user data matches
- If updating user data, use PATCH `/user_management/users/{id}` instead of POST

### "Rate limit exceeded" (429)

**Cause:** Too many API requests too quickly.

**Fix:**

```bash
# Add delay between requests (recommended: 100ms)
for user in $(jq -c '.[]' auth0_users.json); do
  curl -X POST ... -d "$user"
  sleep 0.1  # 100ms delay
done
```

**Better:** Use the official migration tool (Step 4, Option A) which handles rate limiting.

### "Invalid organization membership" (organization not found)

**Cause:** Trying to add user to org before org is created.

**Fix:**

1. Create all organizations first
2. Store WorkOS org IDs in mapping table
3. Then create memberships using WorkOS IDs (not Auth0 IDs)

### Password authentication fails post-migration

**Cause:** Hash not imported or wrong algorithm.

**Fix:**

1. Verify `password_hash` field exists in WorkOS user:
   ```bash
   curl https://api.workos.com/user_management/users/user_XXX \
     -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.password_hash'
   ```
2. If null, re-import with password hash included
3. If still fails, user must reset password via Magic Auth

### Social auth user not auto-linking

**Cause:** Email mismatch or email not verified.

**Fix:**

1. Check email from OAuth provider matches WorkOS user email exactly (case-sensitive)
2. Verify `email_verified: true` in WorkOS user record
3. Check provider is configured correctly in WorkOS Dashboard
4. Test with provider's email verification status

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit into Next.js app
- `workos-sso-setup` - Configure SSO connections after migration
