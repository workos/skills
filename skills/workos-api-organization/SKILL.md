---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- generated -->

# WorkOS Organizations API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth for API contracts:

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id
- https://workos.com/docs/reference/organization/list
- https://workos.com/docs/reference/organization/update

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for `WORKOS_API_KEY` in environment:

```bash
# Must start with sk_ (production) or sk_test_ (development)
grep -E "WORKOS_API_KEY=sk_(test_)?" .env .env.local 2>/dev/null || echo "FAIL: API key missing"
```

**If missing:** Get API key from WorkOS Dashboard → API Keys section.

### SDK Installation

Detect if WorkOS SDK is installed:

```bash
# Node.js
npm list @workos-inc/node || echo "SDK not installed"

# Other runtimes - check fetched docs for SDK package name
```

**If not installed:** Install SDK per docs before continuing.

## Step 3: SDK Initialization

Initialize WorkOS client with API key. Pattern varies by language/SDK — check fetched docs for exact syntax.

**Node.js example pattern:**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Verify initialization:**

```bash
# Check client instantiation exists in codebase
grep -r "new WorkOS\|WorkOS(" . --include="*.ts" --include="*.js" || echo "FAIL: WorkOS client not initialized"
```

## Step 4: Operation Decision Tree

Determine which organization operation to implement:

```
Organization operation?
  |
  +-- CREATE   --> Use workos.organizations.createOrganization()
  |                Required: name
  |                Optional: domains, externalId, allowProfilesOutsideOrganization
  |
  +-- GET      --> Use workos.organizations.getOrganization(id)
  |                Required: organization ID
  |
  +-- GET BY EXTERNAL ID --> Use workos.organizations.getOrganizationByExternalId()
  |                          Required: externalId that was set during creation
  |
  +-- LIST     --> Use workos.organizations.listOrganizations()
  |                Optional: domains, externalIds, limit, before, after, order
  |                Returns paginated results
  |
  +-- UPDATE   --> Use workos.organizations.updateOrganization(id, data)
  |                Required: organization ID
  |                Optional: name, domains, allowProfilesOutsideOrganization
  |
  +-- DELETE   --> Use workos.organizations.deleteOrganization(id)
                   Required: organization ID
                   CRITICAL: This is permanent - no soft delete
```

**Implementation order recommendation:**

1. LIST (validate API key works)
2. CREATE (generate test data)
3. GET (verify creation)
4. UPDATE (test modification)
5. DELETE (cleanup - do last)

## Step 5: Implement Core Operations

### For CREATE Operations

**Required fields:**

- `name` - Organization display name

**Optional fields:**

- `domains` - Array of verified domains (e.g., `["example.com"]`)
- `externalId` - Your system's organization identifier
- `allowProfilesOutsideOrganization` - Boolean, default false

**Error handling:**

- `400` - Validation error (check field formats)
- `409` - Conflict (duplicate external_id or domain)
- `401` - Invalid API key

### For GET Operations

**By ID:**

- Requires UUID from CREATE response or LIST results
- Returns 404 if organization not found

**By External ID:**

- Only works if `externalId` was set during creation
- More efficient for syncing with your database

### For LIST Operations

**Pagination pattern:**

- Default limit: 10
- Max limit: Check docs (typically 100)
- Use `after` cursor from `listMetadata.after` for next page
- Use `before` cursor for previous page

**Filtering:**

- `domains` - Filter by specific domains (array)
- `externalIds` - Filter by your IDs (array)

### For UPDATE Operations

**Updatable fields:**

- `name` - Change display name
- `domains` - Replace entire domain list (not append)
- `allowProfilesOutsideOrganization` - Toggle setting

**Non-updatable:**

- `externalId` - Cannot change after creation
- `id` - Immutable UUID

### For DELETE Operations

**CRITICAL WARNING:**

- Deletion is permanent and immediate
- Deletes all associated SSO connections
- Deletes all organization memberships
- No recovery mechanism

**Always confirm before deletion** in production code.

## Step 6: Error Response Handling

Map API error codes to recovery actions:

```
HTTP Status --> Root Cause --> Fix
  |
  +-- 401 --> Invalid API key --> Check WORKOS_API_KEY format (sk_test_ or sk_)
  |                           --> Verify key exists in WorkOS Dashboard
  |
  +-- 404 --> Organization not found --> Check organization ID is valid UUID
  |                                  --> Verify organization wasn't deleted
  |
  +-- 409 --> Conflict --> external_id already exists --> Use different externalId or GET existing
  |                    --> domain already claimed --> Remove domain or update existing org
  |
  +-- 422 --> Invalid parameters --> Check fetched docs for field requirements
  |                              --> Verify domain format (no http://, no paths)
  |
  +-- 429 --> Rate limited --> Implement exponential backoff (start 1s, max 60s)
  |                       --> Cache LIST results instead of repeated calls
  |
  +-- 500 --> WorkOS service error --> Retry with exponential backoff
                                    --> Check WorkOS status page
```

