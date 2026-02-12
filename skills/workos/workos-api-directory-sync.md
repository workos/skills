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

## Authentication Setup

All Directory Sync API calls require authentication via API key in the Authorization header:

```bash
Authorization: Bearer sk_example_123456789
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_example_123456789"
```

## Endpoint Catalog

| Method | Path                    | Purpose                        |
| ------ | ----------------------- | ------------------------------ |
| GET    | `/directories`          | List all directories           |
| GET    | `/directories/:id`      | Get single directory by ID     |
| DELETE | `/directories/:id`      | Delete a directory             |
| GET    | `/directory_users`      | List users across directories  |
| GET    | `/directory_users/:id`  | Get single user by ID          |
| GET    | `/directory_groups`     | List groups across directories |
| GET    | `/directory_groups/:id` | Get single group by ID         |

Base URL: `https://api.workos.com`

## Operation Decision Tree

### When to use which endpoint

**Listing all directories for an organization:**

- Use `GET /directories` with `organization_id` parameter

**Getting directory details:**

- Use `GET /directories/:id` when you have the directory ID

**Syncing users:**

- Use `GET /directory_users` to list users
- Filter by `directory_id` to get users from a specific directory
- Use `GET /directory_users/:id` to get individual user details

**Syncing groups:**

- Use `GET /directory_groups` to list groups
- Filter by `directory_id` to get groups from a specific directory
- Use `GET /directory_groups/:id` to get individual group details

**Cleanup operations:**

- Use `DELETE /directories/:id` to remove a directory connection

## Request/Response Patterns

### List Directories

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -G \
  -d "organization_id=org_123"
