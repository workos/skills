# WorkOS Role-Based Access Control

## Docs

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/idp-role-assignment
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Always check permissions (role.permissions.includes('action')), NOT role slugs (role.slug === 'admin') — slug checks break in multi-org with custom roles. Claude defaults to slug checks.
- Role assignment requires the MEMBERSHIP ID, not the user ID — fetch via listOrganizationMemberships() first, then call updateOrganizationMembership(membershipId, { roleSlug })
- IdP group mapping OVERRIDES API/Dashboard role assignments on every auth — updateOrganizationMembership() changes silently revert on next login if IdP mapping exists
- IdP role mapping only works with environment-level roles, NOT org-level roles
- First org-level role creation isolates that org permanently — it stops inheriting environment-level role changes. This is irreversible.
- Org-level role slugs are auto-prefixed with "org:" — use the full slug "org:custom_admin", not just "custom_admin"
- Stale session after role change — role assigned after login won't take effect until user re-authenticates. Force re-auth or refresh the session.
- Permission slug typos fail silently — "video.create" vs "videos.create" won't error, just denies access

## Endpoints

| Endpoint                               | Description                     |
| -------------------------------------- | ------------------------------- |
| `/roles`                               | Roles overview                  |
| `/organization-role`                   | Organization role management    |
| `/organization-role/add-permission`    | Add permission to org role      |
| `/organization-role/create`            | Create org role                 |
| `/organization-role/delete`            | Delete org role                 |
| `/organization-role/get`               | Get org role                    |
| `/organization-role/list`              | List org roles                  |
| `/organization-role/remove-permission` | Remove permission from org role |
| `/organization-role/set-permissions`   | Set permissions on org role     |
| `/organization-role/update`            | Update org role                 |
| `/permission`                          | Permission management           |
| `/permission/create`                   | Create permission               |
| `/permission/delete`                   | Delete permission               |
| `/permission/get`                      | Get permission                  |
| `/permission/list`                     | List permissions                |
| `/permission/update`                   | Update permission               |
| `/role`                                | Environment role management     |
| `/role/add-permission`                 | Add permission to role          |
| `/role/create`                         | Create role                     |
| `/role/get`                            | Get role                        |
| `/role/list`                           | List roles                      |
| `/role/set-permissions`                | Set permissions on role         |
| `/role/update`                         | Update role                     |
