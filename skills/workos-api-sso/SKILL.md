---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- generated -->

# WorkOS SSO API Integration

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs in order — they are the source of truth:

1. https://workos.com/docs/reference/sso
2. https://workos.com/docs/reference/sso/get-authorization-url
3. https://workos.com/docs/reference/sso/profile/get-profile-and-token
4. https://workos.com/docs/reference/sso/connection/list

If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check environment for WorkOS credentials:

```bash
# Verify API key exists and has correct prefix
grep "WORKOS_API_KEY" .env* | grep -q "sk_" || echo "FAIL: Invalid or missing API key"

# Verify client ID exists
grep "WORKOS_CLIENT_ID" .env* | grep -q "client_" || echo "FAIL: Missing client ID"
```

**Required variables:**
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_REDIRECT_URI` or callback URL configured in dashboard

### WorkOS Dashboard Setup

Verify in WorkOS Dashboard (workos.com):

1. **Redirect URI configured** - Must match your callback route exactly
2. **SSO connections exist** - At least one connection for testing
3. **Environment** - Using correct environment (staging vs production)

## Step 3: SDK Detection and Installation

Detect if WorkOS SDK is already installed:

```bash
# Check for SDK in package.json
grep -q '"@workos-inc/' package.json && echo "SDK found" || echo "SDK missing"
```

If missing, install SDK for your platform:

```
Language/Framework?
  |
  +-- Node.js/Express --> npm install @workos-inc/node
  |
  +-- Next.js --> npm install @workos-inc/node (server-side)
  |
  +-- Python --> pip install workos
  |
  +-- Ruby --> gem install workos
  |
  +-- Go --> go get github.com/workos/workos-go/v4
```

**Verify:** SDK package exists before writing integration code.

## Step 4: Initialize WorkOS Client

Create SDK client initialization based on your framework:

### Node.js/Next.js Pattern

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
```

**Location decision tree:**

```
Project structure?
  |
  +-- Next.js App Router --> lib/workos.ts (import in route handlers)
  |
  +-- Next.js Pages Router --> lib/workos.ts (import in API routes)
  |
  +-- Express --> config/workos.js (import in routes)
  |
  +-- Standalone script --> Initialize at top of file
```

**Critical:** Never initialize client in client-side code. API keys are server-only.

## Step 5: Implement SSO Authorization Flow

### 5a: Generate Authorization URL (Login Initiation)

Create endpoint that redirects users to SSO provider:

```typescript
// GET /auth/sso or similar endpoint
const authorizationUrl = workos.sso.getAuthorizationUrl({
  clientId,
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  // ONE of these is required:
  connection: 'conn_123',        // Specific connection
  organization: 'org_123',       // Organization selector
  provider: 'GoogleOAuth',       // Generic provider
});

// Redirect user to authorizationUrl
```

**Decision tree for SSO target:**

```
How to select SSO provider?
  |
  +-- Single organization/connection known --> Use connection or organization ID
  |
  +-- Multi-tenant (user selects org) --> Use organization parameter
  |
  +-- Generic social login --> Use provider parameter
  |
  +-- Domain-based routing --> Call listConnections, match domain, use connection ID
```

**State parameter (IMPORTANT):** Include `state` parameter for CSRF protection and post-login routing:

```typescript
const state = generateRandomString(); // Store in session/cookie
const authorizationUrl = workos.sso.getAuthorizationUrl({
  clientId,
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  state,
  organization: req.query.org,
});
```

### 5b: Handle Callback (Critical Security Step)

Create callback endpoint matching `WORKOS_REDIRECT_URI`:

```typescript
// GET /auth/callback or matching redirect URI path
const { code, state } = req.query;

// CRITICAL: Verify state matches (CSRF protection)
if (state !== storedState) {
  throw new Error('Invalid state parameter');
}

// Exchange code for profile
const { profile } = await workos.sso.getProfileAndToken({
  code,
  clientId,
});

// profile contains:
// - id (WorkOS user ID)
// - email
// - firstName, lastName
// - connectionId, organizationId
// - rawAttributes (provider-specific data)
```

**Error handling (REQUIRED):**

```typescript
try {
  const { profile } = await workos.sso.getProfileAndToken({ code, clientId });
  // Create session, set cookie, redirect to app
} catch (error) {
  if (error.code === 'invalid_grant') {
    // Code expired or already used - redirect to login
  }
  if (error.code === 'invalid_client') {
    // Check WORKOS_CLIENT_ID is correct
  }
  // Log error, show user-friendly message
}
```

## Step 6: Connection Management (Optional)

If building admin UI for SSO configuration:

### List Connections

```typescript
const { data: connections } = await workos.sso.listConnections({
  organizationId: 'org_123', // Optional filter
  limit: 10,
});

// Each connection has:
// - id, name, type (SAML, GoogleOAuth, etc.)
// - state ('active', 'inactive', 'draft')
// - organizationId
```

### Get Single Connection

```typescript
const connection = await workos.sso.getConnection('conn_123');
```

### Delete Connection (Use with caution)

