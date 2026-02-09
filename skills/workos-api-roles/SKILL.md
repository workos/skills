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

## Authentication

Set the API key in the `Authorization` header for all requests:

```
Authorization: Bearer sk_your_api_key
```

The API key must start with `sk_` and have the `roles` permission scope enabled in the WorkOS Dashboard.

## Endpoint Catalog

### Organization Roles (Org-Scoped)

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `POST` | `/organization_roles` | Create a new role in an organization |
| `GET` | `/organization_roles/:id` | Retrieve a specific organization role |
| `GET` | `/organization_roles` | List all roles in an organization |
| `PUT` | `/organization_roles/:id` | Update role name or description |
| `DELETE` | `/organization_roles/:id` | Delete an organization role |
| `POST` | `/organization_roles/:id/permissions/add` | Add a single permission to a role |
| `POST` | `/organization_roles/:id/permissions/remove` | Remove a single permission from a role |
| `POST` | `/organization_roles/:id/permissions/set` | Set all permissions (replaces existing) |

### Global Roles (Tenant-Level Templates)

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `POST` | `/roles` | Create a global role template |
| `GET` | `/roles/:id` | Retrieve a global role |
| `GET` | `/roles` | List all global roles |
| `PUT` | `/roles/:id` | Update global role name or description |
| `POST` | `/roles/:id/permissions/add` | Add a permission to a global role |
| `POST` | `/roles/:id/permissions/set` | Set all permissions on a global role |

### Permissions

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `POST` | `/permissions` | Create a new permission |
| `GET` | `/permissions/:id` | Retrieve a specific permission |
| `GET` | `/permissions` | List all permissions |
| `PUT` | `/permissions/:id` | Update permission name or description |
| `DELETE` | `/permissions/:id` | Delete a permission |

## Operation Decision Tree

**When do I use organization_roles vs. roles?**

- Use `POST /organization_roles` to create a role instance within a specific organization
- Use `POST /roles` to create a global role template that can be applied across multiple organizations

**Create vs. Update vs. Set Permissions?**

- Use `POST /organization_roles/:id/permissions/add` to add ONE permission without affecting existing ones
- Use `POST /organization_roles/:id/permissions/remove` to remove ONE permission
- Use `POST /organization_roles/:id/permissions/set` to replace ALL permissions atomically

**When to create permissions first?**

- Always create permissions (`POST /permissions`) before assigning them to roles
- Permission slugs must exist before you can add them to a role

## Request/Response Patterns

### Create Organization Role

**Request:**
```http
POST /organization_roles
Content-Type: application/json

{
  "organization_id": "org_01H5P...",
  "name": "Billing Admin",
  "description": "Manages billing and subscriptions"
}
```

**Response (201):**
```json
{
  "object": "organization_role",
  "id": "orgrole_01H5P...",
  "organization_id": "org_01H5P...",
  "name": "Billing Admin",
  "description": "Manages billing and subscriptions",
  "permissions": [],
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Add Permission to Role

**Request:**
```http
POST /organization_roles/orgrole_01H5P.../permissions/add
Content-Type: application/json

{
  "permission_id": "perm_01H5P..."
}
```

**Response (200):**
```json
{
  "object": "organization_role",
  "id": "orgrole_01H5P...",
  "permissions": [
    {
      "id": "perm_01H5P...",
      "slug": "billing:read",
      "name": "Read Billing Data"
    }
  ]
}
```

### List Organization Roles (Paginated)

**Request:**
```http
GET /organization_roles?organization_id=org_01H5P...&limit=10&after=orgrole_01H5P...
```

**Response (200):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization_role",
      "id": "orgrole_01H5P...",
      "name": "Billing Admin"
    }
  ],
  "list_metadata": {
    "after": "orgrole_01H5Q...",
    "before": null
  }
}
```

### Create Permission

**Request:**
```http
POST /permissions
Content-Type: application/json

{
  "slug": "billing:write",
  "name": "Modify Billing Data",
  "description": "Can update payment methods and plans"
}
```

