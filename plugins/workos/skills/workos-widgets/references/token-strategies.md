# Token Strategies

## Docs

- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/authkit/roles-and-permissions
- https://workos.com/docs/widgets-api

If this file conflicts with fetched docs, follow the docs. Check examples against the **installed package declarations** as well: docs prose saying “get token” is not necessarily a JS method name or return type.

## Verified target

The examples target **`@workos-inc/node@10.13.0`** and **`@workos-inc/widgets@1.18.0`**, not an entire version range. See [version-evidence.md](version-evidence.md) for package/source evidence and documentation discrepancies. For an older SDK, inspect its installed declarations and matching release before choosing a method/return shape; do not rename working calls solely on this guide's authority. Other language SDKs have independent APIs.

## Authorization and permissions

Prefer existing AuthKit session flows. With `authkit-js`/`authkit-react`, pass the SDK's current access-token getter as the component's `authToken`. Otherwise issue a short-lived widget token on the server. `WorkOsWidgets` is the configuration/theme/query provider; it has **no authentication token prop** in 1.18.0.

| Component                        | Required permission / token scope                                        |
| -------------------------------- | ------------------------------------------------------------------------ |
| `UserProfile`                    | No special widget permission; still requires an authenticated user token |
| `UserSecurity`                   | No special widget permission; still requires an authenticated user token |
| `UserSessions`                   | `widgets:users-table:manage` per the current component docs              |
| `UsersManagement`                | `widgets:users-table:manage`                                             |
| `OrganizationSwitcher`           | No special widget permission; only organizations the user can access     |
| Admin Portal SSO Connection      | `widgets:sso:manage`                                                     |
| Admin Portal Domain Verification | `widgets:domain-verification:manage`                                     |

Request only the scopes needed for the selected UI. A scope request does not grant a role permission: the acting user must already be authorized. In particular, do not silently grant member-management privileges merely to show sessions; confirm the documented permission requirement for your deployment. Configure roles/permissions and allowed web origins using the linked docs, not a guessed Dashboard click-path.

## Server issuance: Node 10.13.0

This server-only example issues a profile/security token. The two application helpers below are **integration placeholders**, not WorkOS exports: implement them using your existing verified session and authorization layer. The request body must not supply the acting `userId`, `organizationId`, or scopes. Protect the endpoint with your app's same-origin/CSRF controls, return `Cache-Control: no-store`, and never log tokens or send the API key to the browser.

```ts
import { WorkOS } from '@workos-inc/node';
import { requireAuthenticatedSession, requireAuthorizedOrganization } from './app-auth';

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

export async function issueProfileWidgetToken(request: Request) {
  const session = await requireAuthenticatedSession(request);
  // Must verify active membership/access; fail closed if there is no authorized org.
  const organizationId = await requireAuthorizedOrganization(session);
  const { token } = await workos.widgets.createToken({
    userId: session.user.id,
    organizationId,
    scopes: [], // Profile/security need no special widget scope.
  });
  return Response.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
```

For member management (or sessions per current docs), use a separate authorized server path that checks the acting user's required permission and requests `scopes: ['widgets:users-table:manage']`. Do not expose arbitrary scope selection. Node 10.13.0 returns **`{ token: string }`**, not a token string; destructure before passing it to a component.

## Expiration and sensitive actions

Backend widget tokens expire after one hour. A string token does not renew itself: arrange authenticated reissuance before expiry and update/remount the relevant widget with the new token. For components accepting a getter, it must return a fresh valid token when invoked, not capture an expired string. Handle issuance failures/401/403 visibly and require sign-in again when the session ends. Clear user/org-specific widget query state on sign-out or identity/organization change; never share cached credentials between users.

`UserSessions` in 1.18.0 has a special union: a **string** `authToken` requires `currentSessionId` from the authenticated app session; the **getter** form forbids that prop. Use the getter form with an AuthKit access-token getter, not an assumed interchangeable backend widget-token callback.

Published components handle their own data fetching and sensitive-action verification UI. For custom Client API work, fetch https://workos.com/docs/widgets-api and its operation/authentication docs first. The bundled legacy `/_widgets` elevation recipe is not universal guidance for `/client/graphql`.
