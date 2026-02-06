---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- generated -->

# WorkOS Directory Sync API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order. They are the source of truth for API endpoints, parameters, and response schemas:

1. https://workos.com/docs/reference/directory-sync
2. https://workos.com/docs/reference/directory-sync/directory
3. https://workos.com/docs/reference/directory-sync/directory-group
4. https://workos.com/docs/reference/directory-sync/directory-group/get
5. https://workos.com/docs/reference/directory-sync/directory-group/list
6. https://workos.com/docs/reference/directory-sync/directory-user
7. https://workos.com/docs/reference/directory-sync/directory-user/get
8. https://workos.com/docs/reference/directory-sync/directory-user/list

If this skill conflicts with fetched docs, **follow the docs**.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required WorkOS credentials:

```bash
# MUST be set - no defaults
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "FAIL: Missing credentials"
```

**Required format:**
- `WORKOS_API_KEY` - starts with `sk_` (secret key)
- `WORKOS_CLIENT_ID` - starts with `client_` or `project_`

### SDK Verification

Confirm WorkOS SDK is installed:

```bash
# Check package.json for SDK dependency
grep -q "@workos-inc/node" package.json && echo "PASS" || echo "FAIL: SDK not installed"
```

If missing, install SDK:

```bash
npm install @workos-inc/node
# or
yarn add @workos-inc/node
```

## Step 3: Initialize WorkOS Client

Create or update SDK client initialization. **Location depends on framework:**

```
Framework/Pattern        --> File location
Next.js App Router       --> lib/workos.ts
Next.js Pages Router     --> lib/workos.ts
Express/Node.js          --> config/workos.js
Standalone script        --> ./workos-client.js
```

**Initialization pattern:**

```typescript
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Verify initialization:**

```bash
# Client file exists and imports SDK
grep -l "WorkOS" lib/workos.ts config/workos.js workos-client.js 2>/dev/null
```

## Step 4: Determine Use Case (Decision Tree)

```
What data do you need?
  |
  +-- All directories --> List Directories (Step 5A)
  |
  +-- Specific directory --> Get Directory (Step 5B)
  |
  +-- Directory users --> List/Get Users (Step 6)
  |
  +-- Directory groups --> List/Get Groups (Step 7)
  |
  +-- Sync events (webhooks) --> See workos-webhooks skill
```

## Step 5A: List Directories

**Use case:** Get all provisioned directories for your organization.

### Implementation

Check fetched docs for exact method signature. Typical pattern:

```typescript
import { workos } from './lib/workos';

async function listDirectories() {
  const { data: directories } = await workos.directorySync.listDirectories({
    limit: 10, // Optional: pagination limit
    // after/before for cursor pagination - see docs
  });
  return directories;
}
```

### Pagination Pattern

Directory Sync uses **cursor-based pagination**. Check docs for `listMetadata` structure:

```typescript
const { data, listMetadata } = await workos.directorySync.listDirectories();

// listMetadata contains: { before, after }
// Use these for next/previous page
```

### Verification

```bash
# Create test endpoint/script
cat > test-directories.js << 'EOF'
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.directorySync.listDirectories({ limit: 1 })
  .then(r => console.log('PASS:', r.data.length >= 0))
  .catch(e => console.log('FAIL:', e.message));
EOF

node test-directories.js
```

**Expected:** `PASS: true` (even if empty array - means API works)

## Step 5B: Get Single Directory

**Use case:** Fetch details for a specific directory by ID.

### Implementation

```typescript
async function getDirectory(directoryId: string) {
  const directory = await workos.directorySync.getDirectory(directoryId);
  return directory;
}
```

### Directory ID Format

Check response from Step 5A or webhook events. Format: `directory_<id>`

### Verification

```bash
# Test with a known directory ID
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const dirId = process.argv[1];
workos.directorySync.getDirectory(dirId)
  .then(() => console.log('PASS'))
  .catch(e => console.log('FAIL:', e.message));
" "directory_YOUR_ID_HERE"
```

## Step 6: Working with Users

### Step 6A: List Users in a Directory

**Use case:** Get all users synced from IdP (Okta, Azure AD, etc.).

```typescript
async function listDirectoryUsers(directoryId: string) {
  const { data: users } = await workos.directorySync.listUsers({
    directory: directoryId,
    limit: 100, // Adjust based on needs
  });
  return users;
}
```

**Filtering options** (check docs for full list):
- `directory` - required, filter by directory ID
- `group` - optional, filter by group ID
- `limit` - pagination size

### Step 6B: Get Single User

**Use case:** Fetch specific user by ID.

```typescript
async function getDirectoryUser(userId: string) {
  const user = await workos.directorySync.getUser(userId);
  return user;
}
```

### User Object Structure

Check fetched docs for schema. Common fields:
- `id` - format: `directory_user_<id>`
- `emails` - array of email objects
- `username` - IdP username
- `state` - `active` or `inactive`
- `customAttributes` - IdP custom fields

### Verification

```bash
# List users for a directory
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.directorySync.listUsers({ directory: 'directory_YOUR_ID', limit: 1 })
  .then(r => console.log('PASS: Found', r.data.length, 'users'))
  .catch(e => console.log('FAIL:', e.message));
"
```

## Step 7: Working with Groups

### Step 7A: List Groups in a Directory

**Use case:** Get organizational groups (departments, teams) from IdP.

```typescript
async function listDirectoryGroups(directoryId: string) {
  const { data: groups } = await workos.directorySync.listGroups({
    directory: directoryId,
    limit: 100,
  });
  return groups;
}
```

### Step 7B: Get Single Group

```typescript
async function getDirectoryGroup(groupId: string) {
  const group = await workos.directorySync.getGroup(groupId);
  return group;
}
```

### Group Object Structure

Check docs for schema. Common fields:
- `id` - format: `directory_group_<id>`
- `name` - group name from IdP
- `directory_id` - parent directory

### Verification

```bash
# List groups for a directory
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.directorySync.listGroups({ directory: 'directory_YOUR_ID', limit: 1 })
  .then(r => console.log('PASS: Found', r.data.length, 'groups'))
  .catch(e => console.log('FAIL:', e.message));
