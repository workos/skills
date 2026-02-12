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

## Endpoint Catalog

The Admin Portal API provides a single endpoint for generating portal links:

| Method | Endpoint                | Purpose                                                   |
| ------ | ----------------------- | --------------------------------------------------------- |
| POST   | `/portal-link/generate` | Generate a one-time Admin Portal link for an organization |

## Authentication

All Admin Portal API requests require API key authentication:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_live_...
```

## Core Operation: Generate Portal Link

### Request Pattern

**Endpoint:** `POST https://api.workos.com/portal/generate_link`

**Required Parameters:**

- `organization` (string) — Organization ID (format: `org_...`)
- `intent` (string) — Portal feature to access (see intent mapping below)

**Optional Parameters:**

- `return_url` (string) — URL to redirect after portal session ends
- `success_url` (string) — URL to redirect after successful configuration

### Intent Mapping

Choose the correct intent for the task:

| Intent        | Use Case                               |
| ------------- | -------------------------------------- |
| `sso`         | Configure SAML or OIDC SSO connections |
| `dsync`       | Configure Directory Sync connections   |
| `log_streams` | Configure log streaming endpoints      |
| `audit_logs`  | View audit log events                  |

### Request Example

```bash
curl https://api.workos.com/portal/generate_link \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01H7ZXG42KJ9Q8M7VQKFXZ3W9Y",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

### Response Pattern

```json
{
  "link": "https://id.workos.com/portal/launch?token=...",
  "object": "portal_link"
}
```

The `link` field contains a one-time URL valid for 5 minutes. Redirect the user to this URL to access the Admin Portal.

## SDK Integration

### Node.js

```javascript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const { link } = await workos.portal.generateLink({
  organization: "org_01H7ZXG42KJ9Q8M7VQKFXZ3W9Y",
  intent: "sso",
  returnUrl: "https://yourapp.com/settings",
});

// Redirect user to link
res.redirect(link);
```

### Python

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"))

portal_link = workos.portal.generate_link(
    organization="org_01H7ZXG42KJ9Q8M7VQKFXZ3W9Y",
    intent="sso",
    return_url="https://yourapp.com/settings"
)

# Redirect user to portal_link.link
```

### Ruby

```ruby
require 'workos'

WorkOS.key = ENV['WORKOS_API_KEY']

portal_link = WorkOS::Portal.generate_link(
  organization: 'org_01H7ZXG42KJ9Q8M7VQKFXZ3W9Y',
  intent: 'sso',
  return_url: 'https://yourapp.com/settings'
)

# Redirect user to portal_link.link
```

## Error Handling

### HTTP Status Codes

| Status | Cause                                  | Fix                                                           |
| ------ | -------------------------------------- | ------------------------------------------------------------- |
| 400    | Invalid intent value                   | Use one of: `sso`, `dsync`, `log_streams`, `audit_logs`       |
| 400    | Invalid organization ID format         | Ensure organization ID starts with `org_`                     |
| 401    | Invalid or missing API key             | Check `WORKOS_API_KEY` starts with `sk_` and is set correctly |
| 403    | API key lacks Admin Portal permissions | Verify key permissions in WorkOS Dashboard                    |
| 404    | Organization not found                 | Verify organization exists and ID is correct                  |
| 429    | Rate limit exceeded                    | Implement exponential backoff (initial delay 1s, max 32s)     |

### Error Response Format

```json
{
  "error": "invalid_intent",
  "error_description": "Intent must be one of: sso, dsync, log_streams, audit_logs",
  "code": "invalid_request"
}
```

## Provider Icons Endpoint

Retrieve SVG icons for identity providers to display in your UI.

**Endpoint:** `GET https://api.workos.com/portal/provider_icons/{provider}`

**Supported Providers:**

- `GoogleOAuth`
- `MicrosoftOAuth`
- `GitHubOAuth`
- `GenericSAML`
- (Fetch full list from docs)

**Example:**

```bash
curl https://api.workos.com/portal/provider_icons/GoogleOAuth \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Returns SVG content with `Content-Type: image/svg+xml`.

## Integration Flow

1. **User initiates portal access** — User clicks "Configure SSO" in your app
2. **Generate portal link** — Call `POST /portal/generate_link` with organization ID and intent
3. **Redirect user** — Redirect to the returned `link` URL
4. **User configures connection** — User completes setup in WorkOS Admin Portal
5. **User returns** — WorkOS redirects to your `return_url`
6. **Verify connection** — Use Directory Sync or SSO APIs to confirm connection is active

## Rate Limits

- Portal link generation: 100 requests/minute per API key
- Provider icons: 1000 requests/minute per API key

On rate limit (429), retry with exponential backoff:

```python
import time

def generate_with_retry(max_retries=3):
    for attempt in range(max_retries):
        try:
            return workos.portal.generate_link(...)
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
```

## Verification Commands

### Test API key validity

```bash
curl https://api.workos.com/portal/generate_link \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization": "org_test", "intent": "sso"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: 404 (organization not found) or 200 (if org_test exists). 401 means API key is invalid.

### Verify organization exists

```bash
# First, list organizations to get valid ID
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Then generate link with real org ID
curl https://api.workos.com/portal/generate_link \
  -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization": "org_YOUR_REAL_ID", "intent": "sso"}'
```

Expected: 200 with `link` field containing portal URL.

### Test provider icons

```bash
curl https://api.workos.com/portal/provider_icons/GoogleOAuth \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -o google-icon.svg

file google-icon.svg  # Should show: SVG Scalable Vector Graphics image
```

## Related Skills

- **workos-authkit-nextjs** — Implement authentication flow in Next.js apps
- **workos-authkit-react** — Add authentication to React applications
