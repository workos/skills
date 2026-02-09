---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- generated -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:**
```bash
grep "WORKOS_API_KEY=sk_" .env* || echo "FAIL: Missing or invalid API key"
grep "WORKOS_CLIENT_ID=client_" .env* || echo "FAIL: Missing or invalid client ID"
```

### SDK Installation

Confirm WorkOS SDK is installed:
```bash
# Node.js
npm list @workos-inc/node || yarn list @workos-inc/node

# Other languages - check package manifest
```

If SDK is missing, install before continuing.

## Step 3: Dashboard Configuration (REQUIRED)

**CRITICAL:** RBAC configuration happens in WorkOS Dashboard BEFORE code integration.

Go to https://dashboard.workos.com/ and navigate to your environment.

### Define Permissions

1. Click **Roles & Permissions** in sidebar
2. Click **Permissions** tab
3. Create permissions for your resources:
   - Use descriptive slugs: `videos:create`, `users:manage`, `settings:update`
   - Group by resource type for clarity
   - Document what each permission controls

**Verify:** At least 2-3 permissions exist before proceeding.

### Define Roles

1. Click **Roles** tab
2. Create roles with permission sets:
   - **Member** (default role) - basic access
   - **Admin** - elevated permissions
   - **Owner** - full control

**Critical:** Every environment MUST have a default role. This is auto-assigned to new organization members.

3. Set default role:
   - Click gear icon next to a role
   - Select "Set as default role"

4. Configure priority order (for multiple roles):
   - Drag roles to reorder
   - Higher = more privileged
   - Used when user has multiple roles

**Verify:**
```bash
# Test via API that roles exist
curl -X GET https://api.workos.com/user_management/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep -q "slug" || echo "FAIL: No roles configured"
```

## Step 4: Integration Path (Decision Tree)

Determine which WorkOS product you're integrating RBAC with:

```
Which WorkOS product?
  |
  +-- AuthKit --> Go to Step 5 (Role-aware sessions)
  |
  +-- SSO --> Go to Step 6 (IdP role assignment)
  |
  +-- Directory Sync --> Go to Step 7 (Group-based roles)
  |
  +-- Standalone RBAC --> Go to Step 8 (Manual assignment)
```

## Step 5: AuthKit Integration (Role-Aware Sessions)

### Organization Membership Role Assignment

Every user in an organization has an organization membership with assigned role(s).

**Default behavior:** New members get the default role automatically.

**Manual assignment via API:**
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Update organization membership role
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: 'om_...',
  roleSlug: 'admin', // or multiple: ['admin', 'billing']
});
```

**Verify membership role:**
```bash
# Get organization membership
curl -X GET "https://api.workos.com/user_management/organization_memberships/{org_membership_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.role.slug'
```

### Reading Roles from Session

AuthKit sessions include role and permission data in the JWT.

**Server-side session check:**
```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

