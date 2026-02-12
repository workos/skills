---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:5f86d0c502dc -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest SSO implementation details:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_REDIRECT_URI` - valid callback URL for your app

**Verify:** All three exist and have non-empty values before continuing.

### Project Setup

- Confirm WorkOS SDK is installed (check `package.json` or language-specific manifest)
- Confirm at least one route/endpoint exists to handle OAuth callbacks

## Step 3: Test SSO Setup (Decision Tree)

```
Testing strategy?
  |
  +-- Quick validation --> Use Test Identity Provider (staging only)
  |
  +-- Real IdP testing --> Create organization + connection in Dashboard
```

### Path A: Test Identity Provider (Fast Path)

**Use when:** You need quick end-to-end validation without IdP setup.

1. Log into WorkOS Dashboard → Test SSO page
2. Your staging environment has a default Test Organization with active SSO connection
3. Test these scenarios in order:

   a. **Service Provider-Initiated (SP-initiated)**
   - User enters email in your app
   - Gets redirected to Test IdP
   - Redirected back to your app with auth code
   - This is the primary login flow - test FIRST

   b. **Identity Provider-Initiated (IdP-initiated)**
   - User logs into Test IdP directly
   - Selects your app from SSO-enabled apps list
   - Gets redirected to your app
   - **Critical:** Many apps forget this flow - TEST IT

   c. **Guest Email Domain**
   - Authenticate with email domain ≠ `example.com`
   - Simulates freelance/contractor users
   - Verify your app handles non-verified domains

   d. **Error Response**
   - Trigger error from Test IdP
   - Verify error parameters reach your redirect URI
   - Check error handling displays user-friendly message

**Important:** If using AuthKit, disable it in Dashboard before testing raw SSO flows.

### Path B: Real Identity Provider (Full Path)

**Use when:** You need to validate actual IdP integration or document customer setup.

1. **Create Organization in Dashboard**
   - Navigate to Organizations → Create
   - Enter customer name (test org name)
   - This represents YOUR customer in WorkOS

2. **Create Connection via Admin Portal**
   - In organization page → Invite admin
   - Select "Single Sign-On" feature
   - Enter email or copy setup link
   - Admin Portal provides IdP-specific instructions

3. **Follow IdP Setup**
   - Create account with target IdP (Okta, Azure AD, Google, etc.)
   - Follow Admin Portal instructions for that IdP
   - Complete SAML/OIDC configuration on IdP side

4. **Verify Connection**
   - Dashboard will show connection status as "Active"
   - Test SP-initiated and IdP-initiated flows

**Connection types:** SAML 2.0, OpenID Connect, Google OAuth, Microsoft OAuth (check docs for provider-specific setup).

## Step 4: Implement Authorization URL Flow

### Generate Authorization URL

**Decision: How does user specify organization?**

```
Organization identification?
  |
  +-- User enters email --> Use domain parameter
  |
  +-- App knows org ID --> Use organization parameter
  |
  +-- Multi-tenant with provider list --> Use provider parameter
```

Authorization URL must include:

- `client_id` - Your WorkOS client ID
- `redirect_uri` - Where to send user after auth
- `state` - CSRF token (REQUIRED for security)
- ONE OF: `organization`, `provider`, or `domain` parameter

**SDK method (check fetched docs for exact signature):**

```
getAuthorizationUrl({ provider, redirectUri, state, ... })
```

**Verification:** Generate URL, inspect query params - all required fields present.

### Implement Callback Handler

Your redirect URI must:

1. **Extract `code` and `state` from query params**
   - If `error` param present → go to Error Recovery section
   - Verify `state` matches sent value (prevent CSRF)

2. **Exchange code for profile**
   - SDK method: `getProfileAndToken({ code })` or similar (check docs)
   - Returns user profile + access token

3. **Create/update user session**
   - Extract `profile.email`, `profile.first_name`, `profile.last_name`
   - Store user in your database
   - Create application session (cookie, JWT, etc.)

4. **Redirect to app home/dashboard**

**Critical:** Token exchange must happen server-side. Never expose `WORKOS_API_KEY` to client.

## Step 5: Handle IdP-Initiated SSO

**Most forgotten requirement:** Your callback handler must work WITHOUT a pre-existing session.

Standard flow:

```
User in your app → Generate auth URL → Redirect to IdP → Callback
```

IdP-initiated flow:

```
User in IdP → Select your app → Callback (NO prior app session)
```

**Implementation:**

- Do NOT require active session before callback
- Do NOT validate session state in callback (user has none yet)
- Create session directly from profile in callback
- Redirect to default landing page (not "return to previous page")

**Test:** Start at Test IdP, select your app, verify you land in app authenticated.

## Step 6: Single Logout (Optional)

**Availability:** OIDC connections only + limited scenarios. Check https://workos.com/docs/sso/single-logout for support.

If implementing RP-initiated logout:

1. User clicks "Sign out" in your app
2. Destroy local session
3. Redirect to WorkOS logout endpoint (see docs for URL)
4. User logged out of all IdP-connected apps

**When NOT supported:** SAML connections (most IdPs) - implement app-only logout instead.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm SSO integration:

```bash
# 1. Environment variables set
grep -E "WORKOS_(API_KEY|CLIENT_ID|REDIRECT_URI)" .env* || echo "FAIL: Missing env vars"

