---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- generated -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

Analyze the Descope setup to determine migration scope:

```
What auth methods does Descope use?
  |
  +-- Password-based --> Contact Descope support for password export (BLOCKING)
  |                      Wait for CSV with hashed passwords before continuing
  |
  +-- Social auth only --> Configure OAuth providers in WorkOS first
  |                        (Google, Microsoft, GitHub, etc.)
  |
  +-- Both --> Do password export AND provider setup
```

**Critical:** Password export requires Descope support ticket. Plan 2-5 business days lead time.

## Step 3: Validate Prerequisites

### WorkOS Environment

Check dashboard at `https://dashboard.workos.com`:

- Environment exists (Staging or Production)
- API keys visible under "API Keys"
- `WORKOS_API_KEY` starts with `sk_` (server-side)
- `WORKOS_CLIENT_ID` starts with `client_`

### Rate Limits (IMPORTANT)

Check: `https://workos.com/docs/reference/rate-limits`

User creation is rate-limited. For large migrations (1000+ users), implement:

- Batching (50-100 users per batch)
- Delays between batches (2-5 seconds)
- Retry logic with exponential backoff

## Step 4: Export Data from Descope

### Export Users

Use Descope Management API to export users. Required fields:

- `email` (required)
- `givenName` (optional → first_name)
- `familyName` (optional → last_name)
- `verifiedEmail` (boolean → email_verified)
- `tenants` (array → organization memberships)

Save to JSON or CSV. **Verify:** Export includes all active users before proceeding.

### Export Tenants

Use Descope Tenant Management API to export tenants. Required fields:

- `id` (store as external_id in WorkOS)
- `name` (required)

Save to separate file. **Verify:** Count matches Descope dashboard.

### Export Passwords (If Applicable)

**BLOCKING:** If using password auth, wait for Descope support to provide password export CSV.

CSV will contain:

- User identifier (email or ID)
- Password hash
- Hashing algorithm used (bcrypt, argon2, or pbkdf2)

**Critical:** Note the hashing algorithm. WorkOS needs this for import.

## Step 5: Configure OAuth Providers (If Applicable)

If migrating social auth users, configure providers in WorkOS dashboard BEFORE importing users.

For each provider used in Descope:

1. Navigate to dashboard → Redirects → OAuth/OIDC
2. Add provider (Google, Microsoft, GitHub, etc.)
3. Enter client ID and secret from provider console
4. Note redirect URI for provider configuration

**Verify:** Provider shows "Connected" status in dashboard.

## Step 6: Import Organizations

Use WorkOS Create Organization API. Field mapping:

```
Descope Tenant     WorkOS Organization
--------------     -------------------
name           →   name
id             →   external_id (for reference tracking)
```

**Rate limit:** Organizations API has higher limits than users. Safe to import without batching unless 10,000+.

Example script pattern:

```bash
# Verify organization creation
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","external_id":"descope_tenant_123"}'

# Check response for "id" field - save this for membership creation
```

**Store mapping:** Keep Descope tenant ID → WorkOS org ID map for next step.

## Step 7: Import Users (Decision Tree)

```
Does user have password?
  |
  +-- YES --> Use Create User API with password_hash parameters
  |           - password_hash_type: 'bcrypt' | 'argon2' | 'pbkdf2'
  |           - password_hash: hash value from Descope export
  |
  +-- NO  --> Use Create User API with basic profile only
              User will authenticate via social provider
```

### Field Mapping

```
Descope Field       WorkOS API Parameter
-------------       --------------------
email           →   email (required)
givenName       →   first_name
familyName      →   last_name
verifiedEmail   →   email_verified (boolean)
```

### Batching Pattern

For large migrations, implement:

```bash
# Example: Process in batches of 50
total_users=5000
batch_size=50
batches=$((total_users / batch_size))

for i in $(seq 0 $batches); do
  # Import batch
  # Wait 2 seconds between batches
  sleep 2
done
```

**Verify after each batch:** Check dashboard user count increases.

## Step 8: Create Organization Memberships

Once users AND organizations exist, link them using Organization Membership API.

