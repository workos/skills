---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:5f86d0c502dc -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth for SSO implementation:

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

### Environment Variables

Check for required variables in `.env.local` or environment:

- `WORKOS_API_KEY` — starts with `sk_` (production) or `sk_test_` (staging)
- `WORKOS_CLIENT_ID` — starts with `client_`

**Verify:** Both keys exist and have correct prefixes. Staging keys access Test Identity Provider by default.

### Redirect URI Configuration

Confirm callback URL is registered in WorkOS Dashboard:

1. Log into https://dashboard.workos.com/
2. Navigate to _API Keys_ → _Redirect URIs_
3. Verify your callback URL (e.g., `https://your-app.com/sso/callback`) is listed

**Critical:** Exact match required — trailing slashes and protocols must match.

## Step 3: Install SDK

Detect package manager from lockfile, install WorkOS SDK:

```bash
# Detect which lockfile exists
ls package-lock.json yarn.lock pnpm-lock.yaml bun.lockb 2>/dev/null

# Install matching package manager
npm install @workos-inc/node
# OR
yarn add @workos-inc/node
# OR
pnpm add @workos-inc/node
# OR
bun add @workos-inc/node
```

**Verify:** SDK package exists in node_modules before continuing.

```bash
ls node_modules/@workos-inc/node/package.json
```

## Step 4: Login Flow Selection (Decision Tree)

```
User initiates SSO from?
  |
  +-- Your app's login page
  |   --> Service Provider-Initiated (SP-initiated)
  |   --> User enters email → redirect to IdP → redirect back
  |   --> IMPLEMENTATION: Step 5
  |
  +-- Identity Provider portal
      --> Identity Provider-Initiated (IdP-initiated)
      --> User selects your app from IdP → redirect to your app
      --> IMPLEMENTATION: Step 6 (callback only, no authorization URL)
```

**Both flows require the same callback handler.** Implement Step 5 for SP-initiated, then Step 6 for IdP-initiated support.

## Step 5: Implement SP-Initiated SSO

### 5.1: Generate Authorization URL

Create endpoint to start SSO flow. Check fetched docs for exact method signature.

**Typical pattern (verify against docs):**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate authorization URL
const authorizationUrl = workos.sso.getAuthorizationURL({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://your-app.com/sso/callback',
  // ONE OF:
  organization: 'org_123', // For specific org
  // OR
  provider: 'GoogleOAuth', // For specific provider
  // OR
  domain: 'example.com', // For domain-based routing
});

// Redirect user to authorizationUrl
```

**Decision tree for user identification:**

```
How to identify which IdP?
  |
  +-- You know the organization ID
  |   --> Use organization parameter
  |
  +-- User enters email
  |   --> Extract domain → use domain parameter
  |   --> WorkOS routes to correct IdP
  |
  +-- Multi-provider login page
      --> Use provider parameter (GoogleOAuth, MicrosoftOAuth, etc.)
```

Check fetched docs for supported provider values.

### 5.2: State Parameter (Optional but Recommended)

For CSRF protection and context preservation:

```typescript
const state = generateRandomString(); // Your implementation
storeInSession(state); // Your session mechanism

const authorizationUrl = workos.sso.getAuthorizationURL({
  // ... other params
  state: state,
});
```

**Verify state** in callback handler (Step 6.2).

## Step 6: Implement Callback Handler

### 6.1: Create Callback Route

Create handler at your configured redirect URI path (e.g., `/sso/callback`).

Check fetched docs for `authenticateWithCode` method signature:

```typescript
// Callback handler receives: code, state parameters
const { code, state, error, error_description } = request.query;

// Handle errors first (Step 6.3)
if (error) {
  // See Step 6.3
}

// Exchange code for profile
const profile = await workos.sso.authenticateWithCode({
  clientId: process.env.WORKOS_CLIENT_ID,
  code: code,
});

