---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- generated -->

# WorkOS AuthKit API Reference

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch ALL of these URLs — they are the source of truth:

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization
- https://workos.com/docs/reference/authkit/api-keys/validate
- https://workos.com/docs/reference/authkit/authentication
- https://workos.com/docs/reference/authkit/authentication-errors

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Authentication Flow Decision Tree

Determine which authentication method you're implementing:

```
What auth flow?
  |
  +-- OAuth/OIDC (standard web flow)
  |     |
  |     +-- Step 3A: OAuth Implementation
  |
  +-- Magic Link (passwordless)
  |     |
  |     +-- Step 3B: Magic Auth Implementation
  |
  +-- Password + MFA (traditional)
  |     |
  |     +-- Step 3C: Password Auth Implementation
  |
  +-- CLI/Device Auth (headless)
  |     |
  |     +-- Step 3D: CLI Auth Implementation
  |
  +-- Session Management (refresh/validate)
        |
        +-- Step 3E: Session Operations
```

**Critical:** Most apps use OAuth (Step 3A). Only proceed to other steps if explicitly required.

## Step 3A: OAuth Implementation (Standard Flow)

### Pre-Flight Validation

Check environment variables:

```bash
# Required variables - fail fast if missing
grep -q "WORKOS_API_KEY=sk_" .env* || echo "FAIL: Missing WORKOS_API_KEY"
grep -q "WORKOS_CLIENT_ID=client_" .env* || echo "FAIL: Missing WORKOS_CLIENT_ID"
```

### Authorization URL Pattern

Read docs for `get-authorization-url` endpoint. Implementation flow:

1. **Generate authorization URL** with required parameters:
   - `client_id` (from env)
   - `redirect_uri` (registered in WorkOS Dashboard)
   - `response_type=code`
   - Optional: `state`, `organization_id`, `login_hint`

2. **PKCE Support (Recommended):**
   - Generate `code_verifier` (43-128 chars, URL-safe)
   - Compute `code_challenge` (SHA-256 hash, base64url)
   - Store `code_verifier` in session/cookie
   - Add `code_challenge` and `code_challenge_method=S256` to URL

3. **Redirect user** to generated URL

### Callback Handler Pattern

Read docs for `authentication/code` endpoint. Implementation:

1. **Extract code** from callback URL query params
2. **Exchange code for tokens:**
   ```
   POST /user_management/authenticate
   Body: {
     client_id,
     code,
     code_verifier (if PKCE),
     grant_type: "authorization_code"
   }
   ```
3. **Store session data** (access_token, refresh_token, user object)
4. **Redirect to app** (post-login destination)

**Verify callback:**
```bash
# Check callback route exists
find . -type f \( -name "*.ts" -o -name "*.js" \) -exec grep -l "authenticate.*code" {} \;
```

## Step 3B: Magic Auth Implementation

**When to use:** Passwordless email-only authentication.

Read docs for `magic-auth/create` endpoint. Flow:

1. **Create magic auth:**
   ```
   POST /user_management/magic_auth
   Body: { email }
   ```
2. **Send email** (WorkOS handles delivery)
3. **Verify on callback** using returned `id` and `code`

**Critical:** Magic auth codes expire in 10 minutes. Handle expiration gracefully.

## Step 3C: Password Auth Implementation

**When to use:** Traditional username/password + optional MFA.

Read docs for `authentication/password` endpoint. Flow:

1. **Authenticate user:**
   ```
   POST /user_management/authenticate
   Body: { 
     email, 
     password,
     grant_type: "password"
   }
   ```

2. **Handle MFA challenges** (if MFA enabled):
   - Response includes `pending_authentication_token`
   - Read `authentication-errors/mfa-challenge-error` docs
   - Prompt for TOTP code
   - Submit challenge response

3. **Store session** after successful auth

### MFA Enrollment Pattern

Read docs for `mfa/enroll-auth-factor`. Steps:

1. **Generate TOTP secret:**
   ```
   POST /user_management/mfa/enroll
   Body: { 
     user_id,
     type: "totp" 
   }
   ```
2. **Display QR code** (response includes `qr_code` and `secret`)
3. **Verify enrollment** with test code
4. **Store recovery codes** (show once, securely)

## Step 3D: CLI Auth Implementation

**When to use:** Headless/device flows (CLIs, IoT, TV apps).

Read docs for `cli-auth/device-authorization`. OAuth Device Flow:

1. **Request device code:**
   ```
   POST /user_management/device_authorization
   Body: { client_id }
   ```
   Response: `device_code`, `user_code`, `verification_uri`

2. **Display to user:**
   ```
   Visit: https://auth.workos.com/activate
   Enter code: ABCD-EFGH
   ```

3. **Poll for authorization:**
   ```
   POST /user_management/device_code
   Body: { 
     device_code,
     grant_type: "urn:ietf:params:oauth:grant-type:device_code"
   }
   ```
   Poll every 5 seconds until success or timeout (15 minutes).

**Error handling:**
- `authorization_pending` → Keep polling
- `slow_down` → Increase interval by 5 seconds
- `expired_token` → Start over

## Step 3E: Session Operations

### Refresh Token Pattern

Read docs for `authentication/refresh-token`:

```
POST /user_management/authenticate
Body: {
  client_id,
  refresh_token,
  grant_type: "refresh_token"
}
```

**When to refresh:**
- Access token expires (check `expires_at`)
- Before long-running operations
- After inactivity timeout

### Session Validation

Read docs for `session/list` and `session/revoke`:

1. **Check session validity:**
   ```
   GET /user_management/sessions/:session_id
   ```

