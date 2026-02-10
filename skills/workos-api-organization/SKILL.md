---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id
- https://workos.com/docs/reference/organization/list
- https://workos.com/docs/reference/organization/update

## Endpoint Catalog

| Method | Path | Purpose | Primary Use Case |
| ------ | ---- | ------- | ---------------- |
| POST | `/organizations` | Create organization | Onboarding new tenant/customer |
| GET | `/organizations/{id}` | Get organization by ID | Retrieve organization details |
| GET | `/organizations/external_id/{external_id}` | Get by external ID | Query by your system's ID |
| GET | `/organizations` | List organizations | Paginated directory browsing |
| PUT | `/organizations/{id}` | Update organization | Modify name, domains, metadata |
| DELETE | `/organizations/{id}` | Delete organization | Remove tenant (soft delete) |

## Authentication Setup

All requests require the `Authorization` header with your API key:

```bash
Authorization: Bearer sk_live_1234567890abcdef
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_live_1234567890abcdef
```

## Operation Decision Tree

**Creating a new tenant?**
- Use `POST /organizations` with `name` (required) and optional `domains`, `external_id`, `metadata`

**Looking up an organization?**
- Have WorkOS org ID? → Use `GET /organizations/{id}`
- Have your system's ID? → Use `GET /organizations/external_id/{external_id}`
- Need to browse/search? → Use `GET /organizations` with filters

**Updating organization details?**
- Use `PUT /organizations/{id}` with fields to change (name, domains, metadata)
- Cannot change `external_id` after creation

**Removing an organization?**
- Use `DELETE /organizations/{id}` (soft delete — SSO/DSYNC connections remain retrievable)

## Request/Response Patterns

### Create Organization

**Request:**
```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "domains": ["acme.com", "acme.co"],
    "external_id": "acme_12345",
    "metadata": {
      "plan": "enterprise",
      "region": "us-west"
    }
  }'
```

**Response (201):**
```json
{
  "object": "organization",
  "id": "org_01H1QZ...",
  "name": "Acme Corp",
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01H1QZ...",
      "domain": "acme.com"
    }
  ],
  "external_id": "acme_12345",
  "metadata": {
    "plan": "enterprise",
    "region": "us-west"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Organization by ID

**Request:**
```bash
curl -X GET https://api.workos.com/organizations/org_01H1QZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200):** Same structure as create response

### Get Organization by External ID

**Request:**
```bash
curl -X GET https://api.workos.com/organizations/external_id/acme_12345 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200):** Same structure as create response

### List Organizations (Paginated)

**Request:**
```bash
curl -X GET "https://api.workos.com/organizations?limit=10&before=org_01H1QZ..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01H1QZ...",
      "name": "Acme Corp",
      ...
    }
  ],
  "list_metadata": {
    "before": "org_01H1QZ...",
    "after": "org_01H1QY..."
  }
}
```

**Pagination pattern:** Use `before` cursor to page backward, `after` cursor to page forward. Default limit is 10, max is 100.

### Update Organization

**Request:**
```bash
curl -X PUT https://api.workos.com/organizations/org_01H1QZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "domains": ["acme.com"],
    "metadata": {
      "plan": "premium"
    }
  }'
```

**Response (200):** Updated organization object

### Delete Organization

**Request:**
```bash
curl -X DELETE https://api.workos.com/organizations/org_01H1QZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (204):** No content (successful deletion)

## Error Code Mapping

| Status | Error Code | Cause | Fix |
| ------ | ---------- | ----- | --- |
| 400 | `invalid_request` | Missing required field (e.g., `name`) | Check request body includes `name` |
| 401 | `unauthorized` | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active |
| 404 | `not_found` | Organization ID or external_id doesn't exist | Verify ID is correct; check if org was deleted |
| 409 | `conflict` | Duplicate `external_id` | Use a unique `external_id` or omit it |
| 422 | `unprocessable_entity` | Invalid domain format in `domains` array | Ensure domains are valid hostnames (e.g., "acme.com" not "https://acme.com") |
| 429 | `rate_limit_exceeded` | Too many requests | Implement exponential backoff; default limit is 100 req/s |
| 500 | `server_error` | WorkOS internal error | Retry with exponential backoff; contact support if persists |

## SDK Usage Patterns

### Node.js SDK

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create organization
const org = await workos.organizations.createOrganization({
  name: 'Acme Corp',
  domains: ['acme.com'],
  externalId: 'acme_12345',
  metadata: { plan: 'enterprise' }
});

// Get by ID
const orgById = await workos.organizations.getOrganization('org_01H1QZ...');

