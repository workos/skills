---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- generated -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order. They are the source of truth for implementation:

1. https://workos.com/docs/widgets/quick-start
2. https://workos.com/docs/widgets/tokens
3. https://workos.com/docs/widgets/user-sessions
4. https://workos.com/docs/widgets/user-security
5. https://workos.com/docs/widgets/user-profile
6. https://workos.com/docs/widgets/user-management
7. https://workos.com/docs/widgets/pipes
8. https://workos.com/docs/widgets/organization-switcher

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Structure

- Confirm React framework (Next.js, Remix, Vite, etc.)
- Confirm `package.json` exists

## Step 3: Install Dependencies

Detect package manager (npm, yarn, pnpm, bun), then install:

```bash
# All three packages required - peer dependencies
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Critical:** All three packages are required even if you already have Radix or TanStack Query. Widgets expects specific peer dependency versions.

**Verify before continuing:**

```bash
# All three must exist
ls node_modules/@workos-inc/widgets node_modules/@radix-ui/themes node_modules/@tanstack/react-query
```

## Step 4: Provider Setup (REQUIRED)

**You MUST wrap your app in two providers for Widgets to work.**

### Framework-Specific Provider Location

Determine where to add providers based on framework:

```
Framework?
  |
  +-- Next.js App Router --> app/layout.tsx (root layout)
  |
  +-- Next.js Pages      --> pages/_app.tsx
  |
  +-- Remix             --> app/root.tsx
  |
  +-- Vite/CRA          --> src/App.tsx or src/main.tsx
```

### Provider Structure (EXACT ORDER)

```tsx
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@radix-ui/themes/styles.css';

const queryClient = new QueryClient();

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        {children}
      </Theme>
    </QueryClientProvider>
  );
}
```

**Critical order:** QueryClientProvider OUTSIDE, Theme INSIDE. Reversing breaks data fetching.

**CSS import required:** The `@radix-ui/themes/styles.css` import is mandatory. Without it, widgets render unstyled.

## Step 5: Token Acquisition (Decision Tree)

Widgets require authorization tokens with specific scopes. Choose token acquisition method:

```
Using AuthKit SDK?
  |
  +-- YES (authkit-js/authkit-react)
  |     |
  |     +-- Get token from useAuth() hook
  |     |   const { accessToken } = useAuth();
  |     |
  |     +-- Pass to widget: token={accessToken}
  |
  +-- NO (custom auth or backend SDK)
        |
        +-- Backend: Call workos.getToken() with widget scope
        |   - userSessions: 'widgets:user-sessions:read'
        |   - userSecurity: 'widgets:user-security:manage'
        |   - userProfile: 'widgets:user-profile:manage'
        |   - usersManagement: 'widgets:users-table:manage'
        |   - pipes: 'widgets:pipes:read widgets:pipes:write'
        |
        +-- Frontend: Fetch token from your API route
        |   fetch('/api/widget-token?scope=widgets:user-sessions:read')
        |
        +-- Pass to widget: token={fetchedToken}
```

**Token lifespan:** Tokens expire after 1 hour. For long-lived pages, implement token refresh logic.

**Permission check:** User's assigned role MUST include the required permission. New WorkOS accounts have "Admin" role with all permissions. Existing accounts: assign permissions in WorkOS Dashboard → Roles.

## Step 6: Widget Integration (Choose Your Widget)

### User Sessions Widget

**No special permissions required.**

```tsx
import { UserSessions } from '@workos-inc/widgets';

function SessionsPage() {
  const token = /* token from Step 5 */;
  
  return <UserSessions token={token} />;
}
```

**What it does:** Shows active sessions across devices. Users can sign out of individual sessions.

**Verification:** User should see list of active sessions with device/browser info.

---

### User Security Widget

**No special permissions required.**

```tsx
import { UserSecurity } from '@workos-inc/widgets';

function SecurityPage() {
  const token = /* token from Step 5 */;
  
  return <UserSecurity token={token} />;
}
```

**What it does:** Password management, MFA enrollment/reset.

**Verification:** User should see password change form and MFA options.

---

### User Profile Widget

**No special permissions required.**

```tsx
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage() {
  const token = /* token from Step 5 */;
  
  return <UserProfile token={token} />;
}
```

**What it does:** View/edit display name and basic profile info.

**Verification:** User should see profile form with editable display name.

---

### User Management Widget

**Requires `widgets:users-table:manage` permission.**

```tsx
import { UsersManagement } from '@workos-inc/widgets';

