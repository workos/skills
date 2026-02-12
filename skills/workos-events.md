---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs to get implementation details:

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these in `.env` or environment:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (for some event sources)

### Event Source Prerequisites

Events require an active source connection in WorkOS Dashboard. Verify one exists:

**Check Dashboard:**

1. Log into https://dashboard.workos.com/
2. Navigate to SSO or Directory Sync section
3. Confirm at least one connection is configured and active

**Why:** Events only fire when there's underlying activity (SSO logins, directory syncs, etc.). No connections = no events to consume.

## Step 3: Choose Data Sync Method (Decision Tree)

```
Event consumption pattern?
  |
  +-- Real-time processing --> Use Webhooks (Step 4)
  |
  +-- Batch/polling --> Use Events API (Step 5)
  |
  +-- Analytics/observability only --> Stream to Datadog (Step 6)
```

**Key differences:**

- **Webhooks**: Push-based, real-time, requires public endpoint
- **Events API**: Pull-based, polling, works behind firewall
- **Datadog**: No code required, observability-only (cannot programmatically react)

**Common pattern:** Use webhooks for real-time actions + Datadog for monitoring.

## Step 4: Implement Webhooks (If Chosen)

### 4.1: Create Webhook Endpoint

Create an HTTP endpoint that accepts POST requests. Framework-agnostic pattern:

```
POST /webhooks/workos
  |
  +-- Extract raw body as string (CRITICAL - needed for signature validation)
  +-- Extract WorkOS-Signature header
  +-- Validate signature (Step 4.2)
  +-- Parse JSON body
  +-- Process event (Step 4.3)
  +-- Return HTTP 200 OK
```

**CRITICAL:** Preserve raw request body BEFORE parsing JSON. Signature validation requires the exact bytes WorkOS sent.

**Example endpoint locations by framework:**

- Express: `app.post('/webhooks/workos', rawBodyMiddleware, handler)`
- Next.js: `app/api/webhooks/workos/route.ts` with `export async function POST(req)`
- Flask: `@app.route('/webhooks/workos', methods=['POST'])`

### 4.2: Register Endpoint in Dashboard

1. Navigate to https://dashboard.workos.com/webhooks
2. Click "Add Endpoint"
3. Enter your endpoint URL (must be publicly accessible HTTPS)
4. Select event types to receive (or select "All events")
5. Save and copy the webhook secret - store as `WORKOS_WEBHOOK_SECRET`

**Important:** Endpoint must be HTTPS in production. WorkOS allows HTTP for localhost testing.

### 4.3: Validate Webhook Signatures

**Using SDK (Recommended):**

Check fetched docs for exact method name. Common pattern across SDKs:

```typescript
// Pattern - exact method name in SDK docs
const payload = await request.text(); // Raw body
const signature = request.headers.get("WorkOS-Signature");
const secret = process.env.WORKOS_WEBHOOK_SECRET;

// SDK provides validation method - check docs for exact name
const event = workos.webhooks.constructEvent({
  payload,
  signature,
  secret,
  tolerance: 180, // seconds - optional, default ~3-5 min
});
```

**Manual validation (if SDK unavailable):**

Parse `WorkOS-Signature` header:

```
WorkOS-Signature: t=1234567890123,v1=abc123def456...
                  ^               ^
                  timestamp       HMAC-SHA256 hash
```

Steps:

1. Extract `t=` (issued_timestamp in milliseconds)
2. Extract `v1=` (signature_hash)
3. Verify timestamp within tolerance (e.g., 3 minutes)
4. Compute expected signature: `HMAC-SHA256(secret, t=<timestamp>.<raw_body>)`
5. Compare computed hash to `v1=` hash (constant-time comparison)

**CRITICAL:** Use raw body bytes, not parsed JSON. Parsing changes byte representation.

### 4.4: Process Events

Event structure (common fields):

