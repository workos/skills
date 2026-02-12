---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required secrets:

- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Verify:**

```bash
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" | wc -l
# Should output: 2
```

### WorkOS SDK

Confirm SDK is installed:

```bash
# Node.js
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# Python
pip show workos 2>/dev/null || echo "FAIL: SDK not installed"

# Ruby
gem list workos | grep -q workos || echo "FAIL: SDK not installed"
```

If SDK is missing, install it before proceeding (see fetched docs for language-specific installation).

## Step 3: Dashboard Configuration (REQUIRED)

**Sign into dashboard.workos.com and configure redirect URIs BEFORE writing code.**

### Set Default Redirect URI

Navigate to: Dashboard → Configuration → Redirects → Admin Portal Redirect Links

1. Set "Default return URI" - where users land when leaving Admin Portal
   - Example: `https://app.example.com/settings`
   - **MUST use HTTPS** (not HTTP, even in dev)

2. (Optional) Set feature-specific success URIs:
   - "Single Sign-On success" - redirect after SSO setup completes
   - "Directory Sync success" - redirect after Directory Sync setup completes
   - "Log Streams success" - redirect after Log Streams setup completes

**Verify dashboard config:**

```bash
# If you have WorkOS CLI installed:
workos redirect-uris list --env production | grep -q "https://" || echo "FAIL: No HTTPS redirect configured"
```

Without this configuration, portal link generation will fail or redirect users incorrectly.

## Step 4: Integration Pattern Selection (Decision Tree)

Choose your integration approach:

```
How will IT admins access Admin Portal?
  |
  +-- Email/Slack link from dashboard --> Go to Step 5A (Manual Link)
  |
  +-- Embedded in your app UI --> Go to Step 5B (SDK Integration)
```

**Key difference:**

- **5A (Manual):** You create orgs in dashboard, copy portal links, send manually. No code required.
- **5B (SDK):** Your app programmatically generates portal links, redirects users automatically. Requires code.

Most production apps use 5B for seamless UX. Use 5A for quick testing or low-volume scenarios.

## Step 5A: Manual Link Workflow (Dashboard Only)

**For testing or non-embedded workflows.**

### Create Organization

1. Dashboard → Organizations → "Create organization"
2. Fill in organization name and optional domains
3. Save organization ID for reference

### Generate Setup Link

1. Click organization → "Invite admin" button
2. Select features to enable (SSO, Directory Sync, etc.)
3. Either:
   - Enter IT admin email → WorkOS sends invite automatically
   - Click "Copy setup link" → Share link manually

**Link expiry:** Links expire after **5 minutes**. Do not email them — share immediately or use SDK approach.

**Verify link works:**

```bash
# Paste link into browser — should load Admin Portal
# Or check with curl (link should return HTML, not error):
curl -I "https://id.workos.com/portal/..." | grep -q "200 OK"
```

**SKIP to Step 6 (verification) if using manual workflow.**

## Step 5B: SDK Integration (Programmatic)

**For embedded in-app workflows.**

### Organization Management

Your app must maintain a **1:1 mapping** between your customers and WorkOS organizations.

**Decision point:** When to create organizations?

```
When does customer need Admin Portal?
  |
  +-- During initial onboarding --> Create org in signup flow
  |
  +-- When enabling enterprise features --> Create org on-demand (lazy)
```

**Create organization code pattern** (see fetched docs for exact SDK methods):

```javascript
// Node.js example - check fetched docs for your language
const organization = await workos.organizations.createOrganization({
  name: "Acme Corp",
  domains: ["acme.com"], // Optional: for domain verification
});

// Store organization.id in your database
await db.customers.update(customerId, {
  workos_organization_id: organization.id,
});
```

**Database schema requirement:**

```sql
-- Add column to your customers table
ALTER TABLE customers ADD COLUMN workos_organization_id VARCHAR(255);
CREATE INDEX idx_workos_org_id ON customers(workos_organization_id);
```

### Generate Portal Link (Core Integration)

Create an authenticated endpoint (e.g., `/settings/admin-portal`) that:

1. Retrieves customer's `workos_organization_id` from database
2. Generates time-limited portal link via SDK
3. Immediately redirects user (links expire in 5 minutes)

**Intent selection** (specify what user can do in portal):

```
What feature is user setting up?
  |
  +-- Single Sign-On --> intent: 'sso'
  |
  +-- Directory Sync --> intent: 'dsync'
  |
  +-- Domain Verification --> intent: 'domain_verification'
  |
  +-- Audit Logs --> intent: 'audit_logs'
  |
  +-- Log Streams --> intent: 'log_streams'
  |
  +-- Certificate Renewal --> intent: 'certificate_renewal'
```

**Example implementation pattern** (see fetched docs for exact SDK method names):

```javascript
// Node.js example
app.get("/settings/admin-portal", requireAuth, async (req, res) => {
  const customer = await db.customers.findById(req.user.customerId);

  if (!customer.workos_organization_id) {
    return res.status(400).send("Organization not configured");
  }

  const { link } = await workos.portal.generateLink({
    organization: customer.workos_organization_id,
    intent: "sso", // or dsync, domain_verification, etc.
    return_url: "https://app.example.com/settings/sso-complete", // Optional
  });

  res.redirect(link);
});
```

**CRITICAL:**

- **Never email portal links** — 5-minute expiry makes them useless in email
- **Guard the endpoint** — only authenticated IT admins should access it
- **Redirect immediately** — don't render the link in HTML, redirect server-side

### Return URL Handling

When user completes portal setup, WorkOS redirects them back to your app.

**Return URL priority** (highest to lowest):

1. `return_url` parameter in `generateLink()` call
2. Feature-specific success URI from dashboard (e.g., "Single Sign-On success")
3. Default return URI from dashboard