// Get by external ID
const orgByExternalId = await workos.organizations.getOrganizationByExternalId('acme_12345');

// List with pagination
const orgs = await workos.organizations.listOrganizations({
  limit: 10,
  before: 'org_01H1QZ...'
});

// Update
const updated = await workos.organizations.updateOrganization('org_01H1QZ...', {
  name: 'Acme Corporation',
  domains: ['acme.com']
});

// Delete
await workos.organizations.deleteOrganization('org_01H1QZ...');
```

### Python SDK

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Create organization
org = workos.organizations.create_organization(
    name='Acme Corp',
    domains=['acme.com'],
    external_id='acme_12345',
    metadata={'plan': 'enterprise'}
)

# Get by ID
org_by_id = workos.organizations.get_organization('org_01H1QZ...')

# Get by external ID
org_by_external_id = workos.organizations.get_organization_by_external_id('acme_12345')

# List with pagination
orgs = workos.organizations.list_organizations(
    limit=10,
    before='org_01H1QZ...'
)

# Update
updated = workos.organizations.update_organization(
    'org_01H1QZ...',
    name='Acme Corporation',
    domains=['acme.com']
)

# Delete
workos.organizations.delete_organization('org_01H1QZ...')
```

## Rate Limiting

- **Default limit:** 100 requests per second per API key
- **Retry strategy:** Implement exponential backoff starting at 1s, doubling up to 32s max
- **Header hints:** Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers

## Verification Commands

### 1. Test API key authentication

```bash
curl -X GET "https://api.workos.com/organizations?limit=1" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 200 with organization list (or empty array)

### 2. Create test organization

```bash
ORG_RESPONSE=$(curl -s -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "external_id": "test_'$(date +%s)'"
  }')

echo $ORG_RESPONSE | jq '.id'
```

**Expected:** Returns organization ID starting with `org_`

### 3. Retrieve by external ID

```bash
curl -X GET https://api.workos.com/organizations/external_id/test_1234567890 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 200 if exists, HTTP 404 if not

### 4. Test pagination

```bash
curl -X GET "https://api.workos.com/organizations?limit=2" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.list_metadata'
```

**Expected:** Returns `before` and `after` cursors if >2 orgs exist

### 5. Test error handling (invalid domain)

```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Domain Test",
    "domains": ["not a valid domain!"]
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 422 with `unprocessable_entity` error

## Common Integration Patterns

### Pattern 1: Sync external CRM to WorkOS

```javascript
// On customer creation in your system
const customer = await createCustomerInCRM({ name: 'Acme Corp' });

const org = await workos.organizations.createOrganization({
  name: customer.name,
  externalId: customer.id, // Link to your system
  metadata: {
    crmId: customer.id,
    salesforceId: customer.salesforce_id
  }
});
```

### Pattern 2: Lookup organization from webhook

```javascript
// In webhook handler
app.post('/webhooks/workos', async (req, res) => {
  const event = req.body;
  
  if (event.data.organization_id) {
    const org = await workos.organizations.getOrganization(
      event.data.organization_id
    );
    
    // Use org.external_id to query your database
    const customer = await db.customers.findOne({ id: org.external_id });
  }
});
```

### Pattern 3: Batch update organization metadata

```javascript
const orgs = await workos.organizations.listOrganizations({ limit: 100 });

for (const org of orgs.data) {
  const customer = await getCustomerFromCRM(org.external_id);
  
  await workos.organizations.updateOrganization(org.id, {
    metadata: {
      ...org.metadata,
      plan: customer.subscription_tier,
      mrr: customer.monthly_revenue
    }
  });
}
```

## Troubleshooting

### "Organization not found" after creation

**Cause:** Using wrong ID format or deleted organization
**Fix:** Verify you're using the `id` field (not `external_id`) from create response

### Duplicate external_id error

**Cause:** Attempting to create org with `external_id` that already exists
**Fix:** Query by external_id first; if exists, use update instead of create

### Domains not appearing in org object

**Cause:** Invalid domain format (e.g., including protocol or path)
**Fix:** Use bare hostnames: `"acme.com"` not `"https://acme.com"` or `"acme.com/path"`

### Pagination not returning all results

**Cause:** Not following cursor-based pagination
**Fix:** Use `after` cursor from `list_metadata` to fetch next page until cursor is `null`

## Related Skills

- **workos-api-sso** — Configure SSO connections for organizations
- **workos-api-directory-sync** — Set up Directory Sync for organization user provisioning
- **workos-api-admin-portal** — Generate Admin Portal links for organization self-service
- **workos-domain-verification** — Verify organization domain ownership
- **workos-api-events** — Subscribe to organization lifecycle events
