---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Planning (Decision Tree)

### User Type Detection

```
Stytch user type?
  |
  +-- B2B Users --> Follow this skill (organizations + members)
  |
  +-- Consumer Users --> Use Stytch's export utility: 
                         https://github.com/stytchauth/stytch-node-export-users
```

This skill covers **B2B user migration only**. Consumer users require different export logic.

### Authentication Method Inventory

Check your Stytch dashboard to determine which auth methods are in use:

- **Password auth** → Contact Stytch support for hash export (Timeline: varies, plan ahead)
- **Magic Link** → Maps to WorkOS Magic Auth (6-digit code vs. clickable link)
- **Email OTP** → Direct mapping to Magic Auth (no changes needed)
- **OAuth (Google, Microsoft, GitHub)** → Direct mapping to WorkOS OAuth

**Critical:** If using password auth, contact `support@stytch.com` NOW to request hash export. This has variable turnaround time and will block final import.

## Step 3: Environment Setup

### Required Credentials

Create `.env.local` with:

```bash
# Stytch (for export)
STYTCH_PROJECT_ID=project-test-xxx
STYTCH_SECRET=secret-test-xxx

# WorkOS (for import)
WORKOS_API_KEY=sk_test_xxx
WORKOS_CLIENT_ID=client_xxx
```

### SDK Installation

Detect package manager, install both SDKs:

```bash
# Stytch for export
npm install stytch

# WorkOS for import
npm install @workos-inc/node
```

**Verify:** Both packages exist in `node_modules` before continuing.

## Step 4: Export from Stytch (BLOCKING)

### Export Organizations

Create `export-stytch.ts`:

```typescript
import { B2BClient } from 'stytch';
import { writeFile } from 'fs/promises';

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!,
});

async function exportOrganizations() {
  const orgs = [];
  let cursor: string | undefined;
  
  do {
    const response = await client.organizations.search({
      cursor,
      limit: 1000,
    });
    orgs.push(...response.organizations);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  
  await writeFile('stytch-orgs.json', JSON.stringify(orgs, null, 2));
  return orgs;
}
```

**Rate limit:** 100 requests/minute. For large datasets, add delays between batches.

### Export Members

For each organization, export members:

```typescript
async function exportMembers(orgId: string) {
  const members = [];
  let cursor: string | undefined;
  
  do {
    const response = await client.organizations.members.search({
      organization_ids: [orgId],
      cursor,
      limit: 1000,
    });
    members.push(...response.members);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  
  return members;
}

async function exportAllMembers(orgs: any[]) {
  const allMembers = [];
  for (const org of orgs) {
    const members = await exportMembers(org.organization_id);
    allMembers.push(...members);
  }
  await writeFile('stytch-members.json', JSON.stringify(allMembers, null, 2));
}
```

**Run export:**

```bash
tsx export-stytch.ts
```

**Verify:** Files `stytch-orgs.json` and `stytch-members.json` exist and contain data.

### Password Hash Export (If Using Password Auth)

**This is a MANUAL process:**

1. Email `support@stytch.com` with subject "Password Hash Export Request"
2. Provide your Stytch project ID
3. Wait for hash file delivery (timeline varies)
4. **Critical:** Verify the hash algorithm they provide. Ask specifically: "What hashing algorithm was used?" (Stytch uses `scrypt` but confirm format matches WorkOS expectations)

**Do not proceed to Step 5 if passwords are in use and you don't have the hash export.**

## Step 5: Import to WorkOS

### Import Organizations First

Create `import-workos.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import { readFile } from 'fs/promises';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importOrganization(stytchOrg: any) {
  const domainData = stytchOrg.email_allowed_domains?.map((domain: string) => ({
    domain,
    state: 'verified', // Adjust based on Stytch verification state
  }));
  
  const org = await workos.organizations.createOrganization({
    name: stytchOrg.organization_name,
    domainData,
    idempotencyKey: `stytch-${stytchOrg.organization_id}`, // Prevent duplicates
  });
  
  return { stytchId: stytchOrg.organization_id, workosId: org.id };
}

async function importAllOrganizations() {
  const orgsData = await readFile('stytch-orgs.json', 'utf-8');
  const orgs = JSON.parse(orgsData);
  const mapping = [];
  
  for (const org of orgs) {
    const result = await importOrganization(org);
    mapping.push(result);
  }
  
  await writeFile('org-mapping.json', JSON.stringify(mapping, null, 2));
}
```

**Critical:** Save the Stytch → WorkOS organization ID mapping. You need it for member imports.

### Import Users and Memberships

```typescript
async function importUser(stytchMember: any, orgMapping: any[]) {
  // Filter by status - only import active members
  if (stytchMember.status !== 'active') {
    console.log(`Skipping non-active member: ${stytchMember.email_address}`);
    return null;
  }
  
  // Parse name
  const nameParts = stytchMember.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Create user (without password for now)
  const user = await workos.userManagement.createUser({
    email: stytchMember.email_address,
    emailVerified: stytchMember.email_address_verified ?? false,
    firstName,
    lastName,
    idempotencyKey: `stytch-user-${stytchMember.member_id}`,
  });
  
  // Create organization membership
  const workosOrgId = orgMapping.find(
    m => m.stytchId === stytchMember.organization_id
  )?.workosId;
  
  if (workosOrgId) {
    await workos.userManagement.createOrganizationMembership({
      userId: user.id,
      organizationId: workosOrgId,
    });
  }
  
  return user;
}
```

**Decision: Invited/Pending Members**

```
Member status?
  |
  +-- active   --> Import directly
  |
  +-- invited  --> Option A: Skip and re-invite via WorkOS
  |            --> Option B: Import and send new invite
  |
  +-- pending  --> Same as invited
```

