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

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS dashboard account exists
- Confirm API keys available in dashboard

### Environment Variables

Check for these secrets in your environment config:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Do NOT hardcode these values.** Use environment variables or secrets manager.

### Project Dependencies

Verify WorkOS SDK is installed. If not installed, the agent must install it before proceeding.

## Step 3: Workflow Decision Tree

Admin Portal has two integration patterns. Choose based on your requirements:

```
Integration approach?
  |
  +-- Share link manually (email/Slack)
  |     |
  |     +-- Use WorkOS Dashboard workflow
  |     +-- Skip to Step 8 (Dashboard Link Generation)
  |
  +-- Embed in application (in-app button)
        |
        +-- Use SDK/API workflow
        +-- Continue to Step 4
```

**This skill covers SDK/API workflow only.** For dashboard-only approach, see dashboard documentation.

## Step 4: Configure Redirect URIs (REQUIRED)

Navigate to WorkOS Dashboard → Redirects tab.

Set these redirect URIs:

1. **Default return URI** - Where users return after closing Admin Portal
2. **SSO success URI** (optional) - Where users land after successful SSO setup
3. **Directory Sync success URI** (optional) - Where users land after successful dsync setup
4. **Log Streams success URI** (optional) - Where users land after successful log stream setup

**Critical:** All URIs MUST use HTTPS. HTTP will be rejected.

**Verify:** Save redirect URIs in dashboard before proceeding. Portal links will fail without this.

## Step 5: Install WorkOS SDK

WebFetch the SDK installation instructions for your language/framework from the Admin Portal docs.

**Verify:** SDK package exists in project dependencies before continuing.

```bash
# Example verification (Node.js)
npm list @workos-inc/node || echo "FAIL: SDK not installed"
```

## Step 6: Initialize SDK Client

Create SDK client with your API key. Check fetched docs for exact initialization pattern.

**Common pattern (verify against docs):**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Never** initialize with hardcoded API keys.

## Step 7: Create Organization Resource

Admin Portal sessions are scoped to organizations. Each customer that needs Admin Portal access requires an organization resource.

### When to Create

Create organization during customer onboarding flow:
- New enterprise customer signs up
- Customer requests SSO/Directory Sync setup
- Customer needs to verify domain ownership

### Creation Pattern

WebFetch current organization creation method from docs. The endpoint requires a `name` parameter and returns an `id`.

**Store the organization ID** - you'll need it for portal link generation.

**Critical:** Organizations can only have ONE SSO connection. Multiple organizations needed for multiple connections.

## Step 8: Dashboard Link Generation (Dashboard Workflow)

**Skip this step if using SDK/API workflow.**

For manual link sharing:

1. Navigate to Organizations in WorkOS Dashboard
2. Find the target organization
3. Click "Invite admin" button
4. Select features to include: SSO, Directory Sync, Domain Verification, etc.
5. Choose: "Send email" or "Copy link"

**Link expiry:** Dashboard links expire after a time period specified in docs. Check docs for current expiry duration.

**Link limits:** Only ONE active link per organization. Must revoke existing link to create new one.

## Step 9: Generate Portal Link (SDK/API Workflow)

Generate portal link programmatically using SDK method from fetched docs.

### Required Parameters

- `organization` - organization ID from Step 7
- `intent` - one of: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`

### Optional Parameters

- `return_url` - override default redirect URI from Step 4

### Security Constraints

**Link expiry:** Portal links expire 5 minutes after creation. Generate immediately before redirect - do NOT email these links.

**Auth guard:** The endpoint that generates portal links MUST be behind authentication and restricted to IT admins only.

### Implementation Pattern

WebFetch exact method signature from docs. Typical pattern:

```typescript
// VERIFY against fetched docs - method names may differ
const portalLink = await workos.portal.generateLink({
  organization: organizationId,
  intent: 'sso',
  return_url: 'https://yourapp.com/settings/sso/complete' // optional
});

// Immediately redirect user
res.redirect(portalLink.link);
```

**Do NOT store portal links** - they expire in 5 minutes.

## Step 10: Handle Return Flow

When user completes Admin Portal flow, they redirect to:

```
return_url (if provided) 
  |
  +--> else success_url (from dashboard config)
  |
  +--> else default_return_url (from dashboard config)
```

Your return URL handler should:

1. Check if setup was completed (verify connection exists)
2. Update customer's setup status in your database
3. Show success message or next steps

**Verify connection creation** using SDK method from docs (e.g., `listConnections` filtered by organization).

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Verify environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: Missing WORKOS_API_KEY"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 2. Verify SDK installed (adjust for your package manager)
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Verify redirect URIs configured (manual check)
echo "CHECK: Dashboard → Redirects tab has HTTPS URIs configured"

# 4. Test portal link generation (with test organization)
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_test123",
    "intent": "sso"
  }' | grep -q "link" && echo "PASS" || echo "FAIL"

# 5. Build succeeds
npm run build || echo "FAIL: Build failed"
```