```json
{
  "id": "event_01J...",
  "event": "dsync.user.created",
  "data": {
    /* event-specific payload */
  },
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

Event types to handle (check fetched docs for complete list):

- `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`
- `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`
- `connection.activated`, `connection.deactivated`
- `authentication.email_verification_succeeded`
- `authentication.magic_auth_succeeded`
- `authentication.mfa_succeeded`
- `authentication.oauth_succeeded`
- `authentication.password_succeeded`
- `authentication.sso_succeeded`

**Pattern:**

```typescript
switch (event.event) {
  case "dsync.user.created":
    await createUserInDB(event.data);
    break;
  case "dsync.user.deleted":
    await deleteUserFromDB(event.data);
    break;
  // ...
}
```

### 4.5: Return HTTP 200 OK

**CRITICAL:** Always return 200 OK after receiving webhook, regardless of processing outcome.

**Retry behavior:**

- Non-200 response triggers retry
- WorkOS retries up to 6 times over 3 days with exponential backoff
- If processing fails, log error but still return 200 to prevent retries

**Pattern:**

```typescript
try {
  await processEvent(event);
} catch (error) {
  console.error("Event processing failed:", error);
  // Log to monitoring system
}
return new Response(null, { status: 200 }); // Always 200
```

### 4.6: IP Allowlist (Optional Security)

Restrict webhook endpoint to WorkOS IPs:

```
3.217.146.166
44.209.32.85
44.223.178.146
52.45.105.126
52.203.215.65
54.91.182.102
```

Implementation depends on infrastructure:

- **Cloudflare:** WAF rule allowing only these IPs
- **AWS ALB:** Security group ingress rules
- **Nginx:** `allow` directives in location block

## Step 5: Implement Events API (If Chosen)

### 5.1: Polling Pattern

Events API is pull-based. You poll for new events since last check.

**CRITICAL:** Track `after` cursor between polls to avoid duplicate processing.

Check fetched docs for exact SDK method. Common pattern:

```typescript
// SDK pattern - exact method in docs
const events = await workos.events.listEvents({
  events: ["dsync.user.created", "dsync.user.updated"], // optional filter
  limit: 100, // max per request
  after: lastCursor, // from previous poll
});

for (const event of events.data) {
  await processEvent(event);
}

// Store for next poll
lastCursor = events.list_metadata?.after;
```

### 5.2: Cursor Management

**CRITICAL:** Persist `after` cursor to database/Redis between polls. Losing cursor = reprocessing all historical events.

**Storage pattern:**

```typescript
// On startup - load last cursor
const cursor = await db.get("workos_events_cursor");

// After each poll - save new cursor
if (events.list_metadata?.after) {
  await db.set("workos_events_cursor", events.list_metadata.after);
}
```

### 5.3: Polling Interval

Choose based on latency requirements:

- **Real-time needs:** 10-30 seconds
- **Batch sync:** 5-60 minutes
- **Rate limit consideration:** Max 600 requests/minute per API key

**Implementation:**

```typescript
// Simple interval
setInterval(async () => {
  await pollEvents();
}, 30000); // 30 seconds

// Or use cron job for less frequent polling
```

### 5.4: Handling Pagination

If more than 100 events available, use `after` cursor to fetch next page:

```typescript
let cursor = null;
do {
  const events = await workos.events.listEvents({
    limit: 100,
    after: cursor,
  });

  for (const event of events.data) {
    await processEvent(event);
  }

  cursor = events.list_metadata?.after;
} while (cursor);
```

## Step 6: Stream to Datadog (If Chosen)

### 6.1: Enable in Dashboard

1. Navigate to https://dashboard.workos.com/integrations/datadog
2. Click "Connect Datadog"
3. Enter Datadog API key
4. Select event types to stream
5. Choose Datadog site (US1, EU, etc.)

**No code required** - WorkOS streams events directly to Datadog.

### 6.2: View Events in Datadog

Events appear in Datadog with source `workos`:

**Navigate to:** Logs → Search `source:workos`

**Common queries:**

- Failed logins: `@event:authentication.password_failed`
- SSO activity: `@event:authentication.sso_succeeded`
- Directory sync: `@event:dsync.*`

### 6.3: Create Dashboards

Pre-built WorkOS dashboard available in Datadog integration catalog. Or create custom:

**Example metrics:**

- User sign-ins per hour
- Failed authentication attempts
- New SSO connections
- Directory sync errors

Check Datadog documentation for dashboard creation.

## Step 7: Data Reconciliation (CRITICAL)

**Problem:** Events may be lost due to network issues, endpoint downtime, or bugs.

**Solution:** Periodic reconciliation against authoritative WorkOS APIs.

### Reconciliation Pattern

```
Schedule?
  |
  +-- Daily --> Run reconciliation job at low-traffic time
  |
  +-- Hourly --> For critical sync accuracy
  |
  +-- On alert --> When monitoring detects missing events
