---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Required Configuration

Check for these environment variables:

- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

### Event Source Prerequisites

**CRITICAL:** WorkOS Events require an active event source. You CANNOT receive events without one of:

- An SSO connection (see skill: `workos-sso`)
- A Directory Sync connection (see skill: `workos-directory-sync`)

**Verify event source exists:**

```bash
# Check WorkOS Dashboard under Integrations
# OR query via API if you have connections
curl -X GET https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If no connections exist, you must set up SSO or Directory Sync first. Events cannot be generated without them.

## Step 3: Choose Data Sync Method (Decision Tree)

```
How do you want to receive events?
  |
  +-- Real-time processing --> Use Webhooks (Step 4)
  |
  +-- Batch/on-demand fetch --> Use Events API (Step 5)
  |
  +-- Analytics/monitoring --> Use Datadog (Step 6)
```

**Multiple methods:** You can enable webhooks AND poll the Events API simultaneously. They are not mutually exclusive.

## Step 4: Webhook Implementation

### 4A: Create Webhook Endpoint

Create a POST route that:
1. Receives raw request body (do NOT parse automatically — signature validation needs raw bytes)
2. Extracts `WorkOS-Signature` header
3. Validates signature (Step 4B)
4. Processes event payload
5. Returns HTTP 200 within 30 seconds

**Example route structure (framework-agnostic):**

```
POST /webhooks/workos
  |
  +-- Extract raw body
  +-- Extract WorkOS-Signature header
  +-- Validate signature (SDK or manual)
  +-- Parse JSON only after validation
  +-- Process event
  +-- Return 200 OK
```

**CRITICAL timing:** WorkOS expects HTTP 200 within 30 seconds. If your processing takes longer:
- Return 200 immediately
- Queue event for async processing
- Do NOT wait for processing to complete before responding

**Retry behavior:** WorkOS retries failed deliveries (non-200 responses) up to 6 times over 3 days with exponential backoff. The HTTP status you return does NOT indicate processing success — only delivery success.

### 4B: Signature Validation

**OPTION 1: SDK Validation (Recommended)**

Detect SDK language from project, use validation method from fetched docs.

**Common SDK pattern (check docs for exact method name):**

```
SDKClient.webhooks.validate(
  payload: raw_request_body,
  signature: request.headers['WorkOS-Signature'],
  secret: WORKOS_WEBHOOK_SECRET
)
```

The method returns true/false or throws exception. Check fetched docs for exact behavior.

**Optional tolerance parameter:** Most SDKs accept a `tolerance` parameter (in seconds) to allow clock skew. Default is typically 180-300 seconds. Adjust if you see legitimate webhooks failing timestamp validation.

**OPTION 2: Manual Validation**

If SDK unavailable or validation method not found:

1. **Parse header:**

```
WorkOS-Signature header format:
t=1234567890123, v1=abc123def456...

Extract:
  issued_timestamp = value after "t="
  signature_hash = value after "v1="
```

2. **Timestamp validation:**

```python
current_time_ms = current_timestamp_in_milliseconds()
if abs(current_time_ms - issued_timestamp) > tolerance_ms:
    reject_webhook()
```

Recommended tolerance: 300000ms (5 minutes)

3. **Signature computation:**

```
expected_signature = HMAC_SHA256(
  key: WORKOS_WEBHOOK_SECRET,
  message: issued_timestamp + "." + raw_request_body
)

if expected_signature != signature_hash:
    reject_webhook()
```

**CRITICAL:** Use raw request body bytes, not parsed JSON. Parse AFTER validation succeeds.

### 4C: Register Endpoint in Dashboard

1. Navigate to WorkOS Dashboard → Webhooks
2. Add endpoint URL (must be HTTPS in production)
3. Copy generated webhook secret
4. Store secret as `WORKOS_WEBHOOK_SECRET` environment variable

**IP Allowlist (Optional):**

WorkOS webhooks originate from these IPs:
- `3.217.146.166`
- (Check fetched docs for complete list)

Configure firewall/load balancer to only accept webhook requests from these IPs.

### 4D: Event Processing Pattern

**Decision tree for event handling:**

```
Received event type?
  |
  +-- authentication.* --> Update user session cache
  |
  +-- dsync.* --> Sync directory data to database
  |
  +-- connection.* --> Update connection status
  |
  +-- Unknown type --> Log and ignore (forward compatibility)
```

**Event structure (common fields):**

```json
{
  "event": "authentication.email_verification_succeeded",
  "id": "event_01H1234567890ABCDEFGHIJK",
  "created_at": "2024-01-01T00:00:00.000Z",
  "data": { ... }
}
```

Check fetched docs for complete event type list and data structures.

**Idempotency:** Store `event.id` in processed events table. If duplicate received (due to retries), skip processing.

## Step 5: Events API Implementation

Use this for:
- Backfilling historical events
- On-demand event queries
- Batch processing

**Endpoint:** `GET https://api.workos.com/events`

**Query parameters (check docs for complete list):**

- `events[]` - Filter by event types (can specify multiple)
- `limit` - Page size (default 10, max from docs)
- `after` - Pagination cursor
- `occurred_at_gte` - Filter events after timestamp
- `occurred_at_lte` - Filter events before timestamp

**Pagination pattern:**

