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

| Method | Path                                          | Purpose                                         |
| ------ | --------------------------------------------- | ----------------------------------------------- |
| POST   | `/events`                                     | Create a single audit log event                 |
| POST   | `/exports`                                    | Create an export of audit log events            |
| GET    | `/exports/:id`                                | Retrieve an export by ID                        |
| GET    | `/events/schemas`                             | List all audit log schemas                      |
| POST   | `/events/schemas`                             | Create a new audit log schema                   |
| GET    | `/events/schemas/:id/actions`                 | List actions for a schema                       |
| GET    | `/organizations/:id/audit_logs/configuration` | Get audit log configuration for an organization |
| GET    | `/organizations/:id/audit_logs/retention`     | Get retention policy for an organization        |
| PUT    | `/organizations/:id/audit_logs/retention`     | Set retention policy for an organization        |

## Authentication

All API calls require an API key in the `Authorization` header:

```bash
Authorization: Bearer sk_test_your_key_here
```

Get your API key from the WorkOS Dashboard. Use `sk_test_` keys for development and `sk_live_` keys for production.

## Operation Decision Tree

**I need to...**

- **Record an event** → POST `/events` (create event)
- **Bulk export events for analysis** → POST `/exports` then GET `/exports/:id` (create + poll export)
- **Check what events I can log** → GET `/events/schemas` (list schemas)
- **Define custom event types** → POST `/events/schemas` (create schema)
- **See available actions for an event type** → GET `/events/schemas/:id/actions` (list actions)
- **Check audit log settings for an org** → GET `/organizations/:id/audit_logs/configuration` (get config)
- **View how long events are kept** → GET `/organizations/:id/audit_logs/retention` (get retention)
- **Change retention period** → PUT `/organizations/:id/audit_logs/retention` (set retention)

## Request/Response Patterns

### Create Audit Log Event

**POST** `/events`

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "event": {
      "action": "user.signed_in",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "type": "user",
        "id": "user_456",
        "name": "Alice Smith"
      },
      "targets": [{
        "type": "session",
        "id": "session_789"
      }],
      "context": {
        "location": "192.0.2.1",
        "user_agent": "Mozilla/5.0..."
      }
    }
  }'
```

**Response (201 Created):**

```json
{
  "success": true
}
```

**Required Fields:**

- `organization_id` — the organization this event belongs to
- `event.action` — the action that occurred (must match schema)
- `event.occurred_at` — ISO 8601 timestamp
- `event.actor` — who performed the action
- `event.targets` — what was affected (array, can be empty)

### Create Export

**POST** `/exports`

```bash
curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.signed_in", "user.signed_out"]
  }'
```

**Response (201 Created):**

```json
{
  "object": "audit_log_export",
  "id": "export_abc123",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Export States:**

- `pending` — export is queued
- `ready` — export is complete, `url` field contains download link
- `error` — export failed

### Get Export Status

**GET** `/exports/:id`

```bash
curl https://api.workos.com/exports/export_abc123 \
  -H "Authorization: Bearer sk_test_..."
```

**Response (200 OK):**

```json
{
  "object": "audit_log_export",
  "id": "export_abc123",
  "state": "ready",
  "url": "https://exports.workos.com/...",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:00Z"
}
```

**Polling Pattern:**

Exports are asynchronous. Poll GET `/exports/:id` every 5-10 seconds until `state` is `ready` or `error`. The `url` field contains a signed download link (CSV format) valid for 10 minutes.

### List Schemas

**GET** `/events/schemas`

```bash
curl https://api.workos.com/events/schemas?organization_id=org_123 \
  -H "Authorization: Bearer sk_test_..."
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "object": "audit_log_schema",
      "id": "schema_123",
      "name": "user_events",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Schema

**POST** `/events/schemas`

```bash
curl -X POST https://api.workos.com/events/schemas \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "name": "user_events",
    "actions": [
      {
        "name": "user.signed_in",
        "description": "User successfully authenticated"
      },
      {
        "name": "user.signed_out",
        "description": "User ended their session"
      }
    ]
  }'
