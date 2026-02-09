---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch ALL of these URLs before writing any code:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

These docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required WorkOS credentials:

```bash
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "Missing env vars"
```

- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Critical:** API key must have appropriate permissions in WorkOS Dashboard for widgets you plan to use.

### React Project Structure

Confirm this is a React application:

```bash
grep '"react"' package.json || echo "Not a React project"
```

Widgets require React. They work with both client and server rendering patterns.

## Step 3: Install Dependencies

**CRITICAL:** Widgets package requires peer dependencies. Install all three:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why three packages:**

- `@workos-inc/widgets` - The widgets themselves
- `@radix-ui/themes` - UI components and styling (peer dependency)
- `@tanstack/react-query` - Data fetching and caching (peer dependency)

Peer dependencies avoid version conflicts and bundle bloat in apps that already use these libraries.

**Verify installation:**

```bash
ls node_modules/@workos-inc/widgets node_modules/@radix-ui/themes node_modules/@tanstack/react-query 2>/dev/null | wc -l
# Should output: 3
```

## Step 4: Widget Selection (Decision Tree)

Determine which widget(s) to implement based on requirements:

```
What user capability is needed?
  |
  +-- Manage active sessions across devices --> <UserSessions />
  |                                              (no special permissions)
  |
  +-- Configure MFA, change password ---------> <UserSecurity />
  |                                              (no special permissions)
  |
  +-- View/edit profile, display name --------> <UserProfile />
  |                                              (no special permissions)
  |
  +-- Admin: invite/remove users, change roles -> <UsersManagement />
  |                                               (requires widgets:users-table:manage)
  |
  +-- Manage third-party connections ----------> <Pipes />
  |                                              (check docs for permissions)
  |
  +-- Switch between organizations ------------> <OrganizationSwitcher />
                                                 (check docs for permissions)
```

**Permission Note:** Most widgets require no special permissions EXCEPT:

- `<UsersManagement />` - user MUST have role with `widgets:users-table:manage` permission
- Check fetched docs for other widgets' permission requirements

## Step 5: Authorization Token Acquisition (CRITICAL)

**ALL widgets require an authorization token.** Choose acquisition method:

### Method A: Using AuthKit SDK (Recommended)

If you use `authkit-js` or `authkit-react`:

1. Extract access token from AuthKit's auth state
2. Pass token directly to widget

Example pattern (see Quick Start docs for exact API):

```tsx
const { accessToken } = useAuth(); // or equivalent from authkit
<UserProfile token={accessToken} />
```

### Method B: Using Backend SDK

If using WorkOS backend SDK (Node.js, Python, etc.):

1. Call SDK's "get token" method with appropriate scope for your widget
2. Pass to frontend securely
3. Widget tokens expire after 1 hour - handle refresh

**Token scope must match widget permissions** - see fetched docs for each widget's required scope.

### Permission Validation (BLOCKING)

**Before generating tokens:** Verify user role has required permissions.

Check WorkOS Dashboard → Roles page:

- New accounts: "Admin" role has all widget permissions by default
- Existing accounts: Must manually assign permissions to roles

Reference: https://workos.com/docs/authkit/roles-and-permissions

**If token generation fails:** User's role lacks the required permission for that widget.

## Step 6: Widget Implementation Pattern

All widgets follow this general structure (exact props from docs):

```tsx
import { WidgetName } from '@workos-inc/widgets';
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Create QueryClient (per docs recommendation)
const queryClient = new QueryClient();

// 2. Wrap widget in required providers
export function MyWidgetPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        <WidgetName token={authToken} {...otherProps} />
      </Theme>
    </QueryClientProvider>
  );
}
```

**Required wrappers:**

- `QueryClientProvider` - for data fetching (TanStack Query)
- `Theme` - for Radix UI styling

Check Quick Start docs for framework-specific integration (Next.js, Vite, etc.).

## Step 7: Widget-Specific Configuration

Reference the fetched docs for each widget's specific props and behavior:

### UserSessions

- **Capability:** View active sessions, sign out of individual sessions
- **Permissions:** None required
- **Props:** Check user-sessions docs for current API

### UserSecurity

- **Capability:** Set/change password, configure/reset MFA
- **Permissions:** None required
- **Props:** Check user-security docs for current API

### UserProfile

- **Capability:** View profile, edit display name
- **Permissions:** None required
- **Props:** Check user-profile docs for current API

### UsersManagement

- **Capability:** Invite users, remove users, change roles (admin only)
- **Permissions:** `widgets:users-table:manage` REQUIRED
- **Props:** Check user-management docs for current API

### Pipes

- **Capability:** Manage third-party account connections
- **Permissions:** Check pipes docs
- **Props:** Check pipes docs for current API

### OrganizationSwitcher

- **Capability:** Switch between user's organizations
- **Permissions:** Check organization-switcher docs
- **Props:** Check organization-switcher docs for current API

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Verify all dependencies installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check widget imports exist in code
grep -r "from '@workos-inc/widgets'" src/ app/ || echo "No widget imports found"

# 3. Check QueryClientProvider wrapper exists
grep -r "QueryClientProvider" src/ app/ || echo "Missing QueryClientProvider"

# 4. Check Theme wrapper exists
grep -r "from '@radix-ui/themes'" src/ app/ || echo "Missing Radix Theme"

# 5. Build succeeds
npm run build
```

**If build fails:**

- Check all peer dependencies installed (Step 3)
- Check required providers are present (Step 6)
- Check token prop is passed to widget

## Error Recovery

### "Token expired" or 401 errors

**Root cause:** Widget tokens expire after 1 hour.

Fix:

1. Implement token refresh logic
2. If using AuthKit, check if access token is being refreshed automatically
3. If using backend SDK, re-fetch token when expired

### "Permission denied" for UsersManagement widget

**Root cause:** User's role lacks `widgets:users-table:manage` permission.

Fix:

1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Add `widgets:users-table:manage` permission to that role
4. User may need to re-authenticate to receive updated permissions

Reference: https://workos.com/docs/authkit/roles-and-permissions

### "Module not found: @workos-inc/widgets"

**Root cause:** Widget package not installed or wrong import path.

Fix:

```bash
# Reinstall all required packages
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

### "QueryClient is not defined" or provider errors

**Root cause:** Missing TanStack Query setup.

Fix:

1. Verify `@tanstack/react-query` is installed
2. Create `QueryClient` instance
3. Wrap widget in `QueryClientProvider` (see Step 6)

### "Theme provider missing" or styling broken

**Root cause:** Missing Radix Theme wrapper.

Fix:

1. Verify `@radix-ui/themes` is installed
2. Import `Theme` from `@radix-ui/themes`
3. Wrap widget in `<Theme>` component (see Step 6)

### Widget renders but shows "Unauthorized"

**Root cause:** Token invalid or missing required scope.

Debug steps:

1. Check token is being passed to widget's `token` prop
2. Verify token was generated with correct scope for widget
3. Check token hasn't expired (1 hour lifetime)
4. Confirm user's role has required permissions in Dashboard

### Build fails with peer dependency warnings

**Root cause:** Version mismatch between widgets and peer dependencies.

Fix:

```bash
# Check installed versions
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# Update to compatible versions (check package.json peerDependencies)
npm install @workos-inc/widgets@latest @radix-ui/themes@latest @tanstack/react-query@latest
```

## Related Skills

- **workos-authkit-nextjs**: For obtaining access tokens with AuthKit in Next.js
- **workos-admin-portal**: For enterprise admin features beyond widget capabilities
