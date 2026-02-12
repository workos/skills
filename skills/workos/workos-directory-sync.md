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

### Account Setup

Verify WorkOS Dashboard access:

- Navigate to https://dashboard.workos.com/
- Confirm API Keys section is accessible
- Note your environment ID (test vs production)

### Environment Variables

Check for required credentials:

```bash
# Must exist in .env or equivalent
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env || echo "MISSING CREDENTIALS"
```

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** API key has Directory Sync permissions in Dashboard → API Keys → Permissions.

### SDK Installation

Detect package manager and verify SDK:

```bash
# Check if SDK already installed
npm list @workos-inc/node 2>/dev/null || \
pnpm list @workos-inc/node 2>/dev/null || \
yarn list --pattern @workos-inc/node 2>/dev/null
```

If missing, install per detected package manager. SDK must exist before Step 3.

## Step 3: Webhook Endpoint Setup (MANDATORY)

**CRITICAL:** Directory Sync requires webhooks for event delivery. Polling is not supported.

### Decision Tree: Webhook Strategy

```
Do you have an existing webhook endpoint?
  |
  +-- YES --> Extend endpoint to handle dsync.* events (Step 3a)
  |
  +-- NO  --> Create new /webhooks/workos endpoint (Step 3b)
```

### Step 3a: Extend Existing Endpoint

If you have `/webhooks`, `/api/webhooks`, or similar:

1. Add event type handler for `dsync.*` events
2. Preserve existing webhook signature verification
3. Route dsync events to new handler function

### Step 3b: Create New Endpoint

Create endpoint at `/api/webhooks/workos` or `/webhooks/workos`:

**Framework detection:**

```
Framework?
  |
  +-- Express/Node --> app.post('/webhooks/workos', rawBodyParser, handler)
  |
  +-- Next.js 13+  --> app/api/webhooks/workos/route.ts
  |
  +-- Next.js Pages --> pages/api/webhooks/workos.ts
  |
  +-- Django       --> urls.py + views.py webhook view
  |
  +-- Rails        --> routes.rb + webhooks_controller.rb
```

**Endpoint requirements (ALL frameworks):**

1. Accept POST requests with raw body (needed for signature verification)
2. Return 200 OK for successful processing
3. Return 200 OK even if event is ignored (prevents retries)
4. Implement signature verification (see Step 4)
5. Process events idempotently (WorkOS retries on failure)

**Example endpoint structure:**

```javascript
// Pseudocode - adapt to your framework
POST /webhooks/workos
  1. Verify webhook signature
  2. Parse event payload
  3. Route to event-specific handler
  4. Return 200 OK
```

## Step 4: Webhook Signature Verification (REQUIRED)

**CRITICAL:** Do NOT process webhooks without signature verification. This prevents spoofed events.

### Get Webhook Secret

1. Go to Dashboard → Webhooks → Directory Sync
2. Copy webhook secret (starts with `wh_secret_`)
3. Add to environment: `WORKOS_WEBHOOK_SECRET`

### Implement Verification

Use SDK's webhook verification method:

```javascript
// Example - check fetched docs for exact method signature
const payload = request.body; // raw body as string or buffer
const signature = request.headers["workos-signature"];
const secret = process.env.WORKOS_WEBHOOK_SECRET;

// SDK provides verification - check docs for exact import
const event = workos.webhooks.constructEvent(payload, signature, secret);
```

**If verification fails:** Return 400 Bad Request, log attempt, do NOT process event.

**Test verification:**

```bash
# Send test webhook from Dashboard → Webhooks → Send Test Event
# Check logs for successful verification
```

## Step 5: Database Schema Setup

Create tables to mirror Directory Sync entities. Adapt field types to your database:

### directories table

```sql
CREATE TABLE directories (
  id VARCHAR(255) PRIMARY KEY,              -- WorkOS directory ID
  organization_id VARCHAR(255) NOT NULL,    -- Your app's organization ID
  domain VARCHAR(255),
  name VARCHAR(255),
  state VARCHAR(50),                        -- linked, unlinked, invalid_credentials
  type VARCHAR(50),                         -- azure scim v2.0, etc
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(organization_id)                   -- One directory per org
);
```

### directory_users table

