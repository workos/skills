---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for implementation details:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

These docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Project Structure

- Confirm React application (16.8+ for hooks support)
- Confirm `package.json` exists

### Environment Variables

Check for WorkOS credentials:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Role Configuration (CRITICAL)

**Widget tokens require role-based permissions.** Check WorkOS Dashboard → Roles:

```
Widget                  --> Required Permission
<UsersManagement />     --> widgets:users-table:manage
<UserSessions />        --> (no special permission)
<UserSecurity />        --> (no special permission)
<UserProfile />         --> (no special permission)
<Pipes />               --> (check fetched docs for requirement)
<OrganizationSwitcher/> --> (check fetched docs for requirement)
```

**For new accounts:** Default "Admin" role has all permissions.

**For existing accounts:** Go to Dashboard → Roles and assign widget permissions to appropriate roles.

## Step 3: Install Dependencies

Widgets has **required peer dependencies**. Install all three:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies?**
- `@radix-ui/themes` - UI components and styling
- `@tanstack/react-query` - Data fetching and caching

These are peers (not bundled) to avoid version conflicts if already in your app.

**Verify:** All three packages exist in `node_modules/` before continuing.

## Step 4: Authorization Token Strategy (Decision Tree)

Widgets require an authorization token with appropriate scope. Choose your token source:

```
Using AuthKit SDK?
  |
  +-- YES --> Use access token from authkit-js/authkit-react
  |           (token already has correct scopes)
  |
  +-- NO  --> Use backend SDK to generate widget token
              (token expires after 1 hour)
```

### Option A: AuthKit SDK Token (Recommended)

If using `authkit-js` or `authkit-react`, the access token is provided automatically:

```tsx
import { useAuth } from '@workos-inc/authkit-react';
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage() {
  const { accessToken } = useAuth();
  
  return <UserProfile token={accessToken} />;
}
```

### Option B: Backend SDK Token

If NOT using AuthKit client SDKs, generate a scoped token server-side:

**Step 4.1:** Identify widget scope from docs (e.g., `widgets:user-profile:read`)

**Step 4.2:** Call backend SDK's token generation method:

```typescript
// Example pattern - exact method in fetched docs
const token = await workos.widgets.getToken({
  userId: 'user_123',
  organizationId: 'org_456', // if widget is org-scoped
  scope: 'widgets:user-profile:read'
});
```

**Step 4.3:** Pass token to client via API route or server props

**Critical:** Token expires after 1 hour. Implement refresh logic if needed.

## Step 5: Provider Setup (REQUIRED)

Widgets require **two providers** wrapping your app:

```tsx
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@radix-ui/themes/styles.css'; // CRITICAL: Must import Radix styles

const queryClient = new QueryClient();

export default function App({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        {children}
      </Theme>
    </QueryClientProvider>
  );
}
```

**Do NOT skip the CSS import** - widgets will render unstyled without it.

### Framework-Specific Provider Placement

```
Framework          --> Provider Location
Next.js App Router --> app/layout.tsx (server component wrapping client providers)
Next.js Pages      --> _app.tsx
Create React App   --> src/index.tsx or src/App.tsx
Remix              --> app/root.tsx
```

Check fetched "quick-start" doc for framework examples.

## Step 6: Widget Integration (Per-Widget Steps)

### User Profile Widget

**Permissions required:** None

**Basic usage:**

```tsx
import { UserProfile } from '@workos-inc/widgets';

<UserProfile token={accessToken} />
```

**Capabilities:**
- View profile details
- Edit display name

### User Security Widget

**Permissions required:** None

**Basic usage:**

```tsx
import { UserSecurity } from '@workos-inc/widgets';

<UserSecurity token={accessToken} />
```

**Capabilities:**
- Set/change password
- Configure MFA
- Reset MFA

### User Sessions Widget

**Permissions required:** None

**Basic usage:**

```tsx
import { UserSessions } from '@workos-inc/widgets';

<UserSessions token={accessToken} />
```

**Capabilities:**
- View active sessions across devices
- Sign out of individual sessions

### User Management Widget

**Permissions required:** `widgets:users-table:manage`

**Basic usage:**

