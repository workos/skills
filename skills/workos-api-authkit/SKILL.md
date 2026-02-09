---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- generated -->

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

All API requests require authentication using your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_test_abc123...
```

Set environment variables:
```bash
export WORKOS_API_KEY="sk_test_abc123..."
export WORKOS_CLIENT_ID="client_abc123..."
```

## Operation Decision Tree

**Choose the right endpoint based on your task:**

### User Management Operations
- **Create user** → `POST /user_management/users`
- **Get user by ID** → `GET /user_management/users/{user_id}`
- **Get user by external ID** → `GET /user_management/users/by_external_id/{external_id}`
- **Update user** → `PUT /user_management/users/{user_id}`
- **Delete user** → `DELETE /user_management/users/{user_id}`
- **List users** → `GET /user_management/users` (with pagination)

### Authentication Operations
- **Start auth flow** → `getAuthorizationUrl()` (SDK helper)
- **Exchange code for tokens** → `POST /user_management/authenticate` with `code` grant
- **Refresh session** → `POST /user_management/authenticate` with `refresh_token` grant
- **Get logout URL** → `getLogoutUrl()` (SDK helper)

### Session Management
- **List sessions** → `GET /user_management/sessions`
- **Revoke session** → `POST /user_management/sessions/{session_id}/revoke`
- **Validate session** → Use access token with `/user_management/users` endpoints

### Organization Membership
- **Add user to org** → `POST /user_management/organization_memberships`
- **Get membership** → `GET /user_management/organization_memberships/{membership_id}`
- **Update role** → `PUT /user_management/organization_memberships/{membership_id}`
- **Remove from org** → `DELETE /user_management/organization_memberships/{membership_id}`
- **Deactivate (soft delete)** → `POST /user_management/organization_memberships/{membership_id}/deactivate`
- **Reactivate** → `POST /user_management/organization_memberships/{membership_id}/reactivate`

### Invitation Management
- **Send invitation** → `POST /user_management/invitations`
- **List invitations** → `GET /user_management/invitations`
- **Get invitation** → `GET /user_management/invitations/{invitation_id}`
- **Find by token** → `GET /user_management/invitations/by_token/{token}`
- **Revoke invitation** → `POST /user_management/invitations/{invitation_id}/revoke`
- **Resend invitation** → `POST /user_management/invitations/{invitation_id}/send`

### Password Reset
- **Create reset** → `POST /user_management/password_reset`
- **Get reset details** → `GET /user_management/password_reset/{password_reset_id}`
- **Complete reset** → `POST /user_management/password_reset/confirm`

### Magic Auth
- **Create magic link** → `POST /user_management/magic_auth`
- **Get magic auth** → `GET /user_management/magic_auth/{magic_auth_id}`

### Email Verification
- **Get verification** → `GET /user_management/email_verification/{email_verification_id}`
- **Send verification code** → Triggered automatically on user creation

### MFA Operations
- **Enroll auth factor** → `POST /user_management/authentication_factors`
- **List factors** → `GET /user_management/authentication_factors`
- **Challenge MFA** → `POST /user_management/authentication_factors/{factor_id}/challenge`

### API Key Management
- **Create API key** → `POST /user_management/organizations/{org_id}/api_keys`
- **List API keys** → `GET /user_management/organizations/{org_id}/api_keys`
- **Validate API key** → `GET /user_management/api_keys/validate`
- **Delete API key** → `DELETE /user_management/api_keys/{api_key_id}`

### CLI Auth (Device Flow)
- **Initiate device auth** → `POST /user_management/device_authorization`
- **Poll for token** → `POST /user_management/device_code`

## Core Endpoint Patterns

### User CRUD Operations

**Create User**
```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true
  }'
```

Response (201):
```json
{
  "object": "user",
  "id": "user_01HXYZ...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Get User**
```bash
curl https://api.workos.com/user_management/users/user_01HXYZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Update User**
```bash
curl -X PUT https://api.workos.com/user_management/users/user_01HXYZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Janet",
    "email_verified": true
  }'
```

**Delete User**
```bash
curl -X DELETE https://api.workos.com/user_management/users/user_01HXYZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Response (202): Empty response with 202 Accepted status

**List Users (Paginated)**
```bash
curl "https://api.workos.com/user_management/users?limit=10&order=desc" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "list_metadata": {
    "before": "user_01HXYZ...",
    "after": "user_01HABC..."
  }
}
```

### Authentication Flow

**Get Authorization URL (SDK)**
```typescript
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://your-app.com/callback',
  state: 'optional-state-param'
});
```

