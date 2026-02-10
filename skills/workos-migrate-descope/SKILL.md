---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:3056c8ae6df4 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Validation

### WorkOS Environment

- Confirm WorkOS account exists
- Verify `WORKOS_API_KEY` in environment (starts with `sk_`)
- Verify `WORKOS_CLIENT_ID` in environment (starts with `client_`)
- Confirm WorkOS SDK installed in project

**Verify:** Run `npm ls @workos-inc/node` or equivalent to confirm SDK presence.

### Descope Access

- Confirm access to Descope Management API
- Verify Descope API credentials are valid
- Test connection: `curl -H "Authorization: Bearer <descope-api-key>" https://api.descope.com/v1/mgmt/user/search`

## Step 3: Password Export (Decision Tree)

```
Do users sign in with passwords?
  |
  +-- NO --> Skip to Step 4
  |
  +-- YES --> Contact Descope support for password export
              |
              +-- Wait for CSV with password hashes
              |
              +-- Note hashing algorithm (bcrypt, argon2, pbkdf2, etc.)
```

**CRITICAL:** Descope does NOT expose password hashes via API. You MUST contact support to obtain them. See: https://docs.descope.com/management/user-management/user-exporting

**What to request from support:**
- CSV export with user data AND password hashes
- Explicit confirmation of hashing algorithm used
- Secure transfer method (encrypted, time-limited link, etc.)

## Step 4: Export User Data

Use Descope Management API to export users:

```bash
# Example: Search all users
curl -X POST https://api.descope.com/v1/mgmt/user/search \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID:$DESCOPE_MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Required fields to capture:**
- `email` (maps to `email`)
- `givenName` (maps to `first_name`)
- `familyName` (maps to `last_name`)
- `verifiedEmail` (maps to `email_verified`)
- `tenantIds` (for organization memberships — capture this association)

**Verify:** Save raw export to JSON/CSV before processing. Do not transform inline.

## Step 5: Import Users to WorkOS

### Rate Limiting Strategy

WorkOS Create User API has rate limits. For migrations >1000 users, implement batching:

```bash
# Check current rate limits
curl https://api.workos.com/rate_limit \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Batching pattern:**
- Process 100 users per batch
- 1-second delay between batches
- Retry on 429 with exponential backoff

### Create Users (Without Passwords)

For each user in Descope export:

```bash
curl https://api.workos.com/user_management/users \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<descope.email>",
    "first_name": "<descope.givenName>",
    "last_name": "<descope.familyName>",
    "email_verified": <descope.verifiedEmail>
  }'
```

**Store mapping:** `descope_user_id` → `workos_user_id` for later steps.

### Import Passwords (If Obtained)

If you received password hashes from Descope support:

```bash
curl https://api.workos.com/user_management/users \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<email>",
    "password_hash": "<hash_from_descope>",
    "password_hash_type": "bcrypt"
  }'
```

**Supported hash types:** `bcrypt`, `argon2`, `pbkdf2` (must match what Descope used).

**CRITICAL:** If hash type is wrong, users cannot sign in. Confirm with Descope support before importing.

## Step 6: Migrate Social Auth Users (OAuth)

If Descope users signed in via Google, Microsoft, or other OAuth providers:

### Configure Providers in WorkOS

1. Go to WorkOS Dashboard → Authentication → Social Providers
2. For each provider (Google, Microsoft, etc.):
   - Add OAuth client credentials
   - See provider-specific docs: https://workos.com/docs/integrations

**CRITICAL:** WorkOS links users by **email address**. If a user signs in with Google OAuth using the same email as their Descope account, they are automatically matched.

### Email Verification Behavior

- **Trusted providers** (e.g., `@gmail.com` via Google OAuth): No additional verification
- **Untrusted domains**: User may need to verify email if environment settings require it

**Check environment settings:** Dashboard → Authentication → Email Verification

## Step 7: Export Descope Tenants

Descope "Tenants" = WorkOS "Organizations". Use Descope Management API to list tenants:

```bash
# Example: List all tenants (check Descope docs for exact endpoint)
curl https://api.descope.com/v1/mgmt/tenant/list \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID:$DESCOPE_MANAGEMENT_KEY"
```

