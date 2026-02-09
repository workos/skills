---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

This document is the source of truth for current API endpoints, supported hash formats, and migration patterns. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Determine Migration Scope

Answer these questions by inspecting your Stytch project:

```
Stytch Product Type?
  |
  +-- B2B (Organizations + Members) --> Follow full migration path
  |
  +-- Consumer (Individual Users)    --> Use Stytch's export utility
                                         (github.com/stytchauth/stytch-node-export-users)
```

**This skill covers B2B migrations only.** Consumer migrations require different export tooling.

### Authentication Method Audit

Check Stytch Dashboard to identify which auth methods are in use:

- **Password auth** → Requires password hash export from Stytch support (see Step 3)
- **Magic Link** → Maps to WorkOS Magic Auth (6-digit code, not link)
- **Email OTP** → Direct equivalent to WorkOS Magic Auth
- **OAuth (Google, Microsoft, GitHub)** → Direct equivalent, no data export needed

**Critical decision:** If password auth is enabled, you MUST request password hashes from Stytch support before starting imports. This process can take days/weeks — start the request NOW.

### Environment Variables

Verify these exist before proceeding:

**Stytch (for export):**
- `STYTCH_PROJECT_ID`
- `STYTCH_SECRET`

**WorkOS (for import):**
- `WORKOS_API_KEY` (starts with `sk_`)
- `WORKOS_CLIENT_ID` (starts with `client_`)

## Step 3: Request Password Hash Export (IF APPLICABLE)

**Skip this step if NOT using password authentication.**

If your Stytch project uses password auth:

