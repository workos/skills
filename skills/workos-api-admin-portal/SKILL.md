---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- generated -->

# WorkOS Admin Portal API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Authentication Setup

All Admin Portal API requests require authentication via API key in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key_here
```

Get your API key from the WorkOS Dashboard under API Keys. Use test keys (`sk_test_`) for development and live keys (`sk_live_`) for production.

## Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/portal_links` | Generate a one-time portal link for an organization |
| GET | `/portal_links/provider_icons` | Retrieve provider icon URLs for UI customization |

## Operation Decision Tree

**Need to give admins SSO/Directory Sync access?**
- Call `POST /portal_links` with organization ID and intent

**Need provider logos for custom UI?**
- Call `GET /portal_links/provider_icons` to get icon URLs

**Need to revoke portal access?**
- Portal links expire automatically after use or timeout (default 5 minutes)

## Generate Portal Link

### Request Pattern

```bash
curl https://api.workos.com/portal_links \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization` | string | Yes | Organization ID (starts with `org_`) |
| `intent` | string | Yes | Portal purpose: `sso`, `dsync`, or `audit_logs` |
| `return_url` | string | No | Redirect URL after portal session ends |
| `success_url` | string | No | Redirect URL after successful configuration |

### Response Pattern

```json
{
  "object": "portal_link",
  "id": "portal_link_01E4ZCR3C56J083X43JQXF3JK5",
  "link": "https://id.workos.com/portal/launch?secret=...",
  "organization_id": "org_01EHQMYV6MBK39QC5PZXHY59C3",
  "intent": "sso",
  "created_at": "2024-01-15T09:30:00.000Z",
  "expires_at": "2024-01-15T09:35:00.000Z"
}
```

### Intent-Specific Behavior

**`sso` intent:**
- Admins configure SAML/OIDC providers
- Allows connection testing
- Manages SSO domains

**`dsync` intent:**
- Admins set up Directory Sync
- Configure directory providers (Okta, Azure AD, Google Workspace)
- Map user attributes

**`audit_logs` intent:**
- Admins configure Audit Log streaming
- Set up webhook destinations
- Test log delivery

## Get Provider Icons

### Request Pattern

```bash
curl https://api.workos.com/portal_links/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Response Pattern

```json
[
  {
    "provider": "GoogleOAuth",
    "icon_url": "https://assets.workos.com/providers/google.svg"
  },
  {
    "provider": "OktaSAML",
    "icon_url": "https://assets.workos.com/providers/okta.svg"
  }
]
```

Use these URLs to display provider logos in your application's settings UI.

## Error Handling

### HTTP 400 - Bad Request

**Cause:** Invalid organization ID format
**Fix:** Ensure organization ID starts with `org_` prefix

**Cause:** Invalid intent value
**Fix:** Use only `sso`, `dsync`, or `audit_logs`

**Cause:** Invalid URL format in return_url/success_url
**Fix:** Provide fully qualified HTTPS URLs

### HTTP 401 - Unauthorized

**Cause:** Missing or invalid API key
**Fix:** Verify Authorization header contains `Bearer sk_test_...` or `Bearer sk_live_...`

**Cause:** API key revoked or expired
**Fix:** Generate new API key in WorkOS Dashboard

### HTTP 404 - Not Found

**Cause:** Organization ID does not exist
**Fix:** Verify organization exists using List Organizations endpoint

### HTTP 429 - Rate Limit Exceeded

**Cause:** Too many portal link generations in short time window
**Fix:** Implement exponential backoff with 1s initial delay

WorkOS rate limits: 100 requests per 10 seconds per API key

## Portal Link Lifecycle

1. **Generation:** Link is valid immediately after creation
2. **Expiration:** Default 5 minutes (300 seconds) from creation
3. **Single-Use:** Link becomes invalid after first use
4. **Return Flow:** User redirects to `return_url` or `success_url` when done

**Security Note:** Portal links grant admin-level access. Never expose them in client-side code or logs. Generate them server-side on-demand.

## Verification Commands

### Test Portal Link Generation

```bash
# Set your API key
export WORKOS_API_KEY="sk_test_your_key_here"

# Generate a portal link
curl -X POST https://api.workos.com/portal_links \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "intent": "sso"
  }' | jq .

# Expected: 200 status with portal_link object containing "link" field
```

### Test Provider Icons Retrieval

```bash
curl https://api.workos.com/portal_links/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq .

# Expected: 200 status with array of provider icon objects
```

### SDK Verification (Node.js)

```javascript
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function testPortalLink() {
  const portalLink = await workos.portal.generateLink({
    organization: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
    intent: 'sso',
  });
  
  console.log('Portal Link:', portalLink.link);
  console.log('Expires At:', portalLink.expires_at);
}

testPortalLink().catch(console.error);
```

## Common Integration Patterns

### Pattern 1: On-Demand Portal Access

```javascript
app.post('/api/generate-portal-link', async (req, res) => {
  const { organizationId } = req.body;
  
  const portalLink = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'sso',
    return_url: `https://yourapp.com/settings?org=${organizationId}`,
  });
  
  res.json({ link: portalLink.link });
});
```

### Pattern 2: Embedded Portal Button

```javascript
async function launchAdminPortal(organizationId) {
  const response = await fetch('/api/generate-portal-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId }),
  });
  
  const { link } = await response.json();
  window.location.href = link;
}
```

### Pattern 3: Multi-Intent Portal Menu

```javascript
function showPortalMenu(organizationId) {
  return [
    { label: 'Configure SSO', intent: 'sso' },
    { label: 'Set Up Directory Sync', intent: 'dsync' },
    { label: 'Configure Audit Logs', intent: 'audit_logs' },
  ].map(item => ({
    ...item,
    action: () => generateAndRedirect(organizationId, item.intent),
  }));
}
```

## Best Practices

1. **Generate links server-side only** — Never expose API keys to client applications
2. **Set return URLs** — Guide users back to your app after portal session
3. **Handle expiration** — Links expire after 5 minutes; regenerate if user returns later
4. **Log portal access** — Track when admins access portal for audit trails
5. **Validate organization ownership** — Verify requesting user belongs to organization before generating link
6. **Use intent-specific success URLs** — Redirect users to relevant settings page after configuration
7. **Cache provider icons** — Icons change rarely; cache them to reduce API calls

## Related Skills

- `workos-feature-admin-portal` — Feature overview and integration patterns
- `workos-api-sso` — SSO API reference for user authentication
- `workos-api-directory-sync` — Directory Sync API reference
