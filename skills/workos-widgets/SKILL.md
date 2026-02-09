---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for implementation:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this skill conflicts with the fetched documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these variables in your environment (`.env.local`, `.env`, or deployment platform):

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys exist before continuing.

### WorkOS Dashboard Check

Confirm in WorkOS Dashboard:

1. Navigate to Roles page
2. Check that roles have widget permissions assigned (e.g., `widgets:users-table:manage` for User Management widget)
3. For new accounts: "Admin" role should exist with all widget permissions
4. For existing accounts: You may need to assign permissions manually

**Critical:** Widget tokens will fail to generate if the user lacks required role permissions.

## Step 3: Install Dependencies

### Package Installation

Install the widgets package and peer dependencies:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies:**
- `@radix-ui/themes` - UI components and styling
- `@tanstack/react-query` - Data fetching and caching
- Peer deps prevent version conflicts and bundle duplication

**Verify:** All three packages exist in `node_modules` before continuing.

### Framework Compatibility

Widgets work with:
- Client-rendered React apps (Create React App, Vite)
- Server-rendered React apps (Next.js, Remix)

For framework-specific examples, WebFetch: https://github.com/workos/widgets-examples

## Step 4: Token Strategy (Decision Tree)

Widgets require authorization tokens. Choose your approach:

```
Using AuthKit?
  |
  +-- YES --> Use access token from authkit-js/authkit-react
  |           (Token automatically includes widget scopes)
  |
  +-- NO  --> Use backend SDK to generate widget tokens
              (Token expires after 1 hour)
```

### If Using AuthKit (authkit-js or authkit-react)

The access token from `useAuth()` or similar hook already includes widget permissions. Pass it directly to widgets.

### If Using Backend SDK

Use the SDK's "get token" method with widget-specific scopes. WebFetch the documentation for your SDK language for exact method signature.

**Required scopes per widget:**
- `UserSessions` - Check fetched docs for scope name
- `UserSecurity` - Check fetched docs for scope name
- `UserProfile` - Check fetched docs for scope name
- `UsersManagement` - Requires `widgets:users-table:manage` permission on user's role
- `Pipes` - Check fetched docs for scope name
- `OrganizationSwitcher` - Check fetched docs for scope name

**Critical:** If token generation fails, verify the user has a role with the required widget permission in WorkOS Dashboard.

## Step 5: Provider Setup (REQUIRED)

**You MUST wrap your app in both `Theme` and `QueryClientProvider`.**

### Create Provider Component

```tsx
// components/WidgetsProvider.tsx
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const queryClient = new QueryClient();

export function WidgetsProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>{children}</Theme>
    </QueryClientProvider>
  );
}
```

### Add to Root Layout

Wrap your app root with the provider:

```tsx
// app/layout.tsx (Next.js) or main.tsx (Vite)
import { WidgetsProvider } from './components/WidgetsProvider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <WidgetsProvider>{children}</WidgetsProvider>
      </body>
    </html>
  );
}
```

**Do NOT skip this step** — widgets will not function without these providers.

## Step 6: Widget Implementation (Choose One)

### User Sessions Widget

**Purpose:** Display and manage active user sessions across devices.

**Permissions required:** None (available to all authenticated users)

**Usage:** WebFetch https://workos.com/docs/widgets/user-sessions for current component API and props.

**Common use case:** Settings page where users can view/revoke sessions.

---

### User Security Widget

**Purpose:** Manage password and MFA settings.

**Permissions required:** None (available to all authenticated users)

**Usage:** WebFetch https://workos.com/docs/widgets/user-security for current component API and props.

**Common use case:** Security settings page.

---

### User Profile Widget

**Purpose:** View and edit user display name and profile details.

**Permissions required:** None (available to all authenticated users)

**Usage:** WebFetch https://workos.com/docs/widgets/user-profile for current component API and props.

**Common use case:** User profile page.

---

### User Management Widget

**Purpose:** Invite, remove, and change roles for organization members.

**Permissions required:** User must have `widgets:users-table:manage` permission via assigned role.

