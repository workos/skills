---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/audit-logs
- https://workos.com/docs/reference/audit-logs/configuration
- https://workos.com/docs/reference/audit-logs/event
- https://workos.com/docs/reference/audit-logs/event/create
- https://workos.com/docs/reference/audit-logs/export
- https://workos.com/docs/reference/audit-logs/export/create
- https://workos.com/docs/reference/audit-logs/export/get
- https://workos.com/docs/reference/audit-logs/retention

## Endpoint Catalog

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/events` | Create a single audit log event |
| POST | `/exports` | Create a bulk export of events |
| GET | `/exports/{export_id}` | Retrieve export status and download URL |
| POST | `/audit_log_schemas` | Define event schema (actions, actors, targets) |
| GET | `/audit_log_schemas` | List all configured schemas |
| GET | `/audit_log_schemas/{schema_id}/actions` | List actions for a specific schema |
| GET | `/audit_log_retention` | Get current retention policy |
| PUT | `/audit_log_retention` | Update retention policy (days) |

## Authentication

Include your API key in the `Authorization` header for all requests:

```
Authorization: Bearer sk_your_api_key
```

Verify your key starts with `sk_` (not `pk_` which is for client-side use).

## Operation Decision Tree

**Creating Events:**
- Use `POST /events` for real-time event ingestion
- Events are immutable once created — no update or delete endpoints exist
- Use bulk exports for retrieval, not individual event fetching

**Schema Management:**
- Define schemas BEFORE creating events — events reference schema IDs
- Use `POST /audit_log_schemas` once during setup
- Use `GET /audit_log_schemas` to retrieve existing schema for event creation

**Exporting Events:**
- Use `POST /exports` to request a CSV export of events
- Poll `GET /exports/{export_id}` until `state: "ready"`
- Download from the `url` field in the response

**Retention Configuration:**
- Use `GET /audit_log_retention` to check current policy
- Use `PUT /audit_log_retention` to change retention period
- Retention applies organization-wide, not per-schema

## Request/Response Patterns

### Create an Event

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "event": {
      "action": "user.login",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "type": "user",
        "id": "user_456",
        "name": "Alice Smith"
      },
      "targets": [{
        "type": "account",
        "id": "acct_789"
      }],
      "context": {
        "location": "192.168.1.1",
        "user_agent": "Mozilla/5.0"
      }
    }
  }'
```

**Response (201 Created):**
```json
{
  "id": "event_01H1XQZJXYZ123",
  "object": "event",
  "action": "user.login",
  "occurred_at": "2024-01-15T10:30:00Z",
  "actor": { ... },
  "targets": [ ... ],
  "context": { ... }
}
```

### Create an Export

```bash
curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.login", "user.logout"]
  }'
```

**Response (201 Created):**
```json
{
  "id": "audit_log_export_01H1XYZ",
  "object": "audit_log_export",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T10:35:00Z"
}
```

### Poll Export Status

```bash
curl -X GET https://api.workos.com/exports/audit_log_export_01H1XYZ \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (200 OK when ready):**
```json
{
  "id": "audit_log_export_01H1XYZ",
  "object": "audit_log_export",
  "state": "ready",
  "url": "https://workos-exports.s3.amazonaws.com/signed-url",
  "created_at": "2024-01-15T10:35:00Z",
  "updated_at": "2024-01-15T10:37:00Z"
}
```

**States:** `pending` → `ready` or `error`

### Define Schema (One-Time Setup)

```bash
curl -X POST https://api.workos.com/audit_log_schemas \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "name": "User Management",
    "actions": [
      { "name": "user.login", "description": "User logged in" },
      { "name": "user.logout", "description": "User logged out" }
    ]
  }'
```

## Error Code Mapping

| Status | Cause | Fix |
| ------ | ----- | --- |
| 400 | Invalid `organization_id` format | Verify ID starts with `org_` |
| 400 | Missing required field (`action`, `occurred_at`) | Include all mandatory event fields |
| 400 | Invalid ISO 8601 timestamp in `occurred_at` | Use format `YYYY-MM-DDTHH:MM:SSZ` |
| 401 | Invalid or missing API key | Check `Authorization: Bearer sk_...` header |
| 401 | API key lacks audit log permissions | Regenerate key in WorkOS Dashboard |
| 403 | Organization not enabled for audit logs | Enable in WorkOS Dashboard > Audit Logs |
| 404 | Export ID not found | Verify export was created successfully |
| 422 | Event references undefined action | Create schema with action before sending events |
| 429 | Rate limit exceeded (100 req/sec per org) | Implement exponential backoff starting at 1 second |
| 500 | WorkOS internal error | Retry with exponential backoff; contact support if persistent |

## Rate Limits

- **Event creation:** 100 requests/second per organization
- **Exports:** 10 concurrent exports per organization
- **Schema operations:** 10 requests/minute per organization

**Retry Strategy for 429:**
```
Wait = min(base_delay * 2^attempt, 60)
base_delay = 1 second
max_attempts = 5
```

## Pagination

Audit log exports return ALL matching events as a single CSV file. There is no pagination for the export endpoints themselves.

For schema listings (`GET /audit_log_schemas`), pagination follows standard WorkOS patterns:

```bash
curl -X GET "https://api.workos.com/audit_log_schemas?limit=10&after=schema_xyz" \
  -H "Authorization: Bearer sk_your_api_key"
