---
name: workos-pipes
description: Connect external services and data sources with WorkOS Pipes.
---

<!-- refined:sha256:1bd2ec7cff00 -->

# WorkOS Pipes

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs before implementing:
- https://workos.com/docs/pipes/providers
- https://workos.com/docs/pipes/index

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Project Structure

- Confirm WorkOS SDK is installed (`@workos-inc/node` or language-specific SDK)
- Confirm project has environment variable support (`.env`, `.env.local`, or runtime config)

### Environment Variables

Check for required WorkOS credentials:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (for OAuth flows)

**Verify:** Run `echo $WORKOS_API_KEY` or equivalent — should output masked value starting with `sk_`.

## Step 3: Provider Configuration (Dashboard)

**This is a manual dashboard step — guide the user through it.**

Navigate to: https://dashboard.workos.com/environment/pipes

### Credential Type Decision Tree

```
Production deployment?
  |
  +-- YES --> Use Custom Credentials (Step 3a)
  |
  +-- NO  --> Use Shared Credentials (Step 3b)
```

### Step 3a: Custom Credentials (Production)

For each provider you need (GitHub, Slack, Google, Salesforce, etc.):

1. **Create OAuth app in provider's dashboard**
   - Follow provider-specific instructions in WorkOS dashboard setup modal
   - Note: Each provider has different OAuth setup UIs

2. **Copy redirect URI from WorkOS dashboard**
   - Format: `https://api.workos.com/sso/callback/{provider}`
   - Paste this EXACT URI into provider's OAuth app settings

