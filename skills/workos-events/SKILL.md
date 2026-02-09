---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- generated -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for implementation details:
- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check environment variables:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing.

### Prerequisites Check

Run these commands to confirm setup:

```bash
# 1. Check WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check SSO/Directory connection exists (required for events)
# You need at least one connection configured in WorkOS Dashboard
echo "Manual check: Visit https://dashboard.workos.com/connections"
```

**Critical:** Events require an active SSO or Directory Sync connection. Without one, no events will generate.

## Step 3: Choose Integration Pattern (Decision Tree)

```
Event consumption strategy?
  |
  +-- Observability/Analytics --> Go to Step 4 (Datadog)
  |
  +-- Data syncing for app logic --> Choose method:
      |
      +-- Push-based (real-time) --> Go to Step 5 (Webhooks)
      |
      +-- Pull-based (polling) --> Go to Step 6 (Events API)
```

**Most common:** Webhooks for real-time user provisioning/deprovisioning.

## Step 4: Datadog Integration (Optional)

**Use case:** Stream events to Datadog for dashboards, alerts, anomaly detection.

### Setup Steps

1. Navigate to WorkOS Dashboard → Integrations → Datadog
2. Enter Datadog API key
3. Select event types to stream (auth, directory, SSO, user management)
4. Save configuration

### Verification

```bash
# Check Datadog for WorkOS events (requires Datadog CLI)
datadog-cli logs query "source:workos" --from "1h"

# Manual check: Visit Datadog Logs Explorer
echo "Manual check: https://app.datadoghq.com/logs"
```

**If no events appear within 10 minutes:**
- Verify API key has logs write permission
- Check at least one event has occurred (e.g., test SSO login)
- Review WorkOS Dashboard → Integrations → Datadog for error messages

## Step 5: Webhook Integration (Push-Based)

### 5.1: Create Webhook Endpoint

Determine framework and create route:

```
Framework         --> Route location
Next.js           --> app/api/workos-webhooks/route.ts
Express           --> routes/workos-webhooks.js
Fastify           --> routes/workos-webhooks.js
```

**Critical requirements:**
1. Must return `HTTP 200 OK` for successful receipt (not processing success)
2. Must validate signature before processing
3. Should process asynchronously (webhook timeout is 30 seconds)

### 5.2: Implement Signature Validation

**Pattern A: Using SDK (Recommended)**

```typescript
// Next.js example
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('workos-signature');
  
  try {
    // SDK validates timestamp + signature
    const webhook = workos.webhooks.constructEvent({
      payload: body,
      sigHeader: signature,
      secret: webhookSecret,
      tolerance: 180 // 3 minutes (optional)
    });
    
    // Process webhook.data here
    await processEvent(webhook);
    
    return new Response(null, { status: 200 });
  } catch (err) {
    console.error('Webhook validation failed:', err);
    return new Response('Unauthorized', { status: 401 });
  }
}
```

**Pattern B: Manual Validation**

Only if SDK unavailable:

```typescript
import crypto from 'crypto';

function validateWebhook(payload: string, sigHeader: string, secret: string): boolean {
  // Parse header: "t=1234567890,v1=abc123..."
  const [timestampPart, signaturePart] = sigHeader.split(',');
  const timestamp = timestampPart.split('=')[1];
  const providedSignature = signaturePart.split('=')[1];
  
  // Check timestamp within tolerance (3 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 180) {
    return false; // Replay attack protection
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  );
}
```

### 5.3: Handle Event Types

Common event types to handle:

```typescript
switch (webhook.event) {
  case 'dsync.user.created':
    await provisionUser(webhook.data);
    break;
  case 'dsync.user.updated':
    await updateUser(webhook.data);
    break;
  case 'dsync.user.deleted':
    await deprovisionUser(webhook.data);
    break;
  case 'dsync.group.created':
    await createGroup(webhook.data);
    break;
  case 'dsync.group.updated':
    await updateGroup(webhook.data);
    break;
  case 'dsync.group.deleted':
    await deleteGroup(webhook.data);
    break;
  case 'authentication.email_verification_succeeded':
  case 'authentication.password_reset':
    // Handle auth events
    break;
  default:
    console.log(`Unhandled event type: ${webhook.event}`);
}
```

