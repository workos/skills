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

### WorkOS Account Setup

- Confirm WorkOS Dashboard access at `https://dashboard.workos.com/`
- Navigate to API Keys section
- Locate `WORKOS_API_KEY` (starts with `sk_`)
- Locate `WORKOS_CLIENT_ID` (starts with `client_`)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - API key from dashboard
- `WORKOS_CLIENT_ID` - Client ID from dashboard
- `WORKOS_REDIRECT_URI` - Your application's callback URL (must match dashboard configuration)

**Verify:** All three environment variables exist and are non-empty.

### Project Structure

- Confirm SDK package exists in `package.json` dependencies
- Confirm callback route exists in your application router

## Step 3: Install SDK (if needed)

Detect package manager from lockfile, install WorkOS SDK:

```bash
# Detect: pnpm-lock.yaml → pnpm, package-lock.json → npm, yarn.lock → yarn
npm install @workos-inc/node
# OR
pnpm add @workos-inc/node
# OR
yarn add @workos-inc/node
```

**Verify:** SDK exists in node_modules before continuing.

## Step 4: SSO Flow Type (Decision Tree)

Determine which SSO flow(s) to implement based on requirements:

```
SSO flow needed?
  |
  +-- User starts from your login page → Service Provider-initiated (SP-initiated)
  |     - User enters email in your app
  |     - App redirects to IdP
  |     - IdP redirects back to callback
  |
  +-- User starts from their IdP dashboard → Identity Provider-initiated (IdP-initiated)
  |     - User logs into IdP directly
  |     - Selects your app from IdP dashboard
  |     - IdP redirects to callback
  |
  +-- Both flows → Implement both patterns
```

**Most applications need BOTH flows.** IdP-initiated is commonly forgotten but critical for enterprise users.

## Step 5: Implement Authorization Flow (SP-initiated)

### Create Authorization URL Endpoint

Create an API endpoint that generates the WorkOS authorization URL:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// In your login handler
const authorizationUrl = workos.sso.getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  
  // Choose ONE of these options:
  organization: 'org_12345',        // For known organization
  // OR
  provider: 'GoogleOAuth',          // For specific provider
  // OR
  connection: 'conn_12345',         // For specific connection
  
  state: generateRandomState(),     // CSRF protection - verify in callback
});

// Redirect user to authorizationUrl
```

**Critical decision points:**

- **Known organization?** Use `organization` parameter (most common for B2B)
- **Provider selection?** Use `provider` parameter (e.g., Google, Okta, Azure AD)
- **Specific connection?** Use `connection` parameter (direct connection ID)

**State parameter:** Generate cryptographically random string (32+ characters), store in session/cookie, verify in callback. This prevents CSRF attacks.

## Step 6: Implement Callback Handler

### Create Callback Route

The callback route MUST match `WORKOS_REDIRECT_URI` exactly.

```
WORKOS_REDIRECT_URI example → Route location
https://app.com/auth/callback → /auth/callback
https://app.com/sso/callback  → /sso/callback
```

**Pattern for callback handler:**

```typescript
// Extract code and state from query parameters
const { code, state, error, error_description } = queryParams;

// 1. Handle error responses FIRST
if (error) {
  // Map error codes to user-friendly messages
  switch (error) {
    case 'signin_consent_denied':
      // User cancelled at IdP - show contact admin message
      return showConsentDeniedError();
    case 'invalid_credentials':
      // Authentication failed at IdP
      return showAuthenticationError();
    default:
      // Generic error - log for debugging
      console.error('SSO error:', error, error_description);
      return showGenericError();
  }
}

// 2. Verify state parameter (CRITICAL for security)
const storedState = getStateFromSession();
if (state !== storedState) {
  throw new Error('State mismatch - possible CSRF attack');
}

