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

All Directory Sync API calls require authentication via the `Authorization` header:

```
Authorization: Bearer sk_your_api_key
```

Set this header on every request. The API key must start with `sk_` and have Directory Sync permissions enabled in the WorkOS Dashboard.

## Endpoint Catalog

| Operation        | Method | Endpoint                 | Purpose                                   |
| ---------------- | ------ | ------------------------ | ----------------------------------------- |
| List Directories | GET    | `/directories`           | Get all directories for your organization |
| Get Directory    | GET    | `/directories/{id}`      | Fetch a single directory by ID            |
| Delete Directory | DELETE | `/directories/{id}`      | Remove a directory connection             |
| List Users       | GET    | `/directory_users`       | Get users from one or all directories     |
| Get User         | GET    | `/directory_users/{id}`  | Fetch a single user by ID                 |
| List Groups      | GET    | `/directory_groups`      | Get groups from one or all directories    |
| Get Group        | GET    | `/directory_groups/{id}` | Fetch a single group by ID                |

## Operation Decision Tree

**To query directory data:**

1. If you need all directories → `GET /directories`
2. If you have a specific directory ID → `GET /directories/{id}`
3. If you need to remove a directory → `DELETE /directories/{id}`

**To query users:**

1. If you need all users across all directories → `GET /directory_users`
2. If you need users from a specific directory → `GET /directory_users?directory={directory_id}`
3. If you have a specific user ID → `GET /directory_users/{id}`

**To query groups:**

1. If you need all groups across all directories → `GET /directory_groups`
2. If you need groups from a specific directory → `GET /directory_groups?directory={directory_id}`
3. If you have a specific group ID → `GET /directory_groups/{id}`

## Request/Response Patterns

### List Directories

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer sk_your_api_key"
```

Response structure:

```json
{
  "data": [
    {
      "id": "directory_01ECAZ4NV9QMV47GW873HDCX74",
      "name": "Acme Corp Directory",
      "organization_id": "org_01EZTR6WYX1A0DSE2CYMGXQ24Y",
      "state": "active",
      "type": "okta scim v2.0",
      "created_at": "2021-06-25T19:07:33.155Z",
      "updated_at": "2021-06-25T19:07:33.155Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": null
  }
}
```

### List Users (with filtering)

```bash
curl "https://api.workos.com/directory_users?directory=directory_01ECAZ4NV9QMV47GW873HDCX74" \
  -H "Authorization: Bearer sk_your_api_key"
```

Response structure:

```json
{
  "data": [
    {
      "id": "directory_user_01E1JG7J09H96KYP8HM9B0G5SJ",
      "directory_id": "directory_01ECAZ4NV9QMV47GW873HDCX74",
      "organization_id": "org_01EZTR6WYX1A0DSE2CYMGXQ24Y",
      "idp_id": "00u1e8mutl6wlH3lL4x7",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "marcelina@foo-corp.com"
        }
      ],
      "first_name": "Marcelina",
      "last_name": "Davis",
      "username": "marcelina@foo-corp.com",
      "state": "active",
      "created_at": "2021-06-25T19:07:33.155Z",
      "updated_at": "2021-06-25T19:07:33.155Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_user_01E1JG7J09H96KYP8HM9B0G5SJ"
  }
}
```

### Get Single Resource

```bash
curl https://api.workos.com/directory_groups/directory_group_01E1JG7J09H96KYP8HM9B0G5SJ \
  -H "Authorization: Bearer sk_your_api_key"
```

Response structure:

```json
{
  "id": "directory_group_01E1JG7J09H96KYP8HM9B0G5SJ",
  "directory_id": "directory_01ECAZ4NV9QMV47GW873HDCX74",
  "organization_id": "org_01EZTR6WYX1A0DSE2CYMGXQ24Y",
  "idp_id": "00g1e8mutl6wlH3lL4x7",
  "name": "Engineering",
  "created_at": "2021-06-25T19:07:33.155Z",
  "updated_at": "2021-06-25T19:07:33.155Z"
}
```

## Pagination Handling

List endpoints (`/directories`, `/directory_users`, `/directory_groups`) support cursor-based pagination:

- **Default page size:** 10 records
- **Max page size:** 100 records (set via `?limit=100`)
- **Next page:** Use `list_metadata.after` value in `?after={cursor}` parameter
- **Previous page:** Use `list_metadata.before` value in `?before={cursor}` parameter

Example pagination flow:

```bash
# First page
curl "https://api.workos.com/directory_users?limit=10" \
  -H "Authorization: Bearer sk_your_api_key"

