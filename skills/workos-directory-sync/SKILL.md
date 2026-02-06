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
2. `https://workos.com/docs/directory-sync/index`
3. `https://workos.com/docs/directory-sync/understanding-events`
4. `https://workos.com/docs/directory-sync/handle-inactive-users`
5. `https://workos.com/docs/directory-sync/attributes`
6. `https://workos.com/docs/directory-sync/identity-provider-role-assignment`
7. `https://workos.com/docs/directory-sync/example-apps`

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_WEBHOOK_SECRET` - provided by WorkOS Dashboard (required for event verification)

### WorkOS Dashboard Setup

Confirm in WorkOS Dashboard before coding:

1. Directory connection exists for test organization
2. Webhook endpoint is registered (you'll create this in Step 5)
3. Directory events are enabled in webhook settings

### Project Detection

```bash
# Detect project type
ls package.json 2>/dev/null && echo "Node.js project" || echo "Check for other runtime"

# Check SDK installation
grep -E "@workos-inc/node|workos" package.json || echo "SDK not found"
```

## Step 3: Install SDK (If Missing)

Detect package manager from lockfile:

```
Lockfile present?
  |
  +-- package-lock.json  --> npm install @workos-inc/node
  |
  +-- yarn.lock          --> yarn add @workos-inc/node
  |
  +-- pnpm-lock.yaml     --> pnpm add @workos-inc/node
  |
  +-- bun.lockb          --> bun add @workos-inc/node
```

**Verify:** Run `ls node_modules/@workos-inc/node` before continuing.

## Step 4: Initialize SDK Client

Create SDK client module (e.g., `lib/workos.ts` or `utils/workos.ts`):

```typescript
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Critical:** Never hardcode API key. Always use environment variable.

**Verify:** Import this module in another file without errors.

## Step 5: Create Webhook Endpoint

Webhooks are **mandatory** for Directory Sync — you cannot poll for events.

### Framework Detection

```
Framework?
  |
  +-- Next.js (app/) --> Create app/api/webhooks/workos/route.ts
  |
  +-- Next.js (pages/) --> Create pages/api/webhooks/workos.ts
  |
  +-- Express --> Add POST /webhooks/workos route
  |
  +-- Fastify --> Add POST /webhooks/workos route
  |
  +-- Other --> Create POST endpoint at /webhooks/workos
```

### Webhook Implementation Pattern

**Critical security steps:**

1. **Verify signature** using `WORKOS_WEBHOOK_SECRET` — reject unsigned requests
2. **Parse event payload** from request body
3. **Handle idempotently** — same event may arrive multiple times
4. **Return 200 immediately** — process async if needed

Example structure (adapt to your framework):

```typescript
import { workos } from '@/lib/workos';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('workos-signature');

  // 1. CRITICAL: Verify webhook signature
  let event;
  try {
    event = workos.webhooks.constructEvent({
      payload,
      signature,
      secret: process.env.WORKOS_WEBHOOK_SECRET!,
    });
  } catch (err) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 2. Route event to handler
  await handleDirectorySyncEvent(event);

  // 3. Return 200 immediately
  return new Response('OK', { status: 200 });
}
```

**If signature verification fails:** WorkOS will retry. Check `WORKOS_WEBHOOK_SECRET` matches Dashboard value.

### Register Webhook in Dashboard

1. Go to WorkOS Dashboard → Webhooks
2. Add endpoint URL: `https://your-domain.com/api/webhooks/workos`
3. Enable these event types:
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
4. Copy webhook secret → set as `WORKOS_WEBHOOK_SECRET`

**Test webhook:** Use Dashboard "Send test event" feature before deploying.

## Step 6: Implement Event Handlers (Decision Tree)

Create event routing logic:

```
event.event (type)?
  |
  +-- dsync.activated
  |     |
  |     +-> Save directory_id → Link to organization_id in your DB
  |     +-> Mark directory as "active" state
  |
  +-- dsync.deleted
  |     |
  |     +-> Find organization by directory_id
  |     +-> Mark all users from this directory as deleted OR hard delete
  |     +-> Remove directory association
  |     +-> DO NOT wait for individual dsync.user.deleted events
  |
  +-- dsync.user.created
  |     |
  |     +-> event.data: Extract user attributes (email, first_name, last_name, etc.)
  |     +-> Create user in your DB, link to organization via directory_id
  |     +-> Check event.data.state: "active" vs "inactive"
  |     +-> Optional: Send welcome email if state = "active"
  |
  +-- dsync.user.updated
  |     |
  |     +-> event.data: New user state
  |     +-> event.data.previous_attributes: What changed
  |     +-> Update user record in your DB
  |     +-> CRITICAL: Check if state changed to "inactive" (soft deletion)
  |     +-> If state = "inactive" → Revoke access, suspend user, or delete per your policy
  |
  +-- dsync.user.deleted
  |     |
  |     +-> Hard delete user from directory
  |     +-> Remove from your DB OR mark as permanently deleted
  |     +-> Rare: Most providers use dsync.user.updated with state="inactive" instead
  |
  +-- dsync.group.created
  |     |
  |     +-> Save group (id, name, directory_id) to your DB
  |     +-> DO NOT assign users yet — wait for dsync.group.user_added events
  |
  +-- dsync.group.updated
  |     |
  |     +-> Update group name or attributes
  |
  +-- dsync.group.deleted
  |     |
  |     +-> Remove group from your DB
  |     +-> DO NOT remove user-group memberships manually
  |     +-> WorkOS sends dsync.group.user_removed events first
  |
  +-- dsync.group.user_added
  |     |
  |     +-> event.data.user.id: User to add
  |     +-> event.data.group.id: Group to add them to
  |     +-> Create membership record in your DB
  |     +-> Apply group-based permissions/roles
  |
  +-- dsync.group.user_removed
        |
        +-> Remove user from group membership
        +-> Revoke group-based permissions/roles
```

### Handling Inactive Users (CRITICAL)

**Policy decision required:**

```
When user state becomes "inactive"?
  |
  +-- Option A: Soft delete (recommended for compliance)
  |     |
  |     +-> Mark user.deleted_at = now()
  |     +-> Revoke all active sessions
  |     +-> Keep user data for audit trail
  |
  +-- Option B: Hard delete (WorkOS default for new environments after Oct 2023)
  |     |
  |     +-> Delete user record entirely
  |     +-> WorkOS may auto-delete inactive users
  |     +-> Contact WorkOS support to change this behavior
```

**Check your WorkOS environment settings** — newer environments delete inactive users automatically.

### Event Ordering Guarantees

**WorkOS guarantees:**

- Events arrive in causal order per resource (per user, per group)
- No guarantee of global ordering across resources

**Example initial sync flow:**

1. `dsync.activated` (directory connected)
2. Multiple `dsync.user.created` (all existing users, any order)
3. Multiple `dsync.group.created` (all existing groups, any order)
4. Multiple `dsync.group.user_added` (memberships, any order)

**Handle idempotently:** Same event may arrive twice if webhook retry occurs.

## Step 7: Store Directory Data (Schema Guide)

Recommended database schema:

### Directories Table

