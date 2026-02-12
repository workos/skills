---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization
- https://workos.com/docs/reference/authkit/api-keys/validate
- https://workos.com/docs/reference/authkit/authentication
- https://workos.com/docs/reference/authkit/authentication-errors

## Authentication Setup

All API requests require authentication via Bearer token:

```bash
Authorization: Bearer sk_test_your_api_key_here
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_test_..."
export WORKOS_CLIENT_ID="client_..."
```

Verify authentication works:

```bash
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected response: `200 OK` with user list or empty array. Any `401` indicates invalid API key.

## Core Endpoint Catalog

### Authentication Endpoints

| Method | Path                                | Purpose                                   |
| ------ | ----------------------------------- | ----------------------------------------- |
| GET    | `/user_management/authorize`        | Generate authorization URL for OAuth flow |
| POST   | `/user_management/authenticate`     | Exchange authorization code for tokens    |
| POST   | `/user_management/sessions/refresh` | Refresh expired access token              |
| GET    | `/user_management/jwks`             | Fetch JWKS for token verification         |

### User Management Endpoints

| Method | Path                         | Purpose                |
| ------ | ---------------------------- | ---------------------- |
| GET    | `/user_management/users`     | List all users         |
| GET    | `/user_management/users/:id` | Get specific user      |
| POST   | `/user_management/users`     | Create new user        |
| PUT    | `/user_management/users/:id` | Update user attributes |
| DELETE | `/user_management/users/:id` | Delete user            |

### Session Management Endpoints

| Method | Path                            | Purpose                 |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/user_management/sessions`     | List active sessions    |
| DELETE | `/user_management/sessions/:id` | Revoke specific session |

### Organization Membership Endpoints

| Method | Path                                            | Purpose           |
| ------ | ----------------------------------------------- | ----------------- |
| GET    | `/user_management/organization_memberships`     | List memberships  |
| POST   | `/user_management/organization_memberships`     | Create membership |
| PUT    | `/user_management/organization_memberships/:id` | Update membership |
| DELETE | `/user_management/organization_memberships/:id` | Remove membership |

### Invitation Endpoints

| Method | Path                                      | Purpose                |
| ------ | ----------------------------------------- | ---------------------- |
| POST   | `/user_management/invitations`            | Send invitation        |
| GET    | `/user_management/invitations/:id`        | Get invitation details |
| POST   | `/user_management/invitations/:id/revoke` | Cancel invitation      |

### Magic Auth Endpoints

| Method | Path                              | Purpose                 |
| ------ | --------------------------------- | ----------------------- |
| POST   | `/user_management/magic_auth`     | Send magic link email   |
| GET    | `/user_management/magic_auth/:id` | Check magic auth status |

### Password Reset Endpoints

| Method | Path                                    | Purpose                 |
| ------ | --------------------------------------- | ----------------------- |
| POST   | `/user_management/password_reset`       | Initiate password reset |
| GET    | `/user_management/password_reset/:id`   | Get reset status        |
| POST   | `/user_management/password_reset/reset` | Complete password reset |

### Email Verification Endpoints

| Method | Path                                      | Purpose                   |
| ------ | ----------------------------------------- | ------------------------- |
| POST   | `/user_management/email_verification`     | Send verification email   |
| GET    | `/user_management/email_verification/:id` | Check verification status |

### MFA Endpoints

| Method | Path                                         | Purpose                 |
| ------ | -------------------------------------------- | ----------------------- |
| POST   | `/user_management/authentication_factors`    | Enroll MFA factor       |
| GET    | `/user_management/authentication_factors`    | List user's MFA factors |
| POST   | `/user_management/authentication_challenges` | Create MFA challenge    |

## Operation Decision Tree

### I need to...

**Authenticate a user**

- New user sign-in → `GET /authorize` (generate URL) → `POST /authenticate` (exchange code)
- Existing session → `POST /sessions/refresh` (refresh tokens)
- Magic link → `POST /magic_auth` (send email) → `POST /authenticate` (verify code)

**Manage users**

- Create → `POST /users` (set email, password, metadata)
- Read → `GET /users/:id` or `GET /users?email=...`
- Update → `PUT /users/:id` (change attributes)
- Delete → `DELETE /users/:id` (hard delete)

**Handle sessions**

- List active → `GET /sessions?user_id=...`
- Revoke → `DELETE /sessions/:id` (logout)
- Revoke all → `DELETE /sessions` with user filter

**Manage org memberships**

- Add user to org → `POST /organization_memberships`
- Update role → `PUT /organization_memberships/:id`
- Remove user → `DELETE /organization_memberships/:id`

**Send invitations**

- Email invite → `POST /invitations` (triggers email)
- Check status → `GET /invitations/:id`
- Cancel → `POST /invitations/:id/revoke`

