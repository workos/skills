---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:f02c2083efa0 -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:

1. https://workos.com/docs/rbac/quick-start
2. https://workos.com/docs/rbac/configuration
3. https://workos.com/docs/rbac/integration
4. https://workos.com/docs/rbac/organization-roles
5. https://workos.com/docs/rbac/idp-role-assignment

These docs are the source of truth. If this skill conflicts with documentation, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env.local` or `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing.

### SDK Detection

```bash
# Check if WorkOS SDK is installed
npm list @workos-inc/node || echo "MISSING: @workos-inc/node"
```

If missing, install SDK first (see documentation for package name and installation).

### Dashboard Access

Confirm you can access: https://dashboard.workos.com/

You will configure roles there in Step 3. No API alternative exists for initial setup.

## Step 3: Configure Roles & Permissions (BLOCKING)

**This step MUST be done in WorkOS Dashboard before writing code.**

Navigate to: Dashboard → Environment → Roles & Permissions

### Create Permissions

Define atomic permissions (e.g., `video:view`, `video:create`, `settings:manage`).

**Critical:** Permission slugs use `resource:action` format. Check docs for naming conventions.

### Create Roles

Create environment-level roles with permission sets:

```
Role structure:
  |
  +-- Role slug (e.g., "member", "admin")
  +-- Role name (display name)
  +-- Permissions assigned to role
  +-- Default role flag (yes/no)
```

**Set one role as default** — all new organization memberships receive this role automatically.

**Priority order matters:** If using multiple roles, set priority in Dashboard. Higher priority = more access in conflicts.

**Verify:** At least one role exists and is marked default before continuing.

## Step 4: Integration Path (Decision Tree)

```
What WorkOS product are you using?
  |
  +-- AuthKit (user management)
  |     |
  |     +-- Go to Step 5: AuthKit Integration
  |
  +-- SSO only (no AuthKit)
  |     |
  |     +-- Go to Step 6: SSO Integration
  |
  +-- Directory Sync only
  |     |
  |     +-- Go to Step 7: Directory Integration
  |
  +-- Custom user management
        |
        +-- Go to Step 8: API-Only Integration
```

## Step 5: AuthKit Integration

**Prerequisites:** AuthKit already integrated (see `workos-authkit-nextjs` or equivalent skill).

### Role Assignment Methods (Choose One)

```
How will roles be assigned?
  |
  +-- Manual (API/Dashboard)
  |     |
  |     +-- Use Organization Membership API
  |
  +-- IdP role assignment (SSO/Directory)
  |     |
  |     +-- Configure in Dashboard: Connections → [Connection] → Role Mappings
  |     +-- CRITICAL: IdP assignment overrides manual assignment
  |
  +-- Hybrid (both methods)
        |
        +-- IdP takes precedence when user authenticates
```

### Read Roles from Session

After user authenticates, roles are in session JWT:

```typescript
import { getUser } from '@workos-inc/authkit-nextjs';

const { user } = await getUser();

// Single role mode
const role = user.role?.slug; // e.g., "member"

// Multiple roles mode
const roles = user.roles?.map(r => r.slug); // e.g., ["member", "billing_admin"]
```

Check documentation for exact session structure — may vary by SDK version.

### Enforce Permissions in Code

**Server-side enforcement (required):**

```typescript
// Example pattern - exact API from docs
const hasPermission = user.permissions?.includes('video:create');

if (!hasPermission) {
  return new Response('Forbidden', { status: 403 });
}
```

**Client-side UI (optional):**

Use session data to hide/show UI elements. **Never rely on client-side checks alone.**

## Step 6: SSO Integration

**Prerequisites:** SSO connection configured (see `workos-sso` skill).

### Enable JIT Provisioning (if needed)

Dashboard → SSO Connection → Enable JIT Provisioning

This creates organization memberships automatically on first login.

### Configure Role Mappings

Dashboard → SSO Connection → Role Mappings

Map IdP groups to WorkOS roles:

```
IdP Group        → WorkOS Role
Engineering      → developer
Administrators   → admin
```

**Critical:** Group names are case-sensitive and must match IdP exactly.

### Read Roles After SSO

After SSO redirect, fetch user profile:

```bash
# Example API call pattern - check docs for exact endpoint
curl https://api.workos.com/sso/profile \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Response includes `role` or `roles` field. Use for access control.

## Step 7: Directory Sync Integration

**Prerequisites:** Directory connection configured.

### Enable Directory Provisioning (if using AuthKit)

Dashboard → Directory Connection → Enable Provisioning

### Configure Role Mappings

Dashboard → Directory Connection → Role Mappings

Map directory groups to WorkOS roles (same pattern as SSO).

**Role updates trigger:** Roles update on directory sync events (user added/removed from group).

### Webhook Handling (if not using AuthKit)

If managing users yourself, listen for `dsync.user.updated` webhooks to sync role changes.

Check documentation for webhook payload structure.

## Step 8: API-Only Integration

**Use case:** Custom user management without AuthKit/SSO.

### Assign Roles via API

```bash
# Example pattern - check docs for exact endpoint and payload
curl -X PUT https://api.workos.com/organization_memberships/{id} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{"role_slug": "admin"}'
```

### Check Permissions

**Option 1: Fetch full role definition**

Cache role → permission mappings in your app. Query WorkOS API for role definitions on deploy.

**Option 2: Runtime authorization API**

Check documentation for authorization endpoint if available. Not all SDKs support runtime checks.

## Step 9: Organization-Specific Roles (Optional)

**Use case:** Different organizations need different role structures.

### Create Organization Role

Dashboard → Organizations → [Organization] → Roles → Create Role

**Auto-prefix:** Organization role slugs get `org_` prefix automatically.

**Configuration scope:** Organization has its own:
- Default role (independent from environment default)
- Priority order (independent from environment order)

### Behavior After Creation

- New environment roles auto-added to organization (bottom of priority order)
- Organization roles usable in all assignment methods (API, IdP, manual)
- Deleting environment role prompts for replacement in affected organizations

**Verify:** Organization role appears in organization member assignments.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking complete:

```bash
# 1. Roles exist in Dashboard
echo "Manual check: Dashboard → Roles shows at least 1 role with 'Default' badge"

# 2. SDK installed and importable
node -e "require('@workos-inc/node')" && echo "PASS: SDK installed" || echo "FAIL: SDK missing"

# 3. Environment variables set
test -n "$WORKOS_API_KEY" && echo "PASS: API key set" || echo "FAIL: API key missing"
test -n "$WORKOS_CLIENT_ID" && echo "PASS: Client ID set" || echo "FAIL: Client ID missing"

# 4. Test API connectivity
curl -f -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations?limit=1 && echo "PASS: API reachable" || echo "FAIL: API error"
```

**Manual verification:**

- [ ] Dashboard shows configured permissions
- [ ] Dashboard shows at least one role marked "Default"
- [ ] Test user has role assigned (check in Dashboard or via API)
- [ ] Application code reads role/permissions from session or API

## Error Recovery

### "User has no role assigned"

**Cause:** No default role set in Dashboard, or user created before default role configured.

**Fix:**
1. Dashboard → Roles → Mark one role as "Default"
2. Manually assign role to existing users via Dashboard or API

### "Permission denied" for valid role

**Cause 1:** Permission not added to role definition.

**Fix:** Dashboard → Roles → [Role] → Edit → Add missing permission

**Cause 2:** Cached session/token with old permissions.

**Fix:** Force user logout and re-authenticate to get fresh token.

### "IdP role assignment not working"

**Cause 1:** Group name mismatch (case-sensitive).

**Fix:** Dashboard → Connection → Role Mappings → Verify group name matches IdP exactly.

**Cause 2:** User not in IdP group.

**Fix:** Check IdP admin panel to confirm user's group membership.

**Cause 3:** SSO profile or directory user not synced.

**Fix:** Trigger re-authentication (SSO) or wait for next directory sync (Directory Sync).

### "Multiple roles not appearing in session"

**Cause:** Multiple roles feature not enabled.

**Fix:** Check documentation for multiple roles support. May require:
- Feature flag in Dashboard
- SDK version upgrade
- Configuration change in role assignment

### "Organization role not assignable"

**Cause:** Organization role only usable within its organization scope.

**Fix:** Verify you're assigning role to member of correct organization. Organization roles cannot be assigned cross-organization.

### "API returns 401 Unauthorized"

**Cause 1:** Wrong API key or expired key.

**Fix:** Regenerate API key in Dashboard → API Keys.

**Cause 2:** API key lacks required scopes.

**Fix:** Dashboard → API Keys → Check key has "organizations" and "roles" scopes.

### "Environment role deletion blocked"

**Cause:** Role is default for one or more organizations.

**Expected behavior:** Dashboard prompts you to select replacement role for affected organizations. This is not an error — it's data protection.

**Action:** Choose replacement role in prompt, then deletion proceeds.

## Related Skills

- **workos-authkit-nextjs**: Required for AuthKit integration path
- **workos-sso**: Required for SSO integration path
- **workos-fga**: Fine-grained authorization (complementary to RBAC)
- **workos-directory-sync**: Required for Directory Sync integration path
