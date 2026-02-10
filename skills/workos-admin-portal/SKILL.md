---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Choose Integration Path (Decision Tree)

```
How will IT admins access Admin Portal?
  |
  +-- Dashboard-generated links
  |     (Email invites, manual sharing)
  |     --> Skip to Step 4 (Dashboard Workflow)
  |
  +-- Embedded in your app
        (In-app setup button, programmatic)
        --> Continue to Step 3 (SDK Integration)
```

## Step 3: SDK Integration Path

### 3.1: Install SDK

Detect package manager, install WorkOS SDK. See fetched docs for package name.

**Verify before continuing:**
```bash
# SDK package exists in dependencies
grep -E "workos|@workos" package.json
```

### 3.2: Set Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:**
```bash
# Keys exist and have correct prefix
env | grep WORKOS_API_KEY | grep -q "^WORKOS_API_KEY=sk_" && echo "PASS" || echo "FAIL"
env | grep WORKOS_CLIENT_ID | grep -q "^WORKOS_CLIENT_ID=client_" && echo "PASS" || echo "FAIL"
```

### 3.3: Configure Redirect URIs in Dashboard

**CRITICAL:** You MUST configure redirect URIs in WorkOS Dashboard before generating portal links.

Navigate to: https://dashboard.workos.com/redirects

Set these URIs (all must use HTTPS):

1. **Default return URI** - Where users go after clicking "Back to app" button
2. **Success URIs** (optional) - Where users go after completing setup:
   - SSO success URI
   - Directory Sync success URI
   - Log Streams success URI

**Decision tree for redirect strategy:**
```
Success redirect behavior?
  |
  +-- Same page for all features
  |     --> Set only default return URI
  |
  +-- Different pages per feature
        --> Set feature-specific success URIs
        --> Feature URIs override default
```

**Verify URIs are saved:**
```bash
# Manual check - confirm URIs visible in dashboard redirects page
# No automated verification available
```

### 3.4: Create Organization Resource

**When to create:** During customer onboarding, before they need Admin Portal access.

**Organization structure:**
- Each customer = one organization resource
- Each organization = max one SSO connection
- Store organization ID in your database linked to customer account

Code pattern from fetched docs for organization creation. If creation fails, check:

1. API key has organization creation permissions
2. Organization name is unique (if required by API)
3. Domain is valid format (if provided)

**Verify organization created:**
```bash
# Store returned organization ID
# Check your database has customer -> organization_id mapping
```

### 3.5: Generate Portal Link

**CRITICAL:** Portal links expire 5 minutes after creation. Generate immediately before redirect — never email portal links.

**Required parameters:**
- `organization` - Organization ID from Step 3.4
- `intent` - One of: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`

**Optional parameters:**
- `return_url` - Override default redirect URI for this session

**Intent selection tree:**
```
What should IT admin configure?
  |
  +-- SSO connection          --> intent: "sso"
  |
  +-- Directory Sync          --> intent: "dsync"
  |
  +-- Audit Logs export       --> intent: "audit_logs"
  |
  +-- Log Streams             --> intent: "log_streams"
  |
  +-- Domain verification     --> intent: "domain_verification"
  |
  +-- Renew SAML certificate  --> intent: "certificate_renewal"
```

See fetched docs for SDK method signature (likely `portals.generateLink()` or similar).

**Verify link generation:**
```bash
# Link starts with https://
# Link contains organization ID
# Link expires in 5 minutes - redirect immediately
```

### 3.6: Protect Portal Endpoint

**CRITICAL:** The endpoint generating portal links MUST be auth-protected and admin-only.

```
Auth check pattern:
  |
  1. Verify user is authenticated
  2. Verify user belongs to organization
  3. Verify user has IT admin role
  4. Generate portal link
  5. Redirect immediately
