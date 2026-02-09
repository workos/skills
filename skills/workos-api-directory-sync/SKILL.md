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

_Review these docs to understand current endpoint specifications, request/response formats, and authentication requirements._

## Authentication Setup

Authenticate all API requests using Bearer token authentication:

```bash
Authorization: Bearer sk_your_api_key
```

Set the `WORKOS_API_KEY` environment variable with your API key from the WorkOS Dashboard. The key must start with `sk_` prefix.

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/directories` | List all directories |
| GET | `/directories/{directory_id}` | Get a specific directory |
| DELETE | `/directories/{directory_id}` | Delete a directory |
| GET | `/directory_users` | List directory users with filtering |
| GET | `/directory_users/{user_id}` | Get a specific user |
| GET | `/directory_groups` | List directory groups with filtering |
| GET | `/directory_groups/{group_id}` | Get a specific group |

## Operation Decision Tree

**To list all directories in your organization:**
- Use `GET /directories`
- No required parameters
- Returns paginated list of directories

**To get details about a specific directory:**
- Use `GET /directories/{directory_id}`
- Required: `directory_id` path parameter

**To list users from a directory:**
- Use `GET /directory_users?directory={directory_id}`
- Required query parameter: `directory` (directory ID)
- Optional filters: `group`, `limit`, `before`, `after`

**To get a specific user:**
- Use `GET /directory_users/{user_id}`
- Required: `user_id` path parameter

**To list groups from a directory:**
- Use `GET /directory_groups?directory={directory_id}`
- Required query parameter: `directory` (directory ID)
- Optional filters: `user`, `limit`, `before`, `after`

**To get a specific group:**
- Use `GET /directory_groups/{group_id}`
- Required: `group_id` path parameter

**To remove a directory:**
- Use `DELETE /directories/{directory_id}`
- Required: `directory_id` path parameter
- Returns 202 Accepted on success

## Request/Response Patterns

### List Directory Users

**Request:**
```bash
GET https://api.workos.com/directory_users?directory=directory_01E1X2Y3Z4
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "directory_user_01E1X2Y3Z4",
      "directory_id": "directory_01E1X2Y3Z4",
      "organization_id": "org_01E1X2Y3Z4",
      "idp_id": "user@example.com",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "user@example.com"
        }
      ],
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "jdoe",
      "state": "active",
      "created_at": "2021-01-01T00:00:00.000Z",
      "updated_at": "2021-01-01T00:00:00.000Z"
    }
  ],
  "list_metadata": {
    "before": "directory_user_01E1X2Y3Z4",
    "after": "directory_user_01E1X2Y3Z5"
  }
}
```

### Get Directory User

**Request:**
```bash
GET https://api.workos.com/directory_users/directory_user_01E1X2Y3Z4
```

**Response (200 OK):**
```json
{
  "id": "directory_user_01E1X2Y3Z4",
  "directory_id": "directory_01E1X2Y3Z4",
  "organization_id": "org_01E1X2Y3Z4",
  "idp_id": "user@example.com",
  "emails": [
    {
      "primary": true,
      "type": "work",
      "value": "user@example.com"
    }
  ],
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "jdoe",
  "state": "active",
  "created_at": "2021-01-01T00:00:00.000Z",
  "updated_at": "2021-01-01T00:00:00.000Z"
}
```

### List Directory Groups

**Request:**
```bash
GET https://api.workos.com/directory_groups?directory=directory_01E1X2Y3Z4
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "directory_group_01E1X2Y3Z4",
      "directory_id": "directory_01E1X2Y3Z4",
      "organization_id": "org_01E1X2Y3Z4",
      "idp_id": "group-id-123",
      "name": "Engineering",
      "created_at": "2021-01-01T00:00:00.000Z",
      "updated_at": "2021-01-01T00:00:00.000Z"
    }
  ],
  "list_metadata": {
    "before": "directory_group_01E1X2Y3Z4",
    "after": "directory_group_01E1X2Y3Z5"
  }
}
```

### Delete Directory

**Request:**
```bash
DELETE https://api.workos.com/directories/directory_01E1X2Y3Z4
```

**Response (202 Accepted):**
```json
{
  "message": "Directory deletion initiated"
}
```

## Pagination Handling

All list endpoints use cursor-based pagination with `before` and `after` parameters:

**First page:**
```bash
GET /directory_users?directory=directory_01E1X2Y3Z4&limit=10
```

**Next page:**
```bash
GET /directory_users?directory=directory_01E1X2Y3Z4&after=directory_user_01E1X2Y3Z5&limit=10
```

**Previous page:**
```bash
GET /directory_users?directory=directory_01E1X2Y3Z4&before=directory_user_01E1X2Y3Z4&limit=10
```

The `list_metadata` object in responses contains the cursor values for navigation. Default limit is 10, maximum is 100.

## Error Code Mapping

| Status Code | Cause | Fix |
|------------|-------|-----|
| 400 Bad Request | Missing required query parameter (e.g., `directory`) | Include required `directory` parameter in query string |
| 401 Unauthorized | Missing or invalid API key | Set valid `Authorization: Bearer sk_xxx` header |
| 403 Forbidden | API key lacks permissions | Check API key permissions in WorkOS Dashboard |
| 404 Not Found | Invalid directory_id, user_id, or group_id | Verify the resource ID exists using list endpoints |
| 422 Unprocessable Entity | Invalid parameter format (e.g., malformed ID) | Check parameter values match expected format (e.g., `directory_01XXX`) |
| 429 Too Many Requests | Rate limit exceeded | Implement exponential backoff; check `Retry-After` header |
| 500 Internal Server Error | WorkOS service issue | Retry with exponential backoff; contact support if persists |

## Rate Limiting

WorkOS enforces rate limits on API requests. When you hit a limit, the API returns:

- Status: `429 Too Many Requests`
- Header: `Retry-After: {seconds}`

Implement exponential backoff starting at 1 second, doubling on each retry, with a maximum of 5 retries.

## Runnable Verification

### Verify authentication works:
```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with JSON list of directories