**Required fields:**
- `id` (store as WorkOS `external_id`)
- `name` (maps to WorkOS `name`)

**Verify:** Save tenant export before proceeding. You need tenant→user mappings for Step 8.

## Step 8: Create WorkOS Organizations

For each Descope tenant:

```bash
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<descope_tenant_name>",
    "external_id": "<descope_tenant_id>"
  }'
```

**Store mapping:** `descope_tenant_id` → `workos_org_id` for Step 9.

## Step 9: Add Organization Memberships

Use the user-tenant associations from Step 4 to create memberships:

```bash
curl https://api.workos.com/user_management/organization_memberships \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<workos_user_id>",
    "organization_id": "<workos_org_id>"
  }'
```

### Role Migration (Optional)

If using RBAC:

1. Identify roles defined in Descope (if any)
2. Create equivalent roles in WorkOS Dashboard: Dashboard → Roles & Permissions
3. Assign roles during membership creation:

```bash
curl https://api.workos.com/user_management/organization_memberships \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<workos_user_id>",
    "organization_id": "<workos_org_id>",
    "role_slug": "<role_slug>"
  }'
```

**CRITICAL:** Roles must exist in WorkOS before assignment. Create them in Dashboard first.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking migration complete:

```bash
# 1. Verify users imported
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Expected: Count matches Descope export

# 2. Verify organizations created
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Expected: Count matches Descope tenant count

# 3. Test password sign-in (if passwords imported)
curl https://api.workos.com/user_management/authenticate \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<test_user_email>",
    "password": "<known_password>",
    "client_id": "$WORKOS_CLIENT_ID"
  }'
# Expected: Returns user session

# 4. Test OAuth sign-in (if social auth used)
# Open browser to WorkOS OAuth URL for test user
# Expected: User signs in and is matched to existing WorkOS user

# 5. Verify organization memberships
curl https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Expected: Count matches sum of all user-tenant associations
```

## Error Recovery

### "User already exists" (409 on Create User)

**Cause:** Duplicate email in import batch, or user already created.

**Fix:**
1. Check if user exists: `GET /user_management/users?email=<email>`
2. If exists, use Update User API instead: `PUT /user_management/users/:id`
3. Deduplicate import data by email before batch processing

### "Invalid password hash type"

**Cause:** `password_hash_type` does not match Descope's actual algorithm.

**Fix:**
1. Confirm algorithm with Descope support (bcrypt, argon2, pbkdf2)
2. Update import script with correct type
3. Re-import failed users

### "Rate limit exceeded" (429)

**Cause:** Too many API requests in short time.

**Fix:**
1. Implement exponential backoff: wait 1s, 2s, 4s, etc.
2. Check rate limit headers in response: `X-RateLimit-Remaining`
3. Reduce batch size if consistently hitting limits

### "Organization not found" (creating membership)

**Cause:** Organization ID mapping is incorrect or org was not created.

**Fix:**
1. Verify organization exists: `GET /organizations/:id`
2. Check `descope_tenant_id` → `workos_org_id` mapping
3. Create missing organization before retrying membership

### "Role not found" (assigning role)

**Cause:** `role_slug` does not exist in WorkOS environment.

**Fix:**
1. List roles: Dashboard → Roles & Permissions
2. Create missing role in Dashboard first
3. Retry membership creation with correct slug

### OAuth user not auto-linked

**Cause:** Email mismatch or user not email-verified in WorkOS.

**Fix:**
1. Confirm user email matches OAuth provider email exactly (case-sensitive)
2. Check `email_verified: true` was set during import
3. If provider is untrusted, user must verify email manually

### Descope Management API 401 Unauthorized

**Cause:** Invalid API credentials or missing authorization header.

**Fix:**
1. Verify format: `Authorization: Bearer PROJECT_ID:MANAGEMENT_KEY`
2. Check credentials in Descope Dashboard → Project Settings
3. Ensure management key has appropriate permissions

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit after migration
- `workos-api-authkit` - Use AuthKit APIs for user management
- `workos-api-organization` - Manage organizations post-migration
- `workos-rbac` - Configure roles and permissions