**If check #4 fails:** Verify API key is valid and organization exists.

## Error Recovery

### "Invalid redirect URI" when generating link

**Root cause:** Redirect URIs not configured in dashboard OR using HTTP instead of HTTPS.

**Fix:**
1. Go to WorkOS Dashboard → Redirects tab
2. Ensure default return URI is set with HTTPS
3. If using custom `return_url`, ensure it's HTTPS
4. Save configuration and retry

### "Organization not found" error

**Root cause:** Organization ID is incorrect or organization doesn't exist.

**Fix:**
1. Verify organization was created successfully
2. Check stored organization ID matches API response
3. List organizations via SDK to confirm ID exists:

```bash
# Verify organization exists
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | grep "org_yourId"
```

### Portal link expired / "Link is invalid"

**Root cause:** Portal links expire 5 minutes after generation.

**Fix:**
- Generate link immediately before redirect
- Never email or store portal links
- If user reports expired link, generate new one

**Pattern to avoid:**
```typescript
// BAD - do not do this
const link = await generatePortalLink();
await sendEmail(link); // Link will expire before user clicks
```

**Correct pattern:**
```typescript
// GOOD - immediate redirect
const link = await generatePortalLink();
res.redirect(link.link); // User redirected within seconds
```

### "Unauthorized" or 401 errors

**Root cause:** API key is invalid, expired, or missing.

**Fix:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key hasn't been rotated in dashboard
3. Confirm key is test key for staging, production key for production
4. Test key validity:

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "%{http_code}"
# Should return 200, not 401
```

### SDK import errors / "Cannot find module"

**Root cause:** SDK not installed or wrong import path.

**Fix:**
1. Install SDK: `npm install @workos-inc/node` (or equivalent)
2. Verify package in node_modules
3. Check import path matches SDK version in fetched docs
4. Clear node_modules and reinstall if corruption suspected

### "Organization already has a connection" error

**Root cause:** Attempting to create second SSO connection for same organization.

**Fix:**
- WorkOS organizations support ONE SSO connection only
- To support multiple connections, create separate organizations
- For multi-tenant apps, use one organization per tenant

### Return URL not working / user not redirected

**Root cause:** return_url parameter malformed or dashboard config missing.

**Fix:**
1. Verify return_url is valid HTTPS URL
2. Check default return URI set in dashboard
3. Ensure return URL handler exists in your app
4. Test return flow manually by visiting return URL directly

## Intent Selection Guide

Choose the correct intent based on what the IT admin needs to configure:

| Intent | Use Case | Result |
|--------|----------|---------|
| `sso` | Configure SAML/OIDC SSO connection | Connection created for organization |
| `dsync` | Set up directory sync (SCIM/Azure AD) | Directory created and syncing |
| `audit_logs` | Configure audit log streaming | Audit log settings configured |
| `log_streams` | Set up log stream destinations | Log stream created |
| `domain_verification` | Verify domain ownership | Domain verified for organization |
| `certificate_renewal` | Renew SAML signing certificate | Certificate renewed |

**Multiple intents:** Generate separate portal links for each feature. Do not combine intents in a single link.

## Integration Patterns

### Pattern A: Self-Service SSO Setup

Recommended for PLG/self-serve enterprise plans:

1. Customer upgrades to enterprise plan
2. App creates organization resource
3. Settings page shows "Set up SSO" button
4. Button click → generate portal link with `intent: 'sso'`
5. User completes setup in Admin Portal
6. Return to app → verify connection exists → show success

### Pattern B: Support-Initiated Setup

Recommended for sales-led enterprise onboarding:

1. Sales team closes enterprise deal
2. Support creates organization in WorkOS Dashboard
3. Support generates dashboard link with email delivery
4. IT admin receives email, clicks link, completes setup
5. Support verifies setup complete in dashboard

### Pattern C: Domain Verification Flow

For features requiring domain ownership proof:

1. User enters company domain in app
2. App creates organization (if not exists)
3. Generate portal link with `intent: 'domain_verification'`
4. User proves domain ownership via DNS/file upload
5. Return to app → verify domain status → enable domain features

## Related Skills

- **workos-sso**: Configure SSO connections programmatically
- **workos-directory-sync**: Set up directory sync via API
- **workos-domain-verification**: Verify domain ownership
- **workos-audit-logs**: Stream audit logs to destinations
- **workos-widgets**: Embed domain management UI components
