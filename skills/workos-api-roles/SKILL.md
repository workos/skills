---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- generated -->

# WorkOS Roles & Permissions API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete
- https://workos.com/docs/reference/roles/organization-role/get
- https://workos.com/docs/reference/roles/organization-role/list
- https://workos.com/docs/reference/roles/organization-role/remove-permission

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (required for organization context)

**Verify with:**

```bash
grep -E "WORKOS_API_KEY=sk_|WORKOS_CLIENT_ID=client_" .env* 2>/dev/null || echo "FAIL: Missing WorkOS credentials"
```

### SDK Installation

Check if WorkOS SDK is installed:

```bash
# Node.js projects
grep '"@workos-inc/node"' package.json || npm list @workos-inc/node

# Python projects
pip show workos || grep workos requirements.txt

# Ruby projects
bundle show workos || grep workos Gemfile
```

If missing, detect language and install SDK from fetched docs.

## Step 3: SDK Initialization

Create or locate SDK initialization file:

```
Language?
  |
  +-- Node.js/TypeScript --> lib/workos.ts or config/workos.js
  |
  +-- Python --> config/workos.py or app/workos.py
  |
  +-- Ruby --> config/initializers/workos.rb
```

Initialize with API key from environment. Check fetched docs for exact import pattern.

**Verify initialization:**

```bash
# Node.js
grep -r "WorkOS.*WORKOS_API_KEY" . --include="*.ts" --include="*.js"

# Python
grep -r "workos.*api_key.*os.getenv" . --include="*.py"

# Ruby
grep -r "WorkOS.*ENV.*WORKOS_API_KEY" . --include="*.rb"
```

## Step 4: Role Architecture Decision Tree

Determine which role model applies to your use case:

```
Role scope?
  |
  +-- Organization-specific roles --> Use Organization Roles API
  |   (Different permissions per organization)
  |   └── Endpoints: /organization-role/*
  |
  +-- Global roles across all orgs --> Use Roles API
      (Same role definition everywhere)
      └── Endpoints: /role/*
```

**Key distinction:**

- **Organization Roles** - Each organization has its own role instances with unique permissions
- **Global Roles** - Template roles that can be assigned across organizations

**Next steps depend on this choice.**

## Step 5A: Implement Organization Roles (If Chosen)

### Create Organization Role

Location pattern:

```
Framework?
  |
  +-- Next.js App Router --> app/api/organizations/[orgId]/roles/route.ts
  |
  +-- Express/Node --> routes/organizations/:orgId/roles.js
  |
  +-- Django/Flask --> views/organization_roles.py
  |
  +-- Rails --> controllers/organization_roles_controller.rb
```

**Critical pattern from docs:**

1. Parse `organizationId` from request path/body
2. Call `workos.organizationRoles.create({ organizationId, name, permissions })`
3. Return role object with `id`, `name`, `organizationId`, `permissions[]`

**Common mistake:** Forgetting `organizationId` - every org role operation requires it.

### List Organization Roles

Filter pattern:

```typescript
// Pagination + filtering
const roles = await workos.organizationRoles.list({
  organizationId: 'org_123',
  limit: 10,
  after: 'cursor_abc' // for pagination
});
```

Check docs for exact parameter names - they may differ from global roles.

### Update Permissions

Permission management has three operations:

```
Permission change type?
  |
  +-- Add single --> .addPermission(roleId, permissionSlug)
  |
  +-- Remove single --> .removePermission(roleId, permissionSlug)
  |
  +-- Replace all --> .setPermissions(roleId, permissionSlugs[])
```

**Critical:** `setPermissions` REPLACES all permissions. Do not use for incremental changes.

**Verify with:**

```bash
# Check for correct method usage
grep -r "setPermissions\|addPermission\|removePermission" . --include="*.ts" --include="*.js" --include="*.py"
```

## Step 5B: Implement Global Roles (If Chosen)

### Create Global Role

Location: Same pattern as Step 5A, but routes typically `/api/roles` not `/api/organizations/:orgId/roles`.

**Critical difference:**

```typescript
// Organization role - requires organizationId
workos.organizationRoles.create({ organizationId, name, permissions });

// Global role - no organizationId
workos.roles.create({ name, description });
```

Global roles are templates. Permissions are managed separately then assigned.

### Permission Management

Global roles follow different permission model:

1. Create permissions independently using `/permission/create`
2. Link permissions to roles using `/role/add-permission`
3. Assign role to users in specific organizations

