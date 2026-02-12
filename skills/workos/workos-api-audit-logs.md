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

## Authentication

All requests require a bearer token using your WorkOS API key:

```bash
Authorization: Bearer sk_live_xxxxx
```

Store your API key in `WORKOS_API_KEY` environment variable. The key must start with `sk_test_` (development) or `sk_live_` (production).

## Endpoint Catalog

| Method | Endpoint                                  | Purpose                                 |
| ------ | ----------------------------------------- | --------------------------------------- |
| POST   | `/events`                                 | Create a single audit log event         |
| POST   | `/audit_logs/exports`                     | Request a CSV export of audit logs      |
| GET    | `/audit_logs/exports/:id`                 | Retrieve export status and download URL |
| GET    | `/organizations/:id/audit_logs/retention` | Get current retention policy            |
| PUT    | `/organizations/:id/audit_logs/retention` | Set retention period (30-2555 days)     |
| POST   | `/audit_logs/schemas`                     | Create or update action schema          |
| GET    | `/audit_logs/schemas`                     | List all schemas for an organization    |
| GET    | `/audit_logs/schemas/:id/actions`         | List actions within a schema            |

## Operation Decision Tree

**Creating audit log events:**

- Use `POST /events` to record a single action (e.g., user.login, file.deleted)
- Event creation is synchronous — no polling needed

**Exporting historical logs:**

1. Call `POST /audit_logs/exports` with filters (date range, actors, targets)
2. Receive an export ID immediately
3. Poll `GET /audit_logs/exports/:id` until status is `ready`
4. Download CSV from the `url` field in response

**Managing retention:**

- Use `GET /organizations/:id/audit_logs/retention` to check current policy
- Use `PUT /organizations/:id/audit_logs/retention` to update (requires organization ID)

**Defining schemas:**

- Use `POST /audit_logs/schemas` to register custom action types
- Use `GET /audit_logs/schemas` to list existing schemas
- Use `GET /audit_logs/schemas/:id/actions` to enumerate actions in a schema

## Request/Response Patterns

### Create Audit Log Event

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "event": {
      "action": "user.login",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "type": "user",
        "id": "user_456",
        "name": "alice@example.com"
      },
      "targets": [{
        "type": "team",
        "id": "team_789"
      }],
      "context": {
        "location": "192.0.2.1",
        "user_agent": "Mozilla/5.0"
      }
    }
  }'
```

**Success Response (201):**

```json
{
  "success": true
}
```

### Create Export

```bash
curl https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.login", "user.logout"]
  }'
```

**Success Response (201):**

```json
{
  "object": "audit_logs_export",
  "id": "audit_logs_export_01HQ",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Export Status

```bash
curl https://api.workos.com/audit_logs/exports/audit_logs_export_01HQ \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Success Response (200):**

```json
{
  "object": "audit_logs_export",
  "id": "audit_logs_export_01HQ",
  "state": "ready",
  "url": "https://workos-audit-logs.s3.amazonaws.com/...",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:35:00.000Z"
}
```

**States:** `pending` → `ready` (success) or `error` (failure)

### Set Retention Policy

```bash
curl -X PUT https://api.workos.com/organizations/org_123/audit_logs/retention \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "retention_period": 365
  }'
