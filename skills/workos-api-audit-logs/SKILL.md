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

All API requests require authentication via API key in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key_here
```

Obtain your API key from the WorkOS Dashboard. The key must start with `sk_` prefix.

## Endpoint Catalog

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| Create Event | POST | `/events` | Log a single audit event |
| Create Export | POST | `/audit_logs/exports` | Generate CSV export of events |
| Get Export | GET | `/audit_logs/exports/{export_id}` | Check export status and download URL |
| Get Retention | GET | `/organizations/{org_id}/audit_logs/retention` | Retrieve retention period |
| Set Retention | PUT | `/organizations/{org_id}/audit_logs/retention` | Update retention period |
| Create Schema | POST | `/audit_logs/schemas` | Define custom event schema |
| List Schemas | GET | `/audit_logs/schemas` | Retrieve all schemas |
| List Actions | GET | `/audit_logs/schemas/actions` | Get available action types |

## Operation Decision Tree

**To log an audit event:**
- Use `POST /events` — creates a single event immediately

**To retrieve historical events:**
- Use `POST /audit_logs/exports` to request export
- Poll `GET /audit_logs/exports/{export_id}` until status is `ready`
- Download from the `url` field in response

**To manage data retention:**
- Use `GET /organizations/{org_id}/audit_logs/retention` to check current setting
- Use `PUT /organizations/{org_id}/audit_logs/retention` to update (default: 90 days)

**To define custom event types:**
- Use `POST /audit_logs/schemas` to create schema
- Use `GET /audit_logs/schemas` to list existing schemas
- Use `GET /audit_logs/schemas/actions` to see available action types

## Request/Response Patterns

### Create Audit Event

```bash
curl https://api.workos.com/events \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "event": {
      "action": "user.login",
      "occurred_at": "2024-01-15T09:30:00Z",
      "actor": {
        "type": "user",
        "id": "user_01EHQMVDZ6QHGF8W9J5XTHQJKD"
      },
      "targets": [{
        "type": "team",
        "id": "team_01EHQMVDZ6QHGF8W9J5XTHQJKE"
      }],
      "context": {
        "location": "192.0.2.1",
        "user_agent": "Mozilla/5.0"
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

### Create Export

```bash
curl https://api.workos.com/audit_logs/exports \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.login", "user.logout"]
  }'
```

**Response (201 Created):**
```json
{
  "object": "audit_log_export",
  "id": "audit_log_export_01EHQN0Z6E5VNQJG8F4D3YZVHJ",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T09:30:00.000Z",
  "updated_at": "2024-01-15T09:30:00.000Z"
}
```

### Get Export Status

```bash
curl https://api.workos.com/audit_logs/exports/audit_log_export_01EHQN0Z6E5VNQJG8F4D3YZVHJ \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (200 OK) - Ready:**
```json
{
  "object": "audit_log_export",
  "id": "audit_log_export_01EHQN0Z6E5VNQJG8F4D3YZVHJ",
  "state": "ready",
  "url": "https://workos-audit-logs.s3.amazonaws.com/...",
  "created_at": "2024-01-15T09:30:00.000Z",
  "updated_at": "2024-01-15T09:32:00.000Z"
}
```

### Set Retention Period

```bash
curl https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3/audit_logs/retention \
  -X PUT \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "retention_period": 180
  }'
```

**Response (200 OK):**
```json
{
  "retention_period": 180
}
```

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 Unauthorized | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is present and key is valid |
| 403 Forbidden | API key lacks required permissions | Check key permissions in WorkOS Dashboard |
| 404 Not Found | Export ID does not exist | Verify export ID from create response; may have expired |
| 422 Unprocessable Entity | Invalid event schema | Check `organization_id` is valid; ensure `action` matches defined schema; verify `occurred_at` is ISO 8601 format |
| 429 Too Many Requests | Rate limit exceeded | Implement exponential backoff; default limit is 100 req/min per organization |
| 500 Internal Server Error | WorkOS service issue | Retry with exponential backoff; check https://status.workos.com |

### Common 422 Error Causes

**"organization_id is required"** — Missing `organization_id` field in request body

**"Invalid occurred_at format"** — Use ISO 8601 timestamp: `2024-01-15T09:30:00Z`

**"Unknown action type"** — Action must be defined in schema; call `POST /audit_logs/schemas` first

**"actor.id is required"** — Event must include actor with `type` and `id`

## Export Polling Pattern

Exports are asynchronous. Poll until `state` changes from `pending` to `ready`:

```bash
# 1. Create export
export_id=$(curl -X POST https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"org_01EHQMYV6MBK39QC5PZXHY59C3","range_start":"2024-01-01T00:00:00Z","range_end":"2024-01-31T23:59:59Z"}' \
  | jq -r '.id')

