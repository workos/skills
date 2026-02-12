---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete
- https://workos.com/docs/reference/roles/organization-role/get
- https://workos.com/docs/reference/roles/organization-role/list
- https://workos.com/docs/reference/roles/organization-role/remove-permission

## Authentication Setup

All requests require API key authentication:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key in the environment:

```bash
export WORKOS_API_KEY=sk_your_api_key
```

## Endpoint Catalog

### Organization Roles

| Method | Endpoint                                    | Purpose                                         |
| ------ | ------------------------------------------- | ----------------------------------------------- |
| POST   | `/organization_roles`                       | Create a role for a specific organization       |
| GET    | `/organization_roles/:id`                   | Retrieve a single organization role             |
| GET    | `/organization_roles`                       | List all organization roles                     |
| PUT    | `/organization_roles/:id`                   | Update role name or description                 |
| DELETE | `/organization_roles/:id`                   | Delete an organization role                     |
| POST   | `/organization_roles/:id/add_permission`    | Add a permission to an organization role        |
| POST   | `/organization_roles/:id/remove_permission` | Remove a permission from an organization role   |
| POST   | `/organization_roles/:id/set_permissions`   | Replace all permissions on an organization role |

### Role Templates

| Method | Endpoint                     | Purpose                                    |
| ------ | ---------------------------- | ------------------------------------------ |
| POST   | `/roles`                     | Create a reusable role template            |
| GET    | `/roles/:id`                 | Retrieve a single role template            |
| GET    | `/roles`                     | List all role templates                    |
| PUT    | `/roles/:id`                 | Update template name or description        |
| POST   | `/roles/:id/add_permission`  | Add a permission to a role template        |
| POST   | `/roles/:id/set_permissions` | Replace all permissions on a role template |

### Permissions

| Method | Endpoint           | Purpose                               |
| ------ | ------------------ | ------------------------------------- |
| POST   | `/permissions`     | Create a new permission               |
| GET    | `/permissions/:id` | Retrieve a single permission          |
| GET    | `/permissions`     | List all permissions                  |
| PUT    | `/permissions/:id` | Update permission name or description |
| DELETE | `/permissions/:id` | Delete a permission                   |

## Operation Decision Tree

**Creating Roles:**

- Need a role for ONE organization? → `POST /organization_roles`
- Need a reusable role template across organizations? → `POST /roles`

**Updating Permissions:**

- Adding ONE permission? → `POST /{resource}/:id/add_permission`
- Removing ONE permission? → `POST /organization_roles/:id/remove_permission`
- Replacing ALL permissions at once? → `POST /{resource}/:id/set_permissions`

**Listing Resources:**

- Need organization-specific roles? → `GET /organization_roles` with `organization_id` filter
- Need all role templates? → `GET /roles`
- Need paginated results? → Use `limit` and `after` parameters

## Request/Response Patterns

### Create Organization Role

```bash
curl -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H8C9JZHFE4RQQVD2NPKJ9RAR",
    "name": "Engineering Manager",
    "description": "Manages engineering team members"
  }'
```

Response:

```json
{
  "id": "org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR",
  "object": "organization_role",
  "organization_id": "org_01H8C9JZHFE4RQQVD2NPKJ9RAR",
  "name": "Engineering Manager",
  "description": "Manages engineering team members",
  "permissions": [],
  "created_at": "2023-09-01T12:00:00.000Z",
  "updated_at": "2023-09-01T12:00:00.000Z"
}
```

### List Organization Roles with Pagination

```bash
curl -X GET "https://api.workos.com/user_management/organization_roles?organization_id=org_01H8C9JZHFE4RQQVD2NPKJ9RAR&limit=10&after=org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR",
      "object": "organization_role",
      "organization_id": "org_01H8C9JZHFE4RQQVD2NPKJ9RAR",
      "name": "Engineering Manager",
      "permissions": []
    }
  ],
  "list_metadata": {
    "after": "org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR"
  }
}
```

### Add Permission to Role

```bash
curl -X POST https://api.workos.com/user_management/organization_roles/org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR/add_permission \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "perm_01H8C9JZHFE4RQQVD2NPKJ9RAR"
  }'
```

Response:

```json
{
  "id": "org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR",
  "object": "organization_role",
  "permissions": [
    {
      "id": "perm_01H8C9JZHFE4RQQVD2NPKJ9RAR",
      "name": "project:read",
      "description": "Read project data"
    }
  ]
}
```

### Set Permissions (Replace All)

```bash
curl -X POST https://api.workos.com/user_management/organization_roles/org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR/set_permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": [
      "perm_01H8C9JZHFE4RQQVD2NPKJ9RAR",
      "perm_01H8C9JZHFE4RQQVD2NPKJ9XYZ"
    ]
  }'
```

### Create Permission

```bash
curl -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "project:write",
    "description": "Write access to projects"
  }'
```

Response:

```json
{
  "id": "perm_01H8C9JZHFE4RQQVD2NPKJ9RAR",
  "object": "permission",
  "name": "project:write",
  "description": "Write access to projects",
  "created_at": "2023-09-01T12:00:00.000Z",
  "updated_at": "2023-09-01T12:00:00.000Z"
}
```

## Pagination Handling

List endpoints support cursor-based pagination:

1. Initial request: `GET /organization_roles?limit=10`
2. Response includes `list_metadata.after` cursor
3. Next page: `GET /organization_roles?limit=10&after=org_role_123`
4. Continue until `list_metadata.after` is absent

```bash
# Page 1
curl -X GET "https://api.workos.com/user_management/organization_roles?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Page 2 (use 'after' from previous response)
curl -X GET "https://api.workos.com/user_management/organization_roles?limit=10&after=org_role_01H8C9JZHFE4RQQVD2NPKJ9RAR" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Error Code Mapping

| Status Code | Cause                                                                   | Fix                                                                                         |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 400         | Missing required field (e.g., `organization_id`, `name`)                | Check request body includes all required parameters per endpoint docs                       |
| 401         | Invalid or missing API key                                              | Verify `WORKOS_API_KEY` starts with `sk_` and is included in `Authorization: Bearer` header |
| 403         | API key lacks permissions                                               | Check Dashboard that API key has User Management scope enabled                              |
| 404         | Resource ID not found (role, permission, organization)                  | Verify resource exists with GET request; check for typos in ID                              |
| 409         | Duplicate resource (permission already added to role)                   | Check existing permissions with GET before adding; use `set_permissions` to replace         |
| 422         | Invalid parameter format (malformed ID, invalid organization reference) | Verify IDs match format `org_role_`, `perm_`, `org_` prefixes                               |
| 429         | Rate limit exceeded                                                     | Implement exponential backoff; default limit is 600 requests/minute                         |
| 500         | Internal server error                                                   | Retry with exponential backoff; check WorkOS status page                                    |

### Rate Limit Guidance

WorkOS enforces 600 requests per minute per API key. Rate limit headers:

```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1693574400
```

Retry strategy for 429 errors:

```bash
# Exponential backoff: 1s, 2s, 4s, 8s
curl -X POST https://api.workos.com/user_management/organization_roles \
  --retry 4 \
  --retry-delay 1 \
  --retry-max-time 15 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{"organization_id": "org_123", "name": "Admin"}'
```

## Runnable Verification

### Verify API Key

```bash
curl -X GET https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 200 OK with permissions list

### Create Permission → Create Role → Add Permission → Verify

```bash
# 1. Create permission
PERM_ID=$(curl -s -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "test:read", "description": "Test permission"}' \
  | jq -r '.id')

echo "Created permission: $PERM_ID"

# 2. Create organization role
ROLE_ID=$(curl -s -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\": \"${ORG_ID}\", \"name\": \"Test Role\"}" \
  | jq -r '.id')

echo "Created role: $ROLE_ID"

# 3. Add permission to role
curl -X POST "https://api.workos.com/user_management/organization_roles/${ROLE_ID}/add_permission" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"permission_id\": \"${PERM_ID}\"}"

# 4. Verify permission was added
curl -X GET "https://api.workos.com/user_management/organization_roles/${ROLE_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.permissions'
```

### Cleanup Test Resources

```bash
# Delete role
curl -X DELETE "https://api.workos.com/user_management/organization_roles/${ROLE_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Delete permission
curl -X DELETE "https://api.workos.com/user_management/permissions/${PERM_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Related Skills

- workos-authkit-base — Integrate authentication with role-based access control
- workos-directory-sync.rules.yml — Sync roles from SCIM directory providers
