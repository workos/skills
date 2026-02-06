---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- generated -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs in order:

1. https://workos.com/docs/events/index
2. https://workos.com/docs/events/data-syncing/webhooks
3. https://workos.com/docs/events/data-syncing/events-api
4. https://workos.com/docs/events/data-syncing/data-reconciliation
5. https://workos.com/docs/events/observability/datadog

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_WEBHOOK_SECRET` - if using webhooks (generated in dashboard)

### Project Requirements

- Confirm WorkOS SDK installed: Check `package.json` or language-specific manifest
- Confirm you have an active SSO or Directory Sync connection (required to generate events)

**Verify in dashboard:** https://dashboard.workos.com/

- At least one connection exists (SSO or Directory)
- Connection status is "Active" or "Linked"

## Step 3: Choose Data Sync Strategy (Decision Tree)

```
Event data consumption pattern?
  |
  +-- Real-time push --> Use Webhooks (Step 4)
  |
  +-- Poll on-demand  --> Use Events API (Step 5)
  |
  +-- Both needed     --> Implement both + reconciliation (Step 6)
```

**Decision factors:**

- **Webhooks:** Instant delivery, requires public endpoint, WorkOS retries failures
- **Events API:** Poll at your pace, no endpoint needed, paginated results
- **Both:** Webhooks for speed + Events API to catch missed webhooks (recommended for critical data)

## Step 4: Webhook Implementation

### 4.1 Create Webhook Endpoint

Determine endpoint path based on your framework:

```
Framework/Language    --> Typical path pattern
Express.js            --> /webhooks/workos or /api/webhooks/workos
Next.js API Routes    --> app/api/webhooks/workos/route.ts
Flask/Django          --> /webhooks/workos/
Rails                 --> /webhooks/workos
```

**CRITICAL:** Endpoint must:

- Accept POST requests
- Return `HTTP 200 OK` within 5 seconds (WorkOS timeout)
- Return 200 even if processing fails (acknowledge receipt, process async)

### 4.2 Parse Raw Request Body

**Before processing:** Capture raw request body as string/bytes.

This is required for signature validation. Do NOT parse JSON first.

```
Framework-specific patterns:
  |
  +-- Express.js      --> Use express.raw() middleware
  |
  +-- Next.js 13+     --> await request.text()
  |
  +-- Flask           --> request.data or request.get_data()
  |
  +-- Django          --> request.body
```

### 4.3 Validate Webhook Signature

**BLOCKING:** Do not process events until signature validated.

**Option A: Use SDK (RECOMMENDED)**

Check SDK docs for method name (varies by language):

- Node.js: `workos.webhooks.verifyEvent(payload, headers, secret)`
- Python: `workos.webhooks.verify_event(payload, headers, secret)`
- Ruby: `WorkOS::Webhooks.verify_event(payload, headers, secret)`

SDK handles timestamp validation and HMAC verification.

**Option B: Manual Validation**

If SDK unavailable, implement this flow:

```
1. Extract WorkOS-Signature header
   Format: "t=<timestamp>, v1=<signature>"

2. Parse timestamp and signature:
   timestamp = value after "t="
   signature = value after "v1="

3. Validate timestamp:
   current_time - timestamp < 300 seconds (5 min tolerance)
   Reject if outside window (replay attack protection)

4. Compute expected signature:
   message = timestamp + "." + raw_payload
   expected = HMAC_SHA256(webhook_secret, message)

5. Compare signatures (constant-time comparison):
   if expected != signature: reject with 401
