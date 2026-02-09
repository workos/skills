---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The WorkOS migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS account exists at https://dashboard.workos.com
- Confirm API keys in dashboard:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - WorkOS secret key
- `WORKOS_CLIENT_ID` - WorkOS client identifier
- `STYTCH_PROJECT_ID` - Stytch project identifier
- `STYTCH_SECRET` - Stytch secret key

### SDK Dependencies

Verify packages in `package.json`:

- `@workos-inc/node` or equivalent WorkOS SDK
- `stytch` (for export phase only)

**Verify:** Both SDKs installed before continuing.

```bash
npm list stytch @workos-inc/node 2>/dev/null || echo "MISSING DEPENDENCIES"
```

## Step 3: Migration Decision Tree

```
User authentication type?
  |
  +-- B2B (organization-based) --> Use Stytch B2B APIs
  |                                (Search Organizations, Search Members)
  |
  +-- Consumer (individual)    --> Use Stytch Consumer export utility
                                   https://github.com/stytchauth/stytch-node-export-users
```

**This skill covers B2B migrations only.** For Consumer users, see the Stytch export utility linked above.

## Step 4: Export from Stytch (Phase 1)

### Export Organizations

Create export script using Stytch B2B SDK:

1. Initialize Stytch client with `project_id` and `secret`
2. Call Search Organizations API (handles pagination automatically)
3. Write results to `stytch_organizations.json`

**Rate limit:** 100 requests/minute. Add delay for large datasets.

```typescript
// Key API: stytch.organizations.search({ limit: 1000 })
// Returns: { organizations: [...], has_more: boolean }
```

See WebFetch doc for complete pagination example.

### Export Members

For each organization:

1. Call Search Members API with `organization_id`
2. Handle pagination (limit: 1000 per request)
3. Write results to `stytch_members.json`

**Critical:** Filter members by status BEFORE writing:

- `active` - Import immediately
- `invited` / `pending` - Re-invite after migration (do NOT import with old invite tokens)

### Export Password Hashes (BLOCKING if using passwords)

**STOP. This requires manual intervention.**

Password hashes CANNOT be exported via API. You must:

1. Email support@stytch.com with subject "Password Hash Export Request"
2. Include your Stytch project ID
3. Wait for Stytch support to provide hash export file

**Timeline:** Variable (hours to days). Start this process early.

**Critical info to request:**

- Hash algorithm used (Stytch uses `scrypt`, but confirm)
- Hash format/structure in export file
- Any salt or iteration parameters

Do NOT proceed to password import step until you have this file.

## Step 5: Import to WorkOS (Phase 2)

### Import Organizations First

Use Create Organization API for each Stytch organization:

**Field mapping:**

```
Stytch                    --> WorkOS
organization_name         --> name
email_allowed_domains[]   --> domainData[].domain
  (always set state: "verified" if domains were active in Stytch)
```

**Verification:**

```bash
# After import, check organization count matches
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'
```

Compare to count in `stytch_organizations.json`.

### Import Users and Memberships

For each `active` member:

1. Parse `name` field into `firstName` and `lastName`:
   - Split on first space: "John Doe" → firstName: "John", lastName: "Doe"
   - Handle empty names: use empty strings, not null
2. Create user via Create User API
3. Create organization membership via Organization Membership API

**Field mapping:**

```
Stytch                     --> WorkOS
email_address              --> email
email_address_verified     --> emailVerified
name (parsed)              --> firstName, lastName
```

**Critical:** Create user BEFORE creating membership. User must exist.

### Import Passwords (if applicable)

**Decision point:**

```
Password export from Stytch?
  |
  +-- YES --> Include passwordHash and passwordHashType in createUser()
  |           or use updateUser() for existing users
  |
  +-- NO  --> Users must reset passwords on first login
```

**Supported hash types:** `bcrypt`, `scrypt`, `argon2`

Stytch uses `scrypt` - verify with support export documentation.

```typescript
// Include in createUser() call:
passwordHash: "<hash_from_stytch_export>",
passwordHashType: "scrypt"
```

