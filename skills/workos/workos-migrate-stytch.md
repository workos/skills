---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check environment variables exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Stytch Access (Decision Tree)

```
Migration type?
  |
  +-- B2B Organizations --> Need Stytch project_id + secret for API access
  |                        (Search Organizations + Search Members APIs)
  |
  +-- Consumer Users    --> Contact Stytch for export utility
                           (https://github.com/stytchauth/stytch-node-export-users)
```

**Critical:** B2B and Consumer migrations use different export methods. Verify your Stytch project type before proceeding.

### Password Export Requirements

If users authenticate with passwords:

1. **Contact Stytch support** at support@stytch.com to request password hash export
2. Timeline varies (typically days to weeks) - start this request EARLY
3. Verify hash algorithm when received (should be `scrypt`, `bcrypt`, or `argon2`)

**Note:** WorkOS supports importing password hashes, but Stytch requires manual export request. This is a Stytch limitation, not a WorkOS limitation.

## Step 3: Install WorkOS SDK

Detect package manager from lock files:

```
Lock file present?
  |
  +-- package-lock.json --> npm install @workos-inc/node
  |
  +-- yarn.lock         --> yarn add @workos-inc/node
  |
  +-- pnpm-lock.yaml    --> pnpm add @workos-inc/node
```

**Verify:** SDK exists in node_modules before writing import statements.

## Step 4: Export Stytch Data (B2B)

### Export Organizations

Use Stytch Search Organizations API with pagination:

```typescript
import { B2BClient } from "stytch";
import { writeFile } from "fs/promises";

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
});

const organizations: any[] = [];
let cursor: string | undefined;

do {
  const response = await client.organizations.search({
    query: { operator: "OR", operands: [] }, // Export all
    limit: 1000,
    cursor,
  });
  organizations.push(...response.organizations);
  cursor = response.results_metadata.next_cursor;
} while (cursor);

await writeFile("stytch-orgs.json", JSON.stringify(organizations, null, 2));
```

**Rate limit:** 100 requests/minute. Add delays if hitting limits.

### Export Members

For each organization, fetch members using Search Members API:

```typescript
const members: any[] = [];

for (const org of organizations) {
  let cursor: string | undefined;

  do {
    const response = await client.members.search({
      organization_id: org.organization_id,
      limit: 1000,
      cursor,
    });
    members.push(...response.members);
    cursor = response.results_metadata.next_cursor;
  } while (cursor);
}

await writeFile("stytch-members.json", JSON.stringify(members, null, 2));
```

**Critical:** Export uses organization_id, not organization_name. Preserve IDs for mapping during import.

## Step 5: Import Organizations into WorkOS

### Organization Creation

Map Stytch organizations to WorkOS format:

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importOrganization(stytchOrg: any) {
  const domainData = stytchOrg.email_allowed_domains?.map((domain: string) => ({
    domain,
    state: "verified", // Adjust based on your domain verification policy
  }));

  const org = await workos.organizations.createOrganization({
    name: stytchOrg.organization_name,
    domainData: domainData || [],
  });

  return { stytchId: stytchOrg.organization_id, workosId: org.id };
}
```

**ID Mapping (CRITICAL):** Store the mapping between Stytch organization_id and WorkOS organization ID. You will need this for member imports.

```typescript
// Create ID mapping file
const orgMapping: Record<string, string> = {};

for (const stytchOrg of organizations) {
  const { stytchId, workosId } = await importOrganization(stytchOrg);
  orgMapping[stytchId] = workosId;
}

await writeFile("org-id-mapping.json", JSON.stringify(orgMapping, null, 2));
```

## Step 6: Import Users and Memberships

### Member Status Filtering (Decision Tree)

```
Stytch member status?
  |
  +-- "active"    --> Import user + create membership
  |
  +-- "invited"   --> Skip import, re-send WorkOS invitation
  |
  +-- "pending"   --> Skip import, re-send WorkOS invitation
```

**Rationale:** Only import active users to avoid duplicate invitation flows.

### User Creation with Password Hash

```typescript
async function importUser(
  stytchMember: any,
  orgMapping: Record<string, string>,
) {
  // Parse name (Stytch stores full name, WorkOS expects first/last)
  const nameParts = stytchMember.name?.split(" ") || [];
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const userData: any = {
    email: stytchMember.email_address,
    emailVerified: stytchMember.status === "active",
    firstName,
    lastName,
  };

  // Add password hash if available (from Stytch support export)
  if (stytchMember.password_hash) {
    userData.passwordHash = stytchMember.password_hash;
    userData.passwordHashType = "scrypt"; // Verify with Stytch export format
  }

  const user = await workos.userManagement.createUser(userData);

  return user;
}
```

**Critical:** `emailVerified` should be `true` for active members to avoid re-verification loops.

### Organization Membership Creation

Link imported users to their organizations:

```typescript
async function createMembership(
  userId: string,
  stytchOrgId: string,
  orgMapping: Record<string, string>,
) {
  const workosOrgId = orgMapping[stytchOrgId];

  if (!workosOrgId) {
    throw new Error(`No WorkOS org found for Stytch org ${stytchOrgId}`);
  }

  await workos.userManagement.createOrganizationMembership({
    userId,
    organizationId: workosOrgId,
    roleSlug: "member", // Adjust based on Stytch role mapping
  });
}
```

**Role Mapping:** Stytch and WorkOS may have different role names. Map Stytch roles to WorkOS role slugs according to your RBAC setup.

### Batch Import Loop

```typescript
const orgMapping = JSON.parse(await readFile("org-id-mapping.json", "utf-8"));
const members = JSON.parse(await readFile("stytch-members.json", "utf-8"));

