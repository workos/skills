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

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `STYTCH_PROJECT_ID` - for export phase
- `STYTCH_SECRET` - for export phase

### Stytch Account Type (Decision Tree)

```
Stytch account type?
  |
  +-- B2B Users --> Use Stytch B2B APIs (Search Organizations, Search Members)
  |
  +-- Consumer Users --> Contact Stytch for export utility
                         (https://github.com/stytchauth/stytch-node-export-users)
```

**This skill covers B2B migrations only.** For Consumer users, reference the Stytch utility above.

## Step 3: Export Phase - Organizations

### Install Stytch SDK

Detect package manager, install `stytch` package.

**Verify:** Package exists in node_modules before proceeding.

### Export Organizations Script

Use Stytch Search Organizations API with pagination:

```typescript
import { B2BClient } from "stytch";
import { writeFile } from "fs/promises";

const client = new B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
});

async function exportOrganizations() {
  let cursor: string | undefined;
  const allOrgs: any[] = [];

  do {
    const response = await client.organizations.search({
      cursor,
      limit: 100, // Max per request
    });

    allOrgs.push(...response.organizations);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  await writeFile("stytch-orgs.json", JSON.stringify(allOrgs, null, 2));
  console.log(`Exported ${allOrgs.length} organizations`);
}
```

**Rate limit:** 100 requests/minute. Add throttling if exporting >10K records.

**Verify export:**

```bash
# Check file exists and is valid JSON
jq length stytch-orgs.json
```

## Step 4: Export Phase - Members

### Export Members Per Organization

Use Stytch Search Members API with organization filtering:

```typescript
async function exportMembers(organizationId: string) {
  let cursor: string | undefined;
  const allMembers: any[] = [];

  do {
    const response = await client.members.search({
      organization_ids: [organizationId],
      cursor,
      limit: 100,
    });

    allMembers.push(...response.members);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return allMembers;
}

async function exportAllMembers() {
  const orgs = JSON.parse(await readFile("stytch-orgs.json", "utf-8"));
  const membersByOrg: Record<string, any[]> = {};

  for (const org of orgs) {
    membersByOrg[org.organization_id] = await exportMembers(
      org.organization_id,
    );
  }

  await writeFile("stytch-members.json", JSON.stringify(membersByOrg, null, 2));
  console.log(`Exported members for ${orgs.length} organizations`);
}
```

**Verify export:**

```bash
# Check members file exists and count total members
jq 'to_entries | map(.value | length) | add' stytch-members.json
```

## Step 5: Export Phase - Passwords (OPTIONAL)

### Password Export Decision Tree

```
Do users authenticate with passwords?
  |
  +-- NO --> Skip this step, proceed to Step 6
  |
  +-- YES --> Contact Stytch support (support@stytch.com)
              |
              +-- Request: "Export password hashes for migration"
              +-- Provide: Project ID, timeline requirements
              +-- Timeline: Varies (can take days/weeks)
              +-- Format: Verify they provide scrypt parameters
```

**Stytch password format:** `scrypt` algorithm (WorkOS compatible).

**Critical:** Do NOT proceed with user import until you have password hashes OR have decided to skip password import and force password resets.

When Stytch provides export:

```bash
# Verify hash format is parseable
jq '.[0] | keys' stytch-password-hashes.json
# Should include: user_id, password_hash, hash_type (or similar)
```

## Step 6: Import Phase - Organizations

### Install WorkOS SDK

Detect package manager, install `@workos-inc/node` package.

**Verify:** Package exists in node_modules before proceeding.

### Import Organizations Script

Map Stytch fields to WorkOS fields:

- `organization_name` → `name`
- `email_allowed_domains` → `domainData` array with `state: "verified"`

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importOrganization(stytchOrg: any) {
  const domainData = stytchOrg.email_allowed_domains?.map((domain: string) => ({
    domain,
    state: "verified", // Assume Stytch domains are pre-verified
  }));

  const org = await workos.organizations.createOrganization({
    name: stytchOrg.organization_name,
    domainData,
  });

  return { stytchId: stytchOrg.organization_id, workosId: org.id };
}

async function importAllOrganizations() {
  const stytchOrgs = JSON.parse(await readFile("stytch-orgs.json", "utf-8"));
  const idMapping: Record<string, string> = {};

  for (const org of stytchOrgs) {
    const { stytchId, workosId } = await importOrganization(org);
    idMapping[stytchId] = workosId;
  }

  await writeFile("org-id-mapping.json", JSON.stringify(idMapping, null, 2));
  console.log(`Imported ${Object.keys(idMapping).length} organizations`);
}
```

**Verify import:**

```bash
# Check ID mapping file exists
jq length org-id-mapping.json

