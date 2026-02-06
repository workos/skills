---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- generated -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- `https://workos.com/docs/rbac/quick-start`
- `https://workos.com/docs/rbac/configuration`
- `https://workos.com/docs/rbac/organization-roles`
- `https://workos.com/docs/rbac/integration`
- `https://workos.com/docs/rbac/idp-role-assignment`

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Required Environment Variables

Check `.env.local` or environment config for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (if using AuthKit)

**Verify:** Keys exist and match expected format before continuing.

### WorkOS SDK Installation

Check SDK is installed:

```bash
# Node.js projects
grep "@workos-inc/node" package.json || echo "FAIL: SDK not installed"

# Other languages - check appropriate package manifest
```

If missing, install SDK per documentation before proceeding.

## Step 3: Dashboard Configuration (REQUIRED)

**CRITICAL:** RBAC requires upfront configuration in WorkOS Dashboard. Code integration happens AFTER dashboard setup.

Navigate to WorkOS Dashboard → Environment → Roles & Permissions.

### Define Permissions

1. Click "Create permission" for each discrete action in your app
2. Use dot notation: `videos.create`, `videos.view`, `settings.manage`
3. Add human-readable descriptions for each permission

**Example permission set for video SaaS:**

```
videos.view        - View videos
videos.create      - Create new videos
videos.delete      - Delete videos
users.manage       - Manage user roles
settings.manage    - Configure app settings
```

### Define Roles

1. Click "Create role" 
2. Assign permission set to each role
3. Set default role for new organization members
4. Configure priority order (highest → lowest privilege)

**Decision tree for role strategy:**

```
Multiple roles per user?
  |
  +-- NO --> Use single role, priority order matters for inheritance
  |
  +-- YES --> Enable multiple roles (checkbox in Dashboard)
               Role union: user gets combined permissions of all roles
```

**Verify dashboard config:**

```bash
# Check roles endpoint returns data
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/roles | jq '.data | length'
# Should return > 0
```

## Step 4: Integration Pattern Detection

Determine your WorkOS product integration:

```
Which WorkOS product are you using?
  |
  +-- AuthKit --> Roles in organization memberships (Step 5A)
  |
  +-- SSO only --> Roles in SSO profiles via IdP (Step 5B)
  |
  +-- Directory Sync --> Roles in directory users via groups (Step 5C)
  |
  +-- Standalone --> Roles via Management API (Step 5D)
```

Choose ONE path below based on your integration.

## Step 5A: AuthKit Integration

**Use case:** You're using WorkOS AuthKit for user authentication.

### Read Roles from Session

Roles are embedded in AuthKit session JWTs. Use SDK to decode:

```typescript
// Server-side route/action
import { getUser } from '@workos-inc/authkit-nextjs';

const user = await getUser();
const role = user.organizationMembership?.role; // Single role paradigm
const roles = user.organizationMembership?.roles; // Multiple roles paradigm

// Check permission
const permissions = user.organizationMembership?.permissions || [];
const canCreateVideos = permissions.includes('videos.create');
```

**CRITICAL:** Roles are per-organization. If user is in multiple orgs, check `user.activeOrganizationId` to know which role set applies.

### Assign Roles to Members

Two methods:

**Method 1: WorkOS Dashboard**
1. Navigate to Organizations → [Org Name] → Members
2. Click member → Edit role
3. Select from dropdown

**Method 2: API**

```typescript
// Update organization membership role
await workos.userManagement.updateOrganizationMembership(
  membershipId,
  { roleSlug: 'admin' } // or { roleSlugs: ['admin', 'editor'] } for multiple
);
```

### Default Role Assignment

New members auto-receive default role. To change default:
1. Dashboard → Organizations → [Org Name] → Roles tab
2. Click "Set as default" on desired role

## Step 5B: SSO Integration (IdP Role Assignment)

**Use case:** Roles sourced from customer's identity provider (Okta, Azure AD, etc.).

### Enable SSO Group Mapping

1. Dashboard → SSO → Connection → [Customer Connection]
2. Navigate to "Role Assignment" tab
3. Map IdP groups to WorkOS roles:
   - Okta groups → WorkOS role slugs
   - Azure AD groups → WorkOS role slugs