**Password operations**

- Reset flow → `POST /password_reset` → user clicks email → `POST /password_reset/reset`
- Verify email → `POST /email_verification` → user clicks link → auto-verified

**MFA enrollment**

- Enroll TOTP → `POST /authentication_factors` with type=totp
- Challenge user → `POST /authentication_challenges` → user provides code → `POST /authenticate`

## Request/Response Patterns

### Create User

```bash
curl -X POST "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ssw0rd",
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

Response `201 Created`:

```json
{
  "object": "user",
  "id": "user_01H7ZKWQ...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": false,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### Generate Authorization URL

```bash
curl -X GET "https://api.workos.com/user_management/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=https://example.com/callback&response_type=code" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response `200 OK`:

```json
{
  "url": "https://auth.workos.com/authorize?client_id=...&state=..."
}
```

### Exchange Authorization Code

```bash
curl -X POST "https://api.workos.com/user_management/authenticate" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_...",
    "code": "auth_code_...",
    "grant_type": "authorization_code"
  }'
```

Response `200 OK`:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "refresh_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "user_01H7ZKWQ...",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe"
  }
}
```

### List Users with Pagination

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=10&after=user_01H7ZKWQ..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "user_01H7ZKWQ...",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe"
    }
  ],
  "list_metadata": {
    "after": "user_01H7ZKWQ...",
    "before": null
  }
}
```

### Send Magic Auth Email

```bash
curl -X POST "https://api.workos.com/user_management/magic_auth" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Response `201 Created`:

```json
{
  "object": "magic_auth",
  "id": "magic_auth_01H7ZKWQ...",
  "email": "user@example.com",
  "expires_at": "2024-01-15T10:15:00.000Z",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

### Refresh Access Token

```bash
curl -X POST "https://api.workos.com/user_management/sessions/refresh" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "refresh_..."
  }'
```

Response `200 OK`:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "refresh_...",
  "expires_in": 3600
}
```

## Error Code Mapping

### 400 Bad Request

| Error Code        | Cause                              | Fix                                     |
| ----------------- | ---------------------------------- | --------------------------------------- |
| `invalid_request` | Missing required parameter         | Check request body matches API docs     |
| `invalid_grant`   | Authorization code expired/invalid | Regenerate authorization URL            |
| `invalid_email`   | Email format incorrect             | Validate email before sending           |
| `duplicate_email` | User with email already exists     | Use GET /users?email=... to check first |

### 401 Unauthorized

| Error Code        | Cause                        | Fix                                          |
| ----------------- | ---------------------------- | -------------------------------------------- |
| `invalid_api_key` | API key missing or incorrect | Verify `Authorization: Bearer sk_...` header |
| `expired_token`   | Access token expired         | Call `/sessions/refresh` with refresh token  |
| `invalid_token`   | Token signature invalid      | Re-authenticate user from scratch            |

### 403 Forbidden

| Error Code                 | Cause                                   | Fix                                           |
| -------------------------- | --------------------------------------- | --------------------------------------------- |
| `insufficient_permissions` | API key lacks required scope            | Check API key permissions in WorkOS Dashboard |
| `organization_required`    | Operation requires organization context | Include `organization_id` in request          |

### 404 Not Found

| Error Code             | Cause                              | Fix                                |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `user_not_found`       | User ID doesn't exist              | Verify user ID or use email lookup |
| `session_not_found`    | Session already revoked or expired | Treat as logged out                |
| `invitation_not_found` | Invitation revoked or accepted     | Create new invitation              |

### 422 Unprocessable Entity

| Error Code                    | Cause                              | Fix                                                     |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------- |
| `password_too_weak`           | Password doesn't meet requirements | Enforce 8+ chars, mix of upper/lower/number             |
| `email_verification_required` | User must verify email first       | Send `/email_verification` request                      |
| `mfa_required`                | User has MFA enabled               | Create `/authentication_challenges` and prompt for code |

### 429 Too Many Requests

| Error Code            | Cause              | Fix                                        |
| --------------------- | ------------------ | ------------------------------------------ |
| `rate_limit_exceeded` | Too many API calls | Implement exponential backoff (1s, 2s, 4s) |

Retry strategy for 429:

```python
import time

def call_workos_api(endpoint, data):
    max_retries = 3
    for attempt in range(max_retries):
        response = requests.post(endpoint, json=data, headers=headers)
        if response.status_code != 429:
            return response
        wait_time = 2 ** attempt
        time.sleep(wait_time)
    raise Exception("Rate limit exceeded after retries")
```

### 500 Internal Server Error

| Error Code     | Cause                      | Fix                                         |
| -------------- | -------------------------- | ------------------------------------------- |
| `server_error` | Temporary WorkOS API issue | Retry after 5 seconds, then contact support |