```

**On validation failure:** Return `401 Unauthorized`. Do NOT return 200.

### 4.4 Process Event

Parse validated payload as JSON. Event structure:

```typescript
{
  "id": "event_01...",
  "event": "dsync.user.created", // event type
  "data": { /* event-specific payload */ },
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

Implement event type routing:

```
event type                    --> action
dsync.user.created            --> Create user in your DB
dsync.user.updated            --> Update user in your DB
dsync.user.deleted            --> Soft delete or mark inactive
dsync.group.created           --> Create group/team
authentication.email_verified --> Mark email as verified
connection.activated          --> Log connection event
```

Check WebFetch docs for complete event type list and data schemas.

### 4.5 Respond Quickly

**CRITICAL:** Respond with 200 within 5 seconds, then process async.

Pattern for async processing:

```
1. Validate signature (fast, <100ms)
2. Store event in queue/DB (fast, <500ms)
3. Return HTTP 200 OK
4. Process event in background job
```

WorkOS will retry if you don't return 200:
- Retry schedule: exponential backoff
- Max retries: 6 attempts over 3 days
- Endpoint marked unhealthy after repeated failures

### 4.6 Register Endpoint in Dashboard

Navigate to: https://dashboard.workos.com/webhooks

1. Click "Add Endpoint"
2. Enter endpoint URL (must be HTTPS for production)
3. Select event types to receive (or "All events")
4. Copy webhook secret to `.env` as `WORKOS_WEBHOOK_SECRET`

**For local dev:** Use ngrok or similar tunnel:

```bash
ngrok http 3000
# Use ngrok HTTPS URL in dashboard
```

### 4.7 IP Allowlist (OPTIONAL)

Restrict endpoint to WorkOS IPs only:

```
52.21.191.26
18.205.106.236
3.217.146.166
```

Implementation varies by infrastructure:
- **AWS WAF/CloudFront:** IP set rules
- **Nginx:** `allow` directives
- **Express/middleware:** IP check before route handler

## Step 5: Events API Implementation (Polling)

### 5.1 Choose Polling Strategy

```
Data freshness needs?
  |
  +-- Near real-time (1-5 min) --> Frequent polling + cursor pagination
  |
  +-- Batch sync (hourly/daily)  --> Scheduled job + date range queries
  |
  +-- On-demand (user action)    --> Query when user requests data
```

### 5.2 Fetch Events with SDK

Check SDK docs for method signature. Typical pattern:

```typescript
// Cursor-based pagination (recommended)
const events = await workos.events.list({
  events: ['dsync.user.created', 'dsync.user.updated'], // filter by type
  after: lastCursor, // resume from previous fetch
  limit: 100 // max events per page
});

// Date range query
const events = await workos.events.list({
  range_start: '2024-01-01T00:00:00.000Z',
  range_end: '2024-01-02T00:00:00.000Z',
  limit: 100
});
```

**Pagination loop:**

```
cursor = null
all_events = []

while True:
  response = fetch_events(after=cursor, limit=100)
  all_events.extend(response.data)
  
  if not response.metadata.has_more:
    break
  
  cursor = response.metadata.after
```

### 5.3 Store Cursor Position

Persist `metadata.after` cursor to resume on next poll:

- Database: `polling_state` table with `cursor` column
- Redis: `SET workos:events:cursor "<cursor_value>"`
- File: `.workos_cursor` in secure location

**On first run:** Omit cursor to start from oldest available events (7 day retention).

### 5.4 Handle Rate Limits

Events API rate limit: Check docs for current limits (typically 100 req/min).

Implement exponential backoff on 429 responses:

```
if response.status == 429:
  retry_after = response.headers.get('Retry-After', 60)
  sleep(retry_after)
  retry_request()
```

## Step 6: Hybrid Approach (Webhooks + Reconciliation)

### 6.1 When to Use Hybrid

Use both webhooks AND Events API when:

- Critical data that cannot be missed (user provisioning, access control)
- Webhook endpoint might experience downtime
- Need to backfill historical events

### 6.2 Reconciliation Pattern

Implement periodic reconciliation job (e.g., every 6 hours):

```
1. Query Events API for events in last 24 hours
2. Compare event IDs with processed webhook events
3. Process any events missing from webhook flow
4. Log discrepancies for monitoring
```

**Storage schema:**

```sql
CREATE TABLE processed_events (
  event_id VARCHAR PRIMARY KEY,
  event_type VARCHAR,
  received_at TIMESTAMP,
  source VARCHAR, -- 'webhook' or 'api'
  processed BOOLEAN
);
```

Check for duplicates before processing:

```sql
SELECT 1 FROM processed_events WHERE event_id = ?
```

### 6.3 Deduplication Strategy

Events may arrive via both webhook and API:

```
Before processing event:
  |
  +-- Check if event_id exists in DB
      |
      +-- EXISTS     --> Skip (already processed)
      |
      +-- NOT EXISTS --> Process + insert event_id
```

Use database constraints or atomic operations to prevent race conditions.

## Step 7: Datadog Integration (Observability)

### 7.1 Enable in Dashboard

Navigate to: https://dashboard.workos.com/integrations

1. Find Datadog integration
2. Click "Configure"
3. Enter Datadog API key
4. Select event types to stream
5. Save configuration

**STOP:** Events will now stream automatically. No code changes needed.

### 7.2 View Events in Datadog

Events appear in Datadog Logs with:

- Source: `workos`
- Service: `workos-events`
- Tags: `event_type:<type>`, `connection_id:<id>`, `organization_id:<id>`

**Query examples:**

```
# All WorkOS events
source:workos

# Failed authentication attempts
source:workos event_type:authentication.failed

# Events for specific organization
source:workos @organization_id:org_123
```

### 7.3 Create Monitors (OPTIONAL)

Example monitor for failed logins:

```
source:workos event_type:authentication.failed
# Alert if count > 100 in 5 minutes
```

Use Datadog monitor UI or Terraform/API for setup.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm implementation:

### For Webhooks:

```bash
# 1. Check endpoint exists (adjust path for your project)
grep -r "webhooks/workos" . --include="*.ts" --include="*.js" --include="*.py"

# 2. Test endpoint responds
curl -X POST http://localhost:3000/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}' \
  # Should return 401 (signature validation) not 404

# 3. Verify webhook secret is set
grep WORKOS_WEBHOOK_SECRET .env || echo "FAIL: Missing webhook secret"

# 4. Check dashboard registration
# Manual: Visit https://dashboard.workos.com/webhooks
# Should see your endpoint listed
```

### For Events API:

```bash
# 1. Test API credentials
curl https://api.workos.com/events \
  -u "$WORKOS_API_KEY:" \
  -G --data-urlencode "limit=1"
  # Should return 200, not 401

# 2. Check cursor persistence (adjust for your storage)
grep -r "workos.*cursor" . --include="*.sql" --include="*.ts"
# Or check DB: SELECT cursor FROM polling_state;

# 3. Verify polling job exists (cron/scheduler)
crontab -l | grep workos || \
  grep -r "schedule.*workos" . --include="*.yml" --include="*.js"
```

### For Datadog (if configured):

```bash
# Check Datadog integration enabled
# Manual: Visit https://dashboard.workos.com/integrations
# Datadog should show "Connected"

# Query Datadog for recent events (requires Datadog CLI)
datadog logs query "source:workos" --from "5m"
```

## Error Recovery

### "Webhook signature validation failed"

**Root cause:** Signature mismatch or timestamp outside tolerance window.

**Fix:**

1. Verify `WORKOS_WEBHOOK_SECRET` matches dashboard value exactly (no extra whitespace)
2. Check system clock: `date -u` (must be within 5 min of actual time)
3. Confirm you're validating against RAW payload, not parsed JSON
4. Check WorkOS-Signature header is being passed to validator

**Debug pattern:**

```javascript
console.log('Raw payload:', payload);
console.log('Header:', request.headers['workos-signature']);
console.log('Secret (first 10 chars):', secret.substring(0, 10));
```

### "Events API returns 401 Unauthorized"

**Root cause:** Invalid or missing API key.

**Fix:**

1. Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_`)
2. Check key hasn't been rotated in dashboard
3. Confirm key is being passed correctly:
   - SDK: Should auto-read from env
   - Manual: Use HTTP Basic Auth with key as username, empty password

**Test directly:**

```bash
curl -u "YOUR_API_KEY:" https://api.workos.com/events
# Should return JSON, not {"message": "Unauthorized"}
```

### "No events returned from API"

**Root cause:** No events in time window or missing connection.

**Fix:**

1. Check date range: Events older than 7 days are purged
2. Verify connection exists: https://dashboard.workos.com/sso or /directory-sync
3. Trigger test event: Perform SSO login or Directory Sync to generate event
4. Query without filters: `workos.events.list({limit: 1})` to check any events exist

### "Webhook endpoint returning 200 but events not processing"

**Root cause:** Silent failure in async processing or DB writes.

**Fix:**

1. Check background job queue: Are jobs being enqueued?
2. Check job logs: Are async handlers throwing exceptions?
3. Add logging before return 200: `console.log('Event received:', event.id)`
4. Verify DB writes: `SELECT COUNT(*) FROM processed_events WHERE created_at > NOW() - INTERVAL 1 HOUR`

**Pattern for debugging:**

```javascript
app.post('/webhooks/workos', async (req, res) => {
  console.log('[WEBHOOK] Received:', req.body.id);
  
  try {
    validateSignature(req); // Should throw if invalid
    console.log('[WEBHOOK] Signature valid');
    
    await enqueueJob(req.body);
    console.log('[WEBHOOK] Job enqueued');
    
    res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] Error:', err);
    res.status(401).send('Invalid signature');
  }
});
```

### "Duplicate events being processed"

**Root cause:** Race condition between webhook and API polling, or retry logic.

**Fix:**

1. Implement idempotency check: Query `event_id` before processing
2. Use database unique constraint: `UNIQUE(event_id)`
3. Catch duplicate key errors gracefully:

```python
try:
    db.execute("INSERT INTO processed_events (event_id, ...) VALUES (?, ...)", event_id)
except IntegrityError:
    logger.info(f"Event {event_id} already processed,
