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

## Step 2: Pre-Migration Assessment

### Inventory Your Descope Data

Run this checklist BEFORE starting migration:

**User authentication data:**

- [ ] Password-based users exist? (requires Descope support ticket)
- [ ] Social auth users exist? (note which providers: Google, Microsoft, etc.)
- [ ] Passwordless/magic link users exist? (can re-enroll in WorkOS)

**Organization data:**

- [ ] Using Descope Tenants? (maps to WorkOS Organizations)
- [ ] Users have tenant associations? (maps to Organization Memberships)
- [ ] Using Descope roles/permissions? (maps to WorkOS Roles)

**Critical limitation:** Descope does NOT expose password hashes via API. If you need passwords, open support ticket NOW — this takes time.

## Step 3: Export Users from Descope

### Password-Based Users (BLOCKING if needed)

If users sign in with passwords, you MUST contact Descope support before proceeding:

1. Open support ticket at https://docs.descope.com/management/user-management/user-exporting
2. Request CSV export with password hashes
3. **CRITICAL:** Note which hashing algorithm they used (bcrypt, argon2, or pbkdf2) — you'll need this for WorkOS import

**Wait for Descope response before continuing.** You cannot import passwords without this data.

### Export User Data via API

Use Descope Management API to export user metadata:

```bash
# List all users (pseudo-code — check Descope SDK docs for exact method)
descope.management.users.searchAll()
```

**Fields to capture:**

- `email` → WorkOS `email`
- `givenName` → WorkOS `first_name`
- `familyName` → WorkOS `last_name`
- `verifiedEmail` → WorkOS `email_verified`
- Tenant associations (for Organization Memberships later)

### Export Tenants (if using B2B)

Use Descope Management API to export tenants:

```bash
# Fetch tenants (pseudo-code)
descope.management.tenants.loadAll()
```

**Fields to capture:**

- `name` → WorkOS Organization `name`
- `id` → WorkOS Organization `external_id` (keeps reference to Descope)

## Step 4: Create Organizations in WorkOS (Optional)

**Skip this step if not using B2B/multi-tenant.**

Decision tree:

```
Using Descope Tenants?
  |
  +-- YES --> Create WorkOS Organizations (continue below)
  |
  +-- NO  --> Skip to Step 5 (user import)
```

### Create Organizations

Use WorkOS Create Organization API:

```typescript
// For each Descope tenant
const org = await workos.organizations.createOrganization({
  name: descopeTenant.name,
  domainData: [], // Configure if using domain verification
  externalId: descopeTenant.id, // Keeps Descope tenant ID reference
});

// Store mapping for later
orgIdMap.set(descopeTenant.id, org.id);
```

**Rate limit:** Check https://workos.com/docs/reference/rate-limits before bulk operations.

**Verify Organizations created:**

```bash
# Check count matches
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

## Step 5: Import Users into WorkOS

### Without Passwords (Standard Path)

For users WITHOUT password import (social auth, magic link, or will reset passwords):

```typescript
// For each Descope user
const user = await workos.userManagement.createUser({
  email: descopeUser.email,
  firstName: descopeUser.givenName,
  lastName: descopeUser.familyName,
  emailVerified: descopeUser.verifiedEmail,
});

// Store mapping
userIdMap.set(descopeUser.email, user.id);
```

### With Password Hashes (Advanced Path)

**ONLY if you received password export from Descope support.**

Determine hash algorithm from Descope export, then:

```typescript
const user = await workos.userManagement.createUser({
  email: descopeUser.email,
  firstName: descopeUser.givenName,
  lastName: descopeUser.familyName,
  emailVerified: descopeUser.verifiedEmail,
  passwordHash: descopeUser.passwordHash, // From Descope CSV
  passwordHashType: "bcrypt", // OR 'argon2' OR 'pbkdf2' — match Descope's algorithm
});
```

**Supported hash types (from Descope export):**

- `bcrypt`
- `argon2`
- `pbkdf2`

If Descope used a different algorithm, contact WorkOS support — WorkOS may not support it.

### Rate Limiting (CRITICAL for large migrations)

WorkOS APIs are rate-limited. For bulk imports:

```typescript
// Batch with delays
const BATCH_SIZE = 100;
const DELAY_MS = 1000;

for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map((user) => createUserInWorkOS(user)));

  if (i + BATCH_SIZE < users.length) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
}
```

**Check rate limits:** https://workos.com/docs/reference/rate-limits

**Verify user import:**

```bash
# Count imported users
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

## Step 6: Configure Social Auth Providers (If Needed)

Decision tree:

```
Have Descope users signing in via social auth (Google, Microsoft, etc.)?
  |
  +-- YES --> Configure providers in WorkOS Dashboard (continue below)
  |
  +-- NO  --> Skip to Step 7
```