**Critical:** Check docs for complete event schema. Webhook data structure varies by event type.

### 5.4: Register Endpoint with WorkOS

1. Deploy endpoint to accessible URL (must be HTTPS in production)
2. Navigate to WorkOS Dashboard → Webhooks
3. Click "Add Endpoint"
4. Enter endpoint URL (e.g., `https://yourdomain.com/api/workos-webhooks`)
5. Select event types to receive
6. Copy webhook secret to environment variable: `WORKOS_WEBHOOK_SECRET`

### 5.5: Configure IP Allowlist (Recommended)

Restrict webhook endpoint to WorkOS IPs:

```nginx
# Nginx example
location /api/workos-webhooks {
    allow 3.217.146.166;
    allow 3.219.198.135;
    allow 18.213.135.86;
    allow 34.194.85.39;
    allow 44.211.115.202;
    allow 44.213.73.141;
    allow 52.20.231.210;
    allow 54.208.31.155;
    deny all;
}
```

Check docs for current IP list (may change).

### 5.6: Test Webhook Endpoint

WorkOS Dashboard provides test event sender:

```bash
# 1. Navigate to Dashboard → Webhooks → [Your Endpoint] → Test
# 2. Send test event
# 3. Check your endpoint logs for received event

# Alternative: Use curl to simulate
curl -X POST https://yourdomain.com/api/workos-webhooks \
  -H "Content-Type: application/json" \
  -H "WorkOS-Signature: t=1234567890,v1=testsignature" \
  -d '{"event":"test.event","data":{}}'

# Expected: 200 OK response
```

## Step 6: Events API Integration (Pull-Based)

**Use case:** Batch processing, data reconciliation, backfilling.

### 6.1: Implement Polling Logic

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function pollEvents() {
  let after: string | undefined;
  
  while (true) {
    const { data, listMetadata } = await workos.events.listEvents({
      events: ['dsync.user.created', 'dsync.user.updated', 'dsync.user.deleted'],
      after, // Cursor for pagination
      limit: 100 // Max per request
    });
    
    for (const event of data) {
      await processEvent(event);
    }
    
    if (!listMetadata.after) break; // No more pages
    after = listMetadata.after;
  }
}

// Run every 5 minutes (adjust based on volume)
setInterval(pollEvents, 5 * 60 * 1000);
```

### 6.2: Track Last Processed Event

Store cursor to avoid reprocessing:

```typescript
// Using database
async function pollEventsSince(lastEventId: string) {
  const { data } = await workos.events.listEvents({
    after: lastEventId,
    limit: 100
  });
  
  for (const event of data) {
    await processEvent(event);
    // Update last processed cursor
    await db.updateConfig('last_event_id', event.id);
  }
}
```

### 6.3: Handle Rate Limits

Events API rate limit: 100 requests/minute.

```typescript
// Add backoff on rate limit
async function pollEventsWithRetry() {
  try {
    await pollEvents();
  } catch (err) {
    if (err.status === 429) {
      const retryAfter = err.headers['retry-after'] || 60;
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return pollEventsWithRetry();
    }
    throw err;
  }
}
```

## Step 7: Data Reconciliation (Critical for Directory Sync)

**Why needed:** Webhook delivery is eventually consistent. Use reconciliation to ensure data integrity.

### Reconciliation Strategy

```typescript
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Starting daily reconciliation');
  
  // 1. Fetch all directory users from WorkOS
  const workosUsers = await fetchAllDirectoryUsers();
  
  // 2. Fetch all users from your database
  const dbUsers = await db.users.findAll({ source: 'directory_sync' });
  
  // 3. Find discrepancies
  const toCreate = workosUsers.filter(wu => !dbUsers.find(du => du.workos_id === wu.id));
  const toUpdate = workosUsers.filter(wu => {
    const dbUser = dbUsers.find(du => du.workos_id === wu.id);
    return dbUser && needsUpdate(dbUser, wu);
  });
  const toDelete = dbUsers.filter(du => !workosUsers.find(wu => wu.id === du.workos_id));
  
  // 4. Apply changes
  await Promise.all([
    ...toCreate.map(u => provisionUser(u)),
    ...toUpdate.map(u => updateUser(u)),
    ...toDelete.map(u => deprovisionUser(u))
  ]);
  
  console.log(`Reconciliation complete: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted`);
});

