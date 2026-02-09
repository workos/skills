---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:70f7214d7bc1 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify now:**

```bash
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null
```

If missing, stop and configure in WorkOS Dashboard first.

### Project Structure

Confirm workspace has:

- A web server framework (Express, Next.js, Django, Rails, etc.)
- WorkOS SDK installed (check `package.json`, `requirements.txt`, `Gemfile`, etc.)

## Step 3: Webhook Infrastructure (MANDATORY)

**CRITICAL:** Directory Sync requires webhooks for event delivery. Polling is NOT supported.

Reference: https://workos.com/docs/directory-sync/understanding-events

### Create Webhook Endpoint

Determine webhook path based on framework:

```
Framework          --> Recommended path
Express/Node       --> POST /webhooks/workos
Next.js            --> app/api/webhooks/workos/route.ts (App Router)
                   --> pages/api/webhooks/workos.ts (Pages Router)
Django             --> /webhooks/workos/ (add to urls.py)
Rails              --> POST /webhooks/workos (add to routes.rb)
```

**Endpoint requirements:**

1. Accept POST requests
2. Return 200 OK within 30 seconds (WorkOS timeout)
3. Verify webhook signature (see Step 4)
4. Process asynchronously if event handling takes >5 seconds

### Configure Webhook in WorkOS Dashboard

1. Navigate to: https://dashboard.workos.com/webhooks
2. Add webhook URL: `https://yourdomain.com/webhooks/workos`
3. Select Directory Sync events:
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
4. Save webhook secret for signature verification (starts with `whsec_`)

**Verify endpoint is reachable:**

```bash
curl -X POST https://yourdomain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Should return 200 or 40x (not connection refused).

## Step 4: Webhook Signature Verification

**CRITICAL:** Always verify webhook signatures before processing events.

WebFetch your SDK's documentation for exact signature verification method. Pattern:

```
SDK method pattern:
- Node: WorkOS.webhooks.constructEvent(payload, signature, secret)
- Python: workos.webhooks.verify_event(payload, signature, secret)
- Ruby: WorkOS::Webhooks.verify_event(payload, signature, secret)
```

Get signature from request headers:

- `WorkOS-Signature` header contains the signature
- `WorkOS-Timestamp` header contains the timestamp (for replay protection)

**Example verification flow:**

1. Read raw request body (do NOT parse JSON first)
2. Extract `WorkOS-Signature` header
3. Call SDK verification method with (body, signature, webhook_secret)
4. If verification fails, return 401 Unauthorized and log the attempt
5. If verification passes, parse JSON and process event

## Step 5: Database Schema Setup

### Organizations Table

If not exists, create table to track customer organizations:

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  workos_directory_id VARCHAR(255), -- Links to Directory Sync
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_workos_directory_id ON organizations(workos_directory_id);
```

### Users Table

Modify or create users table with Directory Sync fields:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  workos_directory_user_id VARCHAR(255), -- From dsync.user.* events
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  state VARCHAR(50), -- 'active' or 'inactive'
  raw_attributes JSONB, -- Store full directory user object
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_workos_directory_user_id ON users(workos_directory_user_id);
CREATE INDEX idx_organization_state ON users(organization_id, state);
```

### Groups Table (Optional)

If using group-based permissions:

```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  workos_directory_group_id VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE group_memberships (
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  PRIMARY KEY (user_id, group_id)
);
```

## Step 6: Event Handler Implementation (Decision Tree)

```
Webhook event received
  |
  +-- dsync.activated
  |     --> Save directory_id to organization
  |     --> Start initial sync (all users/groups will follow)
  |
  +-- dsync.deleted
  |     --> Mark organization directory as deleted
  |     --> Deprovision all users from directory (optional)
  |
  +-- dsync.user.created
  |     --> INSERT user into database
  |     --> Send welcome email (optional)
  |
  +-- dsync.user.updated
  |     --> UPDATE user attributes
  |     --> Check if state changed to 'inactive'
  |           --> If inactive: Suspend user access
  |
  +-- dsync.user.deleted
  |     --> DELETE user OR mark as deleted
  |     --> Revoke all sessions
  |
  +-- dsync.group.created
  |     --> INSERT group into database
  |
  +-- dsync.group.updated
  |     --> UPDATE group attributes
  |
  +-- dsync.group.deleted
  |     --> DELETE group
  |     --> Remove group memberships
  |
  +-- dsync.group.user_added
  |     --> INSERT into group_memberships
  |     --> Grant group permissions to user
  |
  +-- dsync.group.user_removed
        --> DELETE from group_memberships
        --> Revoke group permissions from user
