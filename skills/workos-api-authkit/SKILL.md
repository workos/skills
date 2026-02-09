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

Authenticate all API requests using your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_live_YourAPIKeyHere
```

API keys starting with `sk_test_` are for test environments. Keys starting with `sk_live_` are for production.

## Core Endpoint Catalog

### User Management

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/user_management/users` | Create a new user |
| GET | `/user_management/users/{user_id}` | Retrieve user details |
| GET | `/user_management/users` | List all users (paginated) |
| PUT | `/user_management/users/{user_id}` | Update user attributes |
| DELETE | `/user_management/users/{user_id}` | Delete a user |

### Authentication

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/user_management/authorize` | Get authorization URL for login flow |
| POST | `/sso/token` | Exchange authorization code for tokens |
| POST | `/user_management/sessions` | Create a new session |
| GET | `/user_management/sessions/{session_id}` | Retrieve session details |
| POST | `/user_management/sessions/{session_id}/revoke` | Revoke (logout) a session |

### Organization Membership

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/user_management/organization_memberships` | Add user to organization |
| GET | `/user_management/organization_memberships/{membership_id}` | Get membership details |
| GET | `/user_management/organization_memberships` | List memberships (paginated) |
| PUT | `/user_management/organization_memberships/{membership_id}` | Update membership role |
| DELETE | `/user_management/organization_memberships/{membership_id}` | Remove user from organization |

### Invitations

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/user_management/invitations` | Send invitation to join organization |
| GET | `/user_management/invitations/{invitation_id}` | Get invitation details |
| GET | `/user_management/invitations` | List invitations (paginated) |
| POST | `/user_management/invitations/{invitation_id}/resend` | Resend invitation email |
| POST | `/user_management/invitations/{invitation_id}/revoke` | Cancel invitation |

### MFA (Multi-Factor Authentication)

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/user_management/authentication_factors` | Enroll user in MFA |
| GET | `/user_management/authentication_factors` | List user's MFA factors |
| DELETE | `/user_management/authentication_factors/{factor_id}` | Remove MFA factor |

### API Key Management

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/user_management/organizations/{org_id}/api_keys` | Create API key for organization |
| GET | `/user_management/organizations/{org_id}/api_keys` | List organization API keys |
| POST | `/user_management/api_keys/validate` | Validate API key and get metadata |
| DELETE | `/user_management/api_keys/{key_id}` | Delete API key |

## Operation Decision Tree

### User Operations

**Creating a user:**
- Use `POST /user_management/users` with `email`, `password` (optional), `first_name`, `last_name`
- For SSO users, omit `password` — authentication happens via SSO provider

**Retrieving a user:**
- By ID: `GET /user_management/users/{user_id}`
- By email or external ID: `GET /user_management/users?email={email}` or `?external_id={id}`

**Updating a user:**
- Use `PUT /user_management/users/{user_id}` with fields to update (`first_name`, `last_name`, `email_verified`)
- Cannot update `email` directly — user must verify new email

**Deleting a user:**
- Use `DELETE /user_management/users/{user_id}`
- Also revokes all sessions and removes from all organizations

### Authentication Flow

**Standard email/password login:**
1. Call `GET /user_management/authorize` with `client_id`, `redirect_uri`, `response_type=code`
2. User authenticates via AuthKit UI
3. Redirect back to your app with `code` parameter
4. Exchange code: `POST /sso/token` with `code`, `client_id`, `client_secret`, `grant_type=authorization_code`
5. Receive `access_token`, `refresh_token`, and user profile

**SSO login:**
1. Same as above, but `GET /user_management/authorize` includes `organization_id` or `connection_id`
2. User redirects to SSO provider
3. After SSO auth, redirect back with `code`
4. Exchange code as above

**Refresh tokens:**
- Use `POST /sso/token` with `refresh_token`, `grant_type=refresh_token`
- Returns new `access_token` (and optionally new `refresh_token`)

### Session Management

**Creating sessions:**
- Sessions are created automatically during authentication flow
- Or use `POST /user_management/sessions` for manual session creation

**Revoking sessions (logout):**
- Single session: `POST /user_management/sessions/{session_id}/revoke`
- All user sessions: `GET /user_management/sessions?user_id={user_id}`, then revoke each

### Organization Membership

**Adding user to organization:**
- Use `POST /user_management/organization_memberships` with `user_id`, `organization_id`, `role_slug`

**Updating role:**
- Use `PUT /user_management/organization_memberships/{membership_id}` with new `role_slug`

**Removing user:**
- Use `DELETE /user_management/organization_memberships/{membership_id}`

### Invitations

**Sending invitation:**
- Use `POST /user_management/invitations` with `email`, `organization_id`, `role_slug` (optional)
- User receives email with invitation link

**Accepting invitation:**
- Not a direct API call — user clicks link in email, creates account, and is auto-added to organization

**Resending or canceling:**
- Resend: `POST /user_management/invitations/{invitation_id}/resend`
- Cancel: `POST /user_management/invitations/{invitation_id}/revoke`

## Request/Response Patterns

### Create User

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ssw0rd",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": false
  }'
```

