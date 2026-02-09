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

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/portal_links` | Generate a portal link for an organization |
| GET | `/provider_icons` | Retrieve available SSO provider icons |

## Authentication

All Admin Portal API requests require authentication via API key header:

```http
Authorization: Bearer sk_example_123456789
```

Set your API key from the WorkOS Dashboard. The key must start with `sk_` prefix.

## Operation Decision Tree

**When to use which endpoint:**

- **Generate portal link** → POST `/portal_links` — Create a short-lived URL for organization admins to configure SSO, Directory Sync, or Audit Logs
- **Get provider icons** → GET `/provider_icons` — Fetch icon URLs for SSO providers (Okta, Google, Microsoft, etc.) to display in your UI

## Core Operations

### Generate Portal Link

**Endpoint:** `POST https://api.workos.com/portal_links`

**Required parameters:**
- `organization` (string) — Organization ID (starts with `org_`)
- `intent` (string) — One of: `sso`, `dsync`, `audit_logs`, or `log_streams`

**Optional parameters:**
- `return_url` (string) — Redirect URL after portal session
- `success_url` (string) — Redirect URL after successful configuration

**Request example:**

```bash
curl -X POST https://api.workos.com/portal_links \
  -H "Authorization: Bearer sk_example_123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHWNCE74X7JSDV0X3SZ3KJNY",
    "intent": "sso",
    "return_url": "https://example.com/settings"
  }'
```

**Response (200 OK):**

```json
{
  "object": "portal_link",
  "link": "https://id.workos.com/portal/launch?secret=abc123...",
  "expires_at": "2024-01-15T12:00:00.000Z"
}
```

**Response fields:**
- `link` (string) — The portal URL to redirect the organization admin to
- `expires_at` (string) — ISO 8601 timestamp when the link expires (default: 10 minutes)

### Get Provider Icons

**Endpoint:** `GET https://api.workos.com/provider_icons`

**No parameters required.**

**Request example:**

```bash
curl https://api.workos.com/provider_icons \
  -H "Authorization: Bearer sk_example_123456789"
```

**Response (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "id": "okta",
      "name": "Okta",
      "icon_url": "https://workos.com/icons/okta.svg"
    },
    {
      "id": "google-saml",
      "name": "Google",
      "icon_url": "https://workos.com/icons/google.svg"
    }
  ]
}
```

## Error Handling

### HTTP Status Codes

| Code | Cause | Fix |
| ---- | ----- | --- |
| 400 | Invalid `intent` value | Use one of: `sso`, `dsync`, `audit_logs`, `log_streams` |
| 400 | Missing required `organization` parameter | Include valid organization ID (starts with `org_`) |
| 401 | Missing or invalid API key | Check `Authorization: Bearer sk_...` header is set correctly |
| 401 | API key lacks required permissions | Verify key permissions in WorkOS Dashboard |
| 404 | Organization ID not found | Confirm organization exists and ID is correct |
| 422 | Invalid organization ID format | Organization ID must start with `org_` |
| 429 | Rate limit exceeded | Wait and retry with exponential backoff (see rate limits below) |
| 500 | WorkOS server error | Retry request after brief delay |

### Error Response Format

```json
{
  "error": "invalid_request",
  "error_description": "The 'organization' parameter is required",
  "code": "invalid_request"
}
```

## Rate Limits

- **Standard tier:** 100 requests per minute per API key
- **Rate limit headers:** Check `X-RateLimit-Remaining` and `X-RateLimit-Reset` in responses
- **Retry strategy:** Use exponential backoff starting at 1 second

## Integration Patterns

### Pattern 1: Self-Service Configuration

1. User clicks "Configure SSO" in your settings UI
2. Your backend calls POST `/portal_links` with `intent=sso` and user's organization ID
3. Return the `link` to your frontend
4. Redirect user to the portal link
5. User completes SSO configuration in WorkOS Admin Portal
6. User is redirected back to your `return_url`

### Pattern 2: Provider Icon Display

1. Fetch provider icons once at application startup or cache them
2. Store icon URLs in your application state
3. Display provider icons in your SSO configuration UI
4. Match provider IDs returned from WorkOS SSO API to icon URLs

## Verification Commands

### Test Portal Link Generation

```bash
# Replace with your actual API key and organization ID
export WORKOS_API_KEY="sk_test_..."
export ORG_ID="org_01EHWNCE74X7JSDV0X3SZ3KJNY"

curl -X POST https://api.workos.com/portal_links \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization\": \"${ORG_ID}\",
    \"intent\": \"sso\",
    \"return_url\": \"https://example.com/settings\"
  }"

# Expected: JSON response with "link" field containing portal URL
```

### Test Provider Icons Fetch

```bash
curl https://api.workos.com/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Expected: JSON response with "data" array containing provider objects
```

### Verify Portal Link Works

1. Generate a portal link using the curl command above
2. Copy the `link` value from the response
3. Open the URL in a browser
4. Confirm the WorkOS Admin Portal loads (requires a valid organization)

## SDK Integration

### Node.js

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate portal link
const { link } = await workos.portal.generateLink({
  organization: 'org_01EHWNCE74X7JSDV0X3SZ3KJNY',
  intent: 'sso',
  returnUrl: 'https://example.com/settings',
});

console.log('Portal link:', link);
```

### Python

```python
from workos import WorkOS

workos = WorkOS(api_key=os.getenv('WORKOS_API_KEY'))

# Generate portal link
portal_link = workos.portal.generate_link(
    organization='org_01EHWNCE74X7JSDV0X3SZ3KJNY',
    intent='sso',
    return_url='https://example.com/settings'
)

print('Portal link:', portal_link.link)
```

### Ruby

```ruby
require 'workos'

WorkOS.key = ENV['WORKOS_API_KEY']

# Generate portal link
portal_link = WorkOS::Portal.generate_link(
  organization: 'org_01EHWNCE74X7JSDV0X3SZ3KJNY',
  intent: 'sso',
  return_url: 'https://example.com/settings'
)

puts "Portal link: #{portal_link.link}"
```

## Common Pitfalls

1. **Portal link expiration** — Links expire in 10 minutes. Generate them just-in-time when user clicks "Configure", not in advance.
2. **Wrong intent for feature** — Use `intent=dsync` for Directory Sync setup, not `sso`.
3. **Missing return_url** — Always provide a return URL so users can navigate back to your app after configuration.
4. **Hardcoded organization ID** — Generate portal links dynamically based on the authenticated user's organization.
5. **No link expiration handling** — Check `expires_at` and regenerate if link is stale before redirecting user.

## Related Skills

- **workos-admin-portal** — Feature overview and setup guide for Admin Portal
- **workos-api-sso** — SSO API reference for authentication flows
- **workos-api-directory-sync** — Directory Sync API reference for user provisioning
- **workos-api-audit-logs** — Audit Logs API reference for compliance events
- **workos-api-organization** — Organization management API reference
