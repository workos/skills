---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- generated -->

# WorkOS Migration: Stytch to WorkOS

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Stytch Credentials (for export)

Required for data export phase:

- `STYTCH_PROJECT_ID`
- `STYTCH_SECRET`

### SDK Installation

Verify both SDKs are available:

```bash
# Check Stytch SDK (for export phase)
npm list stytch || yarn list stytch

# Check WorkOS SDK (for import phase)
npm list @workos-inc/node || yarn list @workos-inc/node
```

**Install if missing:**

```bash
npm install stytch @workos-inc/node
# or
yarn add stytch @workos-inc/node
```

## Step 3: Export Strategy (Decision Tree)

Determine what data types you need to migrate:

```
Stytch account type?
  |
  +-- B2B (Organizations + Members)
  |     |
  |     +-- Password auth? --> Contact Stytch support for hash export
  |     +-- OAuth only?    --> No password export needed
  |
  +-- Consumer (Individual Users)
        |
        +-- Use Stytch's consumer export utility
        +-- GitHub: stytchauth/stytch-node-export-users
```

**This skill covers B2B migrations only.** For Consumer migrations, use Stytch's official export utility.

## Step 4: Export Organizations from Stytch

**API Limits:** 100 requests/minute, 1000 records per page.

Create export script at `scripts/export-stytch-orgs.ts`:

```typescript
import { B2BClient } from 'stytch';
import { writeFile } from 'fs/promises';

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!,
});

async function exportOrganizations() {
  const allOrgs: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.organizations.search({
      cursor,
      limit: 1000,
    });
    allOrgs.push(...response.organizations);
    cursor = response.next_cursor;
  } while (cursor);

  await writeFile('stytch-orgs.json', JSON.stringify(allOrgs, null, 2));
  console.log(`Exported ${allOrgs.length} organizations`);
}

exportOrganizations();
```

**Run:** `npx tsx scripts/export-stytch-orgs.ts`

**Verify:** `stytch-orgs.json` exists and contains organization records with `organization_id`, `organization_name`, `email_allowed_domains`.

## Step 5: Export Members from Stytch

**IMPORTANT:** Export members organization-by-organization to maintain relationship data.

Create export script at `scripts/export-stytch-members.ts`:

```typescript
import { B2BClient } from 'stytch';
import { writeFile, readFile } from 'fs/promises';

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!,
});

async function exportMembers() {
  const orgsData = JSON.parse(await readFile('stytch-orgs.json', 'utf-8'));
  const membersByOrg: Record<string, any[]> = {};

  for (const org of orgsData) {
    const members: any[] = [];
    let cursor: string | undefined;

    do {
      const response = await client.members.search({
        organization_ids: [org.organization_id],
        cursor,
        limit: 1000,
      });
      members.push(...response.members);
      cursor = response.next_cursor;
    } while (cursor);

    membersByOrg[org.organization_id] = members;
  }

  await writeFile('stytch-members.json', JSON.stringify(membersByOrg, null, 2));
  console.log(`Exported members for ${Object.keys(membersByOrg).length} organizations`);
}

exportMembers();
```

**Run:** `npx tsx scripts/export-stytch-members.ts`

**Verify:** `stytch-members.json` exists with structure `{ "org_id": [members...] }`.

## Step 6: Export Password Hashes (CONDITIONAL)

**Only if using password authentication.**

### Initiate Export Request

1. Email Stytch support: `support@stytch.com`
2. Subject: "Password hash export request for WorkOS migration"
3. Include: Project ID, migration timeline

**Expected response time:** 3-5 business days (varies).

### Verify Hash Format

When you receive the export file, check the hash algorithm:

```bash
# Inspect first record to identify format
head -n 1 stytch-password-hashes.json | jq '.[0]'
```

**Supported by WorkOS:** `scrypt`, `bcrypt`, `argon2`, `md5`, `sha256`, `sha512`, `pbkdf2`.

**If unsupported format:** Contact WorkOS support before proceeding.

## Step 7: Import Organizations into WorkOS

**Order matters:** Import organizations before users.

Create import script at `scripts/import-workos-orgs.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import { readFile, writeFile } from 'fs/promises';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function importOrganizations() {
  const stytchOrgs = JSON.parse(await readFile('stytch-orgs.json', 'utf-8'));
  const mapping: Record<string, string> = {}; // stytchId -> workosId

  for (const org of stytchOrgs) {
    const domainData = org.email_allowed_domains?.map((domain: string) => ({
      domain,
      state: 'verified', // Adjust based on Stytch domain verification status
    }));

    const workosOrg = await workos.organizations.createOrganization({
      name: org.organization_name,
      domainData: domainData || [],
    });

    mapping[org.organization_id] = workosOrg.id;
  }

  await writeFile('org-id-mapping.json', JSON.stringify(mapping, null, 2));
  console.log(`Imported ${Object.keys(mapping).length} organizations`);
}

importOrganizations();
```

**Run:** `npx tsx scripts/import-workos-orgs.ts`

**Verify:** `org-id-mapping.json` contains Stytch→WorkOS ID pairs.

## Step 8: Import Users and Memberships

**Member status filtering:**

```
Member status?
  |
  +-- active   --> Import user + create membership
  +-- invited  --> Skip or re-send WorkOS invitation
  +-- pending  --> Skip or re-send WorkOS invitation
```

