---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- generated -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for SSO implementation:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm account exists at https://dashboard.workos.com/
- Navigate to API Keys section
- Verify you have both:
  - `WORKOS_API_KEY` (starts with `sk_`)
  - `WORKOS_CLIENT_ID` (starts with `client_`)

### Environment Variables

Check `.env` or `.env.local` for:

```bash
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
WORKOS_REDIRECT_URI=https://your-app.com/callback
```

**CRITICAL:** `WORKOS_REDIRECT_URI` must be registered in WorkOS Dashboard under Redirects.

### SDK Installation

Detect language/framework and install appropriate SDK:

```
Language/Framework?
  |
  +-- Node.js     --> npm install @workos-inc/node
  |
  +-- Python      --> pip install workos
  |
  +-- Ruby        --> gem install workos
  |
  +-- Go          --> go get github.com/workos/workos-go/v4
  |
  +-- .NET        --> dotnet add package WorkOS.net
```

**Verify:** SDK package exists before writing imports.

## Step 3: Organization Setup (Decision Tree)

```
Testing scenario?
  |
  +-- Quick test with Test IdP
  |     |
  |     +-- Go to dashboard.workos.com/test-sso
  |     +-- Use default Test Organization (org_01...)
  |     +-- Domain: example.com
  |     +-- Skip to Step 5 (Test SSO)
  |
  +-- Real IdP integration
        |
        +-- Create organization in dashboard
        +-- Click "Invite admin" → "Single Sign-On"
        +-- Copy setup link for Admin Portal
        +-- Follow IdP-specific instructions in Admin Portal
```

**IMPORTANT:** For production, always use real organizations. Test IdP is staging-only.

## Step 4: Implement SSO Login Flow

### Get Authorization URL

Initialize SDK client and generate auth URL. Check fetched docs for exact SDK syntax per language.

**Pattern (pseudo-code):**

```
authorizationUrl = workos.sso.getAuthorizationUrl({
  provider: "GoogleOAuth",           // Or organization: "org_123"
  redirectUri: WORKOS_REDIRECT_URI,
  state: generateRandomState(),      // CSRF protection - required
  clientId: WORKOS_CLIENT_ID
})

// Redirect user to authorizationUrl
```

**Decision tree for provider selection:**

```
User login context?
  |
  +-- User enters email (SP-initiated)
  |     |
  |     +-- Extract domain from email
  |     +-- Query WorkOS for organization by domain
  |     +-- Use organization parameter
  |
  +-- User clicks "Sign in with Google" (provider-initiated)
  |     |
  |     +-- Use provider parameter directly
  |
  +-- User comes from IdP portal (IdP-initiated)
        |
        +-- WorkOS handles automatically
        +-- No getAuthorizationUrl needed
```

### Handle Callback

Create callback endpoint at `WORKOS_REDIRECT_URI` path.

**Pattern:**

1. Extract `code` and `state` from query params
2. Verify `state` matches session (CSRF protection)
3. Exchange code for profile:

```
profile = workos.sso.getProfileAndToken({
  code: request.query.code,
  clientId: WORKOS_CLIENT_ID
})

// profile contains:
// - email
// - first_name, last_name
// - idp_id (unique identifier from IdP)
// - organization_id
// - connection_id
// - raw_attributes (full IdP response)
```

4. Create session with `profile.idp_id` as user identifier
5. Redirect to application

**CRITICAL:** Use `idp_id` as the stable user identifier, NOT email. Emails can change.

## Step 5: Test SSO Integration

### Service Provider-Initiated (SP-Initiated)

**Scenario:** User starts login from YOUR app.

1. Go to your app's login page
2. Enter email with Test IdP domain: `user@example.com`
3. Click sign in
4. Redirects to WorkOS Test IdP
5. Click "Sign In" on Test IdP page
6. Redirects back to your callback
7. User session created

**Verify with:**

```bash
# Check callback endpoint receives code parameter
curl -I "https://your-app.com/callback?code=test_code&state=test_state"

# Should return 302 redirect to app (not error page)
```

### Identity Provider-Initiated (IdP-Initiated)

**Scenario:** User starts login from IdP portal.

1. Go to https://dashboard.workos.com/test-sso
2. Click "Start IdP-Initiated Test"
3. Redirects directly to your callback WITH code
4. Callback processes code without authorization URL step

**CRITICAL:** Your callback MUST NOT require state parameter for IdP-initiated flow.

**Fix for state validation:**

```
if (request.query.code && !request.query.state) {
  // IdP-initiated flow - skip state validation
} else if (request.query.code && request.query.state) {
  // SP-initiated flow - validate state
  if (request.query.state !== session.state) {
    throw new Error("Invalid state parameter");
  }
}
```

### Guest Email Domain Test

**Scenario:** User email domain doesn't match organization domain.

1. Go to https://dashboard.workos.com/test-sso
2. Click "Guest Email Domain Test"
3. Enter email like `contractor@personal.com`
4. Login succeeds IF connection allows guest domains

**Check connection settings:**

```bash
# Via WorkOS CLI (if installed)
workos connections get conn_123

# Or in Dashboard: Organizations → Connection → Settings
# Look for "Allow guest email domains" toggle
```

### Error Response Test

**Scenario:** Simulate IdP failure.

1. Go to https://dashboard.workos.com/test-sso
2. Click "Error Response Test"
3. Callback receives error parameters:

```
https://your-app.com/callback?error=access_denied&error_description=User+denied+consent&state=123
```

**Your callback MUST handle:**

- `error` parameter present → Extract and display user-friendly message
- Log full `error_description` for debugging
- Do NOT create session
- Redirect to login with error message