**Rate limit specifics:**

- Check docs for current limits (typically 600 requests/minute)
- Response includes `Retry-After` header
- Implement retry logic BEFORE hitting limit

## Step 7: Response Handling

**Organization object structure** (verify against fetched docs):

```typescript
{
  id: string;              // UUID
  name: string;            // Display name
  domains: Array<{         // Verified domains
    id: string;
    domain: string;
  }>;
  allowProfilesOutsideOrganization: boolean;
  externalId?: string;     // Your identifier
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}
```

**List response structure:**

```typescript
{
  data: Organization[];    // Array of organization objects
  listMetadata: {
    before: string | null; // Cursor for previous page
    after: string | null;  // Cursor for next page
  };
}
```

**Store these fields:**

- `id` - Required for GET/UPDATE/DELETE operations
- `externalId` - For syncing with your database
- `domains` - For SSO configuration

## Verification Checklist (ALL MUST PASS)

Run these commands to verify implementation:

```bash
# 1. API key configured correctly
grep -E "WORKOS_API_KEY=sk_(test_)?" .env* && echo "PASS" || echo "FAIL: API key missing or malformed"

# 2. SDK imported in code
grep -r "from '@workos-inc/node'\|require('@workos-inc/node')" . --include="*.ts" --include="*.js" && echo "PASS" || echo "FAIL: SDK not imported"

# 3. WorkOS client initialized
grep -r "new WorkOS\|WorkOS(" . --include="*.ts" --include="*.js" && echo "PASS" || echo "FAIL: Client not initialized"

# 4. Error handling implemented
grep -r "catch\|\.catch\|try" . --include="*.ts" --include="*.js" | grep -i "workos\|organization" && echo "PASS" || echo "FAIL: No error handling"

# 5. Application builds
npm run build || yarn build || echo "FAIL: Build errors"
```

**Manual verification:**

Test API calls in this order:

1. LIST organizations (should return empty array or existing orgs)
2. CREATE test organization with unique name
3. GET created organization by ID
4. UPDATE organization name
5. DELETE test organization

Each operation should return 2xx status. Save response objects for inspection.

## Testing Patterns

### Local Testing

Use test API key (`sk_test_*`) from WorkOS Dashboard → API Keys → Test mode.

**Create test organization:**

```typescript
const testOrg = await workos.organizations.createOrganization({
  name: `Test Org ${Date.now()}`, // Unique name
  externalId: `test_${Date.now()}`, // Track for cleanup
});
```

**Cleanup test data:**

```typescript
// List organizations with test external IDs
const orgs = await workos.organizations.listOrganizations({
  externalIds: ['test_*'], // Your test prefix
});

// Delete each test org
for (const org of orgs.data) {
  await workos.organizations.deleteOrganization(org.id);
}
```

### Production Deployment

**Pre-flight checklist:**

- [ ] Switch to production API key (`sk_*` without `test_`)
- [ ] Remove test data creation code
- [ ] Implement idempotency (check existing before CREATE)
- [ ] Add monitoring for 401/429/500 errors
- [ ] Set up alerts for elevated error rates

## Common Pitfalls

### "409 Conflict" on CREATE

**Root cause:** `externalId` or domain already exists.

**Fix:**

```typescript
// Check if organization exists before creating
const existing = await workos.organizations.listOrganizations({
  externalIds: [yourExternalId],
});

if (existing.data.length > 0) {
  // Use existing organization
  return existing.data[0];
} else {
  // Create new
  return await workos.organizations.createOrganization({
    name: orgName,
    externalId: yourExternalId,
  });
}
```

### "404 Not Found" on GET

**Root cause:** Organization ID is incorrect or org was deleted.

**Fix:**

- Verify ID is valid UUID format
- Check if organization exists via LIST
- Update stale ID references in your database

### Pagination Not Working

**Root cause:** Using wrong cursor or not checking `listMetadata.after`.

**Fix:**

```typescript
let allOrgs = [];
let after = null;

do {
  const response = await workos.organizations.listOrganizations({
    limit: 100, // Max per page
    after: after, // Cursor from previous response
  });

  allOrgs.push(...response.data);
  after = response.listMetadata.after; // Next cursor
} while (after !== null); // Continue if more pages
```

### Rate Limit Errors (429)

**Root cause:** Too many API calls in short time window.

**Fix - Exponential backoff:**

```typescript
async function withRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 60000); // Max 60s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### Domain Format Errors (422)

**Root cause:** Domain includes protocol or path.

**Fix:**

```typescript
// WRONG
domains: ['https://example.com/path'];

// CORRECT
domains: ['example.com'];
```

## Related Skills

- `workos-authkit-nextjs` - User authentication with organizations
- `workos-directory-sync` - Sync users from organization directories
- `workos-sso` - Configure SSO connections per organization