# Next page (use 'after' cursor from response)
curl "https://api.workos.com/directory_users?limit=10&after=directory_user_01E1JG7J09H96KYP8HM9B0G5SJ" \
  -H "Authorization: Bearer sk_your_api_key"
```

**Pagination best practice:** Store the `after` cursor from each response to fetch the next page. Stop when `list_metadata.after` is `null`.

## Error Code Mapping

| HTTP Status               | Cause                                         | Fix                                                                       |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| 401 Unauthorized          | API key missing or invalid                    | Verify `Authorization: Bearer sk_...` header is set correctly             |
| 401 Unauthorized          | API key lacks Directory Sync permission       | Enable Directory Sync in WorkOS Dashboard for this API key                |
| 404 Not Found             | Resource ID doesn't exist                     | Verify the directory/user/group ID. List resources first to get valid IDs |
| 404 Not Found             | Directory ID in query parameter doesn't exist | Use `GET /directories` to confirm the directory ID is valid               |
| 422 Unprocessable Entity  | Invalid query parameter format                | Check that `limit` is a number, `directory` is a valid ID format          |
| 429 Too Many Requests     | Rate limit exceeded                           | Implement exponential backoff. Wait 60 seconds before retrying            |
| 500 Internal Server Error | WorkOS API issue                              | Retry with exponential backoff. Contact support if persists               |

**Not generic retry logic:** For 401 errors, retrying won't help — fix authentication first. For 404 errors, verify the resource exists before retrying.

## Rate Limits

- **Default limit:** 600 requests per minute per API key
- **Burst limit:** Short bursts above the rate are tolerated
- **Response header:** `X-RateLimit-Remaining` shows remaining quota

**Rate limit strategy:**

1. Track `X-RateLimit-Remaining` in responses
2. If you hit 429, wait 60 seconds before retrying
3. For bulk operations, add 100ms delay between requests
4. Use pagination to avoid fetching all records at once

## Runnable Verification Commands

### Verify API Key Works

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with `{"data": [...], "list_metadata": {...}}`

### Verify Directory Exists

```bash
curl https://api.workos.com/directories/directory_01ECAZ4NV9QMV47GW873HDCX74 \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with directory object OR HTTP 404 if ID is invalid

### Verify User Listing Works

```bash
curl "https://api.workos.com/directory_users?limit=5" \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with up to 5 users in `data` array

### Verify Group Filtering Works

```bash
curl "https://api.workos.com/directory_groups?directory=directory_01ECAZ4NV9QMV47GW873HDCX74" \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with groups from specified directory OR HTTP 404 if directory doesn't exist

## SDK Usage Patterns

The WorkOS SDK provides idiomatic methods for each endpoint. After fetching the documentation in Step 1, use these patterns:

**Node.js SDK:**

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List directories
const directories = await workos.directorySync.listDirectories();

// List users from a specific directory
const users = await workos.directorySync.listUsers({
  directory: "directory_01ECAZ4NV9QMV47GW873HDCX74",
});

// Get a single user
const user = await workos.directorySync.getUser({
  user: "directory_user_01E1JG7J09H96KYP8HM9B0G5SJ",
});
```

**Python SDK:**

```python
from workos import WorkOSClient
workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# List directories
directories = workos.directory_sync.list_directories()

# List users from a specific directory
users = workos.directory_sync.list_users(
    directory='directory_01ECAZ4NV9QMV47GW873HDCX74'
)

# Get a single user
user = workos.directory_sync.get_user(
    user='directory_user_01E1JG7J09H96KYP8HM9B0G5SJ'
)
```

For exact SDK method signatures and additional parameters, check the fetched documentation URLs.

## Related Skills

- `workos-directory-sync.rules.yml` — Feature guide for setting up Directory Sync (webhooks, provisioning flows, dashboard config)
