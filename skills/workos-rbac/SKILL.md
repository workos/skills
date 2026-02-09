---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:f02c2083efa0 -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest RBAC implementation details:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access at `https://dashboard.workos.com/`
- Confirm API key exists in environment: `WORKOS_API_KEY` starts with `sk_`
- Confirm client ID exists: `WORKOS_CLIENT_ID` starts with `client_`

### Project Structure

- Confirm WorkOS SDK installed: Check `package.json` or `requirements.txt` for WorkOS SDK dependency
- Confirm SDK imports resolve without errors

**Verify:** Run build or linter to confirm SDK imports before continuing.

## Step 3: Role Configuration Strategy (Decision Tree)

```
Organization role requirements?
  |
  +-- Same roles for all orgs
  |     |
  |     +-- Configure environment-level roles only (Dashboard > Roles)
  |
  +-- Custom roles per organization
        |
        +-- Configure environment-level roles (Dashboard > Roles)
        |
        +-- Create organization-specific roles (Dashboard > Organizations > [Org] > Roles tab)
```

**Key differences:**

- **Environment roles**: Shared across all organizations, managed globally
- **Organization roles**: Custom per-org, slug auto-prefixed with `org`, independent default role and priority order

## Step 4: Configure Roles in Dashboard

### Environment-Level Roles

Navigate to Dashboard > Roles section:

1. Click "Create role"
2. Define role slug (e.g., `admin`, `member`, `viewer`)
3. Assign permissions to role
4. Set default role for new organization memberships
5. Configure role priority order (highest priority first)

**Critical:** Default role is auto-assigned to new organization memberships. Choose wisely.

### Organization-Level Roles (Optional)

If custom per-org roles needed:

1. Navigate to Dashboard > Organizations > [Select Org] > Roles tab
2. Click "Create role" (slug auto-prefixed with `org`)
3. Define permissions
4. Organization now has independent default role and priority order

**Important:** Once first org role created, that organization inherits no further default changes from environment. New environment roles appear at bottom of org priority order.

## Step 5: Integration Path Selection (Decision Tree)

```
Auth integration?
  |
  +-- Using AuthKit
  |     |
  |     +-- Roles via organization memberships (Step 6A)
  |     |
  |     +-- Read roles from session JWT (Step 7)
  |
  +-- Using SSO (without AuthKit)
  |     |
  |     +-- IdP group-based role assignment (Step 6B)
  |
  +-- Using Directory Sync
  |     |
  |     +-- Directory group-based role assignment (Step 6B)
  |
  +-- Custom auth (API-only)
        |
        +-- Manual role assignment via API (Step 6C)
```

## Step 6A: AuthKit Organization Membership Roles

### Assignment Methods

AuthKit organization memberships automatically get default role. Modify via:

1. **Organization Memberships API** - Programmatic assignment
2. **WorkOS Dashboard** - Manual assignment (Organizations > [Org] > Members)
3. **IdP role assignment** - Group-based (takes precedence over API/Dashboard)

### API Role Assignment

WebFetch organization memberships API docs for current method signatures:
- https://workos.com/docs/reference/organization-membership

**Typical pattern** (verify exact methods in docs):

```
Update membership role:
  PATCH /organization_memberships/{id}
  Body: { "role_slug": "admin" }
```

### Multiple Roles Support

AuthKit supports multiple roles per membership:

- User in multiple directory/SSO groups with role mappings → receives all mapped roles
- API can assign array of role slugs (check docs for exact parameter name)
- Permissions are union of all assigned roles

**Precedence order:**
1. IdP role assignment (SSO/Directory groups) - **highest priority**
2. API/Dashboard assignment - only applies if no IdP assignment

## Step 6B: IdP Role Assignment

### SSO Group Role Assignment

Maps SSO groups to WorkOS roles. Updates on each user authentication.

WebFetch SSO role assignment docs:
- https://workos.com/docs/sso/identity-provider-role-assignment

**Dashboard configuration:**
1. Navigate to SSO connection settings
2. Map IdP group names to WorkOS role slugs
3. Role updates automatically on next user sign-in

### Directory Group Role Assignment

Maps directory groups to WorkOS roles. Updates on directory sync events.

WebFetch Directory Sync role assignment docs:
- https://workos.com/docs/directory-sync/identity-provider-role-assignment

**Dashboard configuration:**
1. Navigate to Directory connection settings
2. Map directory group names to WorkOS role slugs
3. Role updates automatically on directory events

**Critical:** IdP-assigned roles override API/Dashboard assignments. To manually manage roles, remove IdP mappings first.

## Step 6C: API-Only Role Assignment

If not using AuthKit/SSO/Directory Sync, manage roles via organization memberships API.

WebFetch latest API reference:
- https://workos.com/docs/reference/organization-membership

**Required operations:**
- Create membership with role
- Update membership role
- List memberships to read current roles

## Step 7: Read Roles from Sessions

### AuthKit Session JWTs