```

**Response (201 Created):**

```json
{
  "object": "audit_log_schema",
  "id": "schema_456",
  "name": "user_events",
  "actions": [...],
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Get Organization Configuration

**GET** `/organizations/:id/audit_logs/configuration`

```bash
curl https://api.workos.com/organizations/org_123/audit_logs/configuration \
  -H "Authorization: Bearer sk_test_..."
```

**Response (200 OK):**

```json
{
  "enabled": true,
  "retention_days": 365
}
```

### Get Retention Policy

**GET** `/organizations/:id/audit_logs/retention`

```bash
curl https://api.workos.com/organizations/org_123/audit_logs/retention \
  -H "Authorization: Bearer sk_test_..."
```

**Response (200 OK):**

```json
{
  "retention_days": 365
}
```

### Set Retention Policy

**PUT** `/organizations/:id/audit_logs/retention`

```bash
curl -X PUT https://api.workos.com/organizations/org_123/audit_logs/retention \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "retention_days": 730
  }'
```

**Response (200 OK):**

```json
{
  "retention_days": 730
}
```

**Valid Values:** 90, 180, 365, 730 days

## Error Codes and Fixes

| Status | Error Code            | Cause                                                            | Fix                                                       |
| ------ | --------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| 400    | `invalid_request`     | Missing required field (e.g., `organization_id`, `event.action`) | Check request body includes all required fields per docs  |
| 401    | `unauthorized`        | Missing or invalid API key                                       | Verify `Authorization: Bearer sk_...` header is set       |
| 403    | `forbidden`           | API key lacks permission for this operation                      | Check key has "Audit Logs" scope in WorkOS Dashboard      |
| 404    | `not_found`           | Export ID, schema ID, or organization ID does not exist          | Verify resource ID is correct and belongs to your account |
| 422    | `validation_error`    | Invalid field value (e.g., bad timestamp format, unknown action) | Check `occurred_at` is ISO 8601, `action` matches schema  |
| 429    | `rate_limit_exceeded` | Too many requests                                                | Implement exponential backoff, wait 60s before retry      |
| 500    | `server_error`        | WorkOS internal error                                            | Retry with exponential backoff (2s, 4s, 8s)               |

**Common Validation Errors:**

- **"Action not found in schema"** → The `event.action` value doesn't exist in your schema. Create it via POST `/events/schemas` first.
- **"occurred_at must be in the past"** → `occurred_at` timestamp is in the future. Use current or past time only.
- **"Invalid ISO 8601 timestamp"** → Use format `YYYY-MM-DDTHH:MM:SSZ` (e.g., `2024-01-15T10:30:00Z`).

## Rate Limits

- **Default limit:** 100 requests per second per API key
- **Export limit:** 10 concurrent exports per organization

**Retry Strategy:**

When you receive a 429 response:

1. Extract `Retry-After` header value (seconds)
2. Wait that duration before retrying
3. If no `Retry-After` header, use exponential backoff starting at 60s

## Pagination

Audit log event listing is NOT directly supported via the API. To retrieve historical events:

1. Use POST `/exports` to create an export
2. Poll GET `/exports/:id` until `state` is `ready`
3. Download the CSV from the `url` field
4. Parse the CSV for event data

Exports are limited to 1 million events per request. For larger datasets, create multiple exports with different date ranges.

## Runnable Verification

**1. Create a test event:**

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "event": {
      "action": "user.signed_in",
      "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "actor": {
        "type": "user",
        "id": "test_user",
        "name": "Test User"
      },
      "targets": []
    }
  }'
```

Expected: `{"success": true}` with 201 status

**2. List schemas:**

```bash
curl "https://api.workos.com/events/schemas?organization_id=$WORKOS_ORG_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: JSON with `"object": "list"` and `data` array

**3. Create an export:**

```bash
export EXPORT_ID=$(curl -s -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-12-31T23:59:59Z"
  }' | jq -r '.id')

echo "Export ID: $EXPORT_ID"
```

**4. Check export status:**

```bash
curl "https://api.workos.com/exports/$EXPORT_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: `"state": "pending"` initially, then `"state": "ready"` with `url` field after 10-60 seconds

## SDK Usage (Node.js Example)

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create an audit log event
await workos.auditLogs.createEvent({
  organizationId: "org_123",
  event: {
    action: "user.signed_in",
    occurredAt: new Date().toISOString(),
    actor: {
      type: "user",
      id: "user_456",
      name: "Alice Smith",
    },
    targets: [
      {
        type: "session",
        id: "session_789",
      },
    ],
    context: {
      location: "192.0.2.1",
      userAgent: req.headers["user-agent"],
    },
  },
});

// Create an export
const auditLogExport = await workos.auditLogs.createExport({
  organizationId: "org_123",
  rangeStart: "2024-01-01T00:00:00Z",
  rangeEnd: "2024-01-31T23:59:59Z",
  actions: ["user.signed_in", "user.signed_out"],
});

// Poll for export completion
let exportStatus = auditLogExport;
while (exportStatus.state === "pending") {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  exportStatus = await workos.auditLogs.getExport(auditLogExport.id);
}

if (exportStatus.state === "ready") {
  console.log("Download URL:", exportStatus.url);
}
```

## Related Skills

- workos-directory-sync.rules.yml — for syncing user/group data that might be audit logged