```sql
CREATE TABLE directories (
  id UUID PRIMARY KEY,
  workos_directory_id TEXT UNIQUE NOT NULL,  -- from event.data.id
  organization_id UUID REFERENCES organizations(id),
  state TEXT NOT NULL,  -- 'active', 'deleting', 'invalid_credentials'
  provider TEXT,  -- 'okta', 'azure', 'google', etc.
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Users Table (Add Directory Columns)

```sql
ALTER TABLE users ADD COLUMN workos_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN directory_id UUID REFERENCES directories(id);
ALTER TABLE users ADD COLUMN directory_state TEXT;  -- 'active', 'inactive'
ALTER TABLE users ADD COLUMN directory_raw_attributes JSONB;  -- custom attributes
```

### Groups Table

```sql
CREATE TABLE directory_groups (
  id UUID PRIMARY KEY,
  workos_group_id TEXT UNIQUE NOT NULL,
  directory_id UUID REFERENCES directories(id),
  name TEXT NOT NULL,
  raw_attributes JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Group Memberships Table

```sql
CREATE TABLE directory_group_memberships (
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES directory_groups(id),
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, group_id)
);
```

**Index requirements:**

- `workos_user_id` (unique, for lookups)
- `workos_group_id` (unique, for lookups)
- `directory_id` (for org-scoped queries)

## Step 8: Fetch Directory Data (On-Demand API Calls)

Webhooks are primary data source, but SDK provides query APIs for:

- Initial data loading (if not using webhook backfill)
- Manual sync triggers
- Displaying directory status in admin UI

### List Directories

```typescript
import { workos } from '@/lib/workos';

const { data: directories } = await workos.directorySync.listDirectories({
  organization: 'org_123',  // Optional: filter by organization
});
```

### List Users in Directory

```typescript
const { data: users } = await workos.directorySync.listUsers({
  directory: 'directory_123',
  limit: 100,  // Paginate if >100 users
});

// Check for pagination
if (users.list_metadata.after) {
  // Fetch next page with after: users.list_metadata.after
}
```

### List Groups in Directory

```typescript
const { data: groups } = await workos.directorySync.listGroups({
  directory: 'directory_123',
});
```

### Get User Details

```typescript
const user = await workos.directorySync.getUser({
  user: 'directory_user_123',
});

console.log(user.emails[0].value);  // Primary email
console.log(user.state);  // 'active' or 'inactive'
console.log(user.custom_attributes);  // Provider-specific attributes
```

**When to use API calls vs webhooks:**

- **Webhooks:** Real-time updates (required)
- **API calls:** Initial sync, status checks, admin UI display

## Verification Checklist (ALL MUST PASS)

Run these commands in your project directory:

```bash
# 1. Check environment variables
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID|WORKOS_WEBHOOK_SECRET" .env* || echo "FAIL: Missing env vars"

# 2. Check webhook endpoint exists
find . -path "*/api/webhooks/workos*" -o -path "*/webhooks/workos*" | head -1 || echo "FAIL: No webhook endpoint"

# 3. Check SDK is installed
ls node_modules/@workos-inc/node/package.json 2>/dev/null || echo "FAIL: SDK not installed"

# 4. Check signature verification in webhook
grep -r "constructEvent\|verifySignature" . --include="*.ts" --include="*.js" || echo "WARN: No signature verification found"

# 5. Check event handlers exist
grep -r "dsync\.user\.created\|dsync\.user\.updated" . --include="*.ts" --include="*.js" || echo "FAIL: No event handlers"

# 6. Build succeeds
npm run build || yarn build || pnpm build
```

**Manual verification:**

1. Go to WorkOS Dashboard → Directories
2. Send test `dsync.user.created` event
3. Check webhook endpoint logs — should receive and process event
4. Check database — test user should appear

**Production readiness:**

- [ ] Webhook endpoint is publicly accessible (not localhost)
- [ ] HTTPS enabled on webhook endpoint
- [ ] Signature verification is NOT commented out
- [ ] Event handlers are idempotent (safe to run twice)
- [ ] Database has indexes on `workos_user_id` and `workos_group_id`

## Error Recovery

### "Invalid signature" (401 from webhook)

**Root cause:** Signature verification failing.

**Fixes:**

1. Check `WORKOS_WEBHOOK_SECRET` exactly matches Dashboard value (no extra spaces)
2. Check you're passing raw request body to `constructEvent` (not parsed JSON)
3. For Next.js: Ensure `export const config = { api: { bodyParser: false } }` in pages/api
4. For Express: Use `express.raw({ type: 'application/json' })` middleware

### "User already exists" on dsync.user.created

**Root cause:** Event arrived twice (webhook retry) or initial sync collision.

**Fix:**

```typescript
// Use upsert pattern
await db.users.upsert({
  where: { workos_user_id: event.data.id },
  update: { /* updated fields */ },
  create: { /* new user fields */ },
});
```

### "Directory not found" in event handler

**Root cause:** `dsync.activated` event not processed yet, or directory deleted.

**Fix:**

1. Check directory exists in your DB before processing user/group events
2. If missing, fetch from WorkOS API: `workos.directorySync.getDirectory()`
3. Handle race condition: queue event for retry if directory not yet synced

### Events arrive out of order

**Example:** `dsync.group.user_added` before `dsync.group.created`.

**Root cause:** Network timing, not WorkOS ordering issue.

**Fix:**

```typescript
// Check if group exists before adding user
const group = await db.groups.findUnique({ 
  where: { workos_group_id: event.data.group.id } 
});

if (!group) {
  // Fetch group from API and create
  const groupData = await workos.directorySync.getGroup({ 
    group: event.data.group.id 
  });
  await db.groups.create({ data: groupData });
}

//
