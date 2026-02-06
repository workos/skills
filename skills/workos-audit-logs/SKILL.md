---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- generated -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:

- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (if using SSO/Directory Sync)

### SDK Installation

Detect existing WorkOS SDK:

```bash
# Check if SDK is installed
npm list @workos-inc/node 2>/dev/null || yarn list @workos-inc/node 2>/dev/null
```

If SDK not found, install it:

```bash
# Detect package manager and install
npm install @workos-inc/node
# OR
yarn add @workos-inc/node
```

**Verify:** SDK package exists in node_modules before continuing.

## Step 3: Audit Log Event Schema Design (Decision Tree)

```
Need metadata validation?
  |
  +-- YES --> Define JSON Schema in WorkOS Dashboard (Step 3a)
  |           Then proceed to Step 4
  |
  +-- NO  --> Use free-form metadata
              Proceed to Step 4
```

### Step 3a: Define Metadata Schema (If Required)

Navigate to WorkOS Dashboard → Audit Logs → Events → Create/Edit Event.

**Schema design rules (from docs):**

- Maximum 50 keys per metadata object
- Key names: up to 40 characters
- Values: up to 500 characters
- Three metadata locations: root event, actor, targets

**Example schema structure:**

```json
{
  "type": "object",
  "properties": {
    "ip_address": { "type": "string" },
    "user_agent": { "type": "string" }
  },
  "required": ["ip_address"]
}
```

Enable "Require metadata schema validation" checkbox in Dashboard before emitting events.

## Step 4: Implement Event Emission

### Basic Event Structure

All Audit Log events must include:

1. `organization_id` - WorkOS org identifier
2. `action` - Event type (e.g., `user.signed_in`)
3. `occurred_at` - ISO 8601 timestamp
4. `actor` - Who performed the action
5. `targets` - What was affected (optional)

### Code Pattern

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

await workos.auditLogs.createEvent({
  organization_id: 'org_123',
  event: {
    action: 'user.signed_in',
    occurred_at: new Date().toISOString(),
    actor: {
      type: 'user',
      id: 'user_123',
      name: 'Jane Doe',
      metadata: {
        // Optional: custom metadata (must match schema if validation enabled)
      }
    },
    targets: [
      {
        type: 'team',
        id: 'team_456',
        name: 'Engineering'
      }
    ],
    context: {
      location: '192.0.2.1',
      user_agent: 'Mozilla/5.0...'
    }
  }
});
```

**Critical:** If schema validation is enabled, metadata MUST conform to JSON Schema or API returns 400 error.

## Step 5: Log Streams Setup (Optional)

Only proceed if customer needs to stream events to external SIEM.

### Decision Tree: Stream Destination

```
Customer SIEM provider?
  |
  +-- Datadog     --> Configure Datadog stream (Step 5a)
  |
  +-- Splunk      --> Configure Splunk HEC (Step 5b)
  |
  +-- AWS S3      --> Configure S3 bucket (Step 5c)
  |
  +-- Custom HTTP --> Configure webhook endpoint (Step 5d)
```

### Step 5a: Datadog Stream

**Dashboard setup:**

1. WorkOS Dashboard → Log Streams → Create Stream
2. Select "Datadog"
3. Enter Datadog API key
4. Select region (US1, US3, US5, EU1, AP1, US1-FED)

**Verify stream:**

```bash
# Check Datadog logs for events with source:workos
# Events appear with this structure:
# { "message": { "id": "...", "action": "...", ... } }
```

### Step 5b: Splunk Stream

**Prerequisites:**

- Splunk HEC token
- HEC endpoint URL

**Dashboard setup:**

1. WorkOS Dashboard → Log Streams → Create Stream
2. Select "Splunk"
3. Enter HEC endpoint and token

**Verify stream:**

```bash
# Check Splunk for events with sourcetype=workos
# Events appear with this structure:
# { "event": { "id": "...", "action": "...", ... } }
```

### Step 5c: AWS S3 Stream

**Prerequisites (CRITICAL):**

- S3 bucket created
- IAM role with cross-account access
- External ID for role assumption

**Required IAM policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

**Dashboard setup:**

1. Create IAM role with trust relationship to WorkOS account
2. WorkOS Dashboard → Log Streams → Create Stream
3. Select "AWS S3"
4. Enter bucket name, region, IAM role ARN, external ID

**Note:** Events stored as individual JSON files with ContentMD5 header (supports Object Lock).

### Step 5d: Generic HTTP Stream

For custom endpoints or unsupported SIEMs.

**Endpoint requirements:**

- Must accept POST requests
- Must return 2xx status for success
- Should implement authentication (bearer token, API key header)

**Dashboard setup:**

1. WorkOS Dashboard → Log Streams → Create Stream
2. Select "HTTP POST"
3. Enter endpoint URL and headers

### IP Allowlist (If Required)

If destination requires IP allowlisting, whitelist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

## Step 6: Export Events (Optional)

For bulk export or compliance needs.

### Export via Dashboard

1. WorkOS Dashboard → Audit Logs → Events
2. Apply filters (date range, action type, organization)
3. Click "Export" → Select format (CSV/JSON)

### Export via API

```typescript
// Fetch events with pagination
const events = await workos.auditLogs.getEvents({
  organization_id: 'org_123',
  range_start: '2024-01-01T00:00:00Z',
  range_end: '2024-01-31T23:59:59Z',
  limit: 100
});

