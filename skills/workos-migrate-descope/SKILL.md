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

## Step 2: Pre-Flight Validation

### WorkOS Environment

- Confirm WorkOS Dashboard access at `dashboard.workos.com`
- Confirm environment variables exist:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`

### WorkOS SDK

Check `package.json` contains `@workos-inc/node` dependency.

**Verify:** SDK package exists in node_modules before continuing.

### Descope Data Access

Decision point:

```
Do you need to migrate passwords?
  |
  +-- YES --> Contact Descope support for password export
  |           (Backend APIs don't expose password hashes)
  |           Result: CSV file with hashes + algorithm name
  |
  +-- NO  --> Use Descope Management API for user export only
              (GET /v1/mgmt/user/search endpoint)
```

**Critical:** Descope support ticket for passwords MUST be filed early — data transfers take time.

## Step 3: Export User Data from Descope

### Without Passwords

Use Descope Management SDK to fetch users:

```typescript
import DescopeClient from '@descope/node-sdk';

const descopeClient = DescopeClient({ projectId: DESCOPE_PROJECT_ID });

async function exportUsers() {
  const users = await descopeClient.management.user.searchAll();
  return users;
}
```

Export fields needed for WorkOS:
- `email`
- `givenName`
- `familyName` 
- `verifiedEmail`
- `tenants` (for organization membership)

### With Passwords

Wait for CSV from Descope support containing:
- All user fields above
- `password_hash` column
- Hash algorithm used (bcrypt, argon2, or pbkdf2)

**Verify:** CSV received and algorithm documented before proceeding to import.

## Step 4: Import Users to WorkOS

### Field Mapping (REQUIRED)

```
Descope          -->  WorkOS Create User API
----------------------------------------------
email            -->  email
givenName        -->  first_name
familyName       -->  last_name
verifiedEmail    -->  email_verified
```

### Basic User Creation (No Passwords)

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(descopeUser) {
  const user = await workos.userManagement.createUser({
    email: descopeUser.email,
    firstName: descopeUser.givenName,
    lastName: descopeUser.familyName,
    emailVerified: descopeUser.verifiedEmail,
  });
  return user;
}
```

### With Password Hashes (If Available)

**Critical:** Determine hash algorithm from Descope support response.

```
Hash algorithm from Descope?
  |
  +-- bcrypt  --> password_hash_type: 'bcrypt'
  |
  +-- argon2  --> password_hash_type: 'argon2'
  |
  +-- pbkdf2  --> password_hash_type: 'pbkdf2'
```

Import with password hash:

```typescript
async function importUserWithPassword(descopeUser, passwordHash, hashType) {
  const user = await workos.userManagement.createUser({
    email: descopeUser.email,
    firstName: descopeUser.givenName,
    lastName: descopeUser.familyName,
    emailVerified: descopeUser.verifiedEmail,
    passwordHash: passwordHash,
    passwordHashType: hashType, // 'bcrypt', 'argon2', or 'pbkdf2'
  });
  return user;
}
```

### Rate Limiting (IMPORTANT)

WorkOS Create User API is rate-limited. For large migrations, implement batching:

```typescript
async function batchImport(users, batchSize = 100, delayMs = 1000) {
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.all(batch.map(importUser));
    
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

See: `https://workos.com/docs/reference/rate-limits` for current limits.

## Step 5: Migrate Social Auth Users (Optional)

If Descope users signed in via Google, Microsoft, or other OAuth providers:

### Configure OAuth Providers in WorkOS

1. Navigate to WorkOS Dashboard → Authentication → Social Connections
2. For each provider used in Descope, add client credentials
3. See provider-specific guides:
   - Google: `https://workos.com/docs/integrations/google-oauth`
   - Microsoft: `https://workos.com/docs/integrations/microsoft-oauth`

### Automatic Linking

WorkOS automatically links social sign-ins to existing users by **email address match**.

**Critical:** Email addresses from OAuth providers MUST match WorkOS user emails.

### Email Verification Behavior

```
Provider verification status?
  |
  +-- Known verified (gmail.com via Google) --> No extra verification
  |
  +-- Unknown status --> User may need to verify email in WorkOS
```

Check WorkOS environment settings → Authentication → Email Verification to see current policy.

## Step 6: Migrate Organizations

### Export Descope Tenants

```typescript
const descopeClient = DescopeClient({ projectId: DESCOPE_PROJECT_ID });

async function exportTenants() {
  const tenants = await descopeClient.management.tenant.loadAll();
  return tenants;
}
```

### Create WorkOS Organizations

**Field Mapping:**

```
Descope Tenant   -->  WorkOS Organization
-----------------------------------------
name             -->  name
id               -->  external_id
```

**Why external_id:** Preserves Descope tenant ID for reference during migration.

```typescript
async function importOrganization(descopeTenant) {
  const org = await workos.organizations.createOrganization({
    name: descopeTenant.name,
    externalId: descopeTenant.id, // Descope tenant ID
  });
  return org;
}
```

**Verify:** Map of Descope tenant ID → WorkOS organization ID for membership step.

## Step 7: Create Organization Memberships

### Extract User-Tenant Associations from Descope

When exporting users (Step 3), the `tenants` field contains tenant associations:

```typescript
descopeUser.tenants // Array of tenant IDs user belongs to
```

### Create Memberships in WorkOS

```typescript
async function createMembership(workosUserId, workosOrgId, roleSlug?) {
  const membership = await workos.userManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId,
    roleSlug: roleSlug, // Optional: see RBAC section
  });
  return membership;
}

async function migrateMemberships(descopeUsers, tenantToOrgMap, userIdMap) {
  for (const descopeUser of descopeUsers) {
    const workosUserId = userIdMap[descopeUser.userId];
    
    for (const tenantId of descopeUser.tenants) {
      const workosOrgId = tenantToOrgMap[tenantId];
      await createMembership(workosUserId, workosOrgId);
    }
  }
}
```

### RBAC Migration (Optional)

If using Descope roles:

1. **Define roles in WorkOS Dashboard:**
   - Navigate to `dashboard.workos.com/environment/roles-and-permissions`
   - Create roles matching Descope role definitions
   - Note the `slug` for each role

2. **Assign roles during membership creation:**
   - Pass `roleSlug` parameter to `createOrganizationMembership()`
   - Map Descope role names to WorkOS role slugs

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration success:

```bash
# 1. Verify WorkOS SDK installed
npm list @workos-inc/node

# 2. Check environment variables
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS" || echo "FAIL"

# 3. Verify users imported (replace COUNT with expected number)
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length' | grep -q "COUNT" && echo "PASS" || echo "FAIL"

# 4. Verify organizations created
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'

# 5. Verify memberships created for a sample user
curl -X GET "https://api.workos.com/user_management/organization_memberships?user_id=USER_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```

**Do not mark complete until all checks pass.**

## Error Recovery

### "Invalid password_hash_type" during user import

**Root cause:** Mismatch between Descope's hash algorithm and WorkOS parameter.

Fix:
1. Check Descope support email for exact algorithm name
2. Valid types: `'bcrypt'`, `'argon2'`, `'pbkdf2'` (exact string match)
3. If Descope used variant (e.g., argon2id), try base type (`'argon2'`)
4. Consult: `https://workos.com/docs/migrate/descope` for supported formats

### "User already exists" error

**Root cause:** Duplicate email in WorkOS.

Fix:
1. Check if user was previously imported
2. Use Update User API instead of Create User API
3. Query existing users first: `workos.userManagement.listUsers({ email: 'user@example.com' })`

### Rate limit exceeded (429 response)

**Root cause:** Too many API calls in short period.

Fix:
1. Implement exponential backoff in batch import
2. Reduce batch size (default: 100 → 50)
3. Increase delay between batches (default: 1s → 2s)
4. Check current limits: `https://workos.com/docs/reference/rate-limits`

### Social auth user not auto-linked

**Root cause:** Email mismatch between Descope and WorkOS user.

Fix:
1. Verify `email` field matches exactly (case-sensitive)
2. Check `email_verified` is true in WorkOS user
3. Confirm OAuth provider returns same email as WorkOS user record

### Organization membership fails with "User not found"

**Root cause:** User ID mapping incorrect or user not yet created.

Fix:
1. Verify `userIdMap` contains Descope user ID → WorkOS user ID
2. Check user import completed before membership creation
3. Query WorkOS to confirm user exists: `workos.userManagement.getUser(userId)`

### Missing tenant data in Descope export

**Root cause:** Descope user search doesn't include tenant associations by default.

Fix:
1. Use Descope Management API with tenant expansion
2. Alternatively, query each user individually to get full tenant list
3. Check Descope docs: `https://docs.descope.com/management/user-management`

### Password import fails silently (users can't log in)

**Root cause:** Hash format mismatch or corrupted hash string.

Fix:
1. Verify password hash is complete (no truncation in CSV)
2. Test with single user before bulk import
3. Confirm hash type matches what Descope support provided
4. If still failing, consider password reset flow instead of hash import

## Related Skills

- workos-authkit-nextjs - Implement AuthKit after migration
- workos-api-authkit - AuthKit API reference
- workos-api-organization - Organization management API
- workos-rbac - Role-based access control setup
- workos-migrate-other-services - Generic migration patterns
