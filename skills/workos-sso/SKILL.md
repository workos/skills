---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:5f86d0c502dc -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

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

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys present and non-empty before continuing.

### SDK Installation

Detect package manager, install WorkOS SDK:

```bash
# npm
npm install @workos-inc/node

# yarn
yarn add @workos-inc/node

# pnpm
pnpm add @workos-inc/node
```

**Verify:** SDK package exists in node_modules before continuing.

## Step 3: Redirect URI Configuration (CRITICAL)

Your app MUST have a callback route to receive SSO responses. The URL pattern:

```
Production:  https://your-app.com/auth/callback
Development: http://localhost:3000/auth/callback
```

### Add Redirect URI to WorkOS Dashboard

1. Log into https://dashboard.workos.com/
2. Navigate to Redirects → Redirect URIs
3. Add your callback URL(s) (both dev and prod)
4. Save

**CRITICAL:** If redirect URI is not registered, SSO will fail with `redirect_uri_mismatch` error.

**Verify:** Redirect URI appears in dashboard list before continuing.

## Step 4: Test Organization Setup (Decision Tree)

```
Testing strategy?
  |
  +-- Quick test (Test IdP) --> Use default Test Organization (Step 5A)
  |
  +-- Real IdP test (Okta/Google/etc.) --> Create custom organization (Step 5B)
```

## Step 5A: Testing with Test Identity Provider (Quick Path)

WorkOS staging environment includes a pre-configured Test Organization with active SSO connection.

### Get Test Credentials

1. Navigate to https://dashboard.workos.com/test-sso
2. Note the Test Organization ID (starts with `org_`)
3. Note the test user email domain: `example.com`

### Test User Pattern

Use any email with `@example.com` domain:

- `alice@example.com`
- `bob@example.com`
- Any string before `@example.com` works

**Skip to Step 6** for authorization flow implementation.

## Step 5B: Testing with Real Identity Provider (Production-Like Path)

### Create Organization

1. Navigate to https://dashboard.workos.com/organizations
2. Click "Create organization"
3. Enter organization name (e.g., "Acme Corp")
4. Note the Organization ID (starts with `org_`)

### Create SSO Connection

1. Open the organization you created
2. Click "Invite admin"
3. Select "Single Sign-On"
4. Choose one:
   - Enter admin email to send setup link
   - Copy setup link to share directly

### Complete Identity Provider Setup

The setup link opens Admin Portal with provider-specific instructions. You will need:

- Account with chosen identity provider (Okta, Google Workspace, Azure AD, etc.)
- Admin access to configure SAML/OIDC app
- ACS URL and Entity ID from Admin Portal instructions

Follow the provider-specific steps shown in Admin Portal. Do NOT attempt to configure manually — the instructions are provider-specific.

**Verify:** Connection status shows "Active" in dashboard before continuing.

## Step 6: Implement Authorization Flow

### Get Authorization URL (Login Initiation)

When user wants to sign in, redirect them to WorkOS authorization endpoint:

```javascript
const WorkOS = require('@workos-inc/node').WorkOS;
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Option 1: Organization-based (recommended)
const authorizationUrl = workos.sso.getAuthorizationURL({
  organization: 'org_123456', // From Step 5A or 5B
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://your-app.com/auth/callback',
  state: generateRandomState(), // CSRF protection
});

// Option 2: Domain-based (discovers org by email domain)
const authorizationUrl = workos.sso.getAuthorizationURL({
  domain: 'example.com', // User's email domain
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://your-app.com/auth/callback',
  state: generateRandomState(),
});

// Redirect user
res.redirect(authorizationUrl);
```

**CRITICAL:** Store `state` parameter in session/cookie before redirecting. You MUST verify it matches on callback.

### Handle Callback (Login Completion)

Create route at `/auth/callback` (or your configured redirect URI):

```javascript
// GET /auth/callback
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // 1. Verify state parameter (CSRF protection)
  const storedState = req.session.state; // Or from cookie
  if (state !== storedState) {
    return res.status(400).send('Invalid state parameter');
  }

  // 2. Handle errors
  if (error) {
    return handleSSOError(error, error_description, res);
  }

  // 3. Exchange code for profile
  try {
    const profile = await workos.sso.getProfileAndToken({
      code,
      clientId: process.env.WORKOS_CLIENT_ID,
    });

    // 4. Create session with user data
    req.session.user = {
      id: profile.profile.id,
      email: profile.profile.email,
      firstName: profile.profile.first_name,
      lastName: profile.profile.last_name,
      organizationId: profile.profile.organization_id,
    };

    // 5. Redirect to app
    res.redirect('/dashboard');
  } catch (err) {
    return res.status(500).send('Authentication failed');
  }
});
```

**CRITICAL:** The `code` parameter is single-use and expires in ~10 minutes. Exchange it immediately — do not cache or reuse.

## Step 7: Login Flow Selection (Decision Tree)

WorkOS supports two SSO initiation patterns:

```
Who initiates login?
  |
  +-- User starts from your app (SP-initiated) --> Default flow (Step 6)
  |
  +-- User starts from IdP portal (IdP-initiated) --> Enable in dashboard
```