# 2. Poll every 5 seconds
while true; do
  state=$(curl https://api.workos.com/audit_logs/exports/$export_id \
    -H "Authorization: Bearer sk_your_api_key" \
    | jq -r '.state')
  
  if [ "$state" = "ready" ]; then
    url=$(curl https://api.workos.com/audit_logs/exports/$export_id \
      -H "Authorization: Bearer sk_your_api_key" \
      | jq -r '.url')
    echo "Download: $url"
    break
  fi
  
  sleep 5
done
```

Exports typically complete in 10-60 seconds depending on event volume. URLs expire after 1 hour.

## Rate Limits

- **Default limit:** 100 requests per minute per organization
- **Event creation:** Burst up to 1000 events/second supported
- **Export creation:** Max 10 concurrent exports per organization

**Retry strategy on 429:**
```
Wait = min(60, 2^attempt) seconds
Max attempts = 5
```

## Verification Commands

### Test Event Creation

```bash
curl https://api.workos.com/events \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "event": {
      "action": "user.test",
      "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "actor": {
        "type": "user",
        "id": "test_user"
      },
      "targets": [{
        "type": "system",
        "id": "verification"
      }]
    }
  }' | jq
```

**Expected:** `{"success": true}` with 201 status

### Test Export Creation

```bash
curl https://api.workos.com/audit_logs/exports \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'"$WORKOS_ORG_ID"'",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }' | jq
```

**Expected:** Response with `"state": "pending"` and export ID

### Test Authentication

```bash
curl https://api.workos.com/audit_logs/schemas \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq
```

**Expected:** 200 status with schemas array (may be empty)

## SDK Usage Patterns

### Node.js

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create event
await workos.auditLogs.createEvent({
  organizationId: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
  event: {
    action: 'user.login',
    occurredAt: new Date().toISOString(),
    actor: { type: 'user', id: 'user_123' },
    targets: [{ type: 'team', id: 'team_456' }],
    context: { location: req.ip }
  }
});

// Create and poll export
const exportObj = await workos.auditLogs.createExport({
  organizationId: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
  rangeStart: '2024-01-01T00:00:00Z',
  rangeEnd: '2024-01-31T23:59:59Z'
});

// Poll until ready
let status = await workos.auditLogs.getExport(exportObj.id);
while (status.state === 'pending') {
  await new Promise(resolve => setTimeout(resolve, 5000));
  status = await workos.auditLogs.getExport(exportObj.id);
}
console.log('Download URL:', status.url);
```

### Python

```python
from workos import WorkOSClient
import os
import time

client = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Create event
client.audit_logs.create_event(
    organization_id='org_01EHQMYV6MBK39QC5PZXHY59C3',
    event={
        'action': 'user.login',
        'occurred_at': '2024-01-15T09:30:00Z',
        'actor': {'type': 'user', 'id': 'user_123'},
        'targets': [{'type': 'team', 'id': 'team_456'}]
    }
)

# Create and poll export
export_obj = client.audit_logs.create_export(
    organization_id='org_01EHQMYV6MBK39QC5PZXHY59C3',
    range_start='2024-01-01T00:00:00Z',
    range_end='2024-01-31T23:59:59Z'
)

while True:
    status = client.audit_logs.get_export(export_obj.id)
    if status.state == 'ready':
        print(f'Download URL: {status.url}')
        break
    time.sleep(5)
```

## Related Skills

- **workos-audit-logs** — Feature overview and integration guide for Audit Logs
- **workos-api-organizations** — Managing organizations that own audit events
- **workos-api-events** — Webhook events for audit log changes (if applicable)
