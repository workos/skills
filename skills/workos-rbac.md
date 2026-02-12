---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:968acae2e2f5 -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

If this skill conflicts with fetched documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### Authentication Setup

Verify environment variables:

- `WORKOS_API_KEY` exists and starts with `sk_`
- `WORKOS_CLIENT_ID` exists (if using AuthKit integration)

### SDK Installation

Check SDK package exists:

```bash
# Node.js
test -d node_modules/@workos-inc || echo "FAIL: SDK not installed"

# Python
python -c "import workos" 2>/dev/null || echo "FAIL: SDK not installed"

# Ruby
ruby -e "require 'workos'" 2>/dev/null || echo "FAIL: SDK not installed"
```

**Do not proceed until SDK is installed.**

## Step 3: Dashboard Configuration (REQUIRED)

**CRITICAL:** RBAC cannot function without roles configured in WorkOS Dashboard. This is not optional.

Navigate to: https://dashboard.workos.com/

### Create Environment Roles

1. Go to **Roles & Permissions** section
2. Click **Create Role**
3. Define role slug (e.g., `admin`, `member`, `viewer`)
4. Assign permissions to role

**Minimum viable setup:** 2 roles (privileged + default) with at least 1 permission each.

### Set Default Role

1. In Roles configuration, designate one role as **Default Role**
2. This role is auto-assigned to new organization memberships

**Verify dashboard config before continuing:**

```bash
# Test API connectivity and role retrieval
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/roles | grep -q "slug" || echo "FAIL: No roles configured"
```

## Step 4: Integration Pattern (Decision Tree)

```
Using AuthKit?
  |
  +-- YES --> Step 5: AuthKit Integration (Role-Aware Sessions)
  |
  +-- NO  --> Are you using SSO or Directory Sync?
              |
              +-- YES --> Step 6: Standalone RBAC with IdP Role Assignment
              |
              +-- NO  --> Step 7: Pure API Integration (Manual Role Management)
```

## Step 5: AuthKit Integration (Role-Aware Sessions)

**This is the primary integration path for most applications.**

### How It Works

- Roles attached to organization memberships via API or Dashboard
- Roles + permissions included in AuthKit session JWTs automatically
- No additional API calls needed for authorization checks in request handlers

### Session JWT Structure

After user authenticates, session contains:

```json
{
  "user": { "id": "user_01..." },
  "organizationId": "org_01...",
  "role": "admin",
  "permissions": ["videos:create", "videos:delete", "settings:manage"]
}
```

**For multiple roles:** `role` becomes `roles: ["admin", "editor"]` array.

### Assign Roles to Organization Memberships

**Via API:**

Check fetched docs for SDK method signature. Typical pattern:

```typescript
// Create membership with role
await workos.organizationMemberships.create({
  organizationId: "org_01...",
  userId: "user_01...",
  roleSlug: "admin", // must match slug from Dashboard
});

// Update existing membership role
await workos.organizationMemberships.update({
  organizationMembershipId: "om_01...",
  roleSlug: "viewer",
});
```

**Via Dashboard:**

1. Navigate to organization in Dashboard
2. Go to **Members** tab
3. Click member → **Edit Role**

### Read Roles from Session

**Server-side (recommended):**

```typescript
import { getUser } from "@workos-inc/authkit-nextjs";

export default async function handler(req, res) {
  const { user, organizationId, role, permissions } = await getUser();

  // Check permission
  if (!permissions.includes("videos:create")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Check role
  if (role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
}
```

**Client-side (use sparingly):**

```typescript
import { useAuth } from '@workos-inc/authkit-nextjs';

function VideoUpload() {
  const { permissions } = useAuth();

  if (!permissions?.includes('videos:create')) {
    return <div>No upload permission</div>;
  }

  return <UploadForm />;
}
```

**CRITICAL:** Always verify permissions server-side. Client checks are for UX only.

### Multiple Roles Support

If a user has multiple roles (via group-based assignment), session contains:

```json
{
  "roles": ["admin", "editor"],
  "permissions": [
    "videos:create",
    "videos:delete",
    "settings:manage",
    "videos:edit"
  ]
}
```

Permissions are merged from all assigned roles.

**Proceed to Step 8 for verification.**

## Step 6: Standalone RBAC with IdP Role Assignment

**Use this if:** You have SSO or Directory Sync WITHOUT AuthKit, but want automatic role assignment from IdP.

### Directory Sync Role Mapping

1. In Dashboard, go to **Directory Sync** → **Connections**
2. For each directory, configure **Role Mappings** under connection settings
3. Map directory groups to WorkOS roles:

```
Directory Group        --> WorkOS Role
engineering-admins     --> admin
engineering-members    --> member
```

When directory user syncs, their groups determine their organization membership role.

**Check fetched docs for exact configuration path** — Dashboard UI may have changed.

### SSO Group Role Assignment

1. In Dashboard, go to **SSO** → **Connections**
2. For each SSO connection, configure **Group Mappings**
3. Map IdP groups to WorkOS roles

When user authenticates via SSO with JIT provisioning:

- User added to organization automatically
- Role assigned based on IdP groups

### Precedence Rule (CRITICAL)

IdP-assigned roles ALWAYS override API/Dashboard-assigned roles. If you manually set a role via API, and the user authenticates via SSO with group mappings, the IdP role wins.

**To prevent override:** Remove group mappings or use API-only role assignment.

### Reading Roles via API

Without AuthKit sessions, fetch roles explicitly:

```bash
# List organization memberships with roles
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?user_id=user_01..."
```

Check fetched docs for SDK method equivalent.

**Proceed to Step 8 for verification.**

## Step 7: Pure API Integration (Manual Role Management)

**Use this if:** No AuthKit, no SSO, no Directory Sync — just manual role assignment.

### Create Organization Membership with Role

Check fetched SDK docs for exact method signature. API pattern:

```
POST /user_management/organization_memberships
{
  "organization_id": "org_01...",
  "user_id": "user_01...",
  "role_slug": "admin"
}
```

### Update Role

```
PUT /user_management/organization_memberships/{id}
{
  "role_slug": "viewer"
}
```

### Fetch Membership Roles

```
GET /user_management/organization_memberships?user_id=user_01...&organization_id=org_01...
```

Response includes `role` field with assigned slug.

### Authorization Check Pattern

```typescript
// 1. Fetch user's organization membership
const membership = await workos.organizationMemberships.list({
  userId: currentUserId,
  organizationId: currentOrgId,
});

// 2. Check role or permissions
const role = membership.data[0]?.role;
if (role !== "admin") {
  throw new Error("Forbidden");
}
```

**CRITICAL:** This requires an API call per authorization check. For high-traffic apps, cache membership data with short TTL (5-10 minutes).

**Proceed to Step 8 for verification.**

## Step 8: Organization-Specific Roles (Optional)

**Use this if:** Different organizations need different role structures beyond environment defaults.

### When to Use

- Organization requires custom role with reduced permissions
- Organization needs specialized role not applicable to other orgs

### Creating Organization Roles

1. In Dashboard, navigate to specific organization
2. Go to **Roles** tab
3. Click **Create Role**
4. Define role slug (auto-prefixed with `org_`) and permissions

**Via API:** Check fetched docs for Organization Roles API endpoint.

### Effect of First Organization Role

Once you create the first custom role for an organization:

- Organization gets independent default role setting
- Organization gets independent priority order
- Environment roles still available, but at bottom of priority order

### Deleting Environment Roles

If you delete an environment role that's a default role for organizations:

- Dashboard prompts for replacement role selection
- Members with deleted role are reassigned to new default

**Check Dashboard before deleting environment roles.**

## Step 9: Permission-Based Authorization Pattern

**Prefer permission checks over role checks** for fine-grained control.

### Why Permissions > Roles

- Roles can change without code changes
- Permissions represent specific capabilities
- Multiple roles can grant same permission

### Permission Check Example

```typescript
// GOOD: Check permission
if (permissions.includes("videos:delete")) {
  await deleteVideo(videoId);
}

// AVOID: Check role
if (role === "admin") {
  await deleteVideo(videoId);
}
```

### Permission Naming Convention

Use namespace:action format:

```
videos:create
videos:delete
videos:edit
settings:manage
users:invite
```

**Check Dashboard for configured permissions** — the exact set is user-defined.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify RBAC integration:

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: API key missing"

# 2. Verify roles configured in Dashboard (API test)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/roles | grep -q '"data":\[' || echo "FAIL: No roles configured"

# 3. If using AuthKit: Check session includes role/permissions
# (Manual test: Authenticate and inspect session JWT)

# 4. Test permission check in protected route
# (Manual test: Request protected endpoint without permission → 403)

# 5. Application builds without errors
npm run build || echo "FAIL: Build errors"
```

**Do not mark complete until all checks pass.**

## Error Recovery

### "No roles configured" / Empty roles list

**Root cause:** Dashboard roles not created.

**Fix:**

1. Go to https://dashboard.workos.com/
2. Navigate to **Roles & Permissions**
3. Create at least 2 roles with permissions
4. Set default role

### "Forbidden" errors despite correct role

**Root cause 1:** Role slug mismatch between Dashboard and code.

**Fix:** Check exact role slug in Dashboard (case-sensitive).

**Root cause 2:** Permission not assigned to role.

**Fix:** In Dashboard, edit role → verify permission is checked.

**Root cause 3:** Organization membership missing role.

**Fix:** Check membership via API:

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?user_id=USER_ID"
```

If `role` field is null or wrong, update via Dashboard or API.

### Session missing `role` or `permissions` fields (AuthKit)

**Root cause:** User authenticated before role was assigned.

**Fix:** Re-authenticate user to refresh session JWT.

**Prevention:** Assign default role immediately when creating organization membership.

### IdP role assignment not working

**Root cause 1:** Group mappings not configured in Dashboard.

**Fix:** Check SSO/Directory connection settings → Role Mappings tab.

**Root cause 2:** User not in mapped IdP group.

**Fix:** Verify user's group membership in IdP admin console.

**Root cause 3:** Directory events not syncing.

**Fix:** Check Directory connection status in Dashboard → verify webhook endpoint is reachable.

### "Role not found" API error

**Root cause:** Role slug doesn't exist in environment OR organization.

**Fix:**

1. Verify role exists in Dashboard
2. If using organization role, ensure slug is prefixed with `org_`
3. Check for typos (slugs are case-sensitive)

### Organization role not visible

**Root cause:** No custom roles created for organization yet.

**Fix:** Organization inherits environment roles by default. To use org-specific roles, create at least one custom role for that organization.

## Related Skills

- **workos-authkit-nextjs**: Integrating AuthKit for role-aware sessions
- **workos-directory-sync.rules.yml**: Syncing user roles from directories
- **workos-migrate-other-services.rules.yml**: Migrating from other auth providers with existing roles
