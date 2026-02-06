---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- generated -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for runtime reference:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If these docs conflict with this skill, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required WorkOS credentials:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Requirements

- Confirm React-based application (widgets require React)
- Confirm `package.json` exists
- Determine if using framework (Next.js, Remix, Vite, etc.) for later integration decisions

## Step 3: Install Dependencies

**CRITICAL:** Widgets require three packages as peer dependencies.

Detect package manager, then install:

```bash
# All three packages required
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Verify installation before continuing:**

```bash
ls node_modules/@workos-inc/widgets node_modules/@radix-ui/themes node_modules/@tanstack/react-query 2>/dev/null | grep -c "widgets\|themes\|react-query"
# Must return "3"
```

Why three packages:
- `@workos-inc/widgets` - The actual widget components
- `@radix-ui/themes` - UI primitives and styling system
- `@tanstack/react-query` - Data fetching and caching

## Step 4: Framework Detection (Decision Tree)

```
Framework type?
  |
  +-- Next.js (App Router)   --> Widgets in client components, token from server actions/API routes
  |
  +-- Next.js (Pages Router) --> Widgets in pages, token from getServerSideProps/API routes
  |
  +-- Remix                  --> Widgets in routes, token from loaders
  |
  +-- Vite/CRA               --> Widgets in components, token from backend API
  |
  +-- Other React            --> Standard React component pattern
```

**Key distinction:** Widgets are client-side components. Token generation happens server-side.

## Step 5: Provider Setup (REQUIRED)

**You MUST wrap the app in required providers.** Widgets will not function without these.

### Radix Theme Provider

Required for widget styling. Add to root layout/app component:

```tsx
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Theme>{children}</Theme>
      </body>
    </html>
  );
}
```

**Framework-specific locations:**
- Next.js App Router: `app/layout.tsx`
- Next.js Pages Router: `_app.tsx`
- Remix: `app/root.tsx`
- Vite/CRA: Top-level component in `main.tsx` or `index.tsx`

### TanStack Query Provider

Required for data fetching. Add QueryClientProvider:

```tsx
'use client'; // For Next.js App Router

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

Nest inside Theme provider from previous step.

**Verify providers before continuing:**

```bash
# Check Theme import
grep -r "@radix-ui/themes" app/ src/ 2>/dev/null

# Check QueryClientProvider
grep -r "QueryClientProvider" app/ src/ 2>/dev/null
```

Both must return matches.

## Step 6: Token Generation (CRITICAL)

**Widgets require authorization tokens with specific scopes.** Never use API keys directly in client code.

### Token Scope Mapping

```
Widget Component          --> Required Permission Scope
<UserSessions />          --> widgets:user-sessions:read
<UserSecurity />          --> widgets:user-security:manage
<UserProfile />           --> widgets:user-profile:manage
<UsersManagement />       --> widgets:users-table:manage
<Pipes />                 --> widgets:pipes:manage
<OrganizationSwitcher />  --> (check docs for specific scope)
```

### Role Configuration (Dashboard Setup)

**STOP. Before generating tokens, verify WorkOS Dashboard roles:**

1. Navigate to WorkOS Dashboard → Roles
2. Confirm target role has required widget permissions
3. New accounts have "Admin" role with all permissions
4. Existing accounts: Add permissions to roles manually

**User must have role with correct permissions or token generation will fail.**

### Server-Side Token Generation

Choose pattern based on framework from Step 4:

#### Next.js App Router Pattern

```typescript
// app/actions/get-widget-token.ts
'use server';

import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function getWidgetToken(userId: string, organizationId: string) {
  // Check docs for exact method name - may be getToken() or createToken()
  const token = await workos.widgets.getToken({
    user: userId,
    organization_id: organizationId,
    scopes: ['widgets:user-profile:manage'], // Adjust scope for widget type
  });
  
  return token;
}
```

#### API Route Pattern

```typescript
// app/api/widget-token/route.ts or pages/api/widget-token.ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: Request) {
  const { userId, organizationId, scope } = await request.json();
  
  const token = await workos.widgets.getToken({
    user: userId,
    organization_id: organizationId,
    scopes: [scope],
  });
  
  return Response.json({ token });
}
```

**Token lifecycle:** Tokens expire after 1 hour. Implement refresh logic or regenerate on mount.

## Step 7: Widget Integration

### Basic Widget Pattern

All widgets follow this structure:

```tsx
'use client'; // For Next.js App Router

import { UserProfile } from '@workos-inc/widgets';
import { useState, useEffect } from 'react';

export function ProfileWidget() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch token from your server endpoint/action
    async function loadToken() {
      const response = await fetch('/api/widget-token', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user_123',
          organizationId: 'org_456',
          scope: 'widgets:user-profile:manage',
        }),
      });
      const { token } = await response.json();
      setToken(token);
    }
    loadToken();
  }, []);

  if (!token) return <div>Loading...</div>;

  return <UserProfile token={token} />;
}
```