# Verify orgs exist in WorkOS Dashboard or via API
```

## Step 7: Import Phase - Users and Memberships

### Member Status Filtering (Decision Tree)

```
Stytch member status?
  |
  +-- "active" --> Import with emailVerified: true
  |
  +-- "invited" --> SKIP import, re-invite via WorkOS after migration
  |
  +-- "pending" --> SKIP import, re-invite via WorkOS after migration
```

**Do NOT import invited/pending users** — re-invite them post-migration to avoid stale invite links.

### Import Users Script

Parse `name` into `firstName` and `lastName`. Link users to WorkOS organizations via memberships:

```typescript
async function importUser(
  stytchMember: any,
  workosOrgId: string,
  passwordHash?: string,
) {
  const nameParts = stytchMember.name?.split(" ") || [];
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const userParams: any = {
    email: stytchMember.email_address,
    emailVerified: stytchMember.status === "active", // Only verified for active members
    firstName,
    lastName,
  };

  // Include password hash if available
  if (passwordHash) {
    userParams.passwordHash = passwordHash;
    userParams.passwordHashType = "scrypt"; // Stytch uses scrypt
  }

  const user = await workos.userManagement.createUser(userParams);

  // Create organization membership
  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: workosOrgId,
  });

  return user;
}

async function importAllUsers() {
  const membersByOrg = JSON.parse(
    await readFile("stytch-members.json", "utf-8"),
  );
  const orgIdMapping = JSON.parse(
    await readFile("org-id-mapping.json", "utf-8"),
  );

  // Optional: Load password hashes if available
  let passwordHashes: Record<string, string> = {};
  try {
    passwordHashes = JSON.parse(
      await readFile("stytch-password-hashes.json", "utf-8"),
    );
  } catch {
    console.warn(
      "No password hashes found, users will need to reset passwords",
    );
  }

  let importedCount = 0;

  for (const [stytchOrgId, members] of Object.entries(membersByOrg)) {
    const workosOrgId = orgIdMapping[stytchOrgId];
    if (!workosOrgId) {
      console.error(`No WorkOS org ID for Stytch org ${stytchOrgId}`);
      continue;
    }

    for (const member of members as any[]) {
      if (member.status !== "active") {
        console.log(
          `Skipping ${member.email_address} (status: ${member.status})`,
        );
        continue;
      }

      const passwordHash = passwordHashes[member.member_id];
      await importUser(member, workosOrgId, passwordHash);
      importedCount++;
    }
  }

  console.log(`Imported ${importedCount} active users`);
}
```

**Rate limiting:** WorkOS has default API rate limits. For large migrations (>1000 users), add throttling or contact WorkOS support for temporary limit increases.

**Verify import:**

```bash
# Query WorkOS API to count imported users
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" | jq '.data | length'
```

## Step 8: Authentication Method Configuration

### Dashboard Configuration Checklist

Navigate to WorkOS Dashboard → Authentication tab:

1. **Password authentication:**
   - Enable if passwords were imported
   - Configure strength requirements (min length, complexity rules)
   - Test: Attempt login with migrated user credentials

2. **Magic Auth (replaces Stytch magic links/email OTP):**
   - Enable Magic Auth
   - **User experience change:** Users receive 6-digit code instead of clickable link
   - Code expires after 10 minutes
   - Test: Request code for migrated user email

3. **OAuth providers (Google, Microsoft, GitHub, etc.):**
   - Enable each provider used in Stytch
   - Configure client ID and secret per provider
   - **Auto-linking:** Users signing in via OAuth are matched to existing accounts by email
   - Test: OAuth flow for provider, verify account linking

### Authentication Flow Mapping

| Stytch Method        | WorkOS Equivalent | Migration Notes                        |
| -------------------- | ----------------- | -------------------------------------- |
| Password             | Password          | Import hashes OR force reset           |
| Magic Links (email)  | Magic Auth        | UX change: code input instead of click |
| Email OTP            | Magic Auth        | Identical behavior, no code changes    |
| OAuth (Google, etc.) | OAuth             | Same providers, auto-link by email     |

## Step 9: Post-Migration Tasks

### Re-Invite Pending Users

For users skipped in Step 7 (status "invited" or "pending"):

```typescript
async function reInvitePendingUsers() {
  const membersByOrg = JSON.parse(
    await readFile("stytch-members.json", "utf-8"),
  );
  const orgIdMapping = JSON.parse(
    await readFile("org-id-mapping.json", "utf-8"),
  );

  for (const [stytchOrgId, members] of Object.entries(membersByOrg)) {
    const workosOrgId = orgIdMapping[stytchOrgId];

    for (const member of members as any[]) {
      if (member.status === "invited" || member.status === "pending") {
        await workos.userManagement.createInvitation({
          email: member.email_address,
          organizationId: workosOrgId,
        });
      }
    }
  }
}
```

### Update Application Code

Replace Stytch SDK imports with WorkOS SDK:

```typescript
// OLD (Stytch)
import { B2BClient } from 'stytch';
const client = new B2BClient({ ... });

