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

All API calls require Bearer authentication:

```bash
Authorization: Bearer sk_live_...
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_live_..."
```

## Endpoint Catalog

### Organization Roles (Org-Specific)

| Method | Endpoint                                     | Purpose                                         |
| ------ | -------------------------------------------- | ----------------------------------------------- |
| POST   | `/organization_roles`                        | Create a role for a specific organization       |
| GET    | `/organization_roles/:id`                    | Retrieve a single organization role             |
| GET    | `/organization_roles`                        | List organization roles (paginated)             |
| PUT    | `/organization_roles/:id`                    | Update an organization role's name/description  |
| DELETE | `/organization_roles/:id`                    | Delete an organization role                     |
| POST   | `/organization_roles/:id/permissions/add`    | Add permissions to an organization role         |
| POST   | `/organization_roles/:id/permissions/remove` | Remove permissions from an organization role    |
| POST   | `/organization_roles/:id/permissions/set`    | Replace all permissions on an organization role |

### Roles (Environment-Level Templates)

| Method | Endpoint                     | Purpose                                     |
| ------ | ---------------------------- | ------------------------------------------- |
| POST   | `/roles`                     | Create a role template for your environment |
| GET    | `/roles/:id`                 | Retrieve a single role template             |
| GET    | `/roles`                     | List role templates (paginated)             |
| PUT    | `/roles/:id`                 | Update a role template's name/description   |
| POST   | `/roles/:id/permissions/add` | Add permissions to a role template          |
| POST   | `/roles/:id/permissions/set` | Replace all permissions on a role template  |

### Permissions

| Method | Endpoint           | Purpose                                |
| ------ | ------------------ | -------------------------------------- |
| POST   | `/permissions`     | Create a permission resource           |
| GET    | `/permissions/:id` | Retrieve a single permission           |
| GET    | `/permissions`     | List permissions (paginated)           |
| PUT    | `/permissions/:id` | Update a permission's name/description |
| DELETE | `/permissions/:id` | Delete a permission                    |

## Operation Decision Tree

### Creating Roles

**Q: Is this role specific to one organization or reusable across all organizations?**

- **Organization-specific** → Use `POST /organization_roles` with `organization_id`
- **Reusable template** → Use `POST /roles` (no organization_id)

Example (organization-specific):

```bash
curl -X POST https://api.workos.com/organization_roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5Z8X...",
    "name": "Engineering Manager",
    "description": "Manages engineering team members"
  }'
```

Example (environment template):

```bash
curl -X POST https://api.workos.com/roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "description": "Full administrative access"
  }'
```

### Managing Permissions

**Q: Do you need to add, remove, or completely replace permissions?**

- **Add one or more** → Use `POST /organization_roles/:id/permissions/add` or `POST /roles/:id/permissions/add`
- **Remove one or more** → Use `POST /organization_roles/:id/permissions/remove`
- **Replace all** → Use `POST /organization_roles/:id/permissions/set` or `POST /roles/:id/permissions/set`

Example (add permissions):

```bash
curl -X POST https://api.workos.com/organization_roles/orgrole_01H5Z8X.../permissions/add \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["permission_01H5Z8X...", "permission_01H5Z8Y..."]
  }'
```

Example (set permissions):

```bash
curl -X POST https://api.workos.com/organization_roles/orgrole_01H5Z8X.../permissions/set \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["permission_01H5Z8X..."]
  }'
```

### Listing Resources

**Q: Do you need all results or just a subset?**

All list endpoints support pagination:

- `limit` (default 10, max 100)
- `before` or `after` cursors for pagination

Example (list with pagination):

