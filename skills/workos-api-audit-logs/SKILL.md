---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- generated -->

# WorkOS Audit Logs API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. https://workos.com/docs/reference/audit-logs
2. https://workos.com/docs/reference/audit-logs/configuration
3. https://workos.com/docs/reference/audit-logs/event
4. https://workos.com/docs/reference/audit-logs/event/create
5. https://workos.com/docs/reference/audit-logs/export
6. https://workos.com/docs/reference/audit-logs/export/create
7. https://workos.com/docs/reference/audit-logs/export/get
8. https://workos.com/docs/reference/audit-logs/retention

If this skill conflicts with fetched documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Verify API key exists and format
grep "WORKOS_API_KEY" .env* | grep -E "sk_[a-zA-Z0-9]+"
```

**Required format:**
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - if using OAuth flows

**STOP if check fails.** Get credentials from WorkOS Dashboard > API Keys.

### SDK Installation

Detect package manager and verify SDK:

```bash
# Check SDK is installed
npm list @workos-inc/node 2>/dev/null || yarn list --pattern @workos-inc/node 2>/dev/null
```

If missing, install per fetched documentation (Step 1). Typically:

```bash
npm install @workos-inc/node
# or
yarn add @workos-inc/node
```

## Step 3: Initialize WorkOS Client

Create a module that exports configured WorkOS instance. Location depends on project structure:

```
Project type          --> Location
Node/Express         --> src/lib/workos.js or lib/workos.ts
Next.js              --> lib/workos.ts
Standalone script    --> workos-client.js at root
```

**Pattern from documentation:**

```typescript
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Verify initialization:**

```bash
# Check client file exists
find . -name "*workos*" -type f \( -name "*.ts" -o -name "*.js" \) | head -1
```

## Step 4: Feature Selection (Decision Tree)

Audit Logs has multiple use cases. Determine which applies:

```
What are you building?
  |
  +-- Emit events from app --> Step 5: Create Events
  |
  +-- Export audit trail    --> Step 6: Create Exports
  |
  +-- Configure retention   --> Step 7: Set Retention
  |
  +-- Define event schema   --> Step 8: Create Schema
```

**Most common:** Step 5 (Create Events) for application audit logging.

## Step 5: Create Events (Most Common)

### Event Structure

Parse documentation for required fields. Standard pattern:

- `organization_id` - WorkOS organization identifier
- `action` - Event name (e.g., `user.login`, `document.delete`)
- `actor` - Who performed action (name, type, id)
- `targets` - What was affected (resources, entities)
- `occurred_at` - ISO 8601 timestamp
- `metadata` - Additional context (optional)

### Implementation Location

Add audit logging at critical actions:

```
Action type           --> Where to add
Authentication       --> Login/logout handlers
Data mutations       --> CRUD API routes
Admin actions        --> Admin panel endpoints
Security events      --> Password changes, MFA, etc.
```

### Code Pattern

```typescript
import { workos } from './lib/workos';

async function logAuditEvent(eventData) {
  await workos.auditLogs.createEvent({
    organization_id: eventData.orgId,
    action: eventData.action,
    actor: {
      type: 'user',
      id: eventData.userId,
      name: eventData.userName,
    },
    targets: [
      {
        type: eventData.targetType,
        id: eventData.targetId,
      },
    ],
    occurred_at: new Date().toISOString(),
    metadata: eventData.metadata || {},
  });
}
```

**Critical:** Do NOT block user requests on audit logging. Wrap in try/catch or use async queue.

### Error Handling Pattern

```typescript
try {
  await workos.auditLogs.createEvent(event);
} catch (error) {
  // Log to monitoring, do NOT throw to user
  console.error('Audit log failed:', error.message);
}
```

## Step 6: Create Exports

Use when building compliance reports or data export features.

### Export Flow

1. Create export request (returns `export_id`)
2. Poll export status until ready
3. Download via returned URL

### Implementation Pattern

```typescript
// 1. Create export
const exportRequest = await workos.auditLogs.createExport({
  organization_id: orgId,
  range_start: '2024-01-01T00:00:00Z',
  range_end: '2024-01-31T23:59:59Z',
  actions: ['user.*', 'document.delete'], // optional filter
});

// 2. Poll until ready (typically async job/webhook in production)
let exportData;
while (!exportData) {
  exportData = await workos.auditLogs.getExport(exportRequest.id);
  if (exportData.state === 'ready') break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// 3. Download CSV
const response = await fetch(exportData.url);
const csv = await response.text();
```