**Verify:** After import, test login with known password to confirm hash import worked.

## Step 6: Authentication Method Configuration

### Password Authentication

Enable in WorkOS Dashboard:

1. Navigate to Authentication tab
2. Enable "Password" authentication
3. Configure password requirements (min length, complexity)

**Note:** Password strength rules in WorkOS may differ from Stytch. Existing passwords imported via hash will work regardless of new rules. New passwords must meet WorkOS rules.

### Magic Auth (replaces Stytch Magic Links)

**Key difference:**

- Stytch: Sends clickable email link
- WorkOS Magic Auth: Sends 6-digit code (10-minute expiry)

**Migration impact:** No code changes needed if migrating from Stytch email OTP. If migrating from magic links, update UI to show code entry field instead of "check your email" message.

Enable in dashboard: Authentication > Magic Auth

### OAuth Providers

Enable in dashboard for each provider used in Stytch:

1. Authentication > OAuth providers
2. Select provider (Google, Microsoft, GitHub)
3. Add OAuth client credentials (create new app if needed)

**User linking:** WorkOS auto-links OAuth sign-ins to existing users by email address. No manual linking needed.

## Step 7: Handle Pending Invites

For members with status `invited` or `pending` in Stytch export:

**Do NOT import these users.** Old invite tokens are invalid.

Instead:

1. After organization import completes
2. Use WorkOS Invite API to send fresh invitations
3. Map `email_address` from Stytch export to WorkOS invite email

```bash
# Send new invite via API
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"...","email":"user@example.com"}'
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check organization count matches
STYTCH_ORG_COUNT=$(jq '. | length' stytch_organizations.json)
WORKOS_ORG_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length')
[ "$STYTCH_ORG_COUNT" -eq "$WORKOS_ORG_COUNT" ] || echo "FAIL: Org count mismatch"

# 2. Check user count (active members only)
STYTCH_ACTIVE=$(jq '[.[] | select(.status == "active")] | length' stytch_members.json)
WORKOS_USER_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length')
[ "$STYTCH_ACTIVE" -eq "$WORKOS_USER_COUNT" ] || echo "FAIL: User count mismatch"

# 3. Test password login (if passwords imported)
# Attempt login via AuthKit with known test credentials
# Expected: Success without password reset

# 4. Test OAuth login (if OAuth configured)
# Sign in with Google/Microsoft account that exists in migration
# Expected: Auto-links to existing user, no duplicate created

# 5. Verify domain verification
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | \
  jq '.data[].domains[] | select(.state != "verified")' | \
  [ $(wc -l) -eq 0 ] || echo "FAIL: Unverified domains exist"
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email address in Stytch export or re-running import script.

**Fix:**

1. Check Stytch export for duplicate `email_address` entries
2. Deduplicate before import OR
3. Use Update User API instead of Create User API for existing emails

### "Organization not found" during membership creation

**Cause:** Organization import incomplete or ID mismatch.

**Fix:**

1. Verify organization exists: `curl https://api.workos.com/organizations/<org_id>`
2. Check WorkOS organization ID matches the one used in membership creation
3. Ensure organization import completed before user import

### Password login fails after import

**Root causes:**

1. Hash algorithm mismatch - verify Stytch uses `scrypt` and `passwordHashType` matches
2. Hash format incorrect - check Stytch export documentation for exact format
3. Hash not imported - verify `passwordHash` field present in createUser() call

**Fix:** Contact Stytch support to confirm hash algorithm and format.

### Rate limit errors during export (429)

**Cause:** Exceeding Stytch's 100 requests/minute limit.

**Fix:**

```typescript
// Add delay between requests
await new Promise(resolve => setTimeout(resolve, 600)); // 600ms = ~100 req/min
```

### "Invalid domain format" during organization import

**Cause:** `email_allowed_domains` from Stytch contains invalid domain strings.

**Fix:**

1. Validate domains before import: must be valid DNS format
2. Filter out invalid entries: `domains.filter(d => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))`
3. Log skipped domains for manual review

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit after migration
- `workos-directory-sync` - Set up SSO/SCIM for migrated organizations