**Response (201 Created):**
```json
{
  "object": "user",
  "id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": false,
  "created_at": "2023-08-15T14:30:00.000Z",
  "updated_at": "2023-08-15T14:30:00.000Z"
}
```

### List Users (Paginated)

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=10&order=desc" \
  -H "Authorization: Bearer sk_live_..."
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "user",
      "id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "email_verified": true,
      "created_at": "2023-08-15T14:30:00.000Z",
      "updated_at": "2023-08-15T14:30:00.000Z"
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0"
  }
}
```

**Pagination pattern:**
- Use `after` cursor from `list_metadata` in next request: `?after=user_01H7ZGXFP5C6BBQY6Z7277ZCT0`
- Use `before` cursor to paginate backwards
- `limit` parameter controls page size (default 10, max 100)

### Get Authorization URL

```bash
curl -X GET "https://api.workos.com/user_management/authorize?client_id=client_01H7ZGXFP5C6BBQY6Z7277ZCT0&redirect_uri=https://yourapp.com/callback&response_type=code&state=random_state_string" \
  -H "Authorization: Bearer sk_live_..."
```

**Response (302 Redirect or JSON with URL):**
```json
{
  "url": "https://auth.workos.com/authorize?client_id=...&redirect_uri=...&response_type=code&state=..."
}
```

Redirect user to this URL for authentication.

### Exchange Code for Tokens

```bash
curl -X POST https://api.workos.com/sso/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "client_secret": "sk_live_...",
    "code": "auth_code_received_from_callback",
    "grant_type": "authorization_code"
  }'
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "object": "user",
    "id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true,
    "created_at": "2023-08-15T14:30:00.000Z",
    "updated_at": "2023-08-15T14:30:00.000Z"
  }
}
```

### Create Organization Membership

```bash
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "role_slug": "member"
  }'
```

**Response (201 Created):**
```json
{
  "object": "organization_membership",
  "id": "om_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "user_id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "role": {
    "slug": "member"
  },
  "status": "active",
  "created_at": "2023-08-15T14:30:00.000Z",
  "updated_at": "2023-08-15T14:30:00.000Z"
}
```

### Send Invitation

```bash
curl -X POST https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "role_slug": "member"
  }'
```

**Response (201 Created):**
```json
{
  "object": "invitation",
  "id": "invitation_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "email": "newuser@example.com",
  "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0",
  "state": "pending",
  "token": "invite_token_abcd1234",
  "accept_invitation_url": "https://auth.workos.com/invitations/accept?token=invite_token_abcd1234",
  "expires_at": "2023-08-22T14:30:00.000Z",
  "created_at": "2023-08-15T14:30:00.000Z",
  "updated_at": "2023-08-15T14:30:00.000Z"
}
```

## Error Code Mapping

WorkOS returns standard HTTP status codes with detailed error responses.

### 400 Bad Request

**Cause:** Invalid request parameters or malformed JSON.

**Example response:**
```json
{
  "error": "invalid_request",
  "error_description": "Missing required parameter: email",
  "code": "missing_required_parameter"
}
```

**Fix:** Check request body matches API schema. Verify all required fields are included.

### 401 Unauthorized

**Cause:** Missing or invalid API key.

**Example response:**
```json
{
  "error": "unauthorized",
  "error_description": "Invalid API key",
  "code": "invalid_api_key"
}
```

**Fix:** Verify `Authorization` header includes `Bearer sk_live_...` or `Bearer sk_test_...`. Check API key is active in WorkOS Dashboard.

### 403 Forbidden

**Cause:** API key lacks permission for the requested operation.

**Example response:**
```json
{
  "error": "forbidden",
  "error_description": "API key does not have permission to access this resource",
  "code": "insufficient_permissions"
}
```

**Fix:** Check API key permissions in WorkOS Dashboard. Ensure key has `user_management` scope enabled.

### 404 Not Found

**Cause:** Resource ID does not exist or was deleted.

**Example response:**
```json
{
  "error": "not_found",
  "error_description": "User not found",
  "code": "resource_not_found"
}
```

**Fix:** Verify resource ID is correct. Check resource was not deleted. For user lookups, use email/external_id instead of ID if unsure.

### 409 Conflict

**Cause:** Resource already exists (e.g., user with duplicate email).

**Example response:**
```json
{
  "error": "conflict",
  "error_description": "User with this email already exists",
  "code": "duplicate_email"
}
```

**Fix:** For user creation, check if user exists first with `GET /user_management/users?email={email}`. For updates, use idempotent operations.

### 422 Unprocessable Entity

**Cause:** Request is syntactically valid but semantically incorrect (e.g., invalid email format).

**Example response:**
```json
{
  "error": "unprocessable_entity",
  "error_description": "Invalid email format",
  "code": "invalid_email_format"
}
```

**Fix:** Validate input format before sending. Common validation rules:
- Email: RFC 5322 compliant
- Password: Min 8 characters (check docs for current requirements)
- Role slug: Must match predefined roles in organization

### 429 Too Many Requests

**Cause:** Rate limit exceeded.

**Example response:**
```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Rate limit exceeded. Retry after 60 seconds",
  "code": "rate_limit_exceeded"
}
```

**Fix:** Implement exponential backoff. Check `Retry-After` header for wait time. Default rate limits documented at https://workos.com/docs/reference/authkit (check Step 1 docs for current limits).

### 500 Internal Server Error

**Cause:** WorkOS server error.

**Example response:**
```json
{
  "error": "internal_server_error",
  "error_description": "An unexpected error occurred",
  "code": "internal_error"
}
```

**Fix:** Retry request with exponential backoff. If persistent, contact WorkOS support with request ID from response headers.

## Rate Limiting

WorkOS enforces rate limits per API key. Check the fetched documentation for current limits.

**Retry strategy:**
1. Check for `429` status code
2. Read `Retry-After` header (seconds to wait)
3. Implement exponential backoff: `wait_time = min(2^attempt * 1s, 60s)`
4. Retry request after wait period

**Example retry logic:**
```bash
# Pseudo-code for retry with backoff
attempt=0
max_attempts=5

