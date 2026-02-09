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

Set your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key
```

Your API key must start with `sk_` and have organization permissions enabled in the WorkOS Dashboard.

## Available Endpoints

| Method | Endpoint | Purpose | Use When |
|--------|----------|---------|----------|
| POST | `/organizations` | Create organization | Creating new org from scratch |
| GET | `/organizations/{id}` | Get organization by ID | You have the WorkOS org ID |
| GET | `/organizations` | List organizations | Browsing all orgs or searching |
| PATCH | `/organizations/{id}` | Update organization | Modifying existing org properties |
| DELETE | `/organizations/{id}` | Delete organization | Removing org permanently |

## Operation Decision Tree

**Creating an Organization:**
- Use `POST /organizations` with required `name` field
- Include `domains` array if setting up domain verification
- Add `external_id` to link with your system's org identifier

**Reading an Organization:**
- Have WorkOS org ID? → Use `GET /organizations/{id}`
- Have your system's ID? → Use `GET /organizations` with `external_id` filter
- Need to browse/search? → Use `GET /organizations` with query parameters

**Updating an Organization:**
- Use `PATCH /organizations/{id}` 
- Send only the fields you want to change
- Cannot change `id` or creation timestamp

**Deleting an Organization:**
- Use `DELETE /organizations/{id}`
- Cannot be undone — all associated data is removed

## Request/Response Patterns

### Create Organization

```bash
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "domains": ["acme.com"],
    "external_id": "acme_123"
  }'
```

**Response (201 Created):**
```json
{
  "object": "organization",
  "id": "org_01HZXXX",
  "name": "Acme Corporation",
  "domains": [
    {
      "object": "organization_domain",
      "id": "org_domain_01HZXXX",
      "domain": "acme.com"
    }
  ],
  "external_id": "acme_123",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Organization by ID

```bash
curl https://api.workos.com/organizations/org_01HZXXX \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (200 OK):**
```json
{
  "object": "organization",
  "id": "org_01HZXXX",
  "name": "Acme Corporation",
  "domains": [...],
  "external_id": "acme_123",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### List Organizations

```bash
curl 'https://api.workos.com/organizations?limit=10' \
  -H "Authorization: Bearer sk_your_api_key"
```

**Filtering by External ID:**
```bash
curl 'https://api.workos.com/organizations?external_id=acme_123' \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "organization",
      "id": "org_01HZXXX",
      "name": "Acme Corporation",
      ...
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "org_01HZXXX"
  }
}
```

### Update Organization

```bash
curl https://api.workos.com/organizations/org_01HZXXX \
  -X PATCH \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp (Updated)",
    "domains": ["acme.com", "acme.io"]
  }'
```

**Response (200 OK):**
```json
{
  "object": "organization",
  "id": "org_01HZXXX",
  "name": "Acme Corp (Updated)",
  "domains": [
    {"domain": "acme.com", ...},
    {"domain": "acme.io", ...}
  ],
  ...
}
```

### Delete Organization

```bash
curl https://api.workos.com/organizations/org_01HZXXX \
  -X DELETE \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response (202 Accepted):**
```json
{
  "message": "Organization deleted successfully"
}
```

## Pagination Handling

The List Organizations endpoint uses cursor-based pagination:

1. **Initial request:** `GET /organizations?limit=10`
2. **Check response:** Look for `list_metadata.after` value
3. **Next page:** `GET /organizations?limit=10&after=org_01HZXXX`
4. **Previous page:** `GET /organizations?limit=10&before=org_01HZYYY`

Stop paginating when `list_metadata.after` is `null`.

## Error Codes and Fixes

| Status Code | Error | Cause | Fix |
|-------------|-------|-------|-----|
| 400 | `invalid_request` | Missing required field (e.g., `name`) | Include all required fields in request body |
| 401 | `unauthorized` | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header is set |
| 403 | `forbidden` | API key lacks organization permissions | Enable organization permissions in WorkOS Dashboard |
| 404 | `not_found` | Organization ID doesn't exist | Verify the org ID is correct; may have been deleted |
| 409 | `conflict` | Duplicate `external_id` | Use a unique `external_id` or omit if not needed |
| 422 | `unprocessable_entity` | Invalid domain format | Ensure domains are valid (e.g., "example.com", not "https://example.com") |
| 429 | `rate_limit_exceeded` | Too many requests | Wait 60 seconds and retry; implement exponential backoff |
| 500 | `server_error` | WorkOS internal issue | Retry with exponential backoff; contact WorkOS if persists |

## Rate Limits

WorkOS enforces rate limits per API key. If you receive a 429 response:

1. Extract `Retry-After` header (seconds to wait)
2. Wait the specified duration
3. Retry the request
4. Implement exponential backoff for repeated 429s

## Verification Commands

### Test Authentication

```bash
curl https://api.workos.com/organizations?limit=1 \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP Status 200 with organization list

### Test Create → Read → Update → Delete Flow

```bash
# 1. Create
ORG_ID=$(curl -s https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org"}' | jq -r '.id')

# 2. Read
curl https://api.workos.com/organizations/$ORG_ID \
  -H "Authorization: Bearer sk_your_api_key"

# 3. Update
curl https://api.workos.com/organizations/$ORG_ID \
  -X PATCH \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Test Org"}'

# 4. Delete
curl https://api.workos.com/organizations/$ORG_ID \
  -X DELETE \
  -H "Authorization: Bearer sk_your_api_key"
```

### Test External ID Lookup

```bash
curl 'https://api.workos.com/organizations?external_id=your_system_id_123' \
  -H "Authorization: Bearer sk_your_api_key" \
  | jq '.data[0]'
```

Expected: Returns the organization with matching `external_id`

## Common Integration Patterns

### Pattern 1: Create Org on User Signup

```bash
# When a new company signs up
curl https://api.workos.com/organizations \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$COMPANY_NAME"'",
    "external_id": "'"$YOUR_COMPANY_ID"'",
    "domains": ["'"$COMPANY_DOMAIN"'"]
  }'
```

### Pattern 2: Sync Org Updates

```bash
# When company info changes in your system
curl https://api.workos.com/organizations/org_01HZXXX \
  -X PATCH \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$UPDATED_NAME"'",
    "domains": ['"$(printf '"%s",' "${DOMAINS[@]}" | sed 's/,$//')"']
  }'
```

### Pattern 3: Fetch Org by Your System's ID

```bash
# Lookup WorkOS org using your internal ID
WORKOS_ORG=$(curl -s 'https://api.workos.com/organizations?external_id='"$YOUR_ID" \
  -H "Authorization: Bearer sk_your_api_key" \
  | jq -r '.data[0].id')
```

## Related Skills

- `workos-feature-organizations` — Overview of WorkOS Organizations feature and use cases
