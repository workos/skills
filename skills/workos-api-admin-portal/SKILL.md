---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- generated -->

# WorkOS Admin Portal API

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for the source of truth:
- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (only needed for OAuth features)

**For server-side only:** `WORKOS_API_KEY` is sufficient. Client ID is for user authentication flows.

### SDK Installation

Verify WorkOS SDK exists:

```bash
# Check SDK is installed
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not installed"
```

If missing, detect package manager and install:

```bash
# Detect and install
if [ -f "package-lock.json" ]; then
  npm install @workos-inc/node
elif [ -f "yarn.lock" ]; then
  yarn add @workos-inc/node
elif [ -f "pnpm-lock.yaml" ]; then
  pnpm add @workos-inc/node
fi
```

## Step 3: Use Case Detection (Decision Tree)

```
What are you building?
  |
  +-- Self-serve org settings UI --> Portal Link Generation (Step 4)
  |
  +-- Admin management dashboard --> Direct Admin Portal API (Step 5)
  |
  +-- Custom provider selector --> Provider Icons API (Step 6)
```

## Step 4: Portal Link Generation (Self-Serve UI)

**Use case:** End users configure their own org's SSO/Directory Sync settings.

### A. Create Portal Link Endpoint

Create an API route or server function that generates one-time portal URLs:

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate link for an organization
const { link } = await workos.portal.generateLink({
  organization: 'org_123',  // Required: WorkOS organization ID
  intent: 'sso',            // Required: 'sso' | 'dsync' | 'log_streams' | 'audit_logs'
  returnUrl: 'https://yourapp.com/settings', // Optional: where to redirect after
  successUrl: 'https://yourapp.com/success'  // Optional: override success redirect
});

// Return link to client
return { url: link };
```

**Critical:** Links expire after 5 minutes and are single-use. Generate fresh links on each request.

### B. Intent-Based Routing

Map user actions to intent values:

| Intent | User Action |
|--------|-------------|
| `sso` | Configure SAML/OIDC providers |
| `dsync` | Set up directory sync |
| `log_streams` | Configure log streaming |
| `audit_logs` | View audit log settings |

**Validation:** Intent must be one of the exact strings above. SDK will reject invalid values.

### C. Organization ID Resolution

**Decision:** Where does `organization` ID come from?

```
Organization ID source?
  |
  +-- User auth session --> Extract from JWT/session token
  |
  +-- Database lookup --> Query by user's company/tenant ID
  |
  +-- URL parameter --> Validate ownership before generating link
```

**Critical security check:** Always verify the requesting user has permission to access the organization before generating a portal link.

### D. Return URL Flow

```typescript
// User flow with return URL:
// 1. User clicks "Configure SSO" in your app
// 2. Your API generates portal link with returnUrl
// 3. User completes setup in WorkOS Admin Portal
// 4. Portal redirects to returnUrl with ?success=true
// 5. Your app shows success message
```

**Optional vs Required:**
- `returnUrl` - optional, defaults to WorkOS-hosted success page
- `successUrl` - optional, overrides return URL specifically for success case

## Step 5: Direct Admin Portal API (Admin Dashboard)

**Use case:** Your internal admin team manages customer orgs without giving customers access.

**NOT RECOMMENDED for production.** Use Portal Links (Step 4) for customer self-serve.

Check fetched documentation for direct API endpoints. These require:
- Admin-level API key permissions
- Manual OAuth/SAML configuration handling
- Complex state management

**Skip to Step 7 unless building internal tooling.**

## Step 6: Provider Icons API

**Use case:** Display SSO provider logos in your custom UI.

Fetch available provider icons:

```typescript
const providers = await workos.portal.listProviders();

