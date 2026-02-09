---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:70f7214d7bc1 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for the latest implementation details:

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:**
```bash
grep -E "WORKOS_API_KEY=sk_" .env* || echo "FAIL: Missing or invalid WORKOS_API_KEY"
grep -E "WORKOS_CLIENT_ID=client_" .env* || echo "FAIL: Missing or invalid WORKOS_CLIENT_ID"
```

### SDK Installation

Check WorkOS SDK is installed:

```bash
# Node.js
grep "@workos-inc/node" package.json || echo "SDK not found"

# Python
pip show workos || echo "SDK not found"

# Ruby
bundle show workos || echo "SDK not found"
```

If missing, install SDK for your runtime. See Quick Start docs for package manager command.

## Step 3: Webhook Infrastructure (REQUIRED)

**CRITICAL:** Directory Sync delivers events via webhooks. You MUST implement a webhook endpoint — polling is not supported.

Reference: https://workos.com/docs/directory-sync/understanding-events

### Create Webhook Endpoint

Create a POST endpoint to receive Directory Sync events:

```
Framework          --> Route location
Express/Node       --> app.post('/webhooks/workos', ...)
Next.js App Router --> app/api/webhooks/workos/route.ts
Django             --> urls.py + views.py handler
Rails              --> config/routes.rb + controller
```

**Pattern:**

1. Receive POST request with event JSON
2. Verify webhook signature (see WorkOS SDK docs for signature verification)
3. Parse `event.type` to determine event handler
4. Return 200 OK quickly (process async if needed)

### Register Webhook in Dashboard

1. Navigate to WorkOS Dashboard → Webhooks
2. Add endpoint URL: `https://yourdomain.com/webhooks/workos`
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
4. Copy webhook secret for signature verification

**Verify endpoint is reachable:**
```bash
curl -X POST https://yourdomain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 200 or 201
```

## Step 4: Database Schema (Decision Tree)

Determine your directory data model:

```
Use case?
  |
  +-- User provisioning only --> Users table with directory_id
  |
  +-- Group-based access control --> Users + Groups + Memberships tables
  |
  +-- Role assignment --> Add roles/custom_attributes to Users
```

### Minimal Schema (User Provisioning)

```sql
-- Users table
CREATE TABLE users (
  id PRIMARY KEY,
  directory_id VARCHAR,           -- WorkOS directory ID
  directory_user_id VARCHAR,      -- WorkOS user ID
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  state VARCHAR,                  -- 'active' or 'inactive'
  raw_attributes JSONB,           -- Store full event payload
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_users_directory ON users(directory_id);
CREATE INDEX idx_users_directory_user ON users(directory_user_id);
```

### Extended Schema (Groups + Roles)

Add if handling group events:

```sql
CREATE TABLE groups (
  id PRIMARY KEY,
  directory_id VARCHAR,
  directory_group_id VARCHAR,
  name VARCHAR,
  raw_attributes JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE group_memberships (
  user_id REFERENCES users(id),
  group_id REFERENCES groups(id),
  PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_groups_directory ON groups(directory_id);
```

## Step 5: Event Handler Implementation

Implement handlers for each event type. Reference Understanding Events docs for payload structure.

### Event Type Router

```
Incoming webhook POST
  |
  +-- Parse event.type
  |
  +-- dsync.activated       --> Save directory_id, associate with organization
  |
  +-- dsync.deleted         --> Remove directory association, mark users deleted
  |
  +-- dsync.user.created    --> INSERT user record
  |
  +-- dsync.user.updated    --> UPDATE user record (check previous_attributes)
  |
  +-- dsync.user.deleted    --> DELETE or soft-delete user
  |
  +-- dsync.group.created   --> INSERT group record
  |
  +-- dsync.group.updated   --> UPDATE group record
  |
  +-- dsync.group.deleted   --> DELETE group, remove memberships
  |
  +-- dsync.group.user_added    --> INSERT group_membership
  |
  +-- dsync.group.user_removed  --> DELETE group_membership
```

### Critical Event: `dsync.activated`

```
When: Directory connection is established
Action: Save directory_id, link to organization
Payload fields:
  - event.data.id (directory_id)
  - event.data.organization_id
  - event.data.state ('linked')
```

