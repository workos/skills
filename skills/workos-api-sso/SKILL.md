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

All API requests require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer sk_your_api_key
```

Set environment variables:
- `WORKOS_API_KEY` - Your API key (starts with `sk_`)
- `WORKOS_CLIENT_ID` - Your client ID (starts with `client_`)

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/sso/authorize` | Initiate SSO login flow |
| POST | `/sso/token` | Exchange authorization code for profile |
| GET | `/user_management/users/{user_id}/sso_profile` | Get user's SSO profile |
| GET | `/sso/connections` | List SSO connections |
| GET | `/sso/connections/{id}` | Get specific connection details |
| DELETE | `/sso/connections/{id}` | Delete a connection |

## Operation Decision Tree

**To initiate SSO login:**
→ Use `GET /sso/authorize` to get authorization URL
→ Redirect user to this URL
→ User authenticates with their identity provider
→ IdP redirects back to your callback URL with code

**To complete authentication:**
→ Use `POST /sso/token` with the authorization code
→ Receive user profile and access token

**To check existing profile:**
→ Use `GET /user_management/users/{user_id}/sso_profile`

**To manage connections:**
→ List all: `GET /sso/connections`
→ Get one: `GET /sso/connections/{id}`
→ Delete: `DELETE /sso/connections/{id}`

## Request/Response Patterns

### Get Authorization URL

**Request:**
```http
GET https://api.workos.com/sso/authorize
  ?client_id=client_123
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &provider=GoogleOAuth
  &state=random_state_string
```

**Response:**
```http
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...
```

Alternative response for direct URL:
```json
{
  "link": "https://id.workos.com/sso/authorize/..."
}
```

### Exchange Code for Profile

**Request:**
```http
POST https://api.workos.com/sso/token
Content-Type: application/x-www-form-urlencoded

client_id=client_123&
client_secret=sk_live_abc123&
grant_type=authorization_code&
code=auth_code_from_callback
```

**Response:**
```json
{
  "access_token": "01HQRS...",
  "profile": {
    "id": "prof_123",
    "connection_id": "conn_456",
    "connection_type": "GoogleOAuth",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "raw_attributes": {...}
  }
}
```

### List Connections

**Request:**
```http
GET https://api.workos.com/sso/connections
Authorization: Bearer sk_live_abc123
```

**Response:**
```json
{
  "data": [
    {
      "id": "conn_123",
      "name": "Google OAuth",
      "type": "GoogleOAuth",
      "state": "active",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "conn_124"
  }
}
```

### Get Connection

**Request:**
```http
GET https://api.workos.com/sso/connections/conn_123
Authorization: Bearer sk_live_abc123
```

**Response:**
```json
{
  "id": "conn_123",
  "name": "Google OAuth",
  "type": "GoogleOAuth",
  "state": "active",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Delete Connection

**Request:**
```http
DELETE https://api.workos.com/sso/connections/conn_123
Authorization: Bearer sk_live_abc123
```

**Response:**
```http
HTTP/1.1 204 No Content
```

## Pagination Handling

List endpoints support cursor-based pagination:

```http
GET /sso/connections?after=conn_124&limit=10
```

Response includes `list_metadata` with `before` and `after` cursors:
```json
{
  "data": [...],
  "list_metadata": {
    "before": "conn_120",
    "after": "conn_134"
  }
}
```

To fetch next page, use the `after` cursor value. To fetch previous page, use `before` cursor.

## Error Code Mapping

### Authorization Errors (GET /sso/authorize)

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_client_id` | Client ID not found or incorrect | Verify `WORKOS_CLIENT_ID` in dashboard |
| `invalid_redirect_uri` | Redirect URI not whitelisted | Add URI to allowed list in dashboard |
| `invalid_provider` | Provider not configured | Check connection exists for provider |
| `invalid_state` | State parameter missing/invalid | Include random state string for CSRF protection |
| `connection_not_found` | Connection ID doesn't exist | Verify connection ID or use organization/provider |

Reference: https://workos.com/docs/reference/sso/get-authorization-url/error-codes

### Token Exchange Errors (POST /sso/token)

| Status | Error | Cause | Fix |
|--------|-------|-------|-----|
| 400 | `invalid_grant` | Authorization code expired or invalid | Request new code by reinitiating flow |
| 401 | `invalid_client` | Client ID or secret incorrect | Verify `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` |
| 400 | `unsupported_grant_type` | Grant type not `authorization_code` | Set `grant_type=authorization_code` |

### Connection Management Errors

| Status | Error | Cause | Fix |
|--------|-------|-------|-----|
| 401 | `unauthorized` | Missing or invalid API key | Include `Authorization: Bearer sk_...` header |
| 404 | `connection_not_found` | Connection ID doesn't exist | Verify connection ID from list endpoint |
| 403 | `forbidden` | API key lacks permissions | Use API key with appropriate scope |

## Rate Limiting

WorkOS applies rate limits per API key. Headers in responses:
- `X-RateLimit-Limit` - Total requests allowed per window
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp when limit resets

**On 429 Too Many Requests:**
1. Read `Retry-After` header (seconds to wait)
2. Implement exponential backoff: wait 1s, 2s, 4s, 8s between retries
3. Cache connection data to reduce list calls

## Runnable Verification

### Test Authorization URL Generation
```bash
curl -X GET "https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&provider=GoogleOAuth&state=test123" \
  -i
```

Expected: 302 redirect or JSON with `link` property

### Test Token Exchange (after getting code from callback)
```bash
curl -X POST https://api.workos.com/sso/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$WORKOS_CLIENT_ID" \
  -d "client_secret=$WORKOS_API_KEY" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE"
```

Expected: JSON with `access_token` and `profile` object

### Test List Connections
```bash
curl -X GET https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: JSON with `data` array of connections

### Test Get Connection
```bash
curl -X GET https://api.workos.com/sso/connections/conn_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: JSON object with connection details

### Test Delete Connection
```bash
curl -X DELETE https://api.workos.com/sso/connections/conn_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 204 No Content status

## Integration Checklist

- [ ] Environment variables set (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)
- [ ] Redirect URIs whitelisted in WorkOS Dashboard
- [ ] Authorization URL generates successfully
- [ ] Callback endpoint receives authorization code
- [ ] Token exchange returns valid profile
- [ ] Connection list returns expected data
- [ ] Error responses handled with specific error codes
- [ ] Rate limit headers monitored in production

## Related Skills

- **workos-sso** - Feature overview and integration patterns for SSO
- **workos-authkit-base** - Full authentication implementation with SSO
- **workos-api-organization** - Managing organizations that use SSO connections
- **workos-admin-portal** - Self-service SSO configuration UI