```

**Response:**

```json
{
  "data": [
    {
      "id": "directory_123",
      "organization_id": "org_123",
      "name": "Acme Corp Directory",
      "type": "azure scim v2.0",
      "state": "linked",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
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
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Response:**

```json
{
  "id": "directory_123",
  "organization_id": "org_123",
  "name": "Acme Corp Directory",
  "type": "azure scim v2.0",
  "state": "linked",
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### List Directory Users

```bash
curl https://api.workos.com/directory_users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "directory_id=directory_123" \
  -d "limit=10"
```

**Response:**

```json
{
  "data": [
    {
      "id": "directory_user_123",
      "directory_id": "directory_123",
      "organization_id": "org_123",
      "idp_id": "azure_user_456",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "user@example.com"
        }
      ],
      "first_name": "Jane",
      "last_name": "Doe",
      "username": "jane.doe@example.com",
      "state": "active",
      "custom_attributes": {},
      "raw_attributes": {},
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_user_456"
  }
}
```

### Get Directory User

```bash
curl https://api.workos.com/directory_users/directory_user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### List Directory Groups

```bash
curl https://api.workos.com/directory_groups \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "directory_id=directory_123" \
  -d "limit=10"
```

**Response:**

```json
{
  "data": [
    {
      "id": "directory_group_123",
      "directory_id": "directory_123",
      "organization_id": "org_123",
      "idp_id": "azure_group_456",
      "name": "Engineering",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z",
      "raw_attributes": {}
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "directory_group_456"
  }
}
```

### Get Directory Group

```bash
curl https://api.workos.com/directory_groups/directory_group_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Delete Directory

```bash
curl -X DELETE https://api.workos.com/directories/directory_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Response:** `204 No Content` on success

## Pagination Handling

Directory Sync API uses cursor-based pagination via the `before` and `after` parameters.

**Pattern:**

1. Initial request returns `list_metadata` with `after` cursor
2. Pass `after` cursor value to `after` parameter for next page
3. Continue until `after` is `null`

**Example:**

```bash
# Page 1
curl "https://api.workos.com/directory_users?directory_id=directory_123&limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Page 2 (using after cursor from page 1 response)
curl "https://api.workos.com/directory_users?directory_id=directory_123&limit=10&after=directory_user_456" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Default limit:** 10 records per page  
**Maximum limit:** Check fetched docs for current maximum

## Error Code Mapping

| Status Code               | Cause                                              | Fix                                                                                                                    |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 400 Bad Request           | Invalid parameter format (e.g., malformed ID)      | Verify parameter values match expected format (directory IDs start with `directory_`, user IDs with `directory_user_`) |
| 401 Unauthorized          | Missing or invalid API key                         | Check `WORKOS_API_KEY` is set and starts with `sk_`                                                                    |
| 403 Forbidden             | API key lacks required permissions                 | Verify API key has Directory Sync read permissions in WorkOS Dashboard                                                 |
| 404 Not Found             | Directory, user, or group ID doesn't exist         | Verify the resource ID exists by listing resources first                                                               |
| 422 Unprocessable Entity  | Invalid `organization_id` or `directory_id` filter | Ensure organization/directory exists and you have access                                                               |
| 429 Too Many Requests     | Rate limit exceeded                                | Implement exponential backoff with initial delay of 1 second                                                           |
| 500 Internal Server Error | WorkOS service issue                               | Retry with exponential backoff; check status.workos.com                                                                |
| 503 Service Unavailable   | WorkOS service temporarily unavailable             | Retry after delay specified in `Retry-After` header                                                                    |

## Rate Limits

**Limit:** Check fetched documentation for current rate limits  
**Retry strategy:** Implement exponential backoff starting at 1 second, max 5 retries  
**Headers to check:**

- `X-RateLimit-Limit`: Total requests allowed per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## SDK Usage Patterns

### Node.js

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List directories
const { data: directories } = await workos.directorySync.listDirectories({
  organizationId: "org_123",
});

// Get directory
const directory = await workos.directorySync.getDirectory("directory_123");

// List users
const { data: users } = await workos.directorySync.listUsers({
  directory: "directory_123",
  limit: 10,
});

// Get user
const user = await workos.directorySync.getUser("directory_user_123");

// List groups
const { data: groups } = await workos.directorySync.listGroups({
  directory: "directory_123",
  limit: 10,
});

// Get group
const group = await workos.directorySync.getGroup("directory_group_123");

// Delete directory
await workos.directorySync.deleteDirectory("directory_123");
```

### Python

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# List directories
directories = workos.directory_sync.list_directories(
    organization_id='org_123'
)

# Get directory
directory = workos.directory_sync.get_directory('directory_123')

# List users
users = workos.directory_sync.list_users(
    directory='directory_123',
    limit=10
)

# Get user
user = workos.directory_sync.get_user('directory_user_123')

# List groups
groups = workos.directory_sync.list_groups(
    directory='directory_123',
    limit=10
)

# Get group
group = workos.directory_sync.get_group('directory_group_123')

# Delete directory
workos.directory_sync.delete_directory('directory_123')
```

## Runnable Verification

**Test 1: List directories for organization**

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "organization_id=YOUR_ORG_ID"
```

Expected: 200 OK with array of directories

**Test 2: Get specific directory**

```bash
curl https://api.workos.com/directories/YOUR_DIRECTORY_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 OK with directory object

**Test 3: List users from directory**

```bash
curl https://api.workos.com/directory_users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "directory_id=YOUR_DIRECTORY_ID"
```

Expected: 200 OK with paginated user list

**Test 4: List groups from directory**

```bash
curl https://api.workos.com/directory_groups \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "directory_id=YOUR_DIRECTORY_ID"
```

Expected: 200 OK with paginated group list

**Test 5: Invalid API key handling**

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer invalid_key"
```

Expected: 401 Unauthorized

## Common Integration Patterns

### Sync users on schedule

```javascript
async function syncUsers(directoryId) {
  let after = null;
  const allUsers = [];

  do {
    const response = await workos.directorySync.listUsers({
      directory: directoryId,
      limit: 100,
      after: after,
    });

    allUsers.push(...response.data);
    after = response.listMetadata.after;
  } while (after !== null);

  // Process allUsers (e.g., update local database)
  for (const user of allUsers) {
    await updateLocalUser(user);
  }
}
```

### Filter active users only

```javascript
const { data: users } = await workos.directorySync.listUsers({
  directory: "directory_123",
});

const activeUsers = users.filter((user) => user.state === "active");
```

### Get user's group memberships

Groups contain member references. To get a user's groups, list all groups and filter:

```javascript
const { data: groups } = await workos.directorySync.listGroups({
  directory: "directory_123",
});

// Check group membership via webhooks or raw_attributes
// The Directory Sync API doesn't expose direct user->groups relationships
// Use directory.user_updated webhooks to track group membership changes
```

## Related Skills

- workos-directory-sync (feature overview and webhook handling)
