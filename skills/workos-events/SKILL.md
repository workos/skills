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
4. https://workos.com/docs/events/data-syncing/index
5. https://workos.com/docs/events/data-syncing/data-reconciliation
6. https://workos.com/docs/events/observability/datadog

If this skill conflicts with the documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check these environment variables exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Event Prerequisites

**CRITICAL:** Events require an active WorkOS connection:

- SSO connection configured, OR
- Directory Sync connection configured

Without these, WorkOS will not generate events. Verify in Dashboard: https://dashboard.workos.com/

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package.json or equivalent
grep -E "workos|@workos" package.json || echo "FAIL: WorkOS SDK not found"
```

## Step 3: Data Sync Strategy (Decision Tree)

WorkOS Events supports two sync patterns. Choose based on your architecture:

```
Data sync strategy?
  |
  +-- Real-time push --> Use Webhooks (Step 4)
  |                      Best for: Instant updates, background jobs
  |
  +-- Polling/ETL     --> Use Events API (Step 5)
                         Best for: Batch processing, data reconciliation
```

**Source:** https://workos.com/docs/events/data-syncing/index

You may use BOTH strategies simultaneously (e.g., webhooks for real-time + API for backfill).

## Step 4: Webhooks Implementation (If Chosen)

### 4.1: Create Webhook Endpoint

Create a route to receive `POST` requests from WorkOS.

**Framework examples:**

```
Express:      app.post('/workos-webhook', handler)
Next.js:      app/api/workos-webhook/route.ts
Fastify:      fastify.post('/workos-webhook', handler)
```

**CRITICAL:** Endpoint MUST respond with `HTTP 200 OK` within timeout window to prevent retries.

**Retry behavior:** WorkOS retries failed deliveries up to 6 times over 3 days with exponential backoff.

**Source:** https://workos.com/docs/events/data-syncing/webhooks

### 4.2: Register Endpoint in Dashboard

1. Go to https://dashboard.workos.com/webhooks
2. Add your endpoint URL (must be publicly accessible HTTPS)
3. Copy the webhook secret (starts with `wh_`)
4. Store secret as `WORKOS_WEBHOOK_SECRET` environment variable

**CRITICAL:** The secret is shown only once. If lost, regenerate in Dashboard.

### 4.3: Validate Webhook Signatures

**ALWAYS validate signatures** to prevent unauthorized requests.

#### Option A: SDK Validation (Recommended)

Check README for exact method names. Common pattern:

```typescript
import { Webhooks } from 'workos-sdk';

const webhooks = new Webhooks(process.env.WORKOS_WEBHOOK_SECRET!);

// In your handler
const payload = await request.text(); // Raw body
const signature = request.headers.get('WorkOS-Signature');

try {
  const event = webhooks.constructEvent(payload, signature);
  // Process event...
} catch (err) {
  return new Response('Invalid signature', { status: 400 });
}
```

**Tolerance parameter:** SDK allows configuring timestamp validation window (default 3-5 minutes). See docs for exact parameter name.

#### Option B: Manual Validation

If implementing validation without SDK:

1. **Parse header:** `WorkOS-Signature` contains `t=<timestamp>,v1=<signature>`
2. **Validate timestamp:** Reject if `|current_time - issued_timestamp| > 5_minutes`
3. **Compute HMAC:** `HMAC_SHA256(webhook_secret, timestamp + '.' + raw_body)`
4. **Compare:** Constant-time comparison against `signature_hash`

**Source:** https://workos.com/docs/events/data-syncing/webhooks

### 4.4: IP Allowlist (Optional Security)

Restrict endpoint access to WorkOS IPs:

```
3.217.146.166
54.173.238.147
```

**Implementation depends on infrastructure:**

- AWS: Security group rules
- Nginx: `allow` directives
- Cloudflare: Firewall rules

**Source:** https://workos.com/docs/events/data-syncing/webhooks

### 4.5: Process Events

After validation, handle events by type:

```typescript
switch (event.event) {
  case 'authentication.email_verification_succeeded':
    // Update user record
    break;
  case 'sso.connection.activated':
    // Notify customer success
    break;
  case 'dsync.user.created':
    // Provision user account
    break;
  // ... other event types
}
```

**Event types list:** WebFetch https://workos.com/docs/events/index for complete enumeration.

## Step 5: Events API Implementation (If Chosen)

Use the Events API for polling or data reconciliation.

### 5.1: Fetch Events

Check SDK README for exact method name (commonly `listEvents`):

```typescript
import { WorkOS } from 'workos-sdk';

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

