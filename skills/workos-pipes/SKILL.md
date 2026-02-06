---
name: workos-pipes
description: Connect external services and data sources with WorkOS Pipes.
---

<!-- generated -->

# WorkOS Pipes

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- `https://workos.com/docs/pipes/index`
- `https://workos.com/docs/pipes/providers`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access: `https://dashboard.workos.com`
- Navigate to Environment → Pipes section
- **CRITICAL:** Confirm at least one provider is configured (even if using shared credentials)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (required for OAuth flows)

**Verify:**
```bash
grep -E "(WORKOS_API_KEY|WORKOS_CLIENT_ID)" .env* 2>/dev/null || echo "FAIL: Missing WorkOS env vars"
```

### SDK Installation

Detect which WorkOS SDK is already installed:

```bash
# Check package.json for SDK
grep -E '"@workos-inc/(node|nextjs)"' package.json
```

**If no SDK found:**
- For Node.js/Express: Install `@workos-inc/node`
- For Next.js: Install `@workos-inc/authkit-nextjs` (includes Pipes support)

**Do not proceed** until SDK package exists in `node_modules/@workos-inc/`.

## Step 3: Provider Configuration (Decision Tree)

Determine credential strategy based on environment:

```
Environment?
  |
  +-- Sandbox/Development --> Use Shared Credentials (faster)
  |                           - No OAuth app setup required
  |                           - WorkOS-managed credentials
  |                           - Configure scopes only
  |
  +-- Production -----------> Use Custom Credentials (required)
                              - Create OAuth app with provider
                              - Use provided redirect URI
                              - Configure client ID/secret
                              - Set scopes in both places
```

### Shared Credentials Setup (Sandbox Only)

1. Navigate to Dashboard → Environment → Pipes
2. Select provider (GitHub, Slack, Google, Salesforce, etc.)
3. Choose "Shared Credentials" option
4. **Specify scopes:** List exact permissions needed (e.g., `repo`, `user:email` for GitHub)
5. **Add description:** User-facing text explaining data usage
6. Save configuration

**Verify:** Provider shows "Active" status in dashboard before continuing.

### Custom Credentials Setup (Production Required)

**CRITICAL:** Each provider has unique OAuth setup steps. Use the dashboard's built-in instructions.

1. Navigate to Dashboard → Environment → Pipes
2. Select provider
3. Choose "Custom Credentials" option
4. **Click documentation link** in setup modal for provider-specific steps
5. **Copy redirect URI** from dashboard - this is provider-specific, do not guess
6. Create OAuth application in provider's developer portal:
   - Use exact redirect URI from dashboard
   - Set scopes in provider's OAuth config if required
7. **Copy client ID and client secret** from provider
8. **Paste credentials** into dashboard form
9. **Set scopes** in dashboard (must match provider OAuth config)
10. **Add description:** User-facing text for consent screen
11. Save configuration

**Common redirect URI pattern:** `https://api.workos.com/sso/oauth/callback`

**Verify configuration:**
```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/pipes/providers \
  | jq '.data[] | select(.status == "active")'
```

Should return at least one active provider. If empty, configuration failed.

## Step 4: Connection Flow Implementation

### Backend Route Setup

Create an endpoint to initiate Pipes connection:

**Pattern for Node.js/Express:**
```typescript
// GET /pipes/connect
app.get('/pipes/connect', async (req, res) => {
  const { provider } = req.query; // e.g., 'github', 'slack'
  
  // Get authorization URL from WorkOS
  const authUrl = workos.pipes.getAuthorizationURL({
    provider,
    clientId: process.env.WORKOS_CLIENT_ID,
    redirectUri: 'https://yourdomain.com/pipes/callback',
    state: generateState(), // Your CSRF token
  });
  
  res.redirect(authUrl);
});
```

**Pattern for Next.js App Router:**
```typescript
// app/api/pipes/connect/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  
  const authUrl = workos.pipes.getAuthorizationURL({
    provider,
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: 'https://yourdomain.com/api/pipes/callback',
    state: generateState(),
  });
  
  return Response.redirect(authUrl);
}
```

**Check docs for exact method name** - may be `getConnectionURL` or `getAuthorizationURL`.

### Callback Handler

Create callback endpoint matching your redirectUri:

**Pattern:**
```typescript
// Handle OAuth callback
app.get('/pipes/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state (CSRF protection)
  if (!verifyState(state)) {
    return res.status(400).send('Invalid state');
  }
  
  // Exchange code for connection
  const connection = await workos.pipes.getConnection({
    code,
    clientId: process.env.WORKOS_CLIENT_ID,
  });
  
  // Store connection.id for user
  await saveUserConnection(req.user.id, connection.id);
  
  res.redirect('/dashboard?connected=true');
});
```

**CRITICAL:** Always verify `state` parameter to prevent CSRF attacks.

### Connection ID Storage

You MUST store the `connection.id` returned from the callback:

```
User record → connection_id → WorkOS Connection
```

**Storage options:**
- Database column: `pipes_connection_id VARCHAR(255)`
- Key-value store: `user:{id}:pipes_connection`
- Session/JWT: Store temporarily for current session

**Do NOT store:** Access tokens, refresh tokens, or raw credentials. WorkOS handles token lifecycle.

## Step 5: Using Connections

### Fetching Connection Data

Once stored, use the connection ID to make API calls:

