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

## Authentication Setup

Set your WorkOS API key in request headers:

```
Authorization: Bearer sk_live_...
```

Your API key is available in the WorkOS Dashboard. All requests require authentication via bearer token.

## Operation Decision Tree

| Task | Endpoint | Method |
| ---- | -------- | ------ |
| Record a single audit log event | `/events` | POST |
| Create bulk export of events | `/exports` | POST |
| Check export status | `/exports/:id` | GET |
| Get current retention period | `/retention` | GET |
| Set retention period | `/retention` | PUT |
| Create audit log schema | `/schemas` | POST |
| List all schemas | `/schemas` | GET |
| List actions for a schema | `/schemas/:id/actions` | GET |

## Core Endpoint Patterns

### Create Audit Log Event

**POST** `/events`

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
    "event": {
      "action": "user.created",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "id": "user_123",
        "type": "user",
        "name": "Alice Smith"
      },
      "targets": [{
        "id": "user_456",
        "type": "user"
      }],
      "context": {
        "location": "192.0.2.1",
        "user_agent": "Mozilla/5.0"
      }
    }
  }'
```

**Required fields:**
- `organization_id`: Organization receiving the event
- `event.action`: Action identifier (must match schema if defined)
- `event.occurred_at`: ISO 8601 timestamp
- `event.actor`: Entity performing the action

**Response (202 Accepted):**
```json
{
  "success": true
}
```

### Create Export

**POST** `/exports`

```bash
curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z",
    "actions": ["user.created", "user.deleted"]
  }'
```

**Required fields:**
- `organization_id`: Organization to export events from
- `range_start`: Start of time range (ISO 8601)
- `range_end`: End of time range (ISO 8601)

**Response (201 Created):**
```json
{
  "id": "export_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
  "state": "pending",
  "url": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Get Export Status

**GET** `/exports/:id`

```bash
curl https://api.workos.com/exports/export_01H1QNWFZJ6G8Z5VQXB9K3YXYZ \
  -H "Authorization: Bearer sk_live_..."
```

**Response (200 OK):**
```json
{
  "id": "export_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
  "state": "ready",
  "url": "https://workos-exports.s3.amazonaws.com/...",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:00Z"
}
```

**Export states:**
- `pending`: Export is being prepared
- `ready`: Export is complete, `url` contains download link
- `error`: Export failed

### Get Retention Period

**GET** `/retention?organization_id=org_123`

```bash
curl "https://api.workos.com/retention?organization_id=org_01H1QNWFZJ6G8Z5VQXB9K3YXYZ" \
  -H "Authorization: Bearer sk_live_..."
```

**Response (200 OK):**
```json
{
  "days": 30
}
```

### Set Retention Period

**PUT** `/retention`

```bash
curl -X PUT https://api.workos.com/retention \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
    "days": 90
  }'
```

**Required fields:**
- `organization_id`: Organization to configure
- `days`: Retention period (1-365)

**Response (200 OK):**
```json
{
  "days": 90
}
```

### Create Schema

**POST** `/schemas`

```bash
curl -X POST https://api.workos.com/schemas \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_events",
    "actions": [
      {
        "name": "user.created",
        "description": "A new user account was created"
      },
      {
        "name": "user.deleted",
        "description": "A user account was deleted"
      }
    ]
  }'
```

**Required fields:**
- `name`: Schema identifier
- `actions`: Array of action definitions with `name` and optional `description`

**Response (201 Created):**
```json
{
  "id": "schema_01H1QNWFZJ6G8Z5VQXB9K3YXYZ",
  "name": "user_events",
  "actions": [...]
}
```

## Error Codes and Resolution

| Status | Error | Cause | Fix |
| ------ | ----- | ----- | --- |
| 400 | `invalid_request` | Missing required field | Check request body against endpoint schema |
| 400 | `invalid_action` | Action not in schema | Use action from schema or create schema first |
| 401 | `unauthorized` | Missing or invalid API key | Verify `Authorization: Bearer sk_live_...` header |
| 404 | `export_not_found` | Invalid export ID | Check export ID from creation response |
| 422 | `invalid_date_range` | `range_end` before `range_start` | Ensure `range_start` < `range_end` |
| 422 | `invalid_retention_days` | Days outside 1-365 range | Set retention between 1 and 365 days |
| 429 | `rate_limit_exceeded` | Too many requests | Implement exponential backoff (start with 1s delay) |

## Pagination

The List Schemas endpoint supports pagination via cursor-based tokens:

**Request:**
```bash
curl "https://api.workos.com/schemas?limit=10&after=schema_cursor_xyz" \
  -H "Authorization: Bearer sk_live_..."
```

**Response:**
```json
{
  "data": [...],
  "list_metadata": {
    "after": "schema_cursor_abc"
  }
}
```

Use the `after` value from `list_metadata` for the next page. When `list_metadata.after` is null, you've reached the end.

## Rate Limits

The Audit Logs API enforces these limits:

- **Event creation**: 100 requests per second per organization
- **Exports**: 10 concurrent exports per organization
- **Other endpoints**: 60 requests per minute per API key

When rate limited (429 response), retry with exponential backoff starting at 1 second.

## Verification Commands

Test your integration with these curl commands:

```bash
# 1. Create a test event
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_test_123",
    "event": {
      "action": "test.event",
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "actor": {
        "id": "test_user",
        "type": "user",
        "name": "Test User"
      },
      "targets": [{"id": "test_target", "type": "resource"}]
    }
  }'
# Expected: 202 Accepted with {"success": true}

# 2. Check retention settings
curl "https://api.workos.com/retention?organization_id=org_test_123" \
  -H "Authorization: Bearer sk_test_..."
# Expected: 200 OK with {"days": <number>}

# 3. Create test export
curl -X POST https://api.workos.com/exports \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_test_123",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
# Expected: 201 Created with export ID
```

## SDK Usage Pattern

WebFetch https://workos.com/docs/reference/audit-logs for current SDK method names and examples.

The general SDK pattern follows this structure:

```javascript
// Initialize client
const workos = new WorkOS('sk_live_...');

// Create event (WebFetch for exact method signature)
const result = await workos.auditLogs.createEvent({
  organizationId: 'org_123',
  event: { /* event data */ }
});

// Create export (WebFetch for exact method signature)
const exportObj = await workos.auditLogs.createExport({
  organizationId: 'org_123',
  rangeStart: '2024-01-01T00:00:00Z',
  rangeEnd: '2024-01-31T23:59:59Z'
});

// Poll export status
const status = await workos.auditLogs.getExport(exportObj.id);
```

## Related Skills

- **workos-audit-logs** — Feature overview and implementation guide
- **workos-api-events** — Events API for webhook-based audit log delivery
- **workos-api-organization** — Organization management for audit log scoping
