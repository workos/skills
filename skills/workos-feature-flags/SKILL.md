---
name: workos-feature-flags
description: Manage feature flags and rollouts with WorkOS.
---

<!-- generated -->

# WorkOS Feature Flags

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/feature-flags/index
- https://workos.com/docs/feature-flags/slack-notifications

The fetched documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Requirements

- Confirm WorkOS account exists at https://dashboard.workos.com/
- Confirm at least one organization exists in Dashboard
- Confirm environment (development/production) is selected

### Environment Variables

Check for required credentials:

```bash
# Verify keys exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "MISSING: WorkOS credentials"
```

Required variables:
- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

## Step 3: SDK Installation (If Not Present)

Detect existing WorkOS SDK installation:

```bash
# Check if SDK already installed
npm list @workos-inc/node 2>/dev/null || echo "SDK not found"
```

If SDK missing, install appropriate package for your stack:

```
Language/Framework?
  |
  +-- Node.js/Next.js --> npm install @workos-inc/node
  |
  +-- Python --> pip install workos
  |
  +-- Ruby --> gem install workos
```

**Verify:** SDK package exists before writing import statements.

## Step 4: Dashboard Configuration (REQUIRED)

Feature flags MUST be created in Dashboard before code can reference them. Agent cannot create flags via API.

**Manual steps for human operator:**

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Create Flag" 
3. Set flag key (used in code), name, description
4. Choose default state (enabled/disabled)
5. Configure targeting: All users, Some users/orgs, or None

**Critical:** Flag key in Dashboard MUST match flag key in code. Case-sensitive.

## Step 5: Feature Flag Implementation Pattern

### Server-Side Check (Recommended)

Feature flags are typically checked server-side using data from user's access token.

**Pattern for checking flags:**

```
User request with access token
  |
  +-- Extract user/org context from token
  |
  +-- Call SDK to evaluate flag(s) for that context
  |
  +-- Conditionally render/enable feature based on result
```

Check fetched documentation for exact SDK methods. Common patterns:

- Node.js: `workos.featureFlags.getFlag()` or similar
- Access token contains user/org identifiers needed for evaluation

### Client-Side Considerations

Feature flags should NOT be evaluated purely client-side (security risk). Acceptable patterns:

- Server-side evaluation, pass boolean to client
- Server-side API route that checks flag, client calls route
- Include flag state in server-rendered props

## Step 6: Slack Notifications Setup (Optional)

**Note:** This is Dashboard configuration, not code implementation.

If team wants Slack alerts for flag changes:

1. Navigate to https://dashboard.workos.com/environment/flags
2. Click "Enable Slack notifications"
3. Click "Connect to Slack" → authorize WorkOS app
4. Select channel for notifications

**Events that trigger notifications:**

- Flag created/updated/deleted
- Flag enabled/disabled
- Targeting changed (All → Some, etc.)
- Users/organizations added/removed from targeting

**To disconnect:** Click "Connected to Slack" → disconnect.

## Step 7: Targeting Configuration

Feature flags can target three scopes:

```
Targeting mode?
  |
  +-- All --> Feature enabled for all users/orgs
  |
  +-- Some --> Enable for specific user IDs or org IDs
  |           (Configure in Dashboard under flag settings)
  |
  +-- None --> Feature disabled for everyone
```

**For "Some" targeting:**

- Add organization IDs (from WorkOS Dashboard)
- OR add user IDs (from your auth system)
- Changes take effect immediately

## Verification Checklist (ALL MUST PASS)

Run these checks before marking implementation complete:

```bash
# 1. Verify SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Verify environment variables present
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key found" || echo "FAIL: API key missing"

# 3. Verify code imports SDK
grep -r "from '@workos-inc/node'" --include="*.ts" --include="*.js" . || echo "No SDK imports found"

# 4. Manual check: At least one flag exists in Dashboard
echo "MANUAL: Verify flag exists at https://dashboard.workos.com/environment/flags"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**Dashboard verification (manual):**
- Navigate to https://dashboard.workos.com/environment/flags
- Confirm at least one flag exists with correct key name
- Confirm targeting is configured appropriately

## Error Recovery

### "Flag not found" or null flag response

**Root cause:** Flag key in code doesn't match Dashboard flag key.

Fix:
1. Check exact flag key in Dashboard (case-sensitive)
2. Update code to match Dashboard key exactly
3. Confirm environment (dev/prod) matches between Dashboard and code

### "Invalid API key" or 401 Unauthorized

**Root cause:** API key missing, incorrect, or lacks permissions.

Fix:
1. Verify key starts with `sk_`: `echo $WORKOS_API_KEY | grep "^sk_"`
2. Regenerate key in Dashboard if necessary
3. Check key is from correct environment (dev vs. prod)
4. Restart application after updating .env

### "Organization not found" or targeting doesn't work

**Root cause:** Organization ID mismatch or user/org context not passed correctly.

Fix:
1. Extract organization ID from access token claims
2. Verify organization exists in Dashboard: https://dashboard.workos.com/organizations
3. Check SDK call includes correct user/org context parameters
4. Confirm targeting mode is "Some" in Dashboard if using specific IDs

### Flag changes not reflecting immediately

**Root cause:** Caching or stale token.

Fix:
1. Feature flags evaluate on each request — no caching by default
2. If implementing caching, set TTL appropriately (< 60 seconds recommended)
3. Check for stale access tokens — flag state is evaluated server-side, not embedded in token
4. Force refresh access token if necessary

### Slack notifications not appearing

**Root cause:** Slack connection not authorized or channel misconfigured.

Fix:
1. Re-authorize Slack connection in Dashboard
2. Verify WorkOS app has permission to post in selected channel
3. Check channel is public or WorkOS app is invited to private channel
4. Test by making a flag change and checking configured channel

## Related Skills

- `workos-authkit-nextjs` - For obtaining access tokens that contain user/org context
- `workos-organizations` - For managing organizations that flags can target