```

### Critical Event Handling Rules

**Inactive User Handling:**

After Oct 19, 2023, WorkOS automatically deletes inactive users. If you need to retain them, contact WorkOS support.

Reference: https://workos.com/docs/directory-sync/handle-inactive-users

Most providers soft-delete users (mark as `inactive`) rather than sending `dsync.user.deleted`. Handle both patterns:

```
User removal?
  |
  +-- dsync.user.updated with state='inactive'
  |     --> Most common (Azure AD, Okta, Google)
  |     --> Suspend user access but retain data
  |
  +-- dsync.user.deleted
        --> Hard deletion
        --> Remove user completely
```

**Initial Sync Pattern:**

When `dsync.activated` fires, expect rapid burst of events:

1. `dsync.activated` (once)
2. `dsync.user.created` (for every existing user)
3. `dsync.group.created` (for every existing group)
4. `dsync.group.user_added` (for every membership)

Process events idempotently — use `workos_directory_user_id` as unique key.

**Event Order Guarantee:**

WorkOS processes users before groups. Typical order:

1. `dsync.user.created` for user A
2. `dsync.group.created` for group X
3. `dsync.group.user_added` for A → X

Handle out-of-order delivery gracefully (retry if user not found on `group.user_added`).

## Step 7: Implement Webhook Handler Code

WebFetch your SDK docs for current method names. General pattern:

```
Webhook handler pseudocode:
1. Verify signature (Step 4)
2. Parse event JSON
3. Extract event.type and event.data
4. Switch on event type → call appropriate handler
5. Return 200 OK (even if handler fails — retry logic is async)
```

**Error Handling Pattern:**

```
Event processing fails?
  |
  +-- Signature invalid
  |     --> Return 401 immediately, log attack attempt
  |
  +-- Database error
  |     --> Log error, return 200 to prevent retries
  |     --> Queue for manual review
  |
  +-- Transient error (timeout, lock)
        --> Return 500 to trigger WorkOS retry
        --> WorkOS retries with exponential backoff
```

WorkOS retries failed webhooks for 3 days with exponential backoff.

## Step 8: Directory Connection Setup

### Via Admin Portal (Customer Self-Service)

1. Enable Admin Portal in WorkOS Dashboard
2. Customer navigates to Admin Portal URL
3. Customer configures directory provider (Azure AD, Okta, Google Workspace, etc.)
4. You receive `dsync.activated` webhook

Reference: https://workos.com/docs/admin-portal

### Via API (Programmatic Setup)

WebFetch: https://workos.com/docs/directory-sync/quick-start for API setup flow.

You create directory connection via API, customer completes setup in their provider.

## Step 9: Testing Strategy

### Local Testing with ngrok

```bash
# 1. Start ngrok tunnel
ngrok http 3000

# 2. Copy HTTPS URL (e.g., https://abc123.ngrok.io)

# 3. Add to WorkOS Dashboard webhooks:
#    https://abc123.ngrok.io/webhooks/workos

# 4. Trigger test event from Dashboard
```

**Test event checklist:**

- [ ] Signature verification passes
- [ ] `dsync.user.created` creates user in database
- [ ] `dsync.user.updated` with `state: inactive` suspends user
- [ ] `dsync.group.user_added` adds group membership
- [ ] Invalid signature returns 401

### Staging Environment Testing

Set up test directory in WorkOS Dashboard:

1. Create test organization
2. Add test directory (use SCIM simulator or real test tenant)
3. Add test users and groups
4. Verify events arrive at staging webhook URL

**Verify database state after initial sync:**

```bash
# Count users synced
psql -c "SELECT COUNT(*) FROM users WHERE organization_id = 'test-org-id'"

# Count groups synced
psql -c "SELECT COUNT(*) FROM groups WHERE organization_id = 'test-org-id'"

# Verify group memberships
psql -c "SELECT COUNT(*) FROM group_memberships"
```

## Step 10: Monitoring and Observability

### Webhook Delivery Monitoring

Check WorkOS Dashboard → Webhooks → Delivery Logs for:

- Failed deliveries (non-200 responses)
- Slow responses (>5 seconds)
- Signature verification failures

**Set up alerts for:**

- Webhook endpoint returning 500 for >5 minutes
- More than 10 signature verification failures per hour
- Webhook processing time >10 seconds

### Event Processing Metrics

Track these metrics in your application:

```
Metric                                    Alert threshold
dsync.user.created processing time        > 5 seconds
Failed user provisioning count            > 5 per hour
Inactive user suspension errors           > 0 (critical)
Webhook queue depth                       > 1000 events
```

## Verification Checklist (ALL MUST PASS)

Run these commands before marking complete:

```bash
# 1. Verify webhook endpoint exists
curl -X POST http://localhost:3000/webhooks/workos -v 2>&1 | grep "HTTP/1.1"