const events = await workos.events.listEvents({
  limit: 100,
  after: lastProcessedEventId, // For pagination
  events: ['dsync.user.created', 'dsync.user.updated'], // Filter by type
  occurred_at_gt: '2024-01-01T00:00:00Z', // Time range
});
```

**Pagination:** Use `after` cursor from previous response for next batch.

**Source:** https://workos.com/docs/events/data-syncing/events-api

### 5.2: Store Cursor for Resumption

Track the last processed event ID to resume from failure:

```typescript
// After processing batch
await db.updateCursor('workos_events', events.data[events.data.length - 1].id);
```

### 5.3: Handle Idempotency

Events API may return duplicate events. Deduplicate by `event.id`:

```typescript
if (await db.eventExists(event.id)) {
  continue; // Skip already processed
}
```

## Step 6: Data Reconciliation (Optional)

For systems requiring eventual consistency guarantees, implement reconciliation:

```
Reconciliation strategy?
  |
  +-- Periodic full sync --> Query all resources via SDK
  |                          Frequency: Daily/Weekly
  |
  +-- Event replay        --> Re-fetch events for time range
                             Use: After extended downtime
```

**Source:** https://workos.com/docs/events/data-syncing/data-reconciliation

**Implementation pattern:**

```typescript
// Full reconciliation
const allUsers = await workos.directorySync.listUsers({ directory: dirId });
await reconcileWithLocalDatabase(allUsers);

// Event replay
const missedEvents = await workos.events.listEvents({
  occurred_at_gt: lastKnownGoodTimestamp,
  occurred_at_lt: currentTimestamp,
});
```

## Step 7: Datadog Integration (Optional Observability)

To stream events to Datadog for monitoring and alerting:

### 7.1: Enable in Dashboard

1. Go to https://dashboard.workos.com/integrations
2. Find Datadog integration
3. Enter Datadog API key
4. Select event types to stream

**Source:** https://workos.com/docs/events/observability/datadog

### 7.2: Create Datadog Dashboards

WorkOS events appear in Datadog Logs with source `workos`.

**Common queries for dashboards:**

```
# Sign-in trends
source:workos @event:authentication.*

# Failed authentication attempts
source:workos @event:authentication.* status:error

# SSO connection changes
source:workos @event:sso.connection.*

# Directory sync activity
source:workos @event:dsync.*
```

### 7.3: Configure Alerts

Set up monitors for anomalies:

- Spike in `authentication.failed` events
- Drop in successful sign-ins
- New SSO connection activated
- Directory sync errors

## Verification Checklist (ALL MUST PASS)

Run these commands to verify implementation:

```bash
# 1. Environment variables set
env | grep -E "WORKOS_API_KEY|WORKOS_WEBHOOK_SECRET" || echo "FAIL: Missing env vars"

# 2. Webhook endpoint exists (adjust path for your framework)
find . -name "*webhook*" -o -name "*workos*" | head -5

# 3. Signature validation present
grep -r "constructEvent\|HMAC\|WorkOS-Signature" . --include="*.ts" --include="*.js" || echo "FAIL: No signature validation"

# 4. Test webhook endpoint (replace URL)
curl -X POST https://your-domain.com/api/workos-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 400 (invalid signature) or 200 (if test logic exists)

# 5. SDK can authenticate
# Run this in your app's REPL or test file
# WorkOS SDK init should not throw
```

**For webhooks:** Test delivery using Dashboard webhook testing tool.

**For Events API:** Verify first API call returns expected event structure.

## Error Recovery

### "Invalid signature" on webhook delivery

**Root cause:** Signature validation mismatch.

**Fixes:**

1. Check `WORKOS_WEBHOOK_SECRET` matches Dashboard value
2. Ensure raw request body is used (not parsed JSON)
3. Verify `WorkOS-Signature` header is present
4. Check clock skew — server time must be within tolerance window

**Test:** Send test webhook from Dashboard, check logs for exact error.

### Events API returns 401 Unauthorized

**Root cause:** Invalid or missing API key.

**Fixes:**

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key permissions in Dashboard (must have Events scope)
3. Ensure key is for correct environment (test vs production)

### Webhook retries exhausted (6 attempts)

**Root cause:** Endpoint not responding with 200 OK within timeout.

**Fixes:**

1. Check endpoint logs for exceptions
2. Move slow processing to background job — respond 200 immediately
3. Verify endpoint is publicly accessible (test with curl from external network)
4. Check firewall/load balancer timeout settings

**Pattern for fast response:**

```typescript
// Respond immediately, process async
await queueJob('process-webhook', payload);
return new Response('OK', { status: 200 });
```

### No events appearing

**Root cause:** No active SSO or Directory Sync connections.

**Fix:** Configure at least one connection in Dashboard. Events only generate from live integrations.

**Source:** https://workos.com/docs/events/index

### Duplicate event processing

**Root cause:** Retries or API pagination overlap without idempotency.

**Fix:** Check event ID before processing:

```typescript
if (await isEventProcessed(event.id)) return;
await processEvent(event);
await markEventProcessed(event.id);
```

### Datadog events not appearing

**Root cause:** Integration not enabled or wrong API key.

**Fixes:**

1. Verify Datadog integration enabled in Dashboard
2. Check Datadog API key has Logs Write permission
3. Wait 5-10 minutes for first events (initial sync delay)
4. Search Datadog with `source:workos` to confirm events are flowing

## Related Skills

- **workos-sso**: SSO configuration (generates authentication events)
- **workos-directory-sync**: Directory Sync setup (generates dsync events)
- **workos-audit-logs**: Audit trail integration (separate from Events API)
