---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch ALL of these URLs — they are the source of truth:

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

If this skill conflicts with fetched documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### Account Prerequisites

Confirm in WorkOS Dashboard:

- Active SSO connection OR Directory Sync connection exists
- Without either, no events will generate (events require identity provider activity)

### Environment Variables

Check for `WORKOS_API_KEY` in environment:

```bash
grep -r "WORKOS_API_KEY" .env .env.local .env.production 2>/dev/null || echo "MISSING"
```

**Critical:** Key must start with `sk_` (secret key). If missing, get from https://dashboard.workos.com/api-keys

### SDK Installation

Verify WorkOS SDK is installed:

```bash
# Node.js
ls node_modules/@workos-inc 2>/dev/null || echo "SDK not installed"

# Python
pip show workos 2>/dev/null || echo "SDK not installed"

# Ruby
gem list | grep workos || echo "SDK not installed"
```

If SDK missing, install before continuing.

## Step 3: Choose Data Sync Method (Decision Tree)

```
How will you consume events?
  |
  +-- Real-time streaming to Datadog? --> Go to Step 4 (Datadog)
  |
  +-- Push-based (receive POST requests)? --> Go to Step 5 (Webhooks)
  |
  +-- Poll-based (query events on-demand)? --> Go to Step 6 (Events API)
```

**Note:** Webhooks and Events API can be used together. Datadog is separate observability config.

## Step 4: Datadog Streaming Setup

### Configuration in WorkOS Dashboard

