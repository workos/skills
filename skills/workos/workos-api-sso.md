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

Set these environment variables:

```bash
WORKOS_API_KEY=sk_test_xxxxx
WORKOS_CLIENT_ID=client_xxxxx
```

All API requests require the API key in the Authorization header:

```bash
Authorization: Bearer sk_test_xxxxx
```

## Endpoint Catalog

### Authorization Flow

| Method | Endpoint         | Purpose                                            |
| ------ | ---------------- | -------------------------------------------------- |
| GET    | `/sso/authorize` | Generate authorization URL to redirect user to IdP |
| GET    | `/sso/token`     | Exchange authorization code for user profile       |

### Connection Management

| Method | Endpoint            | Purpose                         |
| ------ | ------------------- | ------------------------------- |
| GET    | `/connections`      | List all SSO connections        |
| GET    | `/connections/{id}` | Get specific connection details |
| DELETE | `/connections/{id}` | Remove an SSO connection        |

### User Profile

| Method | Endpoint           | Purpose                        |
| ------ | ------------------ | ------------------------------ |
| GET    | `/sso/profile`     | Get authenticated user profile |
| POST   | `/sso/profile/get` | Get profile and access token   |

### Logout Flow

| Method | Endpoint      | Purpose             |
| ------ | ------------- | ------------------- |
| GET    | `/sso/logout` | Initiate IdP logout |

## Operation Decision Tree

**Which endpoint do I need?**

1. **Starting SSO login** → `GET /sso/authorize` to get authorization URL
2. **Handling callback** → `POST /sso/token` to exchange code for profile
3. **Viewing connections** → `GET /connections` to list all
4. **Getting connection details** → `GET /connections/{id}` for specific connection
5. **Removing a connection** → `DELETE /connections/{id}` to delete
6. **Logging out** → `GET /sso/logout` to initiate IdP logout
7. **Getting user info** → `GET /sso/profile` for current user

## Request/Response Patterns

### Get Authorization URL

**Request:**

```bash
GET https://api.workos.com/sso/authorize?
  client_id=client_xxxxx&
  redirect_uri=https://yourapp.com/callback&
  organization=org_xxxxx&
  response_type=code
```

**Parameters:**

- `client_id` (required) — Your WorkOS Client ID
- `redirect_uri` (required) — Where to send user after authentication
- `organization` or `connection` or `provider` (one required) — How to identify the IdP
- `state` (recommended) — Anti-CSRF token
- `response_type` (required) — Always `code`

**Response:**

Redirects user to IdP login page. After authentication, IdP redirects to your `redirect_uri` with:

```
https://yourapp.com/callback?code=xxxxx&state=xxxxx
```

### Exchange Code for Profile

**Request:**

```bash
curl -X POST https://api.workos.com/sso/token \
  -H "Authorization: Bearer sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_xxxxx",
    "client_secret": "sk_test_xxxxx",
    "code": "xxxxx",
    "grant_type": "authorization_code"
  }'
```

**Response:**

```json
{
  "access_token": "xxxxx",
  "profile": {
    "id": "prof_xxxxx",
    "connection_id": "conn_xxxxx",
    "connection_type": "OktaSAML",
    "organization_id": "org_xxxxx",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "idp_id": "00u1a2b3c4d5e6f7g8h9",
    "raw_attributes": {}
  }
}
```

### List Connections

**Request:**

```bash
curl https://api.workos.com/connections \
  -H "Authorization: Bearer sk_test_xxxxx"
```

**Query parameters:**

- `organization_id` (optional) — Filter by organization
- `connection_type` (optional) — Filter by type (e.g., `OktaSAML`)
- `limit` (optional) — Page size (default: 10, max: 100)
- `before` or `after` (optional) — Pagination cursor

**Response:**

```json
{
  "data": [
    {
      "id": "conn_xxxxx",
      "name": "Acme Corp",
      "connection_type": "OktaSAML",
      "organization_id": "org_xxxxx",
      "state": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "list_metadata": {
    "before": "conn_xxxxx",
    "after": "conn_yyyyy"
  }
}
```

### Get Connection

**Request:**

```bash
curl https://api.workos.com/connections/conn_xxxxx \
  -H "Authorization: Bearer sk_test_xxxxx"
```

**Response:**

```json
{
  "id": "conn_xxxxx",
  "name": "Acme Corp",
  "connection_type": "OktaSAML",
  "organization_id": "org_xxxxx",
  "state": "active",
  "domains": [
    {
      "id": "domain_xxxxx",
      "domain": "acme.com"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Delete Connection

**Request:**

```bash
curl -X DELETE https://api.workos.com/connections/conn_xxxxx \
  -H "Authorization: Bearer sk_test_xxxxx"
```

**Response:**

```
204 No Content
```

## Pagination Pattern

List endpoints use cursor-based pagination:

1. First request returns `list_metadata` with `before` and `after` cursors
2. To get next page: add `?after=conn_yyyyy` to request
3. To get previous page: add `?before=conn_xxxxx` to request
4. Continue until `list_metadata` is empty

**Example:**

```bash
# Page 1
curl "https://api.workos.com/connections?limit=10" \
  -H "Authorization: Bearer sk_test_xxxxx"

# Page 2 using 'after' cursor from previous response
curl "https://api.workos.com/connections?limit=10&after=conn_yyyyy" \
  -H "Authorization: Bearer sk_test_xxxxx"