Create import script at `scripts/import-workos-users.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import { readFile } from 'fs/promises';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function importUsers() {
  const membersByOrg = JSON.parse(await readFile('stytch-members.json', 'utf-8'));
  const orgMapping = JSON.parse(await readFile('org-id-mapping.json', 'utf-8'));
  let imported = 0;

  for (const [stytchOrgId, members] of Object.entries(membersByOrg)) {
    const workosOrgId = orgMapping[stytchOrgId];

    for (const member of members as any[]) {
      // Filter by status
      if (member.status !== 'active') {
        console.log(`Skipping ${member.email_address} (status: ${member.status})`);
        continue;
      }

      // Parse name
      const nameParts = member.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const user = await workos.userManagement.createUser({
        email: member.email_address,
        emailVerified: member.email_address_verified || false,
        firstName,
        lastName,
      });

      // Create organization membership
      await workos.userManagement.createOrganizationMembership({
        userId: user.id,
        organizationId: workosOrgId,
      });

      imported++;
    }
  }

  console.log(`Imported ${imported} active users`);
}

importUsers();
```

**Run:** `npx tsx scripts/import-workos-users.ts`

**Verify:** Check WorkOS Dashboard → Users for imported count matching script output.

## Step 9: Import Password Hashes (CONDITIONAL)

**Only if Step 6 completed.**

Modify the user creation in Step 8 to include password data:

```typescript
// Add to the createUser call in import-workos-users.ts
const passwordData = passwordHashes[member.email_address]; // Load from export file

const user = await workos.userManagement.createUser({
  email: member.email_address,
  emailVerified: member.email_address_verified || false,
  firstName,
  lastName,
  passwordHash: passwordData?.hash,
  passwordHashType: 'scrypt', // Match Stytch's algorithm
});
```

**Alternative:** Import passwords after user creation using `updateUser()` API.

## Step 10: Configure Authentication Methods

### Enable Password Authentication

1. Go to WorkOS Dashboard → Authentication
2. Enable "Password" authentication method
3. Configure password requirements (min length, complexity)

### Enable Magic Auth (replaces Stytch Magic Links)

**Behavioral change:** Magic Auth sends 6-digit codes instead of clickable links.

1. Dashboard → Authentication → Enable "Magic Auth"
2. Codes expire in 10 minutes (not configurable)
3. No application code changes needed if using Stytch email OTP

### Configure OAuth Providers

**If Stytch users sign in via Google/Microsoft/GitHub:**

1. Dashboard → Authentication → OAuth providers
2. Select provider (Google, Microsoft, GitHub, etc.)
3. Add OAuth credentials (Client ID, Client Secret)
4. Save configuration

**User linking:** WorkOS auto-links OAuth sign-ins to existing users by email match.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify successful migration:

```bash
# 1. Check export files exist
ls stytch-orgs.json stytch-members.json org-id-mapping.json

# 2. Verify organization count matches
echo "Stytch orgs: $(jq '. | length' stytch-orgs.json)"
echo "WorkOS org mappings: $(jq '. | length' org-id-mapping.json)"

# 3. Check active member count
echo "Active members to migrate: $(jq '[.[][] | select(.status == "active")] | length' stytch-members.json)"

# 4. Test WorkOS API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organizations | jq '.data | length'

# 5. Verify password import (if applicable)
# In WorkOS Dashboard: Users → select user → check "Password" authentication method exists
```

**Expected results:**

- Export file counts match Stytch Dashboard totals
- WorkOS API returns organizations
- User count in WorkOS Dashboard matches active member count
- If passwords imported: "Password" shows in user's auth methods

## Error Recovery

### "Rate limit exceeded" during export

**Root cause:** Exceeded Stytch's 100 requests/minute limit.

**Fix:** Add rate limiting to export scripts:

```typescript
// Add delay between requests
await new Promise(resolve => setTimeout(resolve, 600)); // 600ms = 100/min
```

### "Organization already exists" during import

**Root cause:** Script ran twice or partial migration completed.

**Fix:** Check for existing organizations before creating:

```typescript
const existingOrgs = await workos.organizations.listOrganizations();
const existingDomains = new Set(existingOrgs.data.flatMap(o => o.domains.map(d => d.domain)));

if (domainData?.some(d => existingDomains.has(d.domain))) {
  console.log(`Skipping ${org.organization_name} - domain exists`);
  continue;
}
```

### "Invalid password hash format"

**Root cause:** WorkOS doesn't support the hash algorithm or format is incorrect.

**Fix:**

1. Check hash algorithm from Stytch support matches WorkOS supported list
2. Verify hash string format (no extra encoding/wrapping)
3. Test with single user before bulk import
4. If unsupported: Users must reset passwords (send password reset emails)

### "User email already exists"

**Root cause:** Duplicate emails across organizations or script ran multiple times.

**Fix:** Check if user exists before creating:

```typescript
try {
  const user = await workos.userManagement.createUser({...});
} catch (error) {
  if (error.code === 'user_email_already_exists') {
    // Fetch existing user and create membership only
    const existingUser = await workos.userManagement.getUserByEmail(member.email_address);
    await workos.userManagement.createOrganizationMembership({
      userId: existingUser.id,
      organizationId: workosOrgId,
    });
  } else {
    throw error;
  }
}
```

### OAuth sign-in fails after migration

**Root cause:** OAuth provider not configured or credentials incorrect.

**Fix:**

1. Verify provider is enabled in Dashboard → Authentication
2. Check Client ID and Client Secret match your OAuth app
3. Verify redirect URIs include WorkOS callback URL
4. Test OAuth flow in incognito window (clears cached credentials)

### Members with status "invited" not working

**Root cause:** Stytch invitations don't transfer to WorkOS.

**Fix:** Re-invite users via WorkOS:

```typescript
// After importing organization
await workos.userManagement.sendInvitation({
  email: member.email_address,
  organizationId: workosOrgId,
});
```

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit after migration
- `workos-user-management` - Manage users and organizations post-migration