```bash
curl "https://api.workos.com/organization_roles?organization_id=org_01H5Z8X...&limit=50&after=orgrole_01H5Z8Y..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Request/Response Patterns

### Creating an Organization Role

**Request:**

```json
POST /organization_roles
{
  "organization_id": "org_01H5Z8X...",
  "name": "Billing Admin",
  "description": "Manages billing and subscription settings"
}
```

**Response (201 Created):**

```json
{
  "object": "organization_role",
  "id": "orgrole_01H5Z8X...",
  "organization_id": "org_01H5Z8X...",
  "name": "Billing Admin",
  "description": "Manages billing and subscription settings",
  "permissions": [],
  "created_at": "2025-01-15T10:00:00.000Z",
  "updated_at": "2025-01-15T10:00:00.000Z"
}
```

### Creating a Permission

**Request:**

```json
POST /permissions
{
  "name": "repo:read",
  "description": "Read access to repositories"
}
```

**Response (201 Created):**

```json
{
  "object": "permission",
  "id": "permission_01H5Z8X...",
  "name": "repo:read",
  "description": "Read access to repositories",
  "created_at": "2025-01-15T10:00:00.000Z",
  "updated_at": "2025-01-15T10:00:00.000Z"
}
```

### Listing Roles with Pagination

**Request:**

```bash
GET /roles?limit=25&after=role_01H5Z8X...
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "object": "role",
      "id": "role_01H5Z8Y...",
      "name": "Admin",
      "description": "Full administrative access",
      "permissions": ["permission_01H5Z8X..."],
      "created_at": "2025-01-15T09:00:00.000Z",
      "updated_at": "2025-01-15T09:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": "role_01H5Z8W...",
    "after": "role_01H5Z8Z..."
  }
}
```

## Error Code Mapping

### 400 Bad Request

**Cause:** Invalid request body or missing required fields
**Fix:** Check that `organization_id` (for org roles), `name`, and `permissions` arrays are valid

Example error:

```json
{
  "error": "invalid_request",
  "error_description": "organization_id is required for organization roles"
}
```

### 401 Unauthorized

**Cause:** Missing or invalid API key
**Fix:** Verify `Authorization: Bearer sk_live_...` header is set and key starts with `sk_`

### 404 Not Found

**Cause:** Role, permission, or organization ID does not exist
**Fix:** Verify the resource ID exists by listing resources first

Example error:

```json
{
  "error": "not_found",
  "error_description": "Organization role orgrole_invalid not found"
}
```

### 409 Conflict

**Cause:** Duplicate resource name within scope (e.g., role name already exists in organization)
**Fix:** Use a unique name or update the existing resource instead

Example error:

```json
{
  "error": "conflict",
  "error_description": "A role with name 'Admin' already exists in this organization"
}
```

### 422 Unprocessable Entity

**Cause:** Invalid permission ID in permissions array
**Fix:** Verify all permission IDs exist by calling `GET /permissions` first

### 429 Too Many Requests

**Cause:** Rate limit exceeded
**Fix:** Implement exponential backoff with 1s, 2s, 4s delays between retries

## Pagination Handling

All list endpoints (`GET /roles`, `GET /organization_roles`, `GET /permissions`) use cursor-based pagination:

1. **First page:** Call endpoint without `before` or `after`
2. **Next page:** Use `after` cursor from `list_metadata.after`
3. **Previous page:** Use `before` cursor from `list_metadata.before`
4. **Control page size:** Set `limit` (max 100)

Example pagination loop (bash):

```bash
cursor=""
while true; do
  response=$(curl "https://api.workos.com/roles?limit=100&after=${cursor}" \
    -H "Authorization: Bearer ${WORKOS_API_KEY}")

  # Process response data
  echo "$response" | jq '.data[]'

  # Get next cursor
  cursor=$(echo "$response" | jq -r '.list_metadata.after // empty')
  [ -z "$cursor" ] && break
done
```

## Rate Limit Guidance

- WorkOS enforces rate limits per API key
- When you receive 429, implement exponential backoff
- Typical pattern: wait 1s, then 2s, then 4s before retrying
- For bulk operations, batch requests with 100ms delays between calls

## Runnable Verification

### Create a Permission

```bash
curl -X POST https://api.workos.com/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test:read",
    "description": "Test permission for verification"
  }'
```

Expected: 201 response with `permission_01...` ID

### Create an Environment Role with Permission

```bash
# 1. Create role
role_response=$(curl -X POST https://api.workos.com/roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Role",
    "description": "Verification test role"
  }')

role_id=$(echo "$role_response" | jq -r '.id')

# 2. Add permission to role
curl -X POST "https://api.workos.com/roles/${role_id}/permissions/add" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["permission_01..."]
  }'
```

Expected: Role created with permission attached

### List Organization Roles

```bash
curl "https://api.workos.com/organization_roles?organization_id=org_01H5Z8X...&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with `data` array and `list_metadata` cursors

## SDK Usage (Node.js)

Check fetched documentation for SDK-specific method names. Typical patterns:

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create organization role
const role = await workos.userManagement.createOrganizationRole({
  organizationId: "org_01H5Z8X...",
  name: "Engineering Manager",
  description: "Manages engineering team",
});

// Add permissions
await workos.userManagement.addOrganizationRolePermissions(role.id, {
  permissions: ["permission_01H5Z8X...", "permission_01H5Z8Y..."],
});

// List roles with pagination
const roles = await workos.userManagement.listOrganizationRoles({
  organizationId: "org_01H5Z8X...",
  limit: 50,
  after: "orgrole_01H5Z8Y...",
});
```

## Related Skills

- workos-user-management (for assigning roles to users)
- workos-organizations (for managing organizations that roles apply to)
