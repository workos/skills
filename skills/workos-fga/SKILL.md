---
name: workos-fga
description: Implement fine-grained authorization with WorkOS FGA.
---

<!-- generated -->

# WorkOS Fine-Grained Authorization

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/fga/index`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

**CRITICAL PRE-RELEASE NOTE:** FGA is scheduled for Q1 2026 release. Check docs for current availability status. If endpoints return 404 or "not available", this feature is not yet released.

## Step 2: Pre-Flight Validation

### Check FGA Availability

```bash
# Test if FGA endpoints are live
curl -f -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/authorization/resources 2>/dev/null && echo "FGA Available" || echo "FGA Not Yet Released"
```

If command fails: FGA is not available yet. Stop here.

### Environment Variables

Check environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

```bash
# Verify keys exist and have correct prefixes
[[ $WORKOS_API_KEY == sk_* ]] && echo "API key valid" || echo "FAIL: Invalid API key"
[[ $WORKOS_CLIENT_ID == client_* ]] && echo "Client ID valid" || echo "FAIL: Invalid client ID"
```

### SDK Verification

```bash
# Confirm WorkOS SDK is installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

If SDK missing: Install with `npm install @workos-inc/node` before continuing.

## Step 3: Resource Type Design (CRITICAL PLANNING PHASE)

**STOP. Design your resource hierarchy before writing code.**

FGA extends RBAC with resource instances. You must define:

1. **Resource types** - categories of objects (workspace, project, app)
2. **Hierarchy** - parent-child relationships
3. **Permissions** - which roles can do what on each type

### Example Hierarchy

```
Organization (always root)
  |
  +-- Workspace
       |
       +-- Project
            |
            +-- App
```

### Configure in Dashboard

1. Navigate to WorkOS Dashboard → Authorization → Resource Types
2. Create each resource type with:
   - `slug` - machine name (workspace, project, app)
   - `name` - human-readable label
   - `parent_type` - optional, for inheritance
3. Add permissions for each type

**Verify dashboard config complete before Step 4.**

## Step 4: Resource Instance Registration

When users create resources in your app, register them with FGA.

### Decision Tree: When to Register

```
User creates object in your app?
  |
  +-- Is it authorization-relevant? (workspace, project, NOT log entry)
  |     |
  |     +-- YES --> Register resource instance
  |     |
  |     +-- NO  --> Do not register
  |
  +-- Is parent resource known?
        |
        +-- YES --> Include parent_resource_id in registration
        |
        +-- NO  --> Register at org level (parent_resource_id = org_id)
```

### Registration Pattern

```typescript
// After creating resource in your database
const resource = await workos.fga.resources.create({
  resource_type: 'workspace', // matches dashboard slug
  external_id: dbWorkspace.id, // YOUR database ID
  name: dbWorkspace.name,
  parent_resource_id: orgId, // or parent workspace ID
});

// Store resource.id in your database alongside dbWorkspace.id
// You'll need both IDs for future operations
```

**CRITICAL:** Store both `external_id` (your ID) and `resource.id` (WorkOS ID) in your database. You need WorkOS ID for assignments.

### Bulk Registration Pattern

If migrating existing resources:

```typescript
// Fetch existing resources from your DB
const workspaces = await db.workspace.findMany();

// Register each with FGA
for (const ws of workspaces) {
  const resource = await workos.fga.resources.create({
    resource_type: 'workspace',
    external_id: ws.id,
    name: ws.name,
    parent_resource_id: ws.orgId,
  });

  // Update your DB with WorkOS resource ID
  await db.workspace.update({
    where: { id: ws.id },
    data: { workosResourceId: resource.id },
  });
}
```

## Step 5: Role Assignments

Assign roles to users for specific resources.

### Assignment Pattern

```typescript
// When adding user to workspace with role
await workos.fga.assignments.create({
  organization_membership_id: membership.id, // from AuthKit
  role_slug: 'workspace-admin', // role defined in dashboard
  resource_id: workspace.workosResourceId, // from Step 4
});
```

### Inheritance Behavior

**IMPORTANT:** If role has child-type permissions, FGA automatically propagates to children.

Example:
- User assigned `workspace-admin` on `Workspace:finance`
- Role includes permission `project:edit`
- User automatically gets `project:edit` on ALL projects under `Workspace:finance`

**Do not manually assign roles to child resources if parent assignment covers it.**

### Remove Assignment

```typescript
// When removing user from workspace
await workos.fga.assignments.delete({
  organization_membership_id: membership.id,
  role_slug: 'workspace-admin',
  resource_id: workspace.workosResourceId,
});
```

## Step 6: Access Checks

Check if user has permission before allowing action.

### Single Permission Check

```typescript
// Before allowing project edit
const canEdit = await workos.fga.check({
  organization_membership_id: membership.id,
  permission: 'project:edit',
  resource_id: project.workosResourceId,
});

if (!canEdit.authorized) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}

// Proceed with edit
```

### Batch Check Pattern

