---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:3056c8ae6df4 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

This is the source of truth for migration procedures. If this skill conflicts with the doc, follow the doc.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or environment variables for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify both exist before continuing.

### WorkOS SDK

**Verify:** WorkOS SDK package exists in node_modules before writing import statements.

```bash
# Check SDK installed
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: WorkOS SDK not installed"
```

If missing, install per project's package manager.

## Step 3: Password Export Decision (Decision Tree)

```
Do users authenticate with passwords?
  |
  +-- NO --> Skip to Step 4 (User Import)
  |
  +-- YES --> Contact Descope support for password export
              (Descope does not expose password hashes via API)
```

**If YES:** Open support ticket with Descope requesting CSV export with password hashes. Note the hashing algorithm used (bcrypt, argon2, or pbkdf2) — you'll need this for Step 5.

**Source:** https://workos.com/docs/migrate/descope states "Descope does not make hashed passwords available through their Backend APIs."

## Step 4: Export Users from Descope

Use Descope Management API to retrieve user data. You'll need these fields:

| Descope Field   | Required for WorkOS |
|-----------------|---------------------|
| `email`         | Yes                 |
| `givenName`     | Optional            |
| `familyName`    | Optional            |
| `verifiedEmail` | Optional            |

Store export in structured format (JSON array recommended) for Step 5.

## Step 5: Import Users into WorkOS

### Rate Limit Awareness

WorkOS Create User API is rate-limited. For large migrations (>1000 users), implement batching with delays.

Check current limits: https://workos.com/docs/reference/rate-limits

### Field Mapping

Use this mapping for WorkOS Create User API calls:

```
Descope          --> WorkOS API parameter
email            --> email
givenName        --> first_name
familyName       --> last_name
verifiedEmail    --> email_verified
```

### Password Import (if applicable)

If you received password hashes from Descope support (Step 3), include these parameters in Create User API:

- `password_hash_type` - set to algorithm from Descope export (e.g., `'bcrypt'`, `'argon2'`, `'pbkdf2'`)
- `password_hash` - the hash value from export

**Critical:** Match the hash type to the algorithm Descope used. Mismatch will cause auth failures.

### Social Auth Users

Users who authenticated via OAuth providers (Google, Microsoft, etc.) will auto-link when they sign in through WorkOS **if their email matches**.

**Action Required:** Configure OAuth providers in WorkOS Dashboard (see https://workos.com/docs/integrations for each provider).

No explicit import needed — linking happens automatically on first sign-in.

## Step 6: Export Organizations (Descope Tenants)

Use Descope Management API to retrieve tenant data: https://docs.descope.com/management/tenant-management/sdks

### Field Mapping for Organizations

```
Descope Tenant   --> WorkOS Organization
name             --> name
id               --> external_id
```

**Why external_id:** Storing Descope's tenant ID as `external_id` maintains a reference during migration for troubleshooting.

### Create Organizations in WorkOS

Use WorkOS Create Organization API: https://workos.com/docs/reference/organization/create

```bash
# Verify organizations created
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

Expected: Count matches number of Descope tenants exported.

## Step 7: Migrate Organization Memberships

### Prerequisites

- Organizations created (Step 6)
- Users imported (Step 5)
- Mapping of Descope user-tenant associations available

### Add Users to Organizations

Use WorkOS Create Organization Membership API: https://workos.com/docs/reference/authkit/organization-membership/create

**For each user-tenant pair in Descope:**

1. Look up WorkOS user ID (from Step 5 import)
2. Look up WorkOS organization ID (from Step 6 import or via `external_id`)
3. Create membership linking the two

### Role Migration (if using RBAC)

**Decision point:**

```
Do you use Descope roles?
  |
  +-- NO --> Create memberships without roleSlug parameter
  |
  +-- YES --> 1. Create equivalent roles in WorkOS Dashboard
              2. Include roleSlug when creating memberships
```

**Create roles:** https://dashboard.workos.com/environment/roles-and-permissions

Map Descope role names to WorkOS role slugs, then pass `roleSlug` parameter in membership creation.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Verify environment variables present
env | grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" || echo "FAIL: Missing env vars"

# 2. Verify WorkOS SDK installed
npm ls @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check user import count matches Descope export
# Replace COUNT with your Descope user count
curl -s -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data | length' | grep -q "COUNT" || echo "FAIL: User count mismatch"

# 4. Check organization import count matches Descope tenant count
# Replace COUNT with your Descope tenant count
curl -s -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data | length' | grep -q "COUNT" || echo "FAIL: Org count mismatch"

# 5. Spot-check: Verify specific user exists by email
# Replace EMAIL with a known migrated user
curl -s -X GET "https://api.workos.com/user_management/users?email=EMAIL" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data[0].email' || echo "FAIL: User not found"

# 6. Verify OAuth providers configured (if using social auth)
# Check WorkOS Dashboard: https://dashboard.workos.com/configuration/authentication
# No automated check - manual verification required
```

**If any check fails:** Do not mark migration complete. Return to relevant step.

## Error Recovery

### "Invalid API key" during API calls

**Root cause:** `WORKOS_API_KEY` incorrect or missing `sk_` prefix.

**Fix:**
1. Check environment variable is set: `echo $WORKOS_API_KEY`
2. Verify format: `WORKOS_API_KEY=sk_...`
3. Regenerate key in WorkOS Dashboard if needed

### "Rate limit exceeded" during bulk import

**Root cause:** Hitting WorkOS API rate limits (see https://workos.com/docs/reference/rate-limits).

**Fix:**
1. Implement exponential backoff in import script
2. Batch requests (e.g., 10 users/second maximum)
3. Add 100ms delay between API calls

### "User already exists" error

**Root cause:** Duplicate import attempt with same email.

**Fix:**
1. Check if user already migrated: `GET /user_management/users?email=...`
2. If exists, skip creation or update instead
3. Use idempotency: Track migrated users to avoid re-import

### Password authentication fails after migration

**Root cause 1:** `password_hash_type` doesn't match Descope's algorithm.

**Fix:** Verify hash algorithm from Descope export matches WorkOS parameter (`bcrypt`, `argon2`, or `pbkdf2`).

**Root cause 2:** Password hash corrupted during export/import.

**Fix:** Re-export hash from Descope support, verify hash string has no truncation.

### Social auth user not auto-linking

**Root cause:** Email address mismatch between Descope and OAuth provider.

**Fix:**
1. Check user's email in WorkOS: `GET /user_management/users?email=...`
2. Compare to email from OAuth provider token
3. If mismatch, update WorkOS user email or handle manual linking

### Organization membership creation fails with "user not found"

**Root cause:** User not yet imported when membership API called.

**Fix:**
1. Verify user import completed (Step 5) before creating memberships
2. Check user exists: `GET /user_management/users/{user_id}`
3. If missing, re-run user import for that user

### "Invalid external_id format" when creating organizations

**Root cause:** Descope tenant ID contains disallowed characters.

**Fix:**
1. Sanitize tenant ID before using as `external_id`
2. Alternative: Use custom mapping and store Descope ID in organization metadata
3. Check WorkOS external_id format requirements in API docs

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit after migration for Next.js apps
- `workos-user-management` - Manage migrated users via WorkOS APIs
- `workos-organizations` - Advanced organization management post-migration