**Usage:** WebFetch https://workos.com/docs/widgets/user-management for current component API and props.

**Common use case:** Admin dashboard for organization member management.

**Critical:** If widget fails to load, verify user's role has `widgets:users-table:manage` permission in WorkOS Dashboard.

---

### Pipes Widget

**Purpose:** Manage third-party account connections.

**Permissions required:** Check fetched documentation for current requirements.

**Usage:** WebFetch https://workos.com/docs/widgets/pipes for current component API and props.

**Common use case:** Integrations page for connecting external services.

---

### Organization Switcher Widget

**Purpose:** Switch between organizations user belongs to.

**Permissions required:** Check fetched documentation for current requirements.

**Usage:** WebFetch https://workos.com/docs/widgets/organization-switcher for current component API and props.

**Common use case:** Navigation bar or sidebar for multi-organization users.

## Step 7: Token Passing Pattern

All widgets require an `accessToken` prop. Exact prop name may vary — check fetched docs.

**If using AuthKit:**

```tsx
import { useAuth } from '@workos-inc/authkit-react';
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage() {
  const { accessToken } = useAuth();
  
  if (!accessToken) return <div>Loading...</div>;
  
  return <UserProfile accessToken={accessToken} />;
}
```

**If using backend SDK:**

1. Create API route that generates widget token via SDK
2. Fetch token from client
3. Pass token to widget component

Check fetched Quick Start docs for backend SDK token generation examples.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check peer dependencies installed
npm list @radix-ui/themes @tanstack/react-query @workos-inc/widgets

# 2. Check provider components exist (adjust path as needed)
grep -r "QueryClientProvider" . --include="*.tsx" --include="*.jsx"
grep -r "Theme" . --include="*.tsx" --include="*.jsx" | grep "@radix-ui/themes"

# 3. Check widget imports exist
grep -r "@workos-inc/widgets" . --include="*.tsx" --include="*.jsx"

# 4. Build succeeds
npm run build
```

**Additional runtime checks:**

- [ ] Widget loads without console errors
- [ ] Widget displays expected UI (sessions list, profile fields, etc.)
- [ ] User actions work (e.g., session revocation, profile updates)
- [ ] Token refresh works if session exceeds 1 hour (for backend SDK tokens)

## Error Recovery

### "Widget not rendering" / Blank screen

**Root cause:** Missing providers or incorrect provider order.

**Fix:**
1. Verify `QueryClientProvider` wraps your app
2. Verify `Theme` wraps your app
3. Order must be: QueryClientProvider > Theme > Widget components

### "Token generation failed" / 403 Forbidden

**Root cause:** User lacks required role permission.

**Fix:**
1. Check WorkOS Dashboard > Roles
2. Find user's assigned role
3. Add required permission (e.g., `widgets:users-table:manage` for User Management widget)
4. User may need to re-authenticate after role change

### "Module not found: @radix-ui/themes"

**Root cause:** Peer dependency not installed.

**Fix:**
```bash
npm install @radix-ui/themes @tanstack/react-query
```

### "Hooks can only be called inside the body of a function component"

**Root cause:** Widget used outside React component, or provider missing.

**Fix:**
1. Ensure widget is inside a React functional component
2. Verify `QueryClientProvider` wraps the component tree

### "Access token expired"

**Root cause:** Backend SDK tokens expire after 1 hour.

**Fix:**
1. Implement token refresh logic in your app
2. Generate new token from backend when current token expires
3. Or use AuthKit tokens which auto-refresh

### "Widget shows 'Unauthorized' message"

**Root cause:** Invalid or missing access token.

**Fix:**
1. Verify `accessToken` prop is passed to widget
2. Check token is not null/undefined
3. Verify token scopes match widget requirements (see fetched docs)

## Related Skills

- **workos-authkit-nextjs** - AuthKit integration for Next.js (provides access tokens for widgets)
- **workos-authkit-react** - AuthKit integration for React apps (provides access tokens for widgets)
- **workos-rbac** - Role-based access control configuration (required for widget permissions)
- **workos-api-widgets** - Backend API for widget token generation
