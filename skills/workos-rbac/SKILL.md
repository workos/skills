---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- generated -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. `https://workos.com/docs/rbac/quick-start`
2. `https://workos.com/docs/rbac/configuration`
3. `https://workos.com/docs/rbac/integration`
4. `https://workos.com/docs/rbac/organization-roles`
5. `https://workos.com/docs/rbac/idp-role-assignment`

If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account & API Keys

Check environment variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run `curl` to confirm API key is valid:

```bash
curl -X GET https://api.workos.com/user_management/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  --fail-with-body
```

Expected: HTTP 200 with JSON array. If 401, API key is invalid.

### SDK Installation

Check for WorkOS SDK in `package.json`:

```bash
grep -E '"@workos-inc/(node|authkit)"' package.json
```

If not found, install based on your stack:

```
Stack              --> SDK package
Node.js backend    --> @workos-inc/node
Next.js w/ AuthKit --> @workos-inc/authkit-nextjs
```

**Verify:** SDK package exists in `node_modules/@workos-inc/` before continuing.

## Step 3: Dashboard Configuration (REQUIRED)

**CRITICAL:** You MUST configure roles in WorkOS Dashboard before writing code. RBAC does not work without this step.

Navigate to https://dashboard.workos.com/ and:

1. Go to **Roles & Permissions** section (environment-level)
2. Click **Create Role** for each role your app needs
3. For each role, assign permissions (read, write, delete, etc.)
4. Set a **Default Role** (assigned to new organization members automatically)

### Example Role Structure

```
Role Hierarchy (priority order matters):
  1. admin        --> permissions: users.read, users.write, settings.write
  2. editor       --> permissions: videos.read, videos.write
  3. viewer       --> permissions: videos.read
  (Default role: viewer)
```

**Verify Dashboard Config:**

```bash
# List all roles via API - should return your configured roles
curl -X GET https://api.workos.com/user_management/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: JSON array with your roles. If empty, go back and configure roles in Dashboard.

## Step 4: Integration Pattern Detection (Decision Tree)

Determine how you're using RBAC:

```
Authentication method?
  |
  +-- AuthKit (recommended)
  |     |
  |     +-- With SSO/Directory Sync --> Enable IdP role assignment (Step 5a)
  |     |
  |     +-- Without SSO --> Assign roles via API (Step 5b)
  |
  +-- Custom auth (SSO/Directory only)
        |
        +-- Enable IdP role assignment (Step 5a)
```

## Step 5a: IdP Role Assignment (SSO/Directory Sync)

**Use when:** Roles come from customer's identity provider (Okta, Azure AD, etc.)

### Configure Group Mappings

In WorkOS Dashboard, under the **organization**:

1. Navigate to **Directory Sync** or **SSO** connection
2. Go to **Role Mappings** tab
3. Map IdP groups to WorkOS roles:

```
IdP Group Name        --> WorkOS Role
"Engineering-Admins"  --> admin
"Engineering-Users"   --> editor
"Viewers"             --> viewer
```

**CRITICAL:** Group names must match EXACTLY as they appear in IdP (case-sensitive).

### Precedence Rules

IdP-assigned roles **always override** API-assigned roles. If a user has `editor` via API but `admin` via IdP group, they get `admin`.

**Timing:**

- SSO: Roles update on next login
- Directory Sync: Roles update when directory event received (real-time)

**Verify IdP Assignment:**

```bash
# After user logs in, check their organization membership
curl -X GET https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d user_id=user_01H... \
  -d organization_id=org_01H...
```

Expected: `role` field matches IdP group mapping.

## Step 5b: API-Based Role Assignment

**Use when:** You manage roles in your application (not sourced from IdP)

### Assign Role on Invitation

When inviting user to organization:

```typescript
const { organizationMembership } = await workos.userManagement.createOrganizationMembership({
  userId: 'user_01H...',
  organizationId: 'org_01H...',
  roleSlug: 'editor' // Must match role slug from Dashboard
});
```

### Update Existing Membership

```typescript
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: 'om_01H...',
  roleSlug: 'admin'
});
```

**CRITICAL:** `roleSlug` must match exactly as configured in Dashboard (case-sensitive).

**Verify Assignment:**

```bash
# Check organization membership
curl -X GET https://api.workos.com/user_management/organization_memberships/om_01H... \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: `"role": { "slug": "editor" }` in response.

## Step 6: Enforce Access Control in Application

### Read Roles from Session (AuthKit)

**Server-side (recommended):**

```typescript
import { getSignInUrl, getUser, signOut } from '@workos-inc/authkit-nextjs';

export default async function ProtectedPage() {
  const { user } = await getUser();
  
  if (!user) {
    // Redirect to sign in
    const signInUrl = await getSignInUrl();
    redirect(signInUrl);
  }

  // Access role from active organization membership
  const role = user.role; // { slug: 'admin', ... }
  
  // Check permissions
  if (!role.permissions.includes('settings.write')) {
    return <div>Access Denied</div>;
  }

  return <SettingsPage />;
}
```

