---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:70f7214d7bc1 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for source of truth on Directory Sync implementation:

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Verify API key format
grep "WORKOS_API_KEY=sk_" .env* || echo "FAIL: API key missing or invalid format"

# Verify client ID
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: Client ID missing"
```

Both must exist before proceeding.

### SDK Installation

Detect package manager and verify WorkOS SDK is installed:

```bash
# Check SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || npm ls @workos-inc/node || echo "FAIL: SDK not installed"
```

If SDK missing, install based on detected package manager (npm/yarn/pnpm).

## Step 3: Webhook Infrastructure (MANDATORY)

**CRITICAL:** Directory Sync uses webhooks for event delivery. Polling is NOT supported.

### Decision Tree: New vs Existing Webhook Handler

```
Do you have existing WorkOS webhook handling?
  |
  +-- YES --> Extend existing handler to include Directory Sync events
  |           (see Step 4 for event types)
  |
  +-- NO  --> Create new webhook endpoint
              (see Step 4 for implementation pattern)
```

### Webhook URL Requirements

Your webhook endpoint MUST:
- Be publicly accessible (use ngrok/tunneling for local dev)
- Accept POST requests
- Return 200 status within 30 seconds
- Handle duplicate event deliveries (events may retry)

**Verification:**

```bash
# Check webhook route exists (adjust path to your framework)
grep -r "POST.*webhook" app/ routes/ pages/ src/ 2>/dev/null || echo "WARN: No webhook route found"
```

## Step 4: Implement Webhook Handler

### Event Verification Pattern

Always verify webhook signatures before processing:

```javascript
// Generic pattern - check fetched docs for SDK-specific method
const WorkOS = require('@workos-inc/node').WorkOS;
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Webhook handler
async function handleWebhook(request) {
  const payload = request.body;
  const signature = request.headers['workos-signature'];
  
  // Verify signature (method name from SDK docs)
  const event = workos.webhooks.constructEvent({
    payload,
    signature,
    secret: process.env.WORKOS_WEBHOOK_SECRET
  });
  
  // Process event
  await processDirectorySyncEvent(event);
  
  return { status: 200 };
}
```

**Signature verification is REQUIRED** — unauthenticated webhooks expose your app to injection attacks.

### Directory Sync Event Types

Process these event types in your handler:

**Directory lifecycle:**
- `dsync.activated` - Directory connection established
- `dsync.deleted` - Directory connection removed

**User lifecycle:**
- `dsync.user.created` - New user provisioned
- `dsync.user.updated` - User attributes changed
- `dsync.user.deleted` - User hard-deleted (rare - see inactive user handling)

**Group lifecycle:**
- `dsync.group.created` - New group created
- `dsync.group.updated` - Group attributes changed
- `dsync.group.deleted` - Group removed
- `dsync.group.user_added` - User assigned to group
- `dsync.group.user_removed` - User removed from group

### Event Processing Pattern

```
Event received
  |
  +-- Verify signature (REQUIRED)
  |
  +-- Check event type
  |     |
  |     +-- dsync.activated --> Save directory_id, associate with organization
  |     |
  |     +-- dsync.user.created --> Create user record, link to directory_id
  |     |
  |     +-- dsync.user.updated --> Update user attributes
  |     |                          Check state field for inactive status
  |     |
  |     +-- dsync.user.deleted --> Remove user OR mark deleted
  |     |
  |     +-- dsync.group.* --> Update group memberships
  |     |
  |     +-- dsync.deleted --> Remove directory association
  |                          Delete all users/groups for that directory
  |
  +-- Return 200 (event processed) or 500 (retry)