1. Email `support@stytch.com` with subject: "Password hash export request for migration"
2. Include your Stytch project ID in the request
3. Wait for Stytch to provide export file (timeline varies — can be days to weeks)
4. When received, verify file contains `scrypt` hashes (Stytch's default algorithm)

**CRITICAL:** You cannot import passwords without this export. Timeline is outside your control — start this request during assessment phase.

WorkOS supports these hash formats: `scrypt`, `bcrypt`, `argon2`. Confirm with Stytch which format they're providing.

**Do NOT proceed to Step 5 (user import) until you receive this file** if password auth is required.

## Step 4: Export Organizations and Members

### Install Stytch SDK

Detect package manager and install:

```bash
npm install stytch
# or
yarn add stytch
# or
pnpm add stytch
```

### Export Script Pattern

Create export script at project root (e.g., `scripts/export-stytch.ts`):

```typescript
import { B2BClient } from 'stytch';
import { writeFile } from 'fs/promises';

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!,
});

async function exportData() {
  // 1. Export organizations (paginated)
  const organizations = [];
  let cursor: string | undefined;
  
  do {
    const response = await client.organizations.search({
      limit: 100,
      cursor,
    });
    organizations.push(...response.organizations);
    cursor = response.next_cursor;
  } while (cursor);

  // 2. Export members for each org (paginated)
  const members = [];
  
  for (const org of organizations) {
    let memberCursor: string | undefined;
    
    do {
      const response = await client.members.search({
        organization_ids: [org.organization_id],
        limit: 100,
        cursor: memberCursor,
      });
      members.push(...response.members);
      memberCursor = response.next_cursor;
    } while (memberCursor);
  }

  // 3. Save to files
  await writeFile('stytch-organizations.json', JSON.stringify(organizations, null, 2));
  await writeFile('stytch-members.json', JSON.stringify(members, null, 2));
  
  console.log(`Exported ${organizations.length} organizations`);
  console.log(`Exported ${members.length} members`);
}

exportData().catch(console.error);
```

**Rate limit:** Both APIs allow 100 requests/minute. Script will automatically paginate.

**Run export:**

```bash
tsx scripts/export-stytch.ts
# or
ts-node scripts/export-stytch.ts
```

**Verify export succeeded:**

```bash
test -f stytch-organizations.json && echo "Organizations exported"
test -f stytch-members.json && echo "Members exported"
jq 'length' stytch-organizations.json  # Should show count > 0
jq 'length' stytch-members.json        # Should show count > 0
```

## Step 5: Install WorkOS SDK

Detect package manager and install:

```bash
npm install @workos-inc/node
# or
yarn add @workos-inc/node
# or
pnpm add @workos-inc/node
```

**Verify installation:**

```bash
test -d node_modules/@workos-inc/node && echo "WorkOS SDK installed"
```

## Step 6: Import Organizations

### Import Script Pattern

Create import script at project root (e.g., `scripts/import-workos.ts`):

```typescript
import { WorkOS } from '@workos-inc/node';
import { readFile } from 'fs/promises';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function importOrganizations() {
  const orgsData = await readFile('stytch-organizations.json', 'utf-8');
  const stytchOrgs = JSON.parse(orgsData);
  
  const mapping = new Map(); // Stytch ID -> WorkOS ID
  
  for (const stytchOrg of stytchOrgs) {
    const domainData = stytchOrg.email_allowed_domains?.map((domain: string) => ({
      domain,
      state: 'verified', // Adjust if Stytch provides verification status
    })) || [];

    const workosOrg = await workos.organizations.createOrganization({
      name: stytchOrg.organization_name,
      domainData,
      // Optional: preserve Stytch metadata
      // metadata: { stytch_id: stytchOrg.organization_id },
    });

    mapping.set(stytchOrg.organization_id, workosOrg.id);
    console.log(`Imported: ${stytchOrg.organization_name} -> ${workosOrg.id}`);
  }

  // Save mapping for user import
  await writeFile('org-id-mapping.json', JSON.stringify(Array.from(mapping.entries())));
  
  return mapping;
}

importOrganizations().catch(console.error);
```

**Domain verification state:**

- If Stytch provided verified domains → use `state: 'verified'`
- If unverified or unknown → use `state: 'pending'`
- Check fetched docs for current domain state options

**Run import:**

```bash
tsx scripts/import-workos.ts
```

**Verify organizations imported:**

```bash
test -f org-id-mapping.json && echo "Mapping created"
jq 'length' org-id-mapping.json  # Should match org count
```

## Step 7: Import Users and Memberships

### Member Status Filtering (CRITICAL)

Stytch members have statuses. **You must decide which to import:**

```
Member Status?
  |
  +-- active   --> Import with password hash (if available)
  |
  +-- invited  --> Skip import, re-send invites via WorkOS
  |
  +-- pending  --> Skip import, re-send invites via WorkOS
```

**Recommended:** Only import `active` members. Re-invite others after migration completes.

### Import Script Pattern (Without Passwords)

```typescript
async function importUsers() {
  const membersData = await readFile('stytch-members.json', 'utf-8');
  const stytchMembers = JSON.parse(membersData);
  
  const orgMapping = new Map(JSON.parse(await readFile('org-id-mapping.json', 'utf-8')));
  
  // Filter to active members only
  const activeMembers = stytchMembers.filter((m: any) => m.status === 'active');
  
  for (const member of activeMembers) {
    // Parse name
    const nameParts = member.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user
    const user = await workos.userManagement.createUser({
      email: member.email_address,
      emailVerified: member.email_address_verified || false,
      firstName,
      lastName,
    });

    // Create org membership
    const workosOrgId = orgMapping.get(member.organization_id);
    if (workosOrgId) {
      await workos.userManagement.createOrganizationMembership({
        userId: user.id,
        organizationId: workosOrgId,
        roleSlug: 'member', // Adjust based on Stytch role mapping
      });
    }

    console.log(`Imported: ${member.email_address} -> ${user.id}`);
  }
}
```

### Import Script Pattern (With Passwords)

**Only use this if you received password hashes from Stytch support.**

Modify the user creation call:

```typescript
const user = await workos.userManagement.createUser({
  email: member.email_address,
  emailVerified: member.email_address_verified || false,
  firstName,
  lastName,
  passwordHash: passwordHashFromStytch,      // From support export
  passwordHashType: 'scrypt',                // Confirm with Stytch
});
```

**Supported hash types:** Check fetched docs for current list. Known types include `scrypt`, `bcrypt`, `argon2`.

**Critical:** The `passwordHashType` MUST match the algorithm Stytch used. If mismatch, users cannot sign in.

## Step 8: Configure Authentication Methods

### WorkOS Dashboard Configuration

Navigate to WorkOS Dashboard → Authentication tab:

**If migrating password auth:**
1. Enable "Email and Password"
2. Configure password requirements (match or exceed Stytch's requirements)

**If migrating magic link/email OTP:**
1. Enable "Magic Auth" (WorkOS equivalent)
2. Note: WorkOS sends 6-digit code, not clickable link — update user-facing docs

**If migrating OAuth:**
1. Navigate to Authentication → OAuth providers
2. Enable each provider used in Stytch (Google, Microsoft, GitHub, etc.)
3. Configure OAuth credentials (see related skill: `workos-authkit-base`)

**User auto-linking:** WorkOS will automatically link OAuth sign-ins to existing users by email match. No additional config needed.

## Step 9: Update Application Code

### Replace Stytch SDK Calls

This is application-specific, but common patterns:

**Sign-in flow:**
- Remove Stytch authentication SDK calls
- Integrate WorkOS AuthKit (see related skill for your framework)

**Session management:**
- Replace Stytch session validation with WorkOS session validation
- Update middleware to use WorkOS auth

**Related Skills:**
- `workos-authkit-nextjs` - Next.js App Router integration
- `workos-authkit-react` - React integration
- `workos-authkit-vanilla-js` - Plain JavaScript integration

### Magic Link → Magic Auth Migration Notes

**Critical UX change:** Magic Auth uses 6-digit codes entered in-app, NOT clickable email links.

Update user-facing documentation and UI:
- Change "Check your email for a link" → "Check your email for a code"
- Add code input field (AuthKit provides this automatically)

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Export files exist
test -f stytch-organizations.json && echo "PASS: Orgs exported" || echo "FAIL"
test -f stytch-members.json && echo "PASS: Members exported" || echo "FAIL"

# 2. Import mapping exists
test -f org-id-mapping.json && echo "PASS: Org mapping created" || echo "FAIL"

# 3. WorkOS SDK installed
test -d node_modules/@workos-inc/node && echo "PASS: SDK installed" || echo "FAIL"

# 4. Verify org count matches (adjust paths if using src directory)
echo "Stytch orgs: $(jq 'length' stytch-organizations.json)"
echo "WorkOS orgs: (check dashboard count)"

# 5. Verify user count matches
echo "Active Stytch members: $(jq '[.[] | select(.status == "active")] | length' stytch-members.json)"
echo "WorkOS users: (check dashboard count)"

# 6. Test authentication
# Manual: Attempt sign-in with migrated user credentials
```

**If counts don't match:** Check import script logs for API errors. Common issues:
- Rate limiting (wait and retry)
- Duplicate email addresses (WorkOS requires unique emails)
- Invalid domain data format

## Error Recovery

### "Email address already exists" during user import

**Root cause:** User already exists in WorkOS (duplicate import attempt or email collision).

**Fix:**
1. Check if user exists: Query WorkOS users by email before creating
2. If exists, skip user creation and only create org membership
3. Pattern:

```typescript
const existing = await workos.userManagement.listUsers({ email: member.email_address });
const user = existing.data[0] || await workos.userManagement.createUser({...});
```

### "Invalid password hash format"

**Root cause:** `passwordHashType` parameter doesn't match actual hash algorithm.

**Fix:**
1. Verify hash format with Stytch support export documentation
2. Check WorkOS docs (via WebFetch) for supported hash types
3. Common mismatch: Specifying `bcrypt` when Stytch exported `scrypt`

### Stytch API rate limit (100 req/min)

**Root cause:** Export script hitting rate limit during pagination.

**Fix:**
Add delay between requests:

```typescript
await new Promise(resolve => setTimeout(resolve, 600)); // 600ms = 100/min
```

### "Organization not found" during membership creation

**Root cause:** Org ID mapping lookup failed or org import didn't complete.

**Fix:**
1. Verify `org-id-mapping.json` exists and contains all Stytch org IDs
2. Check WorkOS dashboard for organization count
3. Re-run org import if needed (ensure idempotency by checking for existing orgs first)

### WorkOS API authentication failures

**Root cause:** Invalid or missing `WORKOS_API_KEY`.

**Fix:**
1. Verify env var is set: `echo $WORKOS_API_KEY`
2. Confirm key starts with `sk_` (not `pk_` — that's publishable key)
3. Check key has correct permissions in WorkOS Dashboard → API Keys
4. Regenerate key if compromised

### Users cannot sign in after migration

**Decision tree:**

```
Auth method used?
  |
  +-- Password --> Check password hash import was successful
  |                Verify passwordHashType matches export format
  |
  +-- OAuth    --> Verify OAuth provider configured in WorkOS Dashboard
  |                Confirm redirect URIs match
  |
  +-- Magic    --> Verify Magic Auth enabled in dashboard
                   Confirm email delivery is working
```

Check WorkOS Dashboard → Logs for specific authentication error messages.

## Related Skills

- `workos-authkit-nextjs` - Next.js integration after migration
- `workos-authkit-react` - React integration after migration
- `workos-authkit-vanilla-js` - Plain JS integration after migration
- `workos-api-authkit` - AuthKit API reference
- `workos-magic-link` - Magic Auth configuration details
- `workos-api-organization` - Organization management API
- `workos-domain-verification` - Domain verification for SSO
