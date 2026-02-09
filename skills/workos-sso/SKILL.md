---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- generated -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:

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
- `WORKOS_REDIRECT_URI` - valid callback URL in your app

**Verify:** Run this command. All three must exist:

```bash
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID|WORKOS_REDIRECT_URI" .env* || echo "FAIL: Missing WorkOS env vars"
```

### SDK Installation

Detect package manager, install WorkOS SDK from docs.

**Verify:** SDK package exists before continuing:

```bash
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: WorkOS SDK not installed"
```

## Step 3: Login Flow Decision Tree

Determine which SSO flow(s) to implement based on requirements:

```
User entry point?
  |
  +-- From your app sign-in page
  |     --> SP-initiated SSO (Service Provider-initiated)
  |     --> User enters email, redirected to IdP, returns to app
  |
  +-- From IdP dashboard (e.g., Okta tile)
  |     --> IdP-initiated SSO (Identity Provider-initiated)
  |     --> User clicks app tile in IdP, redirected to app
  |
  +-- Both (most common for production)
        --> Implement both flows
```

**CRITICAL:** Most developers forget IdP-initiated SSO. If users access your app from their IdP dashboard, this flow is required.

## Step 4: Implement SP-Initiated SSO

### Create Authorization URL Route

Create API endpoint that generates the SSO authorization URL:

1. Import SDK's `getAuthorizationUrl` function (see docs for exact import)
2. Accept user's email or organization identifier
3. Return authorization URL for redirect

**Pattern from docs:**

```typescript
// Example structure - check docs for exact SDK usage
const authorizationUrl = await getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  // Email or organization parameter from user input
});
```

### Create Callback Route

Create endpoint at `WORKOS_REDIRECT_URI` path:

1. Extract `code` parameter from URL
2. Exchange code for user profile using SDK
3. Create session in your app
4. Redirect to protected area

**Verify:** Test SP-initiated flow end-to-end:

```bash
# 1. Start your app
# 2. Navigate to sign-in page
# 3. Enter test email (see Test IdP in docs)
# 4. Confirm redirect to WorkOS Test IdP
# 5. Complete auth, confirm redirect back to app
# 6. Check session exists
```

## Step 5: Implement IdP-Initiated SSO (REQUIRED)

**CRITICAL:** Your callback route must handle requests with NO state parameter.

### Callback Modifications

IdP-initiated requests arrive directly at callback with `code` but no `state`:

```
Flow comparison:
  SP-initiated  --> /callback?code=xxx&state=yyy
  IdP-initiated --> /callback?code=xxx  (no state!)
```

**Decision logic for callback:**

1. Extract `code` parameter (required for both flows)
2. Check if `state` parameter exists
3. If state exists → validate it (SP-initiated security)
4. If no state → proceed without validation (IdP-initiated)
5. Exchange code for profile
6. Create session and redirect

**Common mistake:** Requiring state parameter causes IdP-initiated SSO to fail. Make state validation conditional.

**Verify:** Test IdP-initiated flow:

```bash
# 1. Open WorkOS Dashboard Test SSO page
# 2. Use "Identity provider-initiated SSO" test
# 3. Click provided link (simulates IdP app tile click)
# 4. Confirm redirect to your callback
# 5. Check session creation succeeds without state
```

## Step 6: Handle Guest Email Domains

Users may authenticate with email domains different from organization's verified domain.

### Configuration Check

In WorkOS Dashboard for test organization:

1. Navigate to organization settings
2. Check "Allow profiles from any email domain" setting
3. Enable if freelancers/contractors need access

### Code Pattern

No code changes required — SDK handles this automatically if enabled in Dashboard.

**Verify:** Test guest domain flow:

```bash
# 1. In Dashboard, enable "Allow profiles from any email domain"
# 2. Use Test SSO with non-example.com email
# 3. Confirm authentication succeeds
# 4. Check user profile returns correct email
```

## Step 7: Error Handling (REQUIRED)

### Map Error Codes to User Messages

Callback route receives errors as URL parameters:

```
Error URL structure:
/callback?error=<code>&error_description=<message>&state=<state>
```

**Implement handling for these error codes:**

| Error Code | Root Cause | User Action |
|------------|------------|-------------|
| `invalid_request` | Malformed request parameters | Show generic error, log details |
| `invalid_client` | Wrong client ID | Contact support (config error) |
| `invalid_grant` | Code expired or already used | Retry SSO flow |
| `signin_consent_denied` | User denied consent prompt | "Authentication cancelled. Contact admin if suspicious." |
| `access_denied` | IdP rejected authentication | "Access denied. Contact your IT admin." |

**CRITICAL — Phishing Protection:**

For `signin_consent_denied`, show message that helps users detect phishing:

```
"You cancelled the sign-in request. If you didn't initiate this,
contact your admin and our support team about a possible phishing attempt."
```

See docs for complete error code reference.

**Verify:** Test error handling:

```bash
# 1. Use Dashboard Test SSO "Error response" test
# 2. Trigger error scenario
# 3. Confirm callback receives error parameters:
curl -I "http://localhost:3000/callback?error=test&error_description=test" | grep -i location

# 4. Check error displayed to user
# 5. Check error logged for debugging
```

