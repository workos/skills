---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for the latest implementation details:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

These docs are the source of truth. If this skill conflicts with the fetched documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these required variables:

```bash
# Verify API key exists and has correct prefix
grep -q "WORKOS_API_KEY=sk_" .env* || echo "FAIL: WORKOS_API_KEY missing or wrong prefix"

# Verify client ID exists
grep -q "WORKOS_CLIENT_ID" .env* || echo "FAIL: WORKOS_CLIENT_ID missing"
```

**STOP if either check fails.** Get credentials from WorkOS Dashboard before continuing.

### React Project Detection

Confirm this is a React project:

```bash
# Check package.json for React
grep -q '"react"' package.json || echo "FAIL: Not a React project"
```

Widgets are React components only. For other frameworks, see fetched docs for adapter patterns.

## Step 3: Install Dependencies

Widgets require THREE packages as peers:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why three packages?**

- `@workos-inc/widgets` - The widget components
- `@radix-ui/themes` - UI components and styling (peer dependency to avoid version conflicts)
- `@tanstack/react-query` - Data fetching and caching (peer dependency to avoid duplication)

**Verify installation:**

```bash
ls node_modules/@workos-inc/widgets node_modules/@radix-ui/themes node_modules/@tanstack/react-query 2>/dev/null | wc -l
# Should output 3
```

## Step 4: Widget Selection (Decision Tree)

Determine which widget(s) you need:

```
Widget needed?
  |
  +-- User sessions management? --> <UserSessions />
  |                                  (no special permissions required)
  |
  +-- Security settings (password, MFA)? --> <UserSecurity />
  |                                           (no special permissions required)
  |
  +-- Profile display/edit? --> <UserProfile />
  |                             (no special permissions required)
  |
  +-- Manage org members? --> <UsersManagement />
  |                           (requires widgets:users-table:manage permission)
  |
  +-- Third-party connections? --> <Pipes />
  |                                (check fetched docs for permissions)
  |
  +-- Org switching? --> <OrganizationSwitcher />
                         (check fetched docs for permissions)
```

**Critical:** `<UsersManagement />` requires `widgets:users-table:manage` permission on the user's role. Others do not.

## Step 5: Token Acquisition Strategy (Decision Tree)

Widgets need authorization tokens. Choose path based on existing setup:

```
Using AuthKit already?
  |
  +-- YES, with authkit-js/authkit-react
  |     |
  |     +-> Use provided access token directly
  |          (check authkit-react skill for useAuth() hook)
  |
  +-- NO, using backend SDK only
        |
        +-> Call SDK "get token" method with widget scope
            Token expires after 1 hour - refresh as needed
```

**Example token generation (backend SDK pattern):**

Check fetched docs for exact method signature. Pattern will be:

```typescript
// Backend route or API endpoint
const token = await workos.widgets.getToken({
  userId: "user_123",
  organizationId: "org_456", // if org-scoped widget
  scopes: ["widgets:users-table:manage"], // for UsersManagement
});
```

**Pass token to frontend via:**

- Server-side props (Next.js, Remix)
- API endpoint (SPA)
- Hidden form field (traditional server rendering)

## Step 6: Provider Setup (REQUIRED)

**CRITICAL:** All Widgets must be wrapped in providers. This is React Context setup.

Add to your root layout/app component:

```tsx
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create query client outside component to avoid recreation
const queryClient = new QueryClient();

export default function App({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>{children}</Theme>
    </QueryClientProvider>
  );
}
```

**Order matters:**

1. `QueryClientProvider` outermost (data layer)
2. `Theme` inside (UI layer)
3. Widget components inside both

**Verify:**

```bash
# Check for required imports in app root
grep -E "(QueryClientProvider|Theme)" app/layout.tsx || grep -E "(QueryClientProvider|Theme)" src/App.tsx
```

## Step 7: Widget Component Integration

### Pattern A: Using AuthKit Token (If AuthKit Already Integrated)

```tsx
import { useAuth } from "@workos-inc/authkit-react";
import { UserProfile } from "@workos-inc/widgets";

function ProfilePage() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <div>Loading...</div>;
  }

  return <UserProfile accessToken={accessToken} />;
}
```

### Pattern B: Using Backend-Generated Token (No AuthKit)

```tsx
import { UserProfile } from "@workos-inc/widgets";
import { useEffect, useState } from "react";

function ProfilePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch token from your backend API
    fetch("/api/widgets/token")
      .then((res) => res.json())
      .then((data) => setToken(data.token));
  }, []);

  if (!token) {
    return <div>Loading...</div>;
  }

  return <UserProfile accessToken={token} />;
}
```

