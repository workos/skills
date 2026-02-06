---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- generated -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### WorkOS Dashboard Setup (REQUIRED)

Before adding widgets, verify in WorkOS Dashboard:

1. **Roles & Permissions** page exists
2. At least one role has Widget permissions assigned
3. For User Management widget: role must have `widgets:users-table:manage` permission

**New accounts:** Admin role has all Widget permissions by default.

**Existing accounts:** Manually assign permissions on Roles page before proceeding.

## Step 3: Install Dependencies

Detect package manager from lock file:

```
Lock file present?
  |
  +-- package-lock.json --> npm install
  |
  +-- yarn.lock         --> yarn add
  |
  +-- pnpm-lock.yaml    --> pnpm add
  |
  +-- bun.lockb         --> bun add
```

Install these packages:

```bash
# All three are REQUIRED
<package-manager> install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Verify before continuing:**

```bash
# All three must exist
ls node_modules/@workos-inc/widgets
ls node_modules/@radix-ui/themes
ls node_modules/@tanstack/react-query
```

**Why three packages:**

- `@workos-inc/widgets` - Widget components
- `@radix-ui/themes` - UI system (peer dependency, avoids duplication)
- `@tanstack/react-query` - Data fetching (peer dependency, avoids duplication)

## Step 4: Token Strategy (Decision Tree)

Widgets require authorization tokens with specific scopes. Choose strategy:

```
Using AuthKit SDK?
  |
  +-- YES --> Use AuthKit's access token (Step 4A)
  |
  +-- NO  --> Generate token via backend SDK (Step 4B)
```

### Step 4A: AuthKit Token Strategy

If using `authkit-js` or `authkit-react`:

1. Access token is already available from AuthKit
2. Pass directly to widget components
3. AuthKit handles token refresh automatically

**Pattern:**

```typescript
import { useAuth } from '@workos-inc/authkit-react';

const { accessToken } = useAuth();
// Pass accessToken to widget components
```

### Step 4B: Backend SDK Token Strategy

If NOT using AuthKit, generate tokens via WorkOS backend SDK:

1. Use SDK's "get token" method with widget-specific scope
2. Tokens expire after 1 hour - implement refresh logic
3. User must have role with correct Widget permissions

**Check Quick Start docs for exact SDK method name.**

**Critical:** Token generation fails if user lacks required role permissions. Fix in WorkOS Dashboard Roles page before debugging code.

## Step 5: Provider Setup (REQUIRED)

**CRITICAL:** Wrap your app in required providers. This step is BLOCKING for all widgets.

### React Query Provider

All widgets use TanStack Query for data fetching:

```typescript
// app/layout.tsx or _app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Radix Themes Provider

All widgets use Radix UI components:

```typescript
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css'; // REQUIRED

export default function RootLayout({ children }) {
  return (
    <Theme>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Theme>
  );
}
```

**Both providers are required** - widgets will error without them.

## Step 6: Widget Integration (Choose Widget Type)

Select widget based on use case:

```
What should users manage?
  |
  +-- Profile info      --> UserProfile widget
  |
  +-- Password/MFA      --> UserSecurity widget
  |
  +-- Active sessions   --> UserSessions widget
  |
  +-- Org members       --> UsersManagement widget (requires admin role)
  |
  +-- Third-party apps  --> Pipes widget
  |
  +-- Switch orgs       --> OrganizationSwitcher widget
```

### Permission Requirements

**NO permissions required:**

- UserProfile
- UserSecurity
- UserSessions

**Requires `widgets:users-table:manage` permission:**

- UsersManagement

Check docs for Pipes and OrganizationSwitcher permission requirements.

### Widget Component Pattern

All widgets follow this pattern:

```typescript
import { WidgetName } from '@workos-inc/widgets';

function MyPage() {
  const token = /* get token from Step 4 */;
  
  return <WidgetName token={token} />;
}
```

**Check docs for:**

- Exact component names (case-sensitive)
- Additional props available per widget
- Styling/theming options via Radix

## Step 7: Framework-Specific Setup

### Next.js App Router

Widgets are client components. Add `'use client'` directive:

```typescript
'use client';

import { UserProfile } from '@workos-inc/widgets';

export default function ProfilePage() {
  // component code
}
```

Providers go in `app/layout.tsx`.

### Next.js Pages Router

Providers go in `_app.tsx`. Widgets work in any page component.

### Vite/Create React App

Providers go in root component (usually `App.tsx` or `index.tsx`).

**See GitHub examples:** https://github.com/workos/widgets-examples

## Verification Checklist (ALL MUST PASS)

Run these commands. **Do not mark complete until all pass:**

```bash
# 1. Check all packages installed
npm ls @workos-inc/widgets @radix-ui/themes @tanstack/react-query 2>/dev/null | grep -E "(widgets|themes|react-query)"

# 2. Check Radix styles imported (CRITICAL)
grep -r "@radix-ui/themes/styles.css" . --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js"

# 3. Check QueryClientProvider exists
grep -r "QueryClientProvider" . --include="*.tsx" --include="*.jsx"

# 4. Check Radix Theme provider exists
grep -r "<Theme" . --include="*.tsx" --include="*.jsx"

# 5. Build succeeds
npm run build
```

**If checks #2-4 fail:** Go back to Step 5 and add providers. These are not optional.

## Error Recovery

### "Cannot read property of undefined" in widget

**Root cause:** Missing QueryClientProvider or Theme provider.

**Fix:**

1. Verify both providers wrap your app (Step 5)
2. Check import paths are correct
3. Ensure providers are ABOVE widget components in tree

### "Token is invalid" or 401 errors

**Root cause decision tree:**

```
Token error?
  |
  +-- "invalid scope"     --> User lacks required role permissions
  |                          Fix: Assign permissions in WorkOS Dashboard
  |
  +-- "token expired"     --> Token older than 1 hour
  |                          Fix: Implement token refresh logic
  |
  +-- "invalid signature" --> Wrong API key or malformed token
                             Fix: Verify WORKOS_API_KEY in environment
```

**Critical:** For UsersManagement widget, verify user has `widgets:users-table:manage` permission FIRST before debugging token code.

### "Module not found" for @workos-inc/widgets

**Causes:**

1. Package not installed - run install command from Step 3
2. Incorrect import path - check docs for exact component name
3. Node modules corrupted - delete node_modules and reinstall

**Verify:**

```bash
ls node_modules/@workos-inc/widgets/package.json
```

### Styling issues or components unstyled

**Root cause:** Missing Radix Themes CSS import.

**Fix:**

```typescript
// MUST be at top of layout/app file
import '@radix-ui/themes/styles.css';
```

This import is REQUIRED - Radix components are unstyled without it.

### "QueryClient not found" error

**Root cause:** Widget rendered outside QueryClientProvider.

**Fix:** Move QueryClientProvider higher in component tree - typically in root layout/app file.

### Widget works in dev but fails in production build

**Causes:**

1. Environment variables not set in production
2. SSR/SSG issues (widgets are client-only)
3. Missing peer dependencies in production bundle

**Fixes:**

- Verify WORKOS_* env vars in production environment
- For Next.js: ensure 'use client' directive on pages using widgets
- Check build logs for missing dependency warnings

## Related Skills

- **workos-authkit-nextjs**: For token generation via AuthKit
- **workos-admin-portal**: For organization-level management UI
