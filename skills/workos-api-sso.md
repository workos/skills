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

All API requests require Bearer authentication using your WorkOS API key:

```bash
Authorization: Bearer sk_test_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_test_your_api_key
export WORKOS_CLIENT_ID=client_your_client_id
```

## Operation Decision Tree

**Use this tree to determine which endpoint to call:**

```
Need to authenticate a user?
├─ Yes → GET /sso/authorize (generate authorization URL)
│   └─ After redirect → POST /sso/token (exchange code for profile)
│
Need to manage SSO connections?
├─ List all connections → GET /sso/connections
├─ Get one connection → GET /sso/connections/{id}
├─ Delete a connection → DELETE /sso/connections/{id}
│
Need user profile data?
├─ From authentication flow → POST /sso/token (returns profile + token)
├─ From session token → GET /sso/profile (verify existing session)
│
Need to log out a user?
└─ Single Logout enabled → GET /sso/logout (initiate IdP logout)
```

## Endpoint Catalog

### Authorization Flow

| Method | Path             | Purpose                                                |
| ------ | ---------------- | ------------------------------------------------------ |
| GET    | `/sso/authorize` | Generate authorization URL to redirect user to IdP     |
| POST   | `/sso/token`     | Exchange authorization code for user profile and token |
| GET    | `/sso/profile`   | Get user profile from existing session token           |

### Connection Management

| Method | Path                    | Purpose                                      |
| ------ | ----------------------- | -------------------------------------------- |
| GET    | `/sso/connections`      | List all SSO connections for an organization |
| GET    | `/sso/connections/{id}` | Get details of a specific connection         |
| DELETE | `/sso/connections/{id}` | Delete an SSO connection                     |

### Logout Flow

| Method | Path          | Purpose                         |
| ------ | ------------- | ------------------------------- |
| GET    | `/sso/logout` | Initiate Single Logout with IdP |

## Request/Response Patterns

### Generate Authorization URL

**Request:**

```bash
curl -X GET "https://api.workos.com/sso/authorize" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -G \
  --data-urlencode "client_id=${WORKOS_CLIENT_ID}" \
  --data-urlencode "redirect_uri=https://yourapp.com/callback" \
  --data-urlencode "organization=org_123" \
  --data-urlencode "state=random_state_value"
```

**Response:**

```json
{
  "link": "https://auth.workos.com/sso/authorize?client_id=...&state=..."
}
```

**Parameters:**

- `client_id` (required) — Your WorkOS Client ID
- `redirect_uri` (required) — Where to send user after authentication
- `organization` or `connection` or `provider` (one required) — How to route user
- `state` (recommended) — CSRF protection token

### Exchange Code for Profile

**Request:**

```bash
curl -X POST "https://api.workos.com/sso/token" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'${WORKOS_CLIENT_ID}'",
    "code": "authorization_code_from_redirect",
    "grant_type": "authorization_code"
  }'
```

**Response:**

```json
{
  "access_token": "01ABCDEF...",
  "profile": {
    "id": "prof_123",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "connection_id": "conn_123",
    "connection_type": "OktaSAML",
    "organization_id": "org_123",
    "idp_id": "00u1a2b3c4d5e6f7g8h9"
  }
}
```

### List Connections

**Request:**

