---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- generated -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required secrets:

```bash
# Verify API key format
grep "WORKOS_API_KEY.*sk_" .env.local || echo "FAIL: Missing or invalid WORKOS_API_KEY"

# Verify client ID exists
grep "WORKOS_CLIENT_ID.*client_" .env.local || echo "FAIL: Missing or invalid WORKOS_CLIENT_ID"
```

Both must exist before proceeding. API key starts with `sk_`, client ID starts with `client_`.

### WorkOS Dashboard Access

Confirm you can access https://dashboard.workos.com/ — you'll need it for redirect configuration.

## Step 3: Integration Workflow (Decision Tree)

```
What integration pattern?
  |
  +-- Share link from dashboard only
  |     |
  |     +-> Skip to Step 8 (Dashboard Link Generation)
  |
  +-- Programmatic integration in app
        |
        +-> Continue to Step 4
```

Most applications need programmatic integration. Dashboard-only is for simple email invites.

## Step 4: Configure Dashboard Redirects

**CRITICAL:** Admin Portal requires redirect URIs configured in WorkOS dashboard before generating links.

Navigate to: https://dashboard.workos.com/redirects

Set these URIs (all must use HTTPS):

1. **Default return URI** — Where users land after closing portal
2. **SSO success URI** — After completing SSO setup (optional)
3. **Directory Sync success URI** — After completing directory setup (optional)
4. **Log Streams success URI** — After completing log stream setup (optional)

Example configuration:
```
Default: https://yourdomain.com/settings/integrations
SSO success: https://yourdomain.com/settings/sso-complete
```

**Verify:** URIs are saved in dashboard before continuing. Missing redirects cause "invalid redirect" errors.

## Step 5: Install WorkOS SDK

Detect package manager and install SDK from docs.

**Verify:** SDK package exists in node_modules before writing imports:

```bash
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: WorkOS SDK not installed"
```

## Step 6: Initialize SDK Client

Create SDK client with environment variables:

```typescript
// lib/workos.ts
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

**Pattern note:** SDK initialization is environment-dependent. Never hardcode keys.

## Step 7: Create Organization Entity

Admin Portal sessions are scoped to WorkOS organizations. Each customer needs one organization.

### When to Create

Create organization during customer onboarding flow — when account is first set up or enterprise upgrade happens.

### Implementation

```typescript
// Example: During customer signup
const organization = await workos.organizations.createOrganization({
  name: 'Customer Company Name',
  domains: ['customer.com'], // Optional
});

// Store organization.id in your database
// Link to customer record for future portal access
```

**Database schema addition:**

Add `workos_organization_id` column to customers/accounts table:

```sql
ALTER TABLE customers ADD COLUMN workos_organization_id VARCHAR(255);
```

**CRITICAL:** Store organization ID. You cannot generate portal links without it.

## Step 8: Implement Portal Link Generation

### Route Location

Create API route or server action that generates portal link:

```
Next.js:  app/api/admin-portal/route.ts
Express:  routes/admin-portal.js
```

### Intent Selection (Decision Tree)

```
What should portal configure?
  |
  +-- SSO setup -----------> intent: 'sso'
  |
  +-- Directory Sync ------> intent: 'dsync'
  |
  +-- Domain Verification -> intent: 'domain_verification'
  |
  +-- Audit Logs ----------> intent: 'audit_logs'
  |
  +-- Log Streams ---------> intent: 'log_streams'
  |
  +-- Certificate Renewal -> intent: 'certificate_renewal'
```

Most common: `sso` and `dsync`.

### Generate Link

```typescript
// API route handler
const { link } = await workos.portal.generateLink({
  organization: organizationId,
  intent: 'sso', // or 'dsync', 'domain_verification', etc.
  return_url: 'https://yourdomain.com/settings', // Optional override
});

// Immediately redirect - links expire in 5 minutes
return Response.redirect(link);
```

**Security requirements:**

1. **Auth guard** — Route must verify user is admin for the organization
2. **Immediate redirect** — Do NOT email links (5 minute expiry)
3. **Organization ownership** — Verify user has access to organization before generating link

### Error Handling Pattern

```typescript
try {
  const { link } = await workos.portal.generateLink({
    organization: orgId,
    intent: 'sso',
  });
  return Response.redirect(link);
} catch (error) {
  if (error.code === 'organization_not_found') {
    // Organization doesn't exist - create it first
  } else if (error.code === 'invalid_redirect_uri') {
    // Redirect URI not configured in dashboard
  }
  throw error;
}
```

## Step 9: Frontend Integration

Add button/link in your app's settings UI:

```tsx
// Example: Settings page
<button onClick={() => window.location.href = '/api/admin-portal?intent=sso'}>
  Configure SSO
