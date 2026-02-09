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

All requests require a WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key_here
```

Obtain your API key from the WorkOS Dashboard. The key must start with `sk_` for secret keys.

## Base URL

```
https://api.workos.com
```

## Endpoint Catalog

### Organization Roles

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/user_management/organization_roles` | Create a role for an organization |
| `GET` | `/user_management/organization_roles/:id` | Retrieve a specific organization role |
| `GET` | `/user_management/organization_roles` | List organization roles |
| `PUT` | `/user_management/organization_roles/:id` | Update an organization role |
| `DELETE` | `/user_management/organization_roles/:id` | Delete an organization role |
| `POST` | `/user_management/organization_roles/:id/add_permission` | Add permission to organization role |
| `POST` | `/user_management/organization_roles/:id/remove_permission` | Remove permission from organization role |
| `POST` | `/user_management/organization_roles/:id/set_permissions` | Replace all permissions on organization role |

### Roles (Account-Level)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/user_management/roles` | Create an account-level role template |
| `GET` | `/user_management/roles/:slug` | Retrieve a role template |
| `GET` | `/user_management/roles` | List role templates |
| `PUT` | `/user_management/roles/:slug` | Update a role template |
| `POST` | `/user_management/roles/:slug/add_permission` | Add permission to role template |
| `POST` | `/user_management/roles/:slug/set_permissions` | Replace permissions on role template |

### Permissions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/user_management/permissions` | Create a permission |
| `GET` | `/user_management/permissions/:id` | Retrieve a specific permission |
| `GET` | `/user_management/permissions` | List permissions |
| `PUT` | `/user_management/permissions/:id` | Update a permission |
| `DELETE` | `/user_management/permissions/:id` | Delete a permission |

## Operation Decision Tree

**Creating Roles:**
- **Organization-specific role** → Use `POST /user_management/organization_roles` with `organization_id`
- **Reusable role template** → Use `POST /user_management/roles` (no `organization_id`)

**Modifying Permissions:**
- **Add one permission** → Use `/add_permission` endpoint
- **Remove one permission** → Use `/remove_permission` endpoint (organization roles only)
- **Replace all permissions** → Use `/set_permissions` endpoint

**Updating Roles:**
- **Change name/description** → Use `PUT /organization_roles/:id` or `PUT /roles/:slug`
- **Modify permissions** → Use permission-specific endpoints (not the update endpoint)

**Looking up Roles:**
- **By ID** → Use `GET /organization_roles/:id` or `GET /roles/:slug`
- **List with filters** → Use `GET /organization_roles` or `GET /roles` with query params

## Request/Response Patterns

### Create Organization Role

```bash
curl -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "description": "Full administrative access",
    "organization_id": "org_01H1Z2F3G4H5J6K7M8N9P0Q1R2"
  }'
```

**Response (201 Created):**
```json
{
  "object": "organization_role",
  "id": "orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
  "name": "Admin",
  "description": "Full administrative access",
  "organization_id": "org_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
  "permissions": [],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Add Permission to Organization Role

```bash
curl -X POST https://api.workos.com/user_management/organization_roles/orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2/add_permission \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R2"
  }'
```

**Response (200 OK):**
```json
{
  "object": "organization_role",
  "id": "orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
  "permissions": [
    {
      "id": "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
      "slug": "users:create",
      "name": "Create Users",
      "description": "Permission to create users"
    }
  ]
}
```

### List Organization Roles (with Pagination)

```bash
curl -X GET "https://api.workos.com/user_management/organization_roles?organization_id=org_01H1Z2F3G4H5J6K7M8N9P0Q1R2&limit=10" \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization_role",
      "id": "orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
      "name": "Admin",
      "permissions": []
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2"
  }
}
```

### Create Permission

```bash
curl -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delete Users",
    "description": "Permission to delete users",
    "slug": "users:delete"
  }'