### Widget-Specific Implementation

Check fetched docs for exact prop names. Common patterns:

#### User Sessions Widget

```tsx
import { UserSessions } from '@workos-inc/widgets';

<UserSessions token={token} />
```

**No special permissions required.** Users can view and sign out of their own sessions.

#### User Security Widget

```tsx
import { UserSecurity } from '@workos-inc/widgets';

<UserSecurity token={token} />
```

Enables password changes and MFA configuration. **No special permissions required.**

#### Users Management Widget

```tsx
import { UsersManagement } from '@workos-inc/widgets';

<UsersManagement token={token} />
```

**CRITICAL:** User MUST have role with `widgets:users-table:manage` permission or widget will fail to load.

Use this for organization admin functionality: inviting users, removing users, changing roles.

#### Pipes Widget

```tsx
import { Pipes } from '@workos-inc/widgets';

<Pipes token={token} />
```

For managing third-party integrations. Check docs for required scope.

## Step 8: AuthKit Integration (If Applicable)

If using WorkOS AuthKit (`authkit-js` or `authkit-react`), use the access token directly:

```tsx
import { useAuth } from '@workos-inc/authkit-react';
import { UserProfile } from '@workos-inc/widgets';

export function ProfileWidget() {
  const { accessToken } = useAuth();
  
  if (!accessToken) return <div>Not authenticated</div>;
  
  return <UserProfile token={accessToken} />;
}
```

This eliminates need for separate token endpoint.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check all peer dependencies installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query 2>/dev/null | grep -E "@workos-inc/widgets|@radix-ui/themes|@tanstack/react-query"

# 2. Verify Theme provider import
grep -r "import.*Theme.*from '@radix-ui/themes'" app/ src/ 2>/dev/null

# 3. Verify QueryClientProvider
grep -r "QueryClientProvider" app/ src/ 2>/dev/null

# 4. Verify at least one widget imported
grep -r "from '@workos-inc/widgets'" app/ src/ 2>/dev/null

# 5. Check no direct API key usage in client code (security check)
! grep -r "WORKOS_API_KEY" app/ src/ components/ 2>/dev/null

# 6. Build succeeds
npm run build
```

**If check #5 fails (finds API key in client code):** STOP. Move token generation to server-side endpoint.

## Error Recovery

### "Cannot find module '@workos-inc/widgets'"

**Root cause:** Peer dependencies not installed or installation incomplete.

Fix:
```bash
rm -rf node_modules package-lock.json
npm install
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

### Widget renders blank or shows "Unauthorized"

**Root cause:** Token missing, expired, or lacks required scope.

Debug steps:
1. Check token exists and is passed to widget
2. Verify token not expired (1 hour lifetime)
3. Check user's role has required permission in WorkOS Dashboard
4. Verify scope matches widget requirement (see Step 6 mapping)

**Fix for scope mismatch:**
```typescript
// Wrong scope
scopes: ['widgets:user-profile:read'] // ❌

// Correct scope for UserProfile widget
scopes: ['widgets:user-profile:manage'] // ✅
```

### "Theme is not defined" or styling broken

**Root cause:** Radix Theme provider missing or CSS not imported.

Fix:
1. Verify Theme wrapper exists in root layout
2. Add CSS import: `import '@radix-ui/themes/styles.css';`
3. Ensure Theme wraps all widget components

### "QueryClient not found in context"

**Root cause:** QueryClientProvider missing or not wrapping widget.

Fix:
1. Add QueryClientProvider at app root
2. Ensure it wraps Theme provider and widgets
3. Create QueryClient instance: `new QueryClient()`

### Widget works locally but fails in production

**Root cause:** Environment variables not set in production or CORS issues.

Fix:
1. Verify `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` in production environment
2. Check token generation endpoint is accessible
3. Verify no CORS blocking token fetch

### "User does not have required permissions"

**Root cause:** User's role lacks widget-specific permission.

Fix:
1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Add required permission (e.g., `widgets:users-table:manage`)
4. Regenerate token after permission update

### TypeScript errors with widget props

**Root cause:** Type definitions not loaded or incorrect prop usage.

Fix:
1. Check widget import is correct
2. Refer to fetched docs for exact prop names
3. Verify `@workos-inc/widgets` has type definitions

### Build fails with "Module not found" for React Query

**Root cause:** TanStack Query not installed as peer dependency.

Fix:
```bash
npm install @tanstack/react-query
```

Don't use old `react-query` package - it's deprecated.

## Related Skills

- **workos-authkit-nextjs**: For authentication before using widgets
- **workos-admin-portal**: Alternative enterprise management UI
