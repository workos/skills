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

## Authentication

Set the API key in the `Authorization` header using Bearer token format:

```bash
Authorization: Bearer sk_example_123456789
```

The API key must start with `sk_` and have organization management permissions enabled in the WorkOS Dashboard.

## Available Endpoints

| Method | Endpoint                                      | Purpose                                   |
| ------ | --------------------------------------------- | ----------------------------------------- |
| POST   | `/organizations`                              | Create a new organization                 |
| GET    | `/organizations/{id}`                         | Retrieve organization by WorkOS ID        |
| GET    | `/organizations/by-external-id/{external_id}` | Retrieve organization by your system's ID |
| GET    | `/organizations`                              | List all organizations (paginated)        |
| PUT    | `/organizations/{id}`                         | Update organization attributes            |
| DELETE | `/organizations/{id}`                         | Delete an organization                    |

## Operation Decision Tree

**Creating organizations:**

- Use POST `/organizations` for new tenants/customers
- Include `external_id` to map to your internal system IDs

**Retrieving organizations:**

- Use GET `/organizations/{id}` when you have the WorkOS organization ID
- Use GET `/organizations/by-external-id/{external_id}` when you only have your system's ID
- Use GET `/organizations` with filters to search by domain or multiple criteria

**Updating organizations:**

- Use PUT `/organizations/{id}` to modify name, domains, or metadata
- Include only fields you want to change — unspecified fields remain unchanged

**Deleting organizations:**

- Use DELETE `/organizations/{id}` to remove an organization
- This cascades to related resources (connections, directory sync, etc.)

## Request/Response Patterns

### Create Organization

**Request:**

```bash
POST https://api.workos.com/organizations
Content-Type: application/json
Authorization: Bearer sk_example_123456789

{
  "name": "Acme Corporation",
  "domains": ["acme.com", "acme.co"],
  "external_id": "tenant_12345"
}
```

**Response (201 Created):**

```json
{
  "object": "organization",
  "id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
  "name": "Acme Corporation",
  "allow_profiles_outside_organization": false,
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01EHQMYV6MBK39QC5PZXHY59C3",
      "domain": "acme.com"
    },
    {
      "object": "organization_domain",
      "id": "org_domain_01EHQMYV6MBK39QC5PZXHY59C4",
      "domain": "acme.co"
    }
  ],
  "external_id": "tenant_12345",
  "created_at": "2021-06-25T19:07:33.155Z",
  "updated_at": "2021-06-25T19:07:33.155Z"
}
```

### Get Organization by ID

**Request:**

```bash
GET https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3
Authorization: Bearer sk_example_123456789
```

**Response (200 OK):**

```json
{
  "object": "organization",
  "id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
  "name": "Acme Corporation",
  "allow_profiles_outside_organization": false,
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01EHQMYV6MBK39QC5PZXHY59C3",
      "domain": "acme.com"
    }
  ],
  "external_id": "tenant_12345",
  "created_at": "2021-06-25T19:07:33.155Z",
  "updated_at": "2021-06-25T19:07:33.155Z"
}
```

### Get Organization by External ID

**Request:**

```bash
GET https://api.workos.com/organizations/by-external-id/tenant_12345
Authorization: Bearer sk_example_123456789
```

**Response (200 OK):**
Same structure as Get by ID response.

### List Organizations (Paginated)

**Request:**

```bash
GET https://api.workos.com/organizations?limit=10&before=org_01EHQMYV6MBK39QC5PZXHY59C3
Authorization: Bearer sk_example_123456789
```

Query parameters:

- `limit` (optional): Number of results per page (max 100, default 10)
- `before` (optional): Cursor for previous page
- `after` (optional): Cursor for next page
- `domains` (optional): Filter by domain (comma-separated list)

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
      "name": "Acme Corporation",
      "domains": [...],
      "created_at": "2021-06-25T19:07:33.155Z",
      "updated_at": "2021-06-25T19:07:33.155Z"
    }
  ],
  "list_metadata": {
    "before": "org_01EHQMYV6MBK39QC5PZXHY59C2",
    "after": "org_01EHQMYV6MBK39QC5PZXHY59C4"
  }
}
```

### Update Organization

**Request:**

```bash
PUT https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3
Content-Type: application/json
Authorization: Bearer sk_example_123456789