```

**Response (201 Created):**
```json
{
  "object": "permission",
  "id": "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
  "name": "Delete Users",
  "description": "Permission to delete users",
  "slug": "users:delete",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Pagination Handling

WorkOS uses cursor-based pagination with `before` and `after` parameters:

```bash
# First page
GET /user_management/organization_roles?limit=10

# Next page (use 'after' from previous response)
GET /user_management/organization_roles?limit=10&after=orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2

# Previous page (use 'before' from current response)
GET /user_management/organization_roles?limit=10&before=orole_01H1Z2F3G4H5J6K7M8N9P0Q1R2
```

**Pagination pattern:**
1. Check `list_metadata.after` in response — if null, you're on the last page
2. To fetch next page, use `after` parameter with the value from `list_metadata.after`
3. Default limit is 10; maximum is 100

## Error Codes and Resolution

| Status Code | Cause | Resolution |
|-------------|-------|------------|
| `401 Unauthorized` | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header is present and key is valid |
| `403 Forbidden` | API key lacks required permissions | Check that the API key has User Management permissions enabled in WorkOS Dashboard |
| `404 Not Found` | Resource does not exist (role, permission, organization) | Verify the ID/slug is correct; for organization roles, ensure `organization_id` matches |
| `422 Unprocessable Entity` | Validation error (duplicate slug, missing required field) | Check response body for `errors` array with specific field validation messages |
| `429 Too Many Requests` | Rate limit exceeded | Implement exponential backoff retry; default limit is 100 requests/minute |
| `500 Internal Server Error` | WorkOS service issue | Retry with exponential backoff; check WorkOS status page |

**Example error response:**
```json
{
  "message": "Validation error",
  "errors": [
    {
      "field": "slug",
      "code": "duplicate",
      "message": "A permission with this slug already exists"
    }
  ]
}
```

## Rate Limit Guidance

- **Limit:** 100 requests per minute per API key (verify current limits in documentation)
- **Headers:** Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers
- **Retry strategy:** Use exponential backoff starting at 1 second, max 32 seconds
- **Best practice:** Batch permission updates using `set_permissions` instead of multiple `add_permission` calls

## Verification Commands

### Test Authentication

```bash
curl -X GET https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with permissions list (may be empty)

### Create and Verify Full Flow

```bash
# 1. Create permission
PERM_RESPONSE=$(curl -s -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Permission","slug":"test:read"}')

PERM_ID=$(echo $PERM_RESPONSE | jq -r '.id')
echo "Created permission: $PERM_ID"

# 2. Create organization role
ROLE_RESPONSE=$(curl -s -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Role\",\"organization_id\":\"$ORG_ID\"}")

ROLE_ID=$(echo $ROLE_RESPONSE | jq -r '.id')
echo "Created role: $ROLE_ID"

# 3. Add permission to role
curl -X POST https://api.workos.com/user_management/organization_roles/$ROLE_ID/add_permission \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"permission_id\":\"$PERM_ID\"}"

# 4. Verify role has permission
curl -X GET https://api.workos.com/user_management/organization_roles/$ROLE_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.permissions'
```

Expected: Permission appears in role's permissions array

### Test Error Handling

```bash
# Test 404 (nonexistent role)
curl -X GET https://api.workos.com/user_management/organization_roles/orole_invalid \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 422 (duplicate permission slug)
curl -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate","slug":"test:read"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 404 and HTTP 422 respectively

## Common Patterns

### Bulk Permission Assignment

Instead of multiple `add_permission` calls:

```bash
curl -X POST https://api.workos.com/user_management/organization_roles/$ROLE_ID/set_permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": [
      "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R2",
      "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R3",
      "perm_01H1Z2F3G4H5J6K7M8N9P0Q1R4"
    ]
  }'
```

This replaces all permissions in a single atomic operation.

### Filter Roles by Organization

```bash
curl -X GET "https://api.workos.com/user_management/organization_roles?organization_id=org_01H1Z2F3G4H5J6K7M8N9P0Q1R2" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Without `organization_id`, the endpoint returns roles across all organizations (if permitted).

### Role Template to Organization Role

1. Create role template: `POST /user_management/roles`
2. When assigning to organization, create organization role with same permissions
3. Role templates serve as blueprints; they don't automatically propagate to organizations

## Related Skills

- [WorkOS Roles & Permissions Feature Guide](./workos-roles.md) — Conceptual overview and implementation patterns
- [WorkOS User Management API](./workos-api-user-management.md) — Assign roles to users
- [WorkOS Organizations API](./workos-api-organizations.md) — Manage organizations for role scoping