### Identity Provider-Initiated SSO (Optional)

If users will initiate login from their IdP portal (e.g., Okta dashboard):

1. Navigate to https://dashboard.workos.com/configuration
2. Enable "Support IdP-initiated SSO"
3. Set a default redirect URI for IdP-initiated flows

**IMPORTANT:** Your callback route MUST handle requests without `state` parameter for IdP-initiated flows. Modify Step 6 callback to:

```javascript
// Modified state validation for IdP-initiated support
if (state && state !== storedState) {
  return res.status(400).send('Invalid state parameter');
}
// If no state parameter, it's IdP-initiated (allowed)
```

Reference: https://workos.com/docs/sso/login-flows

## Step 8: Single Logout (Optional)

**Check docs for current support:** Single Logout is only supported for OpenID Connect connections. See https://workos.com/docs/sso/single-logout

If your integration uses OIDC (not SAML), implement logout:

```javascript
// Logout endpoint
app.post('/logout', (req, res) => {
  const logoutUrl = workos.sso.getLogoutURL({
    sessionId: req.session.workosSessionId, // Stored during login
    redirectUri: 'https://your-app.com/',
  });

  req.session.destroy();
  res.redirect(logoutUrl);
});
```

This logs the user out of both your app AND their identity provider (RP-initiated logout).

**If using SAML:** Contact WorkOS support at support@workos.com — Single Logout is not generally available for SAML.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env* || echo "FAIL: Missing WorkOS env vars"

# 2. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 3. Check callback route exists (example for Express)
grep -r "auth/callback\|/callback" . --include="*.js" --include="*.ts" || echo "FAIL: Callback route not found"

# 4. Test authorization URL generation (manual)
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const url = workos.sso.getAuthorizationURL({
  organization: 'org_01EHQMYV6MBK39QC5PZXHY59C3', // Test org
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'http://localhost:3000/callback',
  state: '12345'
});
console.log(url.startsWith('https://') ? 'PASS' : 'FAIL');
"

# 5. Check redirect URI registered (manual)
echo "MANUAL: Verify redirect URI at https://dashboard.workos.com/configuration/redirects"
```

**Manual test:** Complete an end-to-end SSO flow:

1. Navigate to your login page
2. Trigger SSO redirect (with Test IdP or real IdP)
3. Authenticate at identity provider
4. Verify callback receives `code` parameter
5. Verify user profile data extracted correctly
6. Verify session created and user redirected

## Error Recovery

### "redirect_uri_mismatch"

**Root cause:** Callback URL not registered in WorkOS dashboard or does not exactly match.

**Fix:**

1. Check the redirect URI used in `getAuthorizationURL()` call
2. Verify exact match at https://dashboard.workos.com/configuration/redirects
3. Common mismatches:
   - `http` vs `https`
   - Trailing slash: `/callback` vs `/callback/`
   - Port number: `localhost:3000` vs `localhost:8080`
   - Path: `/auth/callback` vs `/callback`

### "invalid_grant" or "code expired"

**Root cause:** Authorization code was already used, expired, or `getProfileAndToken()` called too slowly.

**Fix:**

1. Never reuse authorization codes — they are single-use
2. Exchange code immediately in callback handler (within 10 minutes)
3. Check for duplicate callback handling (e.g., browser making multiple requests)

### "Invalid state parameter"

**Root cause:** CSRF token mismatch — state parameter does not match stored value.

**Fix:**

1. Verify state is stored in session/cookie before redirect
2. Verify session/cookie persists across redirect
3. Check session middleware is configured correctly (Express: `express-session`)
4. For IdP-initiated SSO, state will be missing — see Step 7

### "signin_consent_denied"

**Root cause:** User declined the sign-in consent prompt (see https://workos.com/docs/sso/sign-in-consent).

**User-facing message:**

```
"You declined to sign in. If you did not initiate this request, please contact your admin and support@yourapp.com — this may be a phishing attempt."
```

**Fix:** This is a user action, not a technical error. Log the event for security monitoring.

### "Connection not found"

**Root cause:** Organization has no active SSO connection, or connection is misconfigured.

**Fix:**

1. Verify connection status in dashboard: https://dashboard.workos.com/organizations
2. Check that "Active" badge is present
3. For Test IdP, use the default test organization ID
4. For custom connections, verify Admin Portal setup completed

### "User email domain does not match organization"

**Root cause:** User authenticated with email domain not verified for the organization (e.g., personal Gmail for work SSO).

**Expected behavior:** This is a security feature — only verified domains can authenticate.

**Fix (if intentional):**

1. Navigate to organization in dashboard
2. Add guest email domain (https://workos.com/docs/sso/test-sso — see "Guest email domain" test)
3. Guest domains bypass verification for specific use cases (contractors, freelancers)

## Related Skills

- **workos-authkit-nextjs**: Full auth solution with SSO, MFA, and user management for Next.js
- **workos-directory-sync**: Sync user directories from identity providers (SCIM)
- **workos-admin-portal**: Self-serve SSO setup UI for customers
