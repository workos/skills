---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- generated -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. `https://workos.com/docs/directory-sync/quick-start`
2. `https://workos.com/docs/directory-sync/understanding-events`
3. `https://workos.com/docs/directory-sync/index`
4. `https://workos.com/docs/directory-sync/identity-provider-role-assignment`
5. `https://workos.com/docs/directory-sync/handle-inactive-users`
6. `https://workos.com/docs/directory-sync/example-apps`
7. `https://workos.com/docs/directory-sync/attributes`

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard (`https://dashboard.workos.com/`) for:

- Active API key (starts with `sk_`)
- At least one directory connection created (or planned for testing)
- Webhook endpoint configured (Step 5 will create the route)

### Environment Variables

Check `.env.local` or equivalent:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (optional for directory sync)
- `WORKOS_WEBHOOK_SECRET` - for verifying webhook signatures

**Verify:** All keys present before continuing.

### Project Structure

Detect framework:

```
Framework?
  |
  +-- Next.js (13+) --> Webhook at app/api/webhooks/workos/route.ts
  |
  +-- Express/Node --> Webhook at /webhooks/workos endpoint
  |
  +-- Other --> Follow framework's webhook routing pattern
```

## Step 3: Install SDK

Detect package manager (npm/yarn/pnpm), install WorkOS SDK:

```bash
npm install @workos-inc/node
# or
yarn add @workos-inc/node
# or
pnpm add @workos-inc/node
```

**Verify:** Check `node_modules/@workos-inc/node` exists before continuing.

## Step 4: Initialize SDK Client

Create SDK client singleton. Location depends on framework:

```
Framework?
  |
  +-- Next.js --> lib/workos.ts or src/lib/workos.ts
  |
  +-- Express --> src/config/workos.js or config/workos.js
  |
  +-- Other --> Follow project's config pattern
```

**Pattern:**

```typescript
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Verify:** Build succeeds after adding client.

## Step 5: Create Webhook Endpoint

Directory Sync uses webhooks to notify your app of directory changes. Create endpoint based on framework:

### Next.js App Router (13+)

File: `app/api/webhooks/workos/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { workos } from '@/lib/workos';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const sigHeader = request.headers.get('workos-signature');
  
  if (!sigHeader) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  try {
    const webhook = workos.webhooks.constructEvent({
      payload,
      sigHeader,
      secret: process.env.WORKOS_WEBHOOK_SECRET!,
    });

    // Handle event (Step 6)
    await handleWebhookEvent(webhook);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
```

### Express/Node

File: `routes/webhooks.js` or similar

```javascript
const express = require('express');
const { workos } = require('../config/workos');

router.post('/workos', express.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body.toString();
  const sigHeader = req.headers['workos-signature'];

  if (!sigHeader) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    const webhook = workos.webhooks.constructEvent({
      payload,
      sigHeader,
      secret: process.env.WORKOS_WEBHOOK_SECRET,
    });

    await handleWebhookEvent(webhook);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Invalid signature' });
  }
});
```

**Critical:** Webhook endpoint MUST:
1. Accept POST requests
2. Read raw body (not parsed JSON)
3. Verify signature using `workos.webhooks.constructEvent()`
4. Return 200 on success (WorkOS retries on non-2xx)

## Step 6: Implement Event Handlers (Decision Tree)

Parse `webhook.event` to route to appropriate handler:

```
Event Type?
  |
  +-- dsync.activated
  |     └──> Link directory to organization
  |
  +-- dsync.deleted
  |     └──> Unlink directory, optionally mark users as deleted
  |
  +-- dsync.user.created
  |     └──> Create user in your database
  |
  +-- dsync.user.updated
  |     └──> Update user attributes, check state field
  |
  +-- dsync.user.deleted
  |     └──> Remove user from database
  |
  +-- dsync.group.created
  |     └──> Create group/role in your database
  |
  +-- dsync.group.updated
  |     └──> Update group metadata
  |
  +-- dsync.group.deleted
  |     └──> Remove group from database
  |
  +-- dsync.group.user_added
  |     └──> Add user to group mapping
  |
  +-- dsync.group.user_removed
        └──> Remove user from group mapping
