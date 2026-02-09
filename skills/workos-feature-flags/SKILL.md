---
name: workos-feature-flags
description: Manage feature flags and rollouts with WorkOS.
---

<!-- generated -->

# WorkOS Feature Flags

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/feature-flags/index
- https://workos.com/docs/feature-flags/slack-notifications

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard at https://dashboard.workos.com:

- [ ] Environment exists (Staging or Production)
- [ ] At least one Organization created (Feature Flags require organizations)
- [ ] Navigate to Feature Flags section — URL is `https://dashboard.workos.com/environment/flags`

**Without an organization:** Feature flags cannot target users. Create one in Dashboard → Organizations before proceeding.

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_` (use staging key for dev)
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify keys are valid:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/feature-flags
```

Expected: 200 response with `{ data: [], ... }`. If 401, regenerate key in Dashboard.

### SDK Installation

Check if WorkOS SDK is installed:

```bash
# Node.js projects
grep "@workos-inc/node" package.json

# Other languages - check respective package manifests
```

If missing, install SDK before continuing. Detect package manager:

```bash
[ -f "package-lock.json" ] && echo "npm" || \
[ -f "yarn.lock" ] && echo "yarn" || \
[ -f "pnpm-lock.yaml" ] && echo "pnpm" || \
echo "npm"
```

Install with detected manager. See docs for language-specific SDK packages.

## Step 3: Create Feature Flags in Dashboard

Navigate to https://dashboard.workos.com/environment/flags

### Creating a Flag (Decision Tree)

```
What's the flag targeting?
  |
  +-- Organization feature (e.g., premium tier, beta program)
  |     --> Create flag
  |     --> In Targeting, select "Some organizations"
  |     --> Add specific org IDs
  |
  +-- User-specific feature (e.g., early access, user preference)
  |     --> Create flag
  |     --> In Targeting, select "Some users"
  |     --> Add specific user IDs
  |
  +-- Global killswitch (enable/disable for everyone)
        --> Create flag
        --> In Targeting, toggle "All" or "None"
```

**Flag naming convention:** Use lowercase with hyphens (e.g., `new-dashboard`, `premium-analytics`). Avoid spaces or special characters.

**Verify flag creation:**

```bash
# List all flags via API
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/feature-flags | jq '.data[].key'
```

You should see your flag key in the output.

## Step 4: SDK Integration (Language-Specific Paths)

### For Next.js with AuthKit

If using `@workos-inc/authkit-nextjs`:

**Step 4a: Access token contains flags automatically**

WorkOS AuthKit includes feature flags in the user session by default. No additional API calls needed.

```typescript
// app/page.tsx or any server component
import { getUser } from '@workos-inc/authkit-nextjs';

export default async function Dashboard() {
  const { user } = await getUser();
  
  // Access flags from user session
  const hasNewDashboard = user?.features?.['new-dashboard'] ?? false;
  
  return hasNewDashboard ? <NewDashboard /> : <LegacyDashboard />;
}
```

**Critical:** Flags are only available if user is authenticated. Check `user` exists before accessing `user.features`.

### For Generic Node.js Backend

If NOT using AuthKit or need server-side flag checks:

**Step 4b: Fetch flags via SDK**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Get flags for a specific user
async function getUserFlags(userId: string, organizationId: string) {
  const flags = await workos.featureFlags.getFeatureFlags({
    userId,
    organizationId
  });
  
  return flags.data; // Array of enabled flag keys
}

// Check specific flag
const flags = await getUserFlags('user_123', 'org_456');
const hasFeature = flags.some(flag => flag.key === 'new-dashboard');
```

**Important:** Both `userId` and `organizationId` are required for flag evaluation. These must match the IDs configured in Dashboard targeting.

### Caching Strategy

Feature flag responses should be cached to avoid API rate limits:

```typescript
// In-memory cache with TTL
const flagCache = new Map<string, { flags: string[], expiry: number }>();
const CACHE_TTL = 60000; // 1 minute

