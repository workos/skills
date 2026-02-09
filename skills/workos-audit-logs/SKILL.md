---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- generated -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. `https://workos.com/docs/audit-logs/index`
2. `https://workos.com/docs/audit-logs/metadata-schema`
3. `https://workos.com/docs/audit-logs/log-streams`
4. `https://workos.com/docs/audit-logs/exporting-events`
5. `https://workos.com/docs/audit-logs/editing-events`
6. `https://workos.com/docs/audit-logs/admin-portal`

If this skill conflicts with documentation, follow documentation.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check environment variables exist:

```bash
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing WorkOS credentials"
```

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` or `project_`

### SDK Installation

Detect package manager and verify WorkOS SDK installed:

```bash
# Check if SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || \
ls node_modules/workos 2>/dev/null || \
echo "FAIL: WorkOS SDK not installed"
```

If missing, install based on package manager:

```bash
# npm
npm install @workos-inc/node

# yarn
yarn add @workos-inc/node

# pnpm
pnpm add @workos-inc/node
```

## Step 3: Implementation Path (Decision Tree)

Choose your integration approach:

```
What are you building?
  |
  +-- Emitting audit events from app --> Go to Step 4
  |
  +-- Setting up Log Streams for customers --> Go to Step 5
  |
  +-- Defining metadata schemas --> Go to Step 6
  |
  +-- Exporting events for compliance --> Go to Step 7
```

## Step 4: Emit Audit Log Events

### Initialize SDK Client

Create WorkOS client singleton:

```typescript
// lib/workos.ts
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### Emit Event Pattern

Use `auditLogs.createEvent()` method. **Critical fields:**

- `organization_id` - Required, links event to organization
- `event.action` - Required, dot-notation (e.g., `user.signed_in`)
- `event.occurred_at` - ISO 8601 timestamp
- `event.actor` - Who performed the action (user/system)
- `event.targets` - What was affected (resources)

**Example implementation:**

```typescript
await workos.auditLogs.createEvent({
  organization_id: 'org_123',
  event: {
    action: 'document.created',
    occurred_at: new Date().toISOString(),
    actor: {
      type: 'user',
      id: 'user_123',
      name: 'Jane Doe',
      metadata: { email: 'jane@example.com' }
    },
    targets: [
      {
        type: 'document',
        id: 'doc_456',
        name: 'Q4 Report'
      }
    ],
    context: {
      location: '192.0.2.1',
      user_agent: 'Mozilla/5.0...'
    }
  }
});
```

### Error Handling

Wrap in try-catch and handle specific errors:

```typescript
try {
  await workos.auditLogs.createEvent({ /* ... */ });
} catch (error) {
  if (error.code === 'invalid_organization') {
    // Organization ID not found
  } else if (error.code === 'schema_validation_failed') {
    // Metadata doesn't match defined schema
  }
  // Log error, don't block user action
}
```

**CRITICAL:** Audit log failures should NOT break application flow. Log errors but continue.

## Step 5: Configure Log Streams

### Integration Choice (Decision Tree)

```
Customer's SIEM provider?
  |
  +-- Datadog --> Use Datadog HTTP Log Intake API
  |                 Endpoint: https://http-intake.logs.datadoghq.com/api/v2/logs
  |                 Requires: API key
  |
  +-- Splunk  --> Use Splunk HEC (HTTP Event Collector)
  |                 Endpoint: https://<host>:8088/services/collector
  |                 Requires: HEC token
  |
  +-- AWS S3  --> Use cross-account IAM role
  |                 Requires: Bucket name, region, IAM role ARN, external ID
  |
  +-- GCS     --> Use service account
  |                 Requires: Bucket name, service account JSON
  |
  +-- Generic --> HTTP POST endpoint
                    Requires: URL, optional auth headers
```

### Dashboard Configuration

Navigate to WorkOS Dashboard:

1. Go to Audit Logs → Log Streams
2. Click "Create Log Stream"
3. Select provider (Datadog/Splunk/S3/GCS/Generic)
4. Enter provider-specific credentials (see docs for exact fields)
5. **Test connection** before saving

### Programmatic Setup (Optional)

Use Admin Portal API to allow customers to self-configure:

```typescript
// Generate Admin Portal link for customer
const { link } = await workos.portal.generateLink({
  organization: 'org_123',
  intent: 'audit_logs',
  return_url: 'https://yourapp.com/settings'
});

// Redirect customer to Admin Portal
// They configure Log Stream themselves
```

### IP Allowlist (AWS S3 / Self-Hosted)

If customer's destination restricts by IP, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

Add to firewall rules, S3 bucket policies, or security groups.

## Step 6: Define Metadata Schemas

### When to Use Schemas

Use JSON Schema validation if:

- Multiple teams emit same event type
- Compliance requires strict field validation
- You need to prevent malformed metadata

Skip if:

- Events are ad-hoc or vary widely
- You prefer runtime validation in application code

### Schema Definition

Navigate to WorkOS Dashboard:

1. Go to Audit Logs → Events
2. Select or create an event type (e.g., `document.created`)
3. Check "Require metadata schema validation"
4. Click "Edit Schema"

**Schema locations:**

- Root `event.metadata` - Event-level data
- `event.actor.metadata` - Actor-specific fields
- `event.targets[].metadata` - Per-target fields

### Schema Example

Define required fields with types:

```json
{
  "type": "object",
  "properties": {
    "document_size_bytes": { "type": "integer" },
    "file_type": { "type": "string", "enum": ["pdf", "docx", "xlsx"] },
    "is_confidential": { "type": "boolean" }
  },
  "required": ["file_type"],
  "additionalProperties": false
}
```

