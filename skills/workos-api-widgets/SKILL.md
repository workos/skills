---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## When to Use This Skill

Use this skill when you need to:
- Generate secure tokens for embedding WorkOS widgets in your application
- Implement admin portal widgets or user profile management
- Create time-limited access to WorkOS-hosted UI components

## Authentication Setup

All Widgets API calls require authentication via API key in the Authorization header:

```
Authorization: Bearer sk_live_your_api_key
```

- API keys start with `sk_test_` (development) or `sk_live_` (production)
- Obtain keys from WorkOS Dashboard → API Keys
- **NEVER** expose API keys in client-side code — call this API from your backend only

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/widgets/token` | Generate a secure token to embed a widget |

## Operation Decision Tree

**To embed a widget in your application:**
1. Call POST `/widgets/token` from your backend with user/organization context
2. Return the token to your frontend
3. Use the token to initialize the widget component

**Token expiration:**
- Tokens are single-use and expire after the session
- Generate a new token each time a user needs to access the widget

## Core Endpoint: Generate Widget Token

### Request Pattern

```
POST https://api.workos.com/widgets/token
Authorization: Bearer sk_live_your_api_key
Content-Type: application/json

{
  "organization_id": "org_01H1234567890ABCDEFGHIJK",
  "user_id": "user_01H1234567890ABCDEFGHIJK"
}
```

### Required Parameters

- `organization_id` (string) — ID of the organization this widget session is for
- `user_id` (string) — ID of the user accessing the widget

### Response Pattern

```json
{
  "token": "widget_token_01H1234567890ABCDEFGHIJK_abc123xyz",
  "expires_at": 1234567890
}
```

- `token` — Use this to initialize the widget in your frontend
- `expires_at` — Unix timestamp when the token expires

## Error Codes and Recovery

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `Authorization: Bearer sk_live_...` header is present and key is valid |
| 403 | API key lacks widget permissions | Check API key permissions in WorkOS Dashboard |
| 404 | `organization_id` or `user_id` not found | Verify IDs exist in your WorkOS environment |
| 422 | Missing required parameter | Ensure both `organization_id` and `user_id` are provided |
| 429 | Rate limit exceeded | Implement exponential backoff; default limit is 600 requests/minute per API key |
| 500 | WorkOS internal error | Retry with exponential backoff; check https://status.workos.com |

## Rate Limiting

- **Default limit:** 600 requests per minute per API key
- **Response header:** `X-RateLimit-Remaining` shows requests left in current window
- **On 429 error:** Wait 60 seconds before retrying or implement exponential backoff

## Verification Commands

### Test token generation (curl)

```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1234567890ABCDEFGHIJK",
    "user_id": "user_01H1234567890ABCDEFGHIJK"
  }'
```

**Expected response:** JSON with `token` and `expires_at` fields

### Test with Node.js SDK

WebFetch https://workos.com/docs/reference/widgets for current SDK method names and initialization patterns.

## Security Considerations

1. **Backend only** — Generate tokens server-side; never call this API from client JavaScript
2. **Single use** — Tokens expire after the widget session ends
3. **Short-lived** — Do not cache tokens; generate fresh tokens per user request
4. **Organization scoped** — Each token is tied to a specific organization and user

## Related Skills

- **workos-widgets** — Feature overview and integration patterns for widgets
- **workos-admin-portal** — Alternative approach for organization management UI
- **workos-api-organization** — Managing organizations programmatically
