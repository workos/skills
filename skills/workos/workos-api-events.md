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

## Overview

The WorkOS Events API provides a read-only interface for querying audit trail events. Use this API to:

- Retrieve events for compliance auditing
- Build custom event dashboards
- Export event data for analysis
- Monitor user activity across your application

Events are immutable records of actions that occurred in your WorkOS organization.

## Authentication

All Events API requests require authentication via API key in the Authorization header:

```bash
Authorization: Bearer sk_test_1234567890
```

Use your **secret API key** (starts with `sk_`). Find it in the WorkOS Dashboard under API Keys.

## Available Endpoints

| Method | Endpoint  | Purpose                                   |
| ------ | --------- | ----------------------------------------- |
| GET    | `/events` | List events with filtering and pagination |

## Operation: List Events

### When to Use

Call `GET /events` when you need to:

- Retrieve audit logs for a specific time range
- Filter events by organization, user, or action
- Export event data for compliance reporting
- Build event timelines or activity feeds

### Request Pattern

```bash
curl -X GET 'https://api.workos.com/events?limit=10&order=desc' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

### Query Parameters

| Parameter         | Type     | Required | Description                                                     |
| ----------------- | -------- | -------- | --------------------------------------------------------------- |
| `limit`           | integer  | No       | Number of events to return (default: 10, max: 100)              |
| `before`          | string   | No       | Cursor for pagination (previous page)                           |
| `after`           | string   | No       | Cursor for pagination (next page)                               |
| `order`           | string   | No       | Sort order: `asc` or `desc` (default: `desc`)                   |
| `events`          | array    | No       | Filter by event types (e.g., `user.created`, `session.created`) |
| `organization_id` | string   | No       | Filter events for a specific organization                       |
| `range_start`     | ISO 8601 | No       | Start of time range filter                                      |
| `range_end`       | ISO 8601 | No       | End of time range filter                                        |

### Response Pattern

```json
{
  "data": [
    {
      "id": "event_01H7ZGXFM5QN9X1B2C3D4E5F6G",
      "event": "user.created",
      "created_at": "2024-01-15T10:30:00.000Z",
      "object": "event",
      "actor": {
        "id": "user_01H7ZGXFM5QN9X1B2C3D4E5F6H",
        "type": "user",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "context": {
        "location": "192.168.1.1",
        "user_agent": "Mozilla/5.0..."
      },
      "metadata": {
        "organization_id": "org_01H7ZGXFM5QN9X1B2C3D4E5F6I"
      }
    }
  ],
  "list_metadata": {
    "before": "event_01H7ZGXFM5QN9X1B2C3D4E5F6J",
    "after": "event_01H7ZGXFM5QN9X1B2C3D4E5F6K"
  }
}
```

## Pagination Pattern

The Events API uses cursor-based pagination. Use the `before` and `after` cursors from `list_metadata` to navigate pages:

**First page:**

```bash
curl 'https://api.workos.com/events?limit=10&order=desc' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

**Next page:**

```bash
curl 'https://api.workos.com/events?limit=10&order=desc&after=event_01H7ZGXFM5QN9X1B2C3D4E5F6K' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

**Previous page:**

```bash
curl 'https://api.workos.com/events?limit=10&order=desc&before=event_01H7ZGXFM5QN9X1B2C3D4E5F6J' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

Continue paginating until `list_metadata.after` is `null` (no more pages).

## Filtering Events

### By Event Type

Filter to specific event types (e.g., only authentication events):

```bash
curl 'https://api.workos.com/events?events[]=session.created&events[]=session.ended' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

### By Organization

Retrieve events for a single organization:

```bash
curl 'https://api.workos.com/events?organization_id=org_01H7ZGXFM5QN9X1B2C3D4E5F6I' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

### By Time Range

Get events within a specific date range:

```bash
curl 'https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

## SDK Usage

### Node.js

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List recent events
const { data: events } = await workos.events.listEvents({
  limit: 20,
  order: "desc",
});

// Filter by organization
const { data: orgEvents } = await workos.events.listEvents({
  organizationId: "org_01H7ZGXFM5QN9X1B2C3D4E5F6I",
  limit: 50,
});

// Paginate through all events
let allEvents = [];
let after = null;

do {
  const response = await workos.events.listEvents({
    limit: 100,
    after,
  });
  allEvents = allEvents.concat(response.data);
  after = response.listMetadata.after;
} while (after);
```

### Python

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# List recent events
events = workos.events.list_events(
    limit=20,
    order='desc'
)

# Filter by event type and organization
filtered_events = workos.events.list_events(
    events=['user.created', 'user.updated'],
    organization_id='org_01H7ZGXFM5QN9X1B2C3D4E5F6I'
)

# Paginate through all events
all_events = []
after = None

while True:
    response = workos.events.list_events(limit=100, after=after)
    all_events.extend(response['data'])
    after = response['list_metadata'].get('after')
    if not after:
        break
```

## Error Handling

### HTTP Status Codes

| Status | Cause                                            | Fix                                                               |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| 400    | Invalid query parameter (e.g., `limit > 100`)    | Check parameter values match API constraints                      |
| 401    | Missing or invalid API key                       | Verify `Authorization: Bearer sk_...` header is present and valid |
| 403    | API key lacks Events API permissions             | Check API key scope in WorkOS Dashboard                           |
| 404    | Invalid cursor (expired or non-existent)         | Start pagination from beginning (omit `before`/`after`)           |
| 422    | Invalid date format in `range_start`/`range_end` | Use ISO 8601 format: `2024-01-15T10:30:00Z`                       |
| 429    | Rate limit exceeded                              | Implement exponential backoff (see Rate Limits below)             |
| 500    | WorkOS server error                              | Retry with exponential backoff                                    |

### Example: Error Response

```json
{
  "error": "invalid_request",
  "error_description": "limit must be between 1 and 100"
}
```

## Rate Limits

The Events API has rate limits to prevent abuse:

- **Default limit:** 100 requests per minute per API key
- **Status code:** 429 Too Many Requests

**Retry strategy:**

1. Wait for `Retry-After` header value (seconds)
2. If no header, use exponential backoff: 1s, 2s, 4s, 8s, 16s
3. Maximum 5 retries before failing

**Example retry logic:**

```javascript
async function listEventsWithRetry(params, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.events.listEvents(params);
    } catch (error) {
      if (error.status === 429) {
        const delay = error.headers["retry-after"]
          ? parseInt(error.headers["retry-after"]) * 1000
          : Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Verification Commands

### Test 1: List Recent Events

```bash
curl -X GET 'https://api.workos.com/events?limit=5&order=desc' \
  -H 'Authorization: Bearer sk_test_1234567890' \
  | jq '.'
```

**Expected output:** JSON response with `data` array containing up to 5 events.

### Test 2: Filter by Organization

```bash
curl -X GET 'https://api.workos.com/events?organization_id=org_01H7ZGXFM5QN9X1B2C3D4E5F6I&limit=10' \
  -H 'Authorization: Bearer sk_test_1234567890' \
  | jq '.data[].metadata.organization_id'
```

**Expected output:** All returned events should have the specified `organization_id`.

### Test 3: Pagination

```bash
# Get first page
RESPONSE=$(curl -s 'https://api.workos.com/events?limit=2&order=desc' \
  -H 'Authorization: Bearer sk_test_1234567890')

# Extract 'after' cursor
AFTER=$(echo $RESPONSE | jq -r '.list_metadata.after')

# Get next page
curl "https://api.workos.com/events?limit=2&order=desc&after=$AFTER" \
  -H 'Authorization: Bearer sk_test_1234567890' \
  | jq '.data[].id'
```

**Expected output:** Second page returns different event IDs than first page.

### Test 4: Invalid API Key

```bash
curl -X GET 'https://api.workos.com/events?limit=5' \
  -H 'Authorization: Bearer invalid_key' \
  -w '\nHTTP Status: %{http_code}\n'
```

**Expected output:** HTTP Status 401 with error message.

## Common Use Cases

### Export Events for Compliance

Retrieve all events for a date range and save to file:

```bash
curl 'https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z&limit=100' \
  -H 'Authorization: Bearer sk_live_1234567890' \
  | jq '.data' > events_january_2024.json
```

### Monitor Authentication Activity

Get recent login/logout events:

```bash
curl 'https://api.workos.com/events?events[]=session.created&events[]=session.ended&limit=50&order=desc' \
  -H 'Authorization: Bearer sk_test_1234567890'
```

### Build Real-Time Event Stream

Poll for new events every 60 seconds:

```javascript
let lastEventId = null;

setInterval(async () => {
  const params = {
    limit: 100,
    order: "desc",
  };

  if (lastEventId) {
    params.after = lastEventId;
  }

  const { data: events } = await workos.events.listEvents(params);

  if (events.length > 0) {
    lastEventId = events[0].id;
    processNewEvents(events);
  }
}, 60000);
```

## Related Skills

- workos-api-webhooks — Set up real-time event notifications instead of polling
- workos-api-audit-logs — Configure audit log exports and retention