```

### Reconciliation Steps

1. Fetch all entities from WorkOS (e.g., Directory Sync users)
2. Fetch all corresponding entities from your database
3. Compare and identify:
   - Missing in DB (should create)
   - Missing in WorkOS (should delete)
   - Attribute mismatches (should update)
4. Apply corrections

**Example for Directory Sync users:**

```typescript
async function reconcileUsers(directoryId: string) {
  // 1. Fetch from WorkOS
  const workosUsers = await workos.directorySync.listUsers({
    directory: directoryId,
  });

  // 2. Fetch from DB
  const dbUsers = await db.users.findAll({
    directoryId,
  });

  // 3. Compare
  const workosIds = new Set(workosUsers.data.map((u) => u.id));
  const dbIds = new Set(dbUsers.map((u) => u.workosId));

  // 4. Corrections
  for (const user of workosUsers.data) {
    if (!dbIds.has(user.id)) {
      await createUserInDB(user); // Missing in DB
    }
  }

  for (const user of dbUsers) {
    if (!workosIds.has(user.workosId)) {
      await deleteUserFromDB(user); // Deleted in WorkOS
    }
  }
}
```

**Frequency:** At minimum, run reconciliation weekly. For critical systems, run daily.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables set
env | grep WORKOS_API_KEY
env | grep WORKOS_WEBHOOK_SECRET  # if using webhooks

# 2. WorkOS Dashboard has active connections (manual check required)
# Navigate to https://dashboard.workos.com/ and verify SSO or Directory connection exists

# 3. If using webhooks - endpoint registered and receiving events
# Check Dashboard: https://dashboard.workos.com/webhooks
# Look for endpoint URL and successful delivery logs

# 4. If using Events API - cursor persistence working
# Check database/Redis for stored cursor value

# 5. If using Datadog - events flowing
# Check Datadog: source:workos should show recent events

# 6. Event processing working (trigger test event)
# Use WorkOS Dashboard test mode or trigger real activity
# Verify event appears in your logs/database
```

## Error Recovery

### "Webhook signature validation failed"

**Root cause:** Raw body not preserved or wrong secret.

**Fix:**

1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard value
2. Ensure raw body bytes passed to validation (not parsed JSON)
3. Check timestamp tolerance (event may be old)
4. Verify no proxy/CDN modifying request body

**Debug command:**

```bash
# Log raw body and signature header
echo "Body: $RAW_BODY"
echo "Signature: $WORKOS_SIGNATURE_HEADER"
```

### "Events API returns empty list"

**Root cause:** No events generated or wrong event types filtered.

**Fix:**

1. Verify active connection exists in Dashboard
2. Trigger test activity (SSO login, directory sync)
3. Check `events` filter parameter - remove to get all types
4. Verify `after` cursor not too far in future

**Debug command:**

```bash
# Test API call without filters
curl -X GET 'https://api.workos.com/events' \
  -H 'Authorization: Bearer sk_...' \
  -H 'Content-Type: application/json'
```

### "Duplicate events processed"

**Root cause:** Cursor not persisted or event IDs not deduplicated.

**Fix:**

1. Verify cursor saved after each poll
2. Add event ID tracking: store processed IDs, skip duplicates
3. Use database transaction to atomically process + save cursor

**Pattern:**

```typescript
const processedIds = new Set(await db.getProcessedEventIds());

for (const event of events.data) {
  if (!processedIds.has(event.id)) {
    await processEvent(event);
    await db.markEventProcessed(event.id);
  }
}
```

### "Webhook endpoint not receiving events"

**Root cause:** URL not publicly accessible or HTTPS issue.

**Fix:**

1. Verify endpoint URL is public and HTTPS (or localhost for testing)
2. Test endpoint manually: `curl -X POST https://your-domain.com/webhooks/workos`
3. Check Dashboard webhook logs for delivery errors
4. Verify firewall/security groups allow WorkOS IPs

**Test command:**

```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/webhooks/workos \
  -H 'WorkOS-Signature: t=1234567890,v1=test' \
  -d '{"test": true}'
# Should return 200 OK
```

### "Datadog not showing events"

**Root cause:** Integration not enabled or wrong API key.

**Fix:**

1. Verify Datadog integration enabled in WorkOS Dashboard
2. Check Datadog API key is valid and has log ingestion permission
3. Verify correct Datadog site selected (US1, EU, etc.)
4. Allow 5-10 minutes for first events to appear

### "Rate limit exceeded on Events API"

**Root cause:** Polling too frequently.

**Fix:**

1. Increase polling interval (max 600 requests/minute)
2. Use pagination correctly (don't re-fetch same events)
3. Consider switching to webhooks for real-time needs

### "Reconciliation finds many missing entities"

**Root cause:** Event processing errors or webhook delivery failures.

**Fix:**

1. Check application logs for event processing errors
2. Review webhook delivery logs in Dashboard for failures
3. Increase reconciliation frequency until stable
4. Fix underlying event processing bugs before reducing frequency

## Related Skills

- **workos-directory-sync.rules.yml**: Directory Sync implementation (primary event source)
- **workos-authkit-nextjs**: Authentication events from AuthKit
