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

Set your API key as a bearer token in all requests:

```bash
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json"
```

SDK configuration:

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

## Endpoint Catalog

### Authentication Operations

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/authorize` | GET | Generate authorization URL for OAuth flow |
| `/sso/token` | POST | Exchange authorization code for tokens |
| `/user_management/authenticate` | POST | Authenticate with code from callback |
| `/user_management/sessions/{session_id}` | DELETE | Revoke a user session |

### User Management

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/users` | GET | List users with pagination |
| `/user_management/users` | POST | Create a new user |
| `/user_management/users/{user_id}` | GET | Get user by ID |
| `/user_management/users/{user_id}` | PUT | Update user attributes |
| `/user_management/users/{user_id}` | DELETE | Delete user permanently |

### Organization Membership

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/organization_memberships` | GET | List memberships |
| `/user_management/organization_memberships` | POST | Add user to organization |
| `/user_management/organization_memberships/{id}` | DELETE | Remove user from organization |
| `/user_management/organization_memberships/{id}/deactivate` | POST | Deactivate membership |
| `/user_management/organization_memberships/{id}/reactivate` | POST | Reactivate membership |

### Invitations

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/invitations` | GET | List pending invitations |
| `/user_management/invitations` | POST | Send invitation email |
| `/user_management/invitations/{id}` | GET | Get invitation details |
| `/user_management/invitations/{id}/revoke` | POST | Cancel invitation |

### MFA Operations

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/authentication_factors` | GET | List enrolled MFA factors |
| `/user_management/authentication_factors` | POST | Enroll new MFA factor |
| `/user_management/challenges` | POST | Create MFA challenge |
| `/user_management/challenges/{id}/verify` | POST | Verify MFA challenge response |

### Magic Auth

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/magic_auth` | POST | Send magic link email |
| `/user_management/magic_auth/{id}` | GET | Check magic auth status |

### Password Reset

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/password_reset` | POST | Initiate password reset flow |
| `/user_management/password_reset/{id}` | GET | Get reset token details |
| `/user_management/password_reset/confirm` | POST | Complete password reset |

### Email Verification

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/email_verification/{id}` | GET | Get verification status |
| `/user_management/email_verification/confirm` | POST | Confirm email verification |

### CLI Auth (Device Flow)

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/user_management/device_authorization` | POST | Start device authorization |
| `/user_management/device_token` | POST | Poll for token with device code |

## Operation Decision Tree

### Authentication Flow
- **Starting OAuth flow** → GET `/user_management/authorize` → Generate authorization URL
- **Handling callback** → POST `/user_management/authenticate` with code → Receive tokens
- **Refreshing session** → Use refresh token with SDK `refreshSession()` method
- **Logging out** → DELETE `/user_management/sessions/{session_id}`

### User CRUD
- **Create new user** → POST `/user_management/users` with `email`, `password`, `firstName`, `lastName`
- **Find existing user** → GET `/user_management/users/{user_id}` OR GET `/user_management/users?email={email}`
- **Update user** → PUT `/user_management/users/{user_id}` with fields to change
- **Delete user** → DELETE `/user_management/users/{user_id}` (permanent)

### Organization Membership
- **Add user to org** → POST `/user_management/organization_memberships` with `user_id` and `organization_id`
- **Remove from org** → DELETE `/user_management/organization_memberships/{membership_id}`
- **Soft deactivate** → POST `/user_management/organization_memberships/{id}/deactivate`
- **Reactivate** → POST `/user_management/organization_memberships/{id}/reactivate`

### Invitations
- **Invite new user** → POST `/user_management/invitations` with `email` and `organization_id`
- **Check invite status** → GET `/user_management/invitations/{invitation_id}`
- **Cancel invite** → POST `/user_management/invitations/{invitation_id}/revoke`
- **Resend invite** → Send new invitation (no dedicated endpoint, create new)

### MFA Enrollment
- **User enrolls MFA** → POST `/user_management/authentication_factors` with `type: totp` and `totp_issuer`
- **Challenge at login** → POST `/user_management/challenges` with `authentication_factor_id`
- **Verify challenge** → POST `/user_management/challenges/{challenge_id}/verify` with `code`

## Request/Response Patterns

### Create User

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_verified": false
  }'
```

Response:
```json
{
  "object": "user",
  "id": "user_01HXYZ...",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": false,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Authorization URL

```bash
curl -X GET "https://api.workos.com/user_management/authorize?client_id=client_123&redirect_uri=https://app.com/callback&response_type=code&provider=authkit" \
  -H "Authorization: Bearer sk_live_..."
```

Response:
```json
{
  "url": "https://auth.workos.com/sso/authorize?client_id=client_123&..."
}
```

### Authenticate with Code

```bash
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_123",
    "code": "01HXYZ...",
    "code_verifier": "challenge_verifier"
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
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "refresh_01HXYZ..."
}
```

### Send Invitation

```bash
curl -X POST https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "organization_id": "org_01HXYZ...",
    "expires_in_days": 7
  }'
