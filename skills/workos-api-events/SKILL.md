---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- generated -->

# WorkOS Events API Integration

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- `https://workos.com/docs/reference/events`
- `https://workos.com/docs/reference/events/list`

The WorkOS docs are the source of truth. If this skill conflicts with official docs, follow the docs.

## Step 2: Pre-Flight Validation

### Project Structure

Run these checks:

```bash
# Confirm WorkOS SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# Confirm environment variables exist
grep -q "WORKOS_API_KEY" .env* || echo "FAIL: WORKOS_API_KEY not found"
```

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_` (required for API calls)
- `WORKOS_WEBHOOK_SECRET` - starts with `wh_` (required if consuming webhooks)

**Note:** Events API does NOT require `WORKOS_CLIENT_ID` - that's only for OAuth/SSO flows.

## Step 3: SDK Installation (If Missing)

Detect package manager, install WorkOS Node SDK:

```bash
# Detect and install
npm install @workos-inc/node
# or
pnpm add @workos-inc/node
# or
yarn add @workos-inc/node
```

**Verify:** SDK package directory exists before writing code:

```bash
ls node_modules/@workos-inc/node/dist/index.js || echo "Installation failed"
```

## Step 4: Initialize WorkOS Client

Create or verify WorkOS client initialization:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Location decision tree:**

```
Project type?
  |
  +-- Next.js API route --> Initialize inside route handler
  |
  +-- Express/Node app --> Initialize in config/workos.ts, export singleton
  |
  +-- Serverless function --> Initialize per-invocation (cold starts)
```

**Critical:** Never commit API key to git. Always use environment variables.

## Step 5: Implement Events List Endpoint

Events API supports pagination and filtering. See fetched docs for query parameters.

### Basic Pattern (Framework-Agnostic)

```typescript
// List recent events
const events = await workos.events.listEvents({
  limit: 10,
  order: 'desc',
  // Optional filters - see docs for available options
  events: ['connection.activated', 'connection.deleted'],
  organization_id: 'org_123',
});

// Response structure
events.data.forEach((event) => {
  console.log(event.id);       // evt_xxx
  console.log(event.event);    // event type string
  console.log(event.data);     // event payload
  console.log(event.created_at); // ISO timestamp
});

// Pagination cursor
if (events.listMetadata?.after) {
  const nextPage = await workos.events.listEvents({
    after: events.listMetadata.after,
    limit: 10,
  });
}
```

### Framework Integration (Decision Tree)

```
Framework?
  |
  +-- Next.js App Router --> app/api/events/route.ts
  |                          export async function GET(request: Request)
  |
  +-- Next.js Pages --> pages/api/events.ts
  |                     export default async function handler(req, res)
  |
  +-- Express --> app.get('/api/events', async (req, res) => {})
  |
  +-- Fastify --> fastify.get('/api/events', async (request, reply) => {})
```

**Implementation steps:**

1. Parse query parameters (after, limit, events filter, etc.)
2. Call `workos.events.listEvents()` with validated params
3. Return paginated response with `listMetadata` for cursor
4. Handle errors with appropriate HTTP status codes

## Step 6: Event Type Filtering (Optional)

Events API supports filtering by event types. Common patterns:

```typescript
// SSO events only
const ssoEvents = await workos.events.listEvents({
  events: ['connection.activated', 'connection.deleted', 'connection.deactivated'],
});

// Directory Sync events only
const dsyncEvents = await workos.events.listEvents({
  events: ['dsync.activated', 'dsync.deleted', 'group.created', 'user.created'],
});

// Organization events only
const orgEvents = await workos.events.listEvents({
  events: ['organization.created', 'organization.updated', 'organization.deleted'],
});
```

**Check fetched docs for complete event type list** - types vary by WorkOS product.

## Step 7: Pagination Implementation

Events API uses cursor-based pagination. **Never use offset/page numbers.**

```typescript
async function getAllEvents(filters = {}) {
  const allEvents = [];
  let after = undefined;

  while (true) {
    const response = await workos.events.listEvents({
      ...filters,
      after,
      limit: 100, // Max per page
    });

    allEvents.push(...response.data);

    // Check if more pages exist
    if (!response.listMetadata?.after) {
      break;
    }

    after = response.listMetadata.after;
  }

  return allEvents;
}
```

**Warning:** Fetching all events can be slow for large datasets. Use pagination cursors in UI instead.

## Step 8: Webhook Integration (If Applicable)

If consuming events via webhooks instead of polling:

```
Delivery method?
  |
  +-- Polling API --> Use listEvents() on schedule (Step 5)
  |
  +-- Webhooks --> Implement webhook handler (see workos-webhooks skill)
```

**Decision factors:**

- Real-time needed? --> Webhooks
- Batch processing? --> Polling
- Event replay needed? --> Polling (events stored 90 days)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Verify WorkOS client initialization
grep -r "new WorkOS" --include="*.ts" --include="*.js" . || echo "FAIL: WorkOS not initialized"

# 2. Verify API key is in environment
grep "WORKOS_API_KEY" .env* || echo "FAIL: API key not configured"

# 3. Test API call (replace with your endpoint)
curl -X GET "http://localhost:3000/api/events?limit=5" \
  -H "Accept: application/json" \
  | grep -q '"data"' && echo "PASS: API returns events" || echo "FAIL: API error"

# 4. Check for hardcoded API keys (security)
grep -r "sk_[a-zA-Z0-9]" --include="*.ts" --include="*.js" . \
  && echo "FAIL: Hardcoded API key found" || echo "PASS: No hardcoded keys"

# 5. Build succeeds
npm run build
```

## Error Recovery

### "Unauthorized" (401)

**Root cause:** Invalid or missing API key.

Fixes:
1. Verify `WORKOS_API_KEY` exists in environment: `echo $WORKOS_API_KEY`
2. Check key starts with `sk_`: `echo $WORKOS_API_KEY | grep "^sk_"`
3. Regenerate key in WorkOS Dashboard if compromised
4. Restart dev server after changing .env files

### "Rate limit exceeded" (429)

**Root cause:** Too many API calls in short window.

Fixes:
1. Implement exponential backoff for retries
2. Cache events locally if read-heavy
3. Use webhooks instead of polling for real-time needs
4. Contact WorkOS support for rate limit increase

### "Invalid cursor" error in pagination

**Root cause:** Cursor expired or invalid after value.

Fixes:
1. Check `listMetadata.after` exists before using: `if (events.listMetadata?.after)`
2. Cursors expire after 90 days - don't store long-term
3. Reset to first page if cursor invalid: `after: undefined`

### Empty response but events exist in Dashboard

**Root cause:** Event type filter too restrictive.

Fixes:
1. Remove `events` filter to see all event types
2. Check fetched docs for correct event type strings (case-sensitive)
3. Verify `organization_id` filter if used (must match exactly)

### TypeScript errors on event.data access

**Root cause:** Event payload shape varies by event type.

Fixes:
1. Use type guards: `if (event.event === 'connection.activated') { ... }`
2. Check fetched docs for event-specific payload schemas
3. Use optional chaining: `event.data?.connection?.id`

### SDK import fails

**Root cause:** Package not installed or wrong import path.

Fixes:
```bash
# Reinstall SDK
rm -rf node_modules/@workos-inc package-lock.json
npm install @workos-inc/node

# Verify import path
grep "from '@workos-inc/node'" --include="*.ts" -r .
```

## Related Skills

- `workos-webhooks` - Consume events via webhooks instead of polling
- `workos-directory-sync` - Process Directory Sync events (dsync.*, group.*, user.*)
- `workos-sso` - Process SSO connection events (connection.*)
