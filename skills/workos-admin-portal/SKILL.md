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

If this skill conflicts with the docs, follow the docs.

## Step 2: Choose Integration Path (Decision Tree)

```
Admin Portal access method?
  |
  +-- Dashboard-only (email links to IT admins)
  |     |
  |     +-- Go to Step 3A
  |
  +-- In-app integration (seamless redirect)
        |
        +-- Go to Step 3B
```

## Step 3A: Dashboard Link Workflow

**Use when:** You want to email setup links to IT admins without code integration.

### Create Organization

1. Sign in to https://dashboard.workos.com/
2. Navigate to Organizations → Create Organization
3. Enter organization name and domains
4. Save organization ID for reference

### Generate Setup Link

1. Click "Invite admin" on organization page
2. Select features to enable (SSO, Directory Sync, etc.)
3. Click "Next"
4. **Option A:** Enter IT admin email (WorkOS sends email automatically)
5. **Option B:** Click "Copy setup link" (share via Slack/email manually)

**CRITICAL:** Only one active link per organization. To create a new link, revoke the existing one via "Manage" button.

**Link expiration:** 5 minutes from creation. Do NOT email links — they expire too fast. Use dashboard auto-send instead.

**Verification:**

```bash
# Check organization exists
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | grep "org_"
```

**End of dashboard workflow.** Skip to Step 7 for redirect configuration.

## Step 3B: In-App Integration

**Use when:** You want IT admins to access Admin Portal from within your application.

Proceed to Step 4.

## Step 4: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Detect SDK Installation

Check if WorkOS SDK is already installed:

```bash
# Node.js
grep "@workos-inc/node" package.json

# Python
pip show workos

# Ruby
bundle show workos

# Go
go list -m github.com/workos/workos-go
```

If not found, proceed to Step 5. If found, skip to Step 6.

## Step 5: Install WorkOS SDK

Detect package manager and install:

```bash
# Node.js
npm install @workos-inc/node
# or
yarn add @workos-inc/node

# Python
pip install workos

# Ruby
gem install workos
# or add to Gemfile: gem 'workos'

# Go
go get github.com/workos/workos-go/v4
```

**Verify:**

```bash
# Node.js
ls node_modules/@workos-inc/node

# Python
python -c "import workos; print(workos.__version__)"

# Ruby
gem list | grep workos

# Go
go list -m github.com/workos/workos-go
```

## Step 6: Create Organization via API

**CRITICAL:** Admin Portal sessions are scoped to organizations. Create one organization per enterprise customer.

**When to run:** During customer onboarding flow.

**Code pattern (language-agnostic):**

1. Initialize WorkOS client with API key
2. Call `organizations.create()` with `name` and `domains` (domains optional)
3. Store returned `organization.id` in your database linked to customer record

**Verification:**

```bash
# List organizations to confirm creation
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | {id, name}'
```

Expected: JSON array with your organization, including the ID you stored.

## Step 7: Configure Redirect URIs (REQUIRED)

**Location:** https://dashboard.workos.com/redirects

### Default Return URI (Required)

- **Purpose:** Where users land when clicking "Return to app" in Admin Portal
- **Format:** Must be HTTPS (e.g., `https://app.example.com/settings`)
- **Environment:** Configure separately for Production and Staging

### Success URIs (Optional)

Configure specific redirects after successful setup:

- **SSO Setup Success:** Where to redirect after SSO configuration completes
- **Directory Sync Success:** Where to redirect after Directory Sync setup completes
- **Log Streams Success:** Where to redirect after Log Stream setup completes

**All URIs must use HTTPS protocol.**

**Verification:**

```bash
# Check redirect URIs are saved (manual check in dashboard)
# Navigate to https://dashboard.workos.com/redirects
# Confirm Production default return URI is HTTPS
```

## Step 8: Create Portal Link Generation Endpoint

**CRITICAL:** This endpoint must be authentication-gated — only accessible to IT admins.

### Intent Selection (Decision Tree)

```
What will IT admin configure?
  |
  +-- SSO connections          --> intent: "sso"
  |
  +-- Directory Sync           --> intent: "dsync"
  |
  +-- Domain Verification      --> intent: "domain_verification"
  |
  +-- Audit Logs               --> intent: "audit_logs"
  |
  +-- Log Streams              --> intent: "log_streams"
  |
  +-- Certificate Renewal      --> intent: "certificate_renewal"
```

### Endpoint Implementation Pattern

1. **Authenticate user** (ensure they are an IT admin)
2. **Get organization ID** from user's database record
3. **Call SDK method:** `portal.generateLink({ organization, intent, return_url? })`
4. **Immediately redirect** user to returned Portal link URL

**Key parameters:**

