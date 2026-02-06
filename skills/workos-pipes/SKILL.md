---
name: workos-pipes
description: Connect external services and data sources with WorkOS Pipes.
---

<!-- generated -->

# WorkOS Pipes

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs as source of truth:
- `https://workos.com/docs/pipes/providers`
- `https://workos.com/docs/pipes/index`

If this skill conflicts with official docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check environment variables exist:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run `grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env* 2>/dev/null` - both must be present.

### SDK Installation

Detect if WorkOS SDK is installed:

```bash
# Node.js projects
grep "@workos-inc/node" package.json

# Python projects  
grep "workos" requirements.txt pyproject.toml setup.py 2>/dev/null

# Other languages - check respective dependency files
```

If SDK missing, install before proceeding:
- Node.js: `npm install @workos-inc/node` or `yarn add @workos-inc/node`
- Python: `pip install workos`
- Check docs for other languages

## Step 3: Dashboard Configuration (Decision Tree)

Navigate to WorkOS Dashboard → Pipes → Providers section.

**Environment selection:**

```
Which environment?
  |
  +-- Sandbox/Development --> Use Shared Credentials (faster setup)
  |                           - WorkOS-managed OAuth apps
  |                           - Limited to sandbox environments
  |                           - Skip provider OAuth app creation
  |
  +-- Production          --> Use Custom Credentials (required)
                              - Your own OAuth applications
                              - Full control over branding
                              - Production-ready security
```

### Path A: Shared Credentials (Sandbox)

For each provider you need (GitHub, Slack, Google, etc.):

1. Select provider from dashboard list
2. Choose "Shared Credentials" option
3. Configure **scopes** - the permissions your app needs (e.g., `repo`, `user:email` for GitHub)
4. Add optional **description** - shown to users explaining data usage
5. Save configuration

**Critical:** Shared credentials CANNOT be used in production. You must switch to custom credentials before launch.

### Path B: Custom Credentials (Production)

For each provider:

1. **Create OAuth application in provider's dashboard**
   - Provider-specific instructions are in the WorkOS dashboard setup modal
   - Common providers:
     - GitHub: Settings → Developer settings → OAuth Apps
     - Google: Google Cloud Console → APIs & Credentials
     - Slack: api.slack.com → Your Apps
2. **Copy redirect URI from WorkOS dashboard** - format: `https://api.workos.com/sso/oauth/redirect`
3. **Set redirect URI in provider's OAuth app configuration**
4. **Copy client ID and client secret from provider**
5. **Paste credentials into WorkOS dashboard**
6. **Configure scopes** - must match what you requested in provider OAuth app
7. **Add description** for user consent screen
8. Save configuration

**Verify:** Dashboard shows "Active" status for configured provider before proceeding.

## Step 4: SDK Integration

Retrieve available providers and connection status via SDK.

### List Configured Providers

**Node.js example pattern:**

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Get providers available to your environment
const providers = await workos.pipes.listProviders();
```

**Python example pattern:**

```python
from workos import WorkOSClient

client = WorkOSClient(api_key=os.environ.get("WORKOS_API_KEY"))

# Get providers available to your environment  
providers = client.pipes.list_providers()
```

Check fetched docs for exact SDK method names - they may differ slightly.

### Initiate Connection Flow

Pattern for starting OAuth connection:

1. Generate authorization URL from SDK
2. Redirect user to authorization URL
3. Provider redirects back to your callback
4. Exchange code for connection via SDK
5. Store connection ID for future API calls

**Critical:** Do NOT implement OAuth flow manually. Use SDK authorization methods. Check docs for `createAuthorizationUrl()` or similar.

## Step 5: Connection Management

### Store Connection IDs

After user authorizes, SDK returns a connection object:

```
{
  "id": "conn_01HQWC7Z8X...",  // Store this
  "provider": "github",
  "status": "active",
  ...
}
```

**Store `connection.id` in your database** associated with user record. You need this ID to make API calls on behalf of the user.

### Make API Calls Through Pipes

Use stored connection ID to proxy API requests:

```
SDK method pattern (check docs for exact syntax):
  workos.pipes.makeRequest({
    connectionId: "conn_01HQWC7Z8X...",
    method: "GET",
    path: "/user/repos",  // Provider's native API path
    params: { ... }
  })