```

**Success Response (200):**

```json
{
  "retention_period": 365
}
```

Retention period must be between 30 and 2555 days.

## Error Code Mapping

| Status | Cause                                                | Fix                                                        |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------- |
| 400    | Invalid `occurred_at` format                         | Use ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SSZ)              |
| 400    | Retention period out of range                        | Set `retention_period` between 30–2555 days                |
| 401    | Missing or invalid API key                           | Check `Authorization: Bearer sk_...` header                |
| 403    | API key lacks audit log permissions                  | Generate new key in WorkOS Dashboard with audit log access |
| 404    | Export ID not found                                  | Verify export ID from creation response                    |
| 404    | Organization ID invalid                              | Confirm organization exists in WorkOS Dashboard            |
| 422    | Missing required field (`organization_id`, `action`) | Include all required fields per docs                       |
| 422    | Invalid `action` value                               | Action must match schema (see `/audit_logs/schemas`)       |
| 429    | Rate limit exceeded                                  | Retry after 60 seconds with exponential backoff            |
| 500    | WorkOS service error                                 | Retry request; contact support if persists                 |

## Export Pagination

Exports are NOT paginated — a single export request generates one CSV file containing all matching events. To avoid timeouts:

- Limit exports to 90-day windows
- Use `actions` filter to narrow scope
- Poll export status every 5 seconds (exports typically complete in 30–120 seconds)

Event listing via API is not supported — use exports or WorkOS Dashboard.

## Rate Limits

- Event creation: 100 requests/minute per organization
- Export creation: 10 requests/minute per organization
- Export status polling: No documented limit (recommended: 5s intervals)

When hitting 429:

1. Extract `Retry-After` header if present
2. Wait specified seconds (or default to 60s)
3. Retry with exponential backoff (60s → 120s → 240s)

## SDK Verification

### Node.js

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create event
await workos.auditLogs.createEvent({
  organizationId: "org_123",
  event: {
    action: "document.updated",
    occurredAt: new Date().toISOString(),
    actor: {
      type: "user",
      id: "user_456",
      name: "alice@example.com",
    },
    targets: [
      {
        type: "document",
        id: "doc_789",
      },
    ],
    context: {
      location: "192.0.2.1",
      user_agent: req.headers["user-agent"],
    },
  },
});

// Create export
const exportJob = await workos.auditLogs.createExport({
  organizationId: "org_123",
  rangeStart: "2024-01-01T00:00:00Z",
  rangeEnd: "2024-01-31T23:59:59Z",
});

console.log(`Export ID: ${exportJob.id}`);
```

### Python

```python
from workos import WorkOSClient
import os

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Create event
workos.audit_logs.create_event(
    organization_id='org_123',
    event={
        'action': 'document.updated',
        'occurred_at': '2024-01-15T10:30:00Z',
        'actor': {
            'type': 'user',
            'id': 'user_456',
            'name': 'alice@example.com'
        },
        'targets': [{
            'type': 'document',
            'id': 'doc_789'
        }]
    }
)
```

### cURL Verification

Test event creation:

```bash
#!/bin/bash
RESPONSE=$(curl -s -w "\n%{http_code}" https://api.workos.com/events \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "event": {
      "action": "test.verification",
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "actor": {"type": "user", "id": "test_user"}
    }
  }')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "201" ]; then
  echo "✓ Event created successfully"
else
  echo "✗ Event creation failed (HTTP $STATUS)"
  echo "$BODY"
fi
```

## Common Integration Patterns

### Async Export Workflow

```javascript
async function exportAuditLogs(organizationId, startDate, endDate) {
  // 1. Request export
  const exportJob = await workos.auditLogs.createExport({
    organizationId,
    rangeStart: startDate,
    rangeEnd: endDate,
  });

  // 2. Poll until ready
  let attempt = 0;
  while (attempt < 60) {
    // 5 minutes max
    const status = await workos.auditLogs.getExport(exportJob.id);

    if (status.state === "ready") {
      return status.url; // Download URL
    }
    if (status.state === "error") {
      throw new Error("Export failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempt++;
  }

  throw new Error("Export timeout");
}
```

### Batch Event Creation

```javascript
// DO NOT batch — send events individually
// WorkOS API does not support batch event endpoints

for (const action of actions) {
  await workos.auditLogs.createEvent({
    organizationId: "org_123",
    event: {
      action: action.type,
      occurredAt: action.timestamp,
      actor: action.actor,
      targets: action.targets,
    },
  });

  // Respect rate limits
  await sleep(600); // 100/min = 1 per 600ms
}
```

## Related Skills

- workos-audit-logs (feature guide — context on retention, schemas, actors)