async function getCachedFlags(userId: string, orgId: string) {
  const cacheKey = `${userId}:${orgId}`;
  const cached = flagCache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.flags;
  }
  
  const flags = await getUserFlags(userId, orgId);
  flagCache.set(cacheKey, { flags, expiry: Date.now() + CACHE_TTL });
  
  return flags;
}
```

Check docs for recommended cache duration based on your flag update frequency.

## Step 5: Slack Notifications Setup (Optional)

If you need team notifications for flag changes:

### Enable Slack Integration

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Enable Slack notifications"
3. Click "Connect to Slack" — this redirects to Slack OAuth
4. Select the Slack channel for notifications
5. Authorize the WorkOS app

**Verify connection:**

```bash
# Check Slack connection status in Dashboard
# Should see "Connected to Slack" with channel name
```

### Notification Events

You'll receive Slack messages for:

- Flag created, updated, or deleted
- Flag enabled/disabled
- Targeting changed (All → Some, added/removed orgs or users)

**Test the integration:**

1. Create a test flag in Dashboard
2. Check Slack channel for creation notification
3. Enable the flag for one organization
4. Check Slack for targeting change notification

### Disconnecting Slack

To change channels or disable:

1. Navigate to Feature Flags in Dashboard
2. Click "Connected to Slack"
3. Click "Disconnect"
4. Repeat setup steps to reconnect with new channel

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: Missing env vars"

# 2. Verify API key is valid
curl -sf -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/feature-flags > /dev/null && \
  echo "PASS: API key valid" || echo "FAIL: Invalid API key"

# 3. Check at least one flag exists
FLAG_COUNT=$(curl -sf -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/feature-flags | jq '.data | length')
[ "$FLAG_COUNT" -gt 0 ] && echo "PASS: Flags exist ($FLAG_COUNT)" || \
  echo "FAIL: No flags created"

# 4. Verify SDK is installed
grep -q "@workos-inc" package.json && \
  echo "PASS: SDK installed" || echo "FAIL: SDK missing"

# 5. Check for flag usage in code
grep -r "features\[" app/ src/ 2>/dev/null | wc -l | \
  awk '{if($1>0) print "PASS: Flag checks found"; else print "FAIL: No flag usage"}'
```

**All checks must show PASS before considering integration complete.**

## Error Recovery

### "flags.data is undefined" in AuthKit

**Root cause:** User session doesn't include feature flags.

**Fix:**

1. Check AuthKit SDK version — feature flags require `@workos-inc/authkit-nextjs@>=1.3.0`
2. Verify user is authenticated: `user` object exists before accessing `user.features`
3. Check Dashboard: flag must be enabled for user's organization
4. Refresh user session: sign out and sign back in to get updated token

### "Invalid organization_id" API error

**Root cause:** Organization ID doesn't match Dashboard records.

**Fix:**

1. List organizations via API:
   ```bash
   curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/organizations | jq '.data[].id'
   ```
2. Use exact org ID from response (format: `org_XXXXXXXX`)
3. Check user is actually member of that organization in Dashboard

### "Rate limit exceeded" errors

**Root cause:** Too many API calls without caching.

**Fix:**

1. Implement caching strategy from Step 4
2. Cache duration: Start with 60 seconds, increase if flag changes are infrequent
3. Use in-memory cache for single-instance apps, Redis for multi-instance
4. **Never** fetch flags on every request — cache per user session

### Slack notifications not appearing

**Root cause:** Channel permissions or disconnected integration.

**Fix:**

1. Check Dashboard shows "Connected to Slack" with correct channel
2. Verify WorkOS app is in the target Slack channel (invite if missing)
3. Test with a flag change — create/enable a flag and wait 10 seconds
4. If still failing, disconnect and reconnect Slack integration

### Flags not appearing for user

**Root cause:** Targeting misconfiguration.

**Fix (Decision Tree):**

```
Flag not showing for user?
  |
  +-- Check Dashboard targeting
  |     Is flag set to "Some" with specific orgs/users?
  |       --> Verify user's org ID or user ID is in the list
  |
  +-- Check user session
  |     AuthKit: Is user authenticated? (user object exists)
  |     API: Are userId and organizationId correct?
  |
  +-- Check flag key spelling
        SDK: Does flag key match Dashboard exactly?
          --> Case-sensitive, no typos
```

**Verify targeting via API:**

```bash
# Get flag details including targeting
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/feature-flags/FLAG_KEY | jq
```

Check `.targeting` field matches your expectations.

### Build fails with "Cannot find module '@workos-inc/node'"

**Root cause:** SDK not installed or wrong package.

**Fix:**

1. Check language: Node.js uses `@workos-inc/node`, not `@workos-inc/workos`
2. Install: `npm install @workos-inc/node` (or yarn/pnpm equivalent)
3. Verify: `ls node_modules/@workos-inc/node` should show package directory
4. Clear build cache: `rm -rf .next node_modules/.cache` then rebuild

## Related Skills

- **workos-authkit-nextjs**: If using Next.js, AuthKit provides automatic flag integration in user sessions
- **workos-organizations**: Feature flags require organizations — see this skill for org setup
- **workos-directory-sync**: Combine flags with SCIM user provisioning for enterprise feature gating
