---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. https://workos.com/docs/events/index
2. https://workos.com/docs/events/data-syncing/webhooks
3. https://workos.com/docs/events/data-syncing/events-api
4. https://workos.com/docs/events/data-syncing/data-reconciliation
5. https://workos.com/docs/events/observability/datadog

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Prerequisites Check

- Confirm `WORKOS_API_KEY` exists in environment (starts with `sk_`)
- Confirm `WORKOS_CLIENT_ID` exists in environment (starts with `client_`)
- Confirm WorkOS SDK installed: Check `package.json` or equivalent dependency file
- **REQUIRED:** Confirm at least ONE active connection in WorkOS Dashboard:
  - SSO connection configured, OR
  - Directory Sync connection configured
  
**Why:** Events are generated from SSO/Directory activity. Without a connection, no events will exist to sync.

## Step 3: Choose Data Sync Method (Decision Tree)

```
What is your use case?
  |
  +-- Real-time processing (user actions, state changes)
  |     --> Use Webhooks (Step 4)
  |
  +-- Batch processing, backfill, reconciliation
  |     --> Use Events API (Step 5)
  |
  +-- Observability/analytics (not app state)
        --> Use Datadog streaming (Step 6)
```

**Can use multiple methods together.** Example: Webhooks for real-time + Events API for daily reconciliation.

## Step 4: Webhooks Implementation

### 4A: Create Webhook Endpoint

1. Create HTTP endpoint that accepts POST requests
2. Endpoint MUST respond with `200 OK` within timeout (consult fetched docs for timeout value)
3. Do NOT block on business logic — acknowledge first, process async

**Retry behavior (from docs):** WorkOS retries up to 6 times over 3 days with exponential backoff if endpoint does not return `200 OK`.

### 4B: Validate Webhook Signature (CRITICAL)

**Security requirement:** Validate ALL webhook requests before processing.

#### Using SDK (Recommended)

WebFetch webhook docs for current SDK method name. Pattern is typically:

```
SDK method takes:
  - Payload (raw request body as string)
  - WorkOS-Signature header value
  - Webhook secret (from Dashboard)
  - Optional: tolerance in seconds (default varies by SDK)
```

**Obtain webhook secret:**
1. Navigate to WorkOS Dashboard > Webhooks
2. Register endpoint URL
3. Copy secret (starts with `whsec_`)
4. Store as environment variable: `WORKOS_WEBHOOK_SECRET`

#### Manual Validation (If SDK Unavailable)

Parse `WorkOS-Signature` header:

```
Format: t=<issued_timestamp>,v1=<signature_hash>

Where:
  - issued_timestamp: milliseconds since epoch
  - signature_hash: HMAC SHA256 signature
```

Steps:
1. Extract timestamp and hash from header
2. Verify timestamp within acceptable range (recommend ≤5 minutes from current time)
3. Construct expected signature (see fetched docs for exact concatenation format)
4. Compare using constant-time comparison to prevent timing attacks

**If validation fails:** Return `401 Unauthorized`, do NOT process event.

### 4C: Register Endpoint in Dashboard

1. Navigate to WorkOS Dashboard > Webhooks
2. Add endpoint URL (must be HTTPS in production)
3. Select event types to receive (or "all events")
4. Save and copy webhook secret

### 4D: IP Allowlist (Optional Security Layer)

Restrict endpoint access to WorkOS IPs (from docs):

```
3.217.146.166
<check fetched docs for complete list>
```

Configure at firewall/load balancer level, not in application code.

## Step 5: Events API Implementation

### 5A: Polling Pattern

Use for:
- Backfilling historical data
- Reconciling missed webhooks
- Batch processing

WebFetch Events API docs for:
- Endpoint URL and authentication
- Pagination parameters
- Rate limits
- Event filtering options

### 5B: Implement Pagination Loop

Pattern (exact method names from fetched docs):

1. Make initial request with page size limit
2. Store `after` cursor from response
3. Loop: Request next page using cursor
4. Exit when no more pages

**Store cursor position:** Persist last processed event ID to resume after failures.

### 5C: Deduplication (CRITICAL)

Events API may return duplicate events during retries or pagination errors.

**Required:** Track processed event IDs in persistent storage (database, cache).

```
Processing logic:
  For each event:
    1. Check if event.id exists in processed_events table
    2. If exists: Skip
    3. If new: Process + Insert event.id
```

## Step 6: Datadog Streaming Setup

**Use case:** Observability, analytics, alerting — NOT for syncing application state.

### 6A: Configure in Dashboard

1. Navigate to WorkOS Dashboard > Integrations > Datadog
2. Enter Datadog API key
3. Select event types to stream
4. Enable integration