**Implementation:**
```javascript
// Example - adapt to your stack
async function handleDsyncActivated(event) {
  const { id: directoryId, organization_id } = event.data;
  
  await db.organizations.update({
    where: { id: organization_id },
    data: { directory_id: directoryId }
  });
}
```

### Critical Event: `dsync.user.created`

```
When: New user provisioned OR initial directory sync
Action: Create user record
Payload fields:
  - event.data.id (directory_user_id)
  - event.data.directory_id
  - event.data.emails (array)
  - event.data.first_name
  - event.data.last_name
  - event.data.state ('active')
  - event.data.custom_attributes (if configured)
```

**Implementation:**
```javascript
async function handleUserCreated(event) {
  const user = event.data;
  
  await db.users.create({
    directory_id: user.directory_id,
    directory_user_id: user.id,
    email: user.emails[0]?.value,  // Primary email
    first_name: user.first_name,
    last_name: user.last_name,
    state: user.state,
    raw_attributes: user.custom_attributes || {}
  });
}
```

### Critical Event: `dsync.user.updated`

```
When: User attributes change OR user marked inactive
Action: Update user record, check for soft deletion
Payload fields:
  - event.data.previous_attributes (changes only)
  - event.data.state (check for 'inactive')
```

**IMPORTANT:** Most directory providers use soft deletion (`state: 'inactive'`) instead of hard deletion. Check `event.data.state` and handle accordingly.

**Implementation:**
```javascript
async function handleUserUpdated(event) {
  const user = event.data;
  const changes = event.data.previous_attributes || {};
  
  // Check if user was deactivated
  if (user.state === 'inactive' && changes.state === 'active') {
    // Soft delete: disable access but retain record
    await db.users.update({
      where: { directory_user_id: user.id },
      data: { 
        state: 'inactive',
        deactivated_at: new Date()
      }
    });
    return;
  }
  
  // Normal attribute update
  await db.users.update({
    where: { directory_user_id: user.id },
    data: {
      email: user.emails[0]?.value,
      first_name: user.first_name,
      last_name: user.last_name,
      state: user.state,
      raw_attributes: user.custom_attributes || {}
    }
  });
}
```

### Critical Event: `dsync.deleted`

```
When: Directory connection is removed
Action: Remove all users/groups for directory
```

**IMPORTANT:** When `dsync.deleted` fires, individual `dsync.user.deleted` and `dsync.group.deleted` events are NOT sent. You must handle bulk cleanup.

**Implementation:**
```javascript
async function handleDsyncDeleted(event) {
  const directoryId = event.data.id;
  
  // Cascade delete or soft-delete all users
  await db.users.deleteMany({
    where: { directory_id: directoryId }
  });
  
  await db.groups.deleteMany({
    where: { directory_id: directoryId }
  });
  
  // Remove directory association
  await db.organizations.update({
    where: { directory_id: directoryId },
    data: { directory_id: null }
  });
}
```

## Step 6: Inactive User Handling (Decision Point)

**Environment-dependent behavior:** After October 19, 2023, new WorkOS environments automatically delete users marked `inactive`. Check your environment settings.

Reference: https://workos.com/docs/directory-sync/handle-inactive-users

```
Environment configuration?
  |
  +-- Auto-delete inactive users (new environments)
  |     --> You will receive dsync.user.deleted
  |     --> Hard delete user from your DB
  |
  +-- Retain inactive users (legacy or custom config)
        --> You will receive dsync.user.updated with state='inactive'
        --> Soft delete (disable access, keep record)
```

**Verify your environment setting:**
1. Check WorkOS Dashboard → Environment Settings → Directory Sync
2. Look for "Inactive User Handling" configuration

If auto-delete is enabled, implement `dsync.user.deleted` handler:

```javascript
async function handleUserDeleted(event) {
  const userId = event.data.id;
  
  await db.users.delete({
    where: { directory_user_id: userId }
  });
}
```

## Step 7: Custom Attributes (Optional)

If using role assignment or custom user attributes, configure attribute mapping in WorkOS Dashboard.

Reference: https://workos.com/docs/directory-sync/attributes

**Decision tree:**

