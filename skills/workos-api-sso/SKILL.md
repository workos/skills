---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/sso
- https://workos.com/docs/reference/sso/connection
- https://workos.com/docs/reference/sso/connection/delete
- https://workos.com/docs/reference/sso/connection/get
- https://workos.com/docs/reference/sso/connection/list
- https://workos.com/docs/reference/sso/get-authorization-url
- https://workos.com/docs/reference/sso/get-authorization-url/error-codes
- https://workos.com/docs/reference/sso/get-authorization-url/redirect-uri

## Authentication Setup

All API requests require authentication via Bearer token:

```bash
Authorization: Bearer sk_live_1234567890
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_live_1234567890"
export WORKOS_CLIENT_ID="client_1234567890"
```

## Endpoint Catalog

### Authorization Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sso/authorize` | Initiate SSO login flow |
| POST | `/sso/token` | Exchange authorization code for user profile |

### Connection Management

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/connections` | List all SSO connections |
| GET | `/connections/{id}` | Get single connection details |
| DELETE | `/connections/{id}` | Delete an SSO connection |

### Profile & Logout

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sso/profile` | Get user profile from access token |
| GET | `/sso/logout` | Generate logout URL |

## Operation Decision Tree

**Task: Initiate SSO login**
→ Use `GET /sso/authorize` with `provider`, `connection_id`, or `organization_id`
→ Redirect user to returned authorization URL

**Task: Complete SSO login**
→ User returns to redirect URI with `code` parameter
→ Use `POST /sso/token` with the code to exchange for profile

**Task: List all connections for an organization**
→ Use `GET /connections?organization_id={org_id}`

**Task: Get details of a specific connection**
→ Use `GET /connections/{connection_id}`

**Task: Remove an SSO connection**
→ Use `DELETE /connections/{connection_id}`

**Task: Get user profile from access token**
→ Use `POST /sso/profile` with the access token

**Task: Log out a user**
→ Use `GET /sso/logout` with `session_id` to get logout URL

## Request/Response Patterns

### GET /sso/authorize - Initiate SSO

**Request:**
```bash
curl "https://api.workos.com/sso/authorize?client_id=${WORKOS_CLIENT_ID}&redirect_uri=https://yourapp.com/callback&response_type=code&provider=GoogleOAuth" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "link": "https://auth.workos.com/sso/authorize?..."
}
```

Redirect the user to the `link` URL.

### POST /sso/token - Exchange Code for Profile

**Request:**
```bash
curl -X POST "https://api.workos.com/sso/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d "client_id=${WORKOS_CLIENT_ID}" \
  -d "client_secret=${WORKOS_API_KEY}" \
  -d "code=01HQRS5FJMJXKPQTGBW6S1K9NN" \
  -d "grant_type=authorization_code"
```

**Response:**
```json
{
  "access_token": "01HQRS5H...",
  "profile": {
    "id": "prof_01HQRS5H...",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "connection_id": "conn_01HQRS5H...",
    "connection_type": "GoogleOAuth",
    "organization_id": "org_01HQRS5H...",
    "idp_id": "12345",
    "raw_attributes": {}
  }
}
```

### GET /connections - List Connections

**Request:**
```bash
curl "https://api.workos.com/connections?organization_id=org_01HQRS5H..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "data": [
    {
      "id": "conn_01HQRS5H...",
      "name": "Acme Corp SAML",
      "connection_type": "SAML",
      "state": "active",
      "organization_id": "org_01HQRS5H..."
    }
  ],
  "list_metadata": {
    "after": null,
    "before": "conn_01HQRS5H..."
  }
}
```

### GET /connections/{id} - Get Connection

**Request:**
```bash
curl "https://api.workos.com/connections/conn_01HQRS5H..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "id": "conn_01HQRS5H...",
  "name": "Acme Corp SAML",
  "connection_type": "SAML",
  "state": "active",
  "organization_id": "org_01HQRS5H...",
  "domains": [
    {
      "domain": "acme.com",
      "id": "domain_01HQRS5H..."
    }
  ]
}
```

