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

## When to Use This API

Use the Widgets API to generate short-lived tokens for embedding WorkOS UI widgets (User Management, Organization settings, etc.) in your application. This is NOT for backend-to-backend API calls — it's for client-side widget rendering.

## Authentication

All Widgets API calls require your WorkOS API key in the `Authorization` header:

```
Authorization: Bearer sk_live_your_api_key_here
```

Your API key (`WORKOS_API_KEY`) must start with `sk_live_` (production) or `sk_test_` (development).

## Endpoint Catalog

| Method | Path             | Purpose                                     |
| ------ | ---------------- | ------------------------------------------- |
| POST   | `/widgets/token` | Generate a widget token for a specific user |

This is a **thin API** — it exists solely to generate tokens. The actual widget rendering happens client-side using the token.

## Core Operation: Generate Widget Token

**Endpoint:** `POST https://api.workos.com/widgets/token`

**Request Body:**

```json
{
  "user_id": "user_01H7ZGXBM9N85QY9Z8QXXXXX",
  "organization_id": "org_01H7ZGXBM9N85QY9Z8QXXXXX"
}
```

**Required Parameters:**

- `user_id` — the WorkOS User Management user ID
- `organization_id` — the WorkOS organization ID (required for org-scoped widgets)

**Response (200 OK):**

```json
{
  "token": "wid_token_abc123xyz...",
  "expires_at": 1234567890
}
```

The token is valid for **15 minutes** by default. Use it immediately to initialize a widget.

## Request/Response Patterns

### SDK Usage (Node.js)

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const token = await workos.widgets.getToken({
  userId: "user_01H7ZGXBM9N85QY9Z8QXXXXX",
  organizationId: "org_01H7ZGXBM9N85QY9Z8QXXXXX",
});

// Pass token.token to your frontend
```

### cURL Verification

```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7ZGXBM9N85QY9Z8QXXXXX",
    "organization_id": "org_01H7ZGXBM9N85QY9Z8QXXXXX"
  }'
```

Expected output:

```json
{
  "token": "wid_token_...",
  "expires_at": 1234567890
}
```

## Error Codes and Fixes

| Status | Cause                          | Fix                                                                                  |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| 401    | Invalid or missing API key     | Verify `WORKOS_API_KEY` starts with `sk_live_` or `sk_test_` and exists in dashboard |
| 403    | API key lacks permissions      | Check API key has "Widgets" scope enabled in WorkOS Dashboard                        |
| 404    | User or organization not found | Verify `user_id` and `organization_id` exist in User Management                      |
| 422    | Missing required fields        | Ensure both `user_id` and `organization_id` are present in request                   |
| 429    | Rate limit exceeded            | Implement exponential backoff (start with 1s delay, double on each retry)            |
| 500    | WorkOS service error           | Retry with exponential backoff (max 3 attempts)                                      |

## Token Lifecycle

1. **Generate token** — Call `POST /widgets/token` from your backend
2. **Pass to frontend** — Send token to client via secure channel (e.g., session cookie, authenticated API response)
3. **Initialize widget** — Use token with WorkOS widget library before expiration
4. **Token expires** — After 15 minutes (or when user logs out), generate a new token

**Do NOT:**

- Store tokens in localStorage or cookies — they're short-lived and user-specific
- Reuse tokens across users — each user needs their own token
- Generate tokens client-side — this exposes your API key

## Rate Limits

- **Default limit:** 600 requests per minute per API key
- **Recommended pattern:** Generate tokens on-demand when users navigate to widget pages, NOT on every page load
- **Retry strategy:** If you hit 429, wait 60 seconds before retrying (rate limits reset per minute)

## Integration Pattern

### Backend Endpoint

```javascript
// Example: Express.js route
app.post("/api/widget-token", authenticateUser, async (req, res) => {
  try {
    const token = await workos.widgets.getToken({
      userId: req.user.workosId,
      organizationId: req.user.organizationId,
    });
    res.json({ token: token.token, expiresAt: token.expires_at });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: "User or organization not found" });
    }
    if (error.status === 429) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded, try again in 60s" });
    }
    res.status(500).json({ error: "Failed to generate widget token" });
  }
});
```

### Frontend Usage

```javascript
// Fetch token from your backend
const response = await fetch("/api/widget-token", {
  method: "POST",
  credentials: "include", // include session cookie
});
const { token } = await response.json();

// Initialize widget with token (see workos-authkit-* skills for widget setup)
```

## Verification Checklist

- [ ] API key is stored in environment variable (NOT hardcoded)
- [ ] Token generation endpoint is behind authentication
- [ ] Tokens are generated server-side, not client-side
- [ ] Error responses include specific status codes (not generic 500)
- [ ] Rate limit errors trigger exponential backoff
- [ ] Tokens are NOT stored in localStorage/sessionStorage
- [ ] Widget initialization uses fresh tokens (not expired ones)

## Related Skills

- workos-authkit-react — how to use widget tokens with React components
- workos-authkit-nextjs — Next.js-specific widget integration patterns
- workos-authkit-vanilla-js — vanilla JavaScript widget setup
