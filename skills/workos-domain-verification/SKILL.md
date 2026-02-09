---
name: workos-domain-verification
description: Verify organization domains for SSO and directory sync.
---

<!-- generated -->

# WorkOS Domain Verification

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/domain-verification/index
- https://workos.com/docs/domain-verification/api

The docs are the source of truth. If this skill conflicts with docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:
- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_` (for Admin Portal integration)

### SDK Installation

Verify WorkOS SDK is installed:

```bash
# Check package.json contains @workos-inc/node (Node.js)
grep "@workos-inc/node" package.json

# OR check for other SDK (Python, Ruby, etc.)
```

**If SDK missing:** Install before proceeding.

### Organization Exists

**CRITICAL:** Domain Verification requires an existing Organization. Check that you have an organization ID.

```bash
# Test API connectivity and fetch organizations
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If no organizations exist, you must create one first using the Organizations API.

## Step 3: Choose Implementation Path (Decision Tree)

```
Domain Verification Implementation?
  |
  +-- Admin Portal (Self-Service) --> Go to Step 4
  |     - IT admins verify via WorkOS UI
  |     - DNS TXT record creation
  |     - Easiest for end users
  |
  +-- Programmatic API --> Go to Step 5
        - Custom UI in your app
        - Full control over flow
        - More implementation work
```

Most integrations use Admin Portal (Step 4). Choose API (Step 5) only if you need custom UI.

## Step 4: Admin Portal Integration (Self-Service Path)

### 4A: Generate Portal Link

Create a Portal Link for the organization that needs to verify a domain:

```javascript
// Node.js SDK example
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function generateDomainVerificationPortal(organizationId) {
  const portalLink = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'domain_verification',
    return_url: 'https://yourapp.com/admin/domains', // Where to redirect after
  });
  
  return portalLink.link; // Valid for 5 minutes
}
```

**Portal Link Expiration:** Links expire after 5 minutes. Generate fresh links on-demand, do not cache.

### 4B: Redirect User to Portal

Send the organization admin to the portal link. The WorkOS UI handles:
- Domain input
- DNS TXT record generation
- Verification status polling
- Success/failure messaging

### 4C: Handle Return URL

When the admin completes the flow, WorkOS redirects to your `return_url`. The domain verification status is updated asynchronously.

**Poll for verification status:**

```javascript
async function checkDomainVerification(organizationId) {
  const org = await workos.organizations.getOrganization(organizationId);
  const domains = org.domains; // Array of domain objects
  
  domains.forEach(domain => {
    console.log(`${domain.domain}: ${domain.state}`); // "verified" or "pending"
  });
}
```

**Go to Step 6 for verification.**

## Step 5: Programmatic API Integration (Custom UI Path)

### 5A: Create Organization Domain

```javascript
async function createDomain(organizationId, domainName) {
  const domain = await workos.organizationDomains.create({
    organization_id: organizationId,
    domain: domainName, // e.g., "example.com"
  });
  
  return {
    domainId: domain.id,
    verificationToken: domain.verification_token, // Share this with IT admin
  };
}
```

**Return value structure:**

```json
{
  "id": "org_domain_01H...",
  "domain": "example.com",
  "state": "pending",
  "verification_token": "workos-verification=abc123...",
  "verification_strategy": "dns"
}
```

### 5B: Display DNS Instructions

Show the IT admin these instructions in your UI:

```
Domain: example.com
Record Type: TXT
Host: @ (or leave blank)
Value: workos-verification=abc123...
TTL: 3600 (or default)
```

**Critical:** The TXT record value is the `verification_token` from Step 5A.

### 5C: Trigger Verification Check

After the admin adds the DNS record, trigger verification:

```javascript
async function verifyDomain(domainId) {
  const domain = await workos.organizationDomains.verify(domainId);
  return domain.state; // "verified" or "pending"
}
```

**DNS propagation note:** Records can take 5-60 minutes to propagate. Implement retry logic with exponential backoff.

### 5D: Polling Pattern (IMPORTANT)

Do NOT poll continuously. Use this pattern:

```javascript
async function pollDomainVerification(domainId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const domain = await workos.organizationDomains.get(domainId);
    
    if (domain.state === 'verified') {
      return { success: true, domain };
    }
    
    // Exponential backoff: 5s, 10s, 20s, 40s...
    await sleep(5000 * Math.pow(2, i));
  }
  
  return { success: false, message: 'DNS propagation timeout' };
}
```

**Go to Step 6 for verification.**

## Step 6: Verification Status Handling