**Token refresh:** Tokens expire after 1 hour. Implement refresh logic based on your auth pattern.

## Step 8: Permission Verification (UsersManagement Only)

If using `<UsersManagement />`, verify the user has the required permission:

### Check in WorkOS Dashboard

1. Go to "Roles" page
2. Find the role assigned to test user
3. Confirm `widgets:users-table:manage` permission is checked

**New accounts:** Default "Admin" role has all widget permissions.

**Existing accounts:** You must manually assign permissions to roles.

### Runtime Check (Optional)

Add permission check before rendering:

```tsx
function UsersPage() {
  const { user } = useAuth(); // or your auth pattern
  const hasPermission = user?.permissions?.includes(
    "widgets:users-table:manage",
  );

  if (!hasPermission) {
    return <div>Access denied. Contact your organization admin.</div>;
  }

  return <UsersManagement accessToken={accessToken} />;
}
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check all peer dependencies installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check providers are set up in app root
grep -E "(QueryClientProvider|Theme)" app/layout.tsx src/App.tsx 2>/dev/null

# 3. Check widget imports exist
grep -r "from '@workos-inc/widgets'" app/ src/ 2>/dev/null

# 4. Verify environment variables
grep -E "(WORKOS_API_KEY|WORKOS_CLIENT_ID)" .env* | wc -l
# Should output at least 2

# 5. Build succeeds
npm run build
```

## Error Recovery

### "Cannot find module '@workos-inc/widgets'"

**Root cause:** Package not installed or wrong import path.

**Fix:**

1. Verify installation: `npm list @workos-inc/widgets`
2. If missing, run: `npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query`
3. Check import path matches package name exactly (case-sensitive)

### "QueryClient is not provided"

**Root cause:** Widget used outside `QueryClientProvider` context.

**Fix:**

1. Verify `QueryClientProvider` wraps your app root
2. Check provider order: QueryClientProvider must be ABOVE Theme and widgets in tree
3. Ensure `queryClient` is created outside component (not recreated on every render)

### "Token expired" or 401 errors

**Root cause:** Widget token expired (1 hour lifetime).

**Fix for AuthKit users:**

- Access token refreshes automatically via AuthKit - ensure `useAuth()` is called in component

**Fix for backend token users:**

- Implement token refresh logic
- Store token with expiry timestamp
- Refetch from `/api/widgets/token` when expired
- Example pattern:

```tsx
const [tokenData, setTokenData] = useState({ token: "", expiresAt: 0 });

useEffect(() => {
  const now = Date.now();
  if (tokenData.expiresAt < now) {
    fetchNewToken(); // refetch from backend
  }
}, []);
```

### "Permission denied" for UsersManagement

**Root cause:** User role lacks `widgets:users-table:manage` permission.

**Fix:**

1. Go to WorkOS Dashboard → Roles
2. Edit the role assigned to the user
3. Enable `widgets:users-table:manage` permission
4. Save and wait 30 seconds for cache refresh

**Alternative:** Assign user to "Admin" role (has all permissions by default)

### "Theme styles not applying"

**Root cause:** Radix Theme not wrapping widgets, or CSS not imported.

**Fix:**

1. Verify `<Theme>` component wraps widgets in component tree
2. Check if Radix Themes CSS needs manual import (framework-dependent):
   - Next.js: Import in `app/layout.tsx`
   - Vite/CRA: Import in `main.tsx` or `index.tsx`
3. See Radix Themes docs for CSS import pattern: https://www.radix-ui.com/themes/docs/overview/getting-started

### Build fails with "React is not defined"

**Root cause:** React not imported in file using widgets (older React versions).

**Fix:**

- Add `import React from 'react';` at top of file
- Or upgrade to React 17+ with automatic JSX runtime

## Framework-Specific Notes

### Next.js (App Router)

- Widgets are client components - add `'use client'` directive
- Providers go in `app/layout.tsx`
- Token fetching can use Server Actions or Route Handlers

### Next.js (Pages Router)

- Providers go in `pages/_app.tsx`
- Token fetching via API routes (`pages/api/widgets/token.ts`)

### Remix

- Providers in `app/root.tsx`
- Token generation in loaders
- Pass token via loader data

### Vite / Create React App

- Providers in `src/main.tsx` or `src/App.tsx`
- Token fetching via `/api/*` proxy or direct backend calls

## Related Skills

- **workos-authkit-react**: For integrating AuthKit authentication (provides `useAuth()` hook for token access)
- **workos-authkit-nextjs**: For Next.js-specific AuthKit patterns with widgets