Choose your strategy before running the import loop.

### Import Password Hashes (If Available)

**Only proceed if you have the hash export from Stytch support.**

```typescript
async function importUserWithPassword(stytchMember: any, passwordHash: string) {
  const user = await workos.userManagement.createUser({
    email: stytchMember.email_address,
    emailVerified: stytchMember.email_address_verified ?? false,
    firstName,
    lastName,
    passwordHash: passwordHash,
    passwordHashType: 'scrypt', // Confirm with Stytch support
    idempotencyKey: `stytch-user-${stytchMember.member_id}`,
  });
  
  return user;
}
```

**Critical:** The `passwordHashType` parameter must match the algorithm Stytch used. Verify this with their support team. WorkOS supports:
- `scrypt`
- `bcrypt`
- `argon2`

If the format is wrong, users cannot sign in and you'll need to force password resets.

## Step 6: Configure WorkOS Dashboard

### Enable Authentication Methods

Navigate to WorkOS Dashboard → Authentication:

1. **Password Auth** (if migrating passwords):
   - Enable "Email + Password"
   - Configure password requirements to match or exceed Stytch's

2. **Magic Auth** (replaces Stytch Magic Link / Email OTP):
   - Enable "Magic Auth"
   - Note: Users get 6-digit code (not clickable link)
   - Codes expire after 10 minutes

3. **OAuth Providers** (if migrating social logins):
   - Navigate to Authentication → OAuth
   - Enable each provider (Google, Microsoft, GitHub, etc.)
   - Configure client credentials for each
   - Users will auto-link by email address

**Critical:** WorkOS Magic Auth sends a CODE, not a clickable link. Update user-facing documentation to reflect this UX change.

## Step 7: SDK Integration (If Not Already Done)

If this is a NEW WorkOS integration (not just data migration), implement AuthKit:

- See `workos-authkit-nextjs` skill for Next.js
- See `workos-authkit-react` skill for React
- See `workos-authkit-vanilla-js` skill for plain JavaScript

**This step is BLOCKING if you don't have WorkOS auth flows implemented yet.**

## Verification Checklist (ALL MUST PASS)

Run these checks after import completes:

```bash
# 1. Verify export files exist
ls stytch-orgs.json stytch-members.json org-mapping.json

# 2. Count imported organizations (should match Stytch count)
cat org-mapping.json | jq 'length'

# 3. Test user login (pick a test user)
# Manual: Go to WorkOS dashboard → Users → Try signing in as test user

# 4. Verify OAuth providers configured (if applicable)
# Manual: Dashboard → Authentication → OAuth → Check each provider shows "Configured"

# 5. Check password auth enabled (if migrated hashes)
# Manual: Dashboard → Authentication → Email + Password → Should show "Enabled"
```

**Critical password verification:**

```bash
# Test a user with migrated password hash
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$WORKOS_CLIENT_ID"'",
    "email": "test@example.com",
    "password": "test-password",
    "grant_type": "password"
  }'

# Expected: 200 with access_token
# If 401: Hash format mismatch - verify passwordHashType with Stytch
```

## Error Recovery

### "Stytch API rate limit exceeded"

**Root cause:** Exceeded 100 requests/minute during export.

**Fix:** Add rate limiting to export script:

```typescript
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add after each API call
await sleep(650); // ~90 requests/minute with buffer
```

### "Invalid password hash format"

**Root cause:** `passwordHashType` doesn't match actual Stytch hash algorithm.

**Fix:**

1. Contact Stytch support: "What hashing algorithm and parameters were used?"
2. Update `passwordHashType` in import script
3. Re-run import for affected users OR force password resets

### "Organization already exists" during import

**Root cause:** Re-running import without idempotency keys.

**Fix:**

1. Check `org-mapping.json` for existing Stytch → WorkOS ID pairs
2. Skip organizations already in mapping file
3. Always use `idempotencyKey` parameter to prevent duplicates

### "Email already exists" during user import

**Root cause:** User already imported or email collision.

**Fix:**

```typescript
try {
  const user = await workos.userManagement.createUser({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    // Fetch existing user by email and create membership only
    const users = await workos.userManagement.listUsers({ email: stytchMember.email_address });
    const existingUser = users.data[0];
    await workos.userManagement.createOrganizationMembership({
      userId: existingUser.id,
      organizationId: workosOrgId,
    });
  } else {
    throw error;
  }
}
```

### "User cannot sign in after migration"

**Decision tree for diagnosis:**

```
Sign-in method?
  |
  +-- Password --> Check passwordHashType matches Stytch algorithm
  |            --> Verify emailVerified = true (WorkOS requires verified emails)
  |
  +-- Magic Auth --> No migration needed - works immediately
  |
  +-- OAuth --> Check provider configured in dashboard
            --> Verify email matches between Stytch and OAuth account
```

### "Members missing from imported organizations"

**Root cause:** Status filtering excluded invited/pending members.

**Fix:**

1. Review filtering logic in `importUser` function
2. Decide on invited/pending strategy (re-invite vs. import)
3. Re-run member import with adjusted status filter

### Stytch environment variables not loading

**Fix:**

```bash
# Verify .env.local exists and has correct format
cat .env.local | grep STYTCH

# For tsx, ensure dotenv is configured
tsx --env-file=.env.local export-stytch.ts
```

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit with Next.js after migration
- `workos-authkit-react` - Integrate AuthKit with React after migration
- `workos-magic-link` - Configure Magic Auth to replace Stytch magic links
- `workos-api-authkit` - Direct API usage for custom auth flows
- `workos-api-organization` - Advanced organization management post-migration