```

Pipes handles:
- Token refresh automatically
- Rate limiting
- Error normalization
- Credential security

**Do NOT** store or manage OAuth tokens yourself. Use connection ID only.

## Step 6: Webhook Configuration (Optional)

If you need real-time connection status updates:

1. Navigate to Dashboard → Webhooks
2. Add endpoint URL from your application
3. Subscribe to `pipe.connection.activated`, `pipe.connection.deactivated` events
4. Verify webhook signature in your handler (see docs for signing key)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup:

```bash
# 1. Environment variables configured
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env* || echo "FAIL: Missing WorkOS credentials"

# 2. SDK package installed (Node.js example)
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: WorkOS SDK not installed"

# 3. At least one provider configured (manual check)
echo "Manual: Check Dashboard → Pipes shows 'Active' provider"

# 4. Authorization flow reachable
curl -I http://localhost:3000/connect 2>/dev/null | grep "200\|302" || echo "FAIL: Connect endpoint unreachable"

# 5. Application builds
npm run build || echo "FAIL: Build errors"
```

**Manual verification required:**
- User can click "Connect [Provider]" button
- Redirects to provider OAuth screen
- After authorization, connection appears in Dashboard → Pipes → Connections
- API call via Pipes returns provider data

## Error Recovery

### "Invalid API key" or 401 Unauthorized

**Root cause:** API key misconfigured or wrong environment.

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is for correct environment (sandbox vs production)
3. Regenerate key in Dashboard → API Keys if compromised
4. Restart application after changing environment variables

### "Provider not configured" error

**Root cause:** Provider not set up in WorkOS dashboard or wrong environment.

**Fix:**
1. Go to Dashboard → Pipes → Providers
2. Verify provider shows "Active" status
3. Check scopes are configured
4. If using custom credentials, verify client ID/secret are correct
5. Ensure application is using correct environment (sandbox vs production)

### OAuth callback fails with "redirect_uri_mismatch"

**Root cause:** Redirect URI in provider OAuth app doesn't match WorkOS redirect URI.

**Fix:**
1. Copy redirect URI from WorkOS Dashboard → Pipes → [Provider] setup
2. Go to provider's OAuth application settings
3. Ensure redirect URI EXACTLY matches WorkOS redirect URI (including https://)
4. Save in provider dashboard
5. Wait 1-2 minutes for provider cache to clear
6. Retry connection flow

### Connection status shows "inactive" or "error"

**Root cause:** Token expired, revoked, or insufficient scopes.

**Fix:**
1. Check connection details in Dashboard → Pipes → Connections
2. If scopes insufficient: Update provider config with additional scopes, user must re-authorize
3. If token revoked: User must re-authorize connection
4. If expired with no refresh token: Re-configure provider with `offline_access` or equivalent scope

### SDK method not found or import error

**Root cause:** SDK version mismatch or incorrect import path.

**Fix:**
1. Check installed SDK version: `npm list @workos-inc/node` or `pip show workos`
2. Compare with docs to verify compatibility
3. Update SDK if outdated: `npm update @workos-inc/node` or `pip install --upgrade workos`
4. Check import path matches SDK version (may have changed between versions)
5. Clear build cache and restart: `rm -rf node_modules/.cache && npm run dev`

### API calls return 403 "insufficient scopes"

**Root cause:** Connection created with fewer scopes than API endpoint requires.

**Fix:**
1. Identify required scopes from provider API docs
2. Update provider configuration in Dashboard → Pipes → [Provider] → Edit scopes
3. **User must re-authorize** - existing connections keep old scopes
4. Use SDK to invalidate old connection or prompt user to reconnect
5. New authorization will request updated scopes

### Rate limit errors from provider

**Root cause:** Too many API calls to provider via Pipes.

**Fix:**
1. Pipes does NOT bypass provider rate limits - it proxies them
2. Implement exponential backoff in your application
3. Check provider's rate limit documentation
4. Consider caching API responses
5. For high-volume use cases, contact provider about rate limit increases

## Related Skills

- `workos-authkit-nextjs` - User authentication (often used alongside Pipes)
- `workos-directory-sync` - Syncing user directories (complementary to Pipes for org integrations)
