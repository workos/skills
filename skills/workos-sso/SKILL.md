---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:5f86d0c502dc -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth for SSO implementation:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Log into [WorkOS Dashboard](https://dashboard.workos.com/)
- Navigate to API Keys
- Confirm you have `WORKOS_API_KEY` (starts with `sk_`)
- Confirm you have `WORKOS_CLIENT_ID` (starts with `client_`)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - secret API key
- `WORKOS_CLIENT_ID` - client identifier
- `WORKOS_REDIRECT_URI` - callback URL in your app (e.g., `https://your-app.com/callback`)

**Verify:** All three variables are set before continuing.

## Step 3: Install SDK

WebFetch: https://workos.com/docs for SDK installation instructions for your language/framework.

Detect package manager, install WorkOS SDK.

**Verify:** SDK package exists in dependencies before writing integration code.

## Step 4: Login Flow Decision Tree

Choose your SSO login flow based on UX requirements:

```
Login flow type?
  |
  +-- SP-initiated (user starts at your login page)
  |   |
  |   +-- User enters email in your app
  |   +-- Your app redirects to IdP
  |   +-- IdP redirects back to your callback URL
  |   +-- MOST COMMON - implement this first
  |
  +-- IdP-initiated (user starts at their IdP)
      |
      +-- User logs into IdP directly
      +-- User selects your app from IdP dashboard
      +-- IdP redirects to your callback URL
      +-- CRITICAL: Test this even if not primary flow
```

**Both flows MUST work** — customers expect IdP-initiated to "just work".

## Step 5: Implement Authorization Flow

### Create Authorization URL Endpoint

WebFetch: https://workos.com/docs/sso for current SDK method to generate authorization URL.

Your app needs an endpoint that:
1. Takes user email or organization identifier as input
2. Generates WorkOS authorization URL
3. Redirects user to that URL

**Do NOT build custom OAuth flows** — use SDK methods.

### Create Callback Route

Parse `WORKOS_REDIRECT_URI` to determine callback route path:

```
URI path              --> Route location
/auth/callback        --> /auth/callback handler
/sso/callback         --> /sso/callback handler
```

WebFetch: https://workos.com/docs/sso for SDK method to exchange authorization code for user profile.

Callback handler must:
1. Extract `code` parameter from query string
2. Exchange code for user profile using SDK
3. Create session in your app
4. Redirect to authenticated area

**Critical:** Handle both success and error responses (see Error Recovery section).

## Step 6: Test with Test Identity Provider

**REQUIRED:** Test SSO integration before production launch.

### Enable Test SSO in Dashboard

1. Navigate to [Test SSO](https://dashboard.workos.com/test-sso) in Dashboard
2. Confirm default Test Organization exists
3. Note the test user credentials provided

### Test SP-Initiated Flow

1. Start auth flow from your login page
2. Enter test user email (provided in Dashboard)
3. Verify redirect to Test IdP
4. Complete authentication at Test IdP
5. Verify redirect back to your callback
6. Confirm user session created

**If any step fails, see Error Recovery before continuing.**

### Test IdP-Initiated Flow

**Critical:** Disable AuthKit in Dashboard if enabled — AuthKit and standalone SSO API cannot be tested simultaneously.

1. Start auth flow from Test IdP (link in Dashboard)
2. Complete authentication at Test IdP
3. Verify redirect to your callback WITHOUT visiting your login page
4. Confirm user session created

**Common failure:** Callback route rejects IdP-initiated flow. Your callback MUST NOT require session state that only exists in SP-initiated flow.

### Test Error Scenarios

Dashboard provides pre-configured error test cases:

**Test Case: signin_consent_denied**
1. Use test link for "User denies consent"
2. Callback receives: `error=signin_consent_denied&error_description=User%20cancelled...`
3. Display helpful message: "Contact your admin if this was unexpected"

**Test Case: Generic IdP error**
1. Use test link for "Generic error"
2. Callback receives error parameters
3. Log error details, show generic user-facing message

**Verify:** All error test cases handled gracefully without crashes.

## Step 7: Production Organization Setup

### Create Organization for Real Customer

1. Navigate to [Organizations](https://dashboard.workos.com/organizations) in Dashboard
2. Click "Create Organization"
3. Enter customer company name
4. Note the Organization ID (starts with `org_`)

### Send Setup Link to Customer Admin

1. Go to created organization
2. Click "Invite admin"
3. Select "Single Sign-On" from features list
4. Enter customer admin email OR copy setup link

**Setup link goes to Admin Portal** — customer follows provider-specific instructions there.

**Alternative:** Integrate Admin Portal into your app for self-serve setup (see workos-admin-portal skill).

## Step 8: Single Logout (Optional)

**Availability:** Currently only supported for OpenID Connect connections.

WebFetch: https://workos.com/docs/sso/single-logout for latest implementation details.

If implementing logout:
1. Confirm customer connection type is OIDC
2. Redirect user to WorkOS Logout endpoint (see fetched docs for URL)
3. User logs out of your app AND all other SSO-enabled apps

**Do NOT implement if customer uses SAML** — feature not supported. Contact WorkOS support for roadmap.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm SSO integration. **Do not mark complete until all pass:**

```bash
# 1. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID|WORKOS_REDIRECT_URI" .env* || echo "FAIL: Missing env vars"

# 2. Check SDK package installed (adjust for your package manager)
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check callback route exists (adjust path to your callback route)
ls src/routes/callback.* app/callback/route.* pages/api/callback.* 2>/dev/null || echo "FAIL: No callback route found"

# 4. Test authorization URL generation (create test script)
node -e "require('./test-auth-url.js')" || echo "FAIL: Cannot generate auth URL"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**Manual verification required:**
- [ ] Test SSO scenarios completed in Dashboard (SP-initiated, IdP-initiated, error cases)
- [ ] Callback handles both success and error responses
- [ ] User session created after successful SSO
- [ ] Error messages displayed to users are helpful (not raw error codes)

## Error Recovery

### "Missing required parameter: organization"

**Cause:** Authorization URL generation missing organization context.

**Fix:** Provide either:
- `organization` parameter (Organization ID from Dashboard), OR
- `connection` parameter (Connection ID), OR
- User email with domain matching verified organization domain

Check fetched docs for current SDK method signature.

### "Invalid redirect_uri"

**Cause:** `WORKOS_REDIRECT_URI` not registered in Dashboard.

**Fix:**
1. Navigate to [Configuration → Redirects](https://dashboard.workos.com/configuration/redirects)
2. Add your callback URL exactly as it appears in env var
3. Save and retry

**Critical:** URL must match EXACTLY (including trailing slash if present).

### "signin_consent_denied" at callback

**Cause:** User clicked "Cancel" or "Deny" during SSO consent screen.

**Expected behavior** — not an error. Display message:
> "Sign-in was cancelled. If this was unexpected, contact your administrator."

Do NOT log as error. Do NOT retry automatically.

### Callback receives `error=access_denied`

**Cause:** User not authorized for your application in IdP.

**Fix for customer admin:**
1. Log into IdP (Okta, Azure AD, etc.)
2. Assign user to your application
3. User retries login

**Fix for your app:** Display message directing user to contact their IT admin.

### IdP-initiated flow fails with "Invalid state"

**Cause:** Callback code expects state parameter that doesn't exist in IdP-initiated flow.

**Fix:** Make state validation conditional:
```
If request is from IdP-initiated flow:
  Skip state validation
Else:
  Validate state parameter
```

IdP-initiated requests do NOT include state parameter — this is expected.

### "Connection not found" error

**Cause:** Organization has no active SSO connection.

**Fix for customer admin:**
1. Complete Admin Portal setup instructions
2. Verify connection shows "Active" in Dashboard

**Fix for your app:** Check connection status before redirecting:
```
connection_status = "active"?
  |
  +-- Yes --> Redirect to SSO
  |
  +-- No  --> Show "SSO not configured" message
```

WebFetch Dashboard API docs for checking connection status programmatically.

### Test IdP shows "Disable AuthKit" message

**Cause:** AuthKit and standalone SSO API cannot run simultaneously in test environment.

**Fix:**
1. Navigate to [Authentication settings](https://dashboard.workos.com/authentication)
2. Toggle AuthKit to "Disabled"
3. Retry test flow

**Re-enable AuthKit** after testing if using it in production.

## Related Skills

- **workos-integrations**: Provider-specific SSO configuration (Okta, Azure AD, Google)
- **workos-admin-portal**: Self-serve SSO setup for customers
- **workos-directory-sync**: Sync user directories after SSO authentication
- **workos-authkit-nextjs**: AuthKit integration (alternative to standalone SSO)
- **workos-rbac**: Role assignment after SSO login