// profile contains:
// - profile.id (unique user ID)
// - profile.email
// - profile.firstName, profile.lastName
// - profile.organizationId
// - profile.connectionId
```

### 6.2: State Validation (If Used)

```typescript
const storedState = getFromSession(); // Your session mechanism
if (state !== storedState) {
  throw new Error('State mismatch — possible CSRF attack');
}
```

### 6.3: Error Handling (CRITICAL)

**Required error codes to handle:**

```typescript
switch (error) {
  case 'signin_consent_denied':
    // User denied consent at IdP
    // Action: Show "Contact your admin" message
    // Do NOT retry automatically — user explicitly declined
    break;

  case 'invalid_request':
    // Configuration issue (wrong redirect URI, client ID, etc.)
    // Action: Log error, show generic "Configuration error"
    // Fix: Check Dashboard settings
    break;

  case 'access_denied':
    // IdP rejected authentication
    // Action: Show "Access denied by your organization"
    break;

  default:
    // Generic error
    // error_description contains details
    // Log for debugging, show generic error to user
}
```

Check fetched docs for complete error code list.

### 6.4: Session Management

After successful authentication:

```typescript
// Create session with profile data
const session = {
  userId: profile.id,
  email: profile.email,
  organizationId: profile.organizationId,
};

// Store session (your implementation)
setUserSession(session);

// Redirect to app dashboard
redirect('/dashboard');
```

**Critical for IdP-initiated:** Callback handler must work WITHOUT prior authorization URL generation. User arrives directly from IdP with code.

## Step 7: Test with Test Identity Provider

### 7.1: Verify Test Organization Exists

Navigate to Dashboard staging environment:

1. Log into https://dashboard.workos.com/
2. Switch to **staging environment** (top right)
3. Navigate to _Organizations_
4. Confirm "Test Organization" exists with active SSO connection

**If missing:** Your staging environment should have this by default. Contact WorkOS support.

### 7.2: Test SP-Initiated Flow

```bash
# Start your app
npm run dev

# Navigate to login page
open http://localhost:3000/login

# Enter test email: test@example.com
# Should redirect to Test IdP
# Click "Sign in" on Test IdP
# Should redirect back to your app with successful authentication
```

**Verify:** Check callback handler receives `code` parameter, not `error`.

### 7.3: Test IdP-Initiated Flow (CRITICAL)

**Important:** Disable AuthKit first if enabled:

1. Navigate to https://dashboard.workos.com/authentication
2. Toggle AuthKit OFF
3. Save

Then test:

1. Navigate to Test SSO page: https://dashboard.workos.com/test-sso
2. Click "Test IdP-initiated SSO" link
3. Should land directly on Test IdP
4. Click "Sign in"
5. Should redirect to your callback handler

**If fails:** Check callback handler doesn't require prior authorization URL generation.

### 7.4: Test Error Scenarios

From Test SSO page, test:

- **Consent Denied**: Click "Deny" on Test IdP → verify `signin_consent_denied` error handled
- **Guest Email**: Use `guest@different-domain.com` → verify profile contains guest email
- **Generic Error**: Click "Simulate Error" → verify `error` and `error_description` handled

## Step 8: Configure Production Organization

### 8.1: Create Organization

In Dashboard production environment:

1. Navigate to _Organizations_
2. Click "Create organization"
3. Enter customer name (e.g., "Acme Corp")
4. Enter domain (e.g., "acme.com")
5. Save

### 8.2: Enable SSO Connection

**Decision tree for setup method:**

```
Who configures SSO?
  |
  +-- Your team (white-glove setup)
  |   --> Manual connection creation (Step 8.3)
  |
  +-- Customer admin (self-serve)
      --> Admin Portal invitation (Step 8.4)
```

### 8.3: Manual Connection Setup (White-Glove)

1. Open organization in Dashboard
2. Click "Create connection"
3. Select identity provider (Okta, Azure AD, Google, etc.)
4. Follow provider-specific instructions from fetched docs
5. Test connection with "Test Connection" button

Check `workos-integrations` skill for provider-specific setup details.

### 8.4: Admin Portal Invitation (Self-Serve)

1. Open organization in Dashboard
2. Click "Invite admin"
3. Select "Single Sign-On"
4. Enter customer admin email OR copy setup link
5. Customer follows Admin Portal instructions

**Verify:** Connection status changes to "Active" after customer completes setup.

## Step 9: Single Logout (Optional)

**Check fetched docs for current support status.** As of last update:

- Supported for OpenID Connect connections only
- Not supported for SAML connections
- Limited scenarios

### Implementation (if supported)

```typescript
// RP-initiated logout
const logoutUrl = workos.sso.getLogoutURL({
  sessionId: profile.sessionId, // From authentication response
});

