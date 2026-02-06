---
name: workos-domain-verification
description: Verify organization domains for SSO and directory sync.
---

<!-- generated -->

# WorkOS Domain Verification

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:
- https://workos.com/docs/domain-verification/index
- https://workos.com/docs/domain-verification/api

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check environment variables:
- `WORKOS_API_KEY` exists and starts with `sk_`
- `WORKOS_CLIENT_ID` exists and starts with `client_`

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Node.js/npm projects
npm list @workos-inc/node || echo "SDK not installed"

# Python projects
pip show workos || echo "SDK not installed"
```

If SDK missing, install before proceeding.

## Step 3: Integration Pattern Decision (Choose One)

```
Domain verification flow?
  |
  +-- Self-serve (IT admins verify via Admin Portal)
  |     |
  |     +-> Go to Step 4A
  |
  +-- Programmatic (your app verifies via API)
        |
        +-> Go to Step 4B
```

**When to use each:**
- **Admin Portal (4A)**: Less code, delegates DNS verification UX to WorkOS
- **API (4B)**: Full control over verification UX, custom domain management UI

## Step 4A: Admin Portal Flow (Self-Serve)

### Create Organization (if not exists)

```bash
# Check if organization exists
curl https://api.workos.com/organizations/:id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If 404, create organization first using SDK's `organizations.create()` method. See WebFetched docs for parameters.

### Generate Portal Link

Use SDK to generate Admin Portal link with `domain_verification` intent:

**Node.js pattern:**
```javascript
const { link } = await workos.portal.generateLink({
  organization: 'org_123',
  intent: 'domain_verification',
  return_url: 'https://yourapp.com/settings'
});
```

**Python pattern:**
```python
link = workos_client.portal.generate_link(
    organization='org_123',
    intent='domain_verification',
    return_url='https://yourapp.com/settings'
)
```

**CRITICAL:** Link expires in 5 minutes. Generate on-demand, never cache.

### Integration Points

1. **Settings page:** Add "Verify Domain" button that redirects to `link.url`
2. **Return URL handler:** Receive user after verification at `return_url` path
3. **Webhooks (optional):** Listen for `domain.verified` event to update app state

**Skip to Step 5 for verification.**

## Step 4B: API Flow (Programmatic)

### Create Organization Domain

**Decision: Sync vs Async verification?**

```
Verification timing?
  |
  +-- Immediate (block user flow)
  |     |
  |     +-> Poll verification status in loop
  |
  +-- Background (don't block user)
        |
        +-> Use webhooks or periodic checks
```

### Create Domain via API

Use SDK's domain creation method:

**Node.js:**
```javascript
const domain = await workos.organizationDomains.create({
  organization_id: 'org_123',
  domain: 'example.com'
});

// domain.verification_token contains the TXT record value
// domain.verification_strategy is 'dns'
```

**Python:**
```python
domain = workos_client.organization_domains.create(
    organization_id='org_123',
    domain='example.com'
)
```

**Result object contains:**
- `verification_token` - TXT record value IT admin must set
- `verification_strategy` - always `'dns'`
- `state` - initial value is `'pending'`

### Display Setup Instructions to User

Show these exact DNS instructions:

```
1. Log into your DNS provider
2. Create TXT record:
   - Host: _workos.example.com
   - Value: <verification_token>
   - TTL: 300 (or default)
3. Wait for DNS propagation (may take 5-60 minutes)
```

**Critical:** Host is `_workos.<domain>` NOT root domain.

### Verify Domain

**Immediate verification pattern (polls until verified):**

```javascript
// Trigger verification check
await workos.organizationDomains.verify({
  id: domain.id
});

// Poll status (implement exponential backoff)
let attempts = 0;
const maxAttempts = 20;
const delays = [5000, 10000, 15000, 30000]; // ms

while (attempts < maxAttempts) {
  const status = await workos.organizationDomains.get(domain.id);
  
  if (status.state === 'verified') {
    // Success - activate domain-gated features
    break;
  }
  
  if (status.state === 'failed') {
    // DNS record not found or incorrect
    throw new Error('Verification failed');
  }
  
  const delay = delays[Math.min(attempts, delays.length - 1)];
  await sleep(delay);
  attempts++;
}
```

**Background verification pattern (webhooks):**

1. After domain creation, store `domain.id` in database
2. Configure webhook endpoint for `domain.verified` event
3. When webhook fires, update domain status in app
4. Show user real-time status via polling your own API (not WorkOS)