```

Response:
```json
{
  "object": "invitation",
  "id": "invitation_01HXYZ...",
  "email": "newuser@example.com",
  "state": "pending",
  "organization_id": "org_01HXYZ...",
  "expires_at": "2024-01-22T10:30:00.000Z",
  "token": "inv_token_abc123...",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

## Pagination Handling

List endpoints support cursor-based pagination:

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=10&after=user_01HXYZ..." \
  -H "Authorization: Bearer sk_live_..."
```

Response includes `list_metadata`:
```json
{
  "data": [...],
  "list_metadata": {
    "after": "user_01HXYZ...",
    "before": null
  }
}
```

To fetch next page, pass `after` value as query parameter. Continue until `after` is `null`.

## Error Code Mapping

### 400 Bad Request

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `invalid_request` | Missing required field | Check request payload against docs |
| `invalid_email` | Malformed email address | Validate email format before sending |
| `invalid_password` | Password too weak | Enforce min 8 chars with complexity |
| `duplicate_email` | User already exists | Check if user exists before creating |

### 401 Unauthorized

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `invalid_credentials` | Wrong email/password | Prompt user to retry or reset password |
| `invalid_api_key` | Missing or wrong API key | Verify `WORKOS_API_KEY` is set and starts with `sk_` |
| `expired_token` | Access token expired | Refresh using refresh token |

### 403 Forbidden

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `insufficient_permissions` | API key lacks permission | Check key scopes in WorkOS Dashboard |
| `organization_membership_required` | User not in org | Add user to org before granting access |

### 404 Not Found

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `user_not_found` | User ID doesn't exist | Verify user ID or search by email |
| `organization_not_found` | Org ID doesn't exist | Verify organization ID |
| `invitation_not_found` | Invitation revoked or expired | Check invitation status before accepting |

### 409 Conflict

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `user_already_exists` | Email already registered | Use GET to retrieve existing user |
| `membership_already_exists` | User already in org | Skip creation or update existing membership |

### 422 Unprocessable Entity

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `email_verification_required` | Email not verified | Send verification email, wait for confirmation |
| `mfa_enrollment_required` | MFA not enrolled | Prompt user to enroll MFA factor |
| `sso_required` | Org requires SSO | Redirect to SSO authorization URL |

### 429 Too Many Requests

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `rate_limit_exceeded` | Too many requests | Implement exponential backoff, max 5 retries |

### 500 Internal Server Error

| Error Code | Cause | Fix |
| ---------- | ----- | --- |
| `internal_error` | WorkOS service issue | Retry with exponential backoff, contact support if persistent |

## Rate Limits

- **Default limit**: 100 requests/second per API key
- **Burst allowance**: Up to 200 requests in 10-second window
- **Response headers**: Check `X-RateLimit-Remaining` and `X-RateLimit-Reset`

Retry strategy:
```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Runnable Verification Commands

### Verify API Key

```bash
curl -X GET https://api.workos.com/user_management/users?limit=1 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with user list (may be empty).

### Test User Creation

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```

Expected: 201 response with user object containing `id`, `email`, `created_at`.

### Test Authorization URL Generation

```bash
curl -X GET "https://api.workos.com/user_management/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=https://localhost:3000/callback&response_type=code&provider=authkit" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with `url` field containing WorkOS hosted auth page.

### Test Session Revocation

```bash
# First authenticate to get session_id, then:
curl -X DELETE https://api.workos.com/user_management/sessions/session_01HXYZ... \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 204 No Content response.

## SDK Usage Examples

### Node.js (JavaScript/TypeScript)

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create user
const user = await workos.userManagement.createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'Jane',
  lastName: 'Doe',
});

// Get authorization URL
const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://app.com/callback',
});

// Authenticate with code
const { user, organizationId } = await workos.userManagement.authenticateWithCode({
  code: req.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// List users with pagination
const { data: users, listMetadata } = await workos.userManagement.listUsers({
  limit: 10,
  after: 'user_01HXYZ...',
});
```

### Python

```python
from workos import WorkOS

workos = WorkOS(api_key=os.environ['WORKOS_API_KEY'])

# Create user
user = workos.user_management.create_user(
    email='user@example.com',
    password='SecurePass123!',
    first_name='Jane',
    last_name='Doe',
)

# Get authorization URL
authorization_url = workos.user_management.get_authorization_url(
    provider='authkit',
    client_id=os.environ['WORKOS_CLIENT_ID'],
    redirect_uri='https://app.com/callback',
)

# Authenticate with code
auth_response = workos.user_management.authenticate_with_code(
    code=request.args.get('code'),
    client_id=os.environ['WORKOS_CLIENT_ID'],
)
```

### Ruby

```ruby
require 'workos'

WorkOS.key = ENV['WORKOS_API_KEY']

# Create user
user = WorkOS::UserManagement.create_user(
  email: 'user@example.com',
  password: 'SecurePass123!',
  first_name: 'Jane',
  last_name: 'Doe',
)

# Get authorization URL
authorization_url = WorkOS::UserManagement.authorization_url(
  provider: 'authkit',
  client_id: ENV['WORKOS_CLIENT_ID'],
  redirect_uri: 'https://app.com/callback',
)

# Authenticate with code
auth_response = WorkOS::UserManagement.authenticate_with_code(
  code: params[:code],
  client_id: ENV['WORKOS_CLIENT_ID'],
)
```

## Related Skills

- **workos-authkit-base** — Core AuthKit integration patterns and session management
- **workos-authkit-nextjs** — Next.js-specific AuthKit implementation
- **workos-authkit-react** — React hooks and components for AuthKit
- **workos-authkit-react-router** — React Router integration
- **workos-authkit-vanilla-js** — Pure JavaScript AuthKit implementation
- **workos-mfa** — Multi-factor authentication setup and verification
- **workos-magic-link** — Passwordless magic link authentication
- **workos-sso** — Single Sign-On integration patterns
- **workos-api-organization** — Organization management endpoints
- **workos-admin-portal** — Self-service admin portal configuration
