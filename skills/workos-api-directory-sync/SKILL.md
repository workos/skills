---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/directory-sync
- https://workos.com/docs/reference/directory-sync/directory
- https://workos.com/docs/reference/directory-sync/directory-group
- https://workos.com/docs/reference/directory-sync/directory-group/get
- https://workos.com/docs/reference/directory-sync/directory-group/list
- https://workos.com/docs/reference/directory-sync/directory-user
- https://workos.com/docs/reference/directory-sync/directory-user/get
- https://workos.com/docs/reference/directory-sync/directory-user/list

## Authentication

All API requests require authentication via bearer token:

```bash
Authorization: Bearer sk_your_api_key
```

Your API key must start with `sk_` and have Directory Sync permissions enabled in the WorkOS Dashboard.

## Endpoint Catalog

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/directories` | List all directories for your organization |
| GET | `/directories/:id` | Get a specific directory by ID |
| DELETE | `/directories/:id` | Delete a directory |
| GET | `/directory_users` | List all users across directories |
| GET | `/directory_users/:id` | Get a specific user by ID |
| GET | `/directory_groups` | List all groups across directories |
| GET | `/directory_groups/:id` | Get a specific group by ID |

Base URL: `https://api.workos.com`

## Operation Decision Tree

**To list all synced users from a directory:**
→ Use `GET /directory_users?directory=directory_123`

**To get details of a specific user:**
→ Use `GET /directory_users/:id` with the user ID

**To list all groups in a directory:**
→ Use `GET /directory_groups?directory=directory_123`

**To get details of a specific group:**
→ Use `GET /directory_groups/:id` with the group ID

**To see all configured directories:**
→ Use `GET /directories`

**To check directory connection status:**
→ Use `GET /directories/:id` and check the `state` field

**To remove a directory:**
→ Use `DELETE /directories/:id`

## Request/Response Patterns

### List Directory Users

```bash
curl https://api.workos.com/directory_users \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -G \
  --data-urlencode "directory=directory_01H8675JXCN8Q2TYZ9XYZ123"
```

**Response:**
```json
{
  "data": [
    {
      "id": "directory_user_01H8675JXCN8Q2TYZ9XYZ456",
      "directory_id": "directory_01H8675JXCN8Q2TYZ9XYZ123",
      "username": "jsmith",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "jsmith@example.com"
        }
      ],
      "first_name": "John",
      "last_name": "Smith",
      "state": "active",
      "custom_attributes": {},
      "raw_attributes": {}
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_user_01H8675JXCN8Q2TYZ9XYZ456"
  }
}
```

### Get Specific User

```bash
curl https://api.workos.com/directory_users/directory_user_01H8675JXCN8Q2TYZ9XYZ456 \
  -H "Authorization: Bearer sk_your_api_key"
```

### List Directory Groups

```bash
curl https://api.workos.com/directory_groups \
  -H "Authorization: Bearer sk_your_api_key" \
  -G \
  --data-urlencode "directory=directory_01H8675JXCN8Q2TYZ9XYZ123"
```

**Response:**
```json
{
  "data": [
    {
      "id": "directory_group_01H8675JXCN8Q2TYZ9XYZ789",
      "directory_id": "directory_01H8675JXCN8Q2TYZ9XYZ123",
      "name": "Engineering",
      "raw_attributes": {}
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_group_01H8675JXCN8Q2TYZ9XYZ789"
  }
}
```

### List Directories

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response:**
```json
{
  "data": [
    {
      "id": "directory_01H8675JXCN8Q2TYZ9XYZ123",
      "organization_id": "org_01H8675JXCN8Q2TYZ9XYZ000",
      "name": "Acme Corp",
      "type": "okta scim v2.0",
      "state": "linked",
      "domain": "acme.com"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": null
  }
}
```

## Pagination Handling

All list endpoints support cursor-based pagination:

**Query parameters:**
- `limit` — number of results per page (default 10, max 100)
- `before` — cursor for previous page
- `after` — cursor for next page