### DELETE /connections/{id} - Delete Connection

**Request:**
```bash
curl -X DELETE "https://api.workos.com/connections/conn_01HQRS5H..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```
204 No Content
```

### POST /sso/profile - Get Profile from Token

**Request:**
```bash
curl -X POST "https://api.workos.com/sso/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{"access_token": "01HQRS5H..."}'
```

**Response:**
```json
{
  "profile": {
    "id": "prof_01HQRS5H...",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "connection_id": "conn_01HQRS5H...",
    "connection_type": "GoogleOAuth",
    "organization_id": "org_01HQRS5H..."
  }
}
```

## Error Code Mapping

### GET /sso/authorize Errors

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| 400 | `invalid_request` | Missing required parameter (e.g., `redirect_uri`) | Include all required parameters: `client_id`, `redirect_uri`, `response_type`, and one of `provider`, `connection_id`, or `organization_id` |
| 400 | `invalid_redirect_uri` | Redirect URI not whitelisted | Add redirect URI to allowed list in WorkOS Dashboard |
| 401 | `unauthorized` | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is valid |
| 404 | `connection_not_found` | Invalid `connection_id` | Verify connection exists using `GET /connections/{id}` |
| 404 | `organization_not_found` | Invalid `organization_id` | Verify organization exists in WorkOS Dashboard |

### POST /sso/token Errors

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| 400 | `invalid_grant` | Authorization code expired or already used | Codes expire after 10 minutes and are single-use — restart flow |
| 400 | `invalid_request` | Missing `code` or `grant_type` | Include both parameters in request body |
| 401 | `unauthorized` | Invalid `client_secret` | Verify `WORKOS_API_KEY` matches the one used for `/sso/authorize` |

### Connection Management Errors

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| 401 | `unauthorized` | Invalid API key | Check `Authorization: Bearer` header contains valid API key |
| 404 | `not_found` | Connection ID doesn't exist | Verify connection ID with `GET /connections` |
| 409 | `conflict` | Connection still in use | Cannot delete active connections — deactivate first |

## Pagination Handling

List endpoints (`GET /connections`) use cursor-based pagination:

**Request with cursor:**
```bash
curl "https://api.workos.com/connections?after=conn_01HQRS5H...&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "list_metadata": {
    "after": "conn_01HQRS6...",
    "before": "conn_01HQRS5H..."
  }
}
```

Use `after` cursor for next page, `before` for previous page. Default limit is 10, max is 100.

## Runnable Verification

### Test 1: List Connections

```bash
curl "https://api.workos.com/connections?limit=5" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** JSON array of connections with `id`, `name`, `connection_type`, `state`.

### Test 2: Get Authorization URL

```bash
curl "https://api.workos.com/sso/authorize?client_id=${WORKOS_CLIENT_ID}&redirect_uri=http://localhost:3000/callback&response_type=code&provider=GoogleOAuth" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** JSON with `link` field containing authorization URL.

### Test 3: Get Connection Details

```bash
# First, get a connection ID from the list
CONNECTION_ID=$(curl -s "https://api.workos.com/connections?limit=1" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq -r '.data[0].id')

# Then fetch its details
curl "https://api.workos.com/connections/${CONNECTION_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** JSON with full connection details including `domains` array.

## Rate Limit Guidance

WorkOS SSO API has a rate limit of 600 requests per minute per API key.

**Rate limit headers:**
```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1640000000
```

**When rate limited (status 429):**
1. Parse `Retry-After` header (seconds until reset)
2. Implement exponential backoff: 1s, 2s, 4s, 8s
3. Max 5 retries before failing

**Prevention strategies:**
- Cache connection details (they rarely change)
- Use webhooks for profile updates instead of polling
- Batch connection lookups where possible

## Related Skills

- **workos-sso** — Feature overview and integration patterns for SSO
- **workos-api-organization** — Manage organizations that own SSO connections
- **workos-admin-portal** — Allow customers to self-configure SSO connections
- **workos-domain-verification** — Verify domains before enabling SSO for them