**Example mapping:**

```
IdP Group Name          WorkOS Role
------------------      -----------
Admins                  admin
VideoEditors            editor
Viewers                 member
```

### Role Update Behavior

- **SSO authentication:** Roles sync on every login
- **Directory Sync:** Roles sync on group membership change events

**IMPORTANT:** IdP-assigned roles OVERRIDE manually assigned roles. If IdP provides roles, API/Dashboard assignments are ignored.

### Read Roles from SSO Profile

```typescript
// After SSO callback
const profile = await workos.sso.getProfile(code);
const roles = profile.roles; // Array of role slugs from IdP

// Or from organization membership after provisioning
const membership = await workos.userManagement.getOrganizationMembership(
  membershipId
);
const currentRoles = membership.roles;
```

## Step 5C: Directory Sync Integration

**Use case:** User provisioning from customer's directory (SCIM/Active Directory).

### Enable Directory Group Mapping

1. Dashboard → Directory Sync → Directory → [Customer Directory]
2. Navigate to "Role Assignment" tab  
3. Map directory groups to roles (same as SSO mapping)

### Role Sync Triggers

Roles update when directory events occur:
- User added to group → Role added
- User removed from group → Role removed
- User deprovisioned → Membership deleted

### Read Roles from Directory User

```typescript
// Via organization membership
const membership = await workos.userManagement.getOrganizationMembership(
  membershipId
);
const roles = membership.roles;
```

## Step 5D: Standalone Role Management

**Use case:** Manual role assignment without SSO/Directory Sync.

### Assign Roles via API

```typescript
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create organization membership with role
await workos.userManagement.createOrganizationMembership({
  userId: 'user_123',
  organizationId: 'org_456',
  roleSlug: 'editor'
});

// Update existing membership
await workos.userManagement.updateOrganizationMembership(
  'om_789',
  { roleSlug: 'admin' }
);
```

### List Available Roles

```typescript
// Get all roles for checking slugs
const roles = await workos.userManagement.listRoles();
roles.data.forEach(role => {
  console.log(`${role.slug}: ${role.name}`);
});
```

## Step 6: Organization-Scoped Custom Roles (Optional)

**Use case:** One organization needs different roles than environment defaults.

### When to Use

```
Does this org need custom roles?
  |
  +-- NO --> Use environment roles (skip this step)
  |
  +-- YES --> Create org-specific roles (continue)
              Example: Customer needs "ReadOnlyAdmin" not in global set
```

### Create Organization Role

1. Dashboard → Organizations → [Org Name] → Roles tab
2. Click "Create role"
3. Slug auto-prefixed with `org:` (e.g., `org:readonly_admin`)
4. Assign permissions from environment permission set

**Behavior after first org role:**
- Organization gets own default role setting
- Organization gets own priority order
- Environment roles still available but appear in org's priority list

### Using Organization Roles

No code changes needed — org roles work identically to environment roles in:
- API calls (use slug `org:readonly_admin`)
- Session JWTs (`role.slug` will be `org:readonly_admin`)
- Permission checks (same permission array)

## Step 7: Implement Authorization Checks

### Server-Side Authorization Pattern

```typescript
// Middleware or route handler
async function requirePermission(permission: string) {
  const user = await getUser(); // Or equivalent SDK call
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  const permissions = user.organizationMembership?.permissions || [];
  
  if (!permissions.includes(permission)) {
    throw new Error(`Forbidden: requires ${permission}`);
  }
  
  return user;
}

// Usage in API route
export async function POST(request: Request) {
  await requirePermission('videos.create');
  // ... create video logic
}
```

### Client-Side Role Display

```typescript
// React component
'use client';
import { useAuth } from '@workos-inc/authkit-nextjs';

export function AdminPanel() {
  const { user } = useAuth();
  const permissions = user?.organizationMembership?.permissions || [];
  
  if (!permissions.includes('settings.manage')) {
    return null; // Hide admin panel
  }
  
  return <div>Admin controls...</div>;
}
```