## Step 6: Implement Single Logout (Optional)

**CRITICAL:** Only supported for OpenID Connect connections. Check fetched docs for current provider support.

### RP-Initiated Logout

Redirect user to WorkOS logout endpoint to sign out from all apps:

```
logoutUrl = "https://api.workos.com/sso/logout?" + params({
  session_id: sessionId  // From original SSO profile response
})

// Redirect user to logoutUrl
// User signs out from your app AND IdP
```

**Verify logout:**

1. User completes SSO login
2. Save `session_id` from profile response
3. User clicks "Sign Out"
4. Redirect to WorkOS logout URL
5. User redirected to IdP logout
6. Session cleared in all apps

**Check IdP support:**

```bash
# Query connection details
curl https://api.workos.com/connections/conn_123 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Look for "supports_logout": true in response
```

## Step 7: Handle Sign-In Consent

**Scenario:** User sees consent screen on first SSO login.

Check fetched docs at https://workos.com/docs/sso/sign-in-consent for current UX flow.

### Consent Denied Error

If user clicks "Cancel" on consent screen, callback receives:

```
https://your-app.com/callback?error=signin_consent_denied&error_description=User+cancelled+authentication
```

**CRITICAL:** Display helpful message directing user to:

- Contact their IT admin (possible phishing concern)
- Contact your support team
- Try alternate login method

**Implementation:**

```
if (request.query.error === "signin_consent_denied") {
  return showError(
    "Sign-in request cancelled. " +
    "If you did not initiate this request, contact your IT administrator. " +
    "For other issues, contact support@your-app.com"
  )
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables are set
env | grep -E "WORKOS_(API_KEY|CLIENT_ID|REDIRECT_URI)" || echo "FAIL: Missing env vars"

# 2. Check SDK package installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "SDK not found (adjust path for language)"

# 3. Check callback endpoint exists (adjust path for framework)
grep -r "workos.sso.getProfileAndToken\|workos.sso.get_profile_and_token" . || echo "FAIL: No callback handler"

# 4. Test authorization URL generation (adjust for framework)
curl http://localhost:3000/login?email=user@example.com -I | grep -q "302\|Location" || echo "FAIL: Auth redirect not working"

# 5. Check error handling exists
grep -r "signin_consent_denied\|error.*=.*request.query.error" . || echo "WARN: No error handling found"

# 6. Verify state parameter validation
grep -r "state.*session\|validateState" . || echo "WARN: No CSRF protection"

# 7. Check redirect URI is registered in dashboard
# Manual: Go to dashboard.workos.com/configuration/redirects
# Confirm your WORKOS_REDIRECT_URI is in the list
```

## Error Recovery

### "Invalid redirect URI"

**Root cause:** `WORKOS_REDIRECT_URI` not registered in WorkOS Dashboard.

**Fix:**

1. Go to https://dashboard.workos.com/configuration/redirects
2. Click "Add Redirect"
3. Enter EXACT URI from your env vars (including https://, port, path)
4. Save
5. Retry authorization URL generation

### "Invalid code" or "Code expired"

**Root cause:** Code already used or took >10 minutes to exchange.

**Fix:**

1. Check callback logs for duplicate code exchange attempts
2. Ensure callback only calls `getProfileAndToken` once per code
3. Implement idempotency check:

```
if (session.hasProcessedCode(code)) {
  return redirect("/already-logged-in")
}
```

### "Organization not found for domain"

**Root cause:** Email domain not associated with any WorkOS organization.

**Decision tree for fix:**

```
Is domain intentionally unsupported?
  |
  +-- YES --> Show "SSO not enabled for your domain" message
  |           Offer alternate login (email/password)
  |
  +-- NO  --> In Dashboard:
              1. Go to organization
              2. Add domain under Domains section
              3. Verify domain ownership (DNS TXT record)
```

### "State parameter mismatch"

**Root cause:** Session state doesn't match query param (CSRF attempt or session expired).

**Fix:**

1. Check session storage is working (Redis, database, etc.)
2. Verify state is stored BEFORE redirect to auth URL
3. Check session cookie domain matches app domain
4. For IdP-initiated flow, skip state validation (see Step 5)

### "Missing required parameter: client_id"

**Root cause:** `WORKOS_CLIENT_ID` not passed to SDK method.

**Fix:**

```bash
# Check env var is loaded
echo $WORKOS_CLIENT_ID

# Verify SDK initialization
grep -r "clientId.*WORKOS_CLIENT_ID" .

# Ensure SDK client configured before use
```

### IdP-initiated flow fails with "Invalid state"

**Root cause:** Callback requires state but IdP-initiated flow doesn't provide it.

**Fix:** See "IdP-Initiated" section in Step 5 — make state validation conditional.

### Single Logout returns 404

**Root cause:** Connection doesn't support logout or wrong endpoint.

**Fix:**

1. Check connection type supports logout (OpenID Connect only)
2. Verify endpoint: `https://api.workos.com/sso/logout` (not `/logout/redirect`)
3. Confirm `session_id` parameter is from original SSO response

### "Consent screen not showing" (testing)

**Root cause:** User already consented in previous session.

**Fix:**

1. Clear cookies for your app
2. Use incognito/private browsing mode
3. Or: Manually revoke consent in WorkOS Dashboard

## Related Skills

- **workos-authkit-nextjs**: Simplified SSO with AuthKit for Next.js
- **workos-directory-sync**: Sync user directories from IdPs after SSO
- **workos-rbac**: Role-based access control after SSO authentication
- **workos-admin-portal**: Self-serve SSO setup for customers
