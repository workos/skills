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

Use the Widgets API when you need to:

- Generate time-limited tokens for embedded WorkOS UI components
- Integrate pre-built authentication or user management interfaces
- Provide users with self-service access to WorkOS features

The Widgets API consists of a single endpoint that generates short-lived access tokens. These tokens authenticate users to WorkOS-hosted widget interfaces.

## Available Endpoints

| Method | Path             | Purpose                        |
| ------ | ---------------- | ------------------------------ |
| POST   | `/widgets/token` | Generate a widget access token |

## Authentication Setup

All Widgets API requests require authentication via API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

- Use your **secret API key** (starts with `sk_`)
- Never expose this key in client-side code
- Generate tokens on your backend, then pass them to the frontend

## Request Pattern

### Generate Widget Token

**Endpoint:** `POST https://api.workos.com/widgets/token`

**Headers:**

```
Authorization: Bearer sk_your_api_key_here
Content-Type: application/json
```

**Request body:**

```json
{
  "widget": "widget_type",
  "organization_id": "org_01H9...",
  "user_id": "user_01H9...",
  "session_expiry": 3600
}
```

**Parameters:**

- `widget` (required): The widget type identifier from WorkOS Dashboard
- `organization_id` (optional): Scope token to specific organization
- `user_id` (optional): Associate token with a specific user
- `session_expiry` (optional): Token lifetime in seconds (default: 3600, max: 86400)

**Response (200 OK):**

```json
{
  "token": "wgt_01H9QZ...",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

## SDK Usage

### Node.js

```javascript
const { WorkOS } = require("@workos-inc/node");
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate token
const { token } = await workos.widgets.getToken({
  widget: "sso_setup",
  organizationId: "org_01H9...",
  userId: "user_01H9...",
});

// Pass token to frontend
res.json({ widgetToken: token });
```

### Python

```python
from workos import WorkOSClient
workos = WorkOSClient(api_key=os.environ['WORKOS_API_KEY'])

# Generate token
response = workos.widgets.get_token(
    widget='sso_setup',
    organization_id='org_01H9...',
    user_id='user_01H9...'
)

# Pass token to frontend
return jsonify({'widget_token': response['token']})
```

## Operation Decision Tree

**Which endpoint do I use?**

- There is only one endpoint: `POST /widgets/token`

**When should I generate a new token?**

- Every time a user needs to access a widget interface
- When the previous token has expired
- When switching between different widget types or organizations

**Should I cache tokens?**

- NO. Generate a fresh token for each widget session
- Tokens are short-lived and cannot be refreshed
- The API call is lightweight — performance is not a concern

## Error Handling

### HTTP Status Codes

| Code | Meaning              | Cause                                            | Fix                                                                  |
| ---- | -------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| 401  | Unauthorized         | Invalid or missing API key                       | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 400  | Bad Request          | Invalid `widget` type or malformed request body  | Check widget type exists in Dashboard; validate JSON structure       |
| 404  | Not Found            | `organization_id` or `user_id` does not exist    | Verify IDs exist in WorkOS; use valid entity identifiers             |
| 422  | Unprocessable Entity | `session_expiry` exceeds maximum (86400 seconds) | Reduce `session_expiry` to ≤24 hours                                 |
| 429  | Rate Limited         | Too many requests in short time                  | Implement exponential backoff; avoid generating tokens in loops      |
| 500  | Server Error         | WorkOS internal error                            | Retry with exponential backoff; contact support if persistent        |

### Common Error Patterns

**"Invalid widget type"**

- Cause: The `widget` parameter doesn't match any widget configured in your Dashboard
- Fix: Check the exact widget identifier in WorkOS Dashboard → Widgets section

**"Organization not found"**

- Cause: The `organization_id` doesn't exist or belongs to a different WorkOS environment
- Fix: Verify you're using the correct API key (dev vs prod) and the organization exists

**Token expired on frontend**

- Cause: Token TTL elapsed before user opened widget
- Fix: Generate token immediately before rendering widget UI; reduce time between token generation and widget display

## Runnable Verification

### Test token generation with curl:

```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "widget": "sso_setup",
    "organization_id": "org_01H9...",
    "session_expiry": 1800
  }'
```

**Expected response:**

```json
{
  "token": "wgt_01H9QZ...",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

### Integration verification checklist:

- [ ] Backend endpoint generates token successfully
- [ ] Token is passed to frontend without exposure in URLs
- [ ] Widget loads using the generated token
- [ ] Token expiration triggers new token generation
- [ ] Error responses return actionable messages to client

## Rate Limiting

- Standard WorkOS rate limits apply (contact support for specific limits)
- Token generation is not metered separately
- Avoid generating tokens in tight loops or during page load sequences
- Generate tokens on-demand when user clicks "Configure SSO" or similar actions

## Security Best Practices

1. **Never expose secret API key to frontend** — token generation must happen server-side
2. **Generate tokens just-in-time** — don't pre-generate tokens for future use
3. **Use shortest acceptable TTL** — default 1 hour is reasonable; reduce if workflow is shorter
4. **Scope tokens to specific entities** — always include `organization_id` or `user_id` when applicable
5. **Validate user permissions** — check user has permission to access the widget before generating token

## Related Skills

- workos-authkit-base — Core authentication implementation
- workos-directory-sync.rules.yml — Directory sync feature implementation