```sql
CREATE TABLE directory_users (
  id VARCHAR(255) PRIMARY KEY,              -- WorkOS user ID (starts with directory_user_)
  directory_id VARCHAR(255) NOT NULL,
  idp_id VARCHAR(255),                      -- ID from identity provider
  email VARCHAR(255),
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  state VARCHAR(50),                        -- active, inactive
  custom_attributes JSONB,                  -- Provider-specific fields
  raw_attributes JSONB,                     -- Complete provider payload
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (directory_id) REFERENCES directories(id) ON DELETE CASCADE,
  INDEX(directory_id),
  INDEX(email)
);
```

### directory_groups table

```sql
CREATE TABLE directory_groups (
  id VARCHAR(255) PRIMARY KEY,              -- WorkOS group ID (starts with directory_group_)
  directory_id VARCHAR(255) NOT NULL,
  idp_id VARCHAR(255),                      -- ID from identity provider
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (directory_id) REFERENCES directories(id) ON DELETE CASCADE,
  INDEX(directory_id)
);
```

### directory_group_memberships table

```sql
CREATE TABLE directory_group_memberships (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES directory_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES directory_users(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);
```

**Run migrations before Step 6.**

## Step 6: Event Handler Implementation

### Event Routing

Implement handlers for each event type. Check fetched docs for complete event payloads.

```
Event Type              --> Action
dsync.activated         --> Create/link directory record
dsync.deleted           --> Soft-delete or unlink directory
dsync.user.created      --> Insert user, trigger onboarding
dsync.user.updated      --> Update user fields, check state changes
dsync.user.deleted      --> Hard delete user (rare)
dsync.group.created     --> Insert group
dsync.group.updated     --> Update group name/attributes
dsync.group.deleted     --> Delete group and memberships
dsync.group.user_added  --> Create membership record
dsync.group.user_removed --> Delete membership record
```

### Critical Event Handlers

#### dsync.activated

```javascript
// When customer connects directory
async function handleDirectoryActivated(event) {
  const { id, organization_id, state, name, type, domain } = event.data;

  await db.directories.upsert({
    id,
    organization_id,
    state,
    name,
    type,
    domain,
    updated_at: new Date(),
  });

  // Initial sync: expect dsync.user.created for ALL existing users
  // Do NOT fetch users via API - wait for webhook events
}
```

#### dsync.user.created

```javascript
// When new user provisioned OR during initial sync
async function handleUserCreated(event) {
  const user = event.data;

  await db.directory_users.insert({
    id: user.id,
    directory_id: user.directory_id,
    idp_id: user.idp_id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    state: user.state,
    custom_attributes: user.custom_attributes,
    raw_attributes: user.raw_attributes,
    created_at: new Date(),
  });

  // Optional: Trigger welcome email, create app user record
  if (user.state === "active") {
    await sendWelcomeEmail(user.email);
  }
}
```

#### dsync.user.updated

```javascript
// When user attributes change OR state changes to inactive
async function handleUserUpdated(event) {
  const user = event.data;
  const previous = event.previous_attributes;

  await db.directory_users.update(user.id, {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    state: user.state,
    custom_attributes: user.custom_attributes,
    updated_at: new Date(),
  });

  // State transitions
  if (previous.state === "active" && user.state === "inactive") {
    // Suspend user access
    await suspendUserSessions(user.id);
  }

  if (previous.state === "inactive" && user.state === "active") {
    // Restore user access
    await restoreUserAccess(user.id);
  }
}
```

**CRITICAL:** Most directory providers soft-delete users (state=inactive) rather than sending `dsync.user.deleted`. Handle `state` transitions in `dsync.user.updated`.

#### dsync.user.deleted

```javascript
// Hard deletion (rare - most providers use state=inactive instead)
async function handleUserDeleted(event) {
  const { id } = event.data;

  // Hard delete removes user completely
  await db.directory_users.delete(id);

  // Cascading deletes handle group memberships if schema uses ON DELETE CASCADE
}
```

**Note:** As of Oct 19, 2023, new WorkOS environments auto-delete inactive users. Check fetched docs for current behavior.

#### dsync.group.user_added

```javascript
// When user assigned to group
async function handleGroupUserAdded(event) {
  const { group, user } = event.data;

  await db.directory_group_memberships.insert({
    group_id: group.id,
    user_id: user.id,
    created_at: new Date(),
  });

  // Optional: Grant role/permissions based on group
  await applyGroupPermissions(user.id, group.id);
}
```

#### dsync.deleted

```javascript
// When directory connection torn down
async function handleDirectoryDeleted(event) {
  const { id } = event.data;

  // Ignore event.data.state - directory is already deleted

  // Cascade deletes users and groups
  await db.directories.delete(id);

  // Alternative: Soft delete
  // await db.directories.update(id, { deleted_at: new Date() });
}
```

