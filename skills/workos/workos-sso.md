---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:5f86d0c502dc -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for runtime reference:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

These docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Required Credentials

Check environment variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing. SSO requires both for authorization flow.

### SDK Installation

Check if WorkOS SDK is installed:

```bash
# Node.js
npm list @workos-inc/node || echo "SDK not installed"

# Python
pip show workos || echo "SDK not installed"

# Ruby
bundle show workos || echo "SDK not installed"
```

If missing, install before proceeding. Check fetched docs for language-specific install commands.

## Step 3: Login Flow Selection (Decision Tree)

SSO supports two entry points. Choose based on user behavior:

```
User starts login from...
  |
  +-- Your app's login page
  |     |
  |     +-- Service Provider-Initiated (SP-Initiated)
  |           - User enters email in YOUR app
  |           - You detect organization from email domain
  |           - You redirect to WorkOS authorization URL
  |           - User authenticates at their IdP
  |           - User returns to your callback URL
  |
  +-- Identity provider dashboard
        |
        +-- Identity Provider-Initiated (IdP-Initiated)
              - User logs into THEIR IdP first
              - User clicks your app from IdP app list
              - IdP redirects directly to your callback URL
```

**Critical:** You MUST handle BOTH flows. Many developers forget IdP-initiated — users will see errors when launching from their IdP dashboard.

## Step 4: Implement SP-Initiated Flow

### Step 4a: Detect Organization

When user enters email at login, determine their organization:

**Method 1: Email domain lookup (recommended)**

Use SDK method to find organization by email domain:

```
Input: user email
Output: organization_id or null
```

Check fetched docs for exact SDK method name (varies by language).

**Method 2: Organization selection (alternative)**

Present dropdown of available organizations if domain lookup fails or user has multiple orgs.

### Step 4b: Generate Authorization URL

Create authorization URL using SDK:

**Required parameters:**

- `client_id` - from `WORKOS_CLIENT_ID`
- `redirect_uri` - your callback URL (must match Dashboard config)
- `organization` - organization_id from Step 4a
- `state` - cryptographically random string (store in session)

**Optional parameters:**

- `domain_hint` - email domain to pre-fill IdP login
- `login_hint` - email address to pre-fill IdP login

Check fetched docs for exact SDK method signature.

**Verify state parameter:** Generate using secure random (not `Math.random()` in JS, not `rand()` in Ruby). Store in session for CSRF validation in Step 5.

### Step 4c: Redirect User

Redirect browser to the generated authorization URL. User will authenticate at their IdP.

## Step 5: Implement Callback Handler

Create route handler at your `redirect_uri` path.

### Step 5a: Handle Error Responses

Check for `error` query parameter BEFORE processing success:

```
GET /callback?error=signin_consent_denied&error_description=...&state=...
```

**Common error codes:**

- `signin_consent_denied` - User rejected sign-in consent screen
- `oauth_error` - Generic IdP failure
- `invalid_request` - Malformed authorization request

**Recovery for `signin_consent_denied`:**

Display message: "Sign-in cancelled. If you did not initiate this login, contact your admin — this may be a phishing attempt."

For other errors, log details and show generic "SSO failed" message. See fetched docs for full error code list.

### Step 5b: Validate State Parameter

Compare `state` query parameter to value stored in session (from Step 4b).

**If mismatch:** Reject request (potential CSRF attack). Return 400 error.

### Step 5c: Exchange Code for Profile

Extract `code` query parameter, exchange for user profile using SDK:

**Required parameters:**

- `code` - from query string
- `client_id` - from `WORKOS_CLIENT_ID`

Check fetched docs for exact SDK method name.

**Response contains:**

- `user.id` - WorkOS user identifier
- `user.email` - verified email address
- `user.first_name`, `user.last_name` - user attributes
- `organization_id` - which organization user belongs to
- `access_token` - for subsequent API calls (optional, see Step 7)

### Step 5d: Create Application Session

Map WorkOS user to your application user:

1. Check if `user.id` exists in your database
2. If new user: create account record with `user.email`
3. Create application session (JWT, session cookie, etc.)
4. Redirect to application home page

**Do NOT use email alone as identifier** — use `user.id`. Email can change.

## Step 6: Handle IdP-Initiated Flow

IdP-initiated flow skips Step 4 — user arrives directly at your callback URL.

**Key difference:** `state` parameter may be absent or may not match your session (user had no session yet).

**Detection pattern:**

```
No state in session but code in URL?
  |
  +-- YES --> IdP-initiated flow
  |
  +-- NO --> SP-initiated flow (process normally)
```

**For IdP-initiated:**

1. Skip state validation (user had no prior session)
2. Process code exchange normally (Step 5c)
3. Create new application session (Step 5d)

**Security note:** Some organizations disable IdP-initiated for security. Check `idp_initiated_auth` in fetched docs.

## Step 7: Optional - Single Logout (SLO)

**IMPORTANT:** SLO is ONLY supported for OIDC connections. SAML connections do NOT support SLO.

**Check before implementing:** Verify fetched docs confirm your IdP type supports SLO.

### Step 7a: Logout Redirect

When user logs out of your app, redirect to WorkOS logout endpoint:

**Required parameters:**

- `session_id` - from profile response in Step 5c

Check fetched docs for exact endpoint URL and SDK helper.

**Result:** User logged out of your app AND all other apps at their IdP.

### Step 7b: Conditional Implementation

```
IdP connection type?
  |
  +-- OIDC --> Implement SLO redirect
  |
  +-- SAML --> Local logout only (SLO not supported)
```

## Step 8: Testing with Test IdP

