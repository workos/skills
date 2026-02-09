---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- generated -->

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

## Authentication Setup

Set the API key in Authorization header:

```bash
Authorization: Bearer sk_test_1234567890
```

All requests require authentication. Get your API key from the WorkOS Dashboard.

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/directories` | List all directories |
| GET | `/directories/{directory_id}` | Get single directory |
| DELETE | `/directories/{directory_id}` | Delete directory |
| GET | `/directory_users` | List users in directory |
| GET | `/directory_users/{user_id}` | Get single user |
| GET | `/directory_groups` | List groups in directory |
| GET | `/directory_groups/{group_id}` | Get single group |

Base URL: `https://api.workos.com`

## Operation Decision Tree

**List all directories in organization:**
- Use `GET /directories?organization={org_id}`

**Get details of specific directory:**
- Use `GET /directories/{directory_id}`

**List users from a directory:**
- Use `GET /directory_users?directory={directory_id}`
- Add `?limit=` for pagination

**Find specific user:**
- Use `GET /directory_users/{user_id}` if you have the ID
- Use `GET /directory_users?directory={dir_id}&email={email}` to search

**List groups in directory:**
- Use `GET /directory_groups?directory={directory_id}`

**Get group details:**
- Use `GET /directory_groups/{group_id}`

**Remove directory connection:**
- Use `DELETE /directories/{directory_id}`

## Request/Response Patterns

### List Directories

```bash
curl https://api.workos.com/directories?organization=org_123 \
  -H "Authorization: Bearer sk_test_1234567890"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_123",
      "organization_id": "org_123",
      "state": "active",
      "type": "okta scim v2.0",
      "name": "Acme Corp Directory",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_456"
  }
}
```

### Get Directory

```bash
curl https://api.workos.com/directories/directory_123 \
  -H "Authorization: Bearer sk_test_1234567890"
```

Response:
```json
{
  "id": "directory_123",
  "organization_id": "org_123",
  "state": "active",
  "type": "okta scim v2.0",
  "name": "Acme Corp Directory",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### List Users

```bash
curl "https://api.workos.com/directory_users?directory=directory_123&limit=10" \
  -H "Authorization: Bearer sk_test_1234567890"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_user_123",
      "directory_id": "directory_123",
      "organization_id": "org_123",
      "idp_id": "00u1abc2def3ghi4jkl",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "user@acme.com"
        }
      ],
      "first_name": "Jane",
      "last_name": "Doe",
      "state": "active",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_user_456"
  }
}
```

### Get User

```bash
curl https://api.workos.com/directory_users/directory_user_123 \
  -H "Authorization: Bearer sk_test_1234567890"
```

### List Groups

```bash
curl "https://api.workos.com/directory_groups?directory=directory_123&limit=10" \
  -H "Authorization: Bearer sk_test_1234567890"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_group_123",
      "directory_id": "directory_123",
      "organization_id": "org_123",
      "idp_id": "00g1abc2def3ghi4jkl",
      "name": "Engineering",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_group_456"
  }
}
```

### Delete Directory

```bash
curl -X DELETE https://api.workos.com/directories/directory_123 \
  -H "Authorization: Bearer sk_test_1234567890"
```

Returns 204 No Content on success.

## Pagination Handling

WorkOS uses cursor-based pagination with `before` and `after` parameters:

**First page:**
```bash
GET /directory_users?directory=directory_123&limit=10
```

**Next page:**
```bash
GET /directory_users?directory=directory_123&limit=10&after=directory_user_456
```

**Previous page:**
```bash
GET /directory_users?directory=directory_123&limit=10&before=directory_user_789
```

The `list_metadata` object in responses contains cursor values:
- `after`: cursor for next page (null if no more results)
- `before`: cursor for previous page (null if on first page)

Default limit: 10. Maximum limit: 100.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Check Authorization header contains valid `Bearer sk_*` token |
| 403 | API key lacks permissions | Verify API key has Directory Sync read permissions in Dashboard |
| 404 | Directory/user/group not found | Verify ID exists with list endpoint first |
| 422 | Invalid query parameters | Check `directory` parameter is valid directory ID |
| 422 | Invalid limit value | Use limit between 1-100 |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s, double each retry) |
| 500 | WorkOS service error | Retry with exponential backoff, contact support if persists |
| 503 | Service temporarily unavailable | Retry after 30 seconds |

**Specific error responses:**

Missing directory parameter:
```json
{
  "error": "invalid_request",
  "error_description": "directory parameter is required",
  "code": "invalid_request"
}
```

Invalid directory ID:
```json
{
  "error": "not_found",
  "error_description": "Directory not found",
  "code": "not_found"
}
```

## Runnable Verification

### Test 1: Verify API Key Works

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 status with directory list or empty array.

### Test 2: List Users in Known Directory

```bash
# Replace with actual directory_id from Test 1
curl "https://api.workos.com/directory_users?directory=directory_123&limit=5" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 status with user list.

### Test 3: Get Specific User

```bash
# Replace with actual user_id from Test 2
curl https://api.workos.com/directory_users/directory_user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 status with user object.

### Test 4: List Groups

```bash
curl "https://api.workos.com/directory_groups?directory=directory_123&limit=5" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 status with group list.

### Test 5: Verify Error Handling

```bash
curl https://api.workos.com/directory_users/invalid_id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 404 status with error message.

## Rate Limits

- Default rate limit: 600 requests per minute per API key
- Rate limit headers returned in responses:
  - `X-RateLimit-Limit`: total requests allowed
  - `X-RateLimit-Remaining`: requests remaining
  - `X-RateLimit-Reset`: timestamp when limit resets

**Retry strategy:**
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## Common Query Patterns

**Filter users by email:**
```bash
curl "https://api.workos.com/directory_users?directory=directory_123&email=user@acme.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Get all active users:**
```bash
curl "https://api.workos.com/directory_users?directory=directory_123&state=active" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**List directories for organization:**
```bash
curl "https://api.workos.com/directories?organization=org_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Search groups by name:**
```bash
curl "https://api.workos.com/directory_groups?directory=directory_123&name=Engineering" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## User State Values

Directory users can have these states:
- `active`: user is active and provisioned
- `inactive`: user is deprovisioned but data retained
- `suspended`: user temporarily disabled

Filter by state in list requests:
```bash
curl "https://api.workos.com/directory_users?directory=directory_123&state=active" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Related Skills

- `workos-directory-sync` - Feature overview and integration guide for Directory Sync