// events.data contains event array
// events.list_metadata contains pagination info
```

**Pagination pattern:**

```typescript
let after = undefined;
const allEvents = [];

do {
  const response = await workos.auditLogs.getEvents({
    organization_id: 'org_123',
    limit: 100,
    after
  });
  
  allEvents.push(...response.data);
  after = response.list_metadata.after;
} while (after);
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check environment variables
grep -E "WORKOS_API_KEY=sk_" .env* || echo "FAIL: API key not configured"

# 3. Test event creation (requires working API key)
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.auditLogs.createEvent({
  organization_id: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
  event: {
    action: 'test.event',
    occurred_at: new Date().toISOString(),
    actor: { type: 'user', id: 'test_user' }
  }
}).then(() => console.log('PASS')).catch(e => console.log('FAIL:', e.message));
" 2>&1 | grep -q "PASS" && echo "Event creation works" || echo "Event creation failed"

# 4. If using Log Streams, check stream status in Dashboard
# Navigate to WorkOS Dashboard → Log Streams → Check "Active" status

# 5. If using metadata schema, test schema validation
# Emit event with invalid metadata - should return 400 error
```

**All checks must pass before marking implementation complete.**

## Error Recovery

### "Invalid API key" or "Unauthorized"

**Root cause:** API key incorrect, missing, or lacks permissions.

**Fix:**

1. Verify key starts with `sk_` prefix
2. Check WorkOS Dashboard → API Keys → Key status
3. Regenerate key if compromised
4. Ensure key is for correct environment (test vs. production)

### "Metadata validation failed" (400 error)

**Root cause:** Emitted metadata doesn't match JSON Schema.

**Fix:**

1. Check exact error message - shows which field failed validation
2. Verify metadata object structure matches schema
3. Check data types (string vs. number, required fields)
4. Test schema with sample data in Dashboard schema editor

**Common issues:**

- Missing required fields
- Wrong data type (string when number expected)
- Value exceeds 500 character limit
- More than 50 keys in metadata object

### "Organization not found"

**Root cause:** Invalid `organization_id` or org doesn't exist.

**Fix:**

1. Verify org ID format: `org_` prefix + 26 characters
2. Check WorkOS Dashboard → Organizations for valid org IDs
3. Ensure org was created via Directory Sync or SSO before emitting events

### Log Stream not receiving events

**Root causes:**

- Stream configuration error
- Network/firewall blocking WorkOS IPs
- Destination endpoint rejecting requests
- Invalid credentials (API key, HEC token, IAM role)

**Fix:**

1. Check stream status in WorkOS Dashboard (Active vs. Inactive)
2. Verify destination credentials are correct
3. For S3: Check IAM role trust relationship and permissions
4. For HTTP: Test endpoint with curl to verify it accepts POST
5. Check destination logs for rejected requests
6. Verify IP allowlist includes all WorkOS IPs (if applicable)

**Datadog-specific:**

- Wrong region selected (logs sent to wrong intake endpoint)
- API key lacks "Logs Write" permission

**Splunk-specific:**

- HEC not enabled on Splunk instance
- HEC token expired or deleted
- SSL certificate verification failing

### "Rate limit exceeded"

**Root cause:** Too many events emitted in short time window.

**Fix:**

1. Implement batching for bulk operations
2. Add exponential backoff retry logic
3. Contact WorkOS support to discuss rate limit increase

### Events not appearing in Dashboard

**Root cause:** Event emission succeeded but Dashboard filters hiding events.

**Fix:**

1. Clear all filters (date range, action, organization)
2. Verify `organization_id` matches filter
3. Check `occurred_at` timestamp is within selected date range
4. Wait 30-60 seconds for eventual consistency

## Related Skills

- **workos-sso**: Single Sign-On for organization authentication
- **workos-directory-sync**: Sync users/groups to get organization IDs
- **workos-events**: Webhook events for real-time Audit Log notifications
- **workos-admin-portal**: Self-service portal for customers to manage Log Streams
