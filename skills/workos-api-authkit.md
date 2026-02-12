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

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_test_..."
export WORKOS_CLIENT_ID="client_..."
```

All API requests require authentication via Bearer token in the Authorization header:

```bash
Authorization: Bearer sk_test_...
```

## Operation Decision Tree

### User Management

- **Create user** → POST `/user_management/users`
- **Get user by ID** → GET `/user_management/users/:id`
- **Get user by external ID** → GET `/user_management/users/by_external_id/:external_id`
- **Update user** → PUT `/user_management/users/:id`
- **Delete user** → DELETE `/user_management/users/:id`
- **List users** → GET `/user_management/users`

### Authentication Flow

- **Start auth flow** → Generate authorization URL via SDK (`getAuthorizationUrl`)
- **Complete auth** → Exchange code for session via SDK (`authenticateWithCode`)
- **Refresh session** → POST `/user_management/sessions/refresh` or SDK method
- **Logout** → Generate logout URL via SDK (`getLogoutUrl`)

### Session Management

- **List user sessions** → GET `/user_management/sessions`
- **Revoke session** → POST `/user_management/sessions/:id/revoke`

### Organization Membership

- **Create membership** → POST `/user_management/organization_memberships`
- **Get membership** → GET `/user_management/organization_memberships/:id`
- **Update membership** → PUT `/user_management/organization_memberships/:id`
- **Delete membership** → DELETE `/user_management/organization_memberships/:id`
- **Deactivate membership** → POST `/user_management/organization_memberships/:id/deactivate`
- **Reactivate membership** → POST `/user_management/organization_memberships/:id/reactivate`

### Invitations

- **Send invitation** → POST `/user_management/invitations`
- **Get invitation** → GET `/user_management/invitations/:id`
- **Find by token** → GET `/user_management/invitations/by_token/:token`
- **Resend invitation** → POST `/user_management/invitations/:id/resend`
- **Revoke invitation** → POST `/user_management/invitations/:id/revoke`

### MFA Management

- **Enroll auth factor** → POST `/user_management/authentication_factors`
- **List auth factors** → GET `/user_management/authentication_factors`

### Magic Auth

- **Create magic auth** → POST `/user_management/magic_auth`
- **Get magic auth status** → GET `/user_management/magic_auth/:id`

### Password Reset

- **Create password reset** → POST `/user_management/password_reset`
- **Get password reset** → GET `/user_management/password_reset/:id`
- **Complete password reset** → POST `/user_management/password_reset/confirm`

### Email Verification

- **Get verification status** → GET `/user_management/email_verification/:id`

### API Keys (Organization-specific)

- **Create API key** → POST `/user_management/organizations/:org_id/api_keys`
- **List API keys** → GET `/user_management/organizations/:org_id/api_keys`
- **Validate API key** → POST `/user_management/api_keys/validate`
- **Delete API key** → DELETE `/user_management/api_keys/:id`

### CLI Auth

- **Initiate device flow** → POST `/user_management/cli_auth/device_authorization`
- **Poll for token** → POST `/user_management/cli_auth/device_code`

## Core Endpoint Patterns

### Create User

```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": false
  }'
```

**Response (201 Created):**

```json
{
  "object": "user",
  "id": "user_01H7ZKWQ23...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": false,
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z"
}
```

### Get User

```bash
curl https://api.workos.com/user_management/users/user_01H7ZKWQ23... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**

```json
{
  "object": "user",
  "id": "user_01H7ZKWQ23...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true
}
```

### List Users (Paginated)

```bash
curl "https://api.workos.com/user_management/users?limit=10&after=user_01H7..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "object": "user",
      "id": "user_01H7...",
      "email": "user@example.com"
    }
  ],
  "list_metadata": {
    "after": "user_01H7ZKWQ23...",
    "before": null
  }
}
```

**Pagination pattern:** Use `after` cursor from `list_metadata` for next page. Stop when `data` is empty.

### Create Organization Membership

```bash
curl https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7...",
    "organization_id": "org_01H5...",
    "role_slug": "member"
  }'
```

**Response (201 Created):**

