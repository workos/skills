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

If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### API Credentials

Check environment variables exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (if using Organizations)

**Verify:**

```bash
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key found" || echo "FAIL: Missing API key"
```

### SDK Installation

Check SDK is installed:

```bash
# Node.js
npm list @workos-inc/node || yarn list @workos-inc/node || pnpm list @workos-inc/node

# Python
pip show workos || poetry show workos

# Ruby
bundle show workos

# Go
go list -m github.com/workos/workos-go
```

**If SDK missing:** Install according to language package manager before continuing.

## Step 3: Implementation Path (Decision Tree)

Choose ONE path based on your use case:

```
What are you building?
  |
  +-- Emitting events from backend
  |   --> Step 4: Backend Event Emission
  |
  +-- Configuring customer log streams (SIEM integration)
  |   --> Step 5: Log Stream Configuration
  |
  +-- Setting up Admin Portal for customer self-service
  |   --> Step 6: Admin Portal Integration
  |
  +-- Exporting events to CSV/JSON
      --> Step 7: Event Export
```

## Step 4: Backend Event Emission

### Event Schema Design

Before writing code, define your event structure in WorkOS Dashboard:

1. Navigate to Dashboard → Audit Logs → Events
2. Click "Create Event"
3. Define event name (format: `noun.past_tense_verb`, e.g., `user.signed_in`)
4. **If using metadata schemas:** Check "Require metadata schema validation"

### Metadata Schema (Optional but Recommended)

If you checked validation in Dashboard:

1. Define JSON Schema for root `metadata`, `actor.metadata`, and `targets[].metadata`
2. **Limits to enforce in code:**
   - Max 50 keys per metadata object
   - Max 40 characters per key name
   - Max 500 characters per value

Example schema structure:

```json
{
  "type": "object",
  "properties": {
    "ip_address": { "type": "string", "format": "ipv4" },
    "user_agent": { "type": "string", "maxLength": 500 }
  },
  "required": ["ip_address"],
  "additionalProperties": false
}
```

**Critical:** If schema validation is enabled, events that don't match will return 400 errors.

### Code Integration

Detect language from project files:

```
Language indicators?
  |
  +-- package.json + TypeScript --> Node.js/TypeScript pattern
  |
  +-- requirements.txt / pyproject.toml --> Python pattern
  |
  +-- Gemfile --> Ruby pattern
  |
  +-- go.mod --> Go pattern
```

**Node.js/TypeScript pattern:**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Basic event
await workos.auditLogs.createEvent({
  organization_id: 'org_123',
  event: {
    action: 'user.signed_in',
    occurred_at: new Date().toISOString(),
    actor: {
      type: 'user',
      id: 'user_123',
      name: 'Alice Smith',
      metadata: { ip_address: '192.0.2.1' }, // Must match schema if enabled
    },
    targets: [
      {
        type: 'user',
        id: 'user_123',
        name: 'Alice Smith',
      },
    ],
    context: {
      location: '192.0.2.1',
      user_agent: 'Mozilla/5.0...',
    },
  },
});
```

**Python pattern:**

```python
from workos import WorkOSClient
import os

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

workos.audit_logs.create_event(
    organization_id='org_123',
    event={
        'action': 'user.signed_in',
        'occurred_at': datetime.utcnow().isoformat() + 'Z',
        'actor': {
            'type': 'user',
            'id': 'user_123',
            'name': 'Alice Smith',
            'metadata': {'ip_address': '192.0.2.1'}
        },
        'targets': [{'type': 'user', 'id': 'user_123'}],
        'context': {'location': '192.0.2.1'}
    }
)
```

**Verify emission:**

```bash
# Check SDK import exists in codebase
grep -r "auditLogs\|audit_logs" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go"

# Test event creation (requires valid org_id)
curl https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_YOUR_ORG_ID",
    "event": {
      "action": "user.test_event",
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "actor": {"type": "user", "id": "test_123"}
    }
  }'
```

Expected: 201 Created with event ID in response.

## Step 5: Log Stream Configuration

### Dashboard Configuration (Manual Setup)

If configuring streams via Dashboard:

1. Navigate to Dashboard → Audit Logs → Log Streams
2. Click "Create Log Stream"
3. Select provider (Datadog, Splunk, AWS S3, GCS, or HTTP)
4. **Note organization_id** — streams are org-specific

### IP Allowlist Setup

If streaming to restricted hosts, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Verify allowlist in target system before enabling stream.**

### Provider-Specific Configuration

**Datadog:**

- Get API Key from Datadog dashboard
- Select region (US1, US3, US5, EU1, AP1, US1-FED)
- Events sent to `https://http-intake.logs.datadoghq.com/api/v2/logs` (or regional equivalent)

**Splunk:**

- Get HEC token from Splunk Settings → Data Inputs → HTTP Event Collector
- Provide HEC endpoint URL (e.g., `https://splunk.example.com:8088`)
- **Critical:** HEC endpoint must be publicly accessible or VPN-connected

**AWS S3:**

- Create IAM role with `s3:PutObject` permission
- Add WorkOS as trusted entity with external ID from Dashboard
- Provide bucket name and optional prefix
- **Critical:** If Object Lock enabled, WorkOS sends `ContentMD5` header

