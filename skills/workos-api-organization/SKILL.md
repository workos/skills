---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- generated -->

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

## Authentication Setup

All requests require an API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key
```

Your API key must start with `sk_` and have organization management permissions enabled in the WorkOS Dashboard.

## Endpoint Catalog

| Method | Endpoint | Operation | Use When |
|--------|----------|-----------|----------|
| POST | `/organizations` | Create | Adding a new organization to WorkOS |
| GET | `/organizations/{id}` | Get by ID | Fetching organization by WorkOS ID |
| GET | `/organizations/external-id/{external_id}` | Get by external ID | Fetching organization by your system's ID |
| GET | `/organizations` | List | Retrieving multiple organizations with filtering |
| PUT | `/organizations/{id}` | Update | Modifying organization properties |
| DELETE | `/organizations/{id}` | Delete | Removing an organization |

## Operation Decision Tree

**Creating an organization:**
- Use `POST /organizations` with `name` (required)
- Include `external_id` to link to your system's identifier
- Set `domains` array if managing domain-based organization routing

**Fetching a single organization:**
- Have WorkOS org ID? → `GET /organizations/{id}`
- Have your system's ID? → `GET /organizations/external-id/{external_id}`
- Don't know ID but have domain? → `GET /organizations?domain={domain}`

**Listing organizations:**
- Unfiltered list → `GET /organizations`
- Filter by domain → `GET /organizations?domain={domain}`
- Paginate results → Use `before` or `after` cursor with `limit`

**Updating an organization:**
- Use `PUT /organizations/{id}` (not PATCH)
- Send complete organization object with changes
- Update `domains` array to manage domain associations

**Deleting an organization:**
- Use `DELETE /organizations/{id}`
- This is permanent and removes all directory connections

## Request/Response Patterns

### Create Organization

```bash
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "external_id": "org_12345",
    "domains": ["acme.com"]
  }'
```

**Response (201 Created):**
```json
{
  "object": "organization",
  "id": "org_01H7ZKWV9KBF93K9A5R8YXJ5T1",
  "external_id": "org_12345",
  "name": "Acme Corporation",
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01H7ZKWVB2K8X9P3M4N5Q6R7S8",
      "domain": "acme.com"
    }
  ],
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Organization by ID

```bash
curl https://api.workos.com/organizations/org_01H7ZKWV9KBF93K9A5R8YXJ5T1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Get Organization by External ID

```bash
curl https://api.workos.com/organizations/external-id/org_12345 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### List Organizations

```bash
# Basic list
curl https://api.workos.com/organizations?limit=10 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Filter by domain
curl https://api.workos.com/organizations?domain=acme.com \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Paginate with cursor
curl "https://api.workos.com/organizations?limit=10&after=org_01H7ZKWV9KBF93K9A5R8YXJ5T1" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01H7ZKWV9KBF93K9A5R8YXJ5T1",
      "name": "Acme Corporation",
      "domains": [...],
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "org_01H7ZKWV9KBF93K9A5R8YXJ5T1"
  }
}
```

### Update Organization

```bash
curl https://api.workos.com/organizations/org_01H7ZKWV9KBF93K9A5R8YXJ5T1 \
  -X PUT \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp (Updated)",
    "domains": ["acme.com", "acmecorp.com"]
  }'
```

### Delete Organization

```bash
curl https://api.workos.com/organizations/org_01H7ZKWV9KBF93K9A5R8YXJ5T1 \
  -X DELETE \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (202 Accepted):**
```json
{
  "deleted": true
}
```

## Pagination Handling

The List Organizations endpoint uses cursor-based pagination:

1. First request: `GET /organizations?limit=10`
2. Response includes `list_metadata.after` cursor if more results exist
3. Next request: `GET /organizations?limit=10&after={cursor}`
4. Continue until `list_metadata.after` is null

**Backward pagination:**
Use `before` parameter instead of `after` to paginate in reverse.

## Error Code Mapping

| Status | Error Type | Cause | Fix |
|--------|-----------|-------|-----|
| 400 | `invalid_request` | Missing required field (e.g., `name`) | Add required field to request body |
| 401 | `authentication_error` | Missing or invalid API key | Check `Authorization: Bearer sk_...` header |
| 403 | `insufficient_permissions` | API key lacks organization management scope | Enable organization permissions in Dashboard |
| 404 | `not_found` | Organization ID or external ID doesn't exist | Verify ID is correct; use List to find valid IDs |
| 409 | `duplicate_external_id` | `external_id` already exists | Use different `external_id` or fetch existing org |
| 422 | `invalid_domain` | Domain format invalid or already claimed | Check domain format; verify not claimed by another org |
| 429 | `rate_limit_exceeded` | Too many requests in time window | Wait 60 seconds and retry with exponential backoff |
| 500 | `server_error` | WorkOS internal error | Retry with exponential backoff; contact support if persists |

**Example error response:**
```json
{
  "error": "invalid_request",
  "error_description": "The 'name' field is required",
  "code": "missing_required_field"
}
```

## Rate Limiting

- **Limit:** 100 requests per minute per API key
- **Headers:** Check `X-RateLimit-Remaining` header in responses
- **Retry strategy:** When you receive 429, wait 60 seconds before retrying
- **Best practice:** Implement exponential backoff (1s, 2s, 4s, 8s)

## Verification Commands

### 1. Test Authentication
```bash
curl https://api.workos.com/organizations?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```
**Expected:** 200 OK with organization list