```

## Step 5: Database Schema Design

### Minimum Required Tables

**directories:**
- `id` (your primary key)
- `workos_directory_id` (from event.directory.id)
- `organization_id` (your organization identifier)
- `state` (active/deleting/invalid_credentials)
- `directory_type` (azure scim v2.0, okta scim v2.0, etc.)

**directory_users:**
- `id` (your primary key)
- `workos_user_id` (from event.data.id)
- `directory_id` (foreign key to directories table)
- `email`
- `first_name`, `last_name`
- `state` (active/inactive/suspended)
- `custom_attributes` (JSONB/JSON column)
- `raw_attributes` (JSONB/JSON - full payload for debugging)

**directory_groups:**
- `id` (your primary key)
- `workos_group_id` (from event.data.id)
- `directory_id` (foreign key)
- `name`
- `raw_attributes` (JSONB/JSON)

**directory_group_memberships:**
- `user_id` (foreign key to directory_users)
- `group_id` (foreign key to directory_groups)
- Primary key: (user_id, group_id)

### Indexing Requirements

Add indexes for webhook processing performance:

```sql
CREATE INDEX idx_users_workos_id ON directory_users(workos_user_id);
CREATE INDEX idx_groups_workos_id ON directory_groups(workos_group_id);
CREATE INDEX idx_directories_workos_id ON directories(workos_directory_id);
CREATE INDEX idx_users_directory ON directory_users(directory_id);
CREATE INDEX idx_groups_directory ON directory_groups(directory_id);
```

## Step 6: Handle Inactive Users (CRITICAL)

**Decision Tree: Inactive User Handling**

```
dsync.user.updated received with state = "inactive"
  |
  +-- Environment created AFTER Oct 19, 2023?
  |     |
  |     +-- YES --> WorkOS auto-deletes inactive users
  |     |           You'll receive dsync.user.deleted
  |     |           Handle as hard delete
  |     |
  |     +-- NO  --> WorkOS retains inactive users
  |                 You receive dsync.user.updated
  |                 Decision: soft delete or retain?
  |
  +-- Your app's inactive user policy?
        |
        +-- Retain --> Mark user.state = inactive
        |              Preserve data, block login
        |
        +-- Delete --> Remove user record
                       Unlink from groups
```

**Source:** https://workos.com/docs/directory-sync/handle-inactive-users

Most directory providers (Okta, Azure AD, Google) use soft deletion — they mark users inactive rather than hard-deleting. Handle this in `dsync.user.updated`:

```javascript
async function handleUserUpdated(event) {
  const user = event.data;
  
  if (user.state === 'inactive') {
    // YOUR POLICY HERE
    // Option A: Soft delete (recommended)
    await db.users.update(user.id, { 
      state: 'inactive',
      deactivated_at: new Date() 
    });
    
    // Option B: Hard delete
    await db.users.delete(user.id);
  } else {
    // Normal attribute update
    await db.users.update(user.id, user);
  }
}
```

## Step 7: Initial Sync Handling

When `dsync.activated` fires, WorkOS performs initial directory sync. You'll receive:

1. `dsync.activated` event
2. Burst of `dsync.user.created` events (ALL existing users)
3. Burst of `dsync.group.created` events (ALL existing groups)
4. Burst of `dsync.group.user_added` events (ALL memberships)

**Performance pattern:**

```javascript
async function handleActivated(event) {
  const directory = event.data;
  
  // Save directory record
  await db.directories.create({
    workos_directory_id: directory.id,
    organization_id: directory.organization_id,
    state: directory.state,
    directory_type: directory.type
  });
  
  // Flag for batch processing mode
  await cache.set(`directory:${directory.id}:initial_sync`, true, 3600);
}

async function handleUserCreated(event) {
  const inInitialSync = await cache.get(`directory:${event.directory.id}:initial_sync`);
  
  if (inInitialSync) {
    // Batch insert (100+ users)
    await batchQueue.add(event);
  } else {
    // Single insert (normal operation)
    await db.users.create(event.data);
  }
}
```

Expect 100-10,000+ users during initial sync for enterprise customers.

## Step 8: Custom Attributes Mapping

Check fetched docs for attribute mapping capabilities. Directory Sync supports:

1. **Standard attributes** - email, first_name, last_name, state
2. **Auto-mapped attributes** - WorkOS automatically maps common fields
3. **Custom-mapped attributes** - Admin Portal UI for customer-defined mappings

Store custom attributes in JSONB column:

```javascript
// Event payload structure
{
  "data": {
    "id": "directory_user_01E...",
    "emails": [{"primary": true, "value": "user@example.com"}],
    "first_name": "Jane",
    "last_name": "Doe",
    "custom_attributes": {
      "department": "Engineering",
      "employee_id": "12345",
      "cost_center": "R&D"  // Custom-mapped by customer
    }
  }
}
```

Never hardcode custom attribute names — they're customer-specific.

## Step 9: Role Assignment (Advanced)

Check https://workos.com/docs/directory-sync/identity-provider-role-assignment for provider-specific role mapping capabilities.

Some directory providers support assigning app-specific roles:
- Okta → Role assignment via App Integration
- Azure AD → App Roles manifest
- Google Workspace → (check docs for support)

If available, roles appear in `custom_attributes`:

```javascript
{
  "custom_attributes": {
    "role": "admin",  // or roles: ["admin", "billing"]
  }
}
```

Map directory roles to your internal RBAC system during user sync.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables configured
env | grep WORKOS_API_KEY | grep "sk_" || echo "FAIL: API key invalid"
env | grep WORKOS_WEBHOOK_SECRET || echo "FAIL: Webhook secret missing"

# 2. Webhook endpoint exists and is routable
curl -X POST http://localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  | grep -E "200|401|403" || echo "FAIL: Webhook route not responding"

# 3. Database tables exist (adjust to your schema tool)
psql -c "\dt" | grep directory_users || echo "FAIL: Schema not created"
psql -c "\dt" | grep directory_groups || echo "FAIL: Schema not created"

# 4. Signature verification implemented
grep -r "workos.webhooks.constructEvent\|verifyWebhook" . || echo "FAIL: No signature verification found"

# 5. Event type handling
grep -r "dsync.user.created" . || echo "WARN: User creation not handled"
grep -r "dsync.user.updated" . || echo "WARN: User updates not handled"
grep -r "dsync.activated" . || echo "WARN: Directory activation not handled"

# 6. Application builds
npm run build || yarn build || echo "FAIL: Build errors"
```

