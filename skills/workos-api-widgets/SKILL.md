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

Use this skill when you need to generate short-lived tokens for embedding WorkOS Widgets in your application UI. Widgets provide pre-built UI components for user authentication flows (signup, login, MFA setup).

**Common scenarios:**
- Embed WorkOS AuthKit widget in your frontend
- Generate tokens for user profile management widgets
- Create ephemeral access tokens for widget authentication

## Operation Decision Tree

```
Need to embed a widget?
│
├─ YES → Call POST /widgets/token
│         ├─ user_id provided? → Token scoped to specific user
│         └─ user_id omitted? → Token for new user signup flows
│
└─ NO → This API has only token generation. See workos-widgets for feature overview.
```

## Authentication Setup

All requests require HTTP Bearer authentication:

```bash
Authorization: Bearer <WORKOS_API_KEY>
```

Your API key must start with `sk_` (secret key) and have widgets permissions enabled in the WorkOS Dashboard.

## Endpoint Catalog

### POST /widgets/token

**Purpose:** Generate a short-lived token for widget embedding

**Request:**
```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer sk_example_123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7ZGXFP5C6BBQY5Z7EXAMPLE",
    "organization_id": "org_01H7ZGXFP5C6BBQY5Z7EXAMPLE",
    "session_duration_minutes": 15
  }'
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | No | WorkOS user ID to scope the token. Omit for signup flows. |
| `organization_id` | string | No | Organization context for the widget session |
| `session_duration_minutes` | integer | No | Token validity period (default: 15, max: 60) |

**Response (200 OK):**
```json
{
  "token": "wgt_01H7ZGXFP5C6BBQY5Z7EXAMPLE",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Short-lived widget token (prefix: `wgt_`) |
| `expires_at` | string | ISO 8601 timestamp of token expiration |

## Error Handling

### 400 Bad Request

**Cause:** Invalid request parameters

**Example response:**
```json
{
  "error": "invalid_request",
  "error_description": "session_duration_minutes must be between 1 and 60"
}
```

**Fix:**
- Verify `session_duration_minutes` is 1-60
- Ensure `user_id` matches format `user_[a-z0-9]{26}`
- Confirm `organization_id` matches format `org_[a-z0-9]{26}`

### 401 Unauthorized

**Cause:** Missing or invalid API key

**Example response:**
```json
{
  "error": "unauthorized",
  "error_description": "Invalid API key"
}
```

**Fix:**
- Verify `WORKOS_API_KEY` starts with `sk_`
- Check key exists in WorkOS Dashboard → API Keys
- Confirm key has not been deleted or rotated

### 403 Forbidden

**Cause:** API key lacks widgets permission

**Fix:**
- Go to WorkOS Dashboard → API Keys
- Verify key has "Widgets" scope enabled
- Regenerate key if permissions cannot be modified

### 404 Not Found

**Cause:** Referenced user or organization does not exist

**Example response:**
```json
{
  "error": "not_found",
  "error_description": "User user_01H7ZGXFP5C6BBQY5Z7EXAMPLE not found"
}
```

**Fix:**
- Verify `user_id` exists in your WorkOS environment
- Confirm `organization_id` is valid if provided
- Check for typos in ID strings

### 429 Too Many Requests

**Cause:** Rate limit exceeded

**Fix:**
- Implement exponential backoff (start with 1s, double on each retry)
- Cache tokens client-side until near expiration
- Distribute requests across multiple API keys if needed

**Rate limits:** 100 requests per minute per API key (check docs for current limits)

## SDK Usage Patterns

### Node.js
```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate token for existing user
const { token } = await workos.widgets.getToken({
  user: 'user_01H7ZGXFP5C6BBQY5Z7EXAMPLE',
  organizationId: 'org_01H7ZGXFP5C6BBQY5Z7EXAMPLE',
  sessionDurationMinutes: 30
});

// Generate token for new user signup
const { token: signupToken } = await workos.widgets.getToken({
  sessionDurationMinutes: 15
});
```

### Python
```python
from workos import WorkOSClient

client = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"))

# Generate token for existing user
response = client.widgets.get_token(
    user="user_01H7ZGXFP5C6BBQY5Z7EXAMPLE",
    organization_id="org_01H7ZGXFP5C6BBQY5Z7EXAMPLE",
    session_duration_minutes=30
)
token = response["token"]
```

## Token Lifecycle Management

**Token validity:**
- Default: 15 minutes
- Maximum: 60 minutes
- Tokens are single-use for widget initialization

**Best practices:**
1. Generate tokens server-side immediately before widget rendering
2. Pass tokens to frontend via secure, non-cacheable endpoints
3. Never expose tokens in URLs or client-side storage
4. Regenerate expired tokens rather than extending validity

## Verification Commands

### Test token generation (curl)
```bash
export WORKOS_API_KEY="sk_example_123456789"

curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"session_duration_minutes": 15}' \
  | jq -r '.token'
```

**Expected output:** `wgt_01H7ZGXFP5C6BBQY5Z7EXAMPLE`

### Test token expiration
```bash
# Generate token
TOKEN=$(curl -s -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"session_duration_minutes": 1}' \
  | jq -r '.expires_at')

echo "Token expires at: ${TOKEN}"
```

### Verify API key permissions
```bash
# Should return 401 if key is invalid
curl -I -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer sk_invalid_key" \
  -H "Content-Type: application/json"

# Should return 403 if key lacks widgets permission
```

## Integration Checklist

- [ ] API key starts with `sk_` and has widgets scope enabled
- [ ] Token generation endpoint returns 200 with valid `wgt_` token
- [ ] Tokens expire after configured `session_duration_minutes`
- [ ] Frontend receives tokens via secure backend endpoint (not hardcoded)
- [ ] Error responses are handled gracefully (show user-friendly messages)
- [ ] Token regeneration logic exists for expired tokens

## Common Pitfalls

**Using client-side API keys:** The Widgets Token API requires a SECRET key (`sk_`), not a client ID (`client_`). Never expose secret keys in frontend code.

**Reusing expired tokens:** Tokens are short-lived by design. Implement server-side token generation on-demand rather than caching tokens.

**Missing organization context:** If your users belong to organizations, always pass `organization_id` to scope the widget session correctly.

## Related Skills

- **workos-widgets** — Feature overview and frontend integration patterns for Widgets
- **workos-authkit-react** — React implementation of AuthKit using Widget tokens
- **workos-authkit-nextjs** — Next.js server-side token generation patterns
- **workos-api-authkit** — User session management after widget authentication
