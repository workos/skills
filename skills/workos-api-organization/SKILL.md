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

## Authentication Setup

Set the WorkOS API key as a bearer token in the Authorization header:

```bash
Authorization: Bearer sk_live_...
```

Store your API key in environment variables:
```bash
export WORKOS_API_KEY=sk_live_your_key_here
```

## Available Endpoints

| Method | Path | Operation | Use When |
|--------|------|-----------|----------|
| POST | `/organizations` | Create organization | Creating new organizations |
| GET | `/organizations/:id` | Get organization by ID | Retrieving specific organization |
| GET | `/organizations/by-external-id/:external_id` | Get by external ID | Looking up via your system's ID |
| GET | `/organizations` | List organizations | Retrieving multiple organizations |
| PUT | `/organizations/:id` | Update organization | Modifying existing organization |
| DELETE | `/organizations/:id` | Delete organization | Removing organization |

## Operation Decision Tree

**Need to create a new organization?**
→ POST `/organizations` with `name` (required)

**Need to find an organization?**
- Know the WorkOS organization ID? → GET `/organizations/:id`
- Know your external ID? → GET `/organizations/by-external-id/:external_id`
- Need to browse/filter? → GET `/organizations` with query params

**Need to modify an organization?**
→ PUT `/organizations/:id` with updated fields

**Need to remove an organization?**
→ DELETE `/organizations/:id`

## Request/Response Patterns

### Create Organization

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "allow_profiles_outside_organization": false,
    "domains": ["acme.com"]
  }'
```

Response (201 Created):
```json
{
  "object": "organization",
  "id": "org_01H7ZKWX9KGDJ0JQR8H6N8SBYT",
  "name": "Acme Corp",
  "allow_profiles_outside_organization": false,
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01H7ZKWY0HGJ9Q4P2N8V5XRTK3",
      "domain": "acme.com"
    }
  ],
  "created_at": "2023-07-14T18:30:00.000Z",
  "updated_at": "2023-07-14T18:30:00.000Z"
}
```

### Get Organization

```bash
curl https://api.workos.com/organizations/org_01H7ZKWX9KGDJ0JQR8H6N8SBYT \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Get Organization by External ID

```bash
curl https://api.workos.com/organizations/by-external-id/your-external-id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### List Organizations

```bash
curl "https://api.workos.com/organizations?limit=10&before=org_cursor" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response (200 OK):
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01H7ZKWX9KGDJ0JQR8H6N8SBYT",
      "name": "Acme Corp",
      "domains": []
    }
  ],
  "list_metadata": {
    "before": "org_01H7ZKWX9KGDJ0JQR8H6N8SBYT",
    "after": null
  }
}
```

### Update Organization

```bash
curl -X PUT https://api.workos.com/organizations/org_01H7ZKWX9KGDJ0JQR8H6N8SBYT \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation"
  }'
```

### Delete Organization

```bash
curl -X DELETE https://api.workos.com/organizations/org_01H7ZKWX9KGDJ0JQR8H6N8SBYT \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response (204 No Content) - empty body on success

## Pagination Pattern

The List Organizations endpoint uses cursor-based pagination:

- `limit`: Number of results per page (default: 10, max: 100)
- `before`: Cursor for previous page (returns results before this cursor)
- `after`: Cursor for next page (returns results after this cursor)

To paginate forward:
```bash
# First page
curl "https://api.workos.com/organizations?limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Next page (use 'after' cursor from list_metadata)
curl "https://api.workos.com/organizations?limit=10&after=org_cursor_value" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Error Codes and Fixes

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Invalid request body or parameters | Validate required fields: `name` for POST, check field types match docs |
| 401 | Missing or invalid API key | Verify `Authorization: Bearer sk_live_...` header, check key in WorkOS Dashboard |
| 404 | Organization not found | Verify organization ID exists, check if it was deleted |
| 422 | Validation error (e.g., duplicate domain) | Check error message for specific field issue, ensure domains aren't already claimed |
| 429 | Rate limit exceeded | Implement exponential backoff, wait before retrying |
| 500 | Server error | Retry with exponential backoff, contact WorkOS support if persistent |

### Common Error Examples

**401 Unauthorized:**
```json
{
  "error": "unauthorized",
  "error_description": "Invalid API key provided"
}
```
→ Check that `WORKOS_API_KEY` is correct and starts with `sk_live_` or `sk_test_`

**404 Not Found:**
```json
{
  "message": "Could not find an Organization with id 'org_invalid'"
}
```
→ Verify the organization ID, check if organization was deleted

**422 Unprocessable Entity:**
```json
{
  "message": "Domain acme.com is already in use",
  "code": "domain_in_use"
}
```
→ Domain is claimed by another organization, use a different domain or remove it from the other organization

## Rate Limits

WorkOS applies rate limits per API key. If you receive 429 responses:

1. Implement exponential backoff (start with 1s, double on each retry)
2. Check `Retry-After` header if present
3. Consider caching organization data to reduce API calls

Example retry logic:
```bash
retry_count=0
max_retries=3
wait_time=1

while [ $retry_count -lt $max_retries ]; do
  response=$(curl -w "%{http_code}" -o response.json \
    https://api.workos.com/organizations/org_id \
    -H "Authorization: Bearer $WORKOS_API_KEY")
  
  if [ "$response" = "429" ]; then
    echo "Rate limited, waiting ${wait_time}s"
    sleep $wait_time
    wait_time=$((wait_time * 2))
    retry_count=$((retry_count + 1))
  else
    break
  fi
done
```

## Verification Commands

Test your integration with these commands:

**1. Create a test organization:**
```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org"}' \
  | jq '.id'
```
Save the returned `id` as `$ORG_ID`

**2. Retrieve the organization:**
```bash
curl https://api.workos.com/organizations/$ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.name'
```
Should return: `"Test Org"`

**3. Update the organization:**
```bash
curl -X PUT https://api.workos.com/organizations/$ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Test Org"}' \
  | jq '.name'
```
Should return: `"Updated Test Org"`

**4. List organizations:**
```bash
curl "https://api.workos.com/organizations?limit=5" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```
Should return a number ≥ 1

**5. Delete the test organization:**
```bash
curl -X DELETE https://api.workos.com/organizations/$ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "%{http_code}"
```
Should return: `204`

## Related Skills

- **workos-sso** - Configure SSO connections for organizations
- **workos-directory-sync** - Sync user directories at the organization level
- **workos-domain-verification** - Verify organization domain ownership
- **workos-admin-portal** - Enable self-service organization management