// NEW (WorkOS)
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

Update authentication flows per WorkOS AuthKit integration guide.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Verify organization export
jq length stytch-orgs.json

# 2. Verify member export
jq 'to_entries | map(.value | length) | add' stytch-members.json

# 3. Verify org ID mapping
jq length org-id-mapping.json

# 4. Query WorkOS for imported users (returns HTTP 200 with user list)
curl -s -o /dev/null -w "%{http_code}" \
  https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# 5. Test authentication (attempt login via WorkOS Dashboard test user feature)
# Navigate to Dashboard → Users → Select user → "Sign in as user"
```

**Manual checks:**

- [ ] Password authentication enabled in Dashboard (if passwords imported)
- [ ] Magic Auth enabled in Dashboard (if replacing magic links/OTP)
- [ ] OAuth providers configured in Dashboard (if used in Stytch)
- [ ] Test login succeeds for migrated user with original credentials
- [ ] Pending users re-invited via WorkOS

## Error Recovery

### "organizations.search is not a function"

**Cause:** Wrong Stytch SDK version or Consumer account (not B2B).

**Fix:**

1. Verify SDK version: `npm list stytch` should show 6.0.0+
2. Confirm account type is B2B in Stytch Dashboard
3. For Consumer accounts, use Stytch export utility (see Step 2)

### "Unauthorized" during Stytch export

**Cause:** Invalid `STYTCH_PROJECT_ID` or `STYTCH_SECRET`.

**Fix:**

1. Verify credentials in Stytch Dashboard → API Keys
2. Confirm no extra whitespace in env vars: `echo "$STYTCH_SECRET" | wc -c`
3. Check project_id format matches Stytch format (starts with `project-`)

### "Cannot create user: email already exists"

**Cause:** Duplicate import attempt or user exists from prior migration run.

**Fix:**

1. Query existing users: `curl https://api.workos.com/user_management/users -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Skip users already in WorkOS (check email match before createUser)
3. Or delete test users and re-run import

### Password import fails with "invalid hash format"

**Cause:** Stytch export format doesn't match WorkOS expectations.

**Fix:**

1. Verify `passwordHashType` is `'scrypt'` (lowercase)
2. Contact WorkOS support with sample hash from Stytch export
3. Confirm Stytch provided full scrypt parameters (N, r, p values)
4. Reference: https://workos.com/docs/references/password-hash-types

### "Organization not found" during membership creation

**Cause:** Organization import failed or ID mapping is stale.

**Fix:**

1. Verify org exists: `curl https://api.workos.com/organizations/$WORKOS_ORG_ID -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Check `org-id-mapping.json` has entry for Stytch org ID
3. Re-run organization import if mapping is missing

### Rate limit errors (429 Too Many Requests)

**Cause:** Too many API calls in short time window.

**Fix:**

1. Add delay between requests: `await new Promise(r => setTimeout(r, 100))`
2. For large migrations, contact WorkOS support for temporary limit increase
3. Use batch operations where available (check WorkOS docs)

### OAuth auto-linking doesn't work

**Cause:** Email mismatch or email not verified in WorkOS.

**Fix:**

1. Verify user's `emailVerified: true` during import
2. Ensure OAuth provider returns same email as user's WorkOS email
3. Check OAuth provider configuration in Dashboard (correct client ID/secret)

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit in Next.js after migration
- `workos-authkit-react` - Integrate AuthKit in React after migration
- `workos-directory-sync.rules.yml` - Set up SSO/SCIM post-migration