export default withAuth(async ({ user }) => {
  // user.role contains { slug: 'admin' }
  // user.permissions contains ['videos:create', 'users:manage', ...]
  
  if (!user.permissions.includes('videos:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Proceed with authorized action
});
```

**Client-side with useAuth hook:**
```typescript
'use client';
import { useAuth } from '@workos-inc/authkit-nextjs';

export function VideoUploadButton() {
  const { user } = useAuth();
  
  if (!user?.permissions.includes('videos:create')) {
    return null; // Hide button
  }
  
  return <button>Upload Video</button>;
}
```

**CRITICAL:** Never rely solely on client-side checks. Always validate permissions server-side.

## Step 6: SSO Integration (IdP Role Assignment)

Map SSO groups to WorkOS roles for automatic assignment during SSO login.

**When to use:** Customer's identity provider (Okta, Azure AD, etc.) manages groups, and you want groups to automatically map to application roles.

### Configure SSO Group Mappings

1. Navigate to **SSO** > **Connections** in Dashboard
2. Select the SSO connection
3. Click **Role Mappings** tab
4. Add mappings:
   - IdP Group Name: `Engineering` → WorkOS Role: `admin`
   - IdP Group Name: `Contractors` → WorkOS Role: `member`

**Precedence:** IdP role assignments OVERRIDE manual assignments. When user logs in via SSO, their role is updated based on current group membership.

**Multiple groups → Multiple roles:**
If user is in `Engineering` (maps to `admin`) AND `Billing` (maps to `billing`), they receive BOTH roles.

### Test SSO Role Assignment

1. Trigger SSO login for test user
2. Check organization membership role:
```bash
curl -X GET "https://api.workos.com/user_management/organization_memberships?user_id={user_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.[0].role'
```

Expected: Role matches IdP group mapping.

## Step 7: Directory Sync Integration (Group-Based Roles)

Map directory groups to WorkOS roles for automatic assignment during directory provisioning.

**When to use:** Customer provisions users via SCIM/directory sync, and directory groups should map to application roles.

### Configure Directory Group Mappings

1. Navigate to **Directory Sync** > **Directories** in Dashboard
2. Select the directory
3. Click **Role Mappings** tab
4. Add mappings:
   - Directory Group: `cn=Admins,ou=Groups,dc=example,dc=com` → Role: `admin`
   - Directory Group: `cn=Users,ou=Groups,dc=example,dc=com` → Role: `member`

**Precedence:** Same as SSO - directory role assignments override manual assignments.

**Multiple groups:** User in multiple mapped groups receives all corresponding roles.

### Directory Event Handling

Roles update automatically when:
- User added to directory group (receives role)
- User removed from directory group (loses role)
- Directory user created (receives roles for all groups)

No code changes needed - WorkOS handles sync automatically.

**Verify directory user roles:**
```bash
curl -X GET "https://api.workos.com/directory_sync/directory_users/{directory_user_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.role'
```

## Step 8: Standalone RBAC (Manual Assignment)

Use RBAC without AuthKit/SSO/Directory Sync by manually managing role assignments.

**Use case:** Custom auth system, want WorkOS only for authorization logic.

### API-Based Role Assignment

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create organization membership with role
const membership = await workos.userManagement.createOrganizationMembership({
  userId: 'user_...',
  organizationId: 'org_...',
  roleSlug: 'admin',
});

// Update role later
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: membership.id,
  roleSlug: 'member',
});

// Assign multiple roles
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: membership.id,
  roleSlugs: ['admin', 'billing'], // Note: roleSlugs plural
});
```

### Check Authorization

```typescript
// Get user's organization membership
const membership = await workos.userManagement.getOrganizationMembership({
  organizationMembershipId: 'om_...',
});

// Check permission
if (membership.permissions.includes('videos:delete')) {
  // Allow action
}

// Check role
if (membership.role.slug === 'admin') {
  // Allow admin action
}
```

## Step 9: Organization-Specific Roles (Advanced)

Create custom roles for individual organizations that differ from environment-level roles.

**When to use:** Enterprise customer needs custom permission set not available in standard roles.

### Create Organization Role

1. Navigate to **Organizations** in Dashboard
2. Select organization
3. Click **Roles** tab
4. Click **Create role**
5. Define role:
   - Slug is auto-prefixed with `org_`
   - Select permissions
   - Set as organization default if needed

**Key behavior:**
- Organization roles are INDEPENDENT from environment roles
- Organization has its own default role and priority order
- New environment roles are added to organization but placed at bottom priority
- Deleting environment role prompts for replacement role in affected organizations

**Verify organization role:**
```bash
curl -X GET "https://api.workos.com/user_management/organizations/{org_id}/roles" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | select(.slug | startswith("org_"))'
```

## Step 10: Multiple Roles (Optional)

Enable users to have multiple roles simultaneously in an organization.

**When to use:** User needs permissions from multiple roles (e.g., both `admin` AND `billing` manager).

### Assigning Multiple Roles

```typescript
// Via API
await workos.userManagement.updateOrganizationMembership({
  organizationMembershipId: 'om_...',
  roleSlugs: ['admin', 'billing', 'support'], // Array of role slugs
});
```

**Permission resolution:**
- User receives UNION of all permissions from assigned roles
- No conflicts - permissions are additive
- Priority order determines which role is "primary" for display purposes

**Session behavior:**
```typescript
// Session includes all roles and combined permissions
const { user } = await getUser();
// user.roles = [{ slug: 'admin' }, { slug: 'billing' }]
// user.permissions = ['videos:create', 'users:manage', 'billing:view', ...]
```

## Verification Checklist (ALL MUST PASS)

Run these checks in order:

```bash
# 1. Environment variables configured
grep "WORKOS_API_KEY=sk_" .env* && grep "WORKOS_CLIENT_ID=client_" .env* || echo "FAIL: Missing env vars"

# 2. Roles exist in Dashboard
curl -s -X GET https://api.workos.com/user_management/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -e '.data | length > 0' || echo "FAIL: No roles configured"

# 3. Permissions exist in Dashboard
curl -s -X GET https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -e '.data | length > 0' || echo "FAIL: No permissions configured"

# 4. Test organization membership has role
curl -s -X GET "https://api.workos.com/user_management/organization_memberships?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -e '.data[0].role.slug' || echo "FAIL: No memberships with roles"

# 5. SDK imports work
node -e "require('@workos-inc/node')" || echo "FAIL: SDK not installed"

# 6. Application builds
npm run build || yarn build || echo "FAIL: Build errors"
```

**If using AuthKit:** Verify session includes role data:
```bash
# Start dev server, authenticate, check session
curl -s http://localhost:3000/api/auth/session \
  | jq -e '.user.role' || echo "FAIL: Session missing role"
```

## Error Recovery

### "User does not have required permission"

**Root cause:** User's role lacks the permission being checked.

**Fix:**
1. Verify user's organization membership:
```bash
curl -X GET "https://api.workos.com/user_management/organization_memberships/{om_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.role, .permissions'
```
2. Check if role has permission in Dashboard: **Roles & Permissions** > **Roles** > select role
3. Either:
   - Add permission to role, OR
   - Assign user a different role with permission, OR
   - Update authorization logic to check different permission

### "Invalid role slug"

**Root cause:** Role doesn't exist or typo in slug.

**Fix:**
```bash
# List all available roles
curl -X GET https://api.workos.com/user_management/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[].slug'
```
Compare slug in code to available roles. Slugs are case-sensitive.

### "Cannot assign multiple roles" error

**Root cause:** Using `roleSlug` (singular) instead of `roleSlugs` (plural).

**Fix:**
```typescript
// WRONG
await workos.userManagement.updateOrganizationMembership({
  roleSlug: ['admin', 'billing'], // Array not allowed with singular
});

// CORRECT
await workos.userManagement.updateOrganizationMembership({
  roleSlugs: ['admin', 'billing'], // Use plural for arrays
});
```

### "Organization membership not found"

**Root cause:** User not added to organization yet.

**Fix:**
```typescript
// Create organization membership first
const membership = await workos.userManagement.createOrganizationMembership({
  userId: 'user_...',
  organizationId: 'org_...',
  roleSlug: 'member', // Optional - defaults to default role
});
```

### IdP role assignment not working

**Root cause 1:** Group name mismatch between IdP and mapping.

**Fix:** 
1. Check exact group name in IdP admin panel (case-sensitive, includes spaces)
2. Update mapping in Dashboard to match exactly

**Root cause 2:** SSO connection not configured for role sync.

**Fix:**
1. Verify connection in **SSO** > **Connections**
2. Check **Role Mappings** tab has mappings
3. Test SSO login - check IdP sends group claims in SAML/OIDC response

**Root cause 3:** Directory sync delay.

**Fix:** Directory events process asynchronously. Wait 30-60 seconds after directory change, then check membership role.

### Session missing role/permissions data

**Root cause:** AuthKit version too old or session not refreshed.

**Fix:**
```bash
# 1. Check SDK version supports RBAC
npm list @workos-inc/authkit-nextjs

# 2. Force new session
# - Log out and log back in
# - Or clear session cookie and re-authenticate

# 3. Verify middleware includes role data
grep "authkitMiddleware" middleware.ts || grep "authkit()" middleware.ts
```

If session still missing data, check WebFetch docs for required AuthKit version.

### "No default role set" warning

**Root cause:** Environment or organization has no default role configured.

**Fix:**
1. Go to **Roles & Permissions** > **Roles** in Dashboard
2. Click gear icon next to desired default role
3. Select "Set as default role"
4. New organization memberships will automatically get this role

## Related Skills

- **workos-authkit-nextjs**: AuthKit integration for role-aware authentication
- **workos-fga**: Fine-grained authorization beyond role-based permissions
- **workos-sso**: SSO setup for IdP-based role assignment
- **workos-directory-sync**: Directory provisioning with group-based roles