// 3. Exchange code for profile
const profile = await workos.sso.getProfileAndToken({
  code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// 4. Extract user information
const {
  profile: {
    id,           // WorkOS user ID
    email,
    first_name,
    last_name,
    raw_attributes, // Full IdP response
  },
  access_token,   // For API calls
  organization_id, // Customer's org
  connection_id,   // Specific SSO connection
  connection_type, // e.g., 'OktaSAML', 'GoogleOAuth'
} = profile;

// 5. Create/update user session in your system
// - Look up or create user by email
// - Store organization_id for multi-tenant apps
// - Create session cookie/JWT
```

**Error handling priority:**

1. Check for `error` parameter first
2. Verify `state` parameter (security)
3. Only then exchange `code` for profile

## Step 7: Handle IdP-Initiated SSO

**CRITICAL:** IdP-initiated flow does NOT include `state` parameter.

```typescript
// In callback handler, detect flow type:
if (!state && code) {
  // IdP-initiated flow - state verification not applicable
  const profile = await workos.sso.getProfileAndToken({
    code,
    clientId: process.env.WORKOS_CLIENT_ID,
  });
  
  // Continue with session creation
}
```

**Security note:** IdP-initiated flows have slightly different security properties. The IdP signature on the SAML assertion provides authenticity. See docs for SAML security details.

## Step 8: Testing Flow (Decision Tree)

```
Testing approach?
  |
  +-- Quick validation → Use Test Identity Provider
  |     - Pre-configured in staging environment
  |     - No IdP account needed
  |     - Tests all scenarios
  |
  +-- Production-like testing → Create real IdP connection
        - Requires IdP account (Okta, Google, etc.)
        - Use Admin Portal for setup
        - Tests actual customer experience
```

### Test with Test Identity Provider

1. Go to WorkOS Dashboard → Test SSO page
2. Use the default Test Organization (pre-configured)
3. Follow test scenarios:
   - **SP-initiated:** Start from your login page, enter test email
   - **IdP-initiated:** Use the "Simulate IdP login" button
   - **Guest domain:** Test with non-verified email domain
   - **Error response:** Trigger error to test error handling

**Verification for each scenario:**

```bash
# Check callback receives correct parameters
# SP-initiated should have: code, state
# IdP-initiated should have: code (no state)
# Error case should have: error, error_description
```

### Test with Real Identity Provider

1. Create organization in Dashboard: `https://dashboard.workos.com/organizations`
2. Click "Invite admin" → Select "Single Sign-On"
3. Send setup link or copy it
4. Follow Admin Portal instructions for your chosen IdP

**Provider-specific setup available for:**

- Google Workspace
- Okta
- Azure AD / Entra ID
- OneLogin
- PingFederate
- JumpCloud
- Others (see integrations docs)

## Step 9: Implement Single Logout (Optional)

**Note:** Currently only supported for OpenID Connect connections. Contact WorkOS support for SAML logout.

### RP-Initiated Logout

Redirect user to WorkOS logout endpoint to sign them out of all SSO sessions:

```typescript
const logoutUrl = workos.sso.getLogoutUrl({
  sessionId: currentSessionId, // From profile response
});

// Redirect user to logoutUrl
// WorkOS will redirect back to your app after logout
```

**Flow:**

1. User clicks "Sign out" in your app
2. Redirect to WorkOS logout URL
3. WorkOS terminates SSO session at IdP
4. WorkOS redirects back to your configured logout redirect URI
5. Your app clears local session

## Step 10: Dashboard Configuration

### Required Configuration

Navigate to Dashboard → SSO section and verify:

1. **Redirect URIs:** Your `WORKOS_REDIRECT_URI` is listed
   - Must be HTTPS in production
   - Localhost allowed for development
   - Exact match required (including trailing slash)

2. **Domains (optional):** Add verified domains for domain-based routing
   - Used for automatic organization detection
   - User enters email → WorkOS routes to correct IdP

3. **Default Connection (optional):** Set fallback for unmatched domains

### Adding Redirect URIs

```bash
# Verify your redirect URI is registered
curl https://api.workos.com/sso/redirect_uris \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

If missing, add in Dashboard or via API.

## Verification Checklist (ALL MUST PASS)

Run these commands and tests:

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID  
env | grep WORKOS_REDIRECT_URI

# 2. SDK installed
ls node_modules/@workos-inc/node/package.json

# 3. Callback route exists (example - adjust path)
grep -r "workos.sso.getProfileAndToken" . --include="*.ts" --include="*.js"

# 4. State verification exists (security check)
grep -r "state" . --include="*.ts" --include="*.js" | grep -i "verify\|match\|compare"
```

**Manual tests:**

- [ ] SP-initiated flow: Start from login, redirect to IdP, callback succeeds
- [ ] IdP-initiated flow: Start from IdP, direct to callback, session created
- [ ] Error handling: Trigger error, user sees friendly message
- [ ] Logout (if implemented): Sign out terminates SSO session

## Error Recovery

### "redirect_uri_mismatch" error

**Root cause:** Callback URL doesn't match Dashboard configuration.

**Fix:**

1. Check exact URL in browser when error occurs
2. Go to Dashboard → SSO → Redirect URIs
3. Add exact URL including protocol, domain, path, trailing slash
4. Retry login flow

**Common mistakes:**

- `http://` vs `https://`
- Missing or extra trailing slash
- `localhost:3000` vs `localhost:3001`

### "invalid_grant" or "code expired"

**Root cause:** Authorization code used twice or expired (10 minute TTL).

**Fix:**

1. Check callback handler doesn't retry code exchange on error
2. Ensure no duplicate callback executions (middleware, redirects)
3. Verify system clock is accurate (clock skew can cause expiry)

### "State mismatch" error

**Root cause:** State parameter validation failing.

**Fix:**

1. Check state storage mechanism (session, cookie) persists across redirects
2. Verify state generation is cryptographically random
3. For IdP-initiated flow, skip state verification (no state parameter)

**Pattern to detect flow type:**

```typescript
if (!state && code) {
  // IdP-initiated - skip state check
} else if (state && code) {
  // SP-initiated - verify state
} else {
  // Invalid request
}
```

### "User not found" after successful SSO

**Root cause:** Email doesn't match existing user in your database.

**Fix:**

1. Decide on user provisioning strategy:
   - **Just-in-time (JIT):** Create user on first SSO login
   - **Pre-provisioned:** Require admin to create user first
   - **Directory Sync:** Sync users via WorkOS Directory Sync

2. For JIT provisioning, create user record in callback:

```typescript
let user = await findUserByEmail(profile.email);
if (!user) {
  user = await createUser({
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    organizationId: profile.organization_id,
  });
}
```

### "signin_consent_denied" error

**Root cause:** User cancelled sign-in at IdP consent screen.

**Fix:** Display user-friendly message:

```
"You cancelled the sign-in request. If you didn't initiate this login, 
please contact your IT admin immediately as this may indicate a phishing attempt.

If you meant to cancel, you can try again or contact support@yourapp.com"
```

**Why this matters:** Consent denial can indicate:

- User accidentally clicked wrong app
- Phishing attempt targeting user
- User testing/exploring

### API key authentication errors

**Root cause:** Invalid or missing API key.

**Fix:**

```bash
# 1. Verify API key format
echo $WORKOS_API_KEY | grep "^sk_"

# 2. Test API key
curl https://api.workos.com/sso/profile \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# 3. If invalid, regenerate in Dashboard → API Keys
```

**Never commit API keys to version control.** Use environment variables only.

## Related Skills

- **workos-authkit-nextjs**: Full auth solution with SSO built-in (Next.js)
- **workos-directory-sync**: Sync user directories from IdPs after SSO
- **workos-admin-portal**: Enable customer self-service SSO setup
