---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for widget implementation:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before proceeding.

### Project Structure

- Confirm `package.json` exists
- Confirm project is React-based (check for `"react"` in dependencies)

## Step 3: Install Widget Package

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies:**

- `@radix-ui/themes` - UI components and styling API
- `@tanstack/react-query` - Data fetching and caching

These are required as peers to avoid version conflicts and bundle duplication in apps that already use them.

**Verify:** All three packages exist in `node_modules` before continuing.

## Step 4: Widget Selection (Decision Tree)

```
What does user need to manage?
  |
  +-- Sessions across devices --> <UserSessions />
  |
  +-- Password/MFA settings --> <UserSecurity />
  |
  +-- Profile/display name --> <UserProfile />
  |
  +-- Organization members --> <UsersManagement /> (requires admin role)
  |
  +-- Third-party connections --> <Pipes />
  |
  +-- Organization switching --> <OrganizationSwitcher />
```

**Permission requirements:**

- `<UserSessions />`, `<UserSecurity />`, `<UserProfile />` - NO special permissions required
- `<UsersManagement />` - User MUST have role with `widgets:users-table:manage` permission
- `<Pipes />` - Check docs for exact permission scope
- `<OrganizationSwitcher />` - Check docs for exact permission scope

## Step 5: Token Acquisition (CRITICAL)

All widgets require an authorization token. Choose method based on auth stack:

### Method A: Using AuthKit Libraries

If using `authkit-js` or `authkit-react`:

```tsx
import { useAuth } from "@workos-inc/authkit-react";

function MyComponent() {
  const { accessToken } = useAuth();

  return <UserProfile token={accessToken} />;
}
```

**Token source:** AuthKit provides access token automatically.

### Method B: Using WorkOS Backend SDK

If NOT using AuthKit libraries, generate widget token via backend SDK:

```typescript
// Server-side code
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

const token = await workos.widgets.getToken({
  user: userId,
  organization: organizationId, // Optional - required for org-scoped widgets
  scope: ["widgets:users-table:manage"], // Scope must match widget requirements
});
```

**Token properties:**

- Expires after 1 hour
- Must contain correct scope for target widget
- User's role must have permissions matching the scope

**If token generation fails:**

1. Check user has role with required permissions (WorkOS Dashboard → Roles)
2. New accounts have "Admin" role with all permissions — existing accounts must assign manually
3. Verify scope string exactly matches required permission

## Step 6: Provider Setup (REQUIRED)

Wrap your app in required providers. Order matters:

```tsx
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@radix-ui/themes/styles.css"; // Required for Radix Themes

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>{/* Your app and widgets here */}</Theme>
    </QueryClientProvider>
  );
}
```

**Critical:**

- `QueryClientProvider` MUST wrap the entire app for widget data fetching
- `Theme` MUST wrap widgets for Radix UI styling
- Import Radix CSS or widgets will have no styles

## Step 7: Widget Integration

### Basic Widget Usage

```tsx
import { UserSessions } from '@workos-inc/widgets';

function SessionsPage() {
  const token = /* get from Step 5 */;

  return <UserSessions token={token} />;
}
```

### Framework-Specific Integration

```
Framework?
  |
  +-- Next.js App Router --> Use 'use client' directive, get token from server action
  |
  +-- Next.js Pages Router --> Use client-side rendering, getServerSideProps for token
  |
  +-- Vite/CRA --> Standard React component, fetch token from API route
  |
  +-- Server-rendered --> Check Widgets examples repo for SSR patterns
```

**Next.js App Router Example:**

```tsx
"use client";

import { UserProfile } from "@workos-inc/widgets";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch token from your API route
    fetch("/api/widget-token")
      .then((r) => r.json())
      .then((data) => setToken(data.token));
  }, []);

  if (!token) return <div>Loading...</div>;

  return <UserProfile token={token} />;
}
```

**Widgets examples repo:** https://github.com/workos/widgets-examples (check for framework-specific patterns)