```

Response includes `list_metadata` with `before` and `after` cursors.

## Verification Commands

### Test Event Creation

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "event": {
      "action": "test.ping",
      "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "actor": {
        "type": "system",
        "id": "test_runner"
      }
    }
  }' | jq .
```

**Expected:** 201 status with event ID in response.

### Test Export Creation

```bash
EXPORT_ID=$(curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-12-31T23:59:59Z"
  }' | jq -r .id)

echo "Export ID: $EXPORT_ID"

# Poll until ready
while true; do
  STATE=$(curl -s -X GET https://api.workos.com/exports/$EXPORT_ID \
    -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r .state)
  echo "State: $STATE"
  [[ "$STATE" == "ready" ]] && break
  sleep 2
done

# Retrieve download URL
curl -X GET https://api.workos.com/exports/$EXPORT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r .url
```

**Expected:** URL to CSV file with audit log events.

## SDK Usage Examples

### Node.js

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create event
const event = await workos.auditLogs.createEvent({
  organizationId: 'org_123',
  event: {
    action: 'user.login',
    occurredAt: new Date().toISOString(),
    actor: {
      type: 'user',
      id: 'user_456'
    }
  }
});

// Create export
const exportObj = await workos.auditLogs.createExport({
  organizationId: 'org_123',
  rangeStart: '2024-01-01T00:00:00Z',
  rangeEnd: '2024-01-31T23:59:59Z'
});

// Poll export
let result = await workos.auditLogs.getExport(exportObj.id);
while (result.state === 'pending') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  result = await workos.auditLogs.getExport(exportObj.id);
}

console.log('Download URL:', result.url);
```

### Python

```python
from workos import WorkOSClient
from datetime import datetime

client = WorkOSClient(api_key=os.environ['WORKOS_API_KEY'])

# Create event
event = client.audit_logs.create_event(
    organization_id='org_123',
    event={
        'action': 'user.login',
        'occurred_at': datetime.utcnow().isoformat() + 'Z',
        'actor': {
            'type': 'user',
            'id': 'user_456'
        }
    }
)

# Create and poll export
export = client.audit_logs.create_export(
    organization_id='org_123',
    range_start='2024-01-01T00:00:00Z',
    range_end='2024-01-31T23:59:59Z'
)

import time
while export.state == 'pending':
    time.sleep(2)
    export = client.audit_logs.get_export(export.id)

print(f"Download URL: {export.url}")
```

## Common Patterns

### Batch Event Ingestion

Events are created individually. For high-volume ingestion, use async queues:

```javascript
const queue = [];
const BATCH_SIZE = 100;

async function flushQueue() {
  const batch = queue.splice(0, BATCH_SIZE);
  await Promise.all(
    batch.map(event => workos.auditLogs.createEvent(event))
  );
}

// Call flushQueue() periodically or when queue reaches threshold
```

### Scheduled Exports

Export events daily for long-term storage:

```javascript
// Run as cron job
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);

const today = new Date();
today.setHours(0, 0, 0, 0);

const exportObj = await workos.auditLogs.createExport({
  organizationId: 'org_123',
  rangeStart: yesterday.toISOString(),
  rangeEnd: today.toISOString()
});

// Poll and download to S3/GCS
```

### Retention Policy Management

```bash
# Check current retention
curl -X GET https://api.workos.com/audit_log_retention \
  -H "Authorization: Bearer sk_your_api_key"

# Set to 90 days
curl -X PUT https://api.workos.com/audit_log_retention \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{ "retention_days": 90 }'
```

## Troubleshooting

**Events not appearing in exports:**
- Verify `occurred_at` is within export date range
- Check `organization_id` matches between event creation and export request
- Confirm schema was created before events

**Export stuck in `pending` state:**
- Large date ranges (>1 year) may take 5-10 minutes
- Check export ID is correct
- If stuck >15 minutes, contact WorkOS support with export ID

**422 error on event creation:**
- The `action` field must match an action defined in your schema
- Fetch schema actions: `GET /audit_log_schemas/{schema_id}/actions`
- If action is missing, update schema or use existing action

## Related Skills

- workos-audit-logs (feature overview and integration patterns)
- workos-api-events (webhooks for real-time event notifications)
- workos-admin-portal (UI for viewing audit logs)