**Example with pagination:**
```bash
curl https://api.workos.com/directory_users \
  -H "Authorization: Bearer sk_your_api_key" \
  -G \
  --data-urlencode "directory=directory_01H8675JXCN8Q2TYZ9XYZ123" \
  --data-urlencode "limit=50" \
  --data-urlencode "after=directory_user_01H8675JXCN8Q2TYZ9XYZ456"
```

The `list_metadata` object in responses contains cursors for pagination.

## Filtering

### Filter Users by Directory

```bash
curl https://api.workos.com/directory_users?directory=directory_01H8675JXCN8Q2TYZ9XYZ123 \
  -H "Authorization: Bearer sk_your_api_key"
```

### Filter Groups by Directory

```bash
curl https://api.workos.com/directory_groups?directory=directory_01H8675JXCN8Q2TYZ9XYZ123 \
  -H "Authorization: Bearer sk_your_api_key"
```

### Filter by Organization

```bash
curl https://api.workos.com/directories?organization_id=org_01H8675JXCN8Q2TYZ9XYZ000 \
  -H "Authorization: Bearer sk_your_api_key"
```

## Error Codes and Resolution

### 401 Unauthorized
**Cause:** Invalid or missing API key
**Fix:** Verify `Authorization: Bearer sk_...` header is present and key is valid

### 404 Not Found
**Cause:** Resource ID does not exist or belongs to another organization
**Fix:** Verify the ID is correct and belongs to your organization

### 422 Unprocessable Entity
**Cause:** Invalid query parameters (e.g., invalid `directory` ID format)
**Fix:** Check parameter format matches WorkOS ID patterns (`directory_...`, `org_...`)

### 429 Too Many Requests
**Cause:** Rate limit exceeded
**Fix:** Implement exponential backoff. Wait time is in `Retry-After` header

### 500 Internal Server Error
**Cause:** WorkOS service issue
**Fix:** Retry with exponential backoff. Check https://status.workos.com for incidents

## Rate Limits

WorkOS enforces rate limits on API requests:
- Default: 1000 requests per minute per API key
- Retry after receiving 429 using the `Retry-After` header value
- Implement exponential backoff for failed requests

## Runnable Verification Commands

### Verify API Key

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with list of directories or empty array

### Verify Directory Connection

```bash
curl https://api.workos.com/directories/directory_01H8675JXCN8Q2TYZ9XYZ123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 OK with directory object containing `state: "linked"`

### List Users in Directory

```bash
curl https://api.workos.com/directory_users?directory=directory_01H8675JXCN8Q2TYZ9XYZ123&limit=5 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 OK with array of user objects

### Test Pagination

```bash
# First page
curl https://api.workos.com/directory_users?directory=directory_01H8675JXCN8Q2TYZ9XYZ123&limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -r '.list_metadata.after'

# Use the cursor for next page
curl "https://api.workos.com/directory_users?directory=directory_01H8675JXCN8Q2TYZ9XYZ123&limit=1&after=<cursor_from_previous>" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Webhook Integration

Directory Sync sends webhooks for real-time updates. Events are NOT available via polling — webhook setup is required for:

- `dsync.user.created`
- `dsync.user.updated`
- `dsync.user.deleted`
- `dsync.group.created`
- `dsync.group.updated`
- `dsync.group.deleted`

Reference: https://workos.com/docs/reference/directory-sync for webhook configuration.

## Common Patterns

### Get All Users for an Organization

```bash
# Step 1: List directories for organization
DIRS=$(curl https://api.workos.com/directories?organization_id=org_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -r '.data[].id')

# Step 2: Fetch users from each directory
for DIR in $DIRS; do
  curl "https://api.workos.com/directory_users?directory=$DIR" \
    -H "Authorization: Bearer $WORKOS_API_KEY"
done
```

### Check Directory Health

```bash
curl https://api.workos.com/directories/directory_01H8675JXCN8Q2TYZ9XYZ123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.state'
```

Expected states: `linked`, `unlinked`, `invalid_credentials`

## Related Skills

- **workos-directory-sync** — Feature overview and setup guide
- **workos-api-events** — Webhook event handling
- **workos-api-organization** — Organization management
- **workos-admin-portal** — Self-service directory configuration
