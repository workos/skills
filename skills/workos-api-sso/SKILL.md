---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- generated -->

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

All API requests require authentication via API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

Your API key starts with `sk_` and is found in the WorkOS Dashboard under API Keys.

## Endpoint Catalog

| Method | Endpoint | Operation | Use When |
|--------|----------|-----------|----------|
| GET | `/sso/authorize` | Start SSO flow | Redirecting user to IdP login |
| GET | `/sso/token` | Exchange code for profile | Handling OAuth callback |
| GET | `/user_management/users/:id/sso_profile` | Get user SSO profile | Fetching linked SSO identity |
| GET | `/sso/connections` | List connections | Displaying available SSO providers |
| GET | `/sso/connections/:id` | Get connection details | Fetching specific connection config |
| POST | `/sso/connections` | Create connection | Setting up new SSO provider |
| PUT | `/sso/connections/:id` | Update connection | Modifying connection settings |
| DELETE | `/sso/connections/:id` | Delete connection | Removing SSO provider |

## Operation Decision Tree

**Starting SSO authentication?**
→ Use `GET /sso/authorize` to redirect user to IdP

**Handling callback from IdP?**
→ Use `GET /sso/token` to exchange authorization code for user profile

**Need to list available providers for a user?**
→ Use `GET /sso/connections` with organization filter

**Checking specific connection config?**
→ Use `GET /sso/connections/:id`

**Managing connection lifecycle?**
- Creating new provider → `POST /sso/connections`
- Updating existing → `PUT /sso/connections/:id`
- Removing provider → `DELETE /sso/connections/:id`

## Request/Response Patterns

### Start SSO Authorization Flow

```bash
GET https://api.workos.com/sso/authorize
  ?client_id=client_01H7EXAMPLE
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &organization=org_01H7EXAMPLE
  &state=random_state_string
```

**Response:** HTTP 302 redirect to IdP login page

**Required parameters:**
- `client_id` - Your WorkOS Client ID
- `redirect_uri` - Callback URL (must match Dashboard config)
- `response_type` - Always "code" for authorization code flow
- `organization` - Organization ID or domain for SSO lookup

**Optional parameters:**
- `state` - CSRF protection token
- `connection` - Specific connection ID to bypass provider selection

### Exchange Authorization Code

```bash
POST https://api.workos.com/sso/token
Content-Type: application/json
Authorization: Bearer sk_your_api_key

{
  "client_id": "client_01H7EXAMPLE",
  "client_secret": "sk_your_api_key",
  "code": "01H7AUTHORIZATION_CODE",
  "grant_type": "authorization_code"
}
```

**Response:**
```json
{
  "access_token": "01H7ACCESS_TOKEN",
  "profile": {
    "id": "prof_01H7EXAMPLE",
    "connection_id": "conn_01H7EXAMPLE",
    "connection_type": "OktaSAML",
    "organization_id": "org_01H7EXAMPLE",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "idp_id": "00u1a2b3c4d5e6f7g8h9",
    "raw_attributes": {}
  }
}
```

### List Connections

```bash
GET https://api.workos.com/sso/connections
  ?organization_id=org_01H7EXAMPLE
  &limit=10
Authorization: Bearer sk_your_api_key
```

**Response:**
```json
{
  "data": [
    {
      "id": "conn_01H7EXAMPLE",
      "name": "Acme Corp Okta",
      "connection_type": "OktaSAML",
      "organization_id": "org_01H7EXAMPLE",
      "state": "active",
      "domains": [{"domain": "acme.com"}]
    }
  ],
  "list_metadata": {
    "after": "conn_01H7NEXT",
    "before": null
  }
}
```

### Get Connection Details

```bash
GET https://api.workos.com/sso/connections/conn_01H7EXAMPLE
Authorization: Bearer sk_your_api_key
```

**Response:**
```json
{
  "id": "conn_01H7EXAMPLE",
  "name": "Acme Corp Okta",
  "connection_type": "OktaSAML",
  "organization_id": "org_01H7EXAMPLE",
  "state": "active",
  "domains": [{"domain": "acme.com"}],
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Delete Connection

```bash
DELETE https://api.workos.com/sso/connections/conn_01H7EXAMPLE
Authorization: Bearer sk_your_api_key
```

**Response:** HTTP 204 No Content (successful deletion)

## Pagination Pattern

List endpoints use cursor-based pagination:

1. Initial request returns `list_metadata.after` cursor
2. Include cursor in next request: `?after=conn_01H7NEXT`
3. Continue until `after` is null

```bash
# Page 1
GET /sso/connections?limit=10