**Prerequisites (BLOCKING):**

- All organizations imported (Step 6 complete)
- All users imported (Step 7 complete)
- Mapping file from Step 6 available

### With RBAC

If Descope used roles:

1. Create roles in dashboard first: `https://dashboard.workos.com/environment/roles-and-permissions`
2. Note role slugs (lowercase, hyphenated)
3. Pass `roleSlug` parameter when creating membership

Example:

```bash
curl https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"user_01H1234567890ABCDEFG",
    "organization_id":"org_01H9876543210ZYXWVUT",
    "role_slug":"admin"
  }'
```

**Verify:** Check dashboard → Organizations → [Org Name] → Members shows users.

## Step 9: Test Migration

### Password Auth Test

If passwords imported:

1. Create test user with known Descope password
2. Attempt login via WorkOS AuthKit
3. **Expected:** Login succeeds without password reset

If login fails with "invalid credentials":

- Check: `password_hash_type` matches Descope algorithm
- Check: Hash value copied correctly (no whitespace, correct encoding)

### Social Auth Test

For OAuth users:

1. Attempt login with Google/Microsoft/etc.
2. WorkOS matches by email address
3. **Expected:** User linked automatically to existing WorkOS user

**If new user created instead:**

- Check: Email from provider matches email in WorkOS exactly (case-sensitive)
- Check: Provider configured in WorkOS dashboard

### Organization Membership Test

1. Login as migrated user
2. Check session contains organization context
3. **Expected:** User sees correct organization data

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Check organization count matches
curl -s https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data | length'
# Compare to Descope tenant count

# 2. Check user count matches
curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data | length'
# Compare to Descope user export count

# 3. Spot-check memberships (sample org)
curl -s "https://api.workos.com/user_management/organization_memberships?organization_id=org_XXX" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data | length'
# Should match expected member count

# 4. Test login for password user
# (Manual test in browser)

# 5. Test login for OAuth user
# (Manual test in browser)
```

**Do not mark complete until all counts match and both login tests pass.**

## Error Recovery

### "Rate limit exceeded" during import

**Root cause:** Importing too fast without delays.

**Fix:**

1. Note which batch failed from error response
2. Wait 60 seconds for rate limit reset
3. Resume from failed batch with longer delays (5 seconds between batches)

### "Invalid password_hash_type" when creating user

**Root cause:** Algorithm name doesn't match WorkOS accepted values.

**Fix:** Check Descope export for algorithm. WorkOS accepts:

- `bcrypt` (most common)
- `argon2` (Argon2id variant)
- `pbkdf2` (PBKDF2-SHA256)

If Descope used different variant, contact WorkOS support for compatibility.

### "Email already exists" during user import

**Root cause:** Duplicate emails in Descope export OR partial retry.

**Fix:**

- Deduplicate export file before import
- If retrying failed batch, fetch existing users first and skip imports for emails already present

```bash
# Check if user exists before creating
curl -s "https://api.workos.com/user_management/users?email=user@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data[0].id'
```

### Social auth creates new user instead of linking

**Root cause:** Email mismatch or email verification required.

**Fix:**

1. Check email in WorkOS user matches provider email exactly
2. If environment has email verification enabled, user may need to verify email first
3. For trusted providers (gmail.com via Google OAuth), verification is automatic

### "Organization not found" when creating membership

**Root cause:** Organization ID from mapping file is wrong or org wasn't created.

**Fix:**

1. Verify organization exists: `curl https://api.workos.com/organizations/org_XXX`
2. Check mapping file for typos
3. If missing, create organization first (return to Step 6)

### Password login fails after import

**Root cause:** Hash algorithm mismatch or hash encoding issue.

**Fix:**

1. Verify `password_hash_type` parameter matches Descope's algorithm exactly
2. Check hash value has no extra whitespace or line breaks
3. Descope may base64-encode hashes - decode if necessary before import
4. Test with a known user/password combination first

## Related Skills

- `workos-authkit-nextjs` - Implement AuthKit after migration
- `workos-organizations-api` - Manage organizations post-migration
- `workos-user-management` - User CRUD operations after import
