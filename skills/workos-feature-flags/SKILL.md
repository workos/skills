---
name: workos-feature-flags
description: Manage feature flags and rollouts with WorkOS.
---

<!-- refined:sha256:c47a1d3b60a1 -->

# WorkOS Feature Flags

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/feature-flags/index
- https://workos.com/docs/feature-flags/slack-notifications

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Dashboard Setup (REQUIRED)

Before writing ANY code, confirm in WorkOS Dashboard:

1. Navigate to https://dashboard.workos.com/environment/flags
2. Verify at least one organization exists in your account
3. **Optional:** Create a test flag to understand the UI

**Cannot proceed without an organization.** Feature flags target organizations or users within organizations.

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (if using AuthKit integration)

**Verify now:**
```bash
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "FAIL: Missing environment variables"
```

### SDK Installation

Detect package manager, install WorkOS SDK if not present:

```bash
# Check if SDK exists
npm list @workos-inc/node || yarn list @workos-inc/node || pnpm list @workos-inc/node
```

If missing, install via detected package manager.

## Step 3: Access Pattern Decision Tree

WorkOS Feature Flags are accessed through user access tokens. Choose your integration pattern:

```
Using WorkOS AuthKit for authentication?
  |
  +-- YES --> Use access token from AuthKit session (Step 4A)
  |
  +-- NO  --> Do you have user access tokens from another WorkOS auth flow?
              |
              +-- YES --> Use existing access token (Step 4B)
              |
              +-- NO  --> STOP: Feature flags require authenticated users
```

**Critical:** Feature flags are NOT accessed via API key alone. They require a user context via access token.

## Step 4A: AuthKit Integration (Recommended)

If using `@workos-inc/authkit-nextjs` or similar AuthKit SDK:

1. Get user session (see `workos-authkit-nextjs` skill for setup)
2. Extract access token from session
3. Pass token to feature flag checks

**Pattern for Next.js server components:**

```typescript
import { getUser } from '@workos-inc/authkit-nextjs';

export default async function Page() {
  const { user, accessToken } = await getUser();
  
  // Use accessToken for feature flag evaluation
  // See docs for exact SDK method
}
```

**Pattern for Next.js API routes:**

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

export const GET = withAuth(async ({ user }) => {
  const accessToken = user.accessToken;
  // Use accessToken for feature flag evaluation
});
```

Check the WebFetch'd docs for the exact SDK method to evaluate flags with the access token.

## Step 4B: Manual Access Token Usage

If you have access tokens from another WorkOS auth flow:

1. Retrieve the access token from your auth session/storage
2. Pass token to WorkOS SDK feature flag method
3. Check WebFetch'd docs for exact SDK method signature

**Do NOT attempt to decode or parse the access token** — treat it as an opaque string.

## Step 5: Create Feature Flags in Dashboard

**This is done via UI, not API:**

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Create Flag" or similar button
3. Set flag name, description, tags (optional)
4. Configure targeting:
   - **All:** Enabled for everyone
   - **Some:** Enabled for specific organizations or users
   - **None:** Disabled for everyone

**Verification:**
```bash
# No programmatic check - verify visually in dashboard
echo "Check https://dashboard.workos.com/environment/flags shows your flag"
```

## Step 6: Evaluate Flags in Code

Check the WebFetch'd documentation for the exact SDK method to evaluate flags. Common pattern:

```typescript
// Pseudocode - check docs for actual SDK method
const flagValue = await workos.featureFlags.evaluate({
  accessToken: userAccessToken,
  flagKey: 'your-flag-key'
});

if (flagValue.enabled) {
  // Feature is enabled for this user
}
```

**Integration points:**
- **Server components:** Evaluate flags in async component functions
- **API routes:** Evaluate flags in route handlers
- **Client components:** Fetch flag state from API route (do NOT expose access token to client)

## Step 7: Slack Notifications (Optional)

To receive Slack notifications for flag lifecycle events:

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Enable Slack notifications"
3. Click "Connect to Slack"
4. Authorize WorkOS app in your Slack workspace
5. Select target channel for notifications

**Events that trigger notifications:**
- Flag created
- Flag details updated (name, description, tags)
- Flag deleted
- Flag enabled/disabled
- Targeting changed (All/Some/None)
- Specific users/organizations added or removed

**To disconnect:**
1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Connected to Slack"
3. Click disconnect or similar option

**No code changes required** — this is a dashboard-only configuration.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables exist
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key configured" || echo "FAIL: Missing or invalid API key"

# 2. SDK installed
npm list @workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Access token retrieval works (if using AuthKit)
grep -r "accessToken" app/ src/ pages/ 2>/dev/null && echo "PASS: Access token usage found" || echo "INFO: Verify access token extraction manually"

# 4. Build succeeds
npm run build || yarn build || pnpm build
```

**Manual checks (no bash equivalent):**

- [ ] At least one flag exists in WorkOS Dashboard
- [ ] At least one organization exists in WorkOS Dashboard
- [ ] Flag evaluation returns expected true/false based on targeting rules

## Error Recovery

### "No organizations found"

**Root cause:** Your WorkOS account has no organizations created.

**Fix:**
1. Go to https://dashboard.workos.com/organizations
2. Create at least one organization (can be a test org)
3. Retry flag creation

### "Invalid access token" or "Unauthorized"

**Root cause:** Access token is missing, expired, or incorrectly extracted.

**Fix:**
1. Verify user session is valid (re-authenticate if needed)
2. Check access token is passed correctly to SDK method
3. Ensure access token is NOT being sent to client-side code
4. If using AuthKit, verify `getUser()` or `withAuth()` returns `accessToken` field

Check WebFetch'd docs for exact token field name — it may be `access_token` or `accessToken`.

### "API key invalid" (sk_ prefix check fails)

**Root cause:** `WORKOS_API_KEY` is missing, wrong prefix, or from wrong environment.

**Fix:**
1. Go to https://dashboard.workos.com/api-keys
2. Copy correct API key for your environment (staging vs production)
3. Verify key starts with `sk_`
4. Update `.env.local` (Next.js) or `.env` (other frameworks)
5. Restart dev server

### "Module not found" for SDK import

**Root cause:** SDK package not installed or wrong package name.

**Fix:**
1. Run `npm list @workos-inc/node` to verify installation
2. If missing, install: `npm install @workos-inc/node`
3. Check package.json for typos in package name
4. Verify node_modules/@workos-inc/node exists

### "Feature flag not found"

**Root cause:** Flag key mismatch between code and dashboard.

**Fix:**
1. Check exact flag key in dashboard (case-sensitive)
2. Verify flag exists in correct environment (staging vs production)
3. Copy-paste flag key from dashboard to avoid typos

### Client-side access token exposure

**Root cause:** Access token being sent to browser, creating security risk.

**Fix:**
1. **NEVER** pass access tokens to client components
2. Move flag evaluation to server component or API route
3. Pass only the boolean result to client:

```typescript
// Server component
const flagEnabled = await evaluateFlag(accessToken, 'flag-key');

// Pass to client
<ClientComponent featureEnabled={flagEnabled} />
```

## Related Skills

- `workos-authkit-nextjs` — For obtaining user access tokens via AuthKit
- `workos-organizations` — For managing organizations that flags target