- `organization` (required) - Organization ID from Step 6
- `intent` (required) - One of the intents from decision tree above
- `return_url` (optional) - Override default redirect; must be HTTPS

**CRITICAL:** Portal links expire in 5 minutes. Generate and redirect in the same request. **Never** email or store Portal links.

### Example Request Flow

```
User clicks "Configure SSO" in your app
  |
  v
Your endpoint: /admin/launch-portal
  |
  +-- Check: Is user an IT admin? --> No --> 403 Forbidden
  |                                --> Yes
  v
Get user's organization_id from database
  |
  v
Call: portal.generateLink({
  organization: "org_123",
  intent: "sso",
  return_url: "https://app.example.com/settings/sso/success"
})
  |
  v
Redirect user to portal.link URL
```

## Step 9: Handle Return from Admin Portal

**When:** User clicks "Return to app" or completes setup successfully.

### Return URL Behavior

```
Did you specify return_url in generateLink()?
  |
  +-- Yes --> User lands at that URL
  |
  +-- No  --> Check: Success-specific redirect configured?
                |
                +-- Yes (e.g., SSO Success URI) --> User lands there
                |
                +-- No --> User lands at default return URI
```

### Recommended Pattern

1. Use different `return_url` values for different intents
2. On return page, fetch connection status via API to show success/error
3. Display next steps to user (e.g., "SSO is now configured. Test login here.")

**Verification:**

```bash
# Test portal link generation (requires valid org_id)
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_REPLACE_WITH_REAL_ID",
    "intent": "sso"
  }' | jq '.link'

# Expected: URL starting with https://id.workos.com/portal/launch?token=
```

## Verification Checklist (ALL MUST PASS)

Run these checks before marking integration complete:

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID

# 2. SDK is installed
# Node.js: ls node_modules/@workos-inc/node
# Python: python -c "import workos"
# Ruby: gem list | grep workos
# Go: go list -m github.com/workos/workos-go

# 3. At least one organization exists
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Expected: Non-zero number

# 4. Can generate portal link
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization": "org_REPLACE", "intent": "sso"}' \
  | jq -e '.link' > /dev/null
# Expected: Exit code 0

# 5. Default return URI is configured (manual check)
# Visit: https://dashboard.workos.com/redirects
# Confirm: Production default return URI exists and uses HTTPS
```

If check #3 returns 0, create an organization via dashboard or API before continuing.

If check #4 fails with 401, verify `WORKOS_API_KEY` is correct and starts with `sk_`.

If check #4 fails with 404, replace `org_REPLACE` with a real organization ID from check #3.

## Error Recovery

### "Portal link expired"

**Root cause:** More than 5 minutes passed between generation and user clicking link.

**Fix:** Regenerate link immediately before redirect. Never store or email links.

**Code pattern:** Generate link in same request handler that redirects user.

### "Invalid organization ID"

**Root cause:** Organization does not exist or ID is malformed.

**Fix:**

1. Verify organization exists: `GET /organizations`
2. Check stored organization ID matches actual ID from API
3. Confirm organization ID starts with `org_`

### "Unauthorized" (401) on API calls

**Root cause:** Invalid or missing API key.

**Fix:**

1. Verify `WORKOS_API_KEY` is set: `echo $WORKOS_API_KEY`
2. Confirm key starts with `sk_` (test key) or `sk_live_` (production key)
3. Check key permissions in dashboard: https://dashboard.workos.com/api-keys
4. Ensure key is passed to SDK initialization

### "Only one active Portal link allowed"

**Root cause:** Previous link still active when trying to generate via dashboard.

**Fix:**

1. Navigate to organization in dashboard
2. Click "Manage" on existing invite
3. Click "Revoke link"
4. Generate new link

**Note:** API-generated links do NOT have this limitation — each `generateLink()` call creates a new link.

### "Redirect URI must use HTTPS"

**Root cause:** Configured return URI or `return_url` parameter uses HTTP.

**Fix:**

1. Update all redirect URIs in dashboard to use `https://`
2. If passing `return_url` to `generateLink()`, ensure it starts with `https://`
3. Local development: Use tools like ngrok to get HTTPS URLs, or configure dashboard with `https://localhost:3000` exception if supported

### "Intent not recognized"

**Root cause:** Invalid intent string passed to `generateLink()`.

**Fix:** Use one of these exact strings:

- `"sso"`
- `"dsync"`
- `"domain_verification"`
- `"audit_logs"`
- `"log_streams"`
- `"certificate_renewal"`

Check documentation (Step 1) for newly added intents.

## Related Skills

- **workos-sso**: SSO authentication after IT admin configures connection via Admin Portal
- **workos-directory-sync**: Directory Sync after IT admin sets up directory via Admin Portal
- **workos-authkit-nextjs**: End-user authentication (distinct from IT admin portal access)