### Check Domain State

```bash
# Get organization domains via API
curl https://api.workos.com/organizations/org_01H... \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.domains'
```

**Domain states:**
- `pending` - TXT record not found or not verified yet
- `verified` - Domain ownership confirmed

### Enable Gated Features

Once `state === "verified"`, enable features that require verified domains:

- **SSO Connections:** Allow creating SSO connections for this domain
- **Directory Sync:** Allow directory provisioning for this domain
- **Email Domain Matching:** Auto-assign users with matching email domains to this organization

**Example feature gate:**

```javascript
async function canEnableSSO(organizationId, domain) {
  const org = await workos.organizations.getOrganization(organizationId);
  const verifiedDomain = org.domains.find(
    d => d.domain === domain && d.state === 'verified'
  );
  
  if (!verifiedDomain) {
    throw new Error('Domain must be verified before enabling SSO');
  }
  
  // Proceed with SSO setup...
}
```

## Step 7: Handle Unverification (IMPORTANT)

Domains can become unverified if the DNS record is removed. Poll periodically or use webhooks.

**Webhook event:** `dsync.domain.verification_failed`

```javascript
// Webhook handler
app.post('/webhooks/workos', async (req, res) => {
  const event = req.body;
  
  if (event.event === 'dsync.domain.verification_failed') {
    const domainId = event.data.id;
    // Disable features dependent on this domain
    await disableFeatures(domainId);
  }
  
  res.sendStatus(200);
});
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables set
echo $WORKOS_API_KEY | grep "^sk_" && echo "PASS" || echo "FAIL"

# 2. SDK installed
ls node_modules/@workos-inc/node && echo "PASS" || echo "FAIL"

# 3. Can fetch organizations
curl -s https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq -e '.data' && echo "PASS" || echo "FAIL"

# 4. Portal link generation works (replace org_id)
node -e "
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
workos.portal.generateLink({
  organization: 'org_01H...',
  intent: 'domain_verification',
  return_url: 'https://example.com'
}).then(() => console.log('PASS')).catch(() => console.log('FAIL'));
"

# 5. Application builds
npm run build
```

**Do not mark complete until all pass.**

## Error Recovery

### "API key invalid" or 401 Unauthorized

**Root cause:** API key missing, malformed, or wrong environment (test vs. production).

Fix:
1. Check `.env` file has `WORKOS_API_KEY=sk_...`
2. Verify key starts with `sk_` (not `client_` or `pk_`)
3. Check key matches environment in WorkOS Dashboard (test keys start with `sk_test_`)

### "Organization not found" (404)

**Root cause:** Organization ID is invalid or belongs to different WorkOS account.

Fix:
1. List organizations: `curl https://api.workos.com/organizations -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Use correct organization ID from response
3. If no organizations exist, create one first

### "Domain already exists" (409 Conflict)

**Root cause:** Domain already registered to this or another organization.

Fix:
1. Check if domain is already in organization's domains list
2. If domain belongs to wrong organization, delete it from that organization first
3. Each domain can only belong to one organization at a time

### DNS verification never completes

**Root causes:**
- DNS record not added correctly
- DNS record not propagated yet (can take 5-60 minutes)
- TXT record value incorrect

Debug steps:
```bash
# 1. Check DNS propagation (replace example.com)
dig TXT example.com +short | grep workos-verification

# 2. Use Google DNS (sometimes faster to propagate)
dig @8.8.8.8 TXT example.com +short | grep workos-verification

# 3. Verify token matches
# Compare dig output with domain.verification_token from API
```

Fix:
1. Ensure TXT record value exactly matches `verification_token` (no extra quotes or spaces)
2. Try triggering verification after 10-15 minutes
3. Check with domain registrar's DNS checker tool

### Portal link expired

**Root cause:** Portal links expire after 5 minutes.

Fix:
1. Generate fresh portal link on-demand, never cache
2. Add timestamp check before redirecting: `if (Date.now() - linkCreatedAt > 4 * 60 * 1000) { regenerate }`

### "domain_verification intent not allowed"

**Root cause:** Organization doesn't have Domain Verification enabled in WorkOS settings.

Fix:
1. Go to WorkOS Dashboard → Organizations
2. Check organization settings allow Domain Verification
3. Contact WorkOS support if feature not available for your account tier

## Related Skills

- **workos-organizations**: Must create organizations before domains
- **workos-sso**: SSO connections require verified domains
- **workos-directory-sync**: Directory Sync requires verified domains
- **workos-admin-portal**: Domain Verification uses Admin Portal UI