**Production pattern:** Use webhook callbacks instead of polling. See documentation for webhook setup.

## Step 7: Set Retention Policy

Configure how long audit logs are stored. **Affects compliance requirements.**

```typescript
await workos.auditLogs.setRetentionPeriod({
  organization_id: orgId,
  retention_days: 365, // 1 year for most compliance
});
```

**Common retention periods:**
- 90 days - Basic security
- 365 days - SOC 2, ISO 27001
- 2555 days (7 years) - Financial regulations

Check documentation for organization-wide vs per-org settings.

## Step 8: Create Schema (Optional)

Define custom event types for validation and UI rendering.

**Only needed if:**
- Building custom audit log viewer
- Strict event validation required
- Custom event metadata fields

See documentation for schema format. Most projects skip this.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check WorkOS client initialization
grep -r "new WorkOS" --include="*.ts" --include="*.js" . | head -1

# 2. Check audit log calls exist
grep -r "auditLogs.createEvent" --include="*.ts" --include="*.js" . | wc -l

# 3. Verify API key format
grep "WORKOS_API_KEY=sk_" .env* 2>/dev/null || echo "FAIL: API key missing or wrong format"

# 4. Test event creation (replace values)
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_test",
    "action": "test.verify",
    "actor": {"type": "user", "id": "test"},
    "targets": [{"type": "system", "id": "cli"}],
    "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# 5. Application builds
npm run build 2>&1 | grep -i error
```

**Expected results:**
- Check 1: Shows file path with WorkOS initialization
- Check 2: Shows count > 0 (events being logged)
- Check 3: Shows API key, no "FAIL" message
- Check 4: Returns 201 status with event object
- Check 5: No error output

## Error Recovery

### "401 Unauthorized" on API calls

**Root cause:** Invalid or missing API key.

Fix:
1. Verify key format: `echo $WORKOS_API_KEY | grep "^sk_"`
2. Check key scope in Dashboard > API Keys > Key Details
3. Regenerate key if rotated/revoked

### "422 Unprocessable Entity" on createEvent

**Root cause:** Missing required fields or invalid format.

Fix by checking documentation for required fields. Common issues:
- `organization_id` - Must be valid WorkOS org ID (starts with `org_`)
- `occurred_at` - Must be valid ISO 8601 string
- `action` - Cannot be empty or whitespace-only

**Debug pattern:**

```typescript
try {
  await workos.auditLogs.createEvent(event);
} catch (error) {
  console.error('Validation failed:', error.response?.data);
  // Shows which field is invalid
}
```

### "429 Rate Limited"

**Root cause:** Exceeding API rate limits.

Fix:
1. Implement exponential backoff for retries
2. Batch events if possible (check docs for batch endpoint)
3. Queue audit logs async to avoid blocking requests
4. Contact WorkOS if limits too restrictive for use case

### Events not appearing in WorkOS Dashboard

**Root cause:** Wrong organization ID or event schema mismatch.

Fix:
1. Verify `organization_id` matches Dashboard org
2. Check events in Dashboard > Audit Logs > Events (may have filter active)
3. Verify event `action` matches schema if custom schema defined
4. Check occurred_at is not in future (silently dropped)

### SDK import errors ("Cannot find module @workos-inc/node")

**Root cause:** SDK not installed or wrong package name.

Fix:
1. Check package.json: `grep "@workos-inc/node" package.json`
2. Reinstall: `npm install @workos-inc/node`
3. Clear cache: `rm -rf node_modules && npm install`
4. Check Node version compatibility in SDK docs

### TypeScript type errors with WorkOS SDK

**Root cause:** SDK types not installed or version mismatch.

Fix:
1. Check TypeScript version: `npx tsc --version`
2. Install type definitions if separate: Check SDK docs for @types package
3. Upgrade SDK to latest: `npm update @workos-inc/node`
4. Add explicit types if SDK types incomplete:

```typescript
interface AuditLogEvent {
  organization_id: string;
  action: string;
  actor: { type: string; id: string; name?: string };
  targets: Array<{ type: string; id: string }>;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}
```

## Related Skills

- `workos-api-organizations` - Managing WorkOS organizations for multi-tenant apps
- `workos-api-events` - Webhook event handling for async audit log processing
- `workos-authkit-nextjs` - Integrating authentication with audit logging