```bash
curl "https://api.workos.com/sso/connections?organization=org_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**

```json
{
  "data": [
    {
      "id": "conn_123",
      "organization_id": "org_123",
      "connection_type": "OktaSAML",
      "name": "Acme Corp SSO",
      "state": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "conn_124"
  }
}
```

**Pagination:**

- Add `?limit=10` to control page size (default: 10, max: 100)
- Add `?after=conn_124` to fetch next page using cursor from `list_metadata.after`
- Add `?before=conn_122` to fetch previous page

### Get Connection Details

**Request:**

```bash
curl "https://api.workos.com/sso/connections/conn_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**

```json
{
  "id": "conn_123",
  "organization_id": "org_123",
  "connection_type": "OktaSAML",
  "name": "Acme Corp SSO",
  "state": "active",
  "domains": [
    {
      "id": "domain_123",
      "domain": "acme.com"
    }
  ]
}
```

### Delete Connection

**Request:**

```bash
curl -X DELETE "https://api.workos.com/sso/connections/conn_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**

```
204 No Content
```

## Error Code Mapping

Reference: https://workos.com/docs/reference/sso/get-authorization-url/error-codes

### Authorization Errors (4xx)

| Status | Code                   | Cause                                                                     | Fix                                                                   |
| ------ | ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 400    | `invalid_request`      | Missing required parameter (client_id, redirect_uri, or routing param)    | Include all required parameters in request                            |
| 400    | `invalid_redirect_uri` | redirect_uri not configured in WorkOS Dashboard                           | Add redirect_uri to allowed list in Dashboard                         |
| 400    | `invalid_organization` | Organization ID doesn't exist or has no active connections                | Verify org exists and has at least one active SSO connection          |
| 400    | `invalid_connection`   | Connection ID doesn't exist or is inactive                                | Check connection exists and state is "active"                         |
| 401    | `unauthorized`         | Missing or invalid API key                                                | Verify WORKOS*API_KEY starts with `sk*` and has SSO permissions       |
| 403    | `forbidden`            | API key lacks SSO permission                                              | Check API key scopes in WorkOS Dashboard                              |
| 404    | `not_found`            | Resource doesn't exist                                                    | Verify connection/organization ID is correct                          |
| 422    | `unprocessable_entity` | Conflicting parameters (e.g., both organization and connection specified) | Use only ONE routing parameter: organization, connection, or provider |

### Token Exchange Errors

| Status | Code            | Cause                                             | Fix                                                          |
| ------ | --------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| 400    | `invalid_grant` | Authorization code expired or already used        | Codes expire after 10 minutes. Request new authorization URL |
| 400    | `invalid_code`  | Code doesn't exist or belongs to different client | Verify code matches the client_id                            |
| 401    | `unauthorized`  | Invalid API key                                   | Check WORKOS_API_KEY is correct                              |

### Connection Management Errors

| Status | Code           | Cause                                      | Fix                                         |
| ------ | -------------- | ------------------------------------------ | ------------------------------------------- |
| 401    | `unauthorized` | Invalid API key                            | Verify WORKOS_API_KEY                       |
| 404    | `not_found`    | Connection ID doesn't exist                | Check connection ID is correct              |
| 409    | `conflict`     | Cannot delete connection with active users | Migrate users to different connection first |

## Rate Limit Handling

- WorkOS API has rate limits per API key
- When rate limited, response returns `429 Too Many Requests`
- Retry with exponential backoff starting at 1 second
- Check `Retry-After` header for exact retry time if provided

## Runnable Verification Commands

### Test 1: Generate Authorization URL

```bash
curl -X GET "https://api.workos.com/sso/authorize" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -G \
  --data-urlencode "client_id=${WORKOS_CLIENT_ID}" \
  --data-urlencode "redirect_uri=https://localhost:3000/callback" \
  --data-urlencode "organization=org_test_123" \
  --data-urlencode "state=test_state"
```

**Expected:** 200 response with `{"link": "https://auth.workos.com/sso/authorize?..."}`

### Test 2: List Connections

```bash
curl "https://api.workos.com/sso/connections?limit=5" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** 200 response with `{"data": [...], "list_metadata": {...}}`

### Test 3: Get Specific Connection

```bash
# Replace conn_123 with real connection ID from Test 2
curl "https://api.workos.com/sso/connections/conn_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** 200 response with connection details or 404 if connection doesn't exist

### Test 4: Invalid Request (should fail)

```bash
curl -X GET "https://api.workos.com/sso/authorize" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -G \
  --data-urlencode "client_id=${WORKOS_CLIENT_ID}"
  # Missing redirect_uri - should return 400
```

**Expected:** 400 response with error code `invalid_request`

## SDK Usage Patterns

If using WorkOS SDK instead of raw API calls:

### Node.js SDK

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate authorization URL
const authUrl = workos.sso.getAuthorizationURL({
  clientID: process.env.WORKOS_CLIENT_ID,
  redirectURI: "https://yourapp.com/callback",
  organization: "org_123",
  state: "random_state",
});

// Exchange code for profile
const { profile } = await workos.sso.getProfileAndToken({
  code: "authorization_code",
  clientID: process.env.WORKOS_CLIENT_ID,
});

// List connections
const { data: connections } = await workos.sso.listConnections({
  organization: "org_123",
  limit: 10,
});

// Get connection
const connection = await workos.sso.getConnection("conn_123");

// Delete connection
await workos.sso.deleteConnection("conn_123");
```

## Common Integration Patterns

### Pattern 1: Organization-Based Routing

Use when you know the user's organization upfront (e.g., from email domain):

```bash
# User enters email → extract org from domain → route to org's SSO
curl -X GET "https://api.workos.com/sso/authorize" \
  -G \
  --data-urlencode "organization=org_123"
```

### Pattern 2: Connection-Based Routing

Use when user selects their company from a list:

```bash
# User selects "Acme Corp" → route to specific connection
curl -X GET "https://api.workos.com/sso/authorize" \
  -G \
  --data-urlencode "connection=conn_123"
```

### Pattern 3: Provider-Based Routing

Use for generic "Sign in with [Provider]" buttons:

```bash
# "Sign in with Google" button
curl -X GET "https://api.workos.com/sso/authorize" \
  -G \
  --data-urlencode "provider=GoogleOAuth"
```

**Supported providers:** GoogleOAuth, MicrosoftOAuth, GitHubOAuth (check fetched docs for complete list)

## Related Skills

- workos-authkit-base — Higher-level AuthKit integration (recommended over direct SSO API)
- workos-authkit-react — React-specific AuthKit implementation
- workos-authkit-nextjs — Next.js-specific AuthKit implementation
