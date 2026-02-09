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

Set these environment variables before making API calls:

```bash
export WORKOS_API_KEY="sk_your_api_key_here"
export WORKOS_CLIENT_ID="client_your_client_id_here"
```

All API requests require Bearer authentication:

```
Authorization: Bearer sk_your_api_key_here
```

## Endpoint Catalog

### Core SSO Flow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/sso/authorize` | Generate authorization URL to initiate SSO login |
| `POST` | `/sso/token` | Exchange authorization code for user profile |
| `GET` | `/user_management/users/{id}` | Retrieve authenticated user profile |

### Connection Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/connections` | List all SSO connections for your organization |
| `GET` | `/connections/{id}` | Retrieve a specific connection's details |
| `DELETE` | `/connections/{id}` | Remove an SSO connection |

### Logout Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/sso/logout` | Generate logout URL for identity provider sign-out |

## Operation Decision Tree

**When to use each endpoint:**

1. **Initiating Login** → `GET /sso/authorize`
   - User clicks "Sign in with SSO"
   - You need to redirect to identity provider
   
2. **Completing Login** → `POST /sso/token`
   - Identity provider redirects back with authorization code
   - You need user profile and authentication token

3. **Fetching User Data** → `GET /user_management/users/{id}`
   - After successful authentication
   - You need latest user profile information

4. **Managing Connections** → `GET /connections`
   - Admin configuring SSO settings
   - You need to list available identity providers

5. **Removing a Connection** → `DELETE /connections/{id}`
   - Admin disabling an identity provider
   - Connection is no longer needed

6. **Logging Out** → `GET /sso/logout`
   - User clicks "Sign out"
   - You need to clear identity provider session

## Request/Response Patterns

### Generate Authorization URL

**Request:**
```bash
curl "https://api.workos.com/sso/authorize" \
  -G \
  -d "client_id=${WORKOS_CLIENT_ID}" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "response_type=code" \
  -d "connection=conn_123" \
  -d "state=random_state_string"
```

**Response:**
```json
{
  "link": "https://id.workos.com/sso/authorize?..."
}
```

Redirect user to the `link` value to initiate SSO flow.

### Exchange Code for Profile

**Request:**
```bash
curl -X POST "https://api.workos.com/sso/token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{
    "client_id": "'"${WORKOS_CLIENT_ID}"'",
    "client_secret": "'"${WORKOS_API_KEY}"'",
    "grant_type": "authorization_code",
    "code": "01HCZT..."
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "profile": {
    "id": "user_01HCZT...",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "connection_id": "conn_123",
    "connection_type": "OktaSAML",
    "organization_id": "org_123",
    "idp_id": "00u1a2b3c4d5e6f7g8h9",
    "raw_attributes": {}
  }
}
```

### List Connections

**Request:**
```bash
curl "https://api.workos.com/connections" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "data": [
    {
      "id": "conn_123",
      "name": "Acme Corp",
      "connection_type": "OktaSAML",
      "state": "active",
      "organization_id": "org_123",
      "domains": [
        {
          "domain": "acme.com",
          "id": "domain_123"
        }
      ],
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "conn_123",
    "before": null
  }
}
```

### Delete Connection

**Request:**
```bash
curl -X DELETE "https://api.workos.com/connections/conn_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```
204 No Content
```

## Pagination Handling

List endpoints use cursor-based pagination with the `after` and `before` parameters.

**Fetch next page:**
```bash
curl "https://api.workos.com/connections?after=conn_123&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Pattern:**
1. Make initial request without pagination parameters
2. Check `list_metadata.after` in response
3. If `after` is present, pass it to next request
4. Repeat until `after` is `null`

## Error Code Mapping

### Authorization URL Errors (GET /sso/authorize)

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| `400` | `invalid_request` | Missing required parameter (`client_id`, `redirect_uri`, `response_type`) | Include all required parameters in request |
| `400` | `invalid_connection` | `connection` or `organization` not found | Verify connection ID exists using `GET /connections` |
| `400` | `invalid_redirect_uri` | Redirect URI not configured in WorkOS Dashboard | Add URI to allowed list in Dashboard settings |
| `401` | `unauthorized` | Invalid or missing `client_id` | Check `WORKOS_CLIENT_ID` environment variable |
| `422` | `unprocessable_entity` | Connection exists but is not active | Verify connection `state` is `active` in Dashboard |