function AdminUsersPage() {
  const token = /* token from Step 5 with correct scope */;
  const organizationId = /* current org ID */;
  
  return <UsersManagement token={token} organizationId={organizationId} />;
}
```

**What it does:** Organization admins can invite users, remove users, change roles.

**Critical:** User must have admin role with `widgets:users-table:manage` permission or widget shows permission error.

**Verification:** Admin should see user list with invite/remove/role actions.

---

### Pipes Widget

**Requires `widgets:pipes:read widgets:pipes:write` permissions.**

```tsx
import { Pipes } from '@workos-inc/widgets';

function IntegrationsPage() {
  const token = /* token from Step 5 with correct scopes */;
  
  return <Pipes token={token} />;
}
```

**What it does:** Connect/disconnect third-party accounts for data syncing.

**Verification:** User should see available integrations and connection status.

---

### Organization Switcher Widget

```tsx
import { OrganizationSwitcher } from '@workos-inc/widgets';

function Header() {
  const token = /* token from Step 5 */;
  
  return <OrganizationSwitcher token={token} />;
}
```

**What it does:** Switch between organizations user belongs to.

**Verification:** User should see dropdown with organization list (if member of multiple orgs).

## Step 7: Styling Customization (Optional)

Widgets use Radix Themes for styling. Customize via Theme component props:

```tsx
<Theme
  accentColor="blue"
  grayColor="slate"
  radius="medium"
  scaling="100%"
>
  {children}
</Theme>
```

**See Radix Themes docs for full theming API:** https://www.radix-ui.com/themes/docs/theme/overview

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check all dependencies installed
npm ls @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check providers exist in root layout/app file
grep -r "QueryClientProvider" app/ pages/ src/ 2>/dev/null
grep -r "<Theme" app/ pages/ src/ 2>/dev/null

# 3. Check Radix CSS imported
grep -r "@radix-ui/themes/styles.css" app/ pages/ src/ 2>/dev/null

# 4. Check widget import exists
grep -r "from '@workos-inc/widgets'" app/ pages/ src/ 2>/dev/null

# 5. Build succeeds
npm run build
```

**All checks must pass.** If any fail, return to corresponding step.

## Error Recovery

### "QueryClient not found" or "useQuery is not defined"

**Root cause:** Missing or incorrectly ordered providers.

**Fix:**
1. Verify `QueryClientProvider` wraps entire app
2. Verify it's OUTSIDE `<Theme>` component
3. Verify `queryClient` instance exists: `const queryClient = new QueryClient();`

---

### Widget renders without styles (plain HTML)

**Root cause:** Radix Themes CSS not imported.

**Fix:**
1. Add `import '@radix-ui/themes/styles.css';` in root layout/app file
2. Verify CSS file exists: `ls node_modules/@radix-ui/themes/styles.css`
3. Clear build cache and rebuild

---

### "Invalid token" or "Token expired"

**Root cause:** Token missing, malformed, or expired (1 hour lifespan).

**Fix for malformed token:**
1. Verify token string starts with expected format
2. Check token fetching logic returns string, not object
3. Log token length (should be substantial JWT)

**Fix for expired token:**
1. Implement token refresh on 401 response
2. For long-lived pages, fetch fresh token every 45 minutes
3. Example refresh pattern:
```tsx
useEffect(() => {
  const interval = setInterval(refreshToken, 45 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

---

### "Permission denied" in User Management widget

**Root cause:** User's role lacks `widgets:users-table:manage` permission.

**Fix:**
1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Add `widgets:users-table:manage` permission to role
4. User must re-authenticate to get updated permissions in token

**Verify permission in token:**
```bash
# Decode JWT to check permissions (use jwt.io or jwt-cli)
echo $TOKEN | jwt decode -
# Look for "permissions" array containing required scope
```

---

### "Organization not found" in Organization Switcher

**Root cause:** User not member of any organizations or organizationId mismatch.

**Fix:**
1. Verify user is assigned to at least one organization in WorkOS Dashboard
2. Check organizationId passed to widget matches user's org membership
3. For multi-org users, verify token includes organization context

---

### TypeScript errors on widget imports

**Root cause:** Type definitions missing or SDK version mismatch.

**Fix:**
1. Verify SDK version: `npm ls @workos-inc/widgets`
2. Update TypeScript: `npm install -D typescript@latest`
3. Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler" // or "node16"
  }
}
```

---

### Build fails with "Module not found: @radix-ui/themes"

**Root cause:** Peer dependency not installed or version conflict.

**Fix:**
1. Delete `node_modules` and `package-lock.json`
2. Reinstall: `npm install`
3. Verify peer dependency versions match:
```bash
npm ls @radix-ui/themes @tanstack/react-query
# Check for UNMET PEER DEPENDENCY warnings
```

## Related Skills

- **workos-authkit-nextjs**: For Next.js authentication with AuthKit (provides tokens for widgets)
- **workos-admin-portal**: For embedding full admin portal instead of individual widgets
