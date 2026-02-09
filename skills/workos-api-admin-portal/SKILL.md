---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Authentication Setup

All API requests require authentication via API key in the Authorization header:

```bash
Authorization: Bearer sk_test_your_api_key
```

Get your API key from the WorkOS Dashboard under API Keys. Use `sk_test_*` keys for development and `sk_live_*` keys for production.

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/portal_links` | Generate a one-time Admin Portal link |
| GET | `/provider_icons/:provider` | Retrieve provider logo/icon URLs |

## Core Operations

### Generate Portal Link

**When to use:** Create a secure, one-time URL that directs an organization admin to their WorkOS Admin Portal session.

**Endpoint:** `POST https://api.workos.com/portal_links`

**Required parameters:**
- `organization` (string) — Organization ID (starts with `org_`)
- `intent` (string) — Portal intent: `sso`, `dsync`, `audit_logs`, or `log_streams`

**Optional parameters:**
- `return_url` (string) — Where to redirect after the admin completes setup
- `success_url` (string) — Override for successful completion redirects

**Request example:**

```bash
curl https://api.workos.com/portal_links \
  -X POST \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

**Response example:**

```json
{
  "link": "https://id.workos.com/portal/launch?secret=abc123...",
  "object": "portal_link"
}
```

**Link behavior:**
- Valid for 5 minutes after generation
- Single-use only — generates 403 error if reused
- Expires automatically if not accessed

### Retrieve Provider Icons

**When to use:** Display identity provider logos in your UI before users configure SSO.

**Endpoint:** `GET https://api.workos.com/provider_icons/:provider`

**Path parameter:**
- `provider` (string) — Provider slug (e.g., `GoogleOAuth`, `OktaSAML`, `AzureSAML`)

**Request example:**

```bash
curl https://api.workos.com/provider_icons/GoogleOAuth \
  -H "Authorization: Bearer sk_test_your_api_key"
```

**Response example:**

```json
{
  "object": "provider_icon",
  "provider": "GoogleOAuth",
  "icon_url": "https://cdn.workos.com/icons/google.svg"
}
```

## Operation Decision Tree

```
Need to let org admin configure SSO/Directory Sync?
├─ YES → POST /portal_links with intent=sso or intent=dsync
│         - Returns one-time link valid for 5 minutes
│         - Redirect admin to the link immediately
│
└─ NO → Are you showing provider selection UI?
          ├─ YES → GET /provider_icons/:provider for each provider
          │         - Use icon_url in your UI
          │
          └─ NO → Not an Admin Portal API use case
```

## Error Handling

### HTTP 401 Unauthorized

**Cause:** Invalid or missing API key

**Fix:**
- Verify `Authorization: Bearer sk_test_...` header is present
- Check API key starts with `sk_test_` or `sk_live_`
- Confirm key is active in WorkOS Dashboard → API Keys

### HTTP 403 Forbidden

**Cause:** Portal link already used or expired

**Fix:**
- Generate a new portal link with `POST /portal_links`
- Do not cache or reuse portal links
- Ensure user clicks link within 5 minutes of generation

### HTTP 404 Not Found

**Cause:** Invalid organization ID or provider slug

**Fix:**
- Verify organization ID starts with `org_` and exists in your WorkOS account
- Check provider slug matches supported values (fetch from docs)
- Use exact provider slugs (case-sensitive)

### HTTP 422 Unprocessable Entity

**Cause:** Invalid `intent` parameter or missing required fields

**Fix:**
- Ensure `intent` is one of: `sso`, `dsync`, `audit_logs`, `log_streams`
- Verify `organization` parameter is included
- Check JSON payload is well-formed

### HTTP 429 Too Many Requests

**Cause:** Rate limit exceeded

**Fix:**
- Implement exponential backoff (start with 1s delay, double each retry)
- Cache portal links briefly if generating for the same org
- Contact WorkOS Support if limits are too restrictive for your use case

## SDK Usage Patterns

**Node.js:**

```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate portal link
const { link } = await workos.portal.generateLink({
  organization: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
  intent: 'sso',
  returnUrl: 'https://yourapp.com/settings',
});

// Redirect user immediately
res.redirect(link);
```

**Python:**

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Generate portal link
portal_link = workos.portal.generate_link(
    organization='org_01EHQMYV6MBK39QC5PZXHY59C3',
    intent='sso',
    return_url='https://yourapp.com/settings',
)

# Redirect user immediately
return redirect(portal_link['link'])
```

**Ruby:**

```ruby
require 'workos'

WorkOS.key = ENV['WORKOS_API_KEY']

# Generate portal link
portal_link = WorkOS::Portal.generate_link(
  organization: 'org_01EHQMYV6MBK39QC5PZXHY59C3',
  intent: 'sso',
  return_url: 'https://yourapp.com/settings'
)

# Redirect user immediately
redirect_to portal_link.link
```

## Verification Commands

**Test API key validity:**

```bash
curl https://api.workos.com/portal_links \
  -X POST \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "intent": "sso"
  }'
```

Expected: 200 OK with `link` in response. If 401, API key is invalid.

**Test provider icons endpoint:**

```bash
curl https://api.workos.com/provider_icons/GoogleOAuth \
  -H "Authorization: Bearer sk_test_your_api_key"
```

Expected: 200 OK with `icon_url` in response.

**Test portal link expiration:**

1. Generate a link with the POST command above
2. Wait 6 minutes
3. Access the link in a browser
4. Expected: 403 Forbidden error page

**Test single-use enforcement:**

1. Generate a link with the POST command above
2. Access the link in a browser (completes successfully)
3. Access the same link again
4. Expected: 403 Forbidden error page

## Rate Limits

The Admin Portal API does not publish explicit rate limits. Implement standard retry logic:

- First retry: Wait 1 second
- Second retry: Wait 2 seconds
- Third retry: Wait 4 seconds
- Fourth retry: Wait 8 seconds
- Fifth retry: Fail and alert

Monitor for HTTP 429 responses. If you receive rate limit errors consistently, contact WorkOS Support to discuss your use case.

## Pagination

The Admin Portal API endpoints do not return paginated results:

- `POST /portal_links` returns a single link object
- `GET /provider_icons/:provider` returns a single icon object

No pagination handling is required.

## Related Skills

- `workos-feature-admin-portal` — Overview of Admin Portal capabilities and when to use it
- `workos-api-sso` — SSO authentication endpoints referenced after portal configuration
- `workos-api-directory-sync` — Directory Sync endpoints referenced after portal configuration