{
  "name": "Acme Corp (Updated)",
  "domains": ["acme.com", "acme.io"]
}
```

**Response (200 OK):**

```json
{
  "object": "organization",
  "id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
  "name": "Acme Corp (Updated)",
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01EHQMYV6MBK39QC5PZXHY59C3",
      "domain": "acme.com"
    },
    {
      "object": "organization_domain",
      "id": "org_domain_01EHQMYV6MBK39QC5PZXHY59C5",
      "domain": "acme.io"
    }
  ],
  "updated_at": "2021-06-25T20:15:22.108Z"
}
```

### Delete Organization

**Request:**

```bash
DELETE https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3
Authorization: Bearer sk_example_123456789
```

**Response (202 Accepted):**

```json
{
  "message": "Organization deleted successfully"
}
```

## Pagination Pattern

The List Organizations endpoint uses cursor-based pagination:

1. First request: `GET /organizations?limit=10`
2. Use `list_metadata.after` from response as `after` parameter for next page
3. Use `list_metadata.before` from response as `before` parameter for previous page
4. Stop when `data` array is empty or smaller than `limit`

**Example pagination loop:**

```bash
# Page 1
GET /organizations?limit=10

# Page 2 (use "after" cursor from page 1)
GET /organizations?limit=10&after=org_01EHQMYV6MBK39QC5PZXHY59C4

# Page 3 (use "after" cursor from page 2)
GET /organizations?limit=10&after=org_01EHQMYV6MBK39QC5PZXHY59C8
```

## Error Handling

### HTTP 400 Bad Request

**Cause:** Invalid request parameters (e.g., malformed `external_id`, invalid domain format)

**Fix:**

- Validate that `external_id` does not contain spaces or special characters
- Ensure domain values are valid DNS names (e.g., "example.com", not "http://example.com")
- Check that required fields (`name`) are present

**Example error response:**

```json
{
  "error": "invalid_request",
  "error_description": "Domain 'invalid..domain' is not a valid format",
  "code": "invalid_domain"
}
```

### HTTP 401 Unauthorized

**Cause:** Missing or invalid API key

**Fix:**

- Verify `WORKOS_API_KEY` is set correctly
- Confirm key starts with `sk_`
- Check key is enabled in WorkOS Dashboard under API Keys

### HTTP 404 Not Found

**Cause:** Organization ID or external ID does not exist

**Fix:**

- Verify the organization exists: `GET /organizations?external_id={your_id}`
- Check for typos in the organization ID (must be exact match)
- Confirm organization was not deleted

### HTTP 409 Conflict

**Cause:** Duplicate `external_id` or domain already claimed by another organization

**Fix:**

- Use a unique `external_id` per organization
- If domain conflict occurs, decide whether to transfer domain ownership or use a different domain
- Check existing organizations: `GET /organizations?domains=example.com`

**Example error response:**

```json
{
  "error": "conflict",
  "error_description": "An organization with external_id 'tenant_12345' already exists",
  "code": "duplicate_external_id"
}
```

### HTTP 422 Unprocessable Entity

**Cause:** Valid JSON but semantically incorrect (e.g., trying to set `domains` as a string instead of array)

**Fix:**

- Ensure `domains` is an array: `["example.com"]`, not `"example.com"`
- Verify field types match API specification
- Check that nested objects use correct structure

### HTTP 429 Too Many Requests

**Cause:** Rate limit exceeded

**Fix:**

- Implement exponential backoff retry logic
- Check `Retry-After` header for wait time in seconds
- Reduce request frequency or batch operations where possible

**Rate limit guidance:** WorkOS enforces per-account rate limits. See https://workos.com/docs/reference/rate-limits for current limits.

### HTTP 500 Internal Server Error

**Cause:** WorkOS service issue

**Fix:**

- Retry request after a brief delay (use exponential backoff)
- Check WorkOS status page: https://status.workos.com
- Contact WorkOS support if error persists

## Verification Commands

### Test Authentication

```bash
curl -X GET "https://api.workos.com/organizations?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected:** 200 OK with list response (even if empty)

### Create Test Organization

```bash
curl -X POST "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "external_id": "test_'$(date +%s)'",
    "domains": ["test-example.com"]
  }'
```

**Expected:** 201 Created with organization object containing `id`, `name`, and `domains`

### Retrieve by External ID

```bash
# Replace test_123456789 with external_id from previous step
curl -X GET "https://api.workos.com/organizations/by-external-id/test_123456789" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Expected:** 200 OK with organization matching the external ID

### Update Organization

```bash
# Replace org_01EHQMYV6MBK39QC5PZXHY59C3 with ID from create step
curl -X PUT "https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization (Updated)"
  }'
```

**Expected:** 200 OK with updated organization object showing new name

### Delete Test Organization

```bash
# Replace org_01EHQMYV6MBK39QC5PZXHY59C3 with ID from create step
curl -X DELETE "https://api.workos.com/organizations/org_01EHQMYV6MBK39QC5PZXHY59C3" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Expected:** 202 Accepted with success message

## Related Skills

- workos-directory-sync.rules.yml — Sync user directories from identity providers to WorkOS organizations
- workos-authkit-base — Implement authentication flows that leverage organization context