</button>
```

**Pattern:** Button triggers API route which generates fresh link and redirects.

**DO NOT:**
- Generate link on page load (expires)
- Store link in state (security risk)
- Email link to user (expires too quickly)

## Step 10: Handle Return Flow

User completes portal workflow and returns to your app via configured redirect URI.

### Success Detection (Optional)

WorkOS can redirect to different URIs on success (configured in Step 4):

```
User flow:
1. User clicks "Configure SSO"
2. Portal generates link -> redirects to WorkOS
3. User completes SSO setup
4. WorkOS redirects to success_uri (if configured)
   OR default return_uri
```

### Webhook Integration (Recommended)

For reliable state sync, use webhooks instead of redirect-based detection:

```typescript
// Webhook endpoint
app.post('/webhooks/workos', async (req, res) => {
  const event = req.body;
  
  if (event.event === 'connection.activated') {
    // SSO connection is ready
    // Update database: mark customer as SSO-enabled
  }
  
  res.status(200).send('OK');
});
```

See `workos-webhooks` skill for webhook setup details.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check environment variables
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env.local | wc -l | grep -q "2" && echo "PASS: Env vars set" || echo "FAIL: Missing env vars"

# 2. Check SDK installed
npm list @workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK missing"

# 3. Check SDK client initialization
grep -r "new WorkOS" . --include="*.ts" --include="*.js" && echo "PASS: SDK initialized" || echo "FAIL: No SDK init found"

# 4. Check portal route exists
find . -path "*/admin-portal/*" -o -path "*/portal/*" | head -1 && echo "PASS: Portal route exists" || echo "FAIL: No portal route"

# 5. Verify app builds
npm run build 2>&1 | grep -q "Compiled successfully" && echo "PASS: Build succeeds" || echo "FAIL: Build errors"
```

### Manual Dashboard Checks

1. Navigate to https://dashboard.workos.com/redirects
2. Verify at least one redirect URI is configured
3. Verify redirect URIs use HTTPS (not HTTP)

## Error Recovery

### "Invalid redirect URI"

**Root cause:** Redirect URI not configured in WorkOS dashboard or doesn't match exactly.

**Fix:**
1. Go to https://dashboard.workos.com/redirects
2. Add your return URI exactly as it appears in your app
3. Must use HTTPS (localhost can use HTTP in test mode)
4. No trailing slashes unless your app URL has them

### "Organization not found"

**Root cause:** Generating portal link with organization ID that doesn't exist.

**Fix:**
1. Check: Organization was created in Step 7
2. Check: Organization ID is stored in database
3. Check: Querying correct organization ID for logged-in user
4. Create organization if missing:

```bash
# Test via WorkOS CLI or API
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d name="Test Org"
```

### "Portal link expired"

**Root cause:** 5-minute expiry on portal links. User followed stale link.

**Fix:**
- Never store or email portal links
- Generate fresh link on every button click
- If user sees expired error, regenerate link:

```typescript
// Add retry logic
if (linkExpired) {
  const { link } = await workos.portal.generateLink({...});
  return Response.redirect(link);
}
```

### "Unauthorized" when generating link

**Root cause:** API key invalid or missing permissions.

**Fix:**
1. Verify API key starts with `sk_` (not client ID)
2. Check key is from correct environment (test vs production)
3. Regenerate key in dashboard if necessary: https://dashboard.workos.com/api-keys

### SDK import fails

**Root cause:** SDK not installed or wrong import path.

**Fix:**
```bash
# Reinstall SDK
npm install @workos-inc/node

# Verify version
npm list @workos-inc/node
```

Check docs for correct import path — may vary by SDK version.

### User sees "Connection already exists"

**Root cause:** Organization already has SSO/directory connection. WorkOS limits one connection per organization per intent type.

**Fix:**
- Use `intent: 'sso'` to allow editing existing connection
- User can update connection settings in portal
- If creating new connection is required, delete old connection first via API or dashboard

## Related Skills

- **workos-sso**: SSO authentication implementation (what users configure via portal)
- **workos-directory-sync**: Directory sync setup (what users configure via portal)
- **workos-webhooks**: Event-driven updates when portal actions complete
- **workos-organizations**: Organization management and domain verification
