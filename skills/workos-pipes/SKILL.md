---
name: workos-pipes
description: Connect external services and data sources with WorkOS Pipes.
---

<!-- generated -->

# WorkOS Pipes

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/pipes/providers
- https://workos.com/docs/pipes/index

If this skill conflicts with official docs, follow the docs.

## Step 2: Pre-Flight Validation

### Project Structure

- Confirm WorkOS SDK is installed
- Check package manager: npm, yarn, pnpm, or bun

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Critical:** API key must have Pipes permissions enabled in WorkOS Dashboard.

## Step 3: Provider Configuration (Dashboard)

Navigate to: https://dashboard.workos.com/environment/pipes

### Credential Mode (Decision Tree)

```
Environment?
  |
  +-- Sandbox/Development
  |   |
  |   +-- Use Shared Credentials (WorkOS-managed)
  |       - Select provider
  |       - Set required scopes
  |       - Add optional description
  |       - Save configuration
  |
  +-- Production
      |
      +-- Use Custom Credentials (Your OAuth app)
          1. Create OAuth app in provider dashboard
          2. Copy WorkOS redirect URI from setup modal
          3. Add redirect URI to provider OAuth app config
          4. Copy client ID + secret from provider
          5. Paste into WorkOS dashboard
          6. Set required scopes (check provider docs)
          7. Add optional description
          8. Save configuration
```

**STOP:** Do not proceed to Step 4 until at least one provider shows "Configured" status in dashboard.

## Step 4: SDK Integration

### Install SDK (if not present)

Detect package manager and run appropriate command:

```bash
# npm
npm install @workos-inc/node

# yarn
yarn add @workos-inc/node

# pnpm
pnpm add @workos-inc/node

# bun
bun add @workos-inc/node
```

**Verify:** Check `node_modules/@workos-inc/node` exists before continuing.

### Initialize SDK

Create SDK instance with API key. Check fetched docs for exact initialization pattern.

Common pattern (verify against docs):

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Framework-specific notes:**
- **Next.js:** Initialize in API routes or server components, not client components
- **Express/Node:** Initialize once at app startup, not per-request
- **Serverless:** Initialize outside handler for connection reuse

## Step 5: Connection Flow Implementation

### Authorization URL Generation

Generate authorization URL to redirect users to provider OAuth flow.

**Required parameters (check docs):**
- Provider slug (e.g., 'github', 'slack', 'google')
- Client ID
- Redirect URI (where user returns after auth)
- Required scopes
- State parameter (for CSRF protection)

**Critical:** State parameter must be:
1. Generated fresh per request
2. Stored server-side (session, cookie, Redis)
3. Validated on callback

### Callback Handler

Create endpoint to receive OAuth callback.

**Required validations:**
1. State parameter matches stored value
2. Authorization code is present
3. No error parameter in query string

**Exchange code for connection:**
- Use SDK method from docs to exchange code
- Store connection ID securely
- Associate with user account

## Step 6: Connection Management

### List User Connections

Implement endpoint to fetch user's active connections.

Check docs for SDK method to list connections. Filter by user ID or organization ID.

### Revoke Connections

Implement revocation flow using SDK method from docs.

**User experience:**
- Allow users to disconnect provider accounts
- Update UI state immediately
- Handle revocation errors gracefully

## Step 7: API Proxy Pattern (if making provider API calls)

If using Pipes to call provider APIs on behalf of users:

### Token Retrieval

Use SDK to get fresh access token for connection. SDK handles token refresh automatically.

### API Call Pattern

```
1. Get connection ID for user + provider
2. Use SDK to get access token
3. Make API call to provider with token
4. Return data to user
```

**Error handling:**
- Connection expired/revoked: Prompt re-authentication
- Scope insufficient: Reconfigure provider scopes
- Rate limit: Implement backoff/retry

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check environment variables set
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* || echo "FAIL: Env vars missing"

# 3. Verify API key format (starts with sk_)
grep "WORKOS_API_KEY=sk_" .env* || echo "FAIL: Invalid API key format"

# 4. Check initialization code exists
grep -r "new WorkOS\|WorkOS(" --include="*.ts" --include="*.js" || echo "FAIL: SDK not initialized"

# 5. Build succeeds
npm run build || npm run dev -- --help
```

**Manual checks:**
- [ ] At least one provider configured in WorkOS Dashboard
- [ ] Provider shows "Configured" status
- [ ] Test authorization flow in browser returns connection ID
- [ ] Callback handler validates state parameter
- [ ] Revoked connections cannot make API calls

## Error Recovery

### "Invalid API key" or "Unauthorized"

**Root cause:** API key missing, malformed, or lacks Pipes permissions.

Fix:
1. Verify key starts with `sk_`
2. Check key environment (sandbox vs production)
3. Go to WorkOS Dashboard → API Keys
4. Confirm key has Pipes scope enabled
5. If using wrong environment, create new key for correct environment

### "Provider not configured"

**Root cause:** Provider not set up in WorkOS Dashboard, or using wrong environment.

Fix:
1. Check `WORKOS_API_KEY` environment (sandbox vs production)
2. Go to Dashboard → Pipes → Providers
3. Select provider
4. Complete configuration (credentials + scopes)
5. Verify "Configured" badge appears

### "Invalid redirect URI"

**Root cause:** Redirect URI in code doesn't match provider OAuth app configuration.

Fix:
1. Copy exact redirect URI from WorkOS provider setup modal
2. Paste into provider OAuth app settings (GitHub, Google, etc.)
3. Ensure URI includes protocol (https://) and path
4. For local dev, add localhost URI to provider allow list

### "Invalid state parameter" or CSRF error

**Root cause:** State parameter validation failing.

Fix:
1. Check state is stored server-side before redirect
2. Verify state from callback matches stored value exactly
3. Implement expiration (5-10 minutes) to prevent replay
4. Use cryptographically random state generation (not predictable)

### "Insufficient scopes"

**Root cause:** OAuth scopes don't match API requirements.

Fix:
1. Check provider API docs for required scopes
2. Update scopes in WorkOS Dashboard provider config
3. Update scopes in provider OAuth app settings
4. Existing connections may need re-authentication

### Connection expired or revoked

**Root cause:** User revoked access or token expired beyond refresh window.

Fix:
1. Catch SDK token retrieval errors
2. Return clear error message to user
3. Provide "Reconnect" button that starts new auth flow
4. Clean up stored connection ID

### SDK import errors

**Root cause:** Wrong import path or SDK not installed.

Fix:
```bash
# Reinstall SDK
rm -rf node_modules/@workos-inc
npm install @workos-inc/node

# Check correct import (verify in docs)
# Usually: import { WorkOS } from '@workos-inc/node'
```

### Build fails with "process is not defined" (Next.js client components)

**Root cause:** Using WorkOS SDK in client component.

Fix:
1. Move SDK initialization to API route or server component
2. Never import WorkOS SDK in files with `'use client'` directive
3. Create API endpoints for client to call

## Related Skills

- `workos-authkit-nextjs` - For user authentication with WorkOS
- `workos-directory-sync` - For SCIM/directory syncing
