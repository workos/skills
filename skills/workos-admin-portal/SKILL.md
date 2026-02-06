---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- generated -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Dashboard Access

- Sign in to https://dashboard.workos.com/
- Confirm you can view the Organizations page
- Confirm you can view the Redirects configuration page

### Environment Variables

Check for required secrets (exact names depend on SDK):

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Keys exist in environment or config management before continuing.

### SDK Installation

Check `package.json`, `requirements.txt`, `go.mod`, or equivalent for WorkOS SDK.

**If SDK missing:** Install per language (see docs). Do NOT proceed without SDK installed.

## Step 3: Configure Redirect URIs (CRITICAL)

**Dashboard configuration is REQUIRED before generating portal links.**

Navigate to https://dashboard.workos.com/redirects:

1. Set **Default Redirect URI** - where users return after exiting portal
2. (Optional) Set success URIs for specific features:
   - SSO Setup Success URI
   - Directory Sync Success URI
   - Log Streams Success URI

**Requirements:**
- All URIs MUST use HTTPS (HTTP will be rejected)
- URIs must be publicly accessible (localhost only works in test mode)

**Verify:** Save changes in dashboard, confirm URIs appear in list.

## Step 4: Workflow Decision Tree

```
Admin Portal access method?
  |
  +-- (A) Share link via email/Slack
  |       |
  |       +--> Use Dashboard UI (Step 5A)
  |
  +-- (B) Integrate into your app UI
          |
          +--> Use SDK to generate links (Step 5B)
```

Choose workflow based on your integration pattern.

## Step 5A: Dashboard Workflow (Manual Link Sharing)

Use this if IT admins receive links via email/Slack outside your app.

### Create Organization

1. Dashboard → Organizations → "Create Organization"
2. Enter organization name
3. Note the Organization ID (starts with `org_`)

### Generate Setup Link

1. Click organization → "Invite admin" button
2. Select features to enable (SSO, Directory Sync, etc.)
3. Choose:
   - Enter IT admin email → Auto-send link
   - "Copy setup link" → Manual sharing

**Link behavior:**
- Links expire after 5 minutes
- Only one link active per organization at a time
- To create new link, revoke existing via "Manage" button

**SKIP to Step 6 if using this workflow.**

## Step 5B: SDK Integration (In-App Portal Access)

Use this if IT admins access portal from within your application.

### Create Organization via SDK

When onboarding a new customer that needs SSO/Directory Sync:

```
Call SDK method to create organization
  |
  +-- Store organization ID in your database
  +-- Link organization ID to customer record
```

Check docs for SDK method signature - typically `workos.organizations.create()` or similar.

**Verify:** Organization appears in WorkOS dashboard after creation.

### Generate Portal Link Endpoint

Create an authenticated endpoint (guarded by auth middleware) that:

1. Retrieves organization ID for logged-in customer
2. Calls SDK method to generate portal link with:
   - `organization` - the org ID
   - `intent` - one of: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`
   - `return_url` (optional) - overrides dashboard default redirect

**CRITICAL:** Portal links expire after 5 minutes. Generate link immediately before redirect, do NOT:
- Email links to users
- Store links in database
- Cache links for reuse

**Pattern:**

```
User clicks "Configure SSO" button in your app
  |
  +--> Your backend generates fresh portal link
  +--> Immediately redirect user to portal URL
```

Check docs for exact SDK method - typically `workos.portal.generate_link()` or similar.

## Step 6: Implement Return Flow

When IT admin completes portal setup, they're redirected back to your app.

### Return URL Priority

```
Redirect destination (highest to lowest priority):
  |
  1. return_url parameter passed to generate_link()
  |
  2. Feature-specific success URI (e.g., "SSO Setup Success URI")
  |
  3. Default Redirect URI from dashboard
```

### Handle Return Redirect

At the return URL endpoint:

1. (Optional) Check query params for success indicators
2. Display confirmation message to user
3. Update UI to reflect new connection status

**Note:** Portal does NOT pass back organization ID or connection details in query params. If you need connection state, fetch it from WorkOS API using the organization ID you already have.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Check redirect URIs configured in dashboard
# (Manual: visit dashboard.workos.com/redirects)
echo "✓ Redirect URIs configured" || echo "FAIL: Configure URIs in dashboard"

# 2. Check environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"

# 3. Check SDK installed (adjust for your language)
# Node.js:
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
# Python:
pip show workos 2>/dev/null || echo "FAIL: SDK not installed"

# 4. Check organization created (if using SDK workflow)
# (Manual: verify org exists in dashboard or via API call)
```

**For SDK workflow, test the portal link flow:**

1. Trigger your "Configure SSO" button (or equivalent)
2. Verify redirect to `id.workos.com` domain
3. Complete a test setup (e.g., select an IdP)
4. Verify redirect back to your return URL
5. Check connection appears in WorkOS dashboard

## Error Recovery

### "Invalid redirect_uri"

**Root cause:** Redirect URI not configured in dashboard or doesn't match exactly.

**Fix:**
1. Check dashboard redirects page: https://dashboard.workos.com/redirects
2. Ensure URI uses HTTPS
3. Ensure no trailing slash mismatch (e.g., `/callback` vs `/callback/`)
4. If using return_url parameter, ensure it's in allowed list

### "Link expired" (5 minute timeout)

**Root cause:** Portal link older than 5 minutes.

**Fix:**
- Generate link immediately before redirect, not ahead of time
- Do NOT email links or store them
- If user bookmarked old link, regenerate via your app's UI

### "Organization not found"

**Root cause:** Organization ID invalid or doesn't exist.

**Fix:**
1. Check organization ID format: starts with `org_`
2. Verify organization exists in dashboard
3. Confirm you're using correct environment (test vs production)
4. Check API key matches environment

### "Unauthorized" or 401 errors

**Root cause:** API key invalid or wrong environment.

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is not a client ID (starts with `client_`)
3. Confirm key matches environment (test keys for test, prod keys for prod)
4. Regenerate key in dashboard if compromised

### "Multiple connections not allowed"

**Root cause:** Organization already has a connection for that feature.

**Fix:**
- Portal allows one SSO connection per organization
- To replace connection, delete existing via dashboard or API first
- Or use `certificate_renewal` intent to update existing connection

### Portal UI shows "Feature not enabled"

**Root cause:** Feature not enabled for your WorkOS environment.

**Fix:**
1. Check dashboard for enabled features
2. Contact WorkOS support to enable SSO, Directory Sync, etc.
3. Verify `intent` parameter matches enabled features

### Return redirect not working

**Root cause:** Return URL not in dashboard allowed list.

**Fix:**
1. Add return URL to dashboard redirects page
2. Use feature-specific success URI for better UX
3. Test redirect with curl to confirm URL is reachable

## Related Skills

- **workos-sso**: Configure SSO connections that portal creates
- **workos-directory-sync**: Handle directory sync setup from portal
- **workos-authkit-nextjs**: Authenticate users via SSO connections
- **workos-widgets**: Alternative embeddable UI for portal features
