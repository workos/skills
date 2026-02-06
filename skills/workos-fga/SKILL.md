---
name: workos-fga
description: Implement fine-grained authorization with WorkOS FGA.
---

<!-- generated -->

# WorkOS Fine-Grained Authorization

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/fga/index`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

**CRITICAL NOTICE:** FGA is coming Q1 2026. The endpoints described here are not yet available. The previous FGA version was deprecated November 15, 2025. This skill prepares for the new architecture.

## Step 2: Pre-Flight Validation

### Project Structure

- Confirm SDK already installed (see `workos-sdk-setup` skill if needed)
- Confirm `package.json` contains `@workos-inc/node` dependency

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run these before continuing:

```bash
# Check env vars exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing WorkOS credentials"

# Check SDK installed
ls node_modules/@workos-inc/node/package.json 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: Dashboard Configuration (BLOCKING)

**STOP. Manual step required.**

Navigate to WorkOS Dashboard → Authorization → Fine-Grained Authorization.

Define resource types that match your app's hierarchy:

```
Example hierarchy:
  Org (root)
  └─ Workspace
     └─ Project
        └─ App
```

For each resource type:
1. Create type with unique slug (e.g., `workspace`, `project`, `app`)
2. Set parent type (e.g., `project` parent is `workspace`)
3. Note the slug — you'll use it in API calls

**Verify:** Screenshot or note the resource type slugs. You cannot proceed without them.

## Step 4: Resource Type Decision Tree

Determine if your app needs FGA:

```
Authorization needs?
  |
  +-- Org-level roles only (Admin/Member)
  |     --> Use RBAC skill instead (workos-rbac)
  |
  +-- Per-resource permissions (workspace editor, project viewer)
  |     --> Continue with FGA
  |
  +-- Nested hierarchies (workspace → project → app)
        --> Continue with FGA
```

**If RBAC is sufficient:** Stop here. Use `workos-rbac` skill for simpler implementation.

## Step 5: Initialize SDK Client

Create an authorization service wrapper:

```typescript
// lib/fga.ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export { workos };
```

**Verify:**

```bash
# Check file exists with WorkOS import
grep "WorkOS" lib/fga.ts || echo "FAIL: SDK not imported"
```

## Step 6: Resource Instance Management

### Pattern: Create resource when user creates entity

When user creates a workspace/project/app in your app:

```typescript
import { workos } from '@/lib/fga';

// User created "Finance Workspace" in your app
const resource = await workos.fga.createResource({
  resourceType: 'workspace', // slug from Dashboard
  externalId: workspaceId, // your app's ID
  parentResourceId: orgResourceId, // if nested
  metadata: {
    name: 'Finance Workspace',
    createdBy: userId,
  },
});

// Store resource.id in your database alongside workspace record
```

**Critical:** Store the returned `resource.id` in your database. You need it for assignments and checks.

### Pattern: Retrieve resource by your app's ID

When you have your internal ID but need WorkOS resource:

```typescript
// Lookup by your app's workspaceId
const resource = await workos.fga.getResourceByExternalId({
  organizationId: orgId,
  resourceType: 'workspace',
  externalId: workspaceId,
});
```

### Pattern: Delete resource when entity deleted

```typescript
await workos.fga.deleteResource(resourceId);
```

**Verify:** After implementing resource creation:

```bash
# Check createResource is called in entity creation logic
grep -r "createResource" app/ src/ || echo "FAIL: Resource creation not implemented"

# Check resource ID is stored in database schema
grep -r "resource_id\|resourceId" prisma/schema.prisma migrations/ || echo "FAIL: Resource ID not in schema"
```

## Step 7: Role Assignment

### Pattern: Assign role when granting access

When user grants another user access to a resource:

```typescript
// Grant "editor" role on "Finance Workspace" to user
await workos.fga.createAssignment({
  organizationMembershipId: membershipId, // WorkOS membership ID
  roleSlug: 'editor', // from RBAC configuration
  resourceId: workspaceResourceId, // from Step 6
});
```

**Important:** `roleSlug` must exist in your RBAC configuration. FGA extends RBAC roles.

### Pattern: Remove access

```typescript
await workos.fga.deleteAssignment({
  organizationMembershipId: membershipId,
  roleSlug: 'editor',
  resourceId: workspaceResourceId,
});
```

**Verify:**

```bash
# Check assignment creation in access grant logic
grep -r "createAssignment" app/ src/ || echo "FAIL: Assignment creation not implemented"
```

## Step 8: Authorization Checks

### Pattern: Check user can perform action

In API routes, middleware, or server actions:

```typescript
// Can this user edit this project?
const canEdit = await workos.fga.checkAuthorization({
  organizationMembershipId: membershipId,
  permission: 'projects:edit', // from role definition
  resourceId: projectResourceId,
});

if (!canEdit.authorized) {
  throw new Error('Unauthorized');
}

// Proceed with action
```

**Critical:** Always check authorization before sensitive operations. Do not rely on UI hiding alone.

### Pattern: List resources user can access

For listing pages (e.g., "Show all projects I can view"):

```typescript
// Get all projects this user can view
const resources = await workos.fga.listResourcesForMembership({
  organizationMembershipId: membershipId,
  resourceType: 'project',
  permission: 'projects:view', // optional filter
});

// resources contains WorkOS resource objects
// Match resource.externalId to your app's project IDs
const projectIds = resources.map((r) => r.externalId);
```

