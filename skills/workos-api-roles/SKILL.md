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

All API requests require authentication via Bearer token:

```bash
Authorization: Bearer sk_live_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_live_your_api_key
```

## Endpoint Catalog

### Organization Roles (Per-Organization Role Management)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/organization_roles` | Create a role for a specific organization |
| GET | `/user_management/organization_roles/:id` | Get a single organization role |
| GET | `/user_management/organization_roles` | List roles for an organization |
| PUT | `/user_management/organization_roles/:id` | Update organization role metadata |
| DELETE | `/user_management/organization_roles/:id` | Delete an organization role |
| POST | `/user_management/organization_roles/:id/add_permission` | Add permission to organization role |
| POST | `/user_management/organization_roles/:id/remove_permission` | Remove permission from organization role |
| POST | `/user_management/organization_roles/:id/set_permissions` | Replace all permissions for organization role |

### Global Roles (Reusable Role Templates)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/roles` | Create a reusable role template |
| GET | `/user_management/roles/:id` | Get a single role template |
| GET | `/user_management/roles` | List all role templates |
| PUT | `/user_management/roles/:id` | Update role template metadata |
| POST | `/user_management/roles/:id/add_permission` | Add permission to role template |
| POST | `/user_management/roles/:id/set_permissions` | Replace all permissions for role template |

### Permissions (Granular Access Controls)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/permissions` | Create a permission |
| GET | `/user_management/permissions/:id` | Get a single permission |
| GET | `/user_management/permissions` | List all permissions |
| PUT | `/user_management/permissions/:id` | Update permission metadata |
| DELETE | `/user_management/permissions/:id` | Delete a permission |

## Operation Decision Tree

### When to Use Organization Roles vs Global Roles

```
Need to define a role?
│
├─ Is this role specific to ONE organization?
│  └─ Use Organization Roles API (POST /organization_roles)
│     - Examples: "Acme Corp Admin", "Beta Org Viewer"
│
└─ Is this role reusable across ALL organizations?
   └─ Use Global Roles API (POST /roles)
      - Examples: "Admin", "Member", "Viewer"
      - Note: Global roles are templates — assign them to organizations separately
```

### CRUD Operation Mapping

**Create a new permission:**
```
POST /user_management/permissions
```

**Create a role template (multi-organization):**
```
POST /user_management/roles
```

**Create a role for specific organization:**
```
POST /user_management/organization_roles
```

**Update role metadata (name, description):**
```
PUT /user_management/roles/:id              # For global roles
PUT /user_management/organization_roles/:id # For org-specific roles
```

**Add/remove permissions incrementally:**
```
POST /organization_roles/:id/add_permission    # Add one permission
POST /organization_roles/:id/remove_permission # Remove one permission
```

**Replace all permissions at once:**
```
POST /organization_roles/:id/set_permissions # Replaces entire permission set
POST /roles/:id/set_permissions              # For global roles
```

**Delete role (WARNING: affects assigned users):**
```
DELETE /user_management/organization_roles/:id
```

## Request/Response Patterns

### Create Organization Role

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5K8PJZ8N4JKQ6X1Y9Z2ABC",
    "name": "Engineering Manager",
    "description": "Manages engineering team members"
  }'
```

**Response (201):**
```json
{
  "object": "organization_role",
  "id": "org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF",
  "organization_id": "org_01H5K8PJZ8N4JKQ6X1Y9Z2ABC",
  "name": "Engineering Manager",
  "description": "Manages engineering team members",
  "permissions": [],
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Add Permission to Role

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/organization_roles/org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF/add_permission \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "perm_01H5K8PJZ8N4JKQ6X1Y9Z2GHI"
  }'
```

**Response (200):**
```json
{
  "object": "organization_role",
  "id": "org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF",
  "permissions": [
    {
      "id": "perm_01H5K8PJZ8N4JKQ6X1Y9Z2GHI",
      "name": "repo:write",
      "description": "Write access to repositories"
    }
  ]
}
```

### Set All Permissions (Replace Existing)

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/organization_roles/org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF/set_permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": [
      "perm_01H5K8PJZ8N4JKQ6X1Y9Z2GHI",
      "perm_01H5K8PJZ8N4JKQ6X1Y9Z2JKL"
    ]
  }'
```