# 2. Verify database schema
psql -c "\d users" | grep workos_directory_user_id
psql -c "\d organizations" | grep workos_directory_id

# 3. Verify environment variables set
env | grep WORKOS_API_KEY
env | grep WORKOS_WEBHOOK_SECRET || echo "WARNING: Webhook secret missing"

# 4. Verify SDK installed
# Node.js:
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
# Python:
pip show workos 2>/dev/null || echo "FAIL: SDK not installed"

# 5. Test webhook signature verification
# (Run a test event from WorkOS Dashboard and check logs)
```

**Production readiness checklist:**

- [ ] Webhook signature verification is implemented
- [ ] Webhook endpoint is publicly accessible (not localhost)
- [ ] Database indexes exist on `workos_directory_user_id` and `workos_directory_id`
- [ ] Event processing is idempotent (duplicate events don't cause errors)
- [ ] Inactive user handling is tested (see Step 6)
- [ ] Monitoring and alerts are configured
- [ ] Error recovery handles transient failures (returns 500 for retry)

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Signature mismatch or replay attack.

**Fix:**

1. Verify webhook secret matches WorkOS Dashboard value (starts with `whsec_`)
2. Check you're using raw request body, not parsed JSON
3. Verify timestamp tolerance (default 5 minutes) — clock skew may cause issues
4. Check SDK signature verification method signature (see WebFetch docs)

**Test signature verification:**

```bash
# Generate test signature (Node.js example)
node -e "
const crypto = require('crypto');
const payload = '{\"test\":true}';
const secret = 'whsec_your_secret_here';
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(signature);
"
```

### "User not found on group.user_added event"

**Root cause:** Events arrived out of order, or user creation failed.

**Fix:**

1. Check database for user with matching `workos_directory_user_id`
2. If missing, log error and queue for retry (user might be in next event batch)
3. Implement retry logic: Re-check for user after 30 seconds
4. If user never arrives, contact WorkOS support with directory ID

### "Database constraint violation on user insert"

**Root cause:** Duplicate `dsync.user.created` event or initial sync race condition.

**Fix:**

1. Implement upsert logic: `INSERT ... ON CONFLICT (workos_directory_user_id) DO UPDATE`
2. Or check if user exists before insert: `SELECT ... WHERE workos_directory_user_id = ?`
3. Return 200 OK even on constraint violation (event already processed)

### "Webhook timeout after 30 seconds"

**Root cause:** Event processing is blocking webhook response.

**Fix:**

1. Acknowledge webhook immediately: Return 200 OK in <100ms
2. Queue event processing asynchronously (job queue, background worker)
3. Pattern: Webhook handler writes to queue, worker processes events

**Example async pattern:**

```
Webhook handler:
1. Verify signature
2. Write event to job queue (Redis, SQS, Postgres queue table)
3. Return 200 OK

Background worker:
1. Read from job queue
2. Process event (database writes, API calls)
3. Mark job complete
```

### "Initial sync creates duplicate users"

**Root cause:** Multiple `dsync.user.created` events for same user, or initial sync replayed.

**Fix:**

1. Use `workos_directory_user_id` as unique constraint (not email)
2. Implement idempotent handlers: Check if user exists before creating
3. If you manually trigger sync, expect duplicate events — handle gracefully

### "Events stop arriving after directory connection"

**Root cause:** Webhook endpoint is down, or WorkOS paused deliveries after repeated failures.

**Fix:**

1. Check WorkOS Dashboard → Webhooks → Delivery Logs for failure reason
2. Verify webhook endpoint is accessible: `curl -X POST https://yourdomain.com/webhooks/workos`
3. If endpoint was down >3 days, events are lost — trigger manual sync via API
4. Contact WorkOS support to resume webhook deliveries if paused

**Manual sync via API:**

WebFetch: https://workos.com/docs/reference/directory-sync for list users/groups endpoints.

## Related Skills

- **workos-sso**: Single Sign-On integration (often used with Directory Sync)
- **workos-admin-portal**: Customer self-service directory configuration
- **workos-events**: General webhook event handling patterns
- **workos-api-directory-sync**: API reference for manual directory operations