### 6B: View in Datadog

Events appear in Datadog Logs with prefix `workos.`

WebFetch Datadog docs for:
- Available metrics
- Dashboard templates
- Alert configuration

**Note:** This is one-way streaming. Use Webhooks or Events API for bidirectional sync.

## Step 7: Event Processing Patterns

### Event Types

WebFetch events index for complete list of event types. Common patterns:

```
Event type naming:
  <resource>.<action>

Examples (verify against fetched docs):
  - user.created
  - user.updated
  - directory.user_created
  - connection.activated
```

### Idempotency (CRITICAL)

**All event handlers MUST be idempotent.** WorkOS may deliver same event multiple times.

Pattern:
```
function handleEvent(event) {
  // Use event.id as idempotency key
  if (alreadyProcessed(event.id)) {
    return; // Safe to ignore
  }
  
  // Process event
  applyChanges(event);
  
  // Mark as processed
  markProcessed(event.id);
}
```

### Event Ordering

**Do NOT assume events arrive in chronological order.**

If order matters:
- Use `event.created_at` or equivalent timestamp field
- Implement conflict resolution (last-write-wins, version numbers, etc.)

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Webhook endpoint responds
curl -X POST https://your-endpoint.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}' \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: 200

# 2. Webhook secret configured
echo $WORKOS_WEBHOOK_SECRET | grep -q "^whsec_" && echo "PASS" || echo "FAIL"

# 3. WorkOS API key valid
curl https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: 200 (or check fetched docs for correct test endpoint)

# 4. SDK installed
# Node.js:
npm list @workos-inc/node 2>/dev/null || echo "SDK not installed"
# Python:
pip show workos 2>/dev/null || echo "SDK not installed"
# Go:
go list -m github.com/workos/workos-go 2>/dev/null || echo "SDK not installed"

# 5. Active connection exists (manual check)
# Navigate to WorkOS Dashboard > Connections
# Confirm at least 1 SSO or Directory connection shows "Active"
```

**If check #5 fails:** Create test connection in Dashboard. Events require active connections.

## Error Recovery

### Webhook signature validation fails

**Symptoms:** `401 Unauthorized` or signature mismatch errors

**Root causes:**
1. Wrong secret — verify copied from correct endpoint in Dashboard
2. Raw body not preserved — middleware/framework parsing body as JSON
3. Header name case mismatch — use exact case `WorkOS-Signature`
4. Timestamp drift — server clock >5 minutes off

**Fixes:**
1. Re-copy secret from Dashboard, ensure no whitespace
2. Access raw request body BEFORE JSON parsing (framework-specific)
3. Check header parsing is case-sensitive
4. Sync server clock: `sudo ntpdate -s time.nist.gov` or equivalent

### Events API returns 401

**Root cause:** Invalid or missing API key

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key has Events API permission in Dashboard
3. Regenerate key if compromised

### No events received in webhook

**Troubleshooting tree:**

```
No events received?
  |
  +-- Check Dashboard > Webhooks > Delivery Logs
  |     |
  |     +-- No delivery attempts?
  |           --> No events generated yet (trigger test event)
  |
  +-- Delivery attempts show errors?
        |
        +-- Timeout errors?
        |     --> Endpoint too slow, return 200 faster
        |
        +-- Connection refused?
        |     --> Endpoint URL wrong or not accessible
        |
        +-- SSL errors?
              --> Invalid certificate (production requires valid HTTPS)
```

### Duplicate events processed

**Root cause:** Missing idempotency check

**Fix:** Implement event.id deduplication (see Step 7)

### Events out of order

**Root cause:** Network/retry timing

**Fix:** Do NOT rely on delivery order. Use timestamps and conflict resolution.

### Datadog not showing events

**Symptoms:** Integration enabled but no logs in Datadog

**Checks:**
1. Datadog API key valid and has write permissions
2. Selected event types are actually occurring (trigger test event)
3. Datadog account in correct region (US vs EU)

**Fix:** Check WorkOS Dashboard > Integrations > Datadog for error messages

## Data Reconciliation Pattern

**Recommended:** Run daily reconciliation job to catch missed webhooks.

```
Reconciliation flow:
  1. Query Events API for last 24 hours
  2. Compare event IDs against processed_events table
  3. Reprocess any missing events
  4. Alert if gap >threshold (e.g., >10 missing events)
```

This pattern combines real-time webhooks with periodic batch verification.

## Related Skills

- **workos-audit-logs** — Track security-relevant events in your app
- **workos-directory-sync** — Generate directory events to sync
- **workos-sso** — Generate SSO events to sync
