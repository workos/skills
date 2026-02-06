---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- generated -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:

1. `https://workos.com/docs/directory-sync/quick-start`
2. `https://workos.com/docs/directory-sync/index`
3. `https://workos.com/docs/directory-sync/understanding-events`
4. `https://workos.com/docs/directory-sync/attributes`
5. `https://workos.com/docs/directory-sync/handle-inactive-users`

The quick-start is the source of truth for implementation. If this skill conflicts with quick-start, follow quick-start.

## Step 2: Pre-Flight Validation

### WorkOS Account

- Confirm WorkOS account exists at https://dashboard.workos.com/
- Confirm test directory connection exists in dashboard

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_` (secret key)
- `WORKOS_CLIENT_ID` - starts with `client_` (optional for some integrations)
- `WORKOS_WEBHOOK_SECRET` - starts with `wh_` (for webhook verification)

**Verify webhook secret exists:** Directory Sync relies on webhooks for real-time updates.

### Project Structure

Confirm framework detection:

```
Framework?
  |
  +-- Next.js --> Check for app/ or pages/ directory
  |
  +-- Express/Node --> Check for server.js or app.js
  |
  +-- Other --> Confirm HTTP server capability for webhook endpoint
```

## Step 3: Install SDK

Detect package manager, install WorkOS SDK from quick-start guide.

**Verify:** Run `npm ls @workos-inc/node` (or yarn/pnpm equivalent) shows installed version.

## Step 4: Create Webhook Endpoint (REQUIRED)

Directory Sync is **event-driven**. You MUST implement webhook handling. Do NOT poll the API.

### Endpoint Requirements

Create POST endpoint at `/webhooks/workos` (or path specified in dashboard).

**Framework-specific locations:**

```
Framework            --> File location
Next.js App Router   --> app/api/webhooks/workos/route.ts
Next.js Pages        --> pages/api/webhooks/workos.ts
Express              --> routes/webhooks.js or app.js
```

### Webhook Handler Pattern

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: Request) {
  // 1. Get raw body and signature
  const body = await request.text();
  const signature = request.headers.get('workos-signature');
  const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET;

  // 2. CRITICAL: Verify webhook signature
  let event;
  try {
    event = workos.webhooks.constructEvent({
      payload: body,
      sigHeader: signature!,
      secret: webhookSecret!,
    });
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // 3. Handle event (see Step 5)
  await handleDirectorySyncEvent(event);

  return new Response('OK', { status: 200 });
}
```

**CRITICAL:** Always verify webhook signature before processing. Unverified webhooks are a security vulnerability.

## Step 5: Implement Event Handlers (Decision Tree)

Directory Sync sends 8 event types. Route based on `event.event`:

```
event.event
  |
  +-- dsync.activated       --> Link directory_id to organization
  |
  +-- dsync.deleted         --> Unlink directory, soft-delete all users/groups
  |
  +-- dsync.user.created    --> INSERT user record
  |
  +-- dsync.user.updated    --> UPDATE user record (check state field)
  |
  +-- dsync.user.deleted    --> DELETE user record (rare - see Note)
  |
  +-- dsync.group.created   --> INSERT group record
  |
  +-- dsync.group.updated   --> UPDATE group record
  |
  +-- dsync.group.deleted   --> DELETE group record
```

### Critical Event Patterns

**dsync.activated (Setup)**

```typescript
// Save directory connection
await db.organizations.update({
  where: { id: event.data.organization_id },
  data: { directory_id: event.data.id },
});
```

**dsync.user.created (Provisioning)**

```typescript
// Create user in your system
await db.users.create({
  data: {
    id: event.data.id, // Directory user ID
    email: event.data.emails[0].value,
    first_name: event.data.first_name,
    last_name: event.data.last_name,
    directory_id: event.data.directory_id,
    state: event.data.state, // active/inactive
    raw_attributes: event.data.raw_attributes, // Custom attrs
  },
});
```

**dsync.user.updated (Critical State Handling)**

```typescript
// Check for state changes (active -> inactive is soft delete)
if (event.data.state === 'inactive') {
  // Soft delete: disable access but retain data
  await db.users.update({
    where: { id: event.data.id },
    data: { 
      active: false, 
      deactivated_at: new Date() 
    },
  });
} else {
  // Regular update
  await db.users.update({
    where: { id: event.data.id },
    data: {
      email: event.data.emails[0].value,
      first_name: event.data.first_name,
      last_name: event.data.last_name,
      custom_attributes: event.data.custom_attributes,
    },
  });
}
```