```
1. Make initial request with limit
2. Process events from response
3. If response contains "list_metadata.after", repeat with after cursor
4. Continue until no more pages
```

**SDK usage (check fetched docs for exact method):**

Most SDKs provide a list method like `client.events.list(params)`. Use pagination helper if available.

## Step 6: Datadog Integration

**Use case:** Analytics, monitoring, alerting on WorkOS events WITHOUT building custom infrastructure.

### 6A: Enable Datadog Streaming

1. Navigate to WorkOS Dashboard → Integrations → Datadog
2. Enter Datadog API key
3. Select Datadog site (us1, eu1, etc.)
4. Choose event types to stream (or stream all)

**CRITICAL:** This is a WorkOS Dashboard configuration, NOT code. Once enabled, events stream automatically — no SDK integration required.

### 6B: Datadog Dashboard Setup

WorkOS events appear in Datadog Logs with source tag `workos`.

**Query pattern:**

```
source:workos event:<event_type>
```

**Example use cases:**

- Failed auth attempts: `source:workos event:authentication.oauth_token_failed`
- New SSO connections: `source:workos event:connection.activated`
- Directory sync errors: `source:workos event:dsync.group.created status:error`

**Alerting:** Create Datadog monitors on event patterns (e.g., spike in auth failures, new connection activations).

Check fetched Datadog docs for pre-built dashboard templates.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify setup:

```bash
# 1. Check webhook endpoint exists (adjust path to your route)
grep -r "WorkOS-Signature" . --include="*.ts" --include="*.js" --include="*.py"

# 2. Check webhook secret is configured
env | grep WORKOS_WEBHOOK_SECRET || echo "FAIL: Webhook secret not set"

# 3. Check event source exists (requires API key)
curl -s -X GET "https://api.workos.com/sso/connections?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep -q '"id"' && echo "PASS: Event source exists" || echo "FAIL: No SSO/Directory connections"

# 4. Test webhook endpoint returns 200 (replace URL)
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP Status: %{http_code}\n"
# Should return 200 (may fail validation, but should not 404)
```

**Manual verification in WorkOS Dashboard:**

1. Navigate to Webhooks section
2. Find your endpoint
3. Click "Send test event"
4. Check endpoint logs for received event
5. Verify HTTP 200 response recorded

## Error Recovery

### "Webhook signature validation failed"

**Root cause:** Signature mismatch between WorkOS and your endpoint.

**Fix checklist:**

1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard exactly (no whitespace, quotes)
2. Ensure using raw request body for validation (not parsed JSON)
3. Check timestamp tolerance isn't too strict (increase to 300 seconds)
4. Verify HMAC_SHA256 computation: `timestamp + "." + body`
5. If using reverse proxy, ensure it forwards `WorkOS-Signature` header

**Debug pattern:**

```bash
# Log these values in your webhook handler
echo "Received timestamp: $issued_timestamp"
echo "Current timestamp: $(date +%s)000"
echo "Difference (ms): $(($(date +%s)000 - issued_timestamp))"
# Should be < 300000 (5 minutes)
```

### "No events received"

**Root causes (in order of likelihood):**

1. **No event source:** Check Step 2 verification — SSO or Directory Sync must be configured
2. **Webhook not registered:** Check Dashboard → Webhooks for endpoint
3. **Endpoint unreachable:** WorkOS cannot reach endpoint (firewall, DNS, HTTPS cert issues)
4. **Endpoint timing out:** Takes >30 seconds to return 200

**Diagnostic:**

```bash
# Check WorkOS Dashboard webhook logs for delivery attempts
# Look for status codes, error messages

# Test endpoint externally
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -H "WorkOS-Signature: t=1234567890123, v1=test" \
  -d '{"event": "test"}' \
  -v
```

If curl fails, WorkOS cannot reach endpoint. Fix networking first.

### "Events API returns empty list"

**Root causes:**

1. **No events generated yet:** Event source exists but no activity
2. **Time filter too narrow:** `occurred_at_gte` excludes all events
3. **Wrong event type filter:** `events[]` parameter doesn't match actual events

**Fix:**

```bash
# Query without filters to see if ANY events exist
curl -X GET "https://api.workos.com/events?limit=100" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# If empty, trigger event manually (e.g., test SSO login)
```

### "Datadog not receiving events"

**Root causes:**

1. **Integration not enabled:** Check Dashboard → Integrations → Datadog
2. **Wrong API key:** Datadog key invalid or lacks log write permissions
3. **Event type not selected:** Datadog integration filtering out events

**Fix:** Re-configure Datadog integration in Dashboard, ensure "All events" selected, verify API key in Datadog.

### SDK method not found

**Root cause:** Skill references method from newer SDK version.

**Fix:**

1. WebFetch the Events API docs again (Step 1)
2. Check SDK version in `package.json` / `requirements.txt`
3. Upgrade SDK if method is in newer version
4. If method doesn't exist, use manual HTTP request to Events API

## Related Skills

- **workos-audit-logs**: For compliance-focused event logging with longer retention
- **workos-sso**: Required event source for authentication events
- **workos-directory-sync**: Required event source for directory sync events
- **workos-authkit-nextjs**: Generates authentication events
- **workos-admin-portal**: Generates connection lifecycle events
