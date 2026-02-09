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

## When to Use This Skill

Use the Events API to retrieve historical event logs from WorkOS. Events capture actions like user sign-ins, SSO connections, directory syncs, and audit trail entries. This is a read-only API for monitoring and observability.

**Do NOT use this skill for:**
- Real-time event streaming (use webhooks instead — see workos-api-webhooks)
- Creating or modifying events (events are system-generated)
- Audit trail feature implementation (see workos-audit-logs)

## Operation Decision Tree

```
Need to monitor WorkOS activity?
├─ Real-time notifications needed? → Use webhooks (workos-api-webhooks)
├─ Historical event retrieval? → Use GET /events (this skill)
│  ├─ Filter by event type? → Use events[] query parameter
│  ├─ Filter by date range? → Use range_start/range_end parameters
│  └─ Paginate results? → Use after cursor parameter
└─ User-facing audit trail? → Use Audit Logs feature (workos-audit-logs)
```

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List events with optional filtering and pagination |

## Authentication Setup

All Events API requests require an API key in the Authorization header:

```bash
Authorization: Bearer sk_test_1234567890abcdef
```

**API Key Requirements:**
- Must start with `sk_test_` (test) or `sk_live_` (production)
- Obtain from WorkOS Dashboard → API Keys
- Store securely (environment variable, secret manager)

**Verification Command:**
```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected response: 200 OK with event list (or 401 if key is invalid)

## Request Pattern: List Events

### Basic Request

```bash
GET https://api.workos.com/events
```

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Filter by Event Type

```bash
GET https://api.workos.com/events?events[]=authentication.email_verification_succeeded&events[]=authentication.magic_auth_succeeded
```

```bash
curl "https://api.workos.com/events?events[]=authentication.email_verification_succeeded&events[]=authentication.magic_auth_succeeded" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Filter by Date Range

```bash
GET https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z
```

```bash
curl "https://api.workos.com/events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Paginated Request

```bash
GET https://api.workos.com/events?limit=50&after=event_01H1Y8Z9K2M3N4P5Q6R7S8T9U0
```

```bash
curl "https://api.workos.com/events?limit=50&after=event_01H1Y8Z9K2M3N4P5Q6R7S8T9U0" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Response Pattern

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "event_01H1Y8Z9K2M3N4P5Q6R7S8T9U0",
      "event": "authentication.email_verification_succeeded",
      "created_at": "2024-01-15T14:32:18.123Z",
      "data": {
        "user_id": "user_01H1Y8Z9K2M3N4P5Q6R7S8T9U0",
        "email": "user@example.com"
      }
    }
  ],
  "list_metadata": {
    "after": "event_01H1Y8Z9K2M3N4P5Q6R7S8T9U0",
    "before": null
  }
}
```

**Key Fields:**
- `data[]` — Array of event objects
- `event` — Event type identifier (e.g., `authentication.email_verification_succeeded`)
- `created_at` — ISO 8601 timestamp when event occurred
- `data` — Event-specific payload (structure varies by event type)
- `list_metadata.after` — Cursor for next page (null if last page)

## Pagination Pattern

The Events API uses cursor-based pagination:

1. **First page:** Call `/events` without `after` parameter
2. **Check for more:** If `list_metadata.after` is non-null, more pages exist
3. **Next page:** Call `/events?after={cursor}` using the `after` value from previous response
4. **Repeat:** Continue until `list_metadata.after` is null

**Example Pagination Loop (pseudocode):**

```javascript
let cursor = null;
let allEvents = [];

