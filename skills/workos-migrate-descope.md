---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:3056c8ae6df4 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The migration doc is the source of truth. If this skill conflicts with the doc, follow the doc.

## Step 2: Pre-Migration Assessment

### Descope Data Inventory

Check what authentication methods your Descope users currently use:

```bash
# Query Descope Management API to analyze user base
# (Exact endpoint in Descope docs)
curl -X POST https://api.descope.com/v1/mgmt/user/search \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID:$DESCOPE_MANAGEMENT_KEY"
```

Identify:

- **Password users**: Need password hash export (see Step 3)
- **Social auth users**: Google, Microsoft, GitHub, etc. (see Step 5)
- **Tenant associations**: Map to WorkOS Organizations (see Step 6)

### WorkOS Prerequisites

- Confirm `WORKOS_API_KEY` starts with `sk_` (server-side API key)
- Confirm `WORKOS_CLIENT_ID` starts with `client_`
- WorkOS SDK installed (Node.js, Python, or Ruby)

## Step 3: Password Export (Decision Tree)

```
Do users sign in with passwords?
  |
  +-- YES --> Contact Descope support for password export
  |           (passwords not available via API)
  |
  +-- NO  --> Skip to Step 4
```

**If YES:**

1. Email support@descope.com requesting password export
2. Include: Descope project ID, requested hash format (bcrypt/argon2/pbkdf2)
3. Wait for CSV file via secure transfer
4. **Record hash algorithm** — you'll need this for WorkOS import

**Supported formats WorkOS accepts:**

- `bcrypt` (most common)
- `argon2`
- `pbkdf2`

**Do NOT proceed to user import until you have:**

- CSV file with password hashes
- Confirmed hash algorithm name

## Step 4: Export Users from Descope

Use Descope Management API to fetch all users:

```typescript
import { DescopeClient } from "@descope/node-sdk";

const descopeClient = DescopeClient({
  projectId: process.env.DESCOPE_PROJECT_ID,
  managementKey: process.env.DESCOPE_MANAGEMENT_KEY,
});

// Paginated search - adjust limit if needed
let allUsers = [];
let page = 0;
let hasMore = true;

while (hasMore) {
  const response = await descopeClient.management.user.searchAll({
    limit: 100,
    page,
  });
  allUsers.push(...response.users);
  hasMore = response.users.length === 100;
  page++;
}

// Save to JSON for import script
fs.writeFileSync("descope-users.json", JSON.stringify(allUsers, null, 2));
```

**Verify export:**

```bash
# Check user count matches Descope dashboard
jq 'length' descope-users.json
```

## Step 5: Import Users into WorkOS

### Field Mapping (Critical)

Map Descope export fields to WorkOS Create User API:

| Descope Field   | WorkOS API Parameter |
| --------------- | -------------------- |
| `email`         | `email`              |
| `givenName`     | `first_name`         |
| `familyName`    | `last_name`          |
| `verifiedEmail` | `email_verified`     |

**Rate limits:** Create User API is rate-limited. For large migrations (>1000 users), implement batching with delays. See: https://workos.com/docs/reference/rate-limits

### Import Script (with passwords)

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Load exported users
const descopeUsers = JSON.parse(fs.readFileSync("descope-users.json", "utf8"));
const passwordHashes = loadPasswordCSV(); // From Descope support export

async function importUser(descopeUser) {
  const passwordData = passwordHashes[descopeUser.email];

  const params = {
    email: descopeUser.email,
    first_name: descopeUser.givenName,
    last_name: descopeUser.familyName,
    email_verified: descopeUser.verifiedEmail,
  };

  // Add password if available
  if (passwordData) {
    params.password_hash = passwordData.hash;
    params.password_hash_type = "bcrypt"; // or 'argon2', 'pbkdf2' from support ticket
  }

  try {
    const user = await workos.users.createUser(params);
    console.log(`✓ Imported: ${user.email}`);
    return user;
  } catch (error) {
    console.error(`✗ Failed: ${descopeUser.email}`, error.message);
    return null;
  }
}

// Batch with rate limit handling
for (let i = 0; i < descopeUsers.length; i += 10) {
  const batch = descopeUsers.slice(i, i + 10);
  await Promise.all(batch.map(importUser));
  await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay between batches
}
```

**If passwords NOT exported:**

- Omit `password_hash` and `password_hash_type` parameters
- Users will need to use "Forgot Password" flow or social auth

## Step 6: Configure Social Auth Providers

If Descope users authenticated with Google, Microsoft, GitHub, etc., configure those providers in WorkOS.

### Provider Setup Checklist

For each social provider your users use:

1. Navigate to WorkOS Dashboard → Authentication → Social Providers
2. Enable provider (Google, Microsoft, etc.)
3. Add OAuth client credentials from provider's developer console
4. **Critical:** Use the SAME OAuth client ID/secret as Descope if possible, OR
5. If using new credentials, users may need to re-authorize

**Auto-linking behavior:**

- WorkOS links social accounts by **email address**
- User signs in with Google → WorkOS finds existing user with matching email
- **No manual linking required** if emails match

**Email verification note:**

- Some providers (Gmail, Outlook) are pre-verified
- Others may require email verification step (check WorkOS dashboard settings)

See: https://workos.com/docs/integrations for provider-specific guides

## Step 7: Export and Create Organizations

Descope "Tenants" → WorkOS "Organizations"

### Export Tenants from Descope

```typescript
const tenants = await descopeClient.management.tenant.loadAll();