## Step 8: Single Logout (Optional)

**Note:** Currently only supported for OpenID Connect connections. Contact WorkOS support to enable.

### RP-Initiated Logout Flow

Logs user out of your app AND all other apps via IdP:

1. Import SDK's logout redirect function (check docs)
2. Create logout endpoint in your app
3. Clear local session
4. Redirect to WorkOS logout endpoint with session ID

**Pattern from docs:**

```typescript
// User clicks "Sign Out" in your app
// 1. Clear your app's session
// 2. Redirect to WorkOS logout endpoint
const logoutUrl = getLogoutUrl({
  sessionId: userSession.id,
  // Post-logout redirect back to your app
});
```

**Verify:** If implementing logout:

```bash
# 1. Authenticate user via SSO
# 2. Click logout in your app
# 3. Confirm redirect to IdP logout
# 4. Confirm redirect back to your app
# 5. Confirm session cleared in your app
# 6. Attempt to access protected page
# 7. Confirm re-authentication required
```

## Step 9: Production Readiness

### Dashboard Configuration

Before launching to customers:

1. Navigate to WorkOS Dashboard → Organizations
2. Create production organization for each customer
3. Send Admin Portal invite link OR embed Admin Portal in your app
4. Customer completes IdP configuration via Admin Portal

**Verify:** Admin Portal setup link works:

```bash
# 1. Create test organization in Dashboard
# 2. Click "Invite admin" → "Single Sign-On"
# 3. Copy setup link
# 4. Open link in incognito window
# 5. Confirm Admin Portal loads with IdP instructions
```

### Security Checklist

Run through launch checklist from docs:

- [ ] HTTPS enforced on redirect URIs (no http://)
- [ ] State parameter validated in SP-initiated flow
- [ ] Code exchange happens server-side (never client-side)
- [ ] Session tokens use secure, httpOnly cookies
- [ ] Error messages don't leak sensitive config details
- [ ] Logout clears all session state

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables configured
grep -c "WORKOS_API_KEY\|WORKOS_CLIENT_ID\|WORKOS_REDIRECT_URI" .env* | grep -q "3" || echo "FAIL: Missing env vars"

# 2. SDK installed
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK missing"

# 3. Callback route exists (adjust path to your routing structure)
find . -name "callback*" -o -name "auth*" | grep -v node_modules | head -1 || echo "FAIL: No callback route found"

# 4. SP-initiated SSO works (manual test required)
echo "MANUAL: Test SP-initiated flow from sign-in page"

# 5. IdP-initiated SSO works (manual test required)
echo "MANUAL: Test IdP-initiated flow from Dashboard test link"

# 6. Error handling exists in callback
grep -r "error" --include="*callback*" --include="*auth*" . | grep -v node_modules | head -1 || echo "WARN: No error handling found"

# 7. Application builds
npm run build || echo "FAIL: Build failed"
```

## Error Recovery

### "Invalid client_id"

**Root cause:** Wrong `WORKOS_CLIENT_ID` in environment variables.

Fix:
1. Check WorkOS Dashboard → API Keys
2. Copy correct Client ID (starts with `client_`)
3. Update `.env` file
4. Restart application

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match Dashboard configuration.

Fix:
1. Check error message for expected URI
2. WorkOS Dashboard → Configuration → Redirect URIs
3. Add your callback URL exactly as shown in error
4. In development, include `http://localhost:PORT/callback`
5. In production, only HTTPS allowed

### "Code expired" or "invalid_grant"

**Root cause:** Code already used or took too long to exchange.

Fix:
1. Check: Are you caching authorization codes? Don't — single use only
2. Check: Network latency between redirect and code exchange
3. Retry the SSO flow (generate new authorization URL)

### "User not found" after successful SSO

**Root cause:** Profile returned but user doesn't exist in your database.

Decision tree:

```
Profile received but user not found:
  |
  +-- Just-in-Time (JIT) provisioning enabled?
  |     YES --> Create user automatically from profile
  |     NO  --> Show "User not provisioned. Contact admin."
  |
  +-- Check: Organization allows this email domain?
        If guest domain disabled, user needs domain match
```

### IdP-initiated SSO fails but SP-initiated works

**Root cause:** Callback requires state parameter.

Fix:
1. Find state validation in callback code
2. Make validation conditional: only if state exists
3. Pattern: `if (state) { validateState(state); }`

### "signin_consent_denied" not displaying user message

**Root cause:** Generic error handler catching specific case.

Fix:
1. Parse `error` parameter in callback
2. Switch on error code before generic handling
3. Show phishing-awareness message for `signin_consent_denied`

### Build succeeds but SSO redirects fail at runtime

**Root cause:** Environment variables not loaded or wrong values.

Fix:
1. Check server logs for exact error
2. Verify env vars at runtime: `console.log(process.env.WORKOS_CLIENT_ID?.slice(0, 10))`
3. Restart server after changing `.env`
4. Check: Using `dotenv` or framework's built-in env loading?

## Related Skills

- **workos-integrations**: Provider-specific SSO setup (Okta, Azure AD, Google Workspace)
- **workos-directory-sync**: Sync user directories from IdPs for JIT provisioning
- **workos-admin-portal**: Embed self-serve SSO setup in your app