**Response (200):**
```json
{
  "object": "organization_role",
  "id": "org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF",
  "permissions": [
    {
      "id": "perm_01H5K8PJZ8N4JKQ6X1Y9Z2GHI",
      "name": "repo:write"
    },
    {
      "id": "perm_01H5K8PJZ8N4JKQ6X1Y9Z2JKL",
      "name": "user:invite"
    }
  ]
}
```

### List Organization Roles (Paginated)

**Request:**
```bash
curl -X GET "https://api.workos.com/user_management/organization_roles?organization_id=org_01H5K8PJZ8N4JKQ6X1Y9Z2ABC&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization_role",
      "id": "org_role_01H5K8PJZ8N4JKQ6X1Y9Z2DEF",
      "name": "Engineering Manager",
      "permissions": [...]
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "org_role_01H5K8PJZ8N4JKQ6X1Y9Z2XYZ"
  }
}
```

### Create Permission

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "repo:delete",
    "description": "Delete repositories"
  }'
```

**Response (201):**
```json
{
  "object": "permission",
  "id": "perm_01H5K8PJZ8N4JKQ6X1Y9Z2MNO",
  "name": "repo:delete",
  "description": "Delete repositories",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## Pagination Handling

List endpoints use cursor-based pagination:

**Initial request:**
```bash
curl "https://api.workos.com/user_management/roles?limit=10"
```

**Next page (using `after` cursor):**
```bash
curl "https://api.workos.com/user_management/roles?limit=10&after=role_01H5K8PJZ8N4JKQ6X1Y9Z2XYZ"
```

**Previous page (using `before` cursor):**
```bash
curl "https://api.workos.com/user_management/roles?limit=10&before=role_01H5K8PJZ8N4JKQ6X1Y9Z2ABC"
```

The `list_metadata` object contains `before` and `after` cursors. A `null` cursor indicates no more pages in that direction.

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 400 | Invalid `organization_id` format | Verify organization ID starts with `org_` |
| 400 | Missing required field (e.g., `name`) | Check request body includes all required fields |
| 401 | Invalid or missing API key | Verify `Authorization: Bearer sk_live_...` header |
| 403 | API key lacks required permissions | Check API key permissions in WorkOS Dashboard |
| 404 | Role ID or permission ID not found | Verify resource exists via GET request first |
| 409 | Permission already assigned to role | Use `set_permissions` to replace, or skip if acceptable |
| 409 | Permission name already exists | Choose a unique permission name |
| 422 | Invalid permission_id format | Ensure permission ID starts with `perm_` |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay) |
| 500 | Internal server error | Retry with exponential backoff, contact support if persists |

### Common Error Response Format

```json
{
  "error": "invalid_request",
  "error_description": "organization_id is required",
  "code": "invalid_request"
}
```

## Runnable Verification Commands

### 1. Create a Permission
```bash
export WORKOS_API_KEY=sk_live_your_key_here

PERMISSION_ID=$(curl -s -X POST https://api.workos.com/user_management/permissions \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"test:read","description":"Test read permission"}' \
  | jq -r '.id')

echo "Created permission: $PERMISSION_ID"
```

### 2. Create an Organization Role
```bash
export ORG_ID=org_your_org_id_here

ROLE_ID=$(curl -s -X POST https://api.workos.com/user_management/organization_roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\":\"$ORG_ID\",\"name\":\"Test Role\",\"description\":\"Test role\"}" \
  | jq -r '.id')

echo "Created role: $ROLE_ID"
```

### 3. Add Permission to Role
```bash
curl -X POST https://api.workos.com/user_management/organization_roles/$ROLE_ID/add_permission \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"permission_id\":\"$PERMISSION_ID\"}"
```

### 4. Verify Role Has Permission
```bash
curl -s -X GET https://api.workos.com/user_management/organization_roles/$ROLE_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.permissions'
```

### 5. Cleanup (Delete Role)
```bash
curl -X DELETE https://api.workos.com/user_management/organization_roles/$ROLE_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Rate Limits

- **Default limit:** 100 requests per 10 seconds per API key
- **Retry strategy:** Implement exponential backoff starting at 1 second
- **429 response includes:** `Retry-After` header (seconds to wait)

**Example retry logic:**
```bash
# If 429 received, extract Retry-After header
RETRY_AFTER=$(curl -i ... | grep -i retry-after | awk '{print $2}')
sleep $RETRY_AFTER
# Retry request
```

## Related Skills

- **workos-rbac** — Role-Based Access Control feature guide (how to design permission systems)
- **workos-api-organization** — Organization management API (required for organization roles)
- **workos-api-authkit** — User management API (assign roles to users)