// Returns array of:
// [
//   { provider: 'GoogleOAuth', icon_url: 'https://...' },
//   { provider: 'MicrosoftOAuth', icon_url: 'https://...' },
//   ...
// ]
```

**Integration pattern:**

```typescript
// In your UI component
const providerOptions = providers.map(p => ({
  label: p.provider,
  icon: p.icon_url
}));
```

**Caching:** Icons rarely change. Cache response for 24 hours:

```typescript
// Example with Next.js
export const revalidate = 86400; // 24 hours
```

## Step 7: Error Handling Patterns

### Portal Link Generation Errors

**Organization not found:**
```typescript
try {
  const { link } = await workos.portal.generateLink({
    organization: 'org_unknown'
  });
} catch (error) {
  if (error.code === 'organization_not_found') {
    // Organization doesn't exist in WorkOS
    // Fix: Verify organization ID, check if org was created
  }
}
```

**Invalid intent:**
```typescript
// Error: intent must be 'sso' | 'dsync' | 'log_streams' | 'audit_logs'
// Fix: Use exact string from allowed values
```

**API key invalid:**
```typescript
// Error: Unauthorized (401)
// Root cause: API key wrong/missing/expired
// Fix: Check WORKOS_API_KEY starts with 'sk_', verify in Dashboard
```

### Rate Limiting

WorkOS API has rate limits. Implement retry logic:

```typescript
async function generateLinkWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.portal.generateLink(params);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        // Rate limited, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || echo "FAIL: SDK missing"

# 2. Check environment variables exist
grep -q "WORKOS_API_KEY=sk_" .env* 2>/dev/null || echo "FAIL: API key not configured"

# 3. Test API connection (requires valid key)
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization":"org_test","intent":"sso"}' \
  2>&1 | grep -q "link\|organization_not_found" || echo "FAIL: API unreachable"

# 4. Check for portal link generation code
grep -r "generateLink\|portal.generate" . --include="*.ts" --include="*.js" || echo "WARN: No portal link code found"

# 5. Verify no hardcoded API keys in code
grep -r "sk_[a-zA-Z0-9]" . --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null && echo "FAIL: Hardcoded API key detected"

# 6. Build succeeds (adjust command for your framework)
npm run build || echo "FAIL: Build failed"
```

**If test #3 returns 401:** API key is invalid or missing from environment.

**If test #5 finds matches:** Move API key to environment variable immediately.

## Security Checklist

- [ ] API key stored in environment variable, not code
- [ ] Portal link generation validates user owns organization
- [ ] Portal links generated server-side only (never expose API key to client)
- [ ] Return URLs point to your domain (prevent open redirects)
- [ ] Organization IDs validated against authenticated user's permissions

**Critical:** Never send `WORKOS_API_KEY` to client-side code. Always generate portal links server-side.

## Common Patterns by Framework

### Next.js App Router (13+)

```typescript
// app/api/admin-portal/route.ts
import { WorkOS } from '@workos-inc/node';
import { NextRequest } from 'next/server';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: NextRequest) {
  const { organizationId } = await request.json();
  
  // TODO: Verify user owns organizationId
  
  const { link } = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'sso',
    returnUrl: `${request.nextUrl.origin}/settings`
  });
  
  return Response.json({ url: link });
}
```

### Next.js Pages Router

```typescript
// pages/api/admin-portal.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { organizationId } = req.body;
  
  const { link } = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'sso',
    returnUrl: `${req.headers.origin}/settings`
  });
  
  res.json({ url: link });
}
```

### Express

```typescript
import express from 'express';
import { WorkOS } from '@workos-inc/node';

const app = express();
const workos = new WorkOS(process.env.WORKOS_API_KEY);

app.post('/api/admin-portal', async (req, res) => {
  const { organizationId } = req.body;
  
  const { link } = await workos.portal.generateLink({
    organization: organizationId,
    intent: 'sso',
    returnUrl: `${req.protocol}://${req.get('host')}/settings`
  });
  
  res.json({ url: link });
});
```

## Related Skills

- `workos-directory-sync` - For implementing directory sync with generated portal links
- `workos-sso` - For implementing SSO authentication alongside portal configuration
- `workos-organizations` - For managing organizations that portal links reference
