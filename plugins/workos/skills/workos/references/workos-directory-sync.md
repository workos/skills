# WorkOS Directory Sync

## Docs

- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/attributes
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/rbac/integration
  If this file conflicts with fetched docs, follow the docs.

## Mapping directory groups to WorkOS roles

This is one of the most common customer asks. Full recipe lives in `workos-rbac.md` under "IdP group → role mapping"; Directory Sync specifics:

- SCIM/Google Workspace directory groups are the source of truth. Per docs: "SCIM is generally the preferred option due to its real-time synchronization capabilities."
- Roles propagate in real time: "Roles are granted to directory users in real-time, when we receive updates to their group memberships."
- IdP role assignment overrides API and Dashboard role assignments. Per docs: "IdP role assignment will always take precedence over roles assigned via API or the WorkOS Dashboard." Do not recommend `updateOrganizationMembership` as a workaround when a Directory Sync mapping exists — it will silently revert on the next sync.
- Mappings are configured in the Admin Portal during directory setup, or on the directory page of the WorkOS Dashboard. Do **not** invent specific menu paths beyond that — the docs do not commit to exact click-paths.
- Not configurable via the WorkOS CLI. If asked, say so explicitly and link to https://workos.com/docs/directory-sync/identity-provider-role-assignment.

## Gotchas

- dsync.deleted sends ONE event for the whole directory — it does NOT send individual dsync.user.deleted or dsync.group.deleted events. Cascade-delete all users and groups by directory_id yourself.
- Use email as stable user identity, not the WorkOS directory*user*\* ID — the ID changes if a user is recreated in the IdP. Upsert by email.
- User state "inactive" is far more common than "deleted" — most IdPs deactivate users rather than deleting them. Handle dsync.user.updated with state=inactive as a deprovisioning event.
- Webhooks are not mandatory — the Events API (`workos.events.listEvents`) is a fully supported pull-based alternative for batch processing. Filter with the `dsync.*` wildcard, not a bare `dsync` string (which returns nothing). The `after` param must be within the 30-day retention window.
- Webhook handler mechanics (signature verification with `constructEvent`, return-200, idempotent dedupe by `event.id`) are canonical in `workos-events.md`.

## Endpoints

| Endpoint                | Description                |
| ----------------------- | -------------------------- |
| `/directory-sync`       | Directory Sync overview    |
| `/directory`            | Directory management       |
| `/directory-group`      | Directory group operations |
| `/directory-group/get`  | Get a directory group      |
| `/directory-group/list` | List directory groups      |
| `/directory-user`       | Directory user operations  |
| `/directory-user/get`   | Get a directory user       |
| `/directory-user/list`  | List directory users       |
| `/directory/delete`     | Delete a directory         |
| `/directory/get`        | Get a directory            |
| `/directory/list`       | List directories           |