3. **Configure in WorkOS dashboard:**
   - Client ID (from provider's OAuth app)
   - Client Secret (from provider's OAuth app)
   - Scopes (e.g., `repo`, `user:email` for GitHub)
   - Optional: Description for user consent screen

4. **Verify scopes in both locations:**
   - WorkOS dashboard scope field
   - Provider's OAuth app settings (some providers require scopes set there too)

**Critical:** Redirect URI mismatch is the #1 cause of OAuth failures. Copy-paste, don't type.

### Step 3b: Shared Credentials (Sandbox Only)

**Only available in sandbox environments — NOT for production.**

For each provider:

1. Select "Use WorkOS Shared Credentials"
2. Specify required scopes (e.g., `repo`, `user:email`)
3. Optional: Add description for consent screen

**Limitation:** Shared credentials are WorkOS-managed test apps. Users may see "WorkOS Test App" branding in OAuth consent.

## Step 4: SDK Integration

### Connection Authorization Flow

Implement the OAuth connection flow using SDK methods. Check the fetched documentation for exact API:

1. **Generate authorization URL**
   - Include provider type (github, slack, google, etc.)
   - Include scopes matching dashboard configuration
   - Include state parameter for CSRF protection

2. **Redirect user to authorization URL**
   - User consents in provider's OAuth screen
   - Provider redirects back to WorkOS callback

3. **Exchange code for connection**
   - Handle redirect from WorkOS callback
   - Extract authorization code from query params
   - Call SDK method to finalize connection (see docs for exact method name)

**Reference the WebFetched docs** for SDK method names — they vary by language.

### Token Management

Pipes handles token refresh automatically. Do NOT implement custom refresh logic.

**Pattern:**

```
User authorizes --> Connection created --> Tokens stored by WorkOS
                                       |
                                       +--> Auto-refresh before expiry
                                       |
                                       +--> Your app fetches fresh tokens via SDK
```

### Making Authenticated Requests

Use SDK methods to get valid access tokens for API calls. The SDK returns fresh tokens (auto-refreshed if needed).

**Check the docs** for the exact method signature — typically something like `getConnection()` or `getAccessToken()`.

## Step 5: Webhook Setup (Optional but Recommended)

If you need real-time notifications when connections change state:

1. **Configure webhook endpoint in WorkOS dashboard**
   - Settings → Webhooks → Add Endpoint
   - URL: `https://your-domain.com/webhooks/workos`

2. **Subscribe to events:**
   - `connection.activated` - User completed OAuth
   - `connection.deactivated` - User revoked access
   - `connection.deleted` - Connection removed

3. **Verify webhook signatures**
   - Use SDK's webhook verification function
   - Reject unsigned requests (security critical)

**See the docs** for webhook payload schema and signature verification code.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm Pipes integration:

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY | grep -q "sk_" && echo "PASS: API key set" || echo "FAIL: API key missing or invalid"
env | grep WORKOS_CLIENT_ID | grep -q "client_" && echo "PASS: Client ID set" || echo "FAIL: Client ID missing or invalid"

# 2. SDK installed (adjust for your package manager)
npm list @workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Dashboard providers configured (manual check)
echo "MANUAL: Open https://dashboard.workos.com/environment/pipes and verify at least one provider is configured"

# 4. Test authorization URL generation (adjust for your language)
# Example for Node.js - replace with your implementation
node -e "const { WorkOS } = require('@workos-inc/node'); const workos = new WorkOS(process.env.WORKOS_API_KEY); console.log(workos.pipes ? 'PASS: Pipes SDK available' : 'FAIL: Pipes SDK missing');" 2>/dev/null

# 5. Application builds
npm run build  # or your build command
```

**If any check fails:** Stop and fix before proceeding.

## Error Recovery

### "Invalid redirect_uri" during OAuth

**Root cause:** Redirect URI in provider's OAuth app doesn't match WorkOS callback URL.

**Fix:**
1. Copy redirect URI from WorkOS dashboard provider settings (exact format)
2. Go to provider's OAuth app settings
3. Paste URI exactly — no trailing slashes, no typos
4. Save and retry

**Check:** URIs must match character-for-character including protocol (https).

### "Invalid scope" error

**Root cause:** Scopes in authorization request don't match provider's OAuth app configuration.

**Fix:**
1. Check scopes in WorkOS dashboard provider settings
2. Check scopes in provider's OAuth app settings
3. Ensure both lists match exactly (case-sensitive for some providers)
4. Some providers (e.g., Google) require scopes set in OAuth app, not just in request

**Provider-specific:** GitHub uses space-separated scopes, Google uses space-separated URLs.

### "Connection not found" when fetching token

**Root cause:** Connection ID doesn't exist or belongs to different environment.

**Fix:**
1. Verify you're using the correct `WORKOS_API_KEY` for environment (sandbox vs. production)
2. Check connection was successfully created (look for `connection.activated` webhook or check dashboard)
3. Ensure connection ID is stored correctly after authorization flow

**Debug:** Log the connection ID immediately after creation to verify it's being passed correctly.

### "Unauthorized" when making API requests

**Root cause:** Token expired and auto-refresh failed, or provider revoked access.

**Fix:**
1. Fetch fresh token via SDK before EVERY API call (don't cache tokens yourself)
2. Check provider's dashboard for revoked OAuth apps
3. Check if user manually disconnected in provider settings
4. Listen for `connection.deactivated` webhook to detect revocations

**Critical:** Never store access tokens long-term — always fetch fresh via SDK.

### Webhook signature verification fails

**Root cause:** Wrong signing secret or request body tampered with.

**Fix:**
1. Get webhook signing secret from WorkOS dashboard (Settings → Webhooks → signing secret)
2. Use SDK's verification function exactly as documented
3. Verify raw request body (before parsing JSON) — some frameworks auto-parse
4. Check webhook endpoint URL matches dashboard configuration exactly

**Security note:** Always reject webhooks with invalid signatures — this prevents spoofed events.

### Provider-specific OAuth errors

Each provider has unique error codes. Common patterns:

- **GitHub "bad_verification_code":** Code already used or expired (codes are single-use, 10min TTL)
- **Slack "invalid_code":** Same as GitHub, plus check client_id matches OAuth app
- **Google "redirect_uri_mismatch":** Redirect URI must be registered in Google Cloud Console, not just WorkOS
- **Salesforce "invalid_grant":** Refresh token revoked, user must re-authorize

**Fix:** Check provider's OAuth documentation for error code meanings. WorkOS passes through provider errors.

## Related Skills

- `workos-authkit-nextjs` - If implementing authentication alongside Pipes
- `workos-user-management` - For syncing connected user data to WorkOS directory