If using AuthKit, session JWTs contain role information.

WebFetch AuthKit session docs for JWT structure:
- https://workos.com/docs/authkit

**Typical JWT claims** (verify in docs):
- `role` or `roles` - user's role slug(s) for current organization
- `permissions` - flattened list of permissions from all roles
- `org_id` - organization context

### Server-Side Role Checks

```
Protect endpoint with role check:
  1. Extract JWT from request (Authorization header or cookie)
  2. Verify JWT signature with WorkOS public key
  3. Read role(s) from JWT claims
  4. Check if role matches required role(s) for endpoint
  5. Return 403 if unauthorized
```

### Client-Side Role Display

Read roles from session to show/hide UI elements. **Never rely on client-side checks for security** — always validate server-side.

## Step 8: Permission Checks

### Check User Permissions

Use roles to determine allowed actions:

```
Permission check pattern:
  1. Get user's role(s) from session/API
  2. Get permissions for each role from role configuration
  3. Check if required permission exists in union of role permissions
  4. Allow/deny action
```

**Important:** Permissions are cumulative across multiple roles. User with roles A and B has permissions from both.

### Recommended Check Location

- **API routes/endpoints**: Check role/permissions before executing action
- **Database queries**: Filter by organization + role if using row-level security
- **UI components**: Read from session for display only (not security)

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm RBAC integration:

```bash
# 1. Verify SDK installed
npm list @workos-inc/node || pip show workos || echo "Check package manager"

# 2. Verify environment variables set
printenv | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY missing"
printenv | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"

# 3. Test role assignment (replace {org_id} and {user_id} with real values)
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id={org_id}&user_id={user_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep -q "role" || echo "FAIL: Cannot fetch organization membership roles"

# 4. Verify Dashboard has roles configured
# Manual check: Visit https://dashboard.workos.com/roles - confirm at least one role exists

# 5. Build succeeds
npm run build || python manage.py check || echo "Verify build command"
```

**Manual Dashboard checks:**
1. Navigate to Dashboard > Roles - confirm default role is set
2. Navigate to Organizations > [Test Org] - confirm test user has expected role
3. If using IdP assignment - confirm group mappings configured

## Error Recovery

### "User has no role assigned"

**Root cause:** Organization membership missing role, default role not configured.

**Fix:**
1. Check Dashboard > Roles - confirm default role set
2. Check organization membership via API - if role is null, manually assign default role
3. If using IdP assignment, verify user is in at least one mapped group

### "IdP role assignment not working"

**Root causes:**
- Group mapping configuration missing or incorrect
- User not in expected IdP/directory group
- SSO: Role only updates on next sign-in (not retroactive)
- Directory: Sync delay or user not provisioned yet

**Fix:**
1. Verify group mapping in Dashboard connection settings
2. Check user's group membership in IdP/directory
3. For SSO: Force user re-authentication to trigger role update
4. For Directory: Check directory sync status, verify user is provisioned

### "Multiple roles not working"

**Root cause:** Single role mode enabled or incorrect API usage.

**Fix:**
1. WebFetch organization memberships API docs for multi-role parameter syntax
2. Confirm API accepts array of role slugs (e.g., `["admin", "member"]`)
3. Verify IdP user is in multiple mapped groups if using group-based assignment

### "Permission check failing despite correct role"

**Root causes:**
- Role permissions not configured in Dashboard
- Permission key mismatch (typo in permission name)
- Session JWT stale (role updated but user hasn't re-authenticated)

**Fix:**
1. Check Dashboard > Roles > [Role] > Permissions - confirm permission assigned to role
2. Verify exact permission key spelling in code matches Dashboard
3. For session-based checks: Force user re-authentication to refresh JWT claims
4. For API-based checks: Fetch fresh organization membership data

### "Organization roles not appearing"

**Root cause:** Organization-level roles must be created in org-specific Roles tab, not environment Roles.

**Fix:**
1. Navigate to Dashboard > Organizations > [Org] > Roles tab (NOT Dashboard > Roles)
2. Create organization role - slug auto-prefixed with `org`
3. Verify role appears in organization's priority order

### "Deleted environment role breaks organizations"

**Root cause:** Deleted role was default role for one or more organizations.

**Fix:**
1. Dashboard prompts for replacement role during deletion - select appropriate replacement
2. All affected organization memberships auto-reassigned to new default role
3. Verify no orphaned memberships: Check Dashboard > Organizations > [Org] > Members

## Related Skills

- **workos-authkit-nextjs**: AuthKit with Next.js for role-aware sessions
- **workos-authkit-react**: AuthKit with React for role-aware UI
- **workos-sso**: SSO integration with IdP role assignment
- **workos-directory-sync**: Directory Sync with group-based role assignment
- **workos-fga**: Fine-grained authorization beyond role-based permissions
- **workos-api-organization**: Organization management API for role context
- **workos-admin-portal**: User-facing portal for role management