## Pagination Handling

All list endpoints support cursor-based pagination using `after` and `before` parameters:

```bash
# First page
curl "https://api.workos.com/user_management/users?limit=25" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Next page (use 'after' from previous response)
curl "https://api.workos.com/user_management/users?limit=25&after=user_01H7ZKWQ..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Previous page (use 'before' from previous response)
curl "https://api.workos.com/user_management/users?limit=25&before=user_01H7ZKWQ..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Pattern for fetching all users:

```python
def fetch_all_users():
    all_users = []
    after = None

    while True:
        url = f"https://api.workos.com/user_management/users?limit=100"
        if after:
            url += f"&after={after}"

        response = requests.get(url, headers=headers)
        data = response.json()

        all_users.extend(data['data'])

        after = data['list_metadata'].get('after')
        if not after:
            break

    return all_users
```

## Rate Limits

- **Standard tier**: 100 requests per second per API key
- **Enterprise tier**: Custom limits (contact WorkOS)

When rate limited, response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 5
```

Implement exponential backoff with jitter to avoid thundering herd.

## Runnable Verification Commands

### Test API Key Validity

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: `HTTP Status: 200`

### Test Authorization Flow

```bash
# Step 1: Generate auth URL
AUTH_URL=$(curl -s -X GET "https://api.workos.com/user_management/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.url')

echo "Visit this URL to authenticate: $AUTH_URL"

# Step 2: After auth, exchange code (replace CODE with actual code)
curl -X POST "https://api.workos.com/user_management/authenticate" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$WORKOS_CLIENT_ID'",
    "code": "CODE_FROM_CALLBACK",
    "grant_type": "authorization_code"
  }'
```

### Test User Creation

```bash
curl -X POST "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@example.com",
    "password": "TestPassword123!",
    "first_name": "Test",
    "last_name": "User"
  }' | jq .
```

Expected: `201 Created` with user object containing `id`, `email`, `first_name`, `last_name`.

### Test Magic Auth

```bash
# Send magic link
MAGIC_AUTH_ID=$(curl -s -X POST "https://api.workos.com/user_management/magic_auth" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing-user@example.com"
  }' | jq -r '.id')

echo "Magic auth ID: $MAGIC_AUTH_ID"

# Check status
curl -X GET "https://api.workos.com/user_management/magic_auth/$MAGIC_AUTH_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq .
```

### Test Session Revocation

```bash
# List sessions for user
curl -X GET "https://api.workos.com/user_management/sessions?user_id=user_01H7ZKWQ..." \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq .

# Revoke specific session
curl -X DELETE "https://api.workos.com/user_management/sessions/session_01H7ZKWQ..." \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: `HTTP Status: 204`

## Common Integration Patterns

### Server-Side Session Management

```javascript
// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Middleware to verify session
async function requireAuth(req, res, next) {
  const sessionCookie = req.cookies["wos-session"];

  try {
    const session = await workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });

    req.user = session.user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Refresh session before expiry
async function refreshSession(req, res) {
  const { refreshToken } = req.body;

  const { accessToken, refreshToken: newRefreshToken } =
    await workos.userManagement.authenticateWithRefreshToken({
      refreshToken,
    });

  res.json({ accessToken, refreshToken: newRefreshToken });
}
```

### Client-Side Token Refresh

```javascript
// Check if token is expired
function isTokenExpired(token) {
  const payload = JSON.parse(atob(token.split(".")[1]));
  return payload.exp * 1000 < Date.now();
}

// Auto-refresh before expiry
async function getValidToken() {
  let accessToken = localStorage.getItem("access_token");

  if (isTokenExpired(accessToken)) {
    const refreshToken = localStorage.getItem("refresh_token");
    const response = await fetch("/api/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    const { accessToken: newToken, refreshToken: newRefresh } =
      await response.json();
    localStorage.setItem("access_token", newToken);
    localStorage.setItem("refresh_token", newRefresh);

    return newToken;
  }

  return accessToken;
}
```

### Organization Context Switching

```javascript
// List user's organizations
async function getUserOrganizations(userId) {
  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId,
  });

  return memberships.data.map((m) => ({
    orgId: m.organizationId,
    role: m.role,
  }));
}

// Switch active organization
async function switchOrganization(userId, orgId) {
  // Verify membership exists
  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId,
    organizationId: orgId,
  });

  if (memberships.data.length === 0) {
    throw new Error("User not member of organization");
  }

  // Store in session or JWT claims
  return { activeOrgId: orgId, role: memberships.data[0].role };
}
```

## Related Skills

- **workos-authkit-react** — React integration with hooks and components
- **workos-authkit-nextjs** — Next.js App Router integration patterns
- **workos-authkit-vanilla-js** — Plain JavaScript implementation without frameworks
