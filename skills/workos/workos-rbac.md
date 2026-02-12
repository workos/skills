---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:968acae2e2f5 -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

If this skill conflicts with fetched documentation, follow the docs.

## Step 2: Pre-Flight Validation

### Project Structure

- Confirm WorkOS SDK is installed (`@workos-inc/node`, `workos`, or language-specific SDK)
- Confirm package manager lock file exists (package-lock.json, yarn.lock, pnpm-lock.yaml)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (required if using AuthKit)

**Verify:** Run `echo $WORKOS_API_KEY | grep "^sk_"` to confirm key format.

## Step 3: Install SDK (if needed)

Detect package manager, install WorkOS SDK if missing:

```bash
# Detection
[ -f "package-lock.json" ] && echo "npm"
[ -f "yarn.lock" ] && echo "yarn"
[ -f "pnpm-lock.yaml" ] && echo "pnpm"
```

**Verify:** SDK package exists in node_modules or language-specific dependency directory before continuing.

## Step 4: Configure Roles in Dashboard (REQUIRED)

**STOP. This step cannot be automated — manual dashboard configuration required.**

Go to https://dashboard.workos.com/ and configure:

1. **Permissions**: Define granular permissions (e.g., `videos:view`, `videos:create`, `users:manage`)
2. **Roles**: Create roles and assign permissions (e.g., `viewer`, `editor`, `admin`)
3. **Default role**: Set which role new organization members receive automatically
4. **Priority order**: Define role hierarchy for conflict resolution

**Critical:** Roles and permissions MUST exist in dashboard before making API calls. You cannot create roles via API at environment level.

**Verification:** Navigate to dashboard → Roles & Permissions section and confirm at least one role exists.

## Step 5: Integration Pattern (Decision Tree)

```
What WorkOS products are you using?
  |
  +-- AuthKit --> Go to Step 6 (Role Assignment via Memberships)
  |
  +-- SSO only --> Go to Step 7 (IdP Role Mapping)
  |
  +-- Directory Sync --> Go to Step 8 (Directory Group Mapping)
  |
  +-- Standalone RBAC --> Go to Step 9 (Manual Authorization Checks)
```

## Step 6: AuthKit Integration (Role Assignment)

**Prerequisites:** workos-authkit-\* skill must be completed first.

### Assign Roles to Organization Memberships

Roles are attached to organization memberships, not users directly. One user can have different roles in different organizations.

**API pattern for role assignment:**

```typescript
// When creating membership
await workos.organizationMemberships.create({
  organizationId: "org_123",
  userId: "user_456",
  roleSlug: "editor", // Must match slug from dashboard
});

// When updating membership
await workos.organizationMemberships.update("om_789", {
  roleSlug: "admin",
});
```

**Critical:** `roleSlug` must match exactly the slug defined in WorkOS Dashboard (case-sensitive).

### Read Roles from Session

If using AuthKit, roles are included in session JWTs automatically:

```typescript
import { getUser } from "@workos-inc/authkit-nextjs";

const { user } = await getUser();
// user.role contains the role slug
// user.permissions contains array of permission strings
```

**Single vs. Multiple Roles:**

- By default, each membership has ONE role
- Enable multiple roles in Dashboard → Settings if needed
- With multiple roles enabled, `user.role` becomes `user.roles` (array)

### Organization Roles (Custom Per-Org Roles)

If an organization needs custom roles not in the environment defaults:

1. Navigate to Dashboard → Organizations → [Org Name] → Roles tab
2. Click "Create role" — slug will be auto-prefixed with `org:`
3. Assign permissions specific to this organization
4. Use `org:custom_role` slug in API calls for this organization

**Important:** Once you create the first org-level role, that organization gets its own default role and priority order, independent from environment settings.

**Deleting environment roles:** If an environment role is the default for orgs, you must select a replacement default before deletion.

## Step 7: SSO Integration (IdP Role Assignment)

**Prerequisites:** SSO must be configured for the organization.

Map SSO groups/attributes to WorkOS roles:

1. In Dashboard → Organizations → [Org Name] → SSO Connections → [Connection]
2. Find "Role Mappings" section
3. Map IdP group names to role slugs:
   - IdP group: `engineering` → WorkOS role: `editor`
   - IdP group: `admins` → WorkOS role: `admin`

**Precedence:** IdP-assigned roles OVERRIDE roles set via API or dashboard. Re-authentication updates roles.

**Multiple roles:** If user belongs to multiple mapped groups, they receive ALL mapped roles.

## Step 8: Directory Sync Integration (Directory Group Mapping)

**Prerequisites:** Directory Sync must be configured for the organization.

Map directory groups to WorkOS roles:

1. In Dashboard → Organizations → [Org Name] → Directory → Settings
2. Find "Role Mappings" section
3. Map directory group names to role slugs

**Precedence:** Directory-assigned roles OVERRIDE roles set via API or dashboard. Updates apply on directory sync events.

