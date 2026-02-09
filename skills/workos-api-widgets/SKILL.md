---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- generated -->

# WorkOS Widgets API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Authentication

All requests require your WorkOS API key passed as a Bearer token:

```
Authorization: Bearer sk_live_...
```

Your API key is available in the WorkOS Dashboard under **API Keys**. Test mode keys start with `sk_test_`, production keys start with `sk_live_`.

## Endpoint Catalog

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/user_management/widgets/token` | Generate a short-lived token for Widget UI | Yes |

## Operation Decision Tree

**Use Widget Token Generation when:**
- Embedding WorkOS Widget UI components in your frontend
- Need to authenticate a user session for self-service flows
- Implementing account portals, profile management, or organization switching

**Token characteristics:**
- Short-lived (expires after use or timeout)
- Scoped to specific organization and user
- Single-use for security

## Request/Response Patterns

### Generate Widget Token

**Request:**
```bash
curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H...",
    "user_id": "user_01H...",
    "redirect_uri": "https://yourapp.com/callback",
    "scope": "widgets:account-portal"
  }'
```

**Required Parameters:**
- `organization_id` — Organization context for the widget
- `user_id` — User who will interact with the widget
- `redirect_uri` — Where to redirect after widget actions complete
- `scope` — Widget type (e.g., `widgets:account-portal`, `widgets:profile-management`)

**Response (200 OK):**
```json
{
  "token": "wgt_01H...",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

Use this token immediately in your frontend Widget component initialization.

## Error Code Mapping

| HTTP Status | Error Code | Cause | Fix |
|-------------|-----------|-------|-----|
| 401 | `unauthorized` | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is present and valid |
| 403 | `forbidden` | API key lacks permissions | Check API key has Widget permissions in WorkOS Dashboard |
| 404 | `not_found` | `organization_id` or `user_id` does not exist | Verify IDs are correct and resources exist in your environment |
| 422 | `invalid_request` | Missing required fields or invalid `redirect_uri` | Check all required parameters are present; ensure `redirect_uri` matches configured domain |
| 429 | `rate_limit_exceeded` | Too many token generation requests | Implement exponential backoff (start with 1s, max 30s) |
| 500 | `server_error` | WorkOS internal error | Retry with exponential backoff; contact support if persistent |

## Rate Limiting

- Token generation: **100 requests per minute per API key**
- Exceeded limit returns `429` with `Retry-After` header
- Implement retry logic with exponential backoff

## SDK Usage (Node.js)

**Install:**
```bash
npm install @workos-inc/node
```

**Generate token:**
```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function getWidgetToken(organizationId, userId) {
  try {
    const { token, expires_at } = await workos.widgets.generateToken({
      organizationId,
      userId,
      redirectUri: 'https://yourapp.com/callback',
      scope: 'widgets:account-portal'
    });
    
    return token;
  } catch (error) {
    if (error.status === 404) {
      console.error('Organization or user not found');
    } else if (error.status === 429) {
      console.error('Rate limited, retry after delay');
    }
    throw error;
  }
}
```

## Verification Commands

**Test token generation (curl):**
```bash
export WORKOS_API_KEY="sk_test_..."
export ORG_ID="org_01H..."
export USER_ID="user_01H..."

curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"user_id\": \"$USER_ID\",
    \"redirect_uri\": \"https://yourapp.com/callback\",
    \"scope\": \"widgets:account-portal\"
  }" | jq
```

**Expected output:**
```json
{
  "token": "wgt_01H...",
  "expires_at": "2024-01-15T10:30:00.000Z"
}
```

**Verify token format:**
- Starts with `wgt_`
- Followed by base58 characters
- `expires_at` is future timestamp

## Integration Checklist

- [ ] API key configured (`sk_test_` for dev, `sk_live_` for prod)
- [ ] Organization and User IDs available from User Management API
- [ ] Redirect URI matches configured domain in WorkOS Dashboard
- [ ] Token generation endpoint returns 200 with valid token
- [ ] Frontend Widget component receives and uses token
- [ ] Error handling covers 401, 404, 422, 429, 500 cases
- [ ] Rate limit retry logic implemented with exponential backoff

## Common Patterns

**Backend token endpoint (Express):**
```javascript
app.post('/api/widget-token', authenticateUser, async (req, res) => {
  const { organizationId } = req.user;
  
  try {
    const { token } = await workos.widgets.generateToken({
      organizationId,
      userId: req.user.id,
      redirectUri: process.env.WIDGET_REDIRECT_URI,
      scope: 'widgets:account-portal'
    });
    
    res.json({ token });
  } catch (error) {
    if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded, try again shortly' });
    } else {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
});
```

**Frontend usage (React):**
```jsx
import { WorkOSWidget } from '@workos-inc/react';

function AccountPortal() {
  const [token, setToken] = useState(null);
  
  useEffect(() => {
    fetch('/api/widget-token', { method: 'POST' })
      .then(r => r.json())
      .then(data => setToken(data.token));
  }, []);
  
  if (!token) return <div>Loading...</div>;
  
  return <WorkOSWidget token={token} onComplete={() => window.location.href = '/'} />;
}
```

## Related Skills

- **workos-widgets** — High-level feature guide for Widget UI implementation (use this first for context)
- **workos-api-user-management** — Managing users and organizations (prerequisite for widget tokens)
- **workos-api-directory-sync** — Syncing organization data that appears in widgets