```
Need custom attributes?
  |
  +-- No --> Skip this step
  |
  +-- Yes --> Map in Dashboard
        |
        +-- Auto-mapped (standard IdP fields) --> Enable in Dashboard
        |
        +-- Custom-mapped (non-standard) --> Configure mapping rules
```

Custom attributes appear in `event.data.custom_attributes` as key-value pairs.

**Example payload with custom attributes:**
```json
{
  "event": "dsync.user.created",
  "data": {
    "id": "directory_user_01H...",
    "custom_attributes": {
      "department": "Engineering",
      "role": "admin",
      "manager_email": "manager@example.com"
    }
  }
}
```

Store these in `raw_attributes` JSONB column or dedicated columns depending on your schema.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Webhook endpoint exists
grep -r "webhooks/workos" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" || echo "FAIL: No webhook route found"

# 2. Environment variables configured
grep -E "WORKOS_API_KEY=sk_" .env* && grep -E "WORKOS_CLIENT_ID=client_" .env* || echo "FAIL: Missing env vars"

# 3. Database schema exists (adjust for your DB)
# PostgreSQL example:
psql -d your_db -c "\d users" | grep directory_id || echo "FAIL: Missing users.directory_id column"

# 4. Webhook endpoint reachable (replace with your URL)
curl -X POST https://yourdomain.com/webhooks/workos -H "Content-Type: application/json" -d '{"test":true}' -w "\n%{http_code}\n" | grep -E "200|201" || echo "FAIL: Webhook endpoint not accessible"

# 5. Event handlers implemented (check for key functions)
grep -r "dsync.user.created" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" || echo "FAIL: Missing user.created handler"
grep -r "dsync.user.updated" . --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" || echo "FAIL: Missing user.updated handler"

# 6. Application builds
npm run build || echo "FAIL: Build failed"
```

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Incorrect webhook secret or missing signature verification.

**Fix:**
1. Copy webhook secret from WorkOS Dashboard → Webhooks → Your Endpoint
2. Use SDK's signature verification function (check SDK docs for method name)
3. Ensure raw request body is used for verification (not parsed JSON)

Example signature verification (Node.js SDK):
```javascript
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const payload = request.body;
const signature = request.headers['workos-signature'];
const secret = process.env.WORKOS_WEBHOOK_SECRET;

const event = workos.webhooks.constructEvent({
  payload,
  signature,
  secret
});
```

### "Duplicate user creation" or "Unique constraint violation"

**Root cause:** Race condition during initial sync or replay of events.

**Fix:**
1. Use `UPSERT` (INSERT ... ON CONFLICT UPDATE) instead of INSERT
2. Make `directory_user_id` a unique constraint
3. Check if user exists before creating

```javascript
// Idempotent user creation
await db.users.upsert({
  where: { directory_user_id: user.id },
  create: { /* user data */ },
  update: { /* user data */ }
});
```

### "Event order issues" (group before users)

**Root cause:** Webhooks are delivered asynchronously; order not guaranteed.

**Fix:**
1. Handle missing foreign keys gracefully (retry or skip)
2. For groups, check if referenced users exist; create placeholders if needed
3. Process events idempotently so replays are safe

### "Missing custom_attributes in payload"

**Root cause:** Custom attribute mapping not configured in WorkOS Dashboard.

**Fix:**
1. Go to WorkOS Dashboard → Directory Sync → Directory → Attributes tab
2. Configure attribute mapping for your directory provider
3. Re-sync directory or wait for next update event

### "Directory deleted but users remain"

**Root cause:** Not handling `dsync.deleted` event correctly.

**Fix:**
1. Implement bulk cleanup in `dsync.deleted` handler (see Step 5)
2. Use `directory_id` foreign key to cascade delete related records
3. **Remember:** Individual user/group deleted events are NOT sent when directory is deleted

### "Inactive users still have access"

**Root cause:** Not checking `state` field in authorization logic.

**Fix:**
1. Add `WHERE state = 'active'` to user lookup queries
2. In `dsync.user.updated` handler, revoke sessions when `state` changes to `inactive`
3. Check WorkOS environment setting for auto-delete behavior

## Related Skills

- **workos-sso**: Single Sign-On configuration for directory users
- **workos-admin-portal**: Self-service directory connection setup
- **workos-webhooks**: General webhook setup and signature verification patterns
