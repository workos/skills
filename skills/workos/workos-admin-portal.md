---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Workflow (Decision Tree)

```
Admin Portal integration method?
  |
  +-- Dashboard Link --> Go to Step 3 (Dashboard Workflow)
  |
  +-- Programmatic --> Go to Step 4 (SDK Integration)
```

**Dashboard Link** = Manual setup, share link via email/Slack
**Programmatic** = Embedded in your app, generate links via API/SDK

Most production apps use programmatic integration. Dashboard links are for testing or one-off setups.

## Step 3: Dashboard Workflow (Manual Link Sharing)

### Create Organization

1. Sign in to https://dashboard.workos.com/
2. Navigate to Organizations
3. Click "Create Organization"
4. Enter organization name and domain

**Verify:** Organization appears in list with an org\_\* ID

### Generate Setup Link

1. Click "Invite admin" on organization row
2. Select features (SSO, Directory Sync, Domain Verification, etc.)
3. Choose:
   - Enter IT admin email --> WorkOS sends email automatically
   - Copy link --> You share link manually

**CRITICAL:** Only one link active at a time. To revoke, click "Manage" then "Revoke Link" before creating new one.

**Link expiration:** 5 minutes after creation. Do NOT email links — they expire too quickly.

### Share Link

Include in message:

- What the link does (e.g., "Set up SSO for your organization")
- Expiration notice (5 minutes)
- Support contact if issues

**End of dashboard workflow.** Skip to verification checklist.

## Step 4: SDK Integration (Programmatic Workflow)

### Pre-Flight Validation

Check environment has:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`

```bash
# Verify keys are set
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID
```

**If missing:** Get from https://dashboard.workos.com/api-keys

### Install SDK

Detect package manager, install WorkOS SDK per docs.

```bash
# Verify installation
ls node_modules/@workos-inc/node 2>/dev/null || npm list @workos-inc/node
```

### Configure Redirect URIs (REQUIRED)

**BLOCKING:** You MUST configure redirect URIs in WorkOS Dashboard before generating portal links.

1. Go to https://dashboard.workos.com/redirects
2. Set "Default Return URI" — where users go after closing Admin Portal
3. Optionally set success URIs per feature:
   - SSO Setup Success URI
   - Directory Sync Setup Success URI
   - Log Streams Setup Success URI

**All URIs MUST use HTTPS** — no HTTP allowed in production.

**Verify:** URIs appear in dashboard Redirects tab.

### Create Organizations (One Per Customer)

**Pattern:** Create organization when onboarding enterprise customer in your app.

Each Admin Portal session is scoped to ONE organization. Organizations have ONE connection (SSO or Directory Sync).

```typescript
// Example pattern — check fetched docs for exact SDK method
const organization = await workos.organizations.createOrganization({
  name: "Acme Corp",
  domains: ["acme.com"],
});

// Store organization.id in your database
// Link to your internal customer record
```

**CRITICAL:** Maintain reference to `organization.id` in your database. You need this to generate portal links.

**Verify:** Organization appears in WorkOS Dashboard under Organizations.

### Generate Portal Link (On User Action)

**When:** IT admin clicks "Configure SSO" or similar button in YOUR app.

**Security:** This endpoint MUST be behind auth and restricted to IT admins — do NOT expose to regular users.

Portal links expire 5 minutes after creation. Generate link immediately before redirect.

```typescript
// Example pattern — check fetched docs for exact SDK method
const { link } = await workos.portal.generateLink({
  organization: "org_12345", // from your database
  intent: "sso", // or 'dsync', 'domain_verification', 'audit_logs', 'log_streams', 'certificate_renewal'
  return_url: "https://yourapp.com/settings/sso", // optional override
});

// Redirect user to link
response.redirect(link);
```

**Valid intents:**

- `sso` — SSO connection setup
- `dsync` — Directory Sync setup
- `domain_verification` — Domain verification
- `audit_logs` — Audit logs setup
- `log_streams` — Log streaming setup
- `certificate_renewal` — SAML certificate renewal

**return_url behavior:**

- If provided: User returns to this URL
- If omitted: User returns to Default Return URI from dashboard
- If success URI configured: User redirected there after successful setup

Check fetched docs for return_url precedence rules.

### Handle Return from Admin Portal

User clicks "Return to [Your App]" button in Admin Portal.

```
User lands at return_url or default redirect URI
  |
  +-- Check organization connection status via API
  |
  +-- Update UI based on setup completion
