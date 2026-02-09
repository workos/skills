---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- generated -->

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

All API calls require authentication via Bearer token:

```bash
Authorization: Bearer sk_test_1234567890abcdef
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_test_1234567890abcdef"
```

## Endpoint Catalog

### Organization Roles

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/organization_roles` | Create a new organization-specific role |
| GET | `/user_management/organization_roles/:id` | Retrieve a specific organization role |
| GET | `/user_management/organization_roles` | List all organization roles |
| PUT | `/user_management/organization_roles/:id` | Update role name or slug |
| DELETE | `/user_management/organization_roles/:id` | Delete an organization role |
| POST | `/user_management/organization_roles/:id/permissions` | Add a permission to a role |
| DELETE | `/user_management/organization_roles/:id/permissions/:permission_id` | Remove a permission from a role |
| PUT | `/user_management/organization_roles/:id/permissions` | Replace all permissions on a role |

### Permissions

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/permissions` | Create a new permission |
| GET | `/user_management/permissions/:id` | Retrieve a specific permission |
| GET | `/user_management/permissions` | List all permissions |
| PUT | `/user_management/permissions/:id` | Update permission details |
| DELETE | `/user_management/permissions/:id` | Delete a permission |

### Global Roles

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/roles` | Create a global role template |
| GET | `/user_management/roles/:id` | Retrieve a specific global role |
| GET | `/user_management/roles` | List all global roles |
| PUT | `/user_management/roles/:id` | Update a global role |
| POST | `/user_management/roles/:id/permissions` | Add a permission to a global role |
| PUT | `/user_management/roles/:id/permissions` | Replace all permissions on a global role |

## Operation Decision Tree

**Creating a new permission model:**
1. Create permissions → POST `/user_management/permissions`
2. Create a global role template → POST `/user_management/roles`
3. Add permissions to role → POST `/user_management/roles/:id/permissions`

**Managing organization-specific roles:**
1. Create organization role → POST `/user_management/organization_roles`
2. Add permissions incrementally → POST `/user_management/organization_roles/:id/permissions`
3. OR set all permissions at once → PUT `/user_management/organization_roles/:id/permissions`

**Updating permissions:**
- Add one permission → POST `/organization_roles/:id/permissions`
- Remove one permission → DELETE `/organization_roles/:id/permissions/:permission_id`
- Replace all permissions → PUT `/organization_roles/:id/permissions`

**Querying roles:**
- Get single role → GET with role ID
- List with filters → GET with query parameters (organization_id, before, after, limit)

## Request/Response Patterns

### Create Organization Role

```bash
curl https://api.workos.com/user_management/organization_roles \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5K8P9QZXY123ABC456DEF",
    "name": "Editor",
    "slug": "editor"
  }'
