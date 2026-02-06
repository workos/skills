---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- generated -->

# WorkOS Widgets API

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
1. `https://workos.com/docs/reference/widgets`
2. `https://workos.com/docs/reference/widgets/get-token`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify both exist before continuing.** Widgets API requires authenticated requests.

### SDK Detection

Determine if WorkOS SDK is installed:

```bash
# Check for SDK package
npm list @workos-inc/node 2>/dev/null || \
yarn list --pattern @workos-inc/node 2>/dev/null || \
echo "SDK not found"
```

If SDK missing, install it:

```bash
# Detect package manager and install
npm install @workos-inc/node
# OR
yarn add @workos-inc/node
```

## Step 3: Widget Use Case Identification (Decision Tree)

Read the fetched documentation to determine which widget endpoint applies:

```
Widget purpose?
  |
  +-- Generate widget session token --> Use GET /widgets/token
  |     |
  |     +-- User profile management --> organizationId required
  |     +-- SSO configuration --> organizationId required
  |     +-- Directory sync setup --> organizationId required
  |
  +-- List available widgets --> Use GET /widgets (if endpoint exists)
```

**Critical:** Widget tokens are short-lived (typically 15 minutes). Generate immediately before redirecting user.

## Step 4: Implement Token Generation

Create an API route or server function that generates widget tokens.

**Pattern for server-side token generation:**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function generateWidgetToken(organizationId: string) {
  const { token } = await workos.widgets.getToken({
    organization: organizationId,
    user: 'user_01H7ZKXS9Q8Z2V9X1Y2K3J4M5N', // Current user ID
  });
  
  return token;
}
```

**Check documentation for:**
- Exact method name (`getToken`, `createToken`, etc.)
- Required parameters (may include `user`, `organization`, `scopes`)
- Token expiration handling

## Step 5: Widget Redirect Flow

**Standard flow:**

1. User triggers widget action (e.g., "Manage SSO")
2. Server generates token via SDK
3. Server redirects to WorkOS widget URL with token
4. Widget renders, user completes action
5. WorkOS redirects back to your app

**Construct redirect URL from documentation:**

```typescript
const widgetUrl = `https://widgets.workos.com/${widgetType}?token=${token}`;
// Check docs for exact URL pattern and widget types
```

**Widget types from docs may include:**
- `sso` - SSO configuration
- `directory-sync` - Directory sync setup
- `user-profile` - User profile management

## Step 6: Handle Widget Callbacks

Check documentation for callback/webhook patterns:

```
Does widget send callback after completion?
  |
  +-- YES --> Implement webhook handler at specified path
  |     |
  |     +-- Verify webhook signature (see docs for signing method)
  |     +-- Process completion event
  |
  +-- NO --> Widget redirects to return_url parameter
        |
        +-- Add return_url to token generation parameters
        +-- Handle redirect in your app route
```

**If using webhooks:**

Create webhook endpoint:

```typescript
// app/api/workos/webhook/route.ts or /api/workos/webhook
export async function POST(request: Request) {
  const signature = request.headers.get('workos-signature');
  const payload = await request.text();
  
  // Verify signature - check docs for verification method
  // Process webhook event
  
  return new Response('OK', { status: 200 });
}
```

## Step 7: Organization ID Handling (CRITICAL)

Widgets require a WorkOS organization ID. Determine where this comes from:

```
Organization ID source?
  |
  +-- User has connected organization --> Retrieve from user's auth session/DB
  |
  +-- Admin Portal --> Fixed organization ID from environment variable
  |
  +-- Multi-tenant app --> Map tenant ID to WorkOS organization ID
```

**Validation before token generation:**

```bash
# Test organization exists in WorkOS
curl -X GET "https://api.workos.com/organizations/{org_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Should return 200 with organization data. If 404, organization doesn't exist.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key found" || echo "FAIL: API key missing/invalid"
grep -q "WORKOS_CLIENT_ID=client_" .env* && echo "PASS: Client ID found" || echo "FAIL: Client ID missing/invalid"

# 2. Verify SDK installed
npm list @workos-inc/node 2>/dev/null | grep -q "@workos-inc/node" && echo "PASS: SDK installed" || echo "FAIL: SDK not installed"

# 3. Check token generation code exists
grep -r "widgets.getToken\|widgets.createToken" . --include="*.ts" --include="*.js" && echo "PASS: Token generation implemented" || echo "FAIL: No token generation found"

# 4. Test API key is valid (requires curl and jq)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations?limit=1" | \
  jq -e '.data' >/dev/null && echo "PASS: API key valid" || echo "FAIL: API key invalid or network error"

# 5. Application builds
npm run build 2>&1 | tail -5
```

**All checks must show "PASS" before marking complete.**

## Error Recovery

### "Unauthorized" (401) on token generation

**Root cause:** Invalid or missing API key.

Fix:
1. Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_`)
2. Check key is not revoked in WorkOS Dashboard → API Keys
3. Ensure environment variable is loaded: `console.log(process.env.WORKOS_API_KEY?.substring(0, 8))`
4. Restart development server after changing `.env`

### "Organization not found" (404)

**Root cause:** organizationId doesn't exist in WorkOS or belongs to different environment.

Fix:
1. List organizations: `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/organizations`
2. Verify organizationId matches one from API response
3. Check API key environment (production vs staging) matches organization environment
4. If multi-tenant: verify tenant→organization mapping is correct

### "Token expired" on widget redirect

**Root cause:** Delay between token generation and redirect exceeded token TTL (typically 15 minutes).

Fix:
1. Generate token immediately before redirect: `const token = await generateToken(); return redirect(widgetUrl);`
2. Do not cache tokens - generate fresh on each request
3. Remove any async operations between token generation and redirect

### Widget doesn't load or shows "Invalid token"

**Root causes:**
- Token format incorrect (missing/malformed)
- Widget URL incorrect
- Token used for wrong widget type

Fix:
1. Check token is passed as URL parameter: `?token=${token}` (not in header)
2. Verify widget URL matches documentation exactly (check for https, domain, path)
3. Log full redirect URL and confirm format: `console.log('Widget URL:', widgetUrl);`
4. Check widget type matches token parameters (e.g., can't use SSO token for directory-sync widget)

### SDK import fails with "Cannot find module @workos-inc/node"

**Root cause:** SDK not installed or installed in wrong location (monorepo).

Fix:
1. Install in correct workspace: `cd path/to/app && npm install @workos-inc/node`
2. For monorepo, check `node_modules` exists in same directory as code importing SDK
3. Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
4. Verify `package.json` includes SDK in dependencies (not devDependencies)

### "user parameter required" or similar parameter error

**Root cause:** Widget token generation requires additional parameters not documented in this skill.

Fix:
1. Re-fetch documentation: `https://workos.com/docs/reference/widgets/get-token`
2. Check for required parameters: `user`, `organization`, `returnUrl`, `scopes`
3. Add missing parameters to token generation call
4. Validate parameter format (e.g., user ID format: `user_` prefix)

## Related Skills

- `workos-authkit-nextjs` - For user authentication before widget access
- `workos-sso-integration` - For SSO configuration details
- `workos-directory-sync` - For directory sync setup details
