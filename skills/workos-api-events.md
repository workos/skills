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

The Events API provides access to WorkOS audit log events across all products (SSO, Directory Sync, Admin Portal, User Management). Use this API to retrieve historical event data, build custom dashboards, or integrate events into your security monitoring systems.

**Core operation:** List events with filtering and pagination.

## Authentication

All requests require your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_test_1234567890
```

Get your API key from the WorkOS Dashboard → API Keys section. Use `sk_test_` keys for development, `sk_live_` keys for production.

## Endpoint Catalog

| Method | Endpoint  | Purpose                                 |
| ------ | --------- | --------------------------------------- |
| GET    | `/events` | List events with filters and pagination |

**Base URL:** `https://api.workos.com/`

## Operation Decision Tree

**What do you want to do?**

```
└─ Retrieve audit events
   ├─ Get all recent events → GET /events (no filters)
   ├─ Get events for specific user → GET /events?user=user_123
   ├─ Get events by type → GET /events?events[]=sso.succeeded&events[]=directory_user.created
   ├─ Get events in time range → GET /events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z
   └─ Get events for organization → GET /events?organization_id=org_123
```

**Note:** This is a read-only API. To generate events, use the corresponding feature APIs (SSO, Directory Sync, etc.).

## Request Patterns

### List Events (Basic)

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer sk_test_1234567890"
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "id": "event_01H7Z...",
      "event": "authentication.email_verification_succeeded",
      "created_at": "2024-01-15T10:30:00.000Z",
      "user": {
        "id": "user_01H7...",
        "email": "user@example.com"
      },
      "organization_id": "org_01H7..."
    }
  ],
  "list_metadata": {
    "before": "event_01H7Y...",
    "after": "event_01H7X..."
  }
}
```

### List Events (Filtered)

```bash
# Filter by event types
curl "https://api.workos.com/events?events[]=sso.succeeded&events[]=directory_user.created" \
  -H "Authorization: Bearer sk_test_1234567890"

# Filter by user
curl "https://api.workos.com/events?user=user_01H7Z..." \
  -H "Authorization: Bearer sk_test_1234567890"

# Filter by organization
curl "https://api.workos.com/events?organization_id=org_01H7Z..." \
  -H "Authorization: Bearer sk_test_1234567890"

# Filter by date range
curl "https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer sk_test_1234567890"
```

### SDK Example (Node.js)

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List all events
const events = await workos.events.listEvents();

// Filter by event type
const ssoEvents = await workos.events.listEvents({
  events: ["sso.succeeded", "sso.failed"],
});

// Filter by organization
const orgEvents = await workos.events.listEvents({
  organizationId: "org_01H7Z...",
});

// Filter by date range
const rangeEvents = await workos.events.listEvents({
  rangeStart: "2024-01-01T00:00:00Z",
  rangeEnd: "2024-01-31T23:59:59Z",
});
```

## Pagination

The Events API uses cursor-based pagination with `before` and `after` parameters.

**Request:**

```bash
# First page (default limit: 10)
curl "https://api.workos.com/events?limit=25" \
  -H "Authorization: Bearer sk_test_1234567890"

# Next page
curl "https://api.workos.com/events?after=event_01H7X...&limit=25" \
  -H "Authorization: Bearer sk_test_1234567890"

# Previous page
curl "https://api.workos.com/events?before=event_01H7Y...&limit=25" \
  -H "Authorization: Bearer sk_test_1234567890"
```

**SDK pagination:**

```javascript
// Iterate through all events
let after = null;
do {
  const response = await workos.events.listEvents({
    limit: 100,
    after,
  });

  for (const event of response.data) {
    console.log(event.id, event.event);
  }

  after = response.list_metadata.after;
} while (after);
```

**Limits:**

- Default page size: 10 events
- Maximum page size: 100 events
- Events are returned in reverse chronological order (newest first)

## Error Handling

### HTTP Status Codes

| Code | Cause                      | Fix                                                                                        |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------ |
| 401  | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is present and key is valid                   |
| 403  | API key lacks permissions  | Check key has Events API read permission in Dashboard                                      |
| 422  | Invalid query parameters   | Check date formats (ISO 8601), event types match valid values, cursors are valid event IDs |
| 429  | Rate limit exceeded        | Implement exponential backoff (wait 1s, 2s, 4s, 8s before retry)                           |
| 500  | WorkOS server error        | Retry request after 5 seconds, contact support if persists                                 |

### Common Error Responses

**Invalid event type:**

```json
{
  "error": "invalid_request",
  "error_description": "Invalid event type: 'invalid.event'"
}
```

**Fix:** Check fetched documentation for valid event types.

**Invalid date format:**

```json
{
  "error": "invalid_request",
  "error_description": "range_start must be ISO 8601 format"
}
```

**Fix:** Use format `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2024-01-15T10:30:00.000Z`).

**Invalid cursor:**

```json
{
  "error": "invalid_request",
  "error_description": "Invalid pagination cursor"
}
```

**Fix:** Use `after`/`before` values from previous response's `list_metadata`, not arbitrary strings.

## Rate Limits

- Standard tier: 100 requests per 10 seconds
- Exceeded rate limit returns HTTP 429 with `Retry-After` header

**Retry strategy:**

```javascript
async function fetchEventsWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.events.listEvents(params);
    } catch (error) {
      if (error.status === 429) {
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Verification Commands

**Test API connectivity:**

```bash
curl https://api.workos.com/events?limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with event list.

**Verify event filtering:**

```bash
# Should return only SSO events
curl "https://api.workos.com/events?events[]=sso.succeeded&limit=5" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[].event'
```

Expected: All returned events have `event` field starting with `sso.`.

**Verify pagination:**

```bash
# Get cursor from first page
AFTER=$(curl "https://api.workos.com/events?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -r '.list_metadata.after')

# Fetch next page
curl "https://api.workos.com/events?after=$AFTER&limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: Different events than first page.

**SDK verification (Node.js):**

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Test basic fetch
const events = await workos.events.listEvents({ limit: 5 });
console.assert(events.data.length <= 5, "Should return max 5 events");
console.assert(events.object === "list", "Should return list object");

// Test filtering
const ssoEvents = await workos.events.listEvents({
  events: ["sso.succeeded"],
});
console.assert(
  ssoEvents.data.every((e) => e.event === "sso.succeeded"),
  "Should only return SSO events",
);

console.log("✓ Events API working correctly");
```

## Common Event Types

Refer to fetched documentation for complete list. Common types include:

**Authentication:**

- `authentication.email_verification_succeeded`
- `authentication.password_reset`
- `authentication.mfa_succeeded`

**SSO:**

- `sso.succeeded`
- `sso.failed`

**Directory Sync:**

- `directory_user.created`
- `directory_user.updated`
- `directory_user.deleted`
- `directory_group.created`

**Organizations:**

- `organization.created`
- `organization.updated`

## Related Skills

- workos-directory-sync.rules.yml — for generating Directory Sync events
- workos-authkit-base — for generating authentication events