**Test webhook delivery:**

1. Configure webhook URL in WorkOS Dashboard: `https://your-domain.com/webhooks/workos`
2. Use Dashboard's "Test Webhook" button
3. Verify event logged in your application
4. Check response is 200 OK

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Signature mismatch between WorkOS and your verification.

**Fix:**
1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard value
2. Check raw request body is passed to verification (not parsed JSON)
3. Ensure no middleware modifies request body before verification

**Verification:**

```javascript
// WRONG - body already parsed
app.use(express.json());
app.post('/webhook', (req) => workos.webhooks.verify(req.body, sig));

// CORRECT - verify raw body
app.post('/webhook', 
  express.raw({type: 'application/json'}),
  (req) => workos.webhooks.verify(req.body, sig)
);
```

### "Duplicate user creation errors"

**Root cause:** Webhook retry after network failure, constraint violation on unique workos_user_id.

**Fix:** Use upsert pattern instead of insert:

```sql
INSERT INTO directory_users (workos_user_id, email, ...) 
VALUES ($1, $2, ...) 
ON CONFLICT (workos_user_id) 
DO UPDATE SET email = $2, ...
```

This makes webhook handler idempotent.

### "dsync.deleted event but users not cleaned up"

**Root cause:** Missing cascade delete or explicit cleanup logic.

**Fix:** When processing `dsync.deleted`, delete all related records:

```javascript
async function handleDirectoryDeleted(event) {
  const directoryId = event.directory.id;
  
  // Delete in order: memberships → users → groups → directory
  await db.groupMemberships.deleteWhere({ directory_id: directoryId });
  await db.users.deleteWhere({ directory_id: directoryId });
  await db.groups.deleteWhere({ directory_id: directoryId });
  await db.directories.deleteWhere({ workos_directory_id: directoryId });
}
```

Or use database foreign key cascades: `ON DELETE CASCADE`

### "Initial sync causes webhook timeout"

**Root cause:** Processing 1000+ user creation events synchronously exceeds 30s timeout.

**Fix:** Use async job queue for initial sync:

```javascript
async function handleUserCreated(event) {
  // Queue job instead of processing inline
  await jobQueue.publish('directory.user.sync', event);
  return 200;  // Acknowledge immediately
}

// Separate worker processes jobs
worker.on('directory.user.sync', async (event) => {
  await db.users.create(event.data);
});
```

### "State management conflicts"

**Root cause:** Events arrive out of order (created → deleted → updated).

**Fix:** Use event timestamps and compare before applying updates:

```javascript
async function handleUserUpdated(event) {
  const existing = await db.users.findByWorkOSId(event.data.id);
  
  if (existing && existing.last_synced_at > event.created_at) {
    // Stale event, discard
    return;
  }
  
  await db.users.update(event.data.id, {
    ...event.data,
    last_synced_at: event.created_at
  });
}
```

### "Custom attributes not syncing"

**Root cause:** Custom mapping not configured by customer in Admin Portal.

**Fix:** This is customer configuration, not code issue.

1. Customer must configure custom attribute mappings in Admin Portal
2. Check `event.data.custom_attributes` is populated
3. If empty, customer hasn't mapped attributes yet
4. Provide Admin Portal URL to customer

### "Groups created but memberships empty"

**Root cause:** Event processing order — `dsync.group.created` arrives before `dsync.group.user_added`.

**Fix:** This is expected behavior. Process group creation first, memberships arrive seconds later:

```javascript
// Event sequence:
// 1. dsync.group.created → Create group record
// 2. dsync.group.user_added → Add user_id to memberships table
```

Not a bug — WorkOS sends events in phases during sync.

## Related Skills

- **workos-api-directory-sync**: Direct API access patterns for directory queries
- **workos-admin-portal**: Customer self-service for directory connections
- **workos-events**: Generic webhook handling infrastructure
- **workos-integrations**: Provider-specific directory setup guides
