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

Set the API key as a bearer token in the Authorization header:

```bash
Authorization: Bearer sk_live_...
```

All Directory Sync API endpoints require authentication. Use your WorkOS API key from the Dashboard.

## Base URL

```
https://api.workos.com
```

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directories` | List all directories for an organization |
| GET | `/directories/:id` | Get a single directory by ID |
| DELETE | `/directories/:id` | Delete a directory connection |
| GET | `/directory_users` | List users from directories |
| GET | `/directory_users/:id` | Get a single directory user |
| GET | `/directory_groups` | List groups from directories |
| GET | `/directory_groups/:id` | Get a single directory group |

## Operation Decision Tree

**To read organization directory state:**
- Use `GET /directories` to list all connected directories
- Use `GET /directories/:id` to check a specific directory's status

**To read user data:**
- Use `GET /directory_users` with `directory` or `organization` filter to list users
- Use `GET /directory_users/:id` to get a specific user's details
- Include `?groups=true` parameter to fetch user's group memberships

**To read group data:**
- Use `GET /directory_groups` with `directory` or `organization` filter to list groups
- Use `GET /directory_groups/:id` to get a specific group's details
- Include `?members=true` parameter to fetch group member list

**To remove a directory connection:**
- Use `DELETE /directories/:id` (this does NOT delete users/groups from provider)

## Request Patterns

### List Directories

```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer sk_live_..." \
  -G \
  --data-urlencode "organization=org_01H..." \
  --data-urlencode "limit=10"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_01H...",
      "organization_id": "org_01H...",
      "name": "Acme Corp Directory",
      "type": "azure scim v2.0",
      "state": "linked",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "directory_01H...",
    "before": null
  }
}
```

### List Directory Users

```bash
curl https://api.workos.com/directory_users \
  -H "Authorization: Bearer sk_live_..." \
  -G \
  --data-urlencode "directory=directory_01H..." \
  --data-urlencode "groups=true" \
  --data-urlencode "limit=100"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_user_01H...",
      "directory_id": "directory_01H...",
      "organization_id": "org_01H...",
      "idp_id": "12345",
      "username": "user@example.com",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "user@example.com"
        }
      ],
      "first_name": "Jane",
      "last_name": "Doe",
      "state": "active",
      "custom_attributes": {},
      "groups": [
        {
          "id": "directory_group_01H...",
          "name": "Engineering"
        }
      ],
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "directory_user_01H...",
    "before": null
  }
}
```

### Get Directory User

```bash
curl https://api.workos.com/directory_users/directory_user_01H... \
  -H "Authorization: Bearer sk_live_..."
```

### List Directory Groups

```bash
curl https://api.workos.com/directory_groups \
  -H "Authorization: Bearer sk_live_..." \
  -G \
  --data-urlencode "directory=directory_01H..." \
  --data-urlencode "members=true" \
  --data-urlencode "limit=100"