Cross-account role policy example:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::WORKOS_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID_FROM_DASHBOARD"
        }
      }
    }
  ]
}
```

**Google Cloud Storage:**

- Create service account with Storage Object Creator role
- Download JSON key
- Provide bucket name and optional prefix

**HTTP Endpoint:**

- Provide publicly accessible HTTPS URL
- Optional: Add headers for authentication
- Events sent as JSON array via POST

### Admin Portal Self-Service (Recommended)

To allow customers to configure their own streams:

1. Generate Admin Portal link with `audit_logs` intent:

```typescript
// Node.js
const link = await workos.portal.generateLink({
  organization: 'org_123',
  intent: 'audit_logs',
  return_url: 'https://yourapp.com/settings',
});
```

2. Redirect customer admin to `link.url`
3. They configure stream without your involvement

**Verify Admin Portal access:**

```bash
curl https://api.workos.com/portal/generate_link \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_YOUR_ORG_ID",
    "intent": "audit_logs",
    "return_url": "https://yourapp.com/settings"
  }'
```

Expected: 200 OK with `link` field containing portal URL.

## Step 6: Admin Portal Integration

If customers need self-service configuration:

### Generate Portal Link

Create link generation endpoint in your backend:

```typescript
// Example Express.js route
app.post('/api/admin-portal', async (req, res) => {
  const { organizationId } = req.body; // From authenticated session

  const link = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'audit_logs', // Shows log stream, export, event configuration
    return_url: `${process.env.APP_URL}/settings/audit-logs`,
  });

  res.json({ url: link.url });
});
```

**Frontend integration:**

```typescript
// Fetch link from backend, redirect customer
const response = await fetch('/api/admin-portal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ organizationId: currentOrg.id }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to WorkOS portal
```

### Return URL Handling

When customer completes setup, WorkOS redirects to `return_url`:

```typescript
// Your /settings/audit-logs page
app.get('/settings/audit-logs', (req, res) => {
  // No special query params — just reload settings
  // Poll WorkOS API if you need to show updated config immediately
});
```

**Verify portal flow:**

1. Generate link via API
2. Open link in browser
3. Complete setup in portal
4. Confirm redirect to return_url works
5. Check Dashboard shows new configuration

## Step 7: Event Export

For manual or scheduled exports:

### Export via API

```bash
# Export events for date range
curl "https://api.workos.com/audit_logs/exports?organization_id=org_123&range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Accept: text/csv"  # or application/json

# Save to file
curl "https://api.workos.com/audit_logs/exports?organization_id=org_123&range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Accept: text/csv" \
  -o events_jan2024.csv
```

**Parameters:**

- `organization_id` (required) — organization to export
- `range_start` (required) — ISO 8601 timestamp
- `range_end` (required) — ISO 8601 timestamp
- `actor_name[]` (optional) — filter by actor names (repeatable)
- `action[]` (optional) — filter by event actions (repeatable)

**Format options:**

- `Accept: text/csv` — CSV format
- `Accept: application/json` — JSON array format

### Scheduled Exports

If building automated exports:

1. Store last export timestamp
2. Run cron job or scheduled task
3. Export events since last timestamp
4. Update stored timestamp
5. Store/process exported file

Example scheduled job (Node.js):

```typescript
// cron.ts
import { WorkOS } from '@workos-inc/node';
import fs from 'fs';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

async function exportRecentEvents() {
  const lastExport = await getLastExportTime(); // Your storage
  const now = new Date().toISOString();

  const events = await workos.auditLogs.exportEvents({
    organizationId: 'org_123',
    rangeStart: lastExport,
    rangeEnd: now,
  });

  // Save or process events
  fs.writeFileSync(`exports/events_${Date.now()}.json`, JSON.stringify(events, null, 2));

  await saveLastExportTime(now); // Update timestamp
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm implementation:

```bash
# 1. Check API key configured
printenv | grep -q "WORKOS_API_KEY=sk_" && echo "PASS: API key set" || echo "FAIL: No API key"

# 2. Check SDK installed
npm list @workos-inc/node 2>/dev/null || pip show workos 2>/dev/null || bundle show workos 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check audit log code exists
grep -r "auditLogs\|audit_logs\|createEvent\|create_event" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" | head -1 || echo "FAIL: No audit log code found"

# 4. Test event creation (replace org_id)
curl -s https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"org_REPLACE_ME\",
    \"event\": {
      \"action\": \"test.verification\",
      \"occurred_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"actor\": {\"type\": \"user\", \"id\": \"test_user\"}
    }
  }" | grep -q "id" && echo "PASS: Event created" || echo "FAIL: Event creation failed"

# 5. If using Admin Portal, test link generation
curl -s https://api.workos.com/portal/generate_link \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization\": \"org_REPLACE_ME\",
    \"intent\": \"audit_logs\",
    \"return_url\": \"https://example.com/test\"
  }" | grep -q "link" && echo "PASS: Portal link generated" || echo "FAIL: Portal link failed"
```

**Manual checks:**

- [ ] Event appears in WorkOS Dashboard → Audit Logs
- [ ] If log stream configured: Event reaches SIEM/S3 within