**Exchange Code for Session**
```bash
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_abc123...",
    "code": "auth_code_from_callback",
    "grant_type": "authorization_code"
  }'
```

Response:
```json
{
  "user": {
    "object": "user",
    "id": "user_01HXYZ...",
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": true
  },
  "organization_id": "org_01HXYZ...",
  "access_token": "eyJhbGc...",
  "refresh_token": "KJxyz...",
  "authentication_method": "Password",
  "impersonator": null
}
```

**Refresh Token**
```bash
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_abc123...",
    "refresh_token": "KJxyz...",
    "grant_type": "refresh_token"
  }'
```

### Session Management

**List Sessions**
```bash
curl "https://api.workos.com/user_management/sessions?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Revoke Session**
```bash
curl -X POST https://api.workos.com/user_management/sessions/session_01HXYZ.../revoke \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Response (200):
```json
{
  "object": "session",
  "id": "session_01HXYZ...",
  "user_id": "user_01HXYZ...",
  "organization_id": "org_01HXYZ...",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:35:00.000Z"
}
```

### Organization Membership

**Create Membership**
```bash
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01HXYZ...",
    "organization_id": "org_01HXYZ...",
    "role_slug": "member"
  }'
```

Response (201):
```json
{
  "object": "organization_membership",
  "id": "om_01HXYZ...",
  "user_id": "user_01HXYZ...",
  "organization_id": "org_01HXYZ...",
  "role": {
    "slug": "member"
  },
  "status": "active",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Update Membership Role**
```bash
curl -X PUT https://api.workos.com/user_management/organization_memberships/om_01HXYZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "role_slug": "admin"
  }'
```

**Deactivate Membership (Soft Delete)**
```bash
curl -X POST https://api.workos.com/user_management/organization_memberships/om_01HXYZ.../deactivate \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**List Memberships (Paginated)**
```bash
curl "https://api.workos.com/user_management/organization_memberships?organization_id=org_01HXYZ...&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Invitation Management

**Send Invitation**
```bash
curl -X POST https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "organization_id": "org_01HXYZ...",
    "expires_in_days": 7,
    "inviter_user_id": "user_01HXYZ...",
    "role_slug": "member"
  }'
```

Response (201):
```json
{
  "object": "invitation",
  "id": "invitation_01HXYZ...",
  "email": "newuser@example.com",
  "state": "pending",
  "accepted_at": null,
  "revoked_at": null,
  "expires_at": "2024-01-22T10:30:00.000Z",
  "organization_id": "org_01HXYZ...",
  "inviter_user_id": "user_01HXYZ...",
  "token": "invite_token_abc123...",
  "accept_invitation_url": "https://your-app.com/invite/accept?token=invite_token_abc123...",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Find Invitation by Token**
```bash
curl https://api.workos.com/user_management/invitations/by_token/invite_token_abc123... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Revoke Invitation**
```bash
curl -X POST https://api.workos.com/user_management/invitations/invitation_01HXYZ.../revoke \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Resend Invitation**
```bash
curl -X POST https://api.workos.com/user_management/invitations/invitation_01HXYZ.../send \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Password Reset

**Create Password Reset**
```bash
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Response (201):
```json
{
  "object": "password_reset",
  "id": "password_reset_01HXYZ...",
  "user_id": "user_01HXYZ...",
  "email": "user@example.com",
  "password_reset_token": "reset_token_abc123...",
  "password_reset_url": "https://your-app.com/reset?token=reset_token_abc123...",
  "expires_at": "2024-01-15T11:30:00.000Z",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Complete Password Reset**
```bash
curl -X POST https://api.workos.com/user_management/password_reset/confirm \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_abc123...",
    "new_password": "new_secure_password_123"
  }'
```

Response (200):
```json
{
  "user": {
    "object": "user",
    "id": "user_01HXYZ...",
    "email": "user@example.com"
  }
}
```

### Magic Auth (Passwordless Login)

**Create Magic Auth**
```bash
curl -X POST https://api.workos.com/user_management/magic_auth \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Response (201):
```json
{
  "object": "magic_auth",
  "id": "magic_auth_01HXYZ...",
  "user_id": "user_01HXYZ...",
  "email": "user@example.com",
  "expires_at": "2024-01-15T10:40:00.000Z",
  "code": "123456",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### MFA Operations

**Enroll Authentication Factor**
```bash
curl -X POST https://api.workos.com/user_management/authentication_factors \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "totp",
    "totp_issuer": "YourApp",
    "totp_user": "user@example.com"
  }'