```typescript
// Check multiple permissions at once
const [canEdit, canDelete, canShare] = await Promise.all([
  workos.fga.check({
    organization_membership_id: membership.id,
    permission: 'project:edit',
    resource_id: project.workosResourceId,
  }),
  workos.fga.check({
    organization_membership_id: membership.id,
    permission: 'project:delete',
    resource_id: project.workosResourceId,
  }),
  workos.fga.check({
    organization_membership_id: membership.id,
    permission: 'project:share',
    resource_id: project.workosResourceId,
  }),
]);
```

## Step 7: Resource Discovery

Query which resources user can access.

### Pattern: List User's Resources

```typescript
// "Show all projects this user can edit"
const editableProjects = await workos.fga.organizationMemberships.resources({
  organization_membership_id: membership.id,
  resource_type: 'project',
  permission: 'project:edit',
});

// Returns array of resource objects user can edit
```

### Pattern: List Resource Members

```typescript
// "Who has access to this workspace?"
const members =
  await workos.fga.resources.organizationMemberships({
    resource_id: workspace.workosResourceId,
  });

// Returns array of memberships with access (direct or inherited)
```

### Pattern: List User's Roles

```typescript
// "What roles does this user have?"
const roles = await workos.fga.organizationMemberships.roles({
  organization_membership_id: membership.id,
});

// Returns array of role assignments across all resources
```

## Step 8: External ID Lookups

Use your database IDs directly without storing WorkOS IDs.

### Pattern: Fetch by External ID

```typescript
// If you only stored external_id, not workos resource_id
const resource = await workos.fga.organizations.resources.getByExternalId({
  organization_id: orgId,
  resource_type: 'workspace',
  external_id: dbWorkspace.id, // YOUR database ID
});

// Now you have resource.id for assignments/checks
```

**Trade-off:** This adds extra API call. Storing both IDs (Step 4) is more efficient.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check FGA is available (not pre-release)
curl -f -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/authorization/resources >/dev/null 2>&1 && echo "PASS" || echo "FAIL: FGA not available"

# 2. Check resource types configured in dashboard (manual verification required)
echo "MANUAL: Verify resource types exist in WorkOS Dashboard → Authorization"

# 3. Check resource registration code exists
grep -r "fga.resources.create" . --include="*.ts" --include="*.js" && echo "PASS" || echo "FAIL: No resource registration"

# 4. Check access control implemented
grep -r "fga.check" . --include="*.ts" --include="*.js" && echo "PASS" || echo "FAIL: No access checks"

# 5. Application builds
npm run build && echo "PASS" || echo "FAIL: Build error"
```

**If check #1 fails:** FGA is not released yet. Stop implementation until Q1 2026.

**If check #2 fails:** Configure resource types in Dashboard before writing code. This is a blocking requirement.

## Error Recovery

### "FGA endpoints return 404"

**Root cause:** Feature not released yet (scheduled Q1 2026).

Fix: Check docs for release status. Do not implement until available.

### "Resource type not found"

**Root cause:** Resource type slug in code doesn't match Dashboard config.

Fix:

1. Check exact slug in Dashboard → Authorization → Resource Types
2. Match slug exactly in `resource_type` parameter (case-sensitive)

### "Assignment failed: invalid organization_membership_id"

**Root cause:** Using user ID instead of organization membership ID.

Fix: Get membership ID from AuthKit:

```typescript
// WRONG
await workos.fga.assignments.create({
  organization_membership_id: user.id, // user ID
});

// CORRECT
const membership = await workos.organizations.memberships.list({
  organization_id: orgId,
  user_id: user.id,
});
await workos.fga.assignments.create({
  organization_membership_id: membership.data[0].id, // membership ID
});
```

### "Permission check always returns false"

**Root cause 1:** Role doesn't include permission in Dashboard config.

Fix: Add permission to role in Dashboard → RBAC → Roles.

**Root cause 2:** No assignment exists for user on resource or ancestor.

Fix: Check assignments exist:

```bash
# List user's roles to verify assignment
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/authorization/organization_memberships/${MEMBERSHIP_ID}/roles"
```

**Root cause 3:** Using wrong resource ID (your DB ID instead of WorkOS ID).

Fix: Use `resource.id` from registration response, not `external_id`.

### "Cannot delete resource: has children"

**Root cause:** Attempting to delete parent resource while children still exist.

Fix: Delete children first, then parent:

```typescript
// Delete all projects under workspace first
for (const project of projects) {
  await workos.fga.resources.delete(project.workosResourceId);
}

// Then delete workspace
await workos.fga.resources.delete(workspace.workosResourceId);
```

### "SDK method not found"

**Root cause:** SDK version too old or FGA not yet released.

Fix:

```bash
# Update SDK to latest
npm install @workos-inc/node@latest

# Verify version supports FGA
npm list @workos-inc/node
```

Check SDK changelog for FGA support version.

## Related Skills

- **workos-rbac**: Organization-level role-based access control (prerequisite for FGA)
- **workos-authkit-nextjs**: User authentication and organization management (provides membership IDs)