**Best practice:** Use `return_url` parameter to include customer context:

```javascript
return_url: `https://app.example.com/settings/sso-complete?customer_id=${customerId}`;
```

Then extract customer ID in your return handler to show success message or next steps.

## Step 6: Verification Checklist (ALL MUST PASS)

Run these commands before considering integration complete:

### Dashboard Configuration

```bash
# Check: HTTPS redirect URIs configured (manual verification in dashboard)
# Navigate to dashboard.workos.com → Configuration → Redirects
# Confirm at least one HTTPS URI exists
```

### Environment Variables

```bash
# Check: Both secrets present
env | grep "WORKOS_API_KEY" | grep -q "sk_" && echo "PASS: API key valid" || echo "FAIL: Check API key"
env | grep "WORKOS_CLIENT_ID" | grep -q "client_" && echo "PASS: Client ID valid" || echo "FAIL: Check client ID"
```

### SDK Integration (5B only)

```bash
# Check: Organization creation endpoint exists
grep -r "createOrganization\|create_organization" . --include="*.js" --include="*.py" --include="*.rb" 2>/dev/null | head -1

# Check: Portal link generation endpoint exists
grep -r "generateLink\|generate_link" . --include="*.js" --include="*.py" --include="*.rb" 2>/dev/null | head -1

# Check: Database schema includes organization ID
# (Database-specific - example for PostgreSQL)
psql -c "\d customers" | grep -q "workos_organization_id" && echo "PASS: Schema updated" || echo "FAIL: Add organization_id column"
```

### End-to-End Test

```bash
# Manual test:
# 1. Start app, login as admin user
# 2. Navigate to portal trigger endpoint (e.g., /settings/admin-portal)
# 3. Confirm redirect to id.workos.com/portal/... URL
# 4. Confirm portal loads (not 404 or error page)
# 5. Complete a setup flow (e.g., select SSO provider)
# 6. Confirm return to your app's return_url
```

**All checks must pass before deploying to production.**

## Error Recovery

### "Invalid API key" or 401 Unauthorized

**Root cause:** API key format wrong, expired, or missing scopes.

**Fix:**

1. Verify key starts with `sk_` (not client ID starting with `client_`)
2. Dashboard → API Keys → regenerate key if needed
3. Confirm key is for correct environment (test vs. production)

**Verify fix:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/organizations | grep -q "data" && echo "Auth works"
```

### "Organization not found" when generating link

**Root cause:** Organization ID in database doesn't exist in WorkOS, or wrong environment.

**Fix:**

1. Check: `workos_organization_id` stored correctly in database
2. Verify organization exists in WorkOS dashboard
3. Confirm using test API key with test orgs, or production key with production orgs

**Debug query:**

```bash
# Replace ORG_ID with value from database
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations/ORG_ID \
  | jq .
```

If 404, organization was deleted or never created — create new org and update database.

### "Invalid redirect URI" error

**Root cause:** Dashboard redirect URIs not configured, or using HTTP instead of HTTPS.

**Fix:**

1. Dashboard → Configuration → Redirects
2. Add HTTPS URI (e.g., `https://app.example.com/settings`)
3. If testing locally, use ngrok or similar to get HTTPS tunnel
4. Confirm no trailing slashes or typos

**Verify:**

```bash
# Check dashboard config manually - no API for this
# Look for green checkmark next to configured URIs
```

### Portal link expires immediately / "Link expired" error

**Root cause:** Links expire in 5 minutes. User received link via email or delayed channel.

**Fix:**

1. **Never email portal links** — use SDK integration (Step 5B) to redirect immediately
2. If manual workflow (Step 5A) is required, send link via instant channel (Slack DM, live chat)
3. Re-generate link if expired (only one link active per org)

**Alternative pattern for async delivery:**
Instead of sharing portal link, share a link to YOUR endpoint that generates fresh portal link on-demand:

```
Share: https://app.example.com/admin-portal-redirect
(Your endpoint generates fresh WorkOS link and redirects)
```

### SDK import errors

**Root cause:** Package not installed or import path incorrect.

**Fix for Node.js:**

```bash
npm install @workos-inc/node
# Verify installation
npm list @workos-inc/node
```

**Fix for Python:**

```bash
pip install workos
# Verify installation
python -c "import workos; print(workos.__version__)"
```

Check fetched docs for correct import statement — SDK versions may change import paths.

### "Cannot create multiple connections" error

**Root cause:** WorkOS organizations support **one active connection** (SSO or Directory Sync) at a time.

**Fix:**

1. This is expected behavior — organizations are 1:1 with connections
2. If customer needs multiple SSO providers, create separate organizations for each
3. Or use [Environment-level SSO](https://workos.com/docs/sso) (different feature, see related skills)

**Not a bug:** One org = one connection is by design for Admin Portal.

### Users redirected to wrong URL after portal

**Root cause:** Redirect URI priority misconfigured (see "Return URL Handling" in Step 5B).

**Fix:**

1. Check: `return_url` parameter in `generateLink()` call (highest priority)
2. Check: Feature-specific success URI in dashboard
3. Check: Default return URI in dashboard
4. Confirm URIs use HTTPS and match deployed app URLs (not localhost)

**Debug:**

```bash
# Check what URL WorkOS redirected to (inspect browser network tab)
# Compare against expected return_url parameter or dashboard config
```

If still wrong, regenerate portal link with explicit `return_url` parameter.

## Related Skills

- **workos-directory-sync.rules.yml**: Configure directory sync connections via Admin Portal
- **workos-migrate-the-standalone-sso-api.rules.yml**: Migrate existing SSO setups to Admin Portal management
- **workos-authkit-base**: AuthKit authentication patterns that complement Admin Portal org management
