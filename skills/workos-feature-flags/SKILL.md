---
name: workos-feature-flags
description: Manage feature flags and rollouts with WorkOS.
---

<!-- generated -->

# WorkOS Feature Flags

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:
- https://workos.com/docs/feature-flags/index
- https://workos.com/docs/feature-flags/slack-notifications

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

**Required before implementation:**

1. Navigate to https://dashboard.workos.com/
2. Confirm you have API credentials visible
3. Confirm at least one organization exists in Dashboard

**Verify environment variables exist:**

```bash
# Check .env or .env.local
grep "WORKOS_API_KEY" .env* || echo "FAIL: Missing WORKOS_API_KEY"
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: Missing WORKOS_CLIENT_ID"
```

**Verify API key format:**
- `WORKOS_API_KEY` must start with `sk_`
- `WORKOS_CLIENT_ID` must start with `client_`

### SDK Installation Check

Detect package manager, verify WorkOS SDK is installed:

```bash
# Check SDK exists
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: WorkOS SDK not installed"
```

If missing: Install SDK per README instructions before continuing.

## Step 3: Dashboard Configuration

### Create Your First Feature Flag

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Create Flag" 
3. Record the flag key (e.g., `new-dashboard-ui`) — you'll need this in code

**Decision tree for flag targeting:**

```
Who should see this feature?
  |
  +-- Everyone          --> Set to "All"
  |
  +-- Nobody (testing)  --> Set to "None"
  |
  +-- Specific users    --> Set to "Some" → Add user IDs
  |
  +-- Specific orgs     --> Set to "Some" → Add organization IDs
```

### Enable Slack Notifications (Optional)

**Only do this if you want real-time alerts for flag changes.**

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Enable Slack notifications"
3. Click "Connect to Slack"
4. Authorize WorkOS app for your workspace
5. Select the channel for notifications (e.g., `#feature-rollouts`)

**Verify Slack connection:**

```bash
# Check for "Connected to Slack" text in Dashboard UI
# Or test by toggling a flag and confirming Slack message appears
```

**Notification triggers:**
- Flag created/deleted
- Flag enabled/disabled
- Targeting rules changed (All → Some → None)
- Specific users/orgs added/removed

**To disconnect:** Click "Connected to Slack" → "Disconnect"

## Step 4: Code Integration

### Accessing Flag State

**Critical:** Feature flags are accessed through the **user's access token**, not directly via API key.

This means:
1. User must be authenticated (via WorkOS AuthKit or custom auth)
2. Flags are automatically scoped to that user's organization/identity
3. No separate flag API calls needed — flags are in the token claims

### Implementation Pattern

```typescript
// Server-side (Next.js example)
import { getUser } from '@workos-inc/authkit-nextjs';

export default async function DashboardPage() {
  const { user } = await getUser();
  
  // Feature flags are in user.customClaims
  const flags = user?.customClaims?.flags || {};
  
  // Check flag state
  const showNewDashboard = flags['new-dashboard-ui'] === true;
  
  return showNewDashboard ? <NewDashboard /> : <LegacyDashboard />;
}
```

**Key points:**
- Flags live in `user.customClaims.flags` object
- Flag values are booleans (`true`/`false`)
- Flag keys match Dashboard exactly (case-sensitive)
- Default to `false` if flag missing (safe fallback)

### Client-Side Access

If using AuthKitProvider (client components):

```typescript
'use client';
import { useAuth } from '@workos-inc/authkit-nextjs';

export function FeatureGatedComponent() {
  const { user } = useAuth();
  const flags = user?.customClaims?.flags || {};
  
  if (!flags['premium-analytics']) {
    return <UpgradePrompt />;
  }
  
  return <PremiumAnalytics />;
}
```

### Backend API Routes

For API routes that need flag checks:

```typescript
// app/api/analytics/route.ts
import { getUser } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  const { user } = await getUser();
  
  const flags = user?.customClaims?.flags || {};
  
  if (!flags['premium-analytics']) {
    return NextResponse.json(
      { error: 'Feature not available' },
      { status: 403 }
    );
  }
  
  // Return premium analytics data
  return NextResponse.json({ data: [...] });
}
```

## Step 5: Testing Flag Behavior

### Manual Testing Checklist

**For each flag state (All/Some/None):**

1. Set flag state in Dashboard
2. Force token refresh (re-login or wait for token expiry)
3. Verify UI/behavior matches expected state

**Commands to verify flag state:**

```bash
# Check flag exists in Dashboard
curl -X GET "https://api.workos.com/feature_flags" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | select(.key=="your-flag-key")'

# Inspect user token claims (decode JWT)
# Paste token at https://jwt.io and check customClaims.flags
```