async function fetchAllDirectoryUsers() {
  const users = [];
  let after: string | undefined;
  
  while (true) {
    const { data, listMetadata } = await workos.directorySync.listUsers({
      directory: 'directory_id', // Get from connection
      after,
      limit: 100
    });
    users.push(...data);
    if (!listMetadata.after) break;
    after = listMetadata.after;
  }
  
  return users;
}
```

**Frequency recommendations:**
- High-stakes apps (payroll, security): Every 6 hours
- Standard apps: Daily
- Low-priority: Weekly

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables
env | grep WORKOS_API_KEY || echo "FAIL: API key missing"
env | grep WORKOS_WEBHOOK_SECRET || echo "FAIL: Webhook secret missing (if using webhooks)"

# 2. Check webhook endpoint exists (adjust path)
ls app/api/workos-webhooks/route.ts routes/workos-webhooks.js 2>/dev/null || echo "WARN: Webhook endpoint not found"

# 3. Test API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/events?limit=1 | grep -q '"data"' && echo "PASS: API accessible" || echo "FAIL: API error"

# 4. Check webhook signature validation implemented
grep -r "workos.webhooks.constructEvent\|validateWebhook" . || echo "FAIL: No signature validation found"

# 5. Verify IP allowlist configured (if using webhooks)
echo "Manual check: Confirm firewall/reverse proxy restricts to WorkOS IPs"

# 6. Test webhook delivery (if using webhooks)
echo "Manual check: Send test event from WorkOS Dashboard, verify 200 OK in logs"
```

## Error Recovery

### "Webhook signature validation failed"

**Root cause:** Mismatch between payload/secret/timestamp.

**Fixes:**
1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard → Webhooks → [Endpoint] → Secret
2. Check using raw request body (not parsed JSON) for signature validation
3. Verify timestamp tolerance set appropriately (default 180 seconds)
4. Check for request body size limits in framework/reverse proxy

**Debug command:**
```bash
# Log raw webhook payload and header
echo "Payload: $(cat request.body)"
echo "Signature: $(cat request.headers['workos-signature'])"
```

### "Webhook endpoint returns 401/403"

**Root cause:** IP not allowlisted or authentication misconfigured.

**Fixes:**
1. Check reverse proxy/firewall allows WorkOS IPs (see Step 5.5)
2. Ensure endpoint does not require additional auth headers
3. Verify endpoint URL in Dashboard matches deployed URL exactly (no trailing slash differences)

### "Events API returns 401 Unauthorized"

**Root cause:** Invalid or expired API key.

**Fixes:**
1. Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_`)
2. Check key exists in Dashboard → API Keys
3. Regenerate key if compromised

### "Events API returns 429 Too Many Requests"

**Root cause:** Exceeded rate limit (100 req/min).

**Fixes:**
1. Implement exponential backoff (see Step 6.3)
2. Increase polling interval (reduce frequency)
3. Use webhooks instead for real-time needs

### "Webhook retries exhausted" (6 failures)

**Root cause:** Endpoint repeatedly failed to return 200 OK.

**Fixes:**
1. Check endpoint logs for errors during webhook processing
2. Return 200 OK immediately, process asynchronously (don't wait for DB)
3. Increase endpoint timeout (default 30 seconds)
4. Use Events API to backfill missed events

**Recovery command:**
```bash
# Fetch events since last successful webhook
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?after=evt_last_successful_id&limit=100"
```

### "User data out of sync after webhook"

**Root cause:** Missed webhook or race condition.

**Fixes:**
1. Implement reconciliation job (see Step 7)
2. Use idempotency keys when creating resources
3. Check for race conditions in concurrent webhook processing
4. Verify database transaction isolation level

### "Cannot find event schema"

**Root cause:** Event type not documented or custom event.

**Fixes:**
1. Check fetched docs for event schema reference
2. Log full event payload for inspection
3. Contact WorkOS support for custom event types

**Debug command:**
```bash
# Fetch recent event and inspect schema
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?limit=1" | jq '.'
```

## Related Skills

- **workos-directory-sync**: User/group provisioning via Directory Sync
- **workos-audit-logs**: Audit log integration for compliance
- **workos-authkit-nextjs**: Authentication with AuthKit (generates auth events)