2. **Revoke session (logout):**
   ```
   POST /user_management/sessions/:session_id/revoke
   ```

### Cookie-Based Sessions

Read docs for `authentication/session-cookie`. Pattern:

1. **Seal session data** (encrypt for storage)
2. **Store in httpOnly cookie** (secure, sameSite=lax)
3. **Unseal on requests** (decrypt and validate)

**Verify session implementation:**
```bash
# Check for session handling
grep -r "refresh_token\|session_cookie\|sealed_session" . --include="*.ts" --include="*.js"
```

## Step 4: User Management (Optional)

### Create Users Programmatically

Read docs for `user/create`:

```
POST /user_management/users
Body: {
  email,
  email_verified (optional),
  first_name (optional),
  last_name (optional)
}
```

### Organization Membership

Read docs for `organization-membership/create`:

```
POST /user_management/organization_memberships
Body: {
  user_id,
  organization_id,
  role_slug (optional)
}
```

## Step 5: API Key Management (Admin Operations)

**When to use:** Programmatic API key creation for customer tenants.

Read docs for `api-keys/create-for-organization`:

```
POST /user_management/organizations/:org_id/api_keys
Body: { 
  name,
  scopes (optional)
}
```

**Security:**
- API keys inherit organization permissions
- Use separate keys per service/environment
- Rotate keys regularly
- Revoke compromised keys immediately via `api-keys/delete`

**Validate keys:**
```bash
# Endpoint should return 200 for valid key
curl -X POST https://api.workos.com/user_management/api_keys/validate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "sk_test_..."}'
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables present
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* && echo "PASS" || echo "FAIL: Missing env vars"

# 2. SDK import exists
grep -r "workos\|@workos-inc" . --include="package.json" && echo "PASS" || echo "FAIL: SDK not installed"

# 3. Authentication handler exists (at least one)
grep -r "authenticate\|authorization_url\|magic_auth" . --include="*.ts" --include="*.js" | head -1 && echo "PASS" || echo "FAIL: No auth handler found"

# 4. Error handling for auth errors
grep -r "AuthenticationError\|catch.*error\|401\|403" . --include="*.ts" --include="*.js" | head -1 && echo "PASS" || echo "FAIL: No error handling"

# 5. Build succeeds
npm run build 2>&1 | tail -5
```

**If any check fails:** Go back to relevant step and fix before continuing.

## Error Recovery

### "invalid_grant" (Code Exchange Failed)

**Root causes:**
- Code already used (codes are single-use)
- Code expired (10 minute lifetime)
- PKCE verification failed (wrong `code_verifier`)
- `redirect_uri` mismatch (must match authorization request exactly)

**Fix:**
1. Log full error response from WorkOS
2. Check: Code used only once
3. Check: `code_verifier` stored correctly between authorization and callback
4. Check: `redirect_uri` matches WorkOS Dashboard configuration character-for-character

### "unauthorized_client" (Authorization Failed)

**Root causes:**
- `client_id` incorrect or missing
- Client not configured for requested grant type
- Organization restriction mismatch

**Fix:**
1. Verify `WORKOS_CLIENT_ID` starts with `client_`
2. Check WorkOS Dashboard → Client configuration → Allowed grant types
3. If using `organization_id`, verify it exists and client has access

### "invalid_request" (Malformed Request)

**Root causes:**
- Missing required parameters
- Invalid parameter format
- Wrong endpoint or HTTP method

**Fix:**
1. Compare request to docs exactly (parameter names, spelling)
2. Check Content-Type header: `application/json`
3. Check Authorization header: `Bearer sk_...`
4. Log request body before sending

### "access_denied" (User Rejected)

**Expected behavior** — user clicked "Cancel" on consent screen or login failed.

**Fix:**
- Show friendly error message
- Provide "Try Again" link back to authorization URL
- Log for analytics but do not treat as system error

### "MFA Required" Errors

Read docs for `authentication-errors/mfa-challenge-error`. Pattern:

1. **Detect MFA challenge:**
   ```json
   {
     "error": "mfa_challenge",
     "pending_authentication_token": "..."
   }
   ```

2. **Prompt for TOTP code**

3. **Submit challenge:**
   ```
   POST /user_management/authenticate
   Body: {
     client_id,
     pending_authentication_token,
     authentication_challenge: "123456",
     grant_type: "urn:workos:oauth:grant-type:mfa-challenge"
   }
   ```

### "Email Verification Required"

Read docs for `authentication-errors/email-verification-required-error`.

**Flow:**
1. User attempts login with unverified email
2. API returns `email_verification_required` error with `pending_authentication_token`
3. Show "Check your email" message
4. User clicks verification link
5. Retry authentication with same token

### "Rate Limit Exceeded"

**Symptom:** HTTP 429 responses.

**Fix:**
- Implement exponential backoff (start with 1s, double each retry)
- Cache user lookups (don't call `user/get` on every request)
- Use webhooks instead of polling where possible
- For CLI auth, respect `slow_down` error (increase poll interval)

### Session/Token Errors

**"Session expired":**
- Use refresh token to get new access token
- If refresh fails, redirect to login

**"Invalid token":**
- Token may be malformed or from different environment (test vs prod)
- Verify token signature using JWKS endpoint (`session-tokens/jwks`)

**"Token not yet valid" (`nbf` claim):**
- Clock skew between systems
- Allow 60-second tolerance window for `nbf` and `exp` checks

## Related Skills

- `workos-authkit-nextjs` — Next.js-specific integration with middleware patterns
- `workos-directory-sync` — Sync users/groups from SCIM providers
- `workos-admin-portal` — Embed WorkOS admin UI for customer self-service