### 2. Create Test Organization
```bash
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "external_id": "test_'$(date +%s)'"
  }'
```
**Expected:** 201 Created with organization object

### 3. Fetch by External ID
```bash
# Replace test_1234567890 with external_id from step 2
curl https://api.workos.com/organizations/external-id/test_1234567890 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```
**Expected:** 200 OK with matching organization

### 4. Test Error Handling
```bash
# Should return 400 - missing required field
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** 400 Bad Request with error message

### 5. Cleanup Test Organization
```bash
# Replace org_id with ID from step 2
curl https://api.workos.com/organizations/org_01H7ZKWV9KBF93K9A5R8YXJ5T1 \
  -X DELETE \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```
**Expected:** 202 Accepted with `{"deleted": true}`

## SDK Usage Examples

### Node.js
```javascript
import WorkOS from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create organization
const org = await workos.organizations.createOrganization({
  name: 'Acme Corporation',
  externalId: 'org_12345',
  domains: ['acme.com']
});

// Get by ID
const orgById = await workos.organizations.getOrganization(org.id);

// Get by external ID
const orgByExtId = await workos.organizations.getOrganizationByExternalId('org_12345');

// List organizations
const { data, listMetadata } = await workos.organizations.listOrganizations({
  limit: 10,
  domain: 'acme.com'
});

// Update organization
const updated = await workos.organizations.updateOrganization(org.id, {
  name: 'Acme Corp (Updated)',
  domains: ['acme.com', 'acmecorp.com']
});

// Delete organization
await workos.organizations.deleteOrganization(org.id);
```

### Python
```python
import workos

workos.api_key = os.getenv('WORKOS_API_KEY')

# Create organization
org = workos.client.organizations.create_organization(
    name='Acme Corporation',
    external_id='org_12345',
    domains=['acme.com']
)

# Get by ID
org_by_id = workos.client.organizations.get_organization(org.id)

# Get by external ID
org_by_ext_id = workos.client.organizations.get_organization_by_external_id('org_12345')

# List organizations
orgs = workos.client.organizations.list_organizations(
    limit=10,
    domain='acme.com'
)

# Update organization
updated = workos.client.organizations.update_organization(
    organization_id=org.id,
    name='Acme Corp (Updated)',
    domains=['acme.com', 'acmecorp.com']
)

# Delete organization
workos.client.organizations.delete_organization(org.id)
```

## Common Patterns

### Sync Organizations from Your System
```javascript
// Fetch organizations from your database
const localOrgs = await db.organizations.findAll();

for (const localOrg of localOrgs) {
  try {
    // Try to fetch existing WorkOS org by external_id
    const workosOrg = await workos.organizations.getOrganizationByExternalId(
      localOrg.id
    );
    
    // Update if it exists
    await workos.organizations.updateOrganization(workosOrg.id, {
      name: localOrg.name,
      domains: localOrg.domains
    });
  } catch (error) {
    if (error.code === 'not_found') {
      // Create if it doesn't exist
      await workos.organizations.createOrganization({
        name: localOrg.name,
        externalId: localOrg.id,
        domains: localOrg.domains
      });
    } else {
      throw error;
    }
  }
}
```

### Domain-Based Organization Lookup
```javascript
async function getOrgByDomain(email) {
  const domain = email.split('@')[1];
  
  const { data } = await workos.organizations.listOrganizations({
    domain: domain,
    limit: 1
  });
  
  if (data.length === 0) {
    throw new Error(`No organization found for domain ${domain}`);
  }
  
  return data[0];
}
```

### Bulk Operations with Pagination
```javascript
async function getAllOrganizations() {
  const allOrgs = [];
  let after = null;
  
  do {
    const { data, listMetadata } = await workos.organizations.listOrganizations({
      limit: 100,
      after: after
    });
    
    allOrgs.push(...data);
    after = listMetadata.after;
  } while (after !== null);
  
  return allOrgs;
}
```

## Related Skills

- **workos-feature-organizations** — Feature overview and use cases for Organizations
- **workos-api-directory-sync** — Directory Sync API for automatic user/group provisioning
- **workos-api-sso** — SSO API for organization-specific authentication flows