1. Navigate to https://dashboard.workos.com/events/streams
2. Click "Add Stream" → Select "Datadog"
3. Enter Datadog API key (from https://app.datadoghq.com/organization-settings/api-keys)
4. Select Datadog site (US1, EU1, etc.)
5. Enable stream

**Verify streaming is active:**

```bash
# Check Datadog for incoming events (wait 5 minutes after enabling)
# Log into Datadog → Logs → Search for "source:workos"
```

Events stream automatically — no code changes needed in your app.

**Skip to Step 7 (Verification) if only using Datadog.**

## Step 5: Webhook Implementation

### 5A: Create Webhook Endpoint

**Critical:** Endpoint MUST respond with `HTTP 200 OK` within timeout window (typically 10-30 seconds). Slow responses trigger retries.

Create route that:

1. Returns 200 immediately (before processing)
2. Validates signature
3. Processes event asynchronously (queue/background job)

**Pattern for immediate 200:**

```
Request received
  |
  +-- Validate signature (fast, <100ms)
  |     |
  |     +-- Invalid? --> Return 401 Unauthorized
  |     |
  |     +-- Valid? --> Continue
  |
  +-- Return 200 OK immediately
  |
  +-- Queue event for async processing (don't await)
```

**Example endpoint structure (framework-agnostic):**

```javascript
// POST /webhooks/workos
async function handler(request) {
  const payload = await request.text(); // Raw body string
  const signature = request.headers.get("WorkOS-Signature");

  // Step 1: Validate (fast)
  const isValid = validateWebhook(payload, signature, WEBHOOK_SECRET);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Step 2: Return 200 immediately
  const event = JSON.parse(payload);

  // Step 3: Queue for processing (fire-and-forget)
  queueEvent(event); // Do NOT await

  return new Response("OK", { status: 200 });
}
```

### 5B: Signature Validation (SDK Method)

Check fetched webhook docs for SDK method name. Common pattern:

```javascript
// Node.js SDK
const { Webhooks } = require("@workos-inc/node");
const webhooks = new Webhooks(WEBHOOK_SECRET);

const isValid = webhooks.verify(payload, signature, {
  tolerance: 180, // seconds, default varies by SDK
});
```

**Parameters (verify against fetched docs):**

- `payload` — Raw request body as string (NOT parsed JSON)
- `signature` — Value of `WorkOS-Signature` header
- `tolerance` — Max age in seconds (prevents replay attacks)

**If validation fails:**

- Check: Using raw body, not parsed JSON
- Check: Webhook secret matches Dashboard value
- Check: Request not older than tolerance window
- Check: Signature header exists and is correctly extracted

### 5C: Manual Validation (If SDK Not Available)

Parse `WorkOS-Signature` header:

```
Format: "t=1234567890,v1=abc123def456..."
  |
  +-- Extract issued_timestamp (after "t=", before ",")
  |
  +-- Extract signature_hash (after "v1=")
```

Validate timestamp:

```javascript
const now = Date.now();
const issued = parseInt(timestamp_from_header, 10);
const age = Math.abs(now - issued);

if (age > 300000) {
  // 5 minutes in milliseconds
  throw new Error("Webhook too old");
}
```

Compute expected signature:

```javascript
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(`${issued_timestamp}.${payload}`)
  .digest("hex");

// Compare signatures (timing-safe)
const matches = crypto.timingSafeEqual(
  Buffer.from(signature_hash),
  Buffer.from(expected),
);
```

**Critical:** Use timing-safe comparison to prevent timing attacks.

### 5D: Register Endpoint in Dashboard

1. Navigate to https://dashboard.workos.com/webhooks
2. Click "Add Endpoint"
3. Enter endpoint URL (must be HTTPS in production)
4. Select event types to receive (or "All events")
5. Save and copy webhook secret

**Store secret securely:**

```bash
# Add to .env (never commit to version control)
echo "WORKOS_WEBHOOK_SECRET=wh_sec_..." >> .env.local
```

### 5E: IP Allowlist (Optional Security)

Restrict endpoint to WorkOS IP addresses:

```
3.217.146.166
35.172.84.171
44.209.26.12
52.21.202.143
52.72.61.145
54.235.18.50
```

**Implementation depends on hosting platform:**

- **AWS ALB/CloudFront:** Security group rules
- **Cloudflare:** Firewall rule with IP list
- **Nginx:** `allow` directives
- **Vercel/Netlify:** Edge function IP check

**Verify allowlist doesn't block legitimate traffic:**

```bash
# Test from WorkOS IP (use webhook test tool in Dashboard)
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Step 6: Events API (Polling)

**Use case:** Pull events on-demand (e.g., batch sync, data reconciliation).

### 6A: List Events

Check fetched Events API docs for method signature. Common pattern:

```javascript
// Node.js SDK
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(WORKOS_API_KEY);

const events = await workos.events.listEvents({
  limit: 100,
  after: "event_123", // Pagination cursor
  events: ["dsync.user.created", "dsync.user.updated"], // Optional filter
  organization_id: "org_123", // Optional filter
});
```

**Response structure (verify in docs):**

```json
{
  "data": [
    {
      "id": "event_123",
      "event": "dsync.user.created",
      "created_at": "2024-01-15T10:00:00Z",
      "data": {
        /* event-specific payload */
      }
    }
  ],
  "list_metadata": {
    "after": "event_456"
  }
}
```

### 6B: Pagination Pattern

**Critical:** Events API uses cursor-based pagination. Do NOT use offset/limit pattern.

```
Fetch page 1 (no cursor)
  |
  +-- Response has list_metadata.after?
        |
        +-- YES --> Fetch next page with after=cursor
        |           |
        |           +-- Repeat until no after cursor
        |
        +-- NO --> Done (last page)
```

**Example loop:**

```javascript
let after = null;
const allEvents = [];

do {
  const page = await workos.events.listEvents({ after, limit: 100 });
  allEvents.push(...page.data);
  after = page.list_metadata?.after;
} while (after);
```

### 6C: Event Filtering

Apply filters to reduce response size:

- `events` — Array of event types (e.g., `['dsync.user.created']`)
- `organization_id` — Limit to specific org
- `range_start` / `range_end` — Time window (ISO 8601)

**Check docs for full filter list** — available filters vary by SDK version.

### 6D: Rate Limiting

Events API has rate limits (exact limits in fetched docs). Implement exponential backoff:

```javascript
async function fetchWithRetry(fetchFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      if (err.status === 429) {
        // Rate limit
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      throw err; // Non-retryable error
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Step 7: Event Processing Patterns

### Event Types

**Check fetched docs for complete event catalog.** Common event prefixes:

- `authentication.*` — AuthKit sign-in, sign-out, MFA
- `dsync.*` — Directory Sync user/group changes
- `sso.*` — SSO connection lifecycle
- `connection.*` — Connection status changes
- `user.*` — User management events

**Event naming convention:** `{domain}.{resource}.{action}`

Example: `dsync.user.created`, `authentication.email_verification_succeeded`

### Idempotency

**Critical:** WorkOS retries failed webhooks. Your processor MUST be idempotent.

**Pattern:**

```javascript
async function processEvent(event) {
  // Check if already processed
  const exists = await db.events.findOne({ id: event.id });
  if (exists) {
    console.log(`Event ${event.id} already processed`);
    return; // Skip
  }

  // Process event
  await handleEventType(event);

  // Mark as processed
  await db.events.create({ id: event.id, processed_at: new Date() });
}
```

**Alternative:** Use `event.id` as database primary key with unique constraint. Duplicate inserts will fail gracefully.

### Data Reconciliation

**Use case:** Sync state after webhook downtime or missed events.

**Pattern (from fetched reconciliation docs):**

1. Record last successfully processed event ID and timestamp
2. On restart, fetch events since last timestamp via Events API
3. Process missed events before resuming webhook consumption
4. Use event IDs to deduplicate (webhooks + API may overlap)

**Example reconciliation flow:**

```
System restart detected
  |
  +-- Load last_processed_at from database
  |
  +-- Fetch events via API: range_start = last_processed_at
  |     |
  |     +-- Process each event (check idempotency)
  |
  +-- Update last_processed_at to latest event timestamp
  |
  +-- Resume webhook processing
```

## Verification Checklist (ALL MUST PASS)

### Webhook Verification

```bash
# 1. Endpoint returns 200
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  | grep -q "200" && echo "PASS" || echo "FAIL"

# 2. Webhook secret configured
grep -q "WORKOS_WEBHOOK_SECRET" .env* && echo "PASS" || echo "FAIL"

# 3. Endpoint registered in Dashboard
# Manual: Check https://dashboard.workos.com/webhooks shows your URL

# 4. Test event received (use Dashboard test tool)
# Manual: Send test event, check logs for event.id
```

### Events API Verification

```bash
# 1. API key configured
grep -q "WORKOS_API_KEY" .env* && echo "PASS" || echo "FAIL"

# 2. SDK can list events
# Run in project (Node.js example):
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.events.listEvents({ limit: 1 })
  .then(() => console.log('PASS'))
  .catch(err => console.error('FAIL:', err.message));
"
```

### Datadog Verification

```bash
# 1. Stream configured
# Manual: Check https://dashboard.workos.com/events/streams shows "Active"

# 2. Events arriving in Datadog (wait 5-10 minutes after setup)
# Manual: Check Datadog logs for source:workos
```

## Error Recovery

### "Webhook signature validation failed"

**Root causes:**

1. **Using parsed JSON instead of raw body**
   - Fix: Pass raw request body string to validation function
   - Example: Express.js needs `express.raw({ type: 'application/json' })`

2. **Wrong webhook secret**
   - Fix: Copy secret from https://dashboard.workos.com/webhooks
   - Verify: Secret starts with `wh_sec_`

3. **Clock skew / old timestamp**
   - Fix: Increase tolerance parameter (e.g., 300 seconds)
   - Check: Server clock is synchronized (NTP)

4. **Request modified by middleware**
   - Fix: Disable body parsing middleware for webhook route
   - Check: Remove JSON parsing before signature validation

### "Events API returns 401 Unauthorized"

**Root causes:**

1. **Invalid API key**
   - Fix: Verify key starts with `sk_` (secret key), not `pk_` (publishable)
   - Get correct key: https://dashboard.workos.com/api-keys

2. **API key not in request**
   - Fix: Pass key to SDK constructor or as environment variable
   - Check: SDK documentation for authentication method

### "No events returned from API"

**Root causes:**

1. **No SSO/Directory Sync connections**
   - Fix: Configure at least one connection in Dashboard
   - Events require identity provider activity

2. **Time range filter excludes data**
   - Fix: Remove `range_start`/`range_end` or expand window
   - Check: Use ISO 8601 format for timestamps

3. **Event type filter too restrictive**
   - Fix: Remove `events` filter or add more event types
   - Check: Fetched docs for valid event type strings

### "Webhook endpoint timing out"

**Root causes:**

1. **Processing events synchronously before returning 200**
   - Fix: Return 200 immediately, process in background
   - Pattern: Queue event → Return 200 → Process async

2. **Database query blocking response**
   - Fix: Move database operations to async job
   - Use: Redis queue, SQS, or similar

3. **External API calls in handler**
   - Fix: Never make external calls before returning 200
   - Queue for later processing

### "Duplicate event processing"

**Root causes:**

1. **No idempotency check**
   - Fix: Store processed event IDs in database
   - Check: Query by `event.id` before processing

2. **Webhook retries during downtime**
   - Expected: WorkOS retries up to 6 times over 3 days
   - Fix: Implement idempotency pattern (Step 7)

### "Datadog not receiving events"

**Root causes:**

1. **Stream not enabled in Dashboard**
   - Fix: Check https://dashboard.workos.com/events/streams
   - Enable stream if showing "Inactive"

2. **Wrong Datadog site selected**
   - Fix: Verify site matches your Datadog URL
   - US1: app.datadoghq.com, EU1: app.datadoghq.eu

3. **Invalid Datadog API key**
   - Fix: Generate new key in Datadog organization settings
   - Test: Use Datadog API validation endpoint

4. **No events generated yet**
   - Wait: Streams require active user/directory activity
   - Test: Trigger SSO sign-in or Directory Sync operation

## Related Skills

None (Events is infrastructure — auth/directory skills consume events, not vice versa)
