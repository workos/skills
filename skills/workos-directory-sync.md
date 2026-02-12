---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:70f7214d7bc1 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Must exist and have correct format
grep WORKOS_API_KEY .env* | grep "sk_"
grep WORKOS_CLIENT_ID .env* | grep "client_"
```

**STOP if either command returns empty** — credentials are mandatory.

### Project Structure

Confirm SDK is installed:

```bash
# One of these must succeed
npm list @workos-inc/node || \
yarn list @workos-inc/node || \
pnpm list @workos-inc/node
```

### WorkOS Dashboard Prerequisites

Verify in https://dashboard.workos.com/:

- [ ] Directory connection exists for test organization
- [ ] Webhook endpoint is configured (see Step 4)
- [ ] API key has Directory Sync permissions

## Step 3: SDK Installation and Initialization

### Install SDK (if not present)

Detect package manager and install:

```bash
# Auto-detect and install
if [ -f "package-lock.json" ]; then
  npm install @workos-inc/node
elif [ -f "yarn.lock" ]; then
  yarn add @workos-inc/node
else
  pnpm add @workos-inc/node
fi
```

### Initialize SDK

Create or update SDK client initialization:

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Verify:** Run `npm run build` or `tsc` to confirm no import errors.

## Step 4: Webhook Endpoint Setup (MANDATORY)

**CRITICAL:** Directory Sync events are delivered via webhooks. Polling is NOT supported.

### Create Webhook Handler

Directory Sync flow:

```
IdP action (create user, update group, etc.)
  |
  v
WorkOS ingests and processes event
  |
  v
WorkOS sends webhook to YOUR endpoint
  |
  v
Your app processes event and updates database
```

Create webhook endpoint at `/api/webhooks/workos` (or your preferred path):

```typescript
// Example: Express.js handler
app.post("/api/webhooks/workos", async (req, res) => {
  const payload = req.body;
  const signature = req.headers["workos-signature"];

  // Verify webhook signature (REQUIRED for production)
  // See fetched docs for exact verification method

  // Process event (see Step 5 for event handling)
  await handleDirectorySyncEvent(payload);

  res.status(200).send("OK");
});
```

### Configure Webhook in Dashboard

1. Go to https://dashboard.workos.com/webhooks
2. Add endpoint URL (must be publicly accessible HTTPS in production)
3. Subscribe to Directory Sync events:
   - `dsync.activated`
   - `dsync.deleted`
   - `dsync.user.created`
   - `dsync.user.updated`
   - `dsync.user.deleted`
   - `dsync.group.created`
   - `dsync.group.updated`
   - `dsync.group.deleted`
   - `dsync.group.user_added`
   - `dsync.group.user_removed`
4. Save webhook secret for signature verification

**Verify webhook:**

```bash
# Send test event from Dashboard and check logs
curl -X POST http://localhost:3000/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"event":"dsync.activated","data":{"id":"directory_123"}}'
```

## Step 5: Event Processing (Decision Tree)

Process each event type based on its lifecycle impact:

```
Webhook received
  |
  +-- dsync.activated
  |     |
  |     +-> Save directory_id with organization_id
  |     +-> Log "Directory connected for org X"
  |
  +-- dsync.deleted
  |     |
  |     +-> Remove directory association
  |     +-> Mark all users in directory as deleted (optional)
  |     +-> NOTE: No individual user/group delete events sent
  |
  +-- dsync.user.created
  |     |
  |     +-> Insert user into database
  |     +-> Associate with directory_id and organization_id
  |     +-> Send onboarding email (optional)
  |     +-> NOTE: Sent for EACH existing user during initial sync
  |
  +-- dsync.user.updated
  |     |
  |     +-> Check previous_attributes for changes
  |     +-> Update user record in database
  |     +-> Check if state changed to "inactive" --> soft delete user
  |     +-> NOTE: Inactive users are deleted after Oct 19, 2023 (new envs)
  |
  +-- dsync.user.deleted
  |     |
  |     +-> Hard delete user from database
  |     +-> NOTE: Rare - most providers soft-delete (use state=inactive)
  |
  +-- dsync.group.created
  |     |
  |     +-> Insert group into database
  |     +-> Associate with directory_id
  |     +-> NOTE: User events processed BEFORE group events
  |
  +-- dsync.group.updated
  |     |
  |     +-> Check previous_attributes for changes
  |     +-> Update group record in database
  |
  +-- dsync.group.deleted
  |     |
  |     +-> Remove group from database
  |     +-> Update user records (remove group associations)
  |
  +-- dsync.group.user_added
  |     |
  |     +-> Add user_id to group_id association
  |     +-> Update user permissions based on group
  |
  +-- dsync.group.user_removed
        |
        +-> Remove user_id from group_id association
        +-> Revoke group-based permissions