```json
{
  "object": "organization_membership",
  "id": "om_01H8...",
  "user_id": "user_01H7...",
  "organization_id": "org_01H5...",
  "role": {
    "slug": "member"
  },
  "status": "active"
}
```

### Send Invitation

```bash
curl https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "organization_id": "org_01H5...",
    "expires_in_days": 7
  }'
```

**Response (201 Created):**

```json
{
  "object": "invitation",
  "id": "invitation_01H9...",
  "email": "newuser@example.com",
  "state": "pending",
  "organization_id": "org_01H5...",
  "expires_at": "2024-01-22T12:00:00.000Z",
  "token": "inv_token_..."
}
```

### Revoke Session

```bash
curl -X POST https://api.workos.com/user_management/sessions/session_01HA.../revoke \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**

```json
{
  "object": "session",
  "id": "session_01HA...",
  "user_id": "user_01H7...",
  "status": "revoked"
}
```

### Create Magic Auth

```bash
curl https://api.workos.com/user_management/magic_auth \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response (201 Created):**

```json
{
  "object": "magic_auth",
  "id": "magic_auth_01HB...",
  "user_id": "user_01H7...",
  "email": "user@example.com",
  "expires_at": "2024-01-15T12:10:00.000Z"
}
```

### Enroll MFA Factor

```bash
curl https://api.workos.com/user_management/authentication_factors \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7...",
    "type": "totp"
  }'
```

**Response (201 Created):**

```json
{
  "object": "authentication_factor",
  "id": "auth_factor_01HC...",
  "user_id": "user_01H7...",
  "type": "totp",
  "totp": {
    "qr_code": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "uri": "otpauth://totp/..."
  }
}
```

### Create Password Reset

```bash
curl https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response (201 Created):**

```json
{
  "object": "password_reset",
  "id": "password_reset_01HD...",
  "user_id": "user_01H7...",
  "email": "user@example.com",
  "expires_at": "2024-01-15T13:00:00.000Z",
  "password_reset_token": "pr_token_...",
  "password_reset_url": "https://auth.workos.com/..."
}
```

### Validate API Key

```bash
curl -X POST https://api.workos.com/user_management/api_keys/validate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_secret": "sk_org_..."
  }'
```

**Response (200 OK):**

```json
{
  "valid": true
}
```

### CLI Device Authorization

```bash
curl -X POST https://api.workos.com/user_management/cli_auth/device_authorization \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_...",
    "scope": "openid profile email"
  }'
```

**Response (200 OK):**

```json
{
  "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://auth.workos.com/activate",
  "verification_uri_complete": "https://auth.workos.com/activate?user_code=WDJB-MJHT",
  "expires_in": 900,
  "interval": 5
}
```

## Error Code Mapping

### 400 Bad Request

- **invalid_request**: Missing required parameter → Check request body includes all required fields
- **invalid_email**: Email format invalid → Validate email before sending
- **duplicate_user**: User with email already exists → Use GET to check existence first or handle 409

### 401 Unauthorized

- **invalid_api_key**: API key is invalid or expired → Verify `WORKOS_API_KEY` starts with `sk_` and is active in dashboard
- **missing_authorization**: Authorization header missing → Add `Authorization: Bearer ${WORKOS_API_KEY}` header

### 403 Forbidden

- **insufficient_permissions**: API key lacks required scope → Check API key permissions in WorkOS dashboard under Settings > API Keys
- **organization_access_denied**: Cannot access this organization → Verify organization ID is correct and API key has access

### 404 Not Found

- **user_not_found**: User ID does not exist → Verify user ID is correct, check for typos
- **organization_membership_not_found**: Membership ID does not exist → List memberships first to get valid IDs
- **invitation_not_found**: Invitation ID does not exist or expired → Check invitation was created and hasn't expired

### 409 Conflict

- **duplicate_user**: User already exists with this email → Use update endpoint or GET user first
- **active_membership_exists**: User already has active membership → Deactivate existing membership before creating new one

### 422 Unprocessable Entity

- **email_not_verified**: Email verification required → Send verification email via POST `/user_management/email_verification`
- **mfa_required**: MFA challenge must be completed → Handle MFA enrollment flow before proceeding
- **organization_selection_required**: User belongs to multiple orgs → Prompt user to select organization

### 429 Too Many Requests

- **rate_limit_exceeded**: Too many requests in time window → Implement exponential backoff (start with 1s, max 60s)
- Retry-After header indicates seconds to wait before retry

### 500 Internal Server Error

- **internal_error**: WorkOS service issue → Retry with exponential backoff, check status page

### 503 Service Unavailable

- **service_unavailable**: WorkOS temporarily unavailable → Retry after delay indicated in Retry-After header

## Rate Limiting

WorkOS enforces rate limits per API key:

- **User Management endpoints**: 100 requests/minute
- **Authentication endpoints**: 300 requests/minute

**Retry strategy:**

```
attempt = 0
max_attempts = 3
base_delay = 1  # second