### Enable Social Providers

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. For each provider used in Descope:
   - Google: https://workos.com/docs/integrations/google-oauth
   - Microsoft: https://workos.com/docs/integrations/microsoft-oauth
3. Configure client credentials from provider
4. Note redirect URIs

**CRITICAL:** WorkOS matches social auth users by **email address**. If a social auth user signs in with the same email as a migrated WorkOS user, they'll be automatically linked.

**Email verification edge case:**

- Users signing in via Google OAuth with `@gmail.com` domains skip re-verification
- Other providers may require email verification depending on WorkOS environment settings

Check Dashboard → Authentication → Email Verification to confirm behavior.

## Step 7: Create Organization Memberships (Optional)

**Skip if you skipped Step 4 (no Organizations).**

If Descope users were associated with tenants, create matching memberships:

```typescript
// For each user-tenant association from Descope export
const membership = await workos.userManagement.createOrganizationMembership({
  userId: userIdMap.get(descopeUser.email), // From Step 5
  organizationId: orgIdMap.get(descopeTenant.id), // From Step 4
  roleSlug: "member", // OR custom role if migrating RBAC
});
```

### Migrate Roles (If Using RBAC)

If Descope had custom roles/permissions:

1. Go to WorkOS Dashboard → Roles & Permissions
2. Create equivalent roles for Descope roles
3. Note `roleSlug` values
4. Pass `roleSlug` when creating memberships above

**Verify memberships:**

```bash
# Check memberships for an org
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id=$ORG_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

## Step 8: Test Authentication Flow

### Password-Based Users (If Imported)

1. Attempt sign-in with migrated user email + password
2. Confirm authentication succeeds
3. Confirm user session contains correct profile data

```bash
# Test via AuthKit sign-in endpoint
# (Exact URL depends on your AuthKit integration — see related skills)
```

### Social Auth Users

1. Initiate OAuth flow for provider (Google, Microsoft, etc.)
2. Sign in with user credentials
3. Confirm automatic linking to migrated user by email
4. Check if email verification required (depends on provider)

### Organization Context

If using Organizations:

1. Sign in as user belonging to organization
2. Verify organization context available in session
3. Verify role appears correctly if using RBAC

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Users imported
USER_COUNT=$(curl -s -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
echo "Imported users: $USER_COUNT"
[[ $USER_COUNT -gt 0 ]] || echo "FAIL: No users imported"

# 2. Organizations created (if applicable)
ORG_COUNT=$(curl -s -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
echo "Created organizations: $ORG_COUNT"

# 3. Social providers configured (if applicable)
# Manual check: Dashboard → Authentication → Social Connections

# 4. Test authentication succeeds
# Manual test: Sign in via AuthKit with migrated user

# 5. No API errors in migration logs
grep -i "error\|fail" migration.log || echo "Migration completed without errors"
```

**All checks must pass before go-live.**

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in import batch or user already exists in WorkOS.

**Fix:**

1. Check if email already imported: `GET /user_management/users?email={email}`
2. Skip duplicate or use Update User API if data differs
3. De-duplicate source data before re-running

### "Invalid password_hash_type"

**Cause:** WorkOS doesn't support the hashing algorithm from Descope export.

**Fix:**

1. Verify hash type from Descope support email
2. Supported types: `bcrypt`, `argon2`, `pbkdf2`
3. If unsupported, contact WorkOS support or reset passwords post-migration

### "Rate limit exceeded" during bulk import

**Cause:** Too many API calls without delays.

**Fix:**

1. Implement batching with delays (see Step 5 rate limiting example)
2. Check current limits: https://workos.com/docs/reference/rate-limits
3. Reduce batch size or increase delay between batches

### Social auth user not linking automatically

**Cause:** Email mismatch between social provider and migrated user.

**Fix:**

1. Confirm email from social provider matches WorkOS user email exactly
2. Check if email verified on provider side (unverified emails may not link)
3. Manual linking via Update User API if needed

### "Organization not found" during membership creation

**Cause:** Organization ID mapping incorrect or organization not created.

**Fix:**

1. Verify organization created: `GET /organizations/{org_id}`
2. Check `orgIdMap` contains correct Descope tenant ID → WorkOS org ID mapping
3. Re-run Step 4 if organizations missing

### Password authentication fails after import

**Cause:** Hash algorithm mismatch or corrupted hash value.

**Fix:**

1. Verify `passwordHashType` matches Descope export algorithm exactly
2. Confirm hash value copied correctly (no truncation or encoding issues)
3. Test with known-good credentials from Descope export
4. Fallback: Reset password via WorkOS if hash import unreliable

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit for user sign-in after migration
- `workos-authkit-react` - React-specific AuthKit integration
- `workos-authkit-vanilla-js` - Framework-agnostic AuthKit integration