# Page 2  
GET /sso/connections?limit=10&after=conn_01H7NEXT
```

## Error Code Mapping

### Authorization Flow Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_request` | Missing required parameter | Verify `client_id`, `redirect_uri`, `response_type` are present |
| `invalid_client` | Invalid Client ID | Check `client_id` matches WorkOS Dashboard value |
| `invalid_redirect_uri` | Redirect URI not whitelisted | Add URI to Redirect URIs in WorkOS Dashboard |
| `invalid_organization` | Organization not found or has no connections | Verify organization exists and has active connections |
| `invalid_connection` | Connection ID not found | Check connection exists and belongs to organization |

### Token Exchange Errors

| Status | Error | Cause | Fix |
|--------|-------|-------|-----|
| 400 | `invalid_grant` | Authorization code expired or already used | Codes expire in 10 minutes; request new authorization |
| 401 | `invalid_client` | Invalid API key or Client ID | Verify `client_secret` is correct API key |
| 403 | `insufficient_permissions` | API key lacks SSO permissions | Enable SSO scope in Dashboard API key settings |

### Connection Management Errors

| Status | Error | Cause | Fix |
|--------|-------|-------|-----|
| 401 | `unauthorized` | Missing or invalid API key | Include `Authorization: Bearer sk_...` header |
| 403 | `forbidden` | API key lacks admin permissions | Use admin-scoped API key for connection management |
| 404 | `connection_not_found` | Connection ID doesn't exist | Verify connection ID is correct |
| 409 | `domain_conflict` | Domain already claimed by another connection | Remove domain from existing connection first |
| 422 | `invalid_configuration` | SAML metadata or OIDC config invalid | Check IdP configuration values |

## Rate Limiting

- **Default limit:** 100 requests per second per API key
- **Burst allowance:** 200 requests in a 10-second window
- **Headers returned:**
  - `X-RateLimit-Limit` - Request limit
  - `X-RateLimit-Remaining` - Requests remaining
  - `X-RateLimit-Reset` - Unix timestamp when limit resets

**Rate limit exceeded response:**
```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests",
  "retry_after": 5
}
```

**Retry strategy:** Wait `retry_after` seconds before next request, or implement exponential backoff starting at 1 second.

## Verification Commands

### Test API Key

```bash
curl https://api.workos.com/sso/connections \
  -H "Authorization: Bearer sk_your_api_key"
```

**Expected:** HTTP 200 with connections list (or empty array)

### Verify Authorization URL Generation

```bash
curl -i "https://api.workos.com/sso/authorize?client_id=client_01H7EXAMPLE&redirect_uri=https://yourapp.com/callback&response_type=code&organization=org_01H7EXAMPLE"
```

**Expected:** HTTP 302 redirect to IdP login page

### Test Token Exchange (after receiving code)

```bash
curl https://api.workos.com/sso/token \
  -X POST \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_01H7EXAMPLE",
    "client_secret": "sk_your_api_key",
    "code": "01H7AUTHORIZATION_CODE",
    "grant_type": "authorization_code"
  }'
```

**Expected:** HTTP 200 with access token and user profile

### List Active Connections

```bash
curl "https://api.workos.com/sso/connections?state=active" \
  -H "Authorization: Bearer sk_your_api_key"
```

**Expected:** HTTP 200 with active connections array

## SDK Usage Pattern

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Start authorization flow
const authUrl = workos.sso.getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  organization: 'org_01H7EXAMPLE',
  state: crypto.randomUUID()
});

// Exchange code for profile
const { profile } = await workos.sso.getProfileAndToken({
  clientId: process.env.WORKOS_CLIENT_ID,
  code: authorizationCode
});

// List connections
const { data: connections } = await workos.sso.listConnections({
  organizationId: 'org_01H7EXAMPLE'
});

// Get specific connection
const connection = await workos.sso.getConnection('conn_01H7EXAMPLE');

// Delete connection
await workos.sso.deleteConnection('conn_01H7EXAMPLE');
```

## Common Integration Issues

**Redirect URI mismatch:**
- Symptom: `invalid_redirect_uri` error
- Cause: Callback URL not in Dashboard whitelist
- Fix: Add exact URL (including protocol and path) to Redirect URIs in WorkOS Dashboard

**Organization has no connections:**
- Symptom: User sees "No SSO provider available"
- Cause: Organization exists but no active SSO connections
- Fix: Create connection for organization via Dashboard or API

**State parameter validation failure:**
- Symptom: CSRF error on callback
- Cause: State mismatch between authorize and callback
- Fix: Store state in session/cookie, verify matches callback state parameter

**Profile missing expected attributes:**
- Symptom: `first_name` or `last_name` is null
- Cause: IdP not configured to send those SAML/OIDC attributes
- Fix: Configure attribute mapping in IdP settings or use `raw_attributes` for custom parsing

## Related Skills

- **workos-sso** - High-level SSO feature implementation guide
- **workos-api-organizations** - Organization management API reference
- **workos-api-directory-sync** - Directory Sync API for automated user provisioning