**Reference:** https://workos.com/docs/reference/sso/get-authorization-url/error-codes

### Token Exchange Errors (POST /sso/token)

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| `400` | `invalid_grant` | Authorization code expired or already used | Codes expire after 10 minutes — regenerate authorization URL |
| `400` | `invalid_request` | Missing or mismatched `client_id` or `redirect_uri` | Ensure values match those used in authorization request |
| `401` | `invalid_client` | Invalid `client_secret` (API key) | Verify `WORKOS_API_KEY` starts with `sk_` and is active |

### Connection Management Errors

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| `401` | `unauthorized` | Invalid or missing API key | Check `Authorization` header contains valid Bearer token |
| `404` | `not_found` | Connection ID does not exist | List connections with `GET /connections` to verify ID |
| `403` | `forbidden` | API key lacks permission to delete connections | Use API key with admin-level permissions |

### Rate Limiting

| Status | Header | Description |
|--------|--------|-------------|
| `429` | `Retry-After` | Rate limit exceeded — wait before retrying |

**Retry strategy:**
1. Check `Retry-After` header for wait time in seconds
2. Implement exponential backoff: 1s, 2s, 4s, 8s
3. Maximum 5 retry attempts before failing

## Runnable Verification

### Test Authentication Flow

**Step 1: Generate authorization URL**
```bash
WORKOS_CLIENT_ID="client_your_id"
WORKOS_API_KEY="sk_your_key"

AUTH_RESPONSE=$(curl -s "https://api.workos.com/sso/authorize" \
  -G \
  -d "client_id=${WORKOS_CLIENT_ID}" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "response_type=code" \
  -d "organization=org_your_org_id" \
  -d "state=test_state")

echo "Authorization URL: $(echo $AUTH_RESPONSE | jq -r '.link')"
```

**Expected output:**
```
Authorization URL: https://id.workos.com/sso/authorize?client_id=...
```

**Step 2: Exchange code (after user completes SSO)**
```bash
# Replace CODE with value from redirect callback
CODE="01HCZT..."

curl -X POST "https://api.workos.com/sso/token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -d '{
    "client_id": "'"${WORKOS_CLIENT_ID}"'",
    "client_secret": "'"${WORKOS_API_KEY}"'",
    "grant_type": "authorization_code",
    "code": "'"${CODE}"'"
  }' | jq '.'
```

**Expected output:**
```json
{
  "access_token": "eyJhbG...",
  "profile": {
    "id": "user_01HCZT...",
    "email": "user@example.com"
  }
}
```

### Test Connection Management

**List all connections:**
```bash
curl "https://api.workos.com/connections" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.data[] | {id, name, connection_type, state}'
```

**Expected output:**
```json
{
  "id": "conn_123",
  "name": "Acme Corp",
  "connection_type": "OktaSAML",
  "state": "active"
}
```

**Get specific connection:**
```bash
CONNECTION_ID="conn_123"

curl "https://api.workos.com/connections/${CONNECTION_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.'
```

### Verify API Key Validity

```bash
curl -I "https://api.workos.com/connections" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected output:**
- `200 OK` → API key is valid
- `401 Unauthorized` → API key is invalid or expired

## Common Integration Patterns

### Pattern 1: Organization-based Login

When you know the user's organization ahead of time:

```bash
curl "https://api.workos.com/sso/authorize" \
  -G \
  -d "client_id=${WORKOS_CLIENT_ID}" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "response_type=code" \
  -d "organization=org_123"
```

### Pattern 2: Connection-based Login

When you know the specific SSO connection to use:

```bash
curl "https://api.workos.com/sso/authorize" \
  -G \
  -d "client_id=${WORKOS_CLIENT_ID}" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "response_type=code" \
  -d "connection=conn_123"
```

### Pattern 3: Domain-based Discovery

When user enters email and you need to find their connection:

1. Extract domain from email (e.g., `user@acme.com` → `acme.com`)
2. List connections and filter by domain:
   ```bash
   curl "https://api.workos.com/connections" \
     -H "Authorization: Bearer ${WORKOS_API_KEY}" | \
     jq '.data[] | select(.domains[].domain == "acme.com")'
   ```
3. Use returned connection ID in authorization URL

## Related Skills

- **workos-sso** — High-level guide to implementing SSO authentication (feature overview)
- **workos-api-directory-sync** — API reference for Directory Sync endpoints
- **workos-api-user-management** — API reference for User Management operations