**Response (201):**
```json
{
  "object": "permission",
  "id": "perm_01H5P...",
  "slug": "billing:write",
  "name": "Modify Billing Data",
  "description": "Can update payment methods and plans",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## Pagination Pattern

List endpoints use cursor-based pagination:

1. Initial request: `GET /organization_roles?organization_id=org_01H5P...&limit=10`
2. Get next page: Use the `after` cursor from `list_metadata`: `GET /organization_roles?organization_id=org_01H5P...&limit=10&after=orgrole_01H5Q...`
3. Get previous page: Use the `before` cursor if present
4. End of results: `list_metadata.after` is `null`

Default limit is 10, maximum is 100.

## Error Code Mapping

| Status | Cause | Fix |
| ------ | ----- | --- |
| `400` | Missing required field (`organization_id`, `name`, etc.) | Check request body includes all required fields per fetched docs |
| `401` | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header is set correctly |
| `403` | API key lacks `roles` permission scope | Enable `roles` scope in WorkOS Dashboard → API Keys |
| `404` | Role, permission, or organization not found | Verify ID exists with `GET /{resource}/:id` before operating on it |
| `409` | Duplicate slug or name conflict | Use a unique `slug` for permissions or check existing roles with `GET /organization_roles` |
| `422` | Invalid permission ID when adding to role | Ensure permission exists with `GET /permissions/:id` before adding |
| `429` | Rate limit exceeded (100 requests/second) | Implement exponential backoff: wait 1s, 2s, 4s, 8s before retrying |
| `500` | WorkOS internal error | Retry with exponential backoff up to 3 attempts |

## Rate Limits

- **Limit:** 100 requests per second per API key
- **Retry strategy:** Exponential backoff with jitter (1s → 2s → 4s → 8s)
- **Headers:** Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` in responses

## Runnable Verification

### Verify Authentication

```bash
curl https://api.workos.com/permissions \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with list of permissions (or empty list if none created)

### Create Permission and Role End-to-End

```bash
# 1. Create permission
PERM_ID=$(curl -s https://api.workos.com/permissions \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test:read",
    "name": "Test Read"
  }' | jq -r '.id')

# 2. Create organization role
ROLE_ID=$(curl -s https://api.workos.com/organization_roles \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5P...",
    "name": "Test Role"
  }' | jq -r '.id')

# 3. Add permission to role
curl https://api.workos.com/organization_roles/$ROLE_ID/permissions/add \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"permission_id\": \"$PERM_ID\"}"

# 4. Verify role has permission
curl https://api.workos.com/organization_roles/$ROLE_ID \
  -H "Authorization: Bearer sk_your_api_key"
```

Expected: Final response includes permission in `permissions` array.

### Test Pagination

```bash
# List roles with small limit to trigger pagination
curl "https://api.workos.com/organization_roles?organization_id=org_01H5P...&limit=2" \
  -H "Authorization: Bearer sk_your_api_key"
```

Expected: `list_metadata.after` is non-null if more than 2 roles exist.

## Common Patterns

### Atomic Permission Replacement

To replace all permissions on a role without race conditions:

```bash
curl -X POST https://api.workos.com/organization_roles/orgrole_01H5P.../permissions/set \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": ["perm_01H5P...", "perm_01H5Q...", "perm_01H5R..."]
  }'
```

This is safer than multiple `add`/`remove` calls which can interleave with other updates.

### Check Permission Existence Before Assignment

```bash
# 1. Verify permission exists
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  https://api.workos.com/permissions/perm_01H5P... \
  -H "Authorization: Bearer sk_your_api_key")

# 2. Only add if 200
if [ "$STATUS" = "200" ]; then
  curl -X POST https://api.workos.com/organization_roles/orgrole_01H5P.../permissions/add \
    -H "Authorization: Bearer sk_your_api_key" \
    -H "Content-Type: application/json" \
    -d '{"permission_id": "perm_01H5P..."}'
fi
```

This prevents `422` errors from invalid permission IDs.

## Related Skills

- **workos-rbac** — Feature overview and WorkOS RBAC concepts
- **workos-api-organization** — Managing organizations that own roles
- **workos-fga** — Fine-grained authorization patterns using roles