**Important:** Most providers use `state: inactive` for deprovisioning, NOT `dsync.user.deleted`. Always check `state` in update events.

**dsync.deleted (Teardown)**

```typescript
// Directory deleted - clean up all associated data
await db.users.updateMany({
  where: { directory_id: event.data.id },
  data: { active: false, directory_id: null },
});

await db.organizations.update({
  where: { directory_id: event.data.id },
  data: { directory_id: null },
});
```

**Do NOT delete user records immediately** - soft delete for audit trail.

### Event Payload Access

Event data is in `event.data` object:

- `event.data.id` - Resource ID (user/group/directory)
- `event.data.directory_id` - Parent directory ID
- `event.data.organization_id` - Your organization mapping
- `event.data.state` - `active` or `inactive` (users only)
- `event.data.previous_attributes` - Changed fields (update events)

Check WebFetch docs for complete attribute schemas.

## Step 6: Database Schema Setup

You need tables for users, groups, and group memberships.

### Minimum Required Tables

```sql
-- Directory users
CREATE TABLE directory_users (
  id VARCHAR(255) PRIMARY KEY,           -- WorkOS user ID
  directory_id VARCHAR(255) NOT NULL,     -- WorkOS directory ID
  organization_id VARCHAR(255) NOT NULL,  -- Your org ID
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  state VARCHAR(50) NOT NULL,             -- active/inactive
  raw_attributes JSONB,                   -- Full directory data
  custom_attributes JSONB,                -- Mapped custom fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Directory groups
CREATE TABLE directory_groups (
  id VARCHAR(255) PRIMARY KEY,           -- WorkOS group ID
  directory_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  raw_attributes JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Group memberships (for dsync.group.user_added events)
CREATE TABLE directory_group_members (
  group_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
```

**ORM users:** Translate to Prisma/TypeORM/Drizzle schemas. Keep `id` as string, not auto-increment.

## Step 7: Register Webhook URL

1. Go to https://dashboard.workos.com/webhooks
2. Click "Add Endpoint"
3. Enter your webhook URL: `https://yourdomain.com/webhooks/workos`
4. Select events (select all `dsync.*` events)
5. Copy webhook secret to `WORKOS_WEBHOOK_SECRET` env var

**For local development:**

Use ngrok or similar tunnel:

```bash
ngrok http 3000
# Copy https://xyz.ngrok.io URL
# Register https://xyz.ngrok.io/webhooks/workos in dashboard
```

## Step 8: Handle Group Membership Events (Optional)

If using groups for role/permission management, handle these events:

```typescript
// dsync.group.user_added
await db.directory_group_members.create({
  data: {
    group_id: event.data.id,
    user_id: event.data.user.id,
  },
});

// dsync.group.user_removed  
await db.directory_group_members.delete({
  where: {
    group_id_user_id: {
      group_id: event.data.id,
      user_id: event.data.user.id,
    },
  },
});
```

Check WebFetch docs for group event payloads.

## Step 9: Test with Directory Provider

### Setup Test Directory

1. In WorkOS dashboard, go to "Directory Sync"
2. Click "Add Directory"
3. Choose provider (Okta, Azure AD, Google Workspace, etc.)
4. Follow provider-specific setup (requires admin access)
5. Complete connection setup

### Trigger Test Events

In your directory provider:

1. **Create user** → Should trigger `dsync.user.created`
2. **Update user email** → Should trigger `dsync.user.updated`
3. **Disable user** → Should trigger `dsync.user.updated` with `state: inactive`
4. **Create group** → Should trigger `dsync.group.created`
5. **Add user to group** → Should trigger `dsync.group.user_added`

### Monitor Webhook Logs

Check WorkOS dashboard → Webhooks → Endpoint → Recent Deliveries

Look for:
- 200 responses (success)
- 4xx/5xx responses (failures to fix)
- Payload data matches your expectations

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm implementation:

```bash
# 1. Check webhook endpoint exists
grep -r "workos.webhooks.constructEvent" . || echo "FAIL: No webhook verification found"

# 2. Check environment variables are set
env | grep -E "WORKOS_(API_KEY|WEBHOOK_SECRET)" || echo "FAIL: Missing env vars"

# 3. Check database schema exists (example for PostgreSQL)
psql -U user -d dbname -c "\d directory_users" || echo "FAIL: Missing directory_users table"

# 4. Test webhook endpoint responds (local dev server must be running)
curl -X POST http://localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  && echo "Endpoint accessible" || echo "FAIL: Endpoint not found"

# 5. Verify SDK installed
npm ls @workos-inc/node || echo "FAIL: WorkOS SDK not installed"

# 6. Check webhook registered in dashboard
echo "MANUAL: Verify webhook endpoint exists at dashboard.workos.com/webhooks"
```

**All checks must pass before marking integration complete.**

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Signature mismatch between WorkOS and your handler.

Fixes:
1. Verify `WORKOS_WEBHOOK_SECRET` matches dashboard value exactly
2. Ensure you're using RAW body (string), not parsed JSON
3. Check signature header name is exactly `workos-signature` (lowercase)
4. Confirm no proxy/middleware is modifying request body or headers

**Framework-specific issues:**

- Next.js: Add `export const config = { api: { bodyParser: false } }` to pages API route
- Express: Use `express.raw()` middleware, not `express.json()`

### "dsync.user.updated not deactivating users"

**Root cause:** Not checking `state` field in update events.

Fix:
1. Add conditional: `if (event.data.state === 'inactive')`
2. Implement soft delete logic (disable access, don't delete record)
3. After Oct 2023, inactive users auto-delete in WorkOS - handle `dsync.user.deleted` too

### "Database constraint violation on user insert"

**Root cause:** Duplicate `dsync.user.created` events during initial sync.

Fix:
1. Use UPSERT pattern: `INSERT ... ON CONFLICT (id) DO UPDATE`
2. Or check if user exists before insert
3. Initial directory sync sends create events for ALL existing users

### "Missing custom attributes"

**Root cause:** Custom attributes not configured in WorkOS directory mapping.

Fix:
1. Go to WorkOS dashboard → Directory → Attributes tab
2. Map provider attributes to custom fields (e.g., `department`, `title`)
3. Access via `event.data.custom_attributes` or `event.data.raw_attributes`
4. Auto-mapped vs custom-mapped: see WebFetch docs on attributes

### "Webhook endpoint returns 200 but database not updating"

**Root cause:** Silent error in event handler.

Debug:
1. Add logging: `console.log('Processing event:', event.event, event.data.id)`
2. Wrap handler in try/catch, log errors
3. Check database connection is established
4. Verify event handler is actually called (not just signature verification)

### "Group membership out of sync"

**Root cause:** Missing `dsync.group.user_added/removed` handlers.

Fix:
1. Implement handlers for both events (see Step 8)
2. Handle initial sync: `dsync.group.created` includes members in payload
3. Create junction table records for each member during group creation

### "Too many webhook retries in dashboard"

**Root cause:** Handler returning non-200 response.

Fix:
1. Always return 200 OK, even if processing fails (idempotency)
2. Log errors internally, don't expose to WorkOS
3. Implement queue for processing if operations are slow
4. Handle duplicate events gracefully (use event.id for deduplication)

## Advanced Patterns

### Idempotent Event Processing

Webhooks may be delivered multiple times. Use event ID for deduplication:

```typescript
// Check if event already processed
const processed = await db.webhook_events.findUnique({
  where: { id: event.id },
});

if (processed) {
  return new Response('Already processed', { status: 200 });
}

// Process event...

// Mark as processed
await db.webhook_events.create({
  data: { id: event.id, processed_at: new Date() },
});
```

### Async Processing with Queue

For high-volume directories, process events asynchronously:

```typescript
export async function POST(request: Request) {
  // Verify signature
  const event = workos.webhooks.constructEvent({...});

  // Queue for processing
  await queue.add('directory-sync', { event });

  // Return 200 immediately
  return new Response('Queued', { status: 200 });
}
```

Worker processes event from queue, allowing webhook to respond quickly.

### Handling Previous Attributes

`dsync.user.updated` includes `previous_attributes` for change tracking:

```typescript
if (event.data.previous_attributes?.email) {
  // Email changed - send notification
  await sendEmailChangeNotification({
    old: event.data.previous_attributes.email,
    new: event.data.emails[0].value,
  });
}
```

Only changed fields appear in `previous_attributes`.

## Related Skills

- **workos-sso**: Single Sign-On integration (often paired with Directory Sync)
- **workos-admin-portal**: Self-service directory