```tsx
import { UsersManagement } from '@workos-inc/widgets';

<UsersManagement token={accessToken} organizationId="org_123" />
```

**Capabilities:**
- Invite users
- Remove users  
- Change user roles

**Critical:** User must have a role with `widgets:users-table:manage` permission. Widget will error if permission missing.

### Pipes Widget

**Permissions required:** Check fetched docs

**Basic usage:**

```tsx
import { Pipes } from '@workos-inc/widgets';

<Pipes token={accessToken} />
```

**Capabilities:**
- Manage third-party app connections
- (See fetched docs for full feature list)

### Organization Switcher Widget

**Permissions required:** Check fetched docs

Check fetched docs for usage pattern and capabilities.

## Step 7: Styling Customization (Optional)

Widgets use Radix Themes for styling. Customize via `Theme` component props:

```tsx
<Theme accentColor="blue" grayColor="slate" radius="large">
  <UserProfile token={accessToken} />
</Theme>
```

**Available customizations:** See Radix Themes docs for `accentColor`, `grayColor`, `radius`, `scaling`, `panelBackground`.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check all dependencies installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check providers exist (adjust path for your framework)
grep -E "(QueryClientProvider|Theme)" app/layout.tsx src/App.tsx _app.tsx app/root.tsx 2>/dev/null

# 3. Check Radix CSS import exists
grep "@radix-ui/themes/styles.css" app/layout.tsx src/App.tsx src/index.tsx _app.tsx app/root.tsx 2>/dev/null || echo "FAIL: Radix CSS import missing"

# 4. Check widget imports exist
grep "from '@workos-inc/widgets'" -r app/ src/ --include="*.tsx" --include="*.jsx"

# 5. Build succeeds
npm run build
```

**If check #3 fails:** Add `import '@radix-ui/themes/styles.css'` where Theme provider is used.

## Error Recovery

### "token is undefined" or "invalid token"

**Root cause:** Token not generated or passed correctly.

**Fix:**
1. For AuthKit: Verify `useAuth()` hook returns `accessToken`
2. For backend SDK: Verify token generation succeeds and token is passed to client
3. Check token hasn't expired (1 hour TTL for backend-generated tokens)

### "Insufficient permissions" error in widget

**Root cause:** User's role lacks required widget permission.

**Fix:**
1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Add required permission (e.g., `widgets:users-table:manage` for UsersManagement)
4. Wait ~1 minute for permission sync
5. Regenerate token (backend SDK tokens don't auto-refresh permissions)

### Widgets render unstyled / broken layout

**Root cause:** Radix Themes CSS not imported.

**Fix:**
1. Add `import '@radix-ui/themes/styles.css'` in same file as `<Theme>` provider
2. Verify import comes BEFORE widget component imports
3. Clear build cache: `rm -rf .next` (Next.js) or `rm -rf build` (CRA)

### "QueryClient not found" error

**Root cause:** `QueryClientProvider` missing or widget outside provider tree.

**Fix:**
1. Verify `QueryClientProvider` wraps component tree
2. Check widget component is child of provider (not sibling)
3. For server components: Ensure provider is in client component wrapper

### "Cannot use hooks outside function component"

**Root cause:** Widget used in class component or non-React context.

**Fix:** Widgets are function components requiring React 16.8+. Wrap in function component if needed.

### Token expires during long sessions

**Root cause:** Backend-generated tokens have 1-hour TTL.

**Fix:**
1. Implement token refresh logic in your app
2. OR migrate to AuthKit SDK for auto-refreshing tokens
3. OR accept re-authentication after 1 hour

### Module not found: '@radix-ui/themes'

**Root cause:** Peer dependency not installed.

**Fix:**
```bash
npm install @radix-ui/themes @tanstack/react-query
```

Never install only `@workos-inc/widgets` - peers are required.

## Related Skills

- **workos-authkit-react**: For access token generation via AuthKit
- **workos-authkit-nextjs**: For Next.js integration with AuthKit
- **workos-rbac**: For managing role permissions in WorkOS Dashboard
- **workos-pipes**: For Pipes integration details
- **workos-api-widgets**: For backend token generation via API