```

Query organization to check if connection was created:

```bash
# Example verification — check docs for exact endpoint
curl https://api.workos.com/organizations/org_12345 \
  -H "Authorization: Bearer sk_example_123456789"
```

Connection status in response indicates setup completion.

## Step 5: Feature-Specific Intents (Decision Tree)

```
Which feature is IT admin setting up?
  |
  +-- SSO --> intent: 'sso'
  |          Related Skill: workos-sso
  |
  +-- Directory Sync --> intent: 'dsync'
  |                     Related Skill: workos-directory-sync
  |
  +-- Domain Verification --> intent: 'domain_verification'
  |
  +-- Audit Logs --> intent: 'audit_logs'
  |
  +-- Log Streams --> intent: 'log_streams'
  |
  +-- Certificate Renewal --> intent: 'certificate_renewal'
```

Each intent shows different Admin Portal UI optimized for that feature.

## Verification Checklist (ALL MUST PASS)

For programmatic integration:

```bash
# 1. Environment keys configured
env | grep WORKOS_API_KEY | grep "^WORKOS_API_KEY=sk_"
env | grep WORKOS_CLIENT_ID | grep "^WORKOS_CLIENT_ID=client_"

# 2. SDK installed
npm list @workos-inc/node || pip show workos || gem list workos

# 3. Redirect URIs configured (manual check)
echo "Visit https://dashboard.workos.com/redirects — Default Return URI must be set"

# 4. Organization exists
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep '"id"' # Should show at least one org

# 5. Portal link generation works (test with dummy org)
# Run test endpoint in your app that generates link
# Link should start with https://id.workos.com/portal/
```

For dashboard workflow:

```bash
# 1. Organization exists in dashboard
echo "Visit https://dashboard.workos.com/organizations — Check organization list"

# 2. Setup link generated successfully
echo "Click 'Invite admin' on organization — Link should be copyable or email sent"
```

## Error Recovery

### "Invalid redirect URI"

**Root cause:** Redirect URI not configured in dashboard, or uses HTTP instead of HTTPS.

**Fix:**

1. Go to https://dashboard.workos.com/redirects
2. Add URI to Default Return URI field
3. Ensure URI uses HTTPS
4. Retry portal link generation

### "Organization not found"

**Root cause:** Organization ID invalid or organization deleted.

**Fix:**

1. Query organizations API to verify ID exists
2. Check your database mapping — may have stale org\_\* ID
3. If deleted, create new organization

### "Portal link expired"

**Root cause:** 5 minute expiration window passed.

**Fix:**

1. Do NOT email portal links — generate on-demand
2. Generate link immediately before redirect
3. Pattern: User clicks button --> generate link --> redirect (no delay)

### "Intent not valid"

**Root cause:** Typo in intent parameter, or unsupported intent.

**Fix:**

1. Check fetched docs for valid intent strings
2. Common intents: `sso`, `dsync`, `domain_verification`, `audit_logs`, `log_streams`, `certificate_renewal`
3. Intent is case-sensitive

### SDK import fails

**Root cause:** Package not installed or wrong import path.

**Fix:**

1. Verify SDK installation: `npm list @workos-inc/node` (or language equivalent)
2. Check fetched docs for correct import path
3. Ensure SDK version compatible with your language runtime

### "Unauthorized" API error

**Root cause:** API key invalid, expired, or wrong environment (test vs production).

**Fix:**

1. Verify key starts with `sk_`
2. Check key environment matches organization environment (test org needs test key)
3. Regenerate key in dashboard if potentially compromised: https://dashboard.workos.com/api-keys

### "Connection already exists for organization"

**Root cause:** Organization already has SSO or Directory Sync connection. Each org limited to one connection.

**Fix:**

1. To replace connection: Delete existing connection first via dashboard
2. To edit connection: Use Admin Portal with existing organization ID
3. For multi-connection needs: Create separate organizations per connection

## Related Skills

- workos-authkit-nextjs — Integrate authentication with Admin Portal SSO setup
- workos-authkit-react — Client-side auth integration
