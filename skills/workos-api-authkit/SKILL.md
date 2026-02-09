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

All API requests require a bearer token in the `Authorization` header:

```bash
Authorization: Bearer sk_test_xxxxxxxxxxxx
```

Obtain your API key from the WorkOS Dashboard under API Keys. Use `sk_test_` keys for development and `sk_live_` keys for production.

## Operation Decision Tree

**User Management**
- Create new user → `POST /user_management/users`
- Retrieve user by ID → `GET /user_management/users/{user_id}`
- Retrieve user by external ID → `GET /user_management/users/by_external_id/{external_id}`
- Update user → `PUT /user_management/users/{user_id}`
- Delete user → `DELETE /user_management/users/{user_id}`
- List all users → `GET /user_management/users`

**Authentication Flow**
- Generate authorization URL → Use SDK method with client ID and redirect URI
- Exchange authorization code → Use SDK method with code from callback
- Refresh access token → Use SDK method with refresh token
- Revoke session → `POST /user_management/sessions/revoke`

**Organization Membership**
- Add user to organization → `POST /user_management/organization_memberships`
- Get membership → `GET /user_management/organization_memberships/{membership_id}`
- Update membership role → `PUT /user_management/organization_memberships/{membership_id}`
- Remove user from organization → `DELETE /user_management/organization_memberships/{membership_id}`
- Deactivate membership (preserve data) → `POST /user_management/organization_memberships/{membership_id}/deactivate`
- Reactivate membership → `POST /user_management/organization_memberships/{membership_id}/reactivate`
- List organization members → `GET /user_management/organization_memberships`

**Invitations**
- Send invitation → `POST /user_management/invitations`
- Get invitation by ID → `GET /user_management/invitations/{invitation_id}`
- Find invitation by token → `GET /user_management/invitations/by_token/{token}`
- List invitations → `GET /user_management/invitations`
- Resend invitation → `POST /user_management/invitations/{invitation_id}/resend`
- Revoke invitation → `POST /user_management/invitations/{invitation_id}/revoke`

**MFA Enrollment**
- Enroll TOTP factor → `POST /user_management/authentication_factors/enroll_totp`
- List user's auth factors → `GET /user_management/authentication_factors`

**Magic Auth**
- Create magic auth session → `POST /user_management/magic_auth`
- Get magic auth status → `GET /user_management/magic_auth/{magic_auth_id}`

**Password Reset**
- Create password reset → `POST /user_management/password_reset`
- Get password reset → `GET /user_management/password_reset/{password_reset_id}`
- Complete password reset → `POST /user_management/password_reset/confirm`

**Email Verification**
- Get email verification status → `GET /user_management/email_verification/{email_verification_id}`

**API Key Management**
- Create organization API key → `POST /user_management/api_keys`
- List organization API keys → `GET /user_management/api_keys`
- Validate API key → `POST /user_management/api_keys/validate`
- Delete API key → `DELETE /user_management/api_keys/{api_key_id}`

**CLI Authentication**
- Initiate device authorization → `POST /user_management/device_authorization`
- Poll for device code → `POST /user_management/device_authorization/token`

## Core Endpoint Patterns

### Create User

```bash
POST https://api.workos.com/user_management/users
Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json

{
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true
}
```

**Response (201 Created):**
```json
{
  "object": "user",
  "id": "user_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### List Users (with Pagination)

```bash
GET https://api.workos.com/user_management/users?limit=10&after=user_01HWEY2MFJ38C8C9ZG0FC43RPP
Authorization: Bearer sk_test_xxxxxxxxxxxx
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "user",
      "id": "user_01HWEY2MFJ38C8C9ZG0FC43RPP",
      "email": "user@example.com"
    }
  ],
  "list_metadata": {
    "after": "user_01HWEY2MFJ38C8C9ZG0FC43RPP",
    "before": null
  }
}
```

Pagination uses cursor-based navigation with `after` and `before` parameters. Include `limit` (max 100) to control page size.

### Send Invitation

```bash
POST https://api.workos.com/user_management/invitations
Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json