```

## Error Code Mapping

### Authorization URL Errors

| Status | Error Code             | Cause                            | Fix                                                          |
| ------ | ---------------------- | -------------------------------- | ------------------------------------------------------------ |
| 400    | `invalid_request`      | Missing required parameter       | Add `client_id`, `redirect_uri`, and organization identifier |
| 400    | `invalid_redirect_uri` | Redirect URI not registered      | Add URI to allowed list in WorkOS Dashboard                  |
| 400    | `invalid_organization` | Organization not found           | Verify organization ID or domain                             |
| 400    | `invalid_connection`   | Connection not found or inactive | Check connection ID and state                                |
| 400    | `invalid_provider`     | Provider not supported           | Use valid provider: `GoogleOAuth`, `MicrosoftOAuth`, etc.    |
| 401    | `unauthorized`         | Invalid or missing API key       | Check `WORKOS_API_KEY` starts with `sk_`                     |

### Token Exchange Errors

| Status | Error Code       | Cause                        | Fix                                                          |
| ------ | ---------------- | ---------------------------- | ------------------------------------------------------------ |
| 400    | `invalid_grant`  | Code expired or already used | Authorization codes expire after 10 minutes — restart flow   |
| 400    | `invalid_client` | Client ID mismatch           | Ensure `client_id` matches the one used in authorization URL |
| 401    | `unauthorized`   | Invalid client secret        | Verify `WORKOS_API_KEY` is correct                           |

### Connection Management Errors

| Status | Error Code     | Cause                       | Fix                                                              |
| ------ | -------------- | --------------------------- | ---------------------------------------------------------------- |
| 401    | `unauthorized` | Invalid or missing API key  | Check Authorization header format: `Bearer sk_test_xxxxx`        |
| 404    | `not_found`    | Connection ID doesn't exist | Verify connection ID from list endpoint                          |
| 403    | `forbidden`    | API key lacks permission    | Use API key with `connections:read` or `connections:write` scope |

## Rate Limits

- Rate limits apply per API key
- Default: 600 requests per minute
- Exceeded limit returns `429 Too Many Requests`
- Retry after delay specified in `Retry-After` header (seconds)

**Retry strategy:**

```javascript
async function callWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = error.headers["retry-after"] || Math.pow(2, i);
        await sleep(delay * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## SDK Usage Patterns

### Node.js SDK

**Install:**

```bash
npm install @workos-inc/node
```

**Get authorization URL:**

```javascript
const { WorkOS } = require("@workos-inc/node");

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const authUrl = workos.sso.getAuthorizationURL({
  organization: "org_xxxxx",
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: "random_state_string",
});
```

**Exchange code for profile:**

```javascript
const { profile } = await workos.sso.getProfileAndToken({
  code: "authorization_code_from_callback",
  clientId: process.env.WORKOS_CLIENT_ID,
});

console.log(profile.email); // user@example.com
```

**List connections:**

```javascript
const { data: connections } = await workos.sso.listConnections({
  organizationId: "org_xxxxx",
  limit: 20,
});

connections.forEach((conn) => {
  console.log(`${conn.name}: ${conn.state}`);
});
```

**Get connection:**

```javascript
const connection = await workos.sso.getConnection("conn_xxxxx");
console.log(connection.connection_type); // OktaSAML
```

**Delete connection:**

```javascript
await workos.sso.deleteConnection("conn_xxxxx");
```

## Verification Commands

### Test authorization URL generation:

```bash
curl "https://api.workos.com/sso/authorize?\
client_id=${WORKOS_CLIENT_ID}&\
redirect_uri=https://yourapp.com/callback&\
organization=org_xxxxx&\
response_type=code" \
  -v
```

Expected: 302 redirect to IdP login page

### Test connection listing:

```bash
curl https://api.workos.com/connections \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: JSON with `data` array and `list_metadata`

### Test connection retrieval:

```bash
# First, get a connection ID from list
CONNECTION_ID=$(curl -s https://api.workos.com/connections \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | \
  jq -r '.data[0].id')

# Then fetch that connection
curl "https://api.workos.com/connections/${CONNECTION_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: JSON object with connection details

### Test invalid connection:

```bash
curl https://api.workos.com/connections/conn_invalid \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -v
```

Expected: 404 with error message

## Common Integration Patterns

### Pattern 1: Organization-scoped login

Use when you know the user's organization:

```javascript
const authUrl = workos.sso.getAuthorizationURL({
  organization: req.query.org_id, // from your routing
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: generateState(),
});
```

### Pattern 2: Domain-based routing

Use when user enters email and you route by domain:

```javascript
const email = req.body.email;
const domain = email.split("@")[1];

const authUrl = workos.sso.getAuthorizationURL({
  organization: domain, // WorkOS resolves domain to org
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: generateState(),
});
```

### Pattern 3: Connection-specific login

Use when you have a direct connection ID:

```javascript
const authUrl = workos.sso.getAuthorizationURL({
  connection: "conn_xxxxx",
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: generateState(),
});
```

### Pattern 4: Provider selection

Use for OAuth providers without organization context:

```javascript
const authUrl = workos.sso.getAuthorizationURL({
  provider: "GoogleOAuth", // or MicrosoftOAuth
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: generateState(),
});
```

## Callback Handler Pattern

```javascript
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  // 1. Verify state matches what you sent
  if (state !== req.session.state) {
    return res.status(400).send("Invalid state");
  }

  try {
    // 2. Exchange code for profile
    const { profile } = await workos.sso.getProfileAndToken({
      code,
      clientId: process.env.WORKOS_CLIENT_ID,
    });

    // 3. Create or update user in your database
    const user = await upsertUser({
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      ssoId: profile.id,
    });

    // 4. Create session
    req.session.userId = user.id;

    res.redirect("/dashboard");
  } catch (error) {
    console.error("SSO callback error:", error);
    res.redirect("/login?error=sso_failed");
  }
});
```

## Related Skills

- workos-authkit-nextjs — Pre-built SSO UI components for Next.js
- workos-authkit-react — React hooks for SSO authentication