## Step 8: Role and Permission Setup (Admin Widgets Only)

**Skip this step if using UserSessions, UserSecurity, or UserProfile.**

For `<UsersManagement />` and other admin widgets:

1. Navigate to WorkOS Dashboard → Roles
2. Find or create role for admin users
3. Ensure role has required permission:
   - `<UsersManagement />` requires `widgets:users-table:manage`
   - Other admin widgets: check fetched docs for exact permission strings
4. Assign role to users who should access the widget

**New accounts:** "Admin" role exists with all permissions pre-assigned.
**Existing accounts:** Must manually assign permissions to roles.

**Verification:** User without proper role will fail token generation with permission error.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check all packages installed
npm ls @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null

# 3. Check Radix CSS import exists (if using custom theme)
grep "@radix-ui/themes/styles.css" -r src/ app/ 2>/dev/null || echo "WARNING: May need Radix CSS import"

# 4. Check providers are set up
grep -E "QueryClientProvider|Theme" -r src/ app/ 2>/dev/null

# 5. Build succeeds
npm run build
```

**If check #4 fails:** Go back to Step 6 and add providers. Widgets will not function without them.

## Error Recovery

### "Module not found: @workos-inc/widgets"

**Root cause:** Package not installed or installed in wrong location.

**Fix:**

1. Run `npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query`
2. Verify `node_modules/@workos-inc/widgets` exists
3. Clear build cache: `rm -rf .next` (Next.js) or `rm -rf dist` (Vite)

### "Token expired" or 401 errors in widget

**Root cause:** Widget tokens expire after 1 hour.

**Fix:**

1. Implement token refresh logic — fetch new token when widget requests fail with 401
2. For long-lived sessions, refresh token proactively before 1-hour expiration
3. Example refresh pattern:
   ```tsx
   useEffect(() => {
     const interval = setInterval(refreshToken, 50 * 60 * 1000); // 50 minutes
     return () => clearInterval(interval);
   }, []);
   ```

### "Permission denied" during token generation

**Root cause:** User's role lacks required widget permission.

**Fix:**

1. WorkOS Dashboard → Roles → find user's role
2. Add required permission (e.g., `widgets:users-table:manage`)
3. Verify user is assigned to that role
4. Retry token generation

### "Invalid scope" error

**Root cause:** Scope string doesn't match required permission for widget.

**Fix:**

1. Check fetched docs for exact scope string required by widget
2. Ensure scope array in `getToken()` matches exactly (case-sensitive)
3. Common scopes:
   - `widgets:users-table:manage` - UsersManagement widget
   - Check docs for other widget-specific scopes

### Widgets render but have no styles

**Root cause:** Radix Themes CSS not imported.

**Fix:**

1. Add import: `import '@radix-ui/themes/styles.css';` in root component or `_app.tsx`
2. Verify `<Theme>` wrapper exists around widgets
3. Rebuild: `npm run build`

### "QueryClient not found" errors

**Root cause:** Missing QueryClientProvider or provider in wrong location.

**Fix:**

1. Ensure `<QueryClientProvider>` wraps entire app (not just widget component)
2. Provider must be ABOVE widget component in tree
3. Check provider setup in Step 6

### Widget works locally but fails in production

**Root cause:** Environment variables not set in production deployment.

**Fix:**

1. Verify `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` exist in production environment
2. For Vercel: Project Settings → Environment Variables
3. For other platforms: check platform-specific env var configuration
4. Redeploy after adding variables

### "Hydration mismatch" in Next.js

**Root cause:** Widget rendered server-side but expects client-side only.

**Fix:**

1. Add `'use client'` directive to component using widget
2. Or use dynamic import with `ssr: false`:
   ```tsx
   const UserProfile = dynamic(
     () => import("@workos-inc/widgets").then((mod) => mod.UserProfile),
     { ssr: false },
   );
   ```

## Related Skills

- **workos-authkit-nextjs**: Next.js AuthKit integration for access token management
- **workos-authkit-react**: React AuthKit integration for access token management