```

### Event Processing Pattern

```typescript
async function handleDirectorySyncEvent(event: WebhookEvent) {
  const { event: eventType, data } = event;

  switch (eventType) {
    case "dsync.activated":
      await db.organizations.update({
        where: { id: data.organization_id },
        data: { directory_id: data.id },
      });
      break;

    case "dsync.user.created":
      await db.users.create({
        data: {
          id: data.id,
          email: data.emails[0]?.value,
          first_name: data.first_name,
          last_name: data.last_name,
          directory_id: data.directory_id,
          state: data.state,
          // Map other attributes from data object
        },
      });
      break;

    case "dsync.user.updated":
      const updates: any = {};
      if (data.previous_attributes) {
        // Only update changed fields
        Object.keys(data.previous_attributes).forEach((key) => {
          updates[key] = data[key];
        });
      }

      // CRITICAL: Handle inactive state
      if (data.state === "inactive") {
        updates.deleted_at = new Date();
      }

      await db.users.update({
        where: { id: data.id },
        data: updates,
      });
      break;

    // Implement other event types...
  }
}
```

## Step 6: Directory Data Retrieval (Optional)

Use SDK methods to fetch directory data on-demand:

```typescript
// List all directories for an organization
const directories = await workos.directorySync.listDirectories({
  organization: "org_123",
});

// Get directory users
const users = await workos.directorySync.listUsers({
  directory: "directory_123",
});

// Get directory groups
const groups = await workos.directorySync.listGroups({
  directory: "directory_123",
});

// Get specific user
const user = await workos.directorySync.getUser({
  user: "directory_user_123",
});

// Get specific group
const group = await workos.directorySync.getGroup({
  group: "directory_group_123",
});
```

**When to use:**

- Initial data import (before webhooks catch up)
- Recovery from webhook processing failures
- On-demand user lookup for auth flows

**Do NOT use for real-time sync** — webhooks are the primary mechanism.

## Step 7: Handle Inactive Users (Post Oct 19, 2023)

**CRITICAL environment-specific behavior:**

```
Environment created AFTER Oct 19, 2023?
  |
  +-- YES --> WorkOS automatically deletes inactive users
  |           |
  |           +-> You receive dsync.user.deleted event
  |           +-> No need to check state=inactive
  |
  +-- NO  --> WorkOS marks users as state=inactive
              |
              +-> You receive dsync.user.updated event
              +-> YOU must handle soft deletion
              +-> Contact support to opt into auto-delete behavior
```

If your environment uses state=inactive pattern:

```typescript
case 'dsync.user.updated':
  if (data.state === 'inactive') {
    // Soft delete - mark as deleted but retain record
    await db.users.update({
      where: { id: data.id },
      data: {
        deleted_at: new Date(),
        active: false
      }
    });
  }
  break;
```

**Verify your environment's behavior:**

1. Check WorkOS Dashboard environment creation date
2. Test with real directory provider
3. Observe whether you receive `deleted` or `updated(state=inactive)` events

Reference: https://workos.com/docs/directory-sync/handle-inactive-users

## Step 8: Custom Attributes (If Needed)

Directory Sync supports three attribute types:

1. **Standard attributes** — `first_name`, `last_name`, `emails`, etc. (always present)
2. **Auto-mapped attributes** — Common non-standard fields WorkOS maps automatically
3. **Custom-mapped attributes** — Provider-specific fields you configure in Dashboard

### Access Custom Attributes

```typescript
case 'dsync.user.created':
case 'dsync.user.updated':
  const customAttrs = data.custom_attributes || {};

  await db.users.upsert({
    where: { id: data.id },
    update: {
      // Standard attributes
      first_name: data.first_name,
      last_name: data.last_name,

      // Custom attributes (example)
      employee_id: customAttrs.employee_id,
      department: customAttrs.department,
      manager_email: customAttrs.manager_email,
    }
  });
  break;
