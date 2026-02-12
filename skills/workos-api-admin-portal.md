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

Authenticate all Admin Portal API requests using your WorkOS API key in the `Authorization` header:

```bash
Authorization: Bearer sk_live_your_api_key_here
```

Your API key starts with `sk_test_` (development) or `sk_live_` (production).

## Endpoint Catalog

| Method | Path                     | Purpose                                       |
| ------ | ------------------------ | --------------------------------------------- |
| POST   | `/portal/generate_link`  | Generate a one-time Admin Portal session link |
| GET    | `/portal/provider_icons` | Fetch available identity provider icons       |

## Operation Decision Tree

**Generate Admin Portal Link:**

- POST `/portal/generate_link` — creates a temporary authenticated URL for organization admins to configure SSO, Directory Sync, or SCIM settings
- Use `intent` parameter to control which feature appears (sso, dsync, audit_logs, log_streams)
- Use `organization` or `organization_id` to specify target organization
- Links expire after use or timeout (check docs for TTL)

**Fetch Provider Icons:**

- GET `/portal/provider_icons` — retrieves icon URLs for all supported identity providers
- Use for custom UI that displays provider options before redirect
- No authentication required for this endpoint

## Request/Response Patterns

### Generate Portal Link

**Request:**

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHWNCE74X7JSDV0X3SZ3KJNY",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

**Response (200 OK):**

```json
{
  "link": "https://id.workos.com/portal/launch?token=Z1uX3RbwcIl5fIGJJJCXXisdI"
}
```

**Intent Options:**

- `sso` — SSO configuration portal
- `dsync` — Directory Sync setup
- `audit_logs` — Audit log stream configuration
- `log_streams` — Log stream destination setup

### Fetch Provider Icons

**Request:**

```bash
curl https://api.workos.com/portal/provider_icons \
  -H "Content-Type: application/json"
```

**Response (200 OK):**

```json
[
  {
    "provider": "GoogleOAuth",
    "icon": "https://workos.com/icons/google.svg"
  },
  {
    "provider": "MicrosoftOAuth",
    "icon": "https://workos.com/icons/microsoft.svg"
  }
]
```

## SDK Usage Patterns

### Node.js

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate portal link
const { link } = await workos.portal.generateLink({
  organization: "org_01EHWNCE74X7JSDV0X3SZ3KJNY",
  intent: "sso",
  returnUrl: "https://yourapp.com/settings",
});

// Redirect user to the portal
res.redirect(link);
```

### Python

```python
from workos import WorkOSClient

workos = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Generate portal link
portal_link = workos.portal.generate_link(
    organization='org_01EHWNCE74X7JSDV0X3SZ3KJNY',
    intent='sso',
    return_url='https://yourapp.com/settings'
)

# Redirect user to portal_link['link']
```

## Error Code Mapping

| Status Code              | Cause                                                   | Fix                                                                  |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 401 Unauthorized         | Missing or invalid API key                              | Verify `WORKOS_API_KEY` starts with `sk_` and is active in dashboard |
| 404 Not Found            | Organization ID doesn't exist                           | Confirm organization was created via `/organizations` endpoint       |
| 422 Unprocessable Entity | Invalid `intent` parameter                              | Use only: `sso`, `dsync`, `audit_logs`, `log_streams`                |
| 422 Unprocessable Entity | Missing required field (`organization` or `return_url`) | Include both `organization` and `return_url` in request body         |
| 429 Too Many Requests    | Rate limit exceeded                                     | Implement exponential backoff, check rate limit headers              |

**Common validation errors:**

- `return_url` must be a valid HTTPS URL
- `organization` accepts either `org_id` string or full organization object
- `intent` is case-sensitive lowercase

## Rate Limits

- Standard rate limit: 600 requests per minute per API key
- Portal link generation is not paginated (one link per request)
- Check `X-RateLimit-Remaining` response header before burst operations

## Runnable Verification

**Verify API key works:**

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_test_id",
    "intent": "sso",
    "return_url": "https://example.com"
  }'
```

Expected: 200 response with `{"link": "https://..."}` or 404 if `org_test_id` doesn't exist.

**Verify provider icons endpoint:**

```bash
curl https://api.workos.com/portal/provider_icons
```

Expected: 200 response with array of provider objects containing `provider` and `icon` fields.

## Integration Checklist

- [ ] API key stored securely in environment variables
- [ ] Portal link generation endpoint protected by authentication
- [ ] `return_url` points to your application's settings page
- [ ] User is redirected to `link` URL after generation
- [ ] Error responses display user-friendly messages (not raw API errors)
- [ ] Portal links are generated on-demand (not cached)
- [ ] Link expiration is communicated to users

## Related Skills

- workos-authkit-base — AuthKit integration patterns
- workos-directory-sync.rules.yml — Directory Sync configuration details