**CRITICAL:** Client-side checks are for UX only. Always enforce authorization server-side.

## Step 8: Handle Multiple Roles (If Enabled)

If you enabled multiple roles in Step 3:

### Permission Union Behavior

User permissions = union of all assigned roles' permissions.

```typescript
// User has roles: ['editor', 'viewer']
// editor permissions: ['videos.create', 'videos.edit']
// viewer permissions: ['videos.view']
// Effective permissions: ['videos.create', 'videos.edit', 'videos.view']

const membership = await workos.userManagement.getOrganizationMembership(id);
const allPermissions = membership.permissions; // Already merged by WorkOS
```

### Assigning Multiple Roles

```typescript
// API assignment
await workos.userManagement.updateOrganizationMembership(
  membershipId,
  { roleSlugs: ['editor', 'reviewer'] } // Array instead of single slug
);
```

### IdP Multiple Role Mapping

If user is in multiple IdP groups with role mappings, they receive all mapped roles automatically.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Dashboard config exists
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/roles \
  | jq '.data | length'
# Expected: > 0

# 2. Permissions endpoint accessible
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  https://api.workos.com/user_management/permissions \
  | jq '.data | length'
# Expected: > 0

# 3. Check organization has members with roles (replace org_id)
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=org_123" \
  | jq '.data[0].role'
# Expected: role slug string

# 4. Verify permission check in code
grep -r "permissions.includes" . --include="*.ts" --include="*.js"
# Expected: authorization checks exist

# 5. Build succeeds
npm run build # or equivalent
```

## Error Recovery

### "Role slug not found"

**Cause:** Using role slug that doesn't exist in Dashboard.

**Fix:**
1. List available roles: `curl -H "Authorization: Bearer ${WORKOS_API_KEY}" https://api.workos.com/user_management/roles | jq '.data[].slug'`
2. Use exact slug from list (case-sensitive)
3. For org roles, remember `org:` prefix

### "Permissions array empty despite role assignment"

**Cause:** Role has no permissions assigned in Dashboard.

**Fix:**
1. Dashboard → Roles & Permissions → [Role Name]
2. Check permissions are selected
3. Save role configuration
4. Re-fetch user session to get updated permissions

### "IdP roles not syncing"

**Decision tree:**

```
SSO or Directory Sync?
  |
  +-- SSO --> Check role mapping in SSO connection settings
  |            User must re-authenticate for update
  |
  +-- Directory --> Check role mapping in Directory settings
                     Check directory sync is active
                     Check user is member of mapped group in IdP
```

**Verify mapping:**

```bash
# Check connection has role mappings
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/sso/connections/conn_123" \
  | jq '.role_mappings'
```

### "Organization membership not found"

**Cause:** User not added to organization yet.

**Fix:**
```typescript
// Create membership first
await workos.userManagement.createOrganizationMembership({
  userId: 'user_123',
  organizationId: 'org_456',
  roleSlug: 'member' // Will use default role if omitted
});
```

### "Multiple roles not working"

**Cause:** Multiple roles not enabled in Dashboard.

**Fix:**
1. Dashboard → Roles & Permissions → Settings
2. Enable "Allow multiple roles per user"
3. Update API calls to use `roleSlugs` (array) instead of `roleSlug` (string)

### "Permissions not in JWT"

**Cause:** AuthKit session doesn't include organization context.

**Fix:**
1. Ensure user selected an organization (or is auto-joined to one)
2. Check `user.activeOrganizationId` exists
3. Permissions only available when organization context is set

### "Cannot update role: IdP role assignment active"

**Cause:** Role source is IdP, manual updates are ignored.

**Fix:**
- Update user's group membership in IdP (Okta/Azure AD/etc.)
- Or disable IdP role assignment and manage manually via API

## Related Skills

- **workos-authkit-nextjs**: AuthKit integration for role-aware sessions
- **workos-sso**: SSO configuration for IdP role assignment  
- **workos-directory-sync**: Directory provisioning with group-based roles
- **workos-fga**: Fine-grained authorization (relationship-based, not role-based)
