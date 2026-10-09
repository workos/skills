# Embedded Widgets: Profile and Organization UI

## Docs

- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/organization-switcher

If this file conflicts with fetched docs, follow the docs. Examples below target **`@workos-inc/widgets@1.18.0`**. Read [token-strategies.md](token-strategies.md) for **`@workos-inc/node@10.13.0`** issuance, permissions, refresh, and security boundaries; [version-evidence.md](version-evidence.md) records the checks.

## Recommend components, not drop-in parity

WorkOS provides prebuilt account UI through `@workos-inc/widgets`. For Clerk `UserButton` requests, recommend `UserProfile` and relevant security/session widgets for the account pages, while keeping the app-specific avatar trigger, menu, navigation, and sign-out wiring custom. There is no `UserButton` export in the verified package. Widgets are not a drop-in Clerk replacement, and do not migrate Clerk data or replace AuthKit authentication/session management.

| Need                   | Verified component and boundary                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal details       | `UserProfile`: profile picture/connected accounts, display name, verified email changes                                                                                   |
| Security settings      | `UserSecurity`: password and MFA controls; not an authentication provider                                                                                                 |
| Active sessions        | `UserSessions`: session details and revocation; requires the documented permission and token/session-ID shape below                                                       |
| Organization members   | `UsersManagement`: invitations, removal, role changes; not all Clerk OrganizationProfile settings                                                                         |
| Organization selection | `OrganizationSwitcher`: selection UI; app/AuthKit must perform the authorized session switch and any required reauthentication. Organization creation remains an app flow |

## Install and configure

Use the app's package manager; match peer versions to the installed package. For the verified target, the peer ranges include Radix Themes `^3.3.0`, TanStack Query `^5.0.0`, React/React DOM `>=18` (SWR `^2.0.0` is optional). These declared peer ranges are not a claim that every combination was runtime-tested.

```bash
pnpm add @workos-inc/widgets@1.18.0 @radix-ui/themes@^3.3.0 @tanstack/react-query@^5.0.0
```

Import styles once in the app's global stylesheet and configure your application's **allowed web origins** for CORS as described in the quick-start docs. This is separate from AuthKit callback/sign-out/initiate-login URL settings; preserve those settings and flows.

```css
@import '@radix-ui/themes/styles.css';
@import '@workos-inc/widgets/styles.css';
```

`WorkOsWidgets` supplies theme/query configuration, not authentication. These are client React components and require a React-rendered UI; use the appropriate client boundary in server-rendered frameworks. Mount only UI the user is authorized to access.

```tsx
import { UserProfile, UserSecurity, WorkOsWidgets } from '@workos-inc/widgets';

// authToken: the string from your authenticated server token endpoint.
export function AccountPage({ authToken }: { authToken: string }) {
  return (
    <WorkOsWidgets>
      <UserProfile authToken={authToken} />
      <UserSecurity authToken={authToken} />
    </WorkOsWidgets>
  );
}
```

For a user with `widgets:users-table:manage`, a **backend-issued string token** for that scope can be used as follows. `currentSessionId` comes from the verified app session, not caller input. Renew the string token before expiration as described in token-strategies.

```tsx
import { UserSessions, UsersManagement, WorkOsWidgets } from '@workos-inc/widgets';

export function MemberSettings({ authToken, currentSessionId }: { authToken: string; currentSessionId: string }) {
  return (
    <WorkOsWidgets>
      <UserSessions authToken={authToken} currentSessionId={currentSessionId} />
      <UsersManagement authToken={authToken} />
    </WorkOsWidgets>
  );
}
```

For an existing `authkit-react` app, current docs show the getter/switch integration below. Check the installed AuthKit SDK independently (it is not version-pinned by this Widgets verification). The switch callback takes **`{ organizationId }`**, not a positional string. A custom backend callback must recheck organization access, establish the new session or initiate reauthentication, then clear/reload org-scoped data. It must not merely change a UI label or mint a token for any supplied ID.

```tsx
import { useAuth } from '@workos-inc/authkit-react';
import { OrganizationSwitcher, UserSessions, WorkOsWidgets } from '@workos-inc/widgets';

// canViewSessions must come from the app's verified permission check for
// widgets:users-table:manage. UI gating is not the authorization boundary.
export function OrganizationAndSessions({ canViewSessions }: { canViewSessions: boolean }) {
  const { isLoading, user, getAccessToken, switchToOrganization } = useAuth();
  if (isLoading) return <p>Loading account…</p>;
  if (!user) return <p>Sign in to manage your account.</p>;
  return (
    <WorkOsWidgets>
      <OrganizationSwitcher authToken={getAccessToken} switchToOrganization={switchToOrganization} />
      {canViewSessions && <UserSessions authToken={getAccessToken} />}
    </WorkOsWidgets>
  );
}
```

Do not pass `accessToken` to these widgets, tokens to `WorkOsWidgets`, or `currentSessionId` with the getter form of `UserSessions`. Do not rebuild widget internals using bundled REST endpoint tables just to embed a published component. For direct custom UI/Client API requests, follow [fetching-apis.md](fetching-apis.md) instead.