### Pattern: List users with access to resource

For "Share" dialogs showing who has access:

```typescript
// Who can access this workspace?
const memberships = await workos.fga.listMembershipsForResource({
  resourceId: workspaceResourceId,
  permission: 'workspaces:view', // optional filter
});

// memberships contains WorkOS membership objects
```

**Verify:**

```bash
# Check authorization checks exist in protected routes
grep -r "checkAuthorization\|checkAccess" app/api/ app/actions/ || echo "FAIL: No authorization checks found"
```

## Step 9: Inheritance Validation

FGA automatically propagates permissions down hierarchies. Test this works:

```
Given:
  - User has "editor" role on Workspace A
  - Role "editor" includes permission "projects:edit"
  - Project X is child of Workspace A

Expected:
  - checkAuthorization for "projects:edit" on Project X returns true
  - User did NOT receive explicit assignment on Project X
```

**Test script:**

```typescript
// test/fga-inheritance.test.ts
const workspaceResource = await workos.fga.createResource({
  resourceType: 'workspace',
  externalId: 'test-workspace',
  parentResourceId: orgResourceId,
});

const projectResource = await workos.fga.createResource({
  resourceType: 'project',
  externalId: 'test-project',
  parentResourceId: workspaceResource.id, // child of workspace
});

await workos.fga.createAssignment({
  organizationMembershipId: testMembershipId,
  roleSlug: 'editor',
  resourceId: workspaceResource.id, // assigned on workspace
});

// Check permission on child project (not directly assigned)
const result = await workos.fga.checkAuthorization({
  organizationMembershipId: testMembershipId,
  permission: 'projects:edit',
  resourceId: projectResource.id, // checking child
});

expect(result.authorized).toBe(true); // should inherit from parent
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables set
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing env vars"

# 2. SDK imported
grep -r "from '@workos-inc/node'" lib/ src/ || echo "FAIL: SDK not imported"

# 3. Resource creation implemented
grep -r "createResource" app/ src/ || echo "FAIL: Resource creation missing"

# 4. Authorization checks exist
grep -r "checkAuthorization\|checkAccess" app/ src/ || echo "FAIL: No auth checks"

# 5. Resource IDs stored in database
grep -r "resource_id\|resourceId" prisma/schema.prisma migrations/ || echo "FAIL: Schema missing resource_id"

# 6. Application builds
npm run build || echo "FAIL: Build errors"

# 7. TypeScript types resolve (if using TS)
npx tsc --noEmit || echo "FAIL: Type errors"
```

**All checks must pass before marking integration complete.**

## Error Recovery

### "Resource type not found"

**Root cause:** Resource type slug does not exist in Dashboard configuration.

**Fix:**
1. Open WorkOS Dashboard → Authorization → Fine-Grained Authorization
2. Verify resource type exists with exact slug you're using
3. Slugs are case-sensitive — `workspace` ≠ `Workspace`

### "Parent resource not found"

**Root cause:** Trying to create child resource with invalid `parentResourceId`.

**Fix:**
1. Verify parent resource exists: `workos.fga.getResource(parentResourceId)`
2. Check resource type hierarchy in Dashboard — child type must have parent type configured
3. If migrating data, create parents before children

### "Permission denied" on authorization check

**Root cause (Decision Tree):**

```
Permission denied?
  |
  +-- No assignment exists
  |     --> Check assignments: listMembershipsForResource()
  |     --> Verify createAssignment() was called
  |
  +-- Permission not in role
  |     --> Check role definition in Dashboard
  |     --> Verify permission slug matches exactly
  |
  +-- Inheritance broken
        --> Verify resource hierarchy (parent set correctly)
        --> Check role includes child-type permissions
```

**Debug script:**

```bash
# List all assignments for a resource
curl -X GET "https://api.workos.com/authorization/resources/{resource_id}/organization_memberships" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Check user's roles
curl -X GET "https://api.workos.com/authorization/organization_memberships/{membership_id}/roles" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### "External ID conflict"

**Root cause:** Creating resource with `externalId` that already exists for that org + resource type.

**Fix:**
1. External IDs must be unique within (organizationId, resourceType) scope
2. Use `getResourceByExternalId()` to check if exists before creating
3. If entity was deleted and recreated, delete old WorkOS resource first

### "Cannot delete resource with children"

**Root cause:** Trying to delete parent resource before deleting children.

**Fix:**
1. Delete child resources first (bottom-up)
2. Or use cascade delete if supported (check docs)

### SDK import errors (TypeScript)

**Root cause:** Incorrect import path or missing types.

**Fix:**
```typescript
// Correct import
import { WorkOS } from '@workos-inc/node';

// NOT this (common mistake)
import WorkOS from '@workos-inc/node'; // missing named export
```

### Rate limiting (429 errors)

**Root cause:** Too many authorization checks per second.

**Fix:**
1. Cache authorization results at app layer (30-60 seconds)
2. Batch resource discovery calls instead of N+1 checks
3. Contact WorkOS support for rate limit increase if needed

## Related Skills

- **workos-rbac**: Set up base roles and permissions (prerequisite)
- **workos-authkit-nextjs**: Get organization membership IDs for FGA
- **workos-organizations**: Manage organizations that own resources