```typescript
await workos.sso.deleteConnection('conn_123');
```

**IMPORTANT:** Deleting a connection breaks login for users. Confirm before deletion.

## Step 7: Domain Verification (Multi-Tenant Apps)

For apps where users enter email to determine SSO:

```typescript
// 1. User enters email
const email = req.body.email;
const domain = email.split('@')[1];

// 2. Find connection by domain
const { data: connections } = await workos.sso.listConnections({
  domains: [domain],
});

if (connections.length > 0) {
  // Use connection.id for getAuthorizationUrl
  const authUrl = workos.sso.getAuthorizationUrl({
    clientId,
    connection: connections[0].id,
    redirectUri: process.env.WORKOS_REDIRECT_URI,
  });
  // Redirect to SSO
} else {
  // Fall back to password login or show error
}
```

## Step 8: Session Management

After successful SSO, create application session:

```
Session storage?
  |
  +-- Express/Node --> express-session with secure cookie
  |
  +-- Next.js --> iron-session or encrypted JWT in httpOnly cookie
  |
  +-- API-only --> Return JWT, client stores securely
```

**Minimal secure session (Next.js example):**

```typescript
import { cookies } from 'next/headers';

// After getProfileAndToken succeeds
const sessionData = {
  userId: profile.id,
  email: profile.email,
  organizationId: profile.organizationId,
};

// Encrypt and set httpOnly cookie
cookies().set('session', encrypt(sessionData), {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
```

**CRITICAL:** Never store full `profile.rawAttributes` in session — it may contain sensitive data. Store only what you need.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables exist with correct prefixes
grep "WORKOS_API_KEY=sk_" .env* && grep "WORKOS_CLIENT_ID=client_" .env*

# 2. SDK installed
npm list @workos-inc/node 2>/dev/null || pip list | grep workos

# 3. Redirect URI matches callback route
# (Manual check: compare .env WORKOS_REDIRECT_URI to route path)

# 4. Authorization URL endpoint exists
grep -r "getAuthorizationUrl" . --include="*.ts" --include="*.js" --include="*.py"

# 5. Callback handler exists
grep -r "getProfileAndToken" . --include="*.ts" --include="*.js" --include="*.py"

# 6. State parameter used (CSRF protection)
grep -r "state.*getAuthorizationUrl" . --include="*.ts" --include="*.js"

# 7. Test auth flow (manual)
# - Visit /auth/sso endpoint
# - Redirects to WorkOS/SSO provider
# - Callback returns profile
# - Session created
```

**If check #6 fails:** Add state parameter for CSRF protection (see Step 5a).

## Error Recovery

### "invalid_grant" during callback

**Root cause:** Authorization code expired (10 min TTL) or already used.

**Fix:**
1. Check callback handler isn't being called twice (dev server hot reload, duplicate requests)
2. Ensure code is exchanged immediately on callback
3. Redirect user to login if code is invalid

### "invalid_client" error

**Root causes:**
1. `WORKOS_CLIENT_ID` doesn't match WorkOS Dashboard
2. Using staging key with production endpoint (or vice versa)

**Fix:**
```bash
# Verify client ID format
echo $WORKOS_CLIENT_ID | grep -q "^client_" || echo "Invalid format"

# Check API key environment matches
# - sk_test_* = staging
# - sk_live_* = production
```

### "redirect_uri_mismatch" error

**Root cause:** Callback URL not configured in WorkOS Dashboard.

**Fix:**
1. Go to WorkOS Dashboard → Configuration → Redirect URIs
2. Add exact URL (including protocol, domain, path)
3. **Must match exactly** — `http://localhost:3000/callback` ≠ `http://localhost:3000/callback/`

### "No connections found for domain"

**Root cause:** User's email domain not linked to SSO connection.

**Fix:**
1. Check WorkOS Dashboard → Connections → Domains
2. Add domain to existing connection, or
3. Fall back to password authentication for this user

### SDK import fails

**Check:**
```bash
# Node.js - verify in node_modules
ls node_modules/@workos-inc/node 2>/dev/null || echo "Package missing"

# Python - verify installed
python -c "import workos" 2>/dev/null || echo "Package missing"
```

**Fix:** Reinstall SDK, check package manager logs for errors.

### "code was called outside a request scope" (Next.js)

**Root cause:** Calling `getProfileAndToken` at module level or in React component.

**Fix:** Move SSO logic to API route handler or server action, never in client components.

### Profile missing expected fields

**Check:** Different SSO providers return different attributes.

**Pattern:**
```typescript
const { profile } = await workos.sso.getProfileAndToken({ code, clientId });

// Safe access with fallbacks
const email = profile.email; // Always present
const firstName = profile.firstName || profile.rawAttributes?.given_name || '';
const lastName = profile.lastName || profile.rawAttributes?.family_name || '';
```

## Related Skills

- `workos-authkit-nextjs` - Pre-built auth UI for Next.js (simpler than raw SSO API)
- `workos-directory-sync` - If implementing user provisioning with SSO