// Redirect user to logoutUrl
// This logs out from your app AND IdP
```

**Fallback:** If Single Logout not supported, implement local logout only:

```typescript
// Clear local session
clearUserSession();
redirect('/login');

// User remains logged into IdP (standard behavior)
```

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env.local || echo "FAIL: Missing env vars"

# 2. SDK installed
ls node_modules/@workos-inc/node/package.json || echo "FAIL: SDK not installed"

# 3. Callback route exists (adjust path to your implementation)
find . -name "*callback*" -o -name "*sso*" | grep -v node_modules

# 4. Test authentication with curl (requires running app)
curl -I http://localhost:3000/sso/callback?code=test 2>/dev/null | grep -E "200|302" || echo "FAIL: Callback not responding"

# 5. Production build succeeds
npm run build
```

**Manual verification:**

- [ ] SP-initiated flow works with Test IdP
- [ ] IdP-initiated flow works with Test IdP
- [ ] `signin_consent_denied` error displays helpful message
- [ ] Callback handler logs profile data correctly
- [ ] Session persists across page reloads
- [ ] Production organization has active SSO connection

## Error Recovery

### "Connection not found"

**Root cause:** Authorization URL uses `organization` parameter, but organization has no active SSO connection.

**Fix:**

1. Check organization in Dashboard
2. Verify SSO connection status is "Active"
3. For test: Use "Test Organization" in staging environment
4. For production: Customer must complete Admin Portal setup

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match Dashboard configuration EXACTLY.

**Fix:**

1. Check actual callback URL in browser (after IdP redirect)
2. Log into Dashboard → API Keys → Redirect URIs
3. Add exact URL including protocol and trailing slash
4. Common mismatch: `http://localhost:3000/callback/` vs `http://localhost:3000/callback`

### "Invalid client credentials"

**Root cause:** Wrong `WORKOS_CLIENT_ID` or `WORKOS_API_KEY`.

**Fix:**

1. Verify keys in Dashboard → API Keys
2. Check environment (staging keys work only in staging)
3. Confirm no extra whitespace in `.env.local`
4. Restart app after changing env vars

### "State mismatch" or "Invalid state"

**Root cause:** State parameter implementation broken or missing.

**Fix:**

1. If not using state: Remove state validation from callback handler
2. If using state: Check session storage mechanism works
3. Verify state generation uses cryptographically secure random
4. Check session doesn't expire between authorization URL and callback

### Callback receives `error=invalid_request`

**Root cause:** Configuration error in authorization URL generation.

**Fix:**

1. Check parameters passed to `getAuthorizationURL`:
   - `clientId` matches Dashboard
   - `redirectUri` matches Dashboard exactly
   - At least one of: `organization`, `provider`, or `domain`
2. Check SDK version supports your parameter combination
3. Review fetched docs for required parameters

### User sees "This app hasn't been verified" (Google OAuth)

**Root cause:** Google SSO connection not verified with Google.

**Fix:**

1. This is expected for development/staging
2. For production: Follow Google OAuth verification process
3. Alternatively: Use Test IdP or different provider for testing
4. Users can click "Advanced" → "Go to [app] (unsafe)" to proceed (dev only)

### IdP-initiated flow lands on 404

**Root cause:** Callback handler doesn't handle missing `state` parameter.

**Fix:**

1. Make `state` parameter optional in callback handler
2. IdP-initiated flow doesn't include state (by design)
3. Check: `const state = request.query.state || null;`

### "cookies was called outside request scope" (Next.js 15+)

**Root cause:** Async cookie operations not properly awaited.

**Fix:**

1. Ensure callback handler is async
2. Await all session operations
3. Check session library compatibility with Next.js 15+
4. See `workos-authkit-nextjs` skill for Next.js-specific patterns

## Related Skills

- **workos-authkit-nextjs**: Higher-level Next.js SSO integration with UI components
- **workos-integrations**: Provider-specific SSO setup instructions (Okta, Azure AD, Google, etc.)
- **workos-admin-portal**: Self-serve SSO setup for customers
- **workos-directory-sync**: Sync user directories from IdPs after SSO is configured
- **workos-rbac**: Add role-based access control after SSO authentication
- **workos-domain-verification**: Verify domain ownership before enabling SSO