do {
  const params = cursor ? `?after=${cursor}` : '';
  const response = await fetch(`https://api.workos.com/events${params}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const json = await response.json();
  
  allEvents.push(...json.data);
  cursor = json.list_metadata.after;
} while (cursor !== null);
```

**Default Page Size:** 10 events  
**Maximum Page Size:** Check fetched documentation for current limit

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `events[]` | string[] | No | Filter by event types (can specify multiple) |
| `range_start` | ISO 8601 | No | Filter events after this timestamp |
| `range_end` | ISO 8601 | No | Filter events before this timestamp |
| `limit` | integer | No | Number of events per page (default: 10) |
| `after` | string | No | Cursor for pagination (from previous response) |
| `order` | string | No | Sort order: `asc` or `desc` (default: `desc`) |

## Error Code Mapping

| Status | Error Code | Cause | Fix |
|--------|------------|-------|-----|
| 401 | `unauthorized` | Missing or invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is not expired |
| 400 | `invalid_request` | Malformed query parameter (e.g., invalid ISO 8601 date) | Check date format is `YYYY-MM-DDTHH:MM:SSZ` |
| 400 | `invalid_request` | Unknown event type in `events[]` | WebFetch https://workos.com/docs/reference/events for valid event types |
| 429 | `rate_limit_exceeded` | Too many requests | Implement exponential backoff (wait 1s, 2s, 4s, 8s before retry) |
| 500 | `internal_server_error` | WorkOS service issue | Retry with exponential backoff; contact WorkOS if persists |

**Error Response Format:**

```json
{
  "error": "unauthorized",
  "error_description": "Invalid API key provided",
  "code": "invalid_credentials"
}
```

## Rate Limit Guidance

**Limit:** Check fetched documentation for current rate limits  
**Retry Strategy:**

```bash
# Exponential backoff example
attempt=1
while [ $attempt -le 5 ]; do
  response=$(curl -s -w "%{http_code}" -o response.json \
    https://api.workos.com/events \
    -H "Authorization: Bearer ${WORKOS_API_KEY}")
  
  if [ "$response" != "429" ]; then
    break
  fi
  
  wait_time=$((2 ** attempt))
  echo "Rate limited. Waiting ${wait_time}s..."
  sleep $wait_time
  attempt=$((attempt + 1))
done
```

## Common Event Types

Fetch the full list from https://workos.com/docs/reference/events. Common categories include:

- `authentication.*` — AuthKit sign-ins, verifications, password resets
- `sso.*` — SSO connection changes, SAML flows
- `dsync.*` — Directory sync operations
- `organization.*` — Organization CRUD operations
- `connection.*` — Connection status changes

**To discover event types:**

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | \
  jq '.data[].event' | sort -u
```

## SDK Usage Pattern

WebFetch https://workos.com/docs/reference/events for current SDK method names.

**General SDK pattern (verify exact methods in docs):**

```javascript
// Pseudocode - verify actual method names
const events = await workos.events.list({
  events: ['authentication.email_verification_succeeded'],
  rangeStart: '2024-01-01T00:00:00Z',
  rangeEnd: '2024-01-31T23:59:59Z',
  limit: 50
});

// Pagination
let cursor = null;
do {
  const page = await workos.events.list({ after: cursor });
  // Process page.data
  cursor = page.listMetadata.after;
} while (cursor);
```

## Verification Checklist

- [ ] API key is set in environment (`WORKOS_API_KEY`)
- [ ] Basic list request returns 200 OK with event array
- [ ] Event type filtering returns only matching events
- [ ] Date range filtering respects `range_start` and `range_end`
- [ ] Pagination cursor returns next page when present
- [ ] 401 response on invalid API key
- [ ] 429 response triggers exponential backoff retry

**Full Verification Script:**

```bash
#!/bin/bash
set -e

# Test 1: Basic list
echo "Test 1: List events"
curl -f https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  > /dev/null && echo "✓ Basic list works"

# Test 2: Event type filter
echo "Test 2: Filter by event type"
curl -f "https://api.workos.com/events?events[]=authentication.email_verification_succeeded" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  > /dev/null && echo "✓ Event type filter works"

# Test 3: Date range filter
echo "Test 3: Filter by date range"
curl -f "https://api.workos.com/events?range_start=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  > /dev/null && echo "✓ Date range filter works"

# Test 4: Invalid API key (expect failure)
echo "Test 4: Invalid API key"
! curl -f https://api.workos.com/events \
  -H "Authorization: Bearer invalid_key" \
  > /dev/null 2>&1 && echo "✓ Invalid key rejected"

echo "All tests passed"
```

## Related Skills

- **workos-events** — Overview of WorkOS Events feature and webhook setup
- **workos-audit-logs** — Implement user-facing audit trails (different from Events API)
- **workos-api-authkit** — Events related to AuthKit authentication flows
- **workos-api-sso** — Events related to SSO connections
- **workos-api-directory-sync** — Events related to directory sync operations
