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

## API Overview

The Admin Portal API provides a single primary endpoint for generating portal links that allow your users to configure SSO, Directory Sync, and other integrations through WorkOS's hosted UI.

## Authentication Setup

All requests require authentication via API key in the `Authorization` header:

```bash
Authorization: Bearer sk_test_1234567890abcdef
```

Your API key must start with `sk_test_` (test) or `sk_live_` (production).

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal/generate_link` | Generate a one-time portal link for an organization |
| GET | `/portal/provider_icons` | Retrieve available SSO provider icons |

## Operation Decision Tree

**Goal: Let user configure SSO/Directory Sync**
→ Call `POST /portal/generate_link` with `organization` and `intent`

**Goal: Display provider logos in your UI**
→ Call `GET /portal/provider_icons` to get icon URLs

**Goal: Deep link to specific configuration**
→ Use `intent` parameter: `sso`, `dsync`, `audit_logs`, or `log_streams`

**Goal: Return user to your app after configuration**
→ Set `return_url` parameter in generate request

## Core Endpoint: Generate Portal Link

### Request Pattern

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01H1234567890ABCDEFGHIJK",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization` | string | Yes | WorkOS organization ID (starts with `org_`) |
| `intent` | string | Yes | Portal section: `sso`, `dsync`, `audit_logs`, `log_streams` |
| `return_url` | string | No | URL to redirect after user completes configuration |
| `success_url` | string | No | URL to redirect on successful save |

### Response Pattern

```json
{
  "link": "https://id.workos.com/portal/launch?token=Z1uX3RbwcIl5fIGJJJCXXisdI"
}
```

The `link` field contains a single-use URL valid for 5 minutes. Redirect the user to this URL.

### SDK Example (Node.js)

```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const { link } = await workos.portal.generateLink({
  organization: 'org_01H1234567890ABCDEFGHIJK',
  intent: 'sso',
  returnUrl: 'https://yourapp.com/settings'
});

// Redirect user to `link`
res.redirect(link);
```

## Provider Icons Endpoint

### Request Pattern

```bash
curl https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

### Response Pattern

```json
[
  {
    "provider": "GoogleOAuth",
    "icon_url": "https://workos.com/icons/google.svg"
  },
  {
    "provider": "OktaSAML",
    "icon_url": "https://workos.com/icons/okta.svg"
  }
]
```

Use these URLs to display provider logos in your connection UI.

## Error Codes and Resolution

| Status | Error Code | Cause | Fix |
|--------|------------|-------|-----|
| 401 | `unauthorized` | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and has Admin Portal scope |
| 404 | `organization_not_found` | Organization ID doesn't exist | Confirm organization was created via Organizations API |
| 422 | `invalid_intent` | Intent value not recognized | Use one of: `sso`, `dsync`, `audit_logs`, `log_streams` |
| 422 | `invalid_url` | `return_url` malformed | Ensure URL is absolute with valid scheme (https://) |
| 429 | `rate_limit_exceeded` | Too many requests | Implement exponential backoff, wait 60 seconds |

### Common Error: Organization Not Found

**Cause:** The organization ID provided doesn't exist in your WorkOS environment.

**Fix:**
1. Verify organization exists: `GET https://api.workos.com/organizations/:id`
2. If missing, create it via Organizations API first
3. Ensure you're using the production API key for production organizations

## Rate Limiting

- Portal link generation: 100 requests/minute per API key
- Provider icons: 1000 requests/minute (this is cacheable content)

**Retry Strategy:**
1. Catch 429 responses
2. Read `Retry-After` header (seconds)
3. Wait specified time before retry
4. Implement exponential backoff for subsequent failures

## Implementation Patterns

### Basic Flow: Add SSO to Organization

```javascript
// 1. Create organization (if new)
const org = await workos.organizations.createOrganization({
  name: 'Acme Corporation',
  domains: ['acme.com']
});

// 2. Generate portal link
const { link } = await workos.portal.generateLink({
  organization: org.id,
  intent: 'sso',
  returnUrl: 'https://yourapp.com/admin/integrations'
});

// 3. Redirect user
res.redirect(link);

// 4. User configures SSO in portal
// 5. User returns to your returnUrl
// 6. Connection is now active
```

### Security Considerations

- **Never expose portal links in client-side code** — generate server-side only
- **Links expire after 5 minutes** — generate on-demand, don't pre-generate
- **Links are single-use** — user must complete flow or get new link
- **Validate return_url domain** — ensure it matches your application domains

## Verification Commands

### Test Link Generation (Bash)

```bash
# Replace with your values
ORG_ID="org_01H1234567890ABCDEFGHIJK"
API_KEY="sk_test_yourkeyhere"

RESPONSE=$(curl -s -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization\": \"${ORG_ID}\",
    \"intent\": \"sso\"
  }")

echo $RESPONSE | jq -r '.link'
# Should output: https://id.workos.com/portal/launch?token=...
```

### Test Provider Icons (Bash)

```bash
curl -s https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer ${API_KEY}" \
  | jq '.[0]'
# Should output first provider icon object
```

### Test with WorkOS CLI

```bash
workos portal generate-link \
  --organization org_01H1234567890ABCDEFGHIJK \
  --intent sso
```

## Integration Checklist

- [ ] API key configured with Admin Portal scope enabled
- [ ] Organization exists in WorkOS (create via Organizations API if needed)
- [ ] Portal link generated successfully returns `https://id.workos.com/portal/launch?token=...`
- [ ] Link expires after 5 minutes as expected
- [ ] User can access portal and see configuration UI
- [ ] `return_url` redirects user back to your app after save
- [ ] Error handling catches 401, 404, 422 with specific messages
- [ ] Rate limit retry logic implemented for 429 responses

## Related Skills

- workos-admin-portal — Feature overview and configuration workflows
- workos-api-organization — Creating and managing organizations
- workos-api-sso — SSO connection setup and authentication
- workos-api-directory-sync — Directory Sync connection management