while attempt < max_attempts:
    response = make_request()
    if response.status == 429:
        wait_time = min(base_delay * (2 ** attempt), 60)
        sleep(wait_time)
        attempt += 1
    else:
        break
```

## Verification Commands

### Test API Key

```bash
curl https://api.workos.com/user_management/users?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 200 with user list or empty array

### Test User Creation

```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@example.com",
    "first_name": "Test",
    "last_name": "User"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 201 with user object containing `id` field

### Test Invitation Flow

```bash
# Create invitation
INVITATION=$(curl -s https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invite-test@example.com",
    "organization_id": "org_01H5..."
  }')

INVITATION_ID=$(echo $INVITATION | jq -r '.id')

# Verify invitation exists
curl "https://api.workos.com/user_management/invitations/${INVITATION_ID}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 200 with invitation state "pending"

### Test Session Revocation

```bash
# List sessions
SESSIONS=$(curl -s "https://api.workos.com/user_management/sessions?limit=1" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}")

SESSION_ID=$(echo $SESSIONS | jq -r '.data[0].id')

# Revoke session
curl -X POST "https://api.workos.com/user_management/sessions/${SESSION_ID}/revoke" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 200 with session status "revoked"

## SDK Usage Patterns

### Initialize SDK

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### Create User

```javascript
const user = await workos.userManagement.createUser({
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  emailVerified: false,
});
```

### Get Authorization URL

```javascript
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: "authkit",
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: "custom_state",
});
```

### Authenticate with Code

```javascript
const { user, organizationId, accessToken, refreshToken } =
  await workos.userManagement.authenticateWithCode({
    code: req.query.code,
    clientId: process.env.WORKOS_CLIENT_ID,
  });
```

### List Organization Memberships

```javascript
const memberships = await workos.userManagement.listOrganizationMemberships({
  userId: "user_01H7...",
  limit: 10,
});

// Paginate through results
let after = memberships.listMetadata.after;
while (after) {
  const nextPage = await workos.userManagement.listOrganizationMemberships({
    userId: "user_01H7...",
    limit: 10,
    after: after,
  });
  after = nextPage.listMetadata.after;
}
```

## Common Integration Patterns

### Email Verification Required Flow

When authentication returns `email_verification_required`:

1. Send verification email:

```bash
curl https://api.workos.com/user_management/email_verification \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "user_01H7..." }'
```

2. User clicks link in email
3. Redirect to callback with verified status
4. Retry authentication

### MFA Enrollment Flow

When authentication returns `mfa_enrollment_required`:

1. Enroll TOTP factor (see endpoint above)
2. Display QR code to user
3. User scans with authenticator app
4. Verify first code:

```bash
curl -X POST https://api.workos.com/user_management/authentication_factors/:id/challenge \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "code": "123456" }'
```

5. Complete authentication

### Organization Selection Flow

When user belongs to multiple organizations:

1. List user's memberships:

```bash
curl "https://api.workos.com/user_management/organization_memberships?user_id=user_01H7..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

2. Display organizations to user
3. Re-authenticate with selected organization:

```javascript
const authUrl = workos.userManagement.getAuthorizationUrl({
  organizationId: "org_01H5...",
  // ... other params
});
```

## Related Skills

- workos-authkit-base
- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