# 2. SDK installed
npm list | grep workos || echo "FAIL: SDK not installed"

# 3. Callback route exists (adjust path for your framework)
ls app/auth/callback* || ls pages/api/auth/callback* || echo "Check: Callback route exists?"

# 4. Test SP-initiated flow (manual)
# Visit your app → Enter email → Should redirect to IdP

# 5. Test IdP-initiated flow (manual)
# Visit Test IdP → Select app → Should land in app authenticated

# 6. Test error handling (manual)
# Trigger error in Test IdP → Should see friendly error message
```

## Error Recovery

### "signin_consent_denied" Error

**Cause:** User explicitly denied sign-in consent prompt (potential phishing scenario).

**Callback receives:**

```
https://your-app.com/callback?error=signin_consent_denied&error_description=User%20cancelled&state=...
```

**Fix:**

1. Display message: "Sign-in was cancelled. If you didn't initiate this, contact your admin immediately."
2. Log incident (possible phishing attempt)
3. Provide contact link to support team

### Generic SSO Error Response

**Cause:** IdP returned error during authentication.

**Callback receives:**

```
https://your-app.com/callback?error=<error_code>&error_description=<message>&state=...
```

**Fix:**

1. Check error code at https://workos.com/docs/reference/sso/get-authorization-url/error-codes
2. Display user-friendly error based on code
3. For `access_denied` → "Access not granted by your organization"
4. For `server_error` → "Authentication service unavailable, try again"
5. Log full error for debugging

### "Invalid redirect_uri" Error

**Cause:** Redirect URI in request doesn't match Dashboard configuration.

**Fix:**

1. Check WorkOS Dashboard → Configuration → Redirect URIs
2. Add exact callback URL (including protocol, domain, path)
3. Common mistake: `http://` vs `https://` mismatch
4. Common mistake: Trailing slash difference (`/callback` vs `/callback/`)

### "Invalid state parameter" Error

**Cause:** State mismatch (CSRF protection triggered) or state expired.

**Fix:**

1. Verify state generation: Must be cryptographically random
2. Verify state storage: Must persist across redirect (session, encrypted cookie)
3. Verify state validation: Exact match required
4. State lifetime: 10 minutes max (generate new if expired)

### IdP-Initiated Flow Fails

**Cause:** Callback handler requires pre-existing session.

**Fix:**

1. Remove session validation before profile exchange
2. Create session directly from profile data
3. Test: Start at IdP → select app → should work

### "Connection not found" Error

**Cause:** Organization/provider/domain parameter doesn't match active connection.

**Fix:**

1. Check Dashboard → Organizations → Connections (must be "Active")
2. Verify parameter value matches connection identifier
3. For domain: Must match verified domain on connection
4. For organization: Must use org ID, not name

### Profile Data Missing Fields

**Cause:** IdP doesn't provide all profile attributes.

**Fix:**

1. Check `profile` object for null/undefined fields before use
2. Common missing: `profile.last_name`, `profile.phone_number`
3. Required fields: `profile.email` (always present)
4. Fall back to email username if name missing

## Related Skills

- **workos-directory-sync.rules.yml**: Sync user directories from IdPs
- **workos-authkit-base**: Higher-level auth with AuthKit (wraps SSO)