**Limits:**

- Max 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

### Validation Failure Handling

If event doesn't match schema, SDK throws error:

```typescript
try {
  await workos.auditLogs.createEvent({
    organization_id: 'org_123',
    event: {
      action: 'document.created',
      metadata: { file_type: 'png' } // Not in enum
    }
  });
} catch (error) {
  if (error.code === 'schema_validation_failed') {
    console.error('Schema mismatch:', error.details);
    // Log error, use fallback metadata
  }
}
```

## Step 7: Export Events

### Export Methods (Decision Tree)

```
Export use case?
  |
  +-- Compliance audit (annual/quarterly)
  |     --> Dashboard: Audit Logs → Export
  |     --> CSV or JSON download
  |
  +-- Real-time SIEM integration
  |     --> Set up Log Stream (Step 5)
  |
  +-- Programmatic bulk export
        --> Use Events API with pagination
```

### Dashboard Export

Manual export for compliance:

1. Navigate to WorkOS Dashboard → Audit Logs → Events
2. Apply filters (date range, organization, action type)
3. Click "Export" button
4. Select format: CSV or JSON
5. Download file (async for large datasets)

### Programmatic Export (API)

Use `listEvents()` with pagination:

```typescript
// Export all events for organization in date range
async function exportEvents(orgId: string, startDate: Date, endDate: Date) {
  const allEvents = [];
  let after: string | undefined;

  do {
    const response = await workos.auditLogs.listEvents({
      organization_id: orgId,
      occurred_at_gte: startDate.toISOString(),
      occurred_at_lte: endDate.toISOString(),
      limit: 100, // Max per page
      after // Pagination cursor
    });

    allEvents.push(...response.data);
    after = response.listMetadata.after;
  } while (after);

  return allEvents;
}
```

**Rate limiting:** Respect API rate limits. Add delays if exporting millions of events.

## Step 8: Admin Portal Integration (Optional)

Allow customers to manage their own audit logs:

```typescript
// Generate Admin Portal link
const { link } = await workos.portal.generateLink({
  organization: 'org_123',
  intent: 'audit_logs', // Shows Audit Logs tab
  return_url: 'https://yourapp.com/settings'
});

// In your UI:
<a href={link}>Configure Audit Log Settings</a>
```

Customers can:

- View their audit events
- Configure Log Streams
- Export events
- Manage retention policies (if enabled)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK missing"

# 2. Check environment variables set
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key found" || echo "FAIL: No API key"

# 3. Check WorkOS client initialization
grep -r "new WorkOS" . --include="*.ts" --include="*.js" || echo "FAIL: No WorkOS client"

# 4. Check audit log emission exists
grep -r "auditLogs.createEvent" . --include="*.ts" --include="*.js" || echo "WARNING: No events emitted"

# 5. Test API connectivity (requires valid key)
curl -X GET "https://api.workos.com/audit_logs/events?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" | grep -q '"data"' && \
  echo "PASS: API accessible" || echo "FAIL: Cannot reach API"
```

## Error Recovery

### "unauthorized" or "invalid_api_key"

**Root cause:** API key missing, expired, or wrong environment.

**Fix:**

1. Verify `WORKOS_API_KEY` in `.env*` starts with `sk_`
2. Check key environment (test vs production) matches WorkOS Dashboard
3. Regenerate key in Dashboard if expired
4. Restart server after changing env vars

### "organization_not_found"

**Root cause:** Organization ID doesn't exist or is in wrong environment.

**Fix:**

1. Verify organization exists in WorkOS Dashboard
2. Check organization ID format: `org_` prefix
3. Confirm test/production environment match

### "schema_validation_failed"

**Root cause:** Event metadata doesn't match defined JSON Schema.

**Fix:**

1. Check schema definition in Dashboard → Audit Logs → Events → [Event Type] → Schema
2. Compare emitted metadata against schema requirements
3. Options:
   - Fix metadata to match schema, OR
   - Update schema to allow current metadata shape, OR
   - Disable schema validation for that event type

### "rate_limit_exceeded"

**Root cause:** Too many API requests in short time.

**Fix:**

1. Implement exponential backoff with retries
2. Batch events where possible (not yet supported, emit sequentially with delay)
3. Cache organization lookups to reduce API calls
4. Contact WorkOS support to increase rate limit if legitimate high volume

### Log Stream not receiving events

**Root causes:**

- Incorrect SIEM credentials (API key, HEC token, IAM role)
- Network firewall blocking WorkOS IPs
- Wrong endpoint URL or region
- No events emitted for that organization

**Fix (step by step):**

1. Test connection in WorkOS Dashboard → Log Streams → [Stream] → Test
2. If test fails, verify credentials/endpoint/region
3. Check SIEM provider for authentication errors in logs
4. If using AWS S3 or self-hosted, allowlist WorkOS IPs (see Step 5)
5. Emit test event and verify it appears in dashboard before checking SIEM
6. Check Log Stream status in dashboard for error messages

### Events not appearing in dashboard

**Root cause:** `organization_id` mismatch or event silently failed.

**Fix:**

1. Log SDK responses/errors: `console.log(await workos.auditLogs.createEvent(...))`
2. Verify organization_id matches Dashboard organization
3. Check no try-catch swallowing errors
4. Confirm API key has audit log permissions

## Related Skills

- **workos-events**: Webhook event handling for receiving WorkOS events
- **workos-authkit-nextjs**: User authentication (actor IDs for audit logs)
- **workos-organizations**: Managing organizations that own audit logs
- **workos-directory-sync**: Sync user directories (actor metadata enrichment)