**Directory Provisioning with AuthKit:** If using directory provisioning, mapped roles apply automatically to organization memberships.

## Step 9: Authorization Checks (Standalone RBAC)

If NOT using AuthKit sessions, make explicit authorization checks via SDK:

```typescript
// Check if user has specific permission
const hasPermission = user.permissions.includes("videos:create");

// Check if user has specific role
const isAdmin = user.role === "admin"; // Single role
const isAdmin = user.roles.includes("admin"); // Multiple roles
```

**Pattern for protected routes/actions:**

```typescript
// In route handler or middleware
const { user } = await getUser();

if (!user.permissions.includes("users:manage")) {
  return new Response("Forbidden", { status: 403 });
}

// Proceed with action
```

**Role hierarchy:** Use priority order from dashboard to resolve conflicts. Higher priority role wins.

## Step 10: Organization Roles (Advanced)

**When to use:** Customer needs custom roles not in your standard set.

### Creating Organization Roles

Via Dashboard:

1. Navigate to Organizations → [Org Name] → Roles
2. Click "Create role"
3. Slug auto-prefixed with `org:` (e.g., `org:custom_viewer`)
4. Assign permissions specific to this org

Via API:

```typescript
await workos.roles.createOrganizationRole({
  organizationId: "org_123",
  name: "Custom Viewer",
  slug: "custom_viewer", // Will become org:custom_viewer
  permissions: ["videos:view", "comments:view"],
});
```

**Usage:** Organization roles work identically to environment roles in assignments and checks. No code changes needed.

**Configuration inheritance:** New environment roles are automatically added to org priority order (at bottom). Org default role is independent from environment default.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 2. Check API key configured
grep "WORKOS_API_KEY=sk_" .env .env.local 2>/dev/null || echo "FAIL: API key missing or wrong format"

# 3. Test API connectivity (replace with your key)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles 2>/dev/null | grep -q "data" \
  && echo "PASS: API connected" || echo "FAIL: API unreachable"

# 4. Check roles exist in dashboard (manual)
# Navigate to https://dashboard.workos.com/roles-and-permissions
# Confirm at least one role is configured

# 5. If using AuthKit, verify user object includes role/permissions
# Check session payload includes `role` and `permissions` fields
```

**Manual Dashboard Verification:**

- [ ] At least one environment role exists
- [ ] Default role is set
- [ ] Priority order is defined (if multiple roles)
- [ ] Permissions are assigned to roles

## Error Recovery

### "Role slug 'X' does not exist"

**Root cause:** Role not created in WorkOS Dashboard, or slug mismatch.

**Fix:**

1. Go to Dashboard → Roles & Permissions
2. Confirm role exists with EXACT slug (case-sensitive)
3. If org-level role, ensure slug includes `org:` prefix
4. Check API calls use exact slug string from dashboard

### "Forbidden" / "Insufficient permissions"

**Root cause:** User lacks required permission, or role not assigned.

**Fix:**

1. Check user's assigned role: `console.log(user.role)`
2. Check role's permissions in Dashboard → Roles
3. Verify permission string matches exactly (e.g., `videos:create` not `video:create`)
4. For IdP/directory users, check group mappings are correct

### "Cannot read property 'role' of undefined"

**Root cause:** Session missing or user not authenticated.

**Fix:**

1. Verify AuthKit integration is complete (see workos-authkit-\* skills)
2. Check user is authenticated: `if (!user) return redirect('/login')`
3. Confirm session includes role data (check JWT payload)

### "IdP role assignment not working"

**Root cause:** Role mappings not configured, or user not in mapped groups.

**Fix:**

1. Dashboard → Organizations → SSO/Directory → Role Mappings
2. Confirm IdP group names match exactly (case-sensitive)
3. For SSO: User must re-authenticate after mapping changes
4. For Directory: Check directory sync logs for errors

### "Multiple roles not working"

**Root cause:** Multiple roles feature not enabled.

**Fix:**

1. Dashboard → Settings → Enable "Multiple Roles"
2. Update code to check `user.roles` array instead of `user.role` string
3. Use `user.roles.includes('admin')` for role checks

### "Organization role not applying"

**Root cause:** Organization may still inherit environment defaults.

**Fix:**

1. Create at least ONE org role to enable org-level config
2. Check org has its own default role set (Dashboard → Org → Roles)
3. Verify role slug includes `org:` prefix in API calls
4. Confirm priority order is defined at org level

### "API key unauthorized"

**Root cause:** Wrong key or key lacks permissions.

**Fix:**

1. Verify key starts with `sk_` (not `pk_` which is publishable-only)
2. Check key is from correct environment (dev vs. prod)
3. Regenerate key in Dashboard if compromised
4. Confirm no extra whitespace in .env file

## Related Skills

- **workos-authkit-nextjs**: AuthKit integration for Next.js (required for session-based RBAC)
- **workos-authkit-react**: AuthKit integration for React (required for session-based RBAC)