### List users from a directory:
```bash
curl -X GET "https://api.workos.com/directory_users?directory=directory_01E1X2Y3Z4" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with paginated user list

### Get a specific user:
```bash
curl -X GET https://api.workos.com/directory_users/directory_user_01E1X2Y3Z4 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with user object

### List groups from a directory:
```bash
curl -X GET "https://api.workos.com/directory_groups?directory=directory_01E1X2Y3Z4" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with paginated group list

### Test pagination:
```bash
curl -X GET "https://api.workos.com/directory_users?directory=directory_01E1X2Y3Z4&limit=2" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with 2 users and `list_metadata` containing `after` cursor

## Common Integration Patterns

### Syncing all users from a directory

```bash
# 1. Get directory ID from your database or list directories
DIRECTORY_ID="directory_01E1X2Y3Z4"

# 2. Fetch first page
RESPONSE=$(curl -s -X GET "https://api.workos.com/directory_users?directory=${DIRECTORY_ID}&limit=100" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}")

# 3. Extract after cursor and continue pagination
AFTER=$(echo $RESPONSE | jq -r '.list_metadata.after')

# 4. Fetch next page
curl -X GET "https://api.workos.com/directory_users?directory=${DIRECTORY_ID}&after=${AFTER}&limit=100" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Filtering users by group membership

```bash
# Use the group parameter to get only users in a specific group
curl -X GET "https://api.workos.com/directory_users?directory=directory_01E1X2Y3Z4&group=directory_group_01E1X2Y3Z4" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Filtering groups by user membership

```bash
# Use the user parameter to get only groups containing a specific user
curl -X GET "https://api.workos.com/directory_groups?directory=directory_01E1X2Y3Z4&user=directory_user_01E1X2Y3Z4" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## SDK Usage Examples

If using the WorkOS SDK instead of direct HTTP calls, initialize the client:

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List users
const users = await workos.directorySync.listUsers({
  directory: 'directory_01E1X2Y3Z4',
  limit: 100
});

// Get a user
const user = await workos.directorySync.getUser({
  userId: 'directory_user_01E1X2Y3Z4'
});

// List groups
const groups = await workos.directorySync.listGroups({
  directory: 'directory_01E1X2Y3Z4'
});
```

Check the fetched documentation for SDK method signatures and options specific to your language.

## Related Skills

- **workos-directory-sync** - Feature overview and setup for Directory Sync integration
- **workos-api-organizations** - Managing organizations that directories belong to
- **workos-webhooks** - Receiving real-time directory sync events (user/group changes)

## Troubleshooting

### "Missing required parameter: directory"
You must include the `directory` query parameter when listing users or groups. Get the directory ID from `GET /directories` first.

### "Resource not found" for user/group IDs
Directory user and group IDs change when directories are re-synced. Always fetch fresh lists rather than caching IDs long-term, or use webhooks to stay updated.

### Empty user/group lists
Verify the directory has completed initial sync. Check directory state via `GET /directories/{directory_id}`. If state is not `linked`, the directory may still be provisioning.

### Authentication failures
Ensure your API key starts with `sk_` and is set in the `Authorization: Bearer` header. Test with `GET /directories` to verify credentials work.
