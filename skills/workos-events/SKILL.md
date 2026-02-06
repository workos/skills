---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- generated -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- https://workos.com/docs/events/index
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation
- https://workos.com/docs/events/observability/datadog

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Setup

Check WorkOS Dashboard (https://dashboard.workos.com):

- Confirm at least one SSO or Directory Sync connection exists
- Events will NOT generate without an active connection

### Environment Variables

Verify `.env` or `.env.local` contains:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (optional, needed for some integrations)

### SDK Installation

Detect package manager, verify WorkOS SDK is installed:

```bash
# Check SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || \
ls node_modules/workos 2>/dev/null || \
echo "FAIL: WorkOS SDK not installed"
```

## Step 3: Choose Data Sync Method (Decision Tree)

```
What is your use case?
  |
  +-- Real-time event processing (user sign-ins, directory changes)
  |   --> Use Webhooks (Steps 4-7)
  |
  +-- Batch processing / backfill / audit logs
  |   --> Use Events API (Step 8)
  |
  +-- Analytics / monitoring only (no custom code)
      --> Use Datadog streaming (Step 9)
```

**Critical:** Webhooks are push (WorkOS calls you). Events API is pull (you query WorkOS).

## Step 4: Create Webhook Endpoint (if using webhooks)

### Route Location

Determine endpoint path based on framework:

```
Framework      --> Route location
Next.js        --> app/api/webhooks/workos/route.ts
Express        --> routes/webhooks/workos.js
Fastify        --> routes/webhooks/workos.ts
```

### Endpoint Requirements

**MUST respond with HTTP 200 within timeout** (typically 5-10 seconds):

```typescript
// Next.js example
export async function POST(request: Request) {
  // 1. Get raw body for signature verification
  const payload = await request.text();
  
  // 2. Verify signature BEFORE processing (see Step 5)
  const signature = request.headers.get('workos-signature');
  // ... verification code ...
  
  // 3. Parse and queue event for async processing
  const event = JSON.parse(payload);
  await eventQueue.add(event); // Don't block response
  
  // 4. Respond immediately
  return new Response(null, { status: 200 });
}
```

**DO NOT:**
- Perform long-running operations before responding
- Return non-200 status for processing errors
- Parse body before signature verification

**Retry behavior:** WorkOS retries failed deliveries (non-200) up to 6 times over 3 days with exponential backoff.

## Step 5: Implement Signature Verification

### Method A: Using SDK (Recommended)

WebFetch the SDK docs for the exact method name — it varies by SDK version.

Pattern (verify exact syntax from docs):

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET; // From Dashboard

// In webhook handler:
const payload = await request.text(); // RAW body, not parsed JSON
const signature = request.headers.get('workos-signature');

try {
  const event = workos.webhooks.verifyEvent({
    payload,
    sigHeader: signature,
    secret: webhookSecret,
    tolerance: 180 // seconds (optional, default varies by SDK)
  });
  // event is verified and parsed
} catch (error) {
  return new Response('Invalid signature', { status: 401 });
}
```

### Method B: Manual Verification

If SDK method unavailable, implement manually:

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, sigHeader: string, secret: string, toleranceSec = 180): boolean {
  // 1. Parse signature header: "t=<timestamp>,v1=<hash>"
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.substring(2);
  const hash = parts.find(p => p.startsWith('v1='))?.substring(3);
  
  if (!timestamp || !hash) return false;
  
  // 2. Validate timestamp (prevent replay attacks)
  const now = Date.now();
  const issued = parseInt(timestamp, 10);
  if (Math.abs(now - issued) > toleranceSec * 1000) return false;
  
  // 3. Compute expected signature
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  // 4. Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}
```

**Critical:** Always use raw request body, not parsed JSON, for signature verification.

## Step 6: Register Webhook in WorkOS Dashboard

1. Navigate to https://dashboard.workos.com → Settings → Webhooks
2. Click "Add Endpoint"
3. Enter endpoint URL (must be publicly accessible HTTPS)
4. Select event types to receive (or "All events")
5. **Copy the webhook secret** — store as `WORKOS_WEBHOOK_SECRET`

### Local Development

For local testing, use a tunnel service:

```bash
# Using ngrok
ngrok http 3000
# Copy HTTPS URL (e.g., https://abc123.ngrok.io)
# Register webhook as https://abc123.ngrok.io/api/webhooks/workos
```

## Step 7: Process Events

### Event Structure

All events share this structure (see docs for full schema):

```typescript
interface WorkOSEvent {
  id: string;          // Unique event ID
  event: string;       // Event type (e.g., "dsync.user.created")
  data: object;        // Event-specific payload
  created_at: string;  // ISO 8601 timestamp
}
```

### Common Event Types

Check docs for complete list. Key patterns:

- `dsync.*` - Directory Sync events (user/group CRUD)
- `sso.*` - SSO events (authentication attempts)
- `user.*` - User lifecycle events
- `connection.*` - Connection status changes

### Processing Pattern

```typescript
async function processEvent(event: WorkOSEvent) {
  switch (event.event) {
    case 'dsync.user.created':
      await createUser(event.data);
      break;
    case 'dsync.user.deleted':
      await deleteUser(event.data);
      break;
    // ... other cases
  }
}

// In webhook handler (after verification):
await eventQueue.add(event); // Process async
return new Response(null, { status: 200 });
```

**Best practice:** Use a job queue (BullMQ, Inngest, etc.) to process events asynchronously.

## Step 8: Use Events API (Alternative to Webhooks)

### When to Use

- Batch processing historical events
- Backfilling data
- Polling-based architecture
- Webhook delivery issues

### API Pattern

WebFetch the SDK docs for exact method signature.

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Paginate through events
let after: string | undefined;
while (true) {
  const response = await workos.events.list({
    events: ['dsync.user.created', 'dsync.user.updated'],
    limit: 100,
    after, // Cursor for pagination
  });
  
  for (const event of response.data) {
    await processEvent(event);
  }
  
  if (!response.listMetadata?.after) break;
  after = response.listMetadata.after;
}
```

### Rate Limiting

- Events API has rate limits (check docs)
- Implement exponential backoff on 429 responses
- Webhooks do NOT count against API rate limits

## Step 9: Datadog Integration (Observability Only)

### Setup

1. Navigate to https://dashboard.workos.com → Settings → Integrations
2. Click "Datadog"
3. Enter Datadog API key
4. Select event types to stream

### Use Cases

- Monitor authentication trends
- Alert on failed login spikes
- Generate per-customer reports
- Debug customer issues

**Note:** Datadog streaming is for observability only. Use webhooks/Events API for application data sync.

## Step 10: IP Allowlist (Optional but Recommended)

Restrict webhook endpoint to WorkOS IP addresses:

```
3.217.146.166
(Check docs for current complete list)
```

Implementation depends on hosting platform:

- **Vercel/Netlify:** Configure IP allowlist in dashboard
- **Cloudflare:** Use WAF rules
- **AWS/GCP:** Security group rules
- **Express middleware:** Check `req.ip`

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup:

```bash
# 1. Verify webhook endpoint exists
ls app/api/webhooks/workos/route.ts 2>/dev/null || \
ls routes/webhooks/workos.* 2>/dev/null

# 2. Verify environment variables
grep -E "WORKOS_(API_KEY|WEBHOOK_SECRET)" .env* || echo "FAIL: Missing env vars"

# 3. Verify WorkOS SDK installed
npm list @workos-inc/node || npm list workos

# 4. Test webhook signature verification compiles
npm run build || npm run type-check

# 5. Test webhook endpoint (replace URL)
curl -X POST https://your-app.com/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nStatus: %{http_code}\n"
# Should return 401 (invalid signature) not 500
```

## Step 11: Test Webhook Delivery

### Using WorkOS Dashboard

1. Navigate to Webhooks → Your endpoint
2. Click "Send test event"
3. Select event type
4. Verify delivery in dashboard logs

### Using CLI (if available)

Check docs for CLI commands to trigger test events.

### Monitor Delivery

Dashboard shows:
- Delivery attempts
- Response codes
- Retry schedule for failures

**If seeing 100% failures:**
- Check endpoint is publicly accessible
- Verify signature validation logic
- Check logs for errors before 200 response

## Error Recovery

### "Invalid signature" errors (401 responses)

**Root causes:**

1. **Using parsed JSON instead of raw body**
   - Fix: Get raw request body before `JSON.parse()`
   - Next.js: `await request.text()` not `await request.json()`

2. **Wrong webhook secret**
   - Fix: Copy secret from Dashboard, not API key
   - Secret starts with `wh_` or similar (check format in Dashboard)

3. **Tolerance too strict**
   - Fix: Increase tolerance to 300 seconds for local dev
   - Production: 180 seconds is reasonable

4. **Clock skew**
   - Fix: Sync server clock with NTP
   - Check: `date -u` matches UTC within 1 minute

### "Timeout" or no response

**Root causes:**

1. **Long-running processing blocking response**
   - Fix: Queue events, respond immediately
   - Use job queue (BullMQ, Inngest, etc.)

2. **Async handler not awaited**
   - Fix: Ensure all async operations awaited before response
   - Or: Don't await them, just queue

3. **Database connection pool exhausted**
   - Fix: Process events in background worker
   - Don't open DB connections before 200 response

### Webhook retries exhausted

**After 6 failed attempts over 3 days:**

1. Fix root cause (see above)
2. Use Events API to backfill missed events:

```typescript
// Get events since last successful delivery
const response = await workos.events.list({
  after: lastProcessedEventId,
  limit: 100,
});
```

### "Event not found" in Events API

**Root causes:**

1. **Events older than retention period**
   - Default retention: 30 days (check docs)
   - Cannot retrieve older events

2. **Wrong event ID format**
   - Event IDs start with `event_` prefix
   - Check ID in webhook payload or Dashboard

### Events not generating

**Pre-flight checklist:**

1. Verify SSO or Directory Sync connection is active
2. Trigger actual activity (user login, directory sync)
3. Check Dashboard → Events for any events
4. If no events in Dashboard, issue is upstream (WorkOS connection config)

### Rate limiting on Events API

**Response:** HTTP 429 with `Retry-After` header

**Fix:**

```typescript
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = error.headers?.['retry-after'] 
          ? parseInt(error.headers['retry-after']) * 1000
          : Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

**Prevention:** Use webhooks for real-time events, API for backfills only.

## Related Skills

- **workos-sso**: SSO integration (generates `sso.*` events)
- **workos-directory-sync**: Directory Sync integration (generates `dsync.*` events)
- **workos-audit-logs**: Audit log integration for compliance