```

### Configure Custom Attribute Mapping

In WorkOS Dashboard (per directory):

1. Go to Directory settings
2. Add custom attribute mappings
3. Map provider field names to your app's field names

Reference: https://workos.com/docs/directory-sync/attributes

## Step 9: Role Assignment via Groups (If Needed)

Use directory groups to assign app-level roles:

```typescript
case 'dsync.group.user_added':
  const group = await workos.directorySync.getGroup({
    group: data.group.id
  });

  // Map group name to app role
  const roleMapping = {
    'Admins': 'admin',
    'Developers': 'developer',
    'Viewers': 'viewer'
  };

  const role = roleMapping[group.name];
  if (role) {
    await db.userRoles.create({
      data: {
        user_id: data.user.id,
        role: role
      }
    });
  }
  break;

case 'dsync.group.user_removed':
  // Revoke role when removed from group
  await db.userRoles.deleteMany({
    where: {
      user_id: data.user.id,
      group_id: data.group.id
    }
  });
  break;
```

Reference: https://workos.com/docs/directory-sync/identity-provider-role-assignment

## Verification Checklist (ALL MUST PASS)

Run these commands to verify implementation:

```bash
# 1. SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Environment variables present
env | grep WORKOS_API_KEY | grep "sk_" || echo "FAIL: Invalid API key"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Missing client ID"

# 3. Webhook endpoint exists
grep -r "workos-signature" . --include="*.ts" --include="*.js" || \
  echo "WARNING: Webhook signature verification not found"

# 4. Event handlers implemented
grep -r "dsync\.(activated|user\.created|user\.updated)" . \
  --include="*.ts" --include="*.js" || \
  echo "FAIL: No event handlers found"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"

# 6. Webhook responds
curl -X POST http://localhost:3000/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"event":"dsync.activated","data":{"id":"test"}}' \
  -w "\nHTTP Status: %{http_code}\n" | grep "200" || \
  echo "FAIL: Webhook not responding"
```

**If any check fails, go back to the corresponding step.**

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Mismatch between webhook secret and verification code.

Fix:

1. Get webhook secret from https://dashboard.workos.com/webhooks
2. Use WorkOS SDK's built-in verification (check fetched docs for exact method)
3. Ensure raw request body is used (not parsed JSON) for signature check

### "No dsync events received"

**Diagnosis tree:**

```
No events received?
  |
  +-- Is webhook URL publicly accessible?
  |     |
  |     +-- NO --> Use ngrok or similar for local dev
  |     +-- YES --> Check firewall/load balancer
  |
  +-- Is webhook subscribed to dsync.* events?
  |     |
  |     +-- NO --> Add subscriptions in Dashboard
  |     +-- YES --> Check Dashboard webhook logs
  |
  +-- Is directory connection active?
        |
        +-- NO --> Complete directory setup in Dashboard
        +-- YES --> Send test event from Dashboard
```

### "dsync.user.created fires for every user during initial sync"

**This is expected behavior** — not an error.

During first directory connection, WorkOS sends `dsync.user.created` for ALL existing users. Handle with batch processing:

```typescript
// Use database transactions or batch upserts
const users = [];
// Collect user events...
await db.users.createMany({ data: users, skipDuplicates: true });
```

### "User not marked as inactive after removal"

**Check environment behavior** (see Step 7):

- Post-Oct 2023 envs: Look for `dsync.user.deleted`
- Pre-Oct 2023 envs: Look for `dsync.user.updated` with `state=inactive`

If unclear, contact WorkOS support to confirm environment configuration.

### "previous_attributes is empty in dsync.user.updated"

**This is normal** when new attributes are added. The docs state:

> If the current snapshot has a new attribute that did not exist previously, then the value for the attribute will be indicated as `null`.

Check `data` object directly for current values, not just `previous_attributes`.

### "API rate limit exceeded"

**Root cause:** Excessive polling or redundant API calls.

Fix:

1. **Never poll for events** — webhooks are mandatory, polling is not supported
2. Use webhook events as source of truth
3. Only use SDK list methods for initial import or error recovery
4. Implement retry with exponential backoff for failed webhook processing

Reference: https://workos.com/docs/directory-sync/understanding-events

### "Groups appear before users in event stream"

**This is NOT the documented behavior.** Per the docs:

> When WorkOS ingests this event, it first processes the users in the group. So, in most cases, you would receive `dsync.user.created`, then `dsync.group.created`, and finally, `dsync.group.user_added`.

If you observe different ordering:

1. Implement idempotent handlers (handle events in any order)
2. Use database foreign key constraints with ON DELETE CASCADE
3. Queue events for retry if referenced entities don't exist yet

## Related Skills

- workos-migrate-other-services.rules.yml — Migrating from other identity providers
- workos-authkit-nextjs — Combine Directory Sync with AuthKit for complete ULM
- workos-authkit-react — Client-side auth with synced directory users
