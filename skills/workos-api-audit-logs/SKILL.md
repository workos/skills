---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- generated -->

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

All API calls require your WorkOS API key in the `Authorization` header:

```
Authorization: Bearer sk_live_your_api_key_here
```

Get your API key from the WorkOS Dashboard under API Keys. Use `sk_test_*` keys for development and `sk_live_*` keys for production.

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/events` | Create a single audit log event |
| POST | `/events/batch` | Create multiple audit log events (bulk) |
| POST | `/exports` | Create an export of audit log events |
| GET | `/exports/{export_id}` | Get export status and download URL |
| GET | `/audit_log_retention` | Get current retention period |
| PUT | `/audit_log_retention` | Set retention period (days) |
| POST | `/schemas` | Create an audit log schema |
| GET | `/schemas` | List all schemas for organization |
| GET | `/schemas/{schema_id}/actions` | List actions for a schema |

## Operation Decision Tree

**When to use each endpoint:**

- **Recording events** → POST `/events` (single) or POST `/events/batch` (multiple at once)
- **Exporting audit logs** → POST `/exports` to start, then GET `/exports/{id}` to check status
- **Managing retention** → GET `/audit_log_retention` to check, PUT to update
- **Defining event types** → POST `/schemas` to create, GET `/schemas` to list
- **Listing allowed actions** → GET `/schemas/{schema_id}/actions`

## Request/Response Patterns

### Create Audit Log Event

**Request:**
```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1234567890ABCDEFG",
    "event": {
      "action": "user.created",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "id": "user_123",
        "name": "Jane Doe",
        "type": "user"
      },
      "targets": [{
        "id": "user_456",
        "type": "user",
        "name": "New User"
      }],
      "context": {
        "location": "192.168.1.1",
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

### Create Export

**Request:**
```bash
curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1234567890ABCDEFG",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.created", "user.updated"],
    "actors": ["user_123"]
  }'
```

**Response (201 Created):**
```json
{
  "object": "audit_log_export",
  "id": "audit_log_export_01H1234567890ABCDEFG",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Export Status

**Request:**
```bash
curl https://api.workos.com/exports/audit_log_export_01H1234567890ABCDEFG \
  -H "Authorization: Bearer sk_live_..."
```

**Response when ready (200 OK):**
```json
{
  "object": "audit_log_export",
  "id": "audit_log_export_01H1234567890ABCDEFG",
  "state": "ready",
  "url": "https://workos-exports.s3.amazonaws.com/...",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:32:15.000Z"
}
```

### Set Retention Period

**Request:**
```bash
curl -X PUT https://api.workos.com/audit_log_retention \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1234567890ABCDEFG",
    "retention_period": 90
  }'
```

**Response (200 OK):**
```json
{
  "retention_period": 90
}
```

## Error Codes and Fixes

### 401 Unauthorized
**Cause:** Invalid or missing API key  
**Fix:** Verify your API key starts with `sk_live_` or `sk_test_` and is set correctly in the Authorization header

### 400 Bad Request - "organization_id is required"
**Cause:** Missing organization_id in request body  
**Fix:** Include the organization_id field with a valid org ID (starts with `org_`)

### 400 Bad Request - "action is not valid for schema"
**Cause:** The action name doesn't exist in your schema  
**Fix:** Create the action in your schema first via POST `/schemas`, or check GET `/schemas/{schema_id}/actions` for valid actions

### 422 Unprocessable Entity - "occurred_at must be in the past"
**Cause:** Event timestamp is in the future  
**Fix:** Use a timestamp at or before the current time in ISO 8601 format

### 429 Too Many Requests
**Cause:** Rate limit exceeded  
**Fix:** Implement exponential backoff. Wait 1s, then 2s, then 4s between retries. Use batch endpoints for bulk operations.

### 404 Not Found - Export ID
**Cause:** Export ID doesn't exist or belongs to different organization  
**Fix:** Verify the export_id matches the response from POST `/exports`. Check organization_id matches.

## Pagination

The WorkOS Audit Logs API does not paginate event creation, but exports handle large datasets automatically. When creating an export:

- Exports process asynchronously
- Poll GET `/exports/{export_id}` every 5-10 seconds until `state` is `ready`
- Download from the `url` field in the response
- Export URLs expire after 24 hours

For listing schemas:

**Request:**
```bash
curl "https://api.workos.com/schemas?limit=10&after=schema_01H123" \
  -H "Authorization: Bearer sk_live_..."
```

**Response includes:**
```json
{
  "data": [...],
  "list_metadata": {
    "after": "schema_01H456"
  }
}
```

Use the `after` cursor from `list_metadata` in the next request to fetch the next page.

## Rate Limits

- **Event creation:** 100 requests per second per organization
- **Batch events:** 1,000 events per request, 10 requests per second
- **Exports:** 5 concurrent exports per organization
- **Retry strategy:** Use exponential backoff starting at 1 second

When rate limited (429), the response includes a `Retry-After` header indicating seconds to wait.

## Verification Commands

### Test Event Creation
```bash
# Replace with your actual API key and org ID
export WORKOS_API_KEY="sk_test_..."
export ORG_ID="org_01H..."

curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"event\": {
      \"action\": \"test.verification\",
      \"occurred_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"actor\": {
        \"id\": \"test_actor\",
        \"type\": \"user\"
      },
      \"targets\": [{
        \"id\": \"test_target\",
        \"type\": \"resource\"
      }]
    }
  }"

# Should return: {"success":true}
```

### Test Export Creation and Retrieval
```bash
# Create export
EXPORT_RESPONSE=$(curl -s -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"range_start\": \"2024-01-01T00:00:00Z\",
    \"range_end\": \"2024-12-31T23:59:59Z\"
  }")

EXPORT_ID=$(echo $EXPORT_RESPONSE | jq -r '.id')
echo "Export created: $EXPORT_ID"

# Poll until ready
while true; do
  STATUS=$(curl -s https://api.workos.com/exports/$EXPORT_ID \
    -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.state')
  echo "Export state: $STATUS"
  if [ "$STATUS" = "ready" ]; then
    break
  fi
  sleep 5
done

# Get download URL
curl -s https://api.workos.com/exports/$EXPORT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.url'
```

### Test Retention Settings
```bash
# Get current retention
curl https://api.workos.com/audit_log_retention?organization_id=$ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Set retention to 90 days
curl -X PUT https://api.workos.com/audit_log_retention \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"retention_period\": 90
  }"
```

## SDK Examples

### Node.js
```javascript
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create event
await workos.auditLogs.createEvent({
  organizationId: 'org_01H...',
  event: {
    action: 'user.created',
    occurredAt: new Date().toISOString(),
    actor: {
      id: 'user_123',
      type: 'user'
    },
    targets: [{
      id: 'user_456',
      type: 'user'
    }]
  }
});

// Create and download export
const exportObj = await workos.auditLogs.createExport({
  organizationId: 'org_01H...',
  rangeStart: '2024-01-01T00:00:00Z',
  rangeEnd: '2024-01-31T23:59:59Z'
});

// Poll until ready
let exportStatus = await workos.auditLogs.getExport(exportObj.id);
while (exportStatus.state !== 'ready') {
  await new Promise(resolve => setTimeout(resolve, 5000));
  exportStatus = await workos.auditLogs.getExport(exportObj.id);
}
console.log('Download URL:', exportStatus.url);
```

### Python
```python
from workos import WorkOSClient
import os
import time

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Create event
workos.audit_logs.create_event(
    organization_id='org_01H...',
    event={
        'action': 'user.created',
        'occurred_at': '2024-01-15T10:30:00Z',
        'actor': {
            'id': 'user_123',
            'type': 'user'
        },
        'targets': [{
            'id': 'user_456',
            'type': 'user'
        }]
    }
)

# Create export
export = workos.audit_logs.create_export(
    organization_id='org_01H...',
    range_start='2024-01-01T00:00:00Z',
    range_end='2024-01-31T23:59:59Z'
)

# Poll until ready
while True:
    export_status = workos.audit_logs.get_export(export.id)
    if export_status.state == 'ready':
        print(f'Download URL: {export_status.url}')
        break
    time.sleep(5)
```

## Common Integration Patterns

### Recording User Actions
Emit events whenever users perform sensitive operations:
```javascript
// After successful user creation
await workos.auditLogs.createEvent({
  organizationId: user.organizationId,
  event: {
    action: 'user.created',
    occurredAt: new Date().toISOString(),
    actor: { id: currentUser.id, type: 'user' },
    targets: [{ id: newUser.id, type: 'user' }],
    context: {
      location: req.ip,
      user_agent: req.headers['user-agent']
    }
  }
});
```

### Scheduled Export Generation
Create exports nightly for compliance:
```javascript
// Cron job running daily at 2 AM
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);

const today = new Date(yesterday);
today.setDate(today.getDate() + 1);

const exportObj = await workos.auditLogs.createExport({
  organizationId: org.id,
  rangeStart: yesterday.toISOString(),
  rangeEnd: today.toISOString()
});

// Store export ID for later retrieval
await db.exports.create({
  workosExportId: exportObj.id,
  organizationId: org.id,
  date: yesterday
});
```

### Bulk Event Ingestion
Use batch endpoint for importing historical data:
```javascript
const events = historicalActions.map(action => ({
  action: action.type,
  occurredAt: action.timestamp,
  actor: { id: action.userId, type: 'user' },
  targets: action.targets
}));

// Process in chunks of 1000
for (let i = 0; i < events.length; i += 1000) {
  const batch = events.slice(i, i + 1000);
  await workos.auditLogs.createEvents({
    organizationId: 'org_01H...',
    events: batch
  });
  await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit safety
}
```

## Related Skills

- **workos-audit-logs** - Feature overview and implementation guide for Audit Logs
- **workos-api-organizations** - Managing organizations that own audit logs
- **workos-api-webhooks** - Receiving real-time notifications for audit log events