while [ $attempt -lt $max_attempts ]; do
  response=$(curl -w "%{http_code}" -X GET https://api.workos.com/user_management/users \
    -H "Authorization: Bearer sk_live_...")
  
  if [ "$response" -eq 200 ]; then
    break
  elif [ "$response" -eq 429 ]; then
    wait_time=$((2**attempt))
    sleep $wait_time
    ((attempt++))
  else
    # Handle other errors
    break
  fi
done
```

## Runnable Verification Commands

### Verify API Key

```bash
curl -X POST https://api.workos.com/user_management/api_keys/validate \
  -H "Authorization: Bearer sk_live_YourAPIKeyHere" \
  -H "Content-Type: application/json"
```

**Expected response (200 OK):**
```json
{
  "valid": true,
  "metadata": {
    "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "environment": "production"
  }
}
```

### Create Test User

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer sk_test_YourTestAPIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "first_name": "Test",
    "last_name": "User",
    "email_verified": true
  }'
```

**Expected response (201 Created):** User object with `id`, `email`, etc.

### List Users

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=5" \
  -H "Authorization: Bearer sk_test_YourTestAPIKey"
```

**Expected response (200 OK):** List object with `data` array and `list_metadata` for pagination.

### Get Authorization URL

```bash
curl -X GET "https://api.workos.com/user_management/authorize?client_id=client_YourClientID&redirect_uri=http://localhost:3000/callback&response_type=code" \
  -H "Authorization: Bearer sk_test_YourTestAPIKey"
```

**Expected response (200 OK):** JSON with `url` field pointing to AuthKit login page.

### Revoke Session (Logout)

```bash
curl -X POST https://api.workos.com/user_management/sessions/session_01H7ZGXFP5C6BBQY6Z7277ZCT0/revoke \
  -H "Authorization: Bearer sk_test_YourTestAPIKey" \
  -H "Content-Type: application/json"
```

**Expected response (200 OK):** Empty response body or success confirmation.

## Integration Checklist

- [ ] Fetch latest documentation (Step 1) before starting implementation
- [ ] API key configured in environment variables (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)
- [ ] Test API key validation endpoint returns `valid: true`
- [ ] Create test user succeeds with 201 status
- [ ] List users endpoint returns paginated results
- [ ] Authorization URL generation works (returns valid URL)
- [ ] Token exchange with test code succeeds (if testing full auth flow)
- [ ] Session revocation returns 200 status
- [ ] Error responses include `code` and `error_description` fields
- [ ] Rate limit handling implemented with exponential backoff
- [ ] Production API key (`sk_live_`) configured for production environment

## Related Skills

- **workos-feature-authkit** — High-level feature guide for implementing AuthKit in your application
- **workos-feature-directory-sync** — Sync user directories from identity providers
- **workos-feature-admin-portal** — Build admin interfaces for organization settings