```

### Handler Implementation Pattern

```typescript
async function handleWebhookEvent(webhook: any) {
  const { event, data } = webhook;

  switch (event) {
    case 'dsync.activated':
      await handleDirectoryActivated(data);
      break;
    
    case 'dsync.deleted':
      await handleDirectoryDeleted(data);
      break;
    
    case 'dsync.user.created':
      await handleUserCreated(data);
      break;
    
    case 'dsync.user.updated':
      await handleUserUpdated(data);
      break;
    
    case 'dsync.user.deleted':
      await handleUserDeleted(data);
      break;
    
    case 'dsync.group.created':
      await handleGroupCreated(data);
      break;
    
    case 'dsync.group.user_added':
      await handleUserAddedToGroup(data);
      break;
    
    case 'dsync.group.user_removed':
      await handleUserRemovedFromGroup(data);
      break;
    
    default:
      console.log('Unhandled event type:', event);
  }
}
```

### Critical Event Handling Rules

**dsync.activated:**
- Save `data.id` (directory ID) to organization record
- This is your link between WorkOS directory and your customer

**dsync.user.updated - Inactive State:**
- Check `data.state` field
- If `state === 'inactive'`, treat as soft delete
- Post-Oct 2023 environments: WorkOS auto-deletes inactive users after retention period
- Pre-Oct 2023 environments: You receive `dsync.user.updated` with `state: 'inactive'`, handle accordingly

**dsync.user.updated - previous_attributes:**
- Contains only changed fields (not full snapshot)
- `null` value means attribute was added (didn't exist before)
- Example: `{ "previous_attributes": { "firstName": "John" } }` means firstName changed from "John"

**dsync.deleted:**
- Directory connection torn down
- WorkOS sends ONE `dsync.deleted` event only
- NO individual `dsync.user.deleted` or `dsync.group.deleted` events
- Your app must cascade delete or mark all users/groups in that directory

## Step 7: Database Schema (Required Fields)

Your database must track these relationships:

### Organizations Table
```
organizations
  - id
  - name
  - workos_directory_id (nullable, from dsync.activated)
```

### Users Table
```
users
  - id
  - email (unique)
  - first_name
  - last_name
  - workos_user_id (unique, from dsync.user.created data.id)
  - organization_id (foreign key)
  - state (active/inactive)
  - raw_attributes (jsonb, for custom attributes)
```

### Groups Table (Optional)
```
groups
  - id
  - name
  - workos_group_id (unique)
  - organization_id (foreign key)
```

### User-Group Mappings (Optional)
```
user_groups
  - user_id (foreign key)
  - group_id (foreign key)
```

**Verify:** Schema supports storing directory ID, user ID, and state transitions.

## Step 8: Configure Webhook URL in WorkOS Dashboard

1. Deploy webhook endpoint to publicly accessible URL
2. Navigate to `https://dashboard.workos.com/webhooks`
3. Add webhook endpoint: `https://your-domain.com/api/webhooks/workos` (or your path)
4. Copy webhook secret to `WORKOS_WEBHOOK_SECRET` environment variable
5. Select events to listen for:
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

**Verify:** Send test webhook from dashboard, check endpoint receives and verifies signature.

## Step 9: Test Directory Connection

### Create Test Directory Connection

In WorkOS Dashboard:
1. Navigate to Directory Sync section
2. Click "Create Directory"
3. Choose provider (Okta, Azure AD, Google Workspace, etc.)
4. Follow provider-specific setup instructions
5. Note the directory ID

### Trigger Test Events

1. Create a test user in your directory provider
   - **Expect:** `dsync.user.created` webhook received
   - **Verify:** User created in your database with correct `workos_user_id`

2. Update the test user's name
   - **Expect:** `dsync.user.updated` webhook received
   - **Verify:** User record updated, `previous_attributes` contains old value

3. Create a test group and assign user
   - **Expect:** `dsync.group.created`, then `dsync.group.user_added`
   - **Verify:** Group created, user-group mapping created

4. Deactivate the test user (if provider supports)
   - **Expect:** `dsync.user.updated` with `state: 'inactive'`
   - **Verify:** User marked inactive in your database

## Step 10: Implement List/Get Operations (Optional)

If you need to fetch directory data on-demand (not just via webhooks):

```typescript
// List all directories for your account
const directories = await workos.directorySync.listDirectories();

// Get specific directory
const directory = await workos.directorySync.getDirectory('directory_id');

// List users in a directory
const users = await workos.directorySync.listUsers({ directory: 'directory_id' });

// List groups in a directory
const groups = await workos.directorySync.listGroups({ directory: 'directory_id' });

// Get specific user
const user = await workos.directorySync.getUser('user_id');

// Get specific group
const group = await workos.directorySync.getGroup('group_id');
```

**Use cases:**
- Initial sync when connecting existing directory
- Reconciliation checks
- Admin UI for viewing directory state

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check webhook endpoint exists (adjust path for your framework)
ls app/api/webhooks/workos/route.ts || ls routes/webhooks.js || echo "FAIL: Webhook endpoint missing"