{
  "email": "newuser@example.com",
  "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "expires_in_days": 7,
  "inviter_user_id": "user_01HWEY2MFJ38C8C9ZG0FC43RPP"
}
```

**Response (201 Created):**
```json
{
  "object": "invitation",
  "id": "invitation_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "email": "newuser@example.com",
  "state": "pending",
  "token": "Z1uX3RbwcIl5fIGJJJCXXisdI",
  "accept_invitation_url": "https://your-app.com/invite?invitation_token=Z1uX3RbwcIl5fIGJJJCXXisdI",
  "expires_at": "2024-01-08T00:00:00.000Z",
  "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Revoke Session

```bash
POST https://api.workos.com/user_management/sessions/revoke
Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json

{
  "session_id": "session_01HWEY2MFJ38C8C9ZG0FC43RPP"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

### Create Organization Membership

```bash
POST https://api.workos.com/user_management/organization_memberships
Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json

{
  "user_id": "user_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "role_slug": "member"
}
```

**Response (201 Created):**
```json
{
  "object": "organization_membership",
  "id": "om_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "user_id": "user_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "role": {
    "slug": "member"
  },
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Validate API Key

```bash
POST https://api.workos.com/user_management/api_keys/validate
Authorization: Bearer sk_test_xxxxxxxxxxxx
Content-Type: application/json

{
  "api_key": "sk_org_xxxxxxxxxxxx"
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP"
}
```

## Error Codes and Recovery

### 400 Bad Request

**Cause:** Invalid request parameters or missing required fields.

**Example Response:**
```json
{
  "error": "invalid_request",
  "error_description": "email is required",
  "code": "invalid_request"
}
```

**Fix:** Check request body against API documentation. Ensure all required fields are present and correctly formatted.

### 401 Unauthorized

**Cause:** Missing or invalid API key.

**Example Response:**
```json
{
  "error": "unauthorized",
  "error_description": "Invalid API key",
  "code": "unauthorized"
}
```

**Fix:** Verify `Authorization` header contains `Bearer sk_test_xxxxxxxxxxxx`. Confirm API key is active in WorkOS Dashboard.

### 403 Forbidden

**Cause:** API key lacks permission for the requested resource.

**Example Response:**
```json
{
  "error": "forbidden",
  "error_description": "API key does not have access to this resource",
  "code": "forbidden"
}
```

**Fix:** Check API key permissions in WorkOS Dashboard. Use environment-specific API key (test vs live).

### 404 Not Found

**Cause:** Requested resource does not exist or has been deleted.

**Example Response:**
```json
{
  "error": "not_found",
  "error_description": "User not found",
  "code": "resource_not_found"
}
```

**Fix:** Verify resource ID. Check if resource was deleted. Use list endpoints to confirm resource exists.

### 409 Conflict

**Cause:** Resource already exists (e.g., duplicate email).

**Example Response:**
```json
{
  "error": "conflict",
  "error_description": "A user with this email already exists",
  "code": "duplicate_resource"
}
```

**Fix:** Check for existing resource before creating. Use update endpoint instead of create if resource exists.

### 422 Unprocessable Entity

**Cause:** Valid JSON but semantically incorrect request.

**Example Response:**
```json
{
  "error": "unprocessable_entity",
  "error_description": "Invalid email format",
  "code": "validation_failed"
}
```

**Fix:** Validate input format (email, phone, etc.). Check business logic constraints (e.g., expiration dates).

### 429 Too Many Requests

**Cause:** Rate limit exceeded.

**Example Response:**
```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests",
  "code": "rate_limit_exceeded"
}
```

**Fix:** Implement exponential backoff. Check `Retry-After` header. Reduce request frequency.

### 500 Internal Server Error

**Cause:** WorkOS server error.

**Fix:** Retry request with exponential backoff. Check WorkOS status page. Contact WorkOS support if persistent.

## Authentication Error Codes

### email_verification_required

**Cause:** User must verify email before proceeding.

**Response includes:**
```json
{
  "error": "email_verification_required",
  "email_verification_id": "email_verification_01HWEY2MFJ38C8C9ZG0FC43RPP"
}
```

**Fix:** Direct user to email verification flow. Use `email_verification_id` to check status.

### mfa_enrollment

**Cause:** User must enroll in MFA.

**Response includes:**
```json
{
  "error": "mfa_enrollment",
  "authentication_challenge_id": "auth_challenge_01HWEY2MFJ38C8C9ZG0FC43RPP"
}
```

**Fix:** Redirect to MFA enrollment flow. Complete enrollment before authentication.

### mfa_challenge

**Cause:** User must complete MFA challenge.

**Response includes:**
```json
{
  "error": "mfa_challenge",
  "authentication_challenge_id": "auth_challenge_01HWEY2MFJ38C8C9ZG0FC43RPP",
  "authentication_factors": [
    {
      "type": "totp",
      "id": "auth_factor_01HWEY2MFJ38C8C9ZG0FC43RPP"
    }
  ]
}
```

**Fix:** Present MFA challenge UI. Submit TOTP code or SMS code.

### organization_selection_required

**Cause:** User belongs to multiple organizations and must select one.

**Response includes:**
```json
{
  "error": "organization_selection_required",
  "organizations": [
    {
      "id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP",
      "name": "Acme Corp"
    }
  ]
}
```

**Fix:** Display organization picker. Re-authenticate with selected `organization_id`.

### sso_required

**Cause:** Organization requires SSO authentication.

**Response includes:**
```json
{
  "error": "sso_required",
  "sso_url": "https://auth.workos.com/sso/..."
}
```

**Fix:** Redirect user to `sso_url` to complete SSO flow.

## Rate Limits

WorkOS applies rate limits per API key. Limits vary by endpoint type:

- **Authentication endpoints:** 100 requests/minute
- **User management endpoints:** 600 requests/minute
- **Listing endpoints:** 300 requests/minute

When rate limited, implement exponential backoff:
1. Wait 1 second, retry
2. Wait 2 seconds, retry
3. Wait 4 seconds, retry
4. Continue doubling until success or max retries (5)

Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers to track usage.

## Verification Commands

### Test API Key

```bash
curl -X POST https://api.workos.com/user_management/api_keys/validate \
  -H "Authorization: Bearer sk_test_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "sk_test_xxxxxxxxxxxx"
  }'
```

**Expected:** `{"valid": true}`

### Create Test User

```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer sk_test_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }'
```

**Expected:** 201 response with user object containing `id` field.

### List Users

```bash
curl -X GET "https://api.workos.com/user_management/users?limit=5" \
  -H "Authorization: Bearer sk_test_xxxxxxxxxxxx"
```

**Expected:** 200 response with `data` array and `list_metadata` object.

### Send Test Invitation

```bash
curl -X POST https://api.workos.com/user_management/invitations \
  -H "Authorization: Bearer sk_test_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invite@example.com",
    "organization_id": "org_01HWEY2MFJ38C8C9ZG0FC43RPP"
  }'
```

**Expected:** 201 response with `token` and `accept_invitation_url` fields.

## SDK Usage Patterns

WebFetch https://workos.com/docs/reference/authkit/authentication for current SDK method names and signatures.

**Key SDK capabilities:**
- Authorization URL generation
- Code exchange for tokens
- Session management (refresh, revoke)
- User CRUD operations
- Organization membership management
- Invitation workflows

Consult fetched documentation for language-specific SDK methods.

## Related Skills

- **workos-authkit-base** — Feature overview and integration patterns
- **workos-authkit-nextjs** — Next.js-specific implementation
- **workos-authkit-react** — React-specific implementation
- **workos-mfa** — Multi-factor authentication setup
- **workos-magic-link** — Passwordless authentication
- **workos-api-organization** — Organization management endpoints
- **workos-api-sso** — SSO configuration and usage
- **workos-api-directory-sync** — Directory sync endpoints
- **workos-api-events** — Webhook event handling
