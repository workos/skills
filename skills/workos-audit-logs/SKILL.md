---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Both must be set and non-empty
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID
```

**Verify:**
- `WORKOS_API_KEY` starts with `sk_`
- `WORKOS_CLIENT_ID` starts with `client_`

### SDK Installation

Check SDK is installed:

```bash
# Node.js/TypeScript
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# Python
python -c "import workos" 2>/dev/null || echo "FAIL: SDK not installed"

# Ruby
bundle show workos 2>/dev/null || echo "FAIL: SDK not installed"
```

If SDK missing, install before proceeding:

```bash
# Node.js
npm install @workos-inc/node

# Python
pip install workos

# Ruby
bundle add workos
```

## Step 3: Dashboard Configuration

**CRITICAL:** Audit Logs require setup in WorkOS Dashboard before emitting events.

Navigate to: https://dashboard.workos.com/audit-logs

### Define Event Schemas

For each event type your app will emit:

1. Click "Create Event" or navigate to existing event
2. Set event action name (e.g., `user.signed_in`, `document.deleted`)
3. Choose schema validation requirement:

```
Require metadata schema?
  |
  +-- YES --> Define JSON Schema for metadata objects
  |           (root metadata, actor metadata, target metadata)
  |
  +-- NO  --> Skip to Step 4
```

**Metadata constraints (enforced by API):**
- Maximum 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

**Example schema definition:**

If "Require metadata schema validation" is checked, you'll edit JSON Schema for:
- Root event `metadata`
- Actor `metadata`
- Target `metadata`

Click "+" to add properties. The schema editor enforces JSON Schema syntax.

**Test:** After saving, emit a test event via SDK — if metadata doesn't match schema, API returns validation error.

## Step 4: Emit Audit Log Events

WebFetch the index documentation for current SDK method signatures. Do NOT assume method names.

**General pattern (verify exact syntax in fetched docs):**

```
Event structure:
{
  "organization_id": "org_123",
  "action": "user.signed_in",
  "actor": {
    "type": "user",
    "id": "user_123",
    "metadata": {}  // optional, must match schema if required
  },
  "targets": [
    {
      "type": "session",
      "id": "session_456",
      "metadata": {}  // optional, must match schema if required
    }
  ],
  "metadata": {},  // optional, must match schema if required
  "occurred_at": "2024-01-15T10:30:00Z"
}
```

**Decision tree for occurred_at:**

```
Event timestamp?
  |
  +-- Real-time event --> Omit occurred_at (defaults to now)
  |
  +-- Historical event --> Include occurred_at as ISO 8601 string
```

Check fetched docs for:
- Exact SDK method name for creating events
- Required vs optional fields
- Supported actor/target types

## Step 5: Configure Log Streams (Optional)

**Context:** Log Streams send events to customer SIEM providers. This is optional — events are still stored in WorkOS regardless.

Two configuration paths:

```
Who configures stream?
  |
  +-- You (developer) --> WorkOS Dashboard > Log Streams
  |
  +-- Customer IT admin --> Enable Admin Portal (see workos-admin-portal skill)
