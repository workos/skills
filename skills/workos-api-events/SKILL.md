---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Authentication

All requests require a WorkOS API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key
```

API keys start with `sk_` and are found in the WorkOS Dashboard under API Keys.

## Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/events` | List events with pagination and filters |

## Operation Decision Tree

**To retrieve audit events:**
- Use `GET /events` with query parameters for filtering

**To process events in real-time:**
- Implement webhooks (see WorkOS Webhooks feature skill)
- Events API is for historical retrieval and auditing

**To paginate through many events:**
- Use `after` cursor parameter for forward pagination
- Use `before` cursor parameter for backward pagination

## Request Patterns

### List Events

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer sk_your_api_key" \
  -G \
  -d "limit=10" \
  -d "events[]=user.created" \
  -d "organization_id=org_01H1234567890"
```

**Query Parameters:**
- `limit` (optional): Number of events to return (default 10, max 100)
- `after` (optional): Cursor for next page
- `before` (optional): Cursor for previous page
- `events[]` (optional): Filter by event type (can specify multiple)
- `organization_id` (optional): Filter by organization
- `occurred_at_gte` (optional): Filter events after this timestamp (ISO 8601)
- `occurred_at_lte` (optional): Filter events before this timestamp (ISO 8601)

## Response Patterns

### Successful List Response (200 OK)

```json
{
  "object": "list",
  "data": [
    {
      "id": "event_01H1234567890",
      "event": "user.created",
      "created_at": "2024-01-15T10:30:00.000Z",
      "data": {
        "user_id": "user_01H0987654321",
        "email": "user@example.com"
      }
    }
  ],
  "list_metadata": {
    "after": "event_01H1234567891",
    "before": null
  }
}
```

**Response Fields:**
- `data`: Array of event objects
- `list_metadata.after`: Cursor for next page (null if no more results)
- `list_metadata.before`: Cursor for previous page

### Event Object Structure

```json
{
  "id": "event_01H1234567890",
  "event": "user.created",
  "created_at": "2024-01-15T10:30:00.000Z",
  "data": {
    /* Event-specific payload */
  }
}
```

## Pagination Handling

### Forward Pagination Pattern

```bash
# First page
curl https://api.workos.com/events?limit=10

# Next page using 'after' cursor from response
curl https://api.workos.com/events?limit=10&after=event_01H1234567891
```

### Backward Pagination Pattern

```bash
# Previous page using 'before' cursor
curl https://api.workos.com/events?limit=10&before=event_01H1234567890
```

**Pagination Rules:**
- Only one of `after` or `before` can be used per request
- When `list_metadata.after` is null, you've reached the end
- Events are ordered by `created_at` descending (newest first)

## Error Codes and Recovery

### 401 Unauthorized

**Cause:** Invalid or missing API key

**Fix:**
1. Verify API key starts with `sk_`
2. Check Authorization header format: `Bearer sk_your_api_key`
3. Confirm key is active in WorkOS Dashboard → API Keys

```bash
# Verify your API key works
curl https://api.workos.com/events?limit=1 \
  -H "Authorization: Bearer sk_your_api_key"
```

### 400 Bad Request

**Cause:** Invalid query parameters

**Fix:**
- Check `limit` is between 1 and 100
- Verify `occurred_at_gte` and `occurred_at_lte` are valid ISO 8601 timestamps
- Ensure cursor values (`after`, `before`) are valid event IDs
- Do not use both `after` and `before` in the same request

### 404 Not Found

**Cause:** Invalid endpoint or cursor pointing to non-existent event

**Fix:**
- Verify endpoint is `https://api.workos.com/events`
- Check cursor value is from a recent API response
- Cursors may expire if referencing very old events

### 429 Too Many Requests

**Cause:** Rate limit exceeded

**Fix:**
- Implement exponential backoff (start with 1s delay, double each retry)
- Check `Retry-After` header for wait time
- Reduce request frequency or use webhooks for real-time updates

## Rate Limits

WorkOS enforces rate limits on API calls. If you exceed the limit:

1. Check the `Retry-After` header in the 429 response
2. Wait the specified duration before retrying
3. Implement exponential backoff for automated retries

**Best Practice:** Use webhooks for real-time event processing instead of polling the Events API frequently.

## Filtering Events

### By Event Type

```bash
# Single event type
curl https://api.workos.com/events?events[]=user.created

# Multiple event types
curl https://api.workos.com/events \
  ?events[]=user.created \
  &events[]=user.updated \
  &events[]=user.deleted
```

### By Organization

```bash
curl https://api.workos.com/events?organization_id=org_01H1234567890
```

### By Time Range

```bash
# Events after a specific time
curl https://api.workos.com/events?occurred_at_gte=2024-01-01T00:00:00Z

# Events in a time window
curl https://api.workos.com/events \
  ?occurred_at_gte=2024-01-01T00:00:00Z \
  &occurred_at_lte=2024-01-31T23:59:59Z
```

## SDK Usage Examples

### Node.js

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List recent events
const events = await workos.events.listEvents({
  limit: 20,
  events: ['user.created', 'user.updated']
});

// Paginate through all events
let cursor = null;
do {
  const page = await workos.events.listEvents({
    limit: 100,
    after: cursor
  });
  
  // Process page.data
  page.data.forEach(event => console.log(event));
  
  cursor = page.listMetadata.after;
} while (cursor);
```

### Python

```python
from workos import WorkOSClient

client = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# List recent events
events = client.events.list_events(
    limit=20,
    events=['user.created', 'user.updated']
)

# Paginate through all events
cursor = None
while True:
    page = client.events.list_events(limit=100, after=cursor)
    
    # Process page.data
    for event in page.data:
        print(event)
    
    cursor = page.list_metadata.get('after')
    if not cursor:
        break
```

## Verification Commands

### Test Basic Connectivity

```bash
curl https://api.workos.com/events?limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** 200 OK with event data

### Test Filtering

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -G \
  -d "limit=5" \
  -d "events[]=connection.activated" \
  | jq '.data[].event'
```

**Expected:** All returned events have type "connection.activated"

### Test Pagination

```bash
# Get first page
RESPONSE=$(curl -s https://api.workos.com/events?limit=2 \
  -H "Authorization: Bearer $WORKOS_API_KEY")

# Extract cursor and fetch next page
CURSOR=$(echo $RESPONSE | jq -r '.list_metadata.after')
curl https://api.workos.com/events?limit=2&after=$CURSOR \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Expected:** Second page returns different events

## Verification Checklist

- [ ] API key authentication returns 200 OK
- [ ] Can retrieve events with default parameters
- [ ] Can filter events by event type
- [ ] Can paginate forward using `after` cursor
- [ ] Pagination stops when `list_metadata.after` is null
- [ ] Invalid API key returns 401 Unauthorized
- [ ] Invalid parameters return 400 Bad Request with error details
- [ ] Can filter by organization_id (if applicable)
- [ ] Can filter by time range using occurred_at parameters

## Common Event Types

Refer to the WorkOS documentation for a complete list of event types. Common examples include:

- `connection.activated` - SSO connection became active
- `connection.deactivated` - SSO connection deactivated
- `user.created` - New user created
- `user.updated` - User profile updated
- `user.deleted` - User removed
- `session.created` - New user session started

Use the `events[]` parameter to filter for specific types relevant to your integration.

## Related Skills

- **WorkOS Webhooks** - Real-time event delivery via webhooks (preferred over polling)
- **WorkOS SSO** - Single Sign-On authentication generating events
- **WorkOS Directory Sync** - Directory events (user/group changes)
