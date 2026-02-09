---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- generated -->

# WorkOS Events API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Authentication Setup

All Events API calls require authentication via API key:

```bash
Authorization: Bearer sk_live_xxxxx
```

Set your API key in environment variables:

```bash
export WORKOS_API_KEY="sk_live_xxxxx"
```

## Endpoint Catalog

| Method | Endpoint | Purpose | Pagination |
|--------|----------|---------|------------|
| GET | `/events` | List all events | Yes (cursor) |

## Operation Decision Tree

**When to use Events API:**

- **List recent events** → `GET /events` (default: last 30 days)
- **Filter by event type** → `GET /events?events[]=dsync.activated`
- **Filter by date range** → `GET /events?range_start=2024-01-01&range_end=2024-01-31`
- **Paginate results** → Use `after` cursor from response
- **Filter by organization** → `GET /events?organization_id=org_xxx`

**You cannot:**
- Create, update, or delete events (read-only API)
- Modify event history
- Subscribe to webhooks via this endpoint (use Webhooks API instead)

## Request Patterns

### List Events (Basic)

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### List Events with Filters

```bash
curl "https://api.workos.com/events?events[]=dsync.activated&events[]=dsync.deleted&limit=20" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### List Events by Date Range

```bash
curl "https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### List Events by Organization

```bash
curl "https://api.workos.com/events?organization_id=org_01H5K8PB8CJ8QH4K3T2NXJR8XS" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Response Pattern

Successful response (200 OK):

```json
{
  "data": [
    {
      "id": "event_01H5K8PB8CJ8QH4K3T2NXJR8XS",
      "event": "dsync.activated",
      "created_at": "2024-01-15T10:30:00.000Z",
      "data": {
        "id": "directory_01H5K8PB8CJ8QH4K3T2NXJR8XS",
        "name": "Example Directory",
        "organization_id": "org_01H5K8PB8CJ8QH4K3T2NXJR8XS",
        "state": "active",
        "type": "okta scim v2.0"
      }
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "event_01H5K8PB8CJ8QH4K3T2NXJR8XT"
  }
}
```

## Pagination Handling

Events API uses cursor-based pagination:

1. First request returns up to `limit` events (default: 10, max: 100)
2. Response includes `list_metadata.after` cursor if more results exist
3. Pass cursor to `after` parameter for next page

```bash
# Page 1
curl "https://api.workos.com/events?limit=50" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Page 2 (use cursor from previous response)
curl "https://api.workos.com/events?limit=50&after=event_01H5K8PB8CJ8QH4K3T2NXJR8XT" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Stop paginating when `list_metadata.after` is `null`.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in dashboard |
| 403 | API key lacks permission | Check API key has "Events" read permission in WorkOS Dashboard |
| 422 | Invalid parameter format | Check `range_start`/`range_end` are ISO 8601 format; `limit` is 1-100 |
| 429 | Rate limit exceeded | Implement exponential backoff starting at 1 second |
| 500 | WorkOS server error | Retry with exponential backoff; contact support if persists |

### Error Response Format

```json
{
  "message": "Invalid parameter: range_start must be in ISO 8601 format",
  "code": "invalid_parameter",
  "error": "validation_error"
}
```

## SDK Usage (Node.js)

### Installation

```bash
npm install @workos-inc/node
```

### List Events

```javascript
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function listEvents() {
  const events = await workos.events.listEvents({
    events: ['dsync.activated', 'dsync.deleted'],
    limit: 50,
  });

  console.log(events.data);
  
  // Handle pagination
  if (events.listMetadata.after) {
    const nextPage = await workos.events.listEvents({
      after: events.listMetadata.after,
      limit: 50,
    });
  }
}
```

### Filter by Date Range

```javascript
async function listEventsByDate() {
  const events = await workos.events.listEvents({
    rangeStart: '2024-01-01T00:00:00Z',
    rangeEnd: '2024-01-31T23:59:59Z',
  });

  return events.data;
}
```

### Filter by Organization

```javascript
async function listOrgEvents(organizationId) {
  const events = await workos.events.listEvents({
    organizationId: organizationId,
  });

  return events.data;
}
```

## Rate Limits

- Default: 100 requests per 10 seconds per API key
- Implement exponential backoff on 429 responses
- Cache event data when possible to reduce API calls

Retry strategy:

```javascript
async function listEventsWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.events.listEvents(params);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

## Runnable Verification

### Step 1: Verify API Key

```bash
curl https://api.workos.com/events?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with event array (may be empty if no events exist).

### Step 2: Verify Event Filtering

```bash
curl "https://api.workos.com/events?events[]=dsync.activated&limit=5" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with filtered events.

### Step 3: Verify Pagination

```bash
# List first page
curl "https://api.workos.com/events?limit=2" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.list_metadata.after'

# Use cursor for next page
curl "https://api.workos.com/events?limit=2&after=event_CURSOR_FROM_ABOVE" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: Different events in second response.

## Common Event Types

Reference the fetched documentation for complete event catalog. Common types:

- `dsync.activated` - Directory sync activated
- `dsync.deleted` - Directory sync deleted
- `dsync.group.created` - Group created
- `dsync.group.deleted` - Group deleted
- `dsync.group.updated` - Group updated
- `dsync.user.created` - User created
- `dsync.user.deleted` - User deleted
- `dsync.user.updated` - User updated
- `connection.activated` - SSO connection activated
- `connection.deleted` - SSO connection deleted

## Related Skills

- **workos-events** - Feature overview and webhook setup
- **workos-api-directory-sync** - Directory Sync API operations
- **workos-api-sso** - SSO authentication flows
