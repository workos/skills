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

## Operation Decision Tree

```
Need to work with organizations?
├─ Creating a new organization → POST /organizations
├─ Fetching a single organization
│  ├─ Have WorkOS org_id → GET /organizations/{id}
│  └─ Have external_id (from your system) → GET /organizations/by_external_id/{external_id}
├─ Listing multiple organizations → GET /organizations (with pagination)
├─ Updating organization details → PUT /organizations/{id}
└─ Removing an organization → DELETE /organizations/{id}
```

## Authentication Setup

All API requests require Bearer token authentication:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_live_..."
```

## Endpoint Catalog

| Method | Endpoint                                      | Purpose                                   |
| ------ | --------------------------------------------- | ----------------------------------------- |
| POST   | `/organizations`                              | Create a new organization                 |
| GET    | `/organizations/{id}`                         | Retrieve organization by WorkOS ID        |
| GET    | `/organizations/by_external_id/{external_id}` | Retrieve organization by your system's ID |
| GET    | `/organizations`                              | List all organizations (paginated)        |
| PUT    | `/organizations/{id}`                         | Update organization attributes            |
| DELETE | `/organizations/{id}`                         | Delete an organization                    |

## Request/Response Patterns

### Create Organization

**Request:**

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "domains": ["acme.com"],
    "external_id": "acme_12345"
  }'
```

**Response (201 Created):**

```json
{
  "object": "organization",
  "id": "org_01H7ZKWV45S8F5CVRX4FA6RM0B",
  "name": "Acme Corp",
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01H7ZKWV45S8F5CVRX4FA6RM0C",
      "domain": "acme.com"
    }
  ],
  "external_id": "acme_12345",
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z"
}
```

### Get Organization by ID

**Request:**

```bash
curl https://api.workos.com/organizations/org_01H7ZKWV45S8F5CVRX4FA6RM0B \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**

```json
{
  "object": "organization",
  "id": "org_01H7ZKWV45S8F5CVRX4FA6RM0B",
  "name": "Acme Corp",
  "domains": [...],
  "external_id": "acme_12345",
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z"
}
```

### Get Organization by External ID

**Request:**

```bash
curl https://api.workos.com/organizations/by_external_id/acme_12345 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

This endpoint returns the same structure as GET by ID but allows lookup using your system's identifier.

### List Organizations (Paginated)

**Request:**

```bash
curl "https://api.workos.com/organizations?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01H7ZKWV45S8F5CVRX4FA6RM0B",
      "name": "Acme Corp",
      ...
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "org_01H7ZKWV45S8F5CVRX4FA6RM0B"
  }
}
```

### Update Organization

**Request:**

```bash
curl -X PUT https://api.workos.com/organizations/org_01H7ZKWV45S8F5CVRX4FA6RM0B \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "domains": ["acme.com", "acmecorp.com"]
  }'
```

**Response (200 OK):**
Returns the updated organization object.

### Delete Organization

**Request:**

```bash
curl -X DELETE https://api.workos.com/organizations/org_01H7ZKWV45S8F5CVRX4FA6RM0B \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (204 No Content):**
Empty response body indicates successful deletion.

## Pagination Handling

The List Organizations endpoint uses cursor-based pagination:

1. Initial request: `GET /organizations?limit=10`
2. Response includes `list_metadata.after` cursor
3. Next page: `GET /organizations?limit=10&after=org_01H7...`
4. Repeat until `after` is `null`

**Example pagination loop:**

```bash
# First page
curl "https://api.workos.com/organizations?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Next page (use 'after' value from previous response)
curl "https://api.workos.com/organizations?limit=10&after=org_01H7ZKWV45S8F5CVRX4FA6RM0B" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Error Code Mapping

| Status Code               | Cause                                                                                    | Fix                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 400 Bad Request           | Invalid request body (e.g., missing required field `name`, invalid domain format)        | Validate request payload against API schema. Check that `name` is provided and `domains` are valid domain strings               |
| 401 Unauthorized          | Missing or invalid API key                                                               | Verify `WORKOS_API_KEY` starts with `sk_` and is set correctly. Check key is active in WorkOS Dashboard                         |
| 404 Not Found             | Organization ID or external_id does not exist                                            | Confirm the organization exists. Use GET /organizations to list available organizations                                         |
| 409 Conflict              | Attempting to create organization with duplicate `external_id` or domain already claimed | Use a unique `external_id`. Check if domain is already assigned to another organization                                         |
| 422 Unprocessable Entity  | Invalid field values (e.g., malformed email domain)                                      | Review field format requirements in fetched docs. Ensure domains don't include protocol (use `acme.com` not `https://acme.com`) |
| 429 Too Many Requests     | Rate limit exceeded                                                                      | Implement exponential backoff. Wait before retrying                                                                             |
| 500 Internal Server Error | WorkOS service issue                                                                     | Retry with exponential backoff. Contact WorkOS support if persistent                                                            |

## Rate Limiting

WorkOS APIs are rate-limited per API key. If you receive a 429 status:

1. Check the `Retry-After` header (if present)
2. Implement exponential backoff starting at 1 second
3. Log the rate limit event for monitoring

## Runnable Verification

### Verify API Access

```bash
# Test authentication
curl https://api.workos.com/organizations?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Expected: 200 OK with organization list (may be empty)
# Failure: 401 = invalid API key
```

### Create and Retrieve Test Organization

```bash
# Create
ORG_RESPONSE=$(curl -s https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org", "external_id": "test_'$(date +%s)'"}')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.id')

# Retrieve by ID
curl https://api.workos.com/organizations/${ORG_ID} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Cleanup
curl -X DELETE https://api.workos.com/organizations/${ORG_ID} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Test External ID Lookup

```bash
# Create with external_id
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "External Test", "external_id": "ext_test_123"}'

# Lookup by external_id
curl https://api.workos.com/organizations/by_external_id/ext_test_123 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## SDK Usage Patterns

For SDK implementations, refer to the fetched documentation for language-specific method signatures. The REST API patterns above translate directly to SDK method calls.

Common SDK pattern:

- Create: `workos.organizations.create()`
- Get: `workos.organizations.get(id)` or `workos.organizations.getByExternalId(externalId)`
- List: `workos.organizations.list({limit, after})`
- Update: `workos.organizations.update(id, params)`
- Delete: `workos.organizations.delete(id)`

## Related Skills

- workos-user-management (for associating users with organizations)
- workos-directory-sync (for syncing organization members from external directories)