```

Response:
```json
{
  "data": [
    {
      "id": "directory_group_01H...",
      "directory_id": "directory_01H...",
      "organization_id": "org_01H...",
      "idp_id": "group-123",
      "name": "Engineering",
      "members": [
        {
          "id": "directory_user_01H...",
          "first_name": "Jane",
          "last_name": "Doe"
        }
      ],
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "directory_group_01H...",
    "before": null
  }
}
```

### Delete Directory

```bash
curl -X DELETE https://api.workos.com/directories/directory_01H... \
  -H "Authorization: Bearer sk_live_..."
```

Response: `204 No Content`

## Pagination Handling

All list endpoints use cursor-based pagination:

1. Initial request returns `list_metadata.after` cursor
2. To fetch next page, pass `after` parameter with the cursor value
3. Continue until `list_metadata.after` is `null`

Example pagination loop:
```bash
# Page 1
curl "https://api.workos.com/directory_users?directory=directory_01H...&limit=100" \
  -H "Authorization: Bearer sk_live_..."

# Page 2 (use cursor from page 1)
curl "https://api.workos.com/directory_users?directory=directory_01H...&limit=100&after=directory_user_01H..." \
  -H "Authorization: Bearer sk_live_..."
```

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Check `Authorization: Bearer sk_live_...` header is present and correct |
| 404 | Directory, user, or group ID not found | Verify the resource ID exists via list endpoint first |
| 422 | Invalid parameter value | Check parameter format (e.g., `directory` must be `directory_*`, `organization` must be `org_*`) |
| 429 | Rate limit exceeded (10 requests/second) | Implement exponential backoff starting at 1 second |
| 500 | WorkOS server error | Retry with exponential backoff; if persists, contact support |

### Rate Limit Headers

WorkOS returns these headers on all API responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995200
```

When `X-RateLimit-Remaining` reaches 0, wait until `X-RateLimit-Reset` timestamp before retrying.

## Filtering Patterns

### By Organization
```bash
curl "https://api.workos.com/directory_users?organization=org_01H..." \
  -H "Authorization: Bearer sk_live_..."
```
Returns users across ALL directories for that organization.

### By Directory
```bash
curl "https://api.workos.com/directory_users?directory=directory_01H..." \
  -H "Authorization: Bearer sk_live_..."
```
Returns users from a SPECIFIC directory only.

### By User State
```bash
curl "https://api.workos.com/directory_users?directory=directory_01H...&state=active" \
  -H "Authorization: Bearer sk_live_..."
```
Valid states: `active`, `inactive`. Omit to fetch all states.

## Verification Commands

### Test authentication
```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer sk_live_..." \
  -w "\nHTTP Status: %{http_code}\n"
```
Expected: HTTP 200 with JSON response

### Test directory listing
```bash
curl https://api.workos.com/directories?organization=org_01H... \
  -H "Authorization: Bearer sk_live_..." \
  | jq '.data[] | {id, name, state}'
```
Expected: Array of directory objects with `state: "linked"`

### Test user sync
```bash
curl https://api.workos.com/directory_users?directory=directory_01H...&limit=1 \
  -H "Authorization: Bearer sk_live_..." \
  | jq '.data[0] | {id, username, state}'
```
Expected: At least one user with `state: "active"` if directory is syncing

### Test group membership
```bash
curl https://api.workos.com/directory_users/directory_user_01H... \
  -H "Authorization: Bearer sk_live_..." \
  | jq '.groups[] | {id, name}'
```
Expected: Array of groups the user belongs to

## SDK Method Examples

Install SDK:
```bash
npm install @workos-inc/node
```

List users:
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const { data: users } = await workos.directorySync.listUsers({
  directory: 'directory_01H...',
  groups: true,
  limit: 100
});
```

List groups:
```typescript
const { data: groups } = await workos.directorySync.listGroups({
  directory: 'directory_01H...',
  members: true,
  limit: 100
});
```

Get user:
```typescript
const user = await workos.directorySync.getUser({
  id: 'directory_user_01H...'
});
```

## Common Integration Patterns

### Sync users on webhook receipt
```typescript
// On dsync.user.created or dsync.user.updated webhook:
const user = await workos.directorySync.getUser({
  id: event.data.id
});

// Upsert to your database
await db.users.upsert({
  where: { workosId: user.id },
  update: { 
    email: user.emails[0].value,
    firstName: user.first_name,
    lastName: user.last_name,
    active: user.state === 'active'
  },
  create: { 
    workosId: user.id,
    email: user.emails[0].value,
    firstName: user.first_name,
    lastName: user.last_name,
    active: user.state === 'active'
  }
});
```

### Batch sync all users
```typescript
let after: string | undefined;

do {
  const response = await workos.directorySync.listUsers({
    directory: 'directory_01H...',
    limit: 100,
    after
  });

  for (const user of response.data) {
    await syncUserToDatabase(user);
  }

  after = response.listMetadata.after ?? undefined;
} while (after);
```

### Check directory health
```typescript
const directory = await workos.directorySync.getDirectory({
  id: 'directory_01H...'
});

if (directory.state !== 'linked') {
  console.error(`Directory ${directory.name} is ${directory.state}`);
  // Alert admin via email/slack
}
```

## Related Skills

- **workos-directory-sync** — Feature overview and setup guide
- **workos-api-events** — Webhook events for directory changes (dsync.*)
- **workos-api-organization** — Managing organizations that own directories