for (const member of members) {
  if (member.status !== "active") continue; // Skip non-active members

  const user = await importUser(member, orgMapping);

  for (const orgId of member.organization_ids) {
    await createMembership(user.id, orgId, orgMapping);
  }
}
```

**Rate limiting:** WorkOS has rate limits. Add delays between batches if importing thousands of users.

## Step 7: Configure Authentication Methods

### Password Authentication

In WorkOS Dashboard:

1. Navigate to **Authentication** tab
2. Enable **Password** authentication method
3. Configure password requirements (min length, complexity)

Users with imported password hashes can sign in immediately without password reset.

### Magic Auth (Replaces Stytch Magic Links)

**Key difference:** Stytch sends clickable links, WorkOS sends 6-digit codes.

In WorkOS Dashboard:

1. Navigate to **Authentication** > **Magic Auth**
2. Enable Magic Auth
3. Codes expire after 10 minutes (non-configurable)

**User experience change:** Users must copy/paste code instead of clicking link. Update onboarding docs accordingly.

### OAuth Providers

If Stytch users signed in via OAuth (Google, Microsoft, GitHub):

1. Navigate to **Authentication** > **OAuth providers**
2. Enable each provider you used in Stytch
3. Configure client IDs and secrets

**Email matching:** WorkOS automatically links OAuth sign-ins to existing users by email address. No manual linking required.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify migration success:

```bash
# 1. Check organization export exists
ls stytch-orgs.json || echo "FAIL: Run Step 4 export"

# 2. Check member export exists
ls stytch-members.json || echo "FAIL: Run Step 4 export"

# 3. Check ID mapping was created
ls org-id-mapping.json || echo "FAIL: Run Step 5 import"

# 4. Verify WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: Install SDK"

# 5. Test API connectivity
node -e "
  const { WorkOS } = require('@workos-inc/node');
  const workos = new WorkOS(process.env.WORKOS_API_KEY);
  workos.organizations.listOrganizations({ limit: 1 })
    .then(() => console.log('PASS: API connected'))
    .catch(e => console.log('FAIL:', e.message));
"

# 6. Verify organization count matches
node -e "
  const fs = require('fs');
  const stytchCount = JSON.parse(fs.readFileSync('stytch-orgs.json', 'utf-8')).length;
  const mappingCount = Object.keys(JSON.parse(fs.readFileSync('org-id-mapping.json', 'utf-8'))).length;
  console.log(stytchCount === mappingCount ? 'PASS: Org counts match' : 'FAIL: Org counts mismatch');
"
```

## Error Recovery

### "Invalid API key" during WorkOS calls

**Root cause:** API key incorrect or lacks permissions.

Fix:

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check Dashboard > API Keys for key status
3. Regenerate key if necessary

### "Organization not found" during membership creation

**Root cause:** Organization ID mapping is stale or incomplete.

Fix:

1. Check `org-id-mapping.json` contains the Stytch org ID
2. Re-run Step 5 if organizations were imported incompletely
3. Verify no typos in Stytch organization_id field

### "Email already exists" during user import

**Root cause:** User was already imported or exists from previous migration attempt.

Decision tree:

```
User exists?
  |
  +-- With password hash --> Skip, user is fully migrated
  |
  +-- Without password hash --> Update user with passwordHash field
```

Fix for updating existing user:

```typescript
await workos.userManagement.updateUser({
  userId: existingUser.id,
  passwordHash: stytchMember.password_hash,
  passwordHashType: "scrypt",
});
```

### "Rate limit exceeded" during bulk import

**Root cause:** Too many requests to WorkOS API.

Fix:

1. Add delay between batches: `await new Promise(r => setTimeout(r, 100));`
2. Reduce batch size from 100 to 50 or 25
3. Check WorkOS Dashboard > API logs for rate limit details

### Password hash import fails silently

**Root cause:** Wrong `passwordHashType` specified.

Fix:

1. Verify hash algorithm with Stytch support export documentation
2. Supported types: `'scrypt'`, `'bcrypt'`, `'argon2'`, `'sha256'`
3. If unsure, test with single user before bulk import

### Stytch export script returns empty array

**Root cause:** API credentials incorrect or rate limit hit.

Fix:

1. Verify `STYTCH_PROJECT_ID` and `STYTCH_SECRET` are correct
2. Check Stytch Dashboard for API key status
3. Wait 60 seconds if rate limited (100 req/min limit)
4. Test single organization fetch before bulk export

## Related Skills

- workos-authkit-nextjs - For Next.js authentication UI after migration
- workos-authkit-react - For React authentication UI after migration