Check fetched docs for exact relationship model.

## Step 6: Permission Objects

Permissions are separate entities. Create them before assigning to roles.

**Pattern:**

```typescript
// 1. Create permission
const permission = await workos.permissions.create({
  slug: 'documents:read',
  name: 'Read Documents',
  description: 'Can view documents'
});

// 2. Assign to role
await workos.roles.addPermission(roleId, permission.slug);
```

**Slug format rules:**

- Use colon notation: `resource:action`
- Lowercase, no spaces
- Examples: `documents:read`, `reports:write`, `users:delete`

**Verify permission creation:**

```bash
# Check for valid slug patterns
grep -r "slug.*['\"].*:.*['\"]" . --include="*.ts" --include="*.js" --include="*.py" | grep -v node_modules
```

## Step 7: Error Handling Patterns

Implement error boundaries for each operation:

```
Error type?
  |
  +-- 401 Unauthorized --> Invalid API key (Step 2 validation)
  |
  +-- 404 Not Found --> Role/permission/org doesn't exist
  |   └── Check: IDs are correct, resources not deleted
  |
  +-- 409 Conflict --> Duplicate slug/name
  |   └── Check: Permission slug or role name already exists
  |
  +-- 422 Unprocessable --> Invalid payload structure
      └── Check: Required fields, correct organizationId format
```

**Add logging for debugging:**

```typescript
try {
  const role = await workos.organizationRoles.create(payload);
} catch (error) {
  if (error.status === 409) {
    console.error('Role name conflict:', payload.name);
    // Handle duplicate
  } else if (error.status === 404) {
    console.error('Organization not found:', payload.organizationId);
    // Handle missing org
  }
  throw error;
}
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: Missing API key"

# 2. SDK initialized correctly
grep -r "new WorkOS\|WorkOS.*apiKey\|workos.*api_key" . --include="*.{ts,js,py,rb}" | head -n 1

# 3. Role endpoints respond (adjust URL for your server)
curl -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -d '{"name":"test","organizationId":"org_test"}' \
  | grep -q '"id"' && echo "PASS" || echo "FAIL"

# 4. Permission creation works
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -d '{"slug":"test:read","name":"Test Read"}' \
  | grep -q '"slug"' && echo "PASS" || echo "FAIL"

# 5. Build succeeds
npm run build || pytest || bundle exec rake test
```

**Critical:** Check #3 and #4 validate actual API integration, not just imports.

## Error Recovery

### "Invalid API key" (401)

**Root cause:** API key missing, malformed, or lacks permissions.

Fix:

1. Verify key starts with `sk_`: `echo $WORKOS_API_KEY | grep ^sk_`
2. Check WorkOS Dashboard > API Keys for key status (not revoked)
3. Verify key has "Roles & Permissions" scope enabled

### "Organization not found" (404)

**Root cause:** Invalid `organizationId` or organization deleted.

Fix:

1. List organizations: `workos.organizations.list()` to verify ID
2. Check ID format: Must start with `org_`
3. Verify organization wasn't archived/deleted in Dashboard

### "Duplicate slug" (409)

**Root cause:** Permission slug already exists.

Fix:

1. Use unique slugs: `documents:read_v2` not just `documents:read`
2. Check existing permissions: `workos.permissions.list()` before creating
3. Use update instead: `workos.permissions.update(id, payload)` to modify existing

### "Module not found: @workos-inc/node"

**Root cause:** SDK not installed or wrong package name.

Fix:

```bash
# Node.js
npm install @workos-inc/node

# Python
pip install workos

# Ruby
bundle add workos
```

**Verify:** Check node_modules/@workos-inc/node or site-packages/workos exists.

### "Cannot read property 'create' of undefined"

**Root cause:** SDK not initialized before use, or wrong SDK method name.

Fix:

1. Ensure initialization runs before route handlers
2. Check method names match fetched docs exactly
3. For Node.js, verify: `const workos = new WorkOS('api-key')` exists

### Type errors with organizationId

**Root cause:** Mixing global roles API with organization-specific calls.

Fix:

1. Review Step 4 decision tree — confirm correct API choice
2. Organization roles ALWAYS need `organizationId` parameter
3. Global roles NEVER use `organizationId` in create/update

## Related Skills

- `workos-admin-portal` - For managing organization settings where roles are used
- `workos-directory-sync` - For syncing role assignments from external directories
- `workos-authkit-nextjs` - For checking role permissions in authenticated routes