"
```

## Step 8: Delete Directory (Admin Operation)

**CRITICAL:** This permanently removes directory and all synced data. Requires admin API key.

```typescript
async function deleteDirectory(directoryId: string) {
  await workos.directorySync.deleteDirectory(directoryId);
}
```

**Verification:**

```bash
# Check directory no longer exists
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.directorySync.getDirectory('DELETED_DIR_ID')
  .then(() => console.log('FAIL: Directory still exists'))
  .catch(e => e.message.includes('not found') ? console.log('PASS') : console.log('FAIL:', e.message));
"
```

## Integration Patterns

### Pattern 1: Real-Time Sync with Webhooks

Directory Sync sends webhook events when users/groups change. **Do not poll** — use webhooks.

**Setup:**
1. See `workos-webhooks` skill for webhook handler setup
2. Subscribe to `dsync.*` events in WorkOS Dashboard
3. Handle events: `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, etc.

**When to use API vs Webhooks:**
- **Webhooks** - keep local database in sync (recommended)
- **API calls** - one-time imports, admin tools, debugging

### Pattern 2: User Provisioning Flow

```
1. Customer connects IdP in WorkOS Dashboard
   |
2. Webhook: dsync.activated event
   |
3. API: listUsers(directory_id) --> Import all users
   |
4. Ongoing: Handle dsync.user.* webhooks for changes
```

### Pattern 3: Group-Based Permissions

```typescript
// Example: Check if user is in "Admins" group
async function isUserAdmin(userId: string, directoryId: string) {
  const user = await workos.directorySync.getUser(userId);
  const adminGroup = await findGroupByName(directoryId, 'Admins');
  
  // Check if user's groups include admin group
  // (Implementation depends on your data model)
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands after implementation:

```bash
# 1. WorkOS client initialized
grep -q "new WorkOS" lib/workos.ts && echo "PASS: Client init" || echo "FAIL: No client"

# 2. API key format correct
[[ $WORKOS_API_KEY == sk_* ]] && echo "PASS: API key format" || echo "FAIL: Invalid key format"

# 3. Can list directories (even if empty)
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.directorySync.listDirectories({ limit: 1 })
  .then(() => console.log('PASS: API connection'))
  .catch(e => console.log('FAIL:', e.message));
"

# 4. SDK methods available
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS('sk_test');
console.log(workos.directorySync.listUsers ? 'PASS: SDK methods' : 'FAIL: Methods missing');
"

# 5. Build succeeds (if applicable)
npm run build 2>&1 | grep -q "error" && echo "FAIL: Build errors" || echo "PASS: Build clean"
```

**All 5 must show PASS before marking complete.**

## Error Recovery

### "Invalid API key" or 401 Unauthorized

**Root cause:** API key format wrong or missing.

**Fix:**
1. Check key starts with `sk_` (not `pk_` - that's publishable key)
2. Verify key in WorkOS Dashboard → API Keys
3. Check environment variable loaded: `echo $WORKOS_API_KEY`
4. Restart dev server after .env changes

### "Directory not found" or 404 errors

**Root cause:** Directory ID doesn't exist or was deleted.

**Fix:**
1. List all directories to get valid IDs:
   ```bash
   node -e "
   const { WorkOS } = require('@workos-inc/node');
   const workos = new WorkOS(process.env.WORKOS_API_KEY);
   workos.directorySync.listDirectories()
     .then(r => r.data.forEach(d => console.log(d.id, d.name)))
   "
   ```
2. Check directory state is `linked` (not `unlinked`)
3. Verify you're using correct environment (test vs production keys)

### "Module not found: @workos-inc/node"

**Root cause:** SDK not installed or wrong import path.

**Fix:**
```bash
# 1. Install SDK
npm install @workos-inc/node

# 2. Verify installation
ls node_modules/@workos-inc/node/package.json

# 3. Check import matches package name exactly
grep "from '@workos-inc/node'" *.ts
```

### Rate limiting errors (429)

**Root cause:** Too many API calls in short time.

**Fix:**
1. **Use webhooks** instead of polling (see Pattern 1)
2. Implement exponential backoff for retries
3. Batch operations where possible
4. Check WorkOS Dashboard for rate limit details

### "Cannot read property 'listUsers' of undefined"

**Root cause:** WorkOS client not initialized or wrong SDK version.

**Fix:**
1. Check client instantiation: `new WorkOS(apiKey)` not `WorkOS.init()`
2. Verify SDK version supports Directory Sync:
   ```bash
   npm list @workos-inc/node
   # Should be 2.0.0 or higher
   ```
3. Check import statement matches SDK docs

### Pagination not working / missing data

**Root cause:** Not following cursor-based pagination.

**Fix:**
```typescript
// WRONG - only gets first page
const { data } = await workos.directorySync.listUsers({ directory: dirId });

// CORRECT - fetch all pages
let allUsers = [];
let after = null;
do {
  const { data, listMetadata } = await workos.directorySync.listUsers({
    directory: dirId,
    limit: 100,
    after,
  });
  allUsers = allUsers.concat(data);
  after = listMetadata.after;
} while (after);
```

## Related Skills

- `workos-webhooks` - Handle Directory Sync webhook events
- `workos-sso` - Single Sign-On integration (often used alongside Directory Sync)
- `workos-admin-portal` - Self-service directory connection setup