```

Response (201):
```json
{
  "object": "authentication_factor",
  "id": "auth_factor_01HXYZ...",
  "type": "totp",
  "totp": {
    "qr_code": "data:image/png;base64,...",
    "secret": "BASE32SECRETKEY",
    "uri": "otpauth://totp/YourApp:user@example.com?secret=BASE32SECRETKEY&issuer=YourApp"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Challenge MFA Factor**
```bash
curl -X POST https://api.workos.com/user_management/authentication_factors/auth_factor_01HXYZ.../challenge \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```

Response (200):
```json
{
  "challenge": {
    "object": "authentication_challenge",
    "id": "auth_challenge_01HXYZ...",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "expires_at": "2024-01-15T10:40:00.000Z",
    "authentication_factor_id": "auth_factor_01HXYZ..."
  },
  "valid": true
}
```

### API Key Management

**Create API Key for Organization**
```bash
curl -X POST https://api.workos.com/user_management/organizations/org_01HXYZ.../api_keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key"
  }'
```

Response (201):
```json
{
  "object": "api_key",
  "id": "api_key_01HXYZ...",
  "name": "Production Key",
  "secret": "sk_live_abc123...",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Validate API Key**
```bash
curl https://api.workos.com/user_management/api_keys/validate \
  -H "Authorization: Bearer sk_live_abc123..."
```

Response (200):
```json
{
  "valid": true,
  "organization_id": "org_01HXYZ..."
}
```

**Delete API Key**
```bash
curl -X DELETE https://api.workos.com/user_management/api_keys/api_key_01HXYZ... \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Response (204): Empty response

### CLI Auth (Device Flow)

**Initiate Device Authorization**
```bash
curl -X POST https://api.workos.com/user_management/device_authorization \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_abc123..."
  }'
```

Response (200):
```json
{
  "device_code": "device_abc123...",
  "user_code": "ABCD-EFGH",
  "verification_uri": "https://auth.workos.com/activate",
  "verification_uri_complete": "https://auth.workos.com/activate?user_code=ABCD-EFGH",
  "expires_in": 600,
  "interval": 5
}
```

**Poll for Token**
```bash
curl -X POST https://api.workos.com/user_management/device_code \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_abc123...",
    "device_code": "device_abc123...",
    "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
  }'
```

Response (200 when authorized):
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "KJxyz...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Pagination Pattern

All list endpoints support cursor-based pagination:

```bash
# First page
curl "https://api.workos.com/user_management/users?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Next page using 'after' cursor
curl "https://api.workos.com/user_management/users?limit=10&after=user_01HABC..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Previous page using 'before' cursor
curl "https://api.workos.com/user_management/users?limit=10&before=user_01HXYZ..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Additional filters available:
- `organization_id` — Filter by organization
- `order` — `asc` or `desc` (default: `desc`)
- `email` — Exact email match

## Error Handling

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response data |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Async operation initiated (e.g., user deletion) |
| 204 | No Content | Operation successful, no response body |
| 400 | Bad Request | Check request parameters and body format |
| 401 | Unauthorized | Verify API key is valid and starts with `sk_` |
| 403 | Forbidden | Check API key has required permissions |
| 404 | Not Found | Verify resource ID exists |
| 409 | Conflict | Resource already exists or constraint violation |
| 422 | Unprocessable | Validation failed, check error details |
| 429 | Rate Limited | Wait and retry with exponential backoff |
| 500 | Server Error | WorkOS issue, retry with backoff |
| 503 | Service Unavailable | Temporary outage, retry with backoff |

### Authentication Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthorized",
  "code": "unauthorized",
  "error": "invalid_api_key"
}
```
**Fix:** Verify API key format (`sk_test_...` or `sk_live_...`) and check it's active in dashboard

**403 Forbidden**
```json
{
  "message": "Forbidden",
  "code": "forbidden",
  "error": "insufficient_permissions"
}
```
**Fix:** Check API key scopes in WorkOS dashboard match required permissions

### Validation Error Responses

**422 Unprocessable Entity**
```json
{
  "message": "Validation failed",
  "code": "invalid_request",
  "errors": [
    {
      "field": "email",
      "code": "invalid_email",
      "message": "Email format is invalid"
    }
  ]
}
```

Common validation errors:
- `invalid_email` — Email format incorrect
- `email_already_exists` — User with email already exists
- `required_field` — Required field missing
- `invalid_organization_id` — Organization doesn't exist
- `invalid_user_id` — User doesn't exist
- `invalid_role_slug` — Role not defined in organization
- `expired_token` — Password reset or invitation expired
- `invalid_verification_code` — MFA code incorrect or expired

### Authentication Flow Errors

**Email Verification Required**
```json
{
  "error": "email_verification_required",
  "error_description": "User must verify their email before authenticating",
  "email_verification": {
    "id": "email_verification_01HXYZ...",
    "user_id": "user_01HXYZ...",
    "email": "user@example.com",
    "expires_at": "2024-01-15T11:30:00.000Z"
  }
}
```
**Fix:** Prompt user to check email and verify, or resend verification

**MFA Challenge Required**
```json
{
  "error": "mfa_challenge",
  "error_description": "User must complete MFA challenge",
  "authentication_challenge_id": "auth_challenge_01HXYZ...",
  "authentication_factor_id": "auth_factor_01HXYZ..."
}
```
**Fix:** Present MFA input UI and submit challenge with code

**Organization Selection Required**
```json
{
  "error": "organization_selection_required",
  "error_description": "User belongs to multiple organizations",
  "organizations": [
    {"id": "org_01HXYZ...", "name": "Company A"},
    {"id": "org_01HABC...", "name": "Company B"}
  ]
}
```
**Fix:** Show organization picker and retry with `organization_id` parameter

**SSO Required**
```json
{
  "error": "sso_required",
  "error_description": "Organization requires SSO authentication",
  "organization_id": "org_01HXYZ...",
  "sso_url": "https://sso.workos.com/..."
}
```
**Fix:** Redirect user to SSO URL

### Rate Limiting

WorkOS rate limits are applied per API key:
- **User-facing operations:** 100 requests per 10 seconds
- **Background operations:** 1000 requests per 10 seconds

Rate limit headers in response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704454800
```

**429 Rate Limited Response**
```json
{
  "message": "Rate limit exceeded",
  "code": "rate_limit_exceeded",
  "retry_after": 5
}
```

**Retry Strategy:**
```bash
# Exponential backoff with jitter
RETRY_AFTER=$(curl -I ... | grep -i retry-after | cut -d' ' -f2)
sleep $((RETRY_AFTER + RANDOM % 5))
```

## Verification Commands

### Quick Health Check
```bash
# Verify API credentials
curl https://api.workos.com/user_management/users?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected output includes `HTTP Status: 200`

### End-to-End User Flow Test
```bash
#!/bin/bash
set -e

# 1. Create user
USER_RESPONSE=$(curl -s -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "email_verified": true
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
echo "✓ Created user: $USER_ID"

# 2. Get user
curl -s https://api.workos.com/user_management/users/$USER_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.email'

echo "✓ Retrieved user"

# 3. Update user
curl -s -X PUT https://api.workos.com/user_management/users/$USER_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Updated"}' | jq '.first_name'

echo "✓ Updated user"

# 4. Create organization membership
ORG_ID="org_01HXYZ..." # Replace with your org ID
MEMBERSHIP_RESPONSE=$(curl -s -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"organization_id\": \"$ORG_ID\",
    \"role_slug\": \"member\"
  }")

MEMBERSHIP_ID=$(echo $MEMBERSHIP_RESPONSE | jq -r '.id')
echo "✓ Created membership: $MEMBERSHIP_ID"

# 5. List user's memberships
curl -s "https://api.workos.com/user_management/organization_memberships?user_id=$USER_ID" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.data | length'

echo "✓ Listed memberships"

# 6. Delete membership
curl -s -X DELETE https://api.workos.com/user_management/organization_memberships/$MEMBERSHIP_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

echo "✓ Deleted membership"

# 7. Delete user
curl -s -X DELETE https://api.workos.com/user_management/users/$USER_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

echo "✓ Deleted user"
echo "All tests passed!"
```

### SDK Verification (Node.js)
```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function verifyIntegration() {
  // 1. Test user creation
  const user = await workos.userManagement.createUser({
    email: 'sdk-test@example.com',
    firstName: 'SDK',
    lastName: 'Test',
    emailVerified: true,
  });
  console.log('✓ Created user:', user.id);

  // 2. Test user retrieval
  const fetchedUser = await workos.userManagement.getUser(user.id);
  console.log('✓ Retrieved user:', fetchedUser.email);

  // 3. Test authorization URL generation
  const authUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: 'http://localhost:3000/callback',
  });
  console.log('✓ Generated auth URL:', authUrl);

  // 4. Test user deletion
  await workos.userManagement.deleteUser(