# 3. Check environment variables
env | grep -E "WORKOS_API_KEY|WORKOS_WEBHOOK_SECRET" | wc -l | grep -q "2" && echo "PASS: Env vars set" || echo "FAIL: Missing env vars"

# 4. Check SDK client initialized
grep -r "new WorkOS" lib/ src/ config/ 2>/dev/null || echo "FAIL: SDK client not found"

# 5. Check event handlers exist
grep -r "dsync.user.created\|dsync.user.updated" . --include="*.ts" --include="*.js" 2>/dev/null || echo "FAIL: Event handlers missing"

# 6. Build succeeds
npm run build || npm run compile || echo "FAIL: Build failed"

# 7. Webhook signature verification
grep -r "constructEvent\|verifySignature" . --include="*.ts" --include="*.js" 2>/dev/null || echo "FAIL: Signature verification missing"
```

**Manual checks:**

8. Send test webhook from WorkOS Dashboard → Returns 200
9. Check webhook logs for successful event processing
10. Verify database records created for test users/groups

## Error Recovery

### "Missing signature" (401 from webhook)

**Root cause:** WorkOS signature header not found.

**Fix:**
1. Check webhook endpoint URL matches WorkOS Dashboard configuration exactly
2. Verify request passes through without middleware stripping headers
3. Check header name is `workos-signature` (lowercase, with hyphen)

### "Invalid signature" (400 from webhook)

**Root cause:** Signature verification failed.

**Fix:**
1. Verify `WORKOS_WEBHOOK_SECRET` matches value in WorkOS Dashboard
2. Check webhook endpoint reads RAW body (not parsed JSON)
   - Next.js: Disable body parsing or use `await request.text()`
   - Express: Use `express.raw({ type: 'application/json' })`
3. Confirm no middleware modifies request body before verification

### "User already exists" during dsync.user.created

**Root cause:** Duplicate event processing or initial sync collision.

**Fix:**
1. Make user creation idempotent: `INSERT ... ON CONFLICT DO UPDATE`
2. Check `workos_user_id` is unique constraint in database
3. During initial directory sync, you receive events for all existing users — handle gracefully

### "Directory not found" when handling events

**Root cause:** `dsync.activated` event not processed or organization link missing.

**Fix:**
1. Check organization record has `workos_directory_id` populated
2. Verify `dsync.activated` handler ran successfully
3. Re-link directory manually if needed: `UPDATE organizations SET workos_directory_id = 'dir_xxx' WHERE id = 'org_yyy'`

### Webhook timeouts (WorkOS retries)

**Root cause:** Event handler takes >30 seconds.

**Fix:**
1. Process webhooks asynchronously: Queue event, return 200 immediately
2. Use background job system (Bull, Sidekiq, etc.)
3. Optimize database queries in handlers
4. **Pattern:**
   ```typescript
   export async function POST(request: NextRequest) {
     const webhook = await verifyWebhook(request);
     
     // Queue for async processing
     await jobQueue.add('process-dsync-event', { event: webhook });
     
     // Return immediately
     return NextResponse.json({ received: true });
   }
   ```

### "State inactive" handling inconsistency

**Root cause:** Environment-dependent behavior (pre vs post Oct 2023).

**Check environment date:**
1. WorkOS Dashboard → Settings → Environment Details
2. If created after Oct 19, 2023: `state: inactive` users are auto-deleted
3. If created before Oct 19, 2023: `state: inactive` persists, you must handle

**Fix for post-Oct 2023:**
- Treat `dsync.user.updated` with `state: inactive` as soft delete
- Expect eventual `dsync.user.deleted` after retention period
- See: `https://workos.com/docs/directory-sync/handle-inactive-users`

### Missing custom attributes in webhook payload

**Root cause:** Custom attribute mapping not configured in WorkOS Dashboard.

**Fix:**
1. Navigate to Directory Sync → Directory → Attribute Mapping
2. Map custom SCIM attributes to WorkOS schema
3. See: `https://workos.com/docs/directory-sync/attributes`
4. Use `data.custom_attributes` in webhook payload

### "Module not found: @workos-inc/node"

**Root cause:** SDK not installed.

**Fix:**
```bash
npm install @workos-inc/node
# or force reinstall
rm -rf node_modules package-lock.json
npm install
```

## Related Skills

- **workos-sso**: Single Sign-On for user authentication (pairs with Directory Sync for complete user lifecycle)
- **workos-admin-portal**: Self-service directory connection setup for customers
- **workos-audit-logs**: Track directory sync events for compliance