## Step 5: Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Environment variables exist
echo $WORKOS_API_KEY | grep "^sk_" || echo "FAIL: Invalid API key"
echo $WORKOS_CLIENT_ID | grep "^client_" || echo "FAIL: Invalid client ID"

# 2. SDK installed (Node.js example)
npm list @workos-inc/node | grep "@workos-inc/node" || echo "FAIL: SDK not installed"

# 3. Organization exists (replace org_123 with real ID)
curl -s https://api.workos.com/organizations/org_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep '"object":"organization"' || echo "FAIL: Organization not found"

# 4. Can create domain (replace org_123 with real ID)
curl -s -X POST https://api.workos.com/organization_domains \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"org_123","domain":"test-$(date +%s).example.com"}' \
  | grep '"state":"pending"' || echo "FAIL: Cannot create domain"

# 5. Application builds without errors
npm run build  # or your build command
```

**If using Admin Portal (4A), also verify:**

```bash
# 6. Can generate portal link
curl -s -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization":"org_123","intent":"domain_verification"}' \
  | grep '"link"' || echo "FAIL: Cannot generate portal link"
```

## Step 6: Feature Gating (IMPORTANT)

**Critical:** Domain verification is a prerequisite for SSO and Directory Sync. After domain is verified:

1. Check domain state before enabling SSO connections
2. Check domain state before enabling Directory Sync
3. Store verified domain status in your database for fast access
4. Re-verify domain state on sensitive operations (user provisioning, deprovisioning)

**Pattern for checking domain before SSO setup:**

```javascript
// Before creating SSO connection
const domains = await workos.organizationDomains.list({
  organization_id: org.id
});

const hasVerifiedDomain = domains.data.some(d => d.state === 'verified');

if (!hasVerifiedDomain) {
  throw new Error('Organization must verify domain before enabling SSO');
}
```

## Error Recovery

### "Verification failed" during verify() call

**Root cause:** DNS TXT record not found or incorrect value.

**Fix:**
1. Query DNS directly to check record exists:
   ```bash
   dig +short TXT _workos.example.com
   ```
2. Verify output matches `verification_token` exactly
3. Check DNS propagation time - may take 5-60 minutes
4. Common mistakes:
   - Wrong host (used root domain instead of `_workos.subdomain`)
   - Typo in verification token
   - DNS provider strips quotes from TXT record value

### "Invalid organization_id" on domain creation

**Root cause:** Organization doesn't exist or ID is malformed.

**Fix:**
1. List organizations to get valid ID:
   ```bash
   curl https://api.workos.com/organizations \
     -H "Authorization: Bearer $WORKOS_API_KEY"
   ```
2. Create organization first if needed
3. Check ID starts with `org_`

### "Domain already exists" error

**Root cause:** Domain already claimed by another organization or same organization.

**Fix:**
1. List domains for organization:
   ```bash
   curl "https://api.workos.com/organization_domains?organization_id=org_123" \
     -H "Authorization: Bearer $WORKOS_API_KEY"
   ```
2. If domain exists but unverified, get existing domain ID and reverify
3. If domain exists and verified, check if user trying to claim already-verified domain
4. WorkOS prevents domain hijacking - one domain can only be verified by one org

### "Portal link expired" (5xx error or redirect failure)

**Root cause:** Generated link older than 5 minutes.

**Fix:**
1. Generate new link on every button click - never cache
2. Store generation timestamp, regenerate if > 4 minutes old
3. Show user "link expired" message with regenerate button

### API returns 401 Unauthorized

**Root cause:** Invalid or missing API key.

**Fix:**
1. Check API key starts with `sk_` (not `pk_` which is publishable key)
2. Verify key exists in environment: `echo $WORKOS_API_KEY`
3. Check key permissions in WorkOS Dashboard > API Keys
4. Regenerate key if compromised

### Webhook not firing for domain.verified

**Root cause:** Webhook endpoint not configured or unreachable.

**Fix:**
1. Check webhook URL in WorkOS Dashboard > Webhooks
2. Verify endpoint is publicly accessible (not localhost unless using tunnel)
3. Check webhook secret matches application config
4. Test endpoint manually:
   ```bash
   curl -X POST https://yourapp.com/webhooks/workos \
     -H "Content-Type: application/json" \
     -d '{"id":"evt_test","data":{"state":"verified"}}'
   ```
5. Check application logs for webhook signature validation errors

## Related Skills

- **workos-sso**: SSO connections require verified domains
- **workos-directory-sync**: Directory Sync requires verified domains
- **workos-admin-portal**: Alternative entry point for domain verification UI