**CRITICAL:** When `dsync.deleted` is received, WorkOS has already deleted users and groups. You will NOT receive individual `dsync.user.deleted` or `dsync.group.deleted` events. Process the directory deletion accordingly.

### Idempotency

WorkOS retries failed webhooks. Handlers MUST be idempotent:

```javascript
// Use upsert operations
await db.directory_users.upsert({ id: user.id }, user);

// Or check existence
const exists = await db.directory_users.findById(user.id);
if (!exists) {
  await db.directory_users.insert(user);
}
```

## Step 7: Configure Webhook in Dashboard

1. Go to Dashboard → Webhooks → Endpoints
2. Click "Add Endpoint"
3. Enter webhook URL: `https://yourdomain.com/api/webhooks/workos`
4. Select event types:
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
5. Save endpoint
6. Copy webhook secret to `WORKOS_WEBHOOK_SECRET`

**Test webhook:**

Dashboard → Webhooks → Send Test Event → Select dsync event type → Send

Check application logs for received event.

## Step 8: Directory Connection Setup

### Decision Tree: Setup Method

```
Who configures directory connection?
  |
  +-- Your team      --> Use Dashboard (Step 8a)
  |
  +-- Customer admin --> Use Admin Portal (Step 8b)
```

### Step 8a: Dashboard Setup (Internal)

Use for testing or if you manage customer directories:

1. Dashboard → Directory Sync → Directories
2. Click "Create Directory"
3. Select provider (Okta, Azure AD, Google Workspace, etc.)
4. Enter organization ID (your app's organization identifier)
5. Follow provider-specific setup:
   - **SCIM:** Copy SCIM endpoint URL + bearer token, configure in provider
   - **LDAP:** Enter credentials
   - **Google Workspace:** OAuth flow
   - **Azure AD:** OAuth + API permissions
6. Test connection in Dashboard

Check fetched docs for provider-specific setup guides.

### Step 8b: Admin Portal Setup (Customer Self-Service)

For production deployments where customers configure their own directories:

1. Generate Admin Portal link for organization:

```javascript
const { link } = await workos.portal.generateLink({
  organization: "org_123",
  intent: "dsync",
  return_url: "https://yourdomain.com/settings/directory",
});

// Redirect customer to link
```

2. Customer completes provider-specific setup
3. On success, `dsync.activated` event fires → Step 6 handler processes

Check fetched docs for Admin Portal integration details.

## Step 9: Attribute Mapping (Optional)

Directory Sync provides standard attributes (email, first_name, last_name, username). Custom attributes require mapping.

### Decision Tree: Attribute Needs

```
Do you need provider-specific attributes (department, manager, phone)?
  |
  +-- NO  --> Use standard attributes only (skip this step)
  |
  +-- YES --> Configure attribute mapping
      |
      +-- Auto-mapped  --> Check fetched docs for supported auto-maps
      |
      +-- Custom-mapped --> Configure in Dashboard per directory
```

### Custom Attribute Mapping

1. Dashboard → Directory Sync → Select Directory → Attributes
2. Add custom mappings:
   - Source field: `department` (provider's attribute name)
   - Destination field: `department` (your app's field name)
3. Attributes appear in `user.custom_attributes` object in webhooks

**Access custom attributes:**

```javascript
const user = event.data;
const department = user.custom_attributes?.department;
```

Check fetched docs for complete list of auto-mapped attributes by provider.

## Step 10: Inactive User Handling

**CRITICAL:** Understand your WorkOS environment's inactive user policy.

### Environment Behavior

```
Environment created WHEN?
  |
  +-- After Oct 19, 2023  --> Inactive users AUTO-DELETED after period
  |
  +-- Before Oct 19, 2023 --> Inactive users RETAINED (legacy behavior)
```

Check Dashboard → Settings → Directory Sync → Inactive User Policy.

### Handler Pattern

```javascript
async function handleUserUpdated(event) {
  const user = event.data;

  if (user.state === "inactive") {
    // If auto-delete enabled: user will be deleted soon
    // Suspend access immediately, expect dsync.user.deleted
    await suspendUserAccess(user.id);
  }

  // If auto-delete disabled: handle inactive state indefinitely
  // Mark as suspended but retain user record
}
```

Check fetched docs for configuring inactive user retention if needed.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check webhook endpoint exists
curl -X POST https://yourdomain.com/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{}' | grep -q "200\|400" && echo "PASS: Endpoint exists" || echo "FAIL: Endpoint missing"

# 2. Check environment variables
env | grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID|WORKOS_WEBHOOK_SECRET" | wc -l | grep -q 3 && echo "PASS: Credentials configured" || echo "FAIL: Missing credentials"

# 3. Check database tables exist
psql $DATABASE_URL -c "\dt" | grep -E "directories|directory_users|directory_groups" | wc -l | grep -q 3 && echo "PASS: Schema migrated" || echo "FAIL: Missing tables"

# 4. Verify webhook secret format
echo $WORKOS_WEBHOOK_SECRET | grep -q "^wh_secret_" && echo "PASS: Valid webhook secret" || echo "FAIL: Invalid secret format"

# 5. Check SDK installed
npm list @workos-inc/node 2>/dev/null | grep -q "@workos-inc/node" && echo "PASS: SDK installed" || echo "FAIL: SDK missing"
```

**Manual verification steps:**

1. Dashboard → Webhooks → Send test `dsync.user.created` event
2. Check application logs for received event
3. Check database for inserted test user record
4. Dashboard → Webhooks → Event Logs → Verify 200 OK response

**All checks must pass before marking integration complete.**

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Signature mismatch or expired timestamp.

Fix:

1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard → Webhooks → Endpoint Secret
2. Check webhook secret has no whitespace/newlines: `echo -n $WORKOS_WEBHOOK_SECRET | wc -c`
3. Verify raw body passed to verification (not parsed JSON)
4. Check server clock skew: `date -u` vs WorkOS timestamp (max 5 min difference)

### "Webhook returns 500, WorkOS retries endlessly"

**Root cause:** Handler crashes instead of returning 200.

Fix:

1. Wrap handler in try-catch, always return 200
2. Log errors to monitoring system, don't crash
3. For unrecoverable errors, return 200 and alert
4. Check Dashboard → Webhooks → Event Logs for stack traces

Example pattern:

```javascript
try {
  await handleEvent(event);
  return { status: 200 };
} catch (error) {
  logger.error("Webhook handler failed", { event, error });
  // Still return 200 to stop retries
  return { status: 200 };
}
```

### "dsync.user.created events missing during initial sync"

**Root cause:** Webhook endpoint configured AFTER directory connection established.

Fix:

1. Delete and recreate directory connection in Dashboard
2. OR use WorkOS API to manually fetch users:

```javascript
const users = await workos.directorySync.listUsers({
  directory: "directory_123",
});

// Process users as if they came from webhooks
for (const user of users.data) {
  await handleUserCreated({ data: user });
}
```

### "Duplicate user records created"

**Root cause:** Non-idempotent handler or race condition.

Fix:

1. Use upsert operations: `INSERT ... ON CONFLICT UPDATE`
2. Add unique constraint on `directory_users.id`
3. Check for existence before insert
4. Use database transactions for multi-step operations

### "User state stuck as inactive, can't log in"

**Root cause:** Application not checking `state` field during auth.

Fix:

1. Add state check to login flow:

```javascript
const directoryUser = await db.directory_users.findByEmail(email);
if (directoryUser && directoryUser.state === "inactive") {
  throw new Error("Account is inactive");
}
```

2. Update `dsync.user.updated` handler to suspend sessions immediately
3. Check WorkOS environment's inactive user auto-delete setting

### "Can't find directory for organization"

**Root cause:** Directory not linked to organization, or `dsync.activated` not processed.

Fix:

1. Check webhook logs for `dsync.activated` event delivery
2. Verify `dsync.activated` handler inserts directory record
3. Check `directories.organization_id` matches your app's org ID
4. Manually link in Dashboard → Directories → Edit → Organization ID

### "Custom attributes empty"

**Root cause:** Attribute mapping not configured, or provider doesn't send attribute.

Fix:

1. Dashboard → Directory Sync → Select Directory → Attributes → Add mappings
2. Check provider's directory schema for attribute name (case-sensitive)
3. Verify provider actually populates the attribute (some fields may be null)
4. Check `user.raw_attributes` for complete provider payload

### "Groups not syncing"

**Root cause:** Provider doesn't support group sync, or group sync not enabled.

Fix:

1. Check fetched docs for provider's group sync support
2. Dashboard → Directory → Settings → Enable group sync
3. Verify webhook endpoint subscribes to `dsync.group.*` events
4. Check provider's directory has groups assigned to app

## Related Skills

- workos-authkit-nextjs: Combine SSO with Directory Sync for complete user lifecycle
- workos-authkit-react: Client-side auth patterns for directory-synced users
