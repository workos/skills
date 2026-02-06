---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- generated -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

- Confirm `WORKOS_API_KEY` exists and starts with `sk_`
- Confirm `WORKOS_CLIENT_ID` exists (for AuthKit integration)
- Check WorkOS Dashboard: Authentication methods enabled (password, OAuth, Magic Auth)
- Check WorkOS Dashboard: Organizations feature enabled

### Stytch Access

- Confirm `STYTCH_PROJECT_ID` and `STYTCH_SECRET` exist
- Test Stytch API access: `curl -u "$STYTCH_PROJECT_ID:$STYTCH_SECRET" https://api.stytch.com/v1/b2b/organizations/search`
- If using passwords: Open support ticket with Stytch for password hash export (can take days/weeks)

**Verify:** All API keys present and valid before continuing.

## Step 3: Export Stytch Data

### Export Organizations (Required First)

Use Stytch Search Organizations API with pagination:

```bash
# Test organizations export
curl -X POST https://api.stytch.com/v1/b2b/organizations/search \
  -u "$STYTCH_PROJECT_ID:$STYTCH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

**Rate limit:** 100 requests/minute. If > 1000 orgs, implement pagination with `cursor` parameter.

Save output to `stytch_organizations.json`.

### Export Members (Required Second)

For EACH organization exported above, fetch members:

```bash
# Test members export for one org
curl -X POST https://api.stytch.com/v1/b2b/organizations/$ORG_ID/members/search \
  -u "$STYTCH_PROJECT_ID:$STYTCH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

**Rate limit:** 100 requests/minute. If > 1000 members per org, implement pagination.

Save output to `stytch_members.json`.

### Export Passwords (Optional, Long Lead Time)

```
Using passwords in Stytch?
  |
  +-- NO  --> Skip this section, proceed to Step 4
  |
  +-- YES --> Email support@stytch.com with:
              - Subject: "Password hash export request"
              - Body: Project ID, migration timeline
              - Wait for export file (format: scrypt hashes)
              - Save to stytch_password_hashes.json
              - Verify hash format with Stytch (scrypt/bcrypt/argon2)
```

**Timeline:** Can take 1-7 days. Do NOT block migration on this — you can import passwords later via Update User API.

## Step 4: Install WorkOS SDK

Detect package manager, install WorkOS Node SDK:

```bash
# Verify installation
npm list @workos-inc/node || yarn list @workos-inc/node
```

**Verify:** SDK package exists in node_modules before writing migration script.

## Step 5: Write Migration Script (Decision Tree)

```
Migration scope?
  |
  +-- Organizations only --> Implement Step 5a only
  |
  +-- Users only --> Implement Step 5b only
  |
  +-- Full migration --> Implement 5a, then 5b, then 5c
```

### Step 5a: Import Organizations

Create `migrate-organizations.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import { readFile } from 'fs/promises';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importOrganizations() {
  const stytchOrgs = JSON.parse(
    await readFile('stytch_organizations.json', 'utf-8')
  );

  for (const org of stytchOrgs.results) {
    const domainData = org.email_allowed_domains?.map((domain: string) => ({
      domain,
      state: 'verified', // Stytch domains are already verified
    }));

    try {
      const workosOrg = await workos.organizations.createOrganization({
        name: org.organization_name,
        domainData: domainData || [],
      });
      console.log(`Imported: ${org.organization_name} -> ${workosOrg.id}`);
      
      // CRITICAL: Save mapping for Step 5b
      // Store: stytch_org_id -> workos_org_id
    } catch (error) {
      console.error(`Failed to import ${org.organization_name}:`, error);
      // Log failed orgs for retry
    }
  }
}
```

**Key mapping:** Store `stytch_organization_id -> workos_organization_id` for user import.

### Step 5b: Import Users and Memberships

```
Member status filtering?
  |
  +-- Import active only --> filter: member.status === 'active'
  |
  +-- Import active + pending --> filter: ['active', 'pending'].includes(member.status)
  |
  +-- Re-invite pending --> Create users, then send WorkOS invites separately
```

Create `migrate-users.ts`:

```typescript
async function importUser(stytchMember: any, workosOrgId: string) {
  // Parse name (Stytch stores full name, WorkOS needs first/last)
  const nameParts = stytchMember.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create user
  const user = await workos.userManagement.createUser({
    email: stytchMember.email_address,
    emailVerified: stytchMember.email_address_verified,
    firstName,
    lastName,
  });

  // Create organization membership
  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: workosOrgId,
    roleSlug: stytchMember.role, // Map Stytch roles to WorkOS roles
  });

  return user;
}
```

**Role mapping:** Stytch `member`/`admin` roles may need mapping to WorkOS role slugs. Check Dashboard for available roles.

### Step 5c: Import Passwords (If Available)

```
Password hashes received from Stytch?
  |
  +-- NO  --> Users will reset passwords on first login
  |
  +-- YES --> Add to createUser() or update later via PATCH
```

Modify user creation:

```typescript
const user = await workos.userManagement.createUser({
  email: stytchMember.email_address,
  emailVerified: true, // Must be true to import hash
  firstName,
  lastName,
  passwordHash: stytchPasswordHash, // From Stytch export
  passwordHashType: 'scrypt', // Verify format with Stytch
});
```

**Critical:** `emailVerified` MUST be `true` to import password hashes. WorkOS will reject unverified emails with hashes.

**Alternative:** Import users without hashes first, then batch update via Update User API when hashes arrive.

## Step 6: Execute Migration (Staged Rollout)

Run in this order:

```bash
# 1. Dry run - validate data without creating resources
node migrate-organizations.ts --dry-run

# 2. Import organizations
node migrate-organizations.ts

# 3. Verify orgs in Dashboard before proceeding
# WorkOS Dashboard > Organizations > Check count matches Stytch

# 4. Import users (start with one org as test)
node migrate-users.ts --org-id=org_123abc

# 5. Test login for migrated users
# 6. Import remaining users in batches
```

**Rate limiting:** WorkOS API has no published rate limit, but implement exponential backoff for safety.

## Step 7: Authentication Method Migration

### Password Auth

Already handled in Step 5c. Users can log in immediately if hashes imported.

**Dashboard config:**
1. Navigate to Authentication > Password
2. Set password strength requirements (match or exceed Stytch settings)

### Magic Auth (Replaces Magic Links)

**Functional difference:** Stytch sends clickable email links, WorkOS sends 6-digit codes.

**No code changes needed** if using AuthKit. Users enter code manually instead of clicking link.

**Dashboard config:**
1. Navigate to Authentication > Magic Auth
2. Enable Magic Auth
3. Configure code expiration (default: 10 minutes)

### OAuth Providers

Users with Google/Microsoft/GitHub can continue using same providers.

**Dashboard config:**
1. Navigate to Authentication > OAuth providers
2. Enable each provider (Google, Microsoft, GitHub, etc.)
3. Configure client ID/secret for each
4. Set redirect URIs (must match AuthKit callback)

**Auto-linking:** WorkOS links OAuth accounts to existing users by email match. No additional logic needed.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Check organization count matches
# In WorkOS Dashboard: Organizations tab, compare total count to stytch_organizations.json

# 2. Check user count matches
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length'
# Compare to total in stytch_members.json

# 3. Test login for migrated user
# Use WorkOS Dashboard > AuthKit > Test Environment
# Enter email from stytch_members.json
# Verify password works (if imported) OR Magic Auth code arrives

# 4. Check organization memberships
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=org_123" \
  | jq '.data | length'
# Should match member count for that org in Stytch

# 5. Verify domains on organizations
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations/org_123" \
  | jq '.domains'
# Should match email_allowed_domains from Stytch
```

**All checks must pass** before marking migration complete.

## Error Recovery

### "Cannot import password hash for unverified email"

**Root cause:** `emailVerified: false` when passing `passwordHash`.

**Fix:**
1. Check Stytch export: Is `email_address_verified: true`?
2. If false in Stytch, import without password hash (user will reset)
3. If true in Stytch, ensure `emailVerified: true` in WorkOS API call

### "Organization not found" during user import

**Root cause:** Organization import failed or ID mapping incorrect.

**Fix:**
1. Verify org exists: `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/organizations/org_123`
2. Check stytch_org_id -> workos_org_id mapping file
3. Re-run organization import if missing

### "Invalid password hash format"

**Root cause:** `passwordHashType` doesn't match actual hash algorithm.

**Fix:**
1. Contact Stytch support to confirm hash algorithm (scrypt/bcrypt/argon2)
2. Update `passwordHashType` parameter to match
3. Common mistake: Assuming scrypt when it's bcrypt

### "Rate limit exceeded" during bulk import

**Root cause:** Importing too fast.

**Fix:**
1. Add delay between API calls: `await new Promise(r => setTimeout(r, 100))` (100ms = max 10 req/sec)
2. Implement exponential backoff on 429 responses
3. Process in smaller batches (e.g., 50 users at a time)

### Users cannot log in after migration

**Decision tree:**

```
Login failing?
  |
  +-- Password not working --> Check if hash was imported (Step 5c)
  |                            If no: User must reset password
  |                            If yes: Verify passwordHashType matches Stytch algorithm
  |
  +-- Magic Auth not working --> Check Authentication > Magic Auth enabled in Dashboard
  |                              Check email delivery (spam folder)
  |
  +-- OAuth not working --> Check provider enabled in Dashboard
                            Check redirect URI matches AuthKit callback
                            Check client ID/secret configured
```

### Missing organization memberships

**Root cause:** Membership creation failed but user creation succeeded.

**Fix:**
1. Query users without memberships: Filter users by `organization_id IS NULL`
2. Re-run membership creation for orphaned users
3. Use Update User API if needed to link existing users

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit in Next.js after migration
- `workos-user-management` - Manage migrated users via WorkOS API
- `workos-organizations` - Configure organization settings post-migration
