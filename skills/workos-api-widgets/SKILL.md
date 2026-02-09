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

## Authentication Setup

All Widgets API calls require authentication using your WorkOS API key in the `Authorization` header:

```
Authorization: Bearer sk_live_xxxxx
```

Obtain your API key from the WorkOS Dashboard under API Keys. Use `sk_test_` keys for development and `sk_live_` keys for production.

## Endpoint Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user_management/widgets/get_token` | Generate a short-lived token to initialize a Widget |

## Operation Decision Tree

**To embed a Widget in your application:**
1. Call `POST /user_management/widgets/get_token` to generate a token
2. Pass the token to the Widget JavaScript SDK in your frontend
3. The Widget SDK handles rendering and user interactions

**Token lifecycle:**
- Tokens are short-lived (consult docs for exact TTL)
- Generate a new token for each Widget session
- Do NOT reuse tokens across multiple users or sessions

## Request/Response Patterns

### Generate Widget Token

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/widgets/get_token \
  -H "Authorization: Bearer sk_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7ZKXP9RMVN8WYZ3K8QJQX7E",
    "organization_id": "org_01H7ZKXP9RMVN8WYZ3K8QJQX7E"
  }'
```

**Response (200 OK):**
```json
{
  "token": "widget_token_xxxxx",
  "expires_at": "2024-01-15T12:34:56.789Z"
}
```

**Required parameters:**
- Check the fetched documentation for current required fields (typically `user_id` and/or `organization_id`)

**Optional parameters:**
- Consult the docs for session customization options

## Error Codes and Resolution

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 Unauthorized | Missing or invalid API key | Verify `Authorization: Bearer sk_live_xxxxx` header is present and key is valid |
| 400 Bad Request | Missing required field (e.g., `user_id`) | Check request body includes all required parameters per docs |
| 404 Not Found | Invalid `user_id` or `organization_id` | Verify the user/org exists in your WorkOS environment |
| 429 Too Many Requests | Rate limit exceeded | Implement exponential backoff retry logic |
| 500 Internal Server Error | WorkOS service issue | Retry after 1-2 seconds; check WorkOS status page |

## Rate Limits

Consult the fetched documentation for current rate limits. If you receive 429 responses:

1. Implement exponential backoff (start with 1s delay, double on each retry)
2. Cache tokens where possible (within their expiration window)
3. Contact WorkOS if you need higher limits

## Pagination

The Widgets API does not use pagination — it generates single-use tokens per request.

## Verification Commands

### Test Token Generation (cURL)

```bash
export WORKOS_API_KEY="sk_test_xxxxx"
export USER_ID="user_01H7ZKXP9RMVN8WYZ3K8QJQX7E"

curl -X POST https://api.workos.com/user_management/widgets/get_token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\"}" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected output:**
- HTTP Status: 200
- JSON response with `token` and `expires_at` fields

### Test Token Generation (Node.js SDK)

```javascript
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function generateWidgetToken() {
  try {
    const { token, expiresAt } = await workos.widgets.getToken({
      userId: 'user_01H7ZKXP9RMVN8WYZ3K8QJQX7E',
      organizationId: 'org_01H7ZKXP9RMVN8WYZ3K8QJQX7E'
    });
    
    console.log('Token:', token);
    console.log('Expires:', expiresAt);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Status:', error.status);
  }
}

generateWidgetToken();
```

## Integration Checklist

- [ ] API key is configured in environment variables (`WORKOS_API_KEY`)
- [ ] Token generation endpoint returns 200 with valid token
- [ ] Token is passed to Widget JavaScript SDK in frontend
- [ ] Error responses (400, 401, 404) are handled with user-friendly messages
- [ ] Rate limit errors (429) trigger retry logic
- [ ] Tokens are regenerated after expiration (not cached indefinitely)

## Related Skills

- **workos-widgets** — Feature overview for choosing and configuring Widgets
- **workos-user-management** — Managing users and organizations referenced in Widget tokens