```

### Supported Providers (as of last doc update)

Check fetched docs for current list. Known providers:

- **Datadog** — HTTP Log Intake API (regional endpoints)
- **Splunk** — HTTP Event Collector (HEC)
- **AWS S3** — Individual JSON files per event
- **Google Cloud Storage** — Similar to S3
- **HTTP POST** — Generic webhook to any endpoint

### IP Allowlist (IMPORTANT)

If streaming to IP-restricted hosts, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Verify:** Test event reaches destination. WorkOS Dashboard shows delivery status.

### Provider-Specific Notes

**Datadog:**
- Events sent to `http-intake.logs.datadoghq.com` (or regional variant)
- Payload wrapped in `message` field
- Check fetched docs for exact payload structure

**Splunk:**
- Events sent to HEC endpoint
- Payload wrapped in `event` field
- Requires HEC token configuration

**AWS S3:**
- Uses cross-account IAM role with external ID
- One JSON file per event (not batched)
- Includes `ContentMD5` header for Object Lock compatibility
- Check fetched docs for IAM policy requirements

## Step 6: Query and Export Events

WebFetch the exporting-events documentation for current API endpoints and parameters.

**Typical use cases:**

1. **Display events in your UI** — Fetch events for organization, paginate results
2. **Compliance exports** — Download events as CSV
3. **Custom analytics** — Query events by date range, action type, actor

Check fetched docs for:
- API endpoint for listing events
- Query parameters (organization_id, action, date ranges)
- Pagination cursors
- Export formats (JSON, CSV)

## Step 7: Edit/Delete Events (RARE)

**WARNING:** Editing audit logs contradicts their immutability purpose. Only use for correcting errors.

Check fetched docs for:
- Permissions required to edit events
- API endpoint for updates
- What fields can be modified
- Audit trail of edits

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables set
[ -n "$WORKOS_API_KEY" ] && echo "PASS" || echo "FAIL: WORKOS_API_KEY missing"
[ -n "$WORKOS_CLIENT_ID" ] && echo "PASS" || echo "FAIL: WORKOS_CLIENT_ID missing"

# 2. SDK installed (pick language)
# Node.js
npm list @workos-inc/node 2>/dev/null && echo "PASS" || echo "FAIL: SDK not installed"

# Python
python -c "import workos; print('PASS')" 2>/dev/null || echo "FAIL: SDK not installed"

# Ruby
bundle show workos &>/dev/null && echo "PASS" || echo "FAIL: SDK not installed"

# 3. Dashboard has at least one event schema defined
# Manual check: Visit https://dashboard.workos.com/audit-logs
# Should see at least one event action listed

# 4. Test event emission (SDK method from fetched docs)
# Run your emit_event() call with test data
# Should return 200 OK or success response

# 5. If using Log Streams, verify delivery
# WorkOS Dashboard > Log Streams > [Your Stream] > View Recent Events
# Should show delivered events
```

## Error Recovery

### "Event schema validation failed"

**Root cause:** Event metadata doesn't match defined JSON Schema.

**Fix:**
1. Go to Dashboard > Audit Logs > [Event Type] > Edit Schema
2. Compare emitted metadata structure with schema
3. Either fix emit code or relax schema constraints
4. **Common mismatch:** Sending string when schema expects integer, or vice versa

### "organization_id is required"

**Root cause:** Missing or empty organization_id in event payload.

**Fix:** Every audit log event MUST include a valid organization_id. This links the event to a customer organization.

```bash
# Verify organization exists
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations/{org_id}
```

### "Metadata key exceeds 40 characters"

**Root cause:** Metadata key name too long.

**Fix:** Rename key to 40 characters or less. This is a hard limit enforced by WorkOS.

### "Too many metadata keys (>50)"

**Root cause:** Metadata object has more than 50 keys.

**Fix:** Consolidate metadata or move non-critical data elsewhere. Consider nested objects if schema allows.

### Log Stream delivery failures

**Symptom:** Events not appearing in Datadog/Splunk/S3.

**Debug steps:**

```
Check Dashboard delivery status
  |
  +-- "IP blocked" --> Add WorkOS IPs to allowlist (see Step 5)
  |
  +-- "Auth failed" --> Verify credentials (API keys, IAM roles)
  |
  +-- "Endpoint unreachable" --> Check destination URL, firewall rules
  |
  +-- "Invalid payload" --> Check provider-specific payload format in fetched docs
```

### "API key does not have audit_logs scope"

**Root cause:** API key lacks permission to create audit log events.

**Fix:**
1. Go to Dashboard > API Keys
2. Regenerate key with "Audit Logs" permission enabled
3. Update `WORKOS_API_KEY` environment variable

### SDK import errors

**Node.js:** `Cannot find module '@workos-inc/node'`

```bash
# Reinstall SDK
npm install @workos-inc/node
# Verify installation
ls node_modules/@workos-inc/node
```

**Python:** `ModuleNotFoundError: No module named 'workos'`

```bash
# Reinstall SDK
pip install workos
# Verify installation
python -c "import workos; print(workos.__version__)"
```

**Ruby:** `cannot load such file -- workos`

```bash
# Add to Gemfile and install
bundle add workos
bundle install
```

## Related Skills

- **workos-api-audit-logs**: API reference for programmatic event creation
- **workos-admin-portal**: Let customers configure Log Streams themselves
- **workos-events**: Webhook events for audit log changes (if available)