**CRITICAL:** Always check `user.role.permissions` array, not just role slug. Permissions can change in Dashboard without code changes.

### Permission Check Pattern

```typescript
function hasPermission(user: User, permission: string): boolean {
  return user.role?.permissions?.includes(permission) ?? false;
}

// Usage
if (!hasPermission(user, 'videos.delete')) {
  throw new Error('Insufficient permissions');
}
```

### Multiple Roles Support

If user has multiple roles (via multiple IdP groups), check if ANY role grants permission:

```typescript
function hasAnyPermission(user: User, permission: string): boolean {
  if (!user.roles) return false;
  return user.roles.some(role => role.permissions.includes(permission));
}
```

## Step 7: Organization-Level Custom Roles (Optional)

**Use when:** Specific organizations need custom roles different from environment defaults.

Navigate to WorkOS Dashboard > **Organizations** > select organization > **Roles** tab.

### Create Organization Role

1. Click **Create Role**
2. Role slug automatically prefixed with `org:` (e.g., `org:custom-admin`)
3. Assign permissions from available permission set
4. Set organization-specific default role

**CRITICAL:** Once an organization has custom roles, it has independent role configuration from environment. New environment roles are added to bottom of org's priority order.

**Verify Org Roles:**

```bash
# List organization's roles
curl -X GET https://api.workos.com/user_management/organizations/org_01H.../roles \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: Both environment roles and `org:*` prefixed custom roles.

### Deleting Environment Roles

If environment role is default for organizations:

1. Dashboard prompts to select replacement default role
2. All affected org members get reassigned to new default
3. Custom `org:*` roles unaffected

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm RBAC integration:

```bash
# 1. Verify roles configured in WorkOS
curl -s https://api.workos.com/user_management/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq -e 'length > 0' || echo "FAIL: No roles configured"

# 2. Check at least one organization membership exists with role
curl -s https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq -e '.[0].role.slug' || echo "FAIL: No memberships with roles"

# 3. Verify permission checks in code
grep -r "role.permissions.includes" . --include="*.ts" --include="*.tsx" || \
  echo "WARN: No permission checks found in code"

# 4. Test unauthorized access returns error
# (Replace with your protected endpoint)
curl -X POST http://localhost:3000/api/admin/settings \
  -H "Authorization: Bearer <viewer-user-token>" \
  --fail || echo "PASS: Unauthorized access blocked"

# 5. Build succeeds
npm run build
```

## Error Recovery

### "Role slug not found" during assignment

**Cause:** `roleSlug` doesn't match Dashboard configuration.

**Fix:**

1. List available roles: `curl https://api.workos.com/user_management/roles -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Copy exact `slug` value (case-sensitive)
3. Update assignment code to use exact slug

### User has no role/permissions in session

**Cause 1:** User not assigned to any organization.

**Fix:** Invite user to organization with `createOrganizationMembership`.

**Cause 2:** Default role not set in Dashboard.

**Fix:** Go to Dashboard > Roles & Permissions > set Default Role.

**Cause 3:** Session cached before role assigned.

**Fix:** Force re-authentication or clear session cookies.

### IdP group mapping not working

**Cause 1:** Group name mismatch (case-sensitive).

**Fix:** Check exact group name in IdP, update mapping in Dashboard.

**Cause 2:** Directory Sync not enabled.

**Fix:** Enable Directory Sync for organization in Dashboard.

**Cause 3:** SSO user hasn't logged in since mapping created.

**Fix:** User must log out and log back in for SSO group mappings to apply.

**Verify group membership:**

```bash
# For Directory Sync
curl -X GET https://api.workos.com/directory/users/directory_user_01H... \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.groups'
```

### Permission check fails unexpectedly

**Cause:** Checking role slug instead of permissions.

**Wrong:**

```typescript
if (user.role.slug === 'admin') { ... } // Brittle - breaks if permissions change
```

**Right:**

```typescript
if (user.role.permissions.includes('settings.write')) { ... }
```

### Multiple roles causing permission conflicts

**Cause:** Not handling multiple roles correctly.

**Fix:** Use `user.roles` (array) not `user.role` (single):

```typescript
const allPermissions = user.roles.flatMap(role => role.permissions);
const hasPermission = allPermissions.includes('videos.delete');
```

### Organization custom role not available

**Cause 1:** Trying to assign `org:*` role to different organization.

**Fix:** Organization roles only work within their organization. Use environment roles or create equivalent custom role.

**Cause 2:** Custom role deleted but still referenced in code.

**Fix:** Update code to use replacement role slug.

## Related Skills

- **workos-authkit-nextjs**: Authentication layer for RBAC (required for session-based checks)
- **workos-sso**: SSO with IdP role assignment
- **workos-directory-sync**: Real-time role updates from corporate directories
- **workos-fga**: Fine-grained authorization beyond role-based permissions