**Before testing with real IdPs**, validate integration with WorkOS Test Identity Provider.

### Step 8a: Locate Test Organization

1. Log into WorkOS Dashboard
2. Navigate to "Organizations" → Find "Test Organization"
3. Note the `organization_id` (starts with `org_`)

This organization has a pre-configured Test IdP connection.

### Step 8b: Test SP-Initiated Flow

1. Start login in your app
2. Enter email with domain `example.com` (Test Org domain)
3. Authorization redirects to Test IdP screen
4. Click "Authenticate" button
5. Verify callback handler receives profile with email `user@example.com`

**If this fails:** Check callback URL in Dashboard matches your `redirect_uri` exactly (including protocol, port, path).

### Step 8c: Test IdP-Initiated Flow

1. Go to Dashboard → "Test SSO" page
2. Click "Test IdP-Initiated Flow" button
3. Click "Authenticate" on Test IdP screen
4. Verify callback handler receives code WITHOUT prior state

**If this fails:** Check that Step 6 logic allows missing state.

### Step 8d: Test Error Handling

1. Go to Dashboard → "Test SSO" page
2. Click "Test Error Response" button
3. Click "Deny" on consent screen
4. Verify callback handler shows `signin_consent_denied` message

### Step 8e: Test Guest Domain

1. Start login in your app
2. Enter email with domain NOT `example.com` (e.g., `user@contractor.com`)
3. Verify login succeeds (Test Org allows guest domains)

Check fetched docs for how to enable/disable guest domains per organization.

## Step 9: Testing with Real IdPs

**After Test IdP validates**, test with production identity provider.

### Step 9a: Create Test Organization

1. Dashboard → "Organizations" → "Create Organization"
2. Enter test organization name
3. Note the `organization_id`

### Step 9b: Configure SSO Connection

**Option 1: Admin Portal (recommended)**

1. In organization page, click "Invite Admin"
2. Select "Single Sign-On" feature
3. Copy setup link (or send email)
4. Open setup link → select IdP from list
5. Follow provider-specific instructions

Admin Portal provides step-by-step guidance for each IdP (Okta, Azure AD, Google, etc.).

**Option 2: Manual Setup**

1. Click "Add Connection" in organization page
2. Select IdP type (SAML or OIDC)
3. Enter IdP metadata URL or upload XML (SAML) or client ID/secret (OIDC)
4. Configure redirect URIs in IdP admin panel

Check fetched docs for provider-specific configuration guides.

### Step 9c: Validate Real IdP Flow

Repeat Step 8b-8d tests using real organization's domain instead of `example.com`.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking complete:

```bash
# 1. Environment variables set
env | grep WORKOS || echo "FAIL: WORKOS vars missing"

# 2. SDK installed (Node.js example — adjust for your language)
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 3. Callback route exists (adjust path to your framework)
curl -I http://localhost:3000/auth/callback 2>/dev/null | grep -q "200\|302" || echo "FAIL: Callback route not responding"

# 4. Test IdP flow completes (manual)
echo "MANUAL: Test SP-initiated flow with example.com domain"

# 5. Error handling works (manual)
echo "MANUAL: Test signin_consent_denied error displays user message"

# 6. IdP-initiated flow works (manual)
echo "MANUAL: Test IdP-initiated flow from Dashboard button"
```

## Error Recovery

### "Invalid redirect_uri" error at authorization

**Cause:** Mismatch between `redirect_uri` in code and Dashboard configuration.

**Fix:**

1. Dashboard → "Configuration" → "Redirect URIs"
2. Add EXACT callback URL (include protocol, port if non-standard, path)
3. Example: `http://localhost:3000/auth/callback` NOT `localhost:3000/auth/callback`

### "State parameter mismatch" error at callback

**Cause 1:** IdP-initiated flow with SP-initiated validation logic.

**Fix:** Implement Step 6 detection pattern — allow missing state for IdP-initiated.

**Cause 2:** Session storage not persisting between authorization and callback.

**Fix:** Check session middleware is active on callback route. Verify cookies are being set/read.

### User sees "consent denied" but didn't cancel

**Cause:** Possible phishing attempt — someone else initiated login using user's email.

**Fix:** Display warning message per Step 5a. Log incident for security review.

### Code exchange fails with "invalid_grant"

**Cause:** Authorization code already used or expired (codes are single-use, 10-minute TTL).

**Fix:**

1. Check for duplicate callback processing (race condition)
2. Check callback handler doesn't reload/retry on success
3. Verify authorization → callback flow completes within 10 minutes

### Single Logout redirect fails

**Cause 1:** Connection type is SAML (SLO not supported).

**Fix:** Implement local logout only per Step 7b.

**Cause 2:** Missing or invalid `session_id`.

**Fix:** Verify Step 5c stores `session_id` from profile response. Check fetched docs for session management.

### "Email domain not found" during SP-initiated flow

**Cause:** No organization configured for user's email domain.

**Fix:**

1. Verify organization exists in Dashboard
2. Verify domain is added to organization's allowed domains
3. For generic domains (gmail.com, etc.), use organization selection UI instead of domain lookup

### Test IdP flow works but real IdP fails

**Cause:** Real IdP has stricter requirements (certificate validation, response signing, etc.).

**Fix:**

1. Check IdP admin panel shows connection as "active"
2. Check IdP metadata/config matches Dashboard settings
3. Check fetched docs for IdP-specific requirements (e.g., Azure AD requires tenant-specific endpoints)

## Related Skills

- **workos-authkit-nextjs**: Drop-in auth UI with SSO built-in
- **workos-authkit-react**: React components for SSO flows
- **workos-directory-sync**: Sync users/groups from IdP after SSO login