```

**Security checklist:**
- [ ] Endpoint requires authentication
- [ ] Role check ensures user is IT admin
- [ ] Organization ID matches authenticated user's org
- [ ] No portal links logged or stored
- [ ] Redirect happens in same request (no link storage)

## Step 4: Dashboard Workflow (Manual Link Sharing)

Use this path if NOT embedding portal in your app.

### 4.1: Create Organization in Dashboard

Navigate to: https://dashboard.workos.com/organizations

1. Click "Create organization"
2. Enter organization name
3. Optionally add domains
4. Save organization

### 4.2: Generate Setup Link

In organization detail page:

1. Click "Invite admin" button
2. Select features to enable (SSO, Directory Sync, etc.)
3. Choose delivery method:
   - **Auto-send:** Enter IT admin email, WorkOS sends invite
   - **Manual share:** Copy link to send via your own channels

**IMPORTANT:** Only one setup link active at a time. To create new link, click "Manage" → "Revoke" → Create new.

### 4.3: Share Link Securely

If manually sharing, include in message:

- What the link does (setup SSO, Directory Sync, etc.)
- Link expiration time (check dashboard for exact time)
- Contact info for support questions

**DO NOT:**
- Share links in public channels
- Store links in databases
- Reuse expired links

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. SDK installed (if using SDK path)
grep -q "workos" package.json && echo "PASS: SDK in package.json" || echo "FAIL: SDK missing"

# 2. Environment variables set (if using SDK path)
env | grep -q "WORKOS_API_KEY=sk_" && echo "PASS: API key" || echo "FAIL: API key missing or wrong format"
env | grep -q "WORKOS_CLIENT_ID=client_" && echo "PASS: Client ID" || echo "FAIL: Client ID missing or wrong format"

# 3. Redirect URIs configured (MANUAL CHECK)
# Navigate to https://dashboard.workos.com/redirects
# Confirm at least one HTTPS URI is set
echo "MANUAL: Check redirect URIs in dashboard"

# 4. Organization exists (if using SDK path)
# Query your database for organization records
# Or check dashboard for test organizations
echo "MANUAL: Verify organization created"

# 5. Portal endpoint protected (if using SDK path)
# Attempt to access portal generation endpoint without auth
# Should receive 401 or redirect to login
echo "MANUAL: Test unauthenticated access to portal endpoint - should fail"

# 6. Portal link generates (if using SDK path)
# Trigger link generation, check response contains URL
echo "MANUAL: Generate test link, verify URL format"

# 7. Application builds
npm run build || pnpm build || yarn build
```

## Error Recovery

### "Portal link expired" / 401 error accessing portal

**Root cause:** Link older than 5 minutes, or link already used.

**Fix:**
1. Generate new link
2. Ensure link generation happens immediately before redirect
3. Do not store or email links - redirect in same request

### "Invalid organization ID" / Organization not found

**Root causes:**
- Organization ID typo
- Organization deleted from dashboard
- Wrong environment (test vs production API key)

**Fix:**
1. Verify organization exists in dashboard: https://dashboard.workos.com/organizations
2. Check organization ID matches exactly (copy from dashboard)
3. Confirm API key environment matches organization environment

### "Redirect URI not configured" / Redirect fails

**Root cause:** No default return URI set in dashboard, and no `return_url` provided in API call.

**Fix:**
1. Navigate to https://dashboard.workos.com/redirects
2. Set default return URI (must be HTTPS)
3. Save changes
4. Regenerate portal link

### "Invalid intent" error

**Root cause:** Intent parameter not one of allowed values.

**Fix:** Check fetched docs for current intent list. As of this skill's creation, valid intents are:
- `sso`
- `dsync`
- `audit_logs`
- `log_streams`
- `domain_verification`
- `certificate_renewal`

### SDK import fails / Module not found

**Root cause:** SDK not installed, or wrong import path.

**Fix:**
1. Verify SDK in `package.json` dependencies
2. Run `npm install` / `pnpm install` / `yarn install`
3. Check fetched docs for correct import path (may vary by SDK version)
4. Clear node_modules and reinstall if still failing

### 403 Forbidden when generating link

**Root causes:**
- API key lacks organization permissions
- API key is for wrong environment
- Organization belongs to different workspace

**Fix:**
1. Verify API key from dashboard: https://dashboard.workos.com/api-keys
2. Check key scope includes "Organizations" permission
3. Confirm organization and API key are in same WorkOS workspace
4. For production, use production API key (starts with `sk_live_`)

### Redirect URI uses HTTP instead of HTTPS

**Root cause:** WorkOS requires HTTPS for all redirect URIs.

**Fix:**
1. Update redirect URI to use `https://` prefix
2. For local development, use tunneling tool (ngrok, Cloudflare Tunnel) to get HTTPS URL
3. Or use localhost with HTTPS cert for local testing
4. Never deploy with HTTP redirect URIs to production

### User sees "Organization not found" in Admin Portal

**Root cause:** Organization deleted between link generation and user access.

**Fix:**
1. Verify organization still exists in dashboard
2. If deleted, recreate organization with same details
3. Generate new portal link
4. Implement soft-delete pattern in your app to prevent accidental organization deletion

## Related Skills

- **workos-sso**: Configuring SSO connections that admins set up via portal
- **workos-directory-sync**: Directory Sync setup initiated through portal
- **workos-domain-verification**: Domain verification flows accessible via portal
- **workos-audit-logs**: Audit log export configuration in portal
- **workos-widgets**: Alternative embeddable UI components for self-service setup