### Targeting Verification

**If flag set to "Some" (specific targeting):**

1. Log in as user/org that IS targeted → Flag should be `true`
2. Log in as user/org that is NOT targeted → Flag should be `false`
3. Add another user/org to targeting → Verify flag updates for them

**Token refresh timing:**
- Tokens cache for their lifetime (default 5-10 minutes)
- Users won't see flag changes until token refreshes
- Force refresh by logging out and back in during testing

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables present
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env* || echo "FAIL: Missing env vars"

# 2. SDK installed
ls node_modules/@workos-inc/authkit-nextjs 2>/dev/null || echo "FAIL: SDK missing"

# 3. Flag exists in Dashboard (replace YOUR_FLAG_KEY)
curl -s -X GET "https://api.workos.com/feature_flags" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep "YOUR_FLAG_KEY" || echo "FAIL: Flag not found"

# 4. Code references flag correctly (check your flag key)
grep -r "flags\['your-flag-key'\]" app/ || echo "WARN: No flag checks found in code"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**Manual verification:**
- [ ] Log in as authenticated user
- [ ] Inspect Network tab → Find `/userinfo` or similar endpoint
- [ ] Confirm JWT contains `customClaims.flags` object
- [ ] Toggle flag in Dashboard, wait for token refresh, verify behavior changes

## Error Recovery

### "customClaims is undefined"

**Root cause:** User object doesn't have flag data.

Fixes:
1. Verify user is authenticated via WorkOS (not custom auth without WorkOS integration)
2. Check that organization is correctly linked in WorkOS Dashboard
3. Confirm flag is published (not in draft state)
4. Force token refresh: Log out → Log back in

### "Flag changes not reflecting in app"

**Root cause:** Token is cached and hasn't refreshed yet.

Fixes:
1. Check token expiry time (decode JWT at jwt.io)
2. Wait for automatic refresh, or
3. Force refresh: Log out → Log back in
4. For instant updates in dev: Reduce token TTL in WorkOS Dashboard

### "403 Forbidden when checking flags"

**Root cause:** API key invalid or lacks permissions.

Fixes:
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key hasn't been rotated in Dashboard
3. Confirm key is for correct environment (staging vs production)
4. Navigate to Dashboard → API Keys → Verify permissions include "Feature Flags"

### "Flag exists in Dashboard but not in token"

**Root cause:** Targeting rules exclude current user/org.

Fixes:
1. Check flag targeting setting:
   - If "None" → No one gets flag (expected)
   - If "Some" → Verify current user/org ID is in targeting list
   - If "All" → Should work (check other issues)
2. Verify organization ID matches between auth system and Dashboard
3. Check user is member of correct organization

### Build errors referencing flags

**Root cause:** Type mismatch or undefined access.

Fixes:
1. Always use optional chaining: `user?.customClaims?.flags`
2. Always provide fallback: `flags['key'] || false`
3. Never assume flags object exists without checking
4. Add TypeScript types if available:

```typescript
interface WorkOSUser {
  customClaims?: {
    flags?: Record<string, boolean>;
  };
}
```

### Slack notifications not appearing

**Root cause:** Connection broken or channel misconfigured.

Fixes:
1. Check Dashboard shows "Connected to Slack" (not "Enable Slack notifications")
2. Verify Slack channel still exists and bot has access
3. Disconnect and reconnect if stale (Dashboard → "Connected to Slack" → Disconnect → Reconnect)
4. Test by creating a new flag → Should see Slack message within seconds
5. Check Slack workspace hasn't removed WorkOS app permissions

## Common Patterns

### Progressive Rollout

```typescript
// Start: Enable for internal org only
flags['new-feature'] // true for org_internal, false for others

// After 1 week: Add beta customers
// Add specific org IDs in Dashboard targeting

// After 2 weeks: Enable for all
// Set flag to "All" in Dashboard
```

### A/B Testing

```typescript
// Create two flags: variant-a, variant-b
// Target 50% of users to each via Dashboard

const flags = user?.customClaims?.flags || {};

if (flags['variant-a']) {
  return <VariantA />;
} else if (flags['variant-b']) {
  return <VariantB />;
} else {
  return <Control />;
}
```

### Premium Feature Gating

```typescript
// app/settings/billing/page.tsx
const flags = user?.customClaims?.flags || {};
const isPremium = flags['premium-tier'];

return (
  <div>
    {isPremium ? (
      <PremiumFeatures />
    ) : (
      <UpgradeButton />
    )}
  </div>
);
```

## Related Skills

- `workos-authkit-nextjs` - Required for user authentication and token access
- `workos-user-management` - Managing users/organizations that flags target