```typescript
// Get user's connection
const connectionId = await getUserConnectionId(userId);

// Make API call through Pipes
const response = await workos.pipes.makeRequest({
  connectionId,
  method: 'GET',
  path: '/user/repos', // Provider-specific endpoint
});

const repos = response.data;
```

**Provider-specific paths:**
- GitHub: `/user/repos`, `/user`, `/repos/{owner}/{repo}`
- Slack: `/users.list`, `/conversations.list`
- Google: `/calendar/v3/calendars`
- Salesforce: `/services/data/v58.0/sobjects`

**Check provider documentation** in dashboard for exact endpoints and response formats.

### Connection Status Checking

Before making requests, verify connection is active:

```typescript
const connection = await workos.pipes.getConnection(connectionId);

if (connection.status !== 'active') {
  // Prompt user to reconnect
  return { error: 'Connection expired', reconnectUrl: '/pipes/connect?provider=github' };
}
```

**Connection states:**
- `active` - Valid, ready to use
- `expired` - Refresh token invalid, user must reconnect
- `revoked` - User revoked access

## Step 6: UI Integration

### Connection Widget (Recommended)

Use WorkOS-provided widget for consistent UX:

```html
<!-- Include widget script -->
<script src="https://cdn.workos.com/pipes/widget.js"></script>

<!-- Add connect button -->
<button data-workos-pipes="github">Connect GitHub</button>

<script>
  WorkOSPipes.init({
    clientId: 'client_...',
    redirectUri: 'https://yourdomain.com/pipes/callback',
  });
</script>
```

**Check docs for latest widget URL and initialization options.**

### Manual UI Implementation

If building custom UI:

1. Show available providers (configured in dashboard)
2. Each provider button links to `/pipes/connect?provider={provider}`
3. After callback, show connection status
4. Provide disconnect/revoke option

**Visual states:**
- Not connected: "Connect {Provider}" button
- Connected: Green checkmark + "Connected as {username}"
- Expired: Yellow warning + "Reconnect {Provider}" button

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env* | wc -l | grep -q "2" && echo "PASS" || echo "FAIL: Missing env vars"

# 2. Check SDK is installed
ls node_modules/@workos-inc/*/package.json 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Verify active providers in dashboard (requires API key)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/pipes/providers \
  | jq -e '.data[] | select(.status == "active")' && echo "PASS" || echo "FAIL: No active providers"

# 4. Check connection routes exist (adjust paths for your framework)
grep -r "pipes.*connect" app/ src/ routes/ 2>/dev/null || echo "WARN: No connection routes found"

# 5. Build succeeds
npm run build
```

**If check #3 fails:** Go back to Step 3 and configure at least one provider in dashboard.

## Error Recovery

### "Invalid client_id" during OAuth flow

**Root cause:** `WORKOS_CLIENT_ID` mismatch or not set.

Fix:
1. Check `.env` file has `WORKOS_CLIENT_ID`
2. Verify value matches Dashboard → API Keys → Client ID
3. Restart dev server after env var change

### "Redirect URI mismatch"

**Root cause:** OAuth callback URL doesn't match provider configuration.

Fix:
1. Check exact redirect URI in Dashboard → Pipes → Provider Setup
2. Copy redirect URI exactly (includes protocol, domain, path)
3. Use same URI in both places:
   - Provider's OAuth app settings
   - Your `redirectUri` parameter in code
4. **Do not use localhost in production configs** - use tunnel service for local testing

### "Connection expired" on API requests

**Root cause:** Refresh token invalid or user revoked access.

Fix:
1. Check connection status before requests:
   ```typescript
   const conn = await workos.pipes.getConnection(connectionId);
   if (conn.status !== 'active') {
     // Redirect to reconnect flow
   }
   ```
2. Implement reconnection flow:
   - Clear stored connection_id
   - Redirect user to `/pipes/connect?provider={provider}`
   - Handle new callback and update stored connection_id

### "Insufficient scopes" when calling provider API

**Root cause:** Requested scopes in dashboard don't cover API endpoint requirements.

Fix:
1. Check provider API documentation for required scopes
2. Update scopes in Dashboard → Pipes → Provider → Edit
3. **Critical:** User must reconnect to grant new scopes
4. Delete existing connection_id and initiate new connection flow

**Example:** GitHub `/user/emails` requires `user:email` scope, not just `user`.

### "State parameter missing or invalid"

**Root cause:** CSRF protection failure or session expired.

Fix:
1. Generate unique state per auth request
2. Store state in session/temporary storage
3. Verify state in callback matches stored value
4. Set reasonable expiry (5-10 minutes)

**Pattern:**
```typescript
// Generate state
const state = crypto.randomBytes(32).toString('hex');
req.session.oauthState = state;

// Verify state
if (req.query.state !== req.session.oauthState) {
  throw new Error('Invalid state');
}
delete req.session.oauthState; // Single use
```

### SDK import fails after installation

**Root cause:** Package manager cache or wrong import path.

Fix:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify package structure
ls node_modules/@workos-inc/*/dist/
```

Check docs for correct import:
- Node SDK: `import { WorkOS } from '@workos-inc/node';`
- Next.js: May use different entry point

## Related Skills

- `workos-authkit-nextjs` - For authentication alongside Pipes
- `oauth-state-management` - CSRF protection patterns
- `api-key-rotation` - Rotating WorkOS credentials safely