// Save for import
fs.writeFileSync("descope-tenants.json", JSON.stringify(tenants, null, 2));
```

### Import to WorkOS

```typescript
async function importTenant(descopeTenant) {
  const org = await workos.organizations.createOrganization({
    name: descopeTenant.name,
    external_id: descopeTenant.id, // Store Descope ID for reference
  });

  console.log(`✓ Created org: ${org.name} (${org.id})`);
  return org;
}

const orgIdMap = {}; // descopeTenantId -> workosOrgId
for (const tenant of tenants) {
  const org = await importTenant(tenant);
  orgIdMap[tenant.id] = org.id;
}

// Save mapping for membership import
fs.writeFileSync("org-id-map.json", JSON.stringify(orgIdMap, null, 2));
```

## Step 8: Import Organization Memberships

Users in Descope tenants → WorkOS organization members

### Extract User-Tenant Associations

```typescript
// Descope user object includes tenantIds array
const memberships = descopeUsers.flatMap((user) =>
  (user.tenantIds || []).map((tenantId) => ({
    userEmail: user.email,
    tenantId,
  })),
);
```

### Create Memberships in WorkOS

```typescript
const userIdMap = {}; // descopeEmail -> workosUserId (from Step 5)

async function createMembership(membership) {
  const workosUserId = userIdMap[membership.userEmail];
  const workosOrgId = orgIdMap[membership.tenantId];

  if (!workosUserId || !workosOrgId) {
    console.error(`✗ Missing mapping for ${membership.userEmail}`);
    return;
  }

  await workos.userManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId,
    // Optional: assign role
    // roleSlug: 'member', // Define roles in WorkOS dashboard first
  });

  console.log(`✓ Added ${membership.userEmail} to org ${workosOrgId}`);
}

for (const membership of memberships) {
  await createMembership(membership);
}
```

### RBAC (Roles) Migration

If Descope tenants use roles:

1. **Map Descope roles to WorkOS roles:**
   - Go to WorkOS Dashboard → Roles & Permissions
   - Create matching roles (e.g., "admin", "member")
   - Note the `roleSlug` for each

2. **Assign during membership creation:**
   - Add `roleSlug: 'admin'` parameter in `createOrganizationMembership()`
   - Descope role data available in user export (check `user.roleNames` or similar)

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Verify user count matches
echo "Descope users:" && jq 'length' descope-users.json
echo "WorkOS users:" && curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length'

# 2. Verify organizations created
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'

# 3. Test password login (if passwords migrated)
# Use WorkOS test login endpoint or SDK signIn method
# User should authenticate without "invalid credentials" error

# 4. Test social auth login
# User signs in with Google/Microsoft → should link to existing account
# Check: no duplicate users created

# 5. Verify organization memberships
# Pick a user, check they're in correct orgs via Dashboard or API
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?user_id=$USER_ID"
```

**If any check fails:**

- User count mismatch → Check import script logs for failed users
- Password login fails → Verify `password_hash_type` matches Descope export format
- Social auth creates duplicates → Check email matching logic, verify `email_verified` was set
- Memberships missing → Check `orgIdMap` and `userIdMap` populated correctly

## Error Recovery

### "Password hash format not supported"

**Cause:** `password_hash_type` doesn't match Descope's algorithm.

**Fix:**

1. Re-check password export file from Descope support
2. Confirm algorithm is `bcrypt`, `argon2`, or `pbkdf2`
3. Update `password_hash_type` parameter in import script
4. Re-run import for failed users only

### "Email already exists"

**Cause:** User already imported (script ran twice), or user self-registered during migration.

**Fix:**

1. Use Update User API instead of Create User for duplicate emails
2. Or: Skip user if already exists (check error code in catch block)

### Social auth creates duplicate users

**Cause:** Email mismatch or email not verified on social provider.

**Fix:**

1. Check `email_verified` was set to `true` during user import
2. Verify social provider returns verified email (Google/Microsoft yes, others check docs)
3. If provider doesn't verify emails, enable manual email verification in WorkOS dashboard

### Rate limit errors (429)

**Cause:** Importing too many users too fast.

**Fix:**

1. Increase delay between batches (current: 1s, try 2s)
2. Reduce batch size (current: 10, try 5)
3. Check rate limits doc: https://workos.com/docs/reference/rate-limits

### Organization membership fails with "user not found"

**Cause:** `userIdMap` not populated correctly from import script.

**Fix:**

1. Save WorkOS user IDs during Step 5 import:
   ```typescript
   const user = await workos.users.createUser(params);
   userIdMap[descopeUser.email] = user.id; // Store this!
   ```
2. Verify map file exists before Step 8: `cat user-id-map.json`

## Related Skills

- **workos-authkit-nextjs** — Integrate AuthKit frontend after migration
- **workos-authkit-react** — React-specific auth UI patterns
- **workos-directory-sync.rules.yml** — Sync organizations with external directories post-migration