```

**Response (201 Created):**
```json
{
  "object": "organization_role",
  "id": "orgrole_01H5K8P9QZXY789GHI012JKL",
  "organization_id": "org_01H5K8P9QZXY123ABC456DEF",
  "name": "Editor",
  "slug": "editor",
  "permissions": [],
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### List Organization Roles with Pagination

```bash
curl "https://api.workos.com/user_management/organization_roles?organization_id=org_01H5K8P9QZXY123ABC456DEF&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization_role",
      "id": "orgrole_01H5K8P9QZXY789GHI012JKL",
      "organization_id": "org_01H5K8P9QZXY123ABC456DEF",
      "name": "Editor",
      "slug": "editor",
      "permissions": []
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "orgrole_01H5K8P9QZXY789GHI012JKL"
  }
}
```

### Add Permission to Role

```bash
curl https://api.workos.com/user_management/organization_roles/orgrole_01H5K8P9QZXY789GHI012JKL/permissions \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "perm_01H5K8P9QZXY456MNO789PQR"
  }'
```

**Response (200 OK):**
```json
{
  "object": "organization_role",
  "id": "orgrole_01H5K8P9QZXY789GHI012JKL",
  "permissions": [
    {
      "id": "perm_01H5K8P9QZXY456MNO789PQR",
      "slug": "documents:edit",
      "name": "Edit Documents"
    }
  ]
}
```

### Set All Permissions (Replace)

```bash
curl https://api.workos.com/user_management/organization_roles/orgrole_01H5K8P9QZXY789GHI012JKL/permissions \
  -X PUT \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": [
      "perm_01H5K8P9QZXY456MNO789PQR",
      "perm_01H5K8P9QZXY456MNO789STU"
    ]
  }'
```

### Create Permission

```bash
curl https://api.workos.com/user_management/permissions \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Edit Documents",
    "slug": "documents:edit",
    "description": "Allows editing of documents"
  }'
```

**Response (201 Created):**
```json
{
  "object": "permission",
  "id": "perm_01H5K8P9QZXY456MNO789PQR",
  "name": "Edit Documents",
  "slug": "documents:edit",
  "description": "Allows editing of documents",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## Pagination Pattern

The API uses cursor-based pagination with `before` and `after` parameters:

1. Initial request returns `list_metadata.after` cursor
2. Next page: add `?after={cursor}` to the request
3. Previous page: add `?before={cursor}` to the request
4. Control page size with `?limit={number}` (default: 10, max: 100)

**Example pagination sequence:**
```bash
# Page 1
curl "https://api.workos.com/user_management/organization_roles?organization_id=org_123&limit=10"

# Page 2 (using 'after' from previous response)
curl "https://api.workos.com/user_management/organization_roles?organization_id=org_123&limit=10&after=orgrole_456"

# Page 3
curl "https://api.workos.com/user_management/organization_roles?organization_id=org_123&limit=10&after=orgrole_789"
```

## Error Code Mapping

### 400 Bad Request
**Cause:** Invalid request body or parameters
- Missing required field (organization_id, name, slug)
- Invalid UUID format for IDs
- Slug contains invalid characters (use lowercase, numbers, hyphens)

**Fix:** Validate request body against schema, ensure all required fields are present

### 401 Unauthorized
**Cause:** Missing or invalid API key
- API key not in Authorization header
- API key doesn't start with `sk_`
- API key has been revoked

**Fix:** Check `WORKOS_API_KEY` environment variable, regenerate key in WorkOS Dashboard if needed

### 404 Not Found
**Cause:** Resource doesn't exist
- Role ID doesn't exist
- Permission ID doesn't exist
- Organization ID doesn't exist

**Fix:** Verify the ID exists by listing resources first, check for typos in IDs

### 409 Conflict
**Cause:** Resource constraint violation
- Role slug already exists in organization
- Permission slug already exists
- Attempting to delete a permission that's still in use

**Fix:** Use unique slugs, remove permission from all roles before deletion

### 422 Unprocessable Entity
**Cause:** Business logic validation failed
- Attempting to add a permission that's already on the role
- Organization has reached role limit
- Role name or slug violates business rules

**Fix:** Check existing permissions before adding, contact WorkOS for limit increases

### 429 Too Many Requests
**Cause:** Rate limit exceeded
- More than 100 requests per second
- Burst limit exceeded

**Fix:** Implement exponential backoff, batch operations where possible

### 500 Internal Server Error
**Cause:** WorkOS service issue
- Database unavailable
- Unexpected server error

**Fix:** Retry with exponential backoff, check WorkOS status page, contact support if persistent

## Rate Limiting

- **Standard limit:** 100 requests per second per API key
- **Burst allowance:** 500 requests in a 10-second window
- **Response headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Retry strategy:**
```bash
# Exponential backoff example
attempt=1
max_attempts=5
while [ $attempt -le $max_attempts ]; do
  response=$(curl -w "%{http_code}" -o response.json https://api.workos.com/user_management/roles \
    -H "Authorization: Bearer ${WORKOS_API_KEY}")
  
  if [ "$response" != "429" ]; then
    break
  fi
  
  sleep $((2 ** attempt))
  attempt=$((attempt + 1))
done
```

## Runnable Verification

### Complete CRUD Test Sequence

```bash
# 1. Create a permission
PERMISSION_RESPONSE=$(curl -s https://api.workos.com/user_management/permissions \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delete Documents",
    "slug": "documents:delete"
  }')

PERMISSION_ID=$(echo $PERMISSION_RESPONSE | jq -r '.id')
echo "Created permission: $PERMISSION_ID"

# 2. Create an organization role
ROLE_RESPONSE=$(curl -s https://api.workos.com/user_management/organization_roles \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5K8P9QZXY123ABC456DEF",
    "name": "Content Manager",
    "slug": "content-manager"
  }')

ROLE_ID=$(echo $ROLE_RESPONSE | jq -r '.id')
echo "Created role: $ROLE_ID"

# 3. Add permission to role
curl -s https://api.workos.com/user_management/organization_roles/${ROLE_ID}/permissions \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"permission_id\": \"${PERMISSION_ID}\"}" | jq

# 4. List roles to verify
curl -s "https://api.workos.com/user_management/organization_roles?organization_id=org_01H5K8P9QZXY123ABC456DEF" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq

# 5. Update role name
curl -s https://api.workos.com/user_management/organization_roles/${ROLE_ID} \
  -X PUT \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Senior Content Manager"}' | jq

# 6. Remove permission from role
curl -s https://api.workos.com/user_management/organization_roles/${ROLE_ID}/permissions/${PERMISSION_ID} \
  -X DELETE \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# 7. Delete role
curl -s https://api.workos.com/user_management/organization_roles/${ROLE_ID} \
  -X DELETE \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# 8. Delete permission
curl -s https://api.workos.com/user_management/permissions/${PERMISSION_ID} \
  -X DELETE \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

echo "Verification complete"
```

### Quick Health Check

```bash
# Verify API connectivity and authentication
curl -s https://api.workos.com/user_management/permissions?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.object'

# Expected output: "list"
```

## Related Skills

- **workos-roles-permissions** — Feature guide for implementing role-based access control with WorkOS
- **workos-api-organizations** — Managing organizations that roles belong to
- **workos-api-user-management** — Assigning roles to users within organizations
