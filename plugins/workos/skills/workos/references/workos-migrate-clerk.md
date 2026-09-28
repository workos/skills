# WorkOS Migration: Clerk

## Docs

- https://workos.com/docs/migrate/clerk
- https://workos.com/docs/widgets
- https://workos.com/docs/widgets/tokens
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Clerk exports multiple emails pipe-separated (e.g., `john@example.com|john.doe@example.com`) and does NOT indicate which is the primary email. If you can't call the Clerk API per user to resolve `primary_email_address_id`, you must pick the first email and document the choice.
- Clerk does NOT provide plaintext passwords. Password hashes are only available via the Clerk Backend API export, not the standard dashboard export.
- WorkOS users have a single primary email. You must pick ONE from Clerk's pipe-separated list.
- Clerk export may include deleted/suspended users. Filter these before import or you'll get count mismatches.
- Duplicate emails in the Clerk export will cause WorkOS rejections — deduplicate before importing.
- WorkOS has an official migration tool at https://github.com/workos/migrate-clerk-users that handles rate limits and retries.
- Data migration and UI replacement are separate. WorkOS provides prebuilt account UI via `@workos-inc/widgets`; do not claim profile UI is missing or that all account UI must be built from scratch.

## Replacing Clerk UI: relevant capabilities, not drop-in parity

| Clerk need                      | WorkOS option and remaining app responsibility                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SignIn` / `SignUp`             | AuthKit hosted redirect-based authentication, not an identical embedded Clerk form. Preserve callback, Sign-out URI and Initiate login URI setup                                  |
| `UserButton`                    | `UserProfile` / `UserSecurity` account pages; build your avatar trigger, menu and navigation shell, and wire sign-out with AuthKit session helpers. No WorkOS `UserButton` export |
| `UserProfile`                   | `UserProfile` (personal details), `UserSecurity` (password/MFA), `UserSessions` (active sessions/revocation subject to required permissions)                                      |
| `OrganizationSwitcher`          | `OrganizationSwitcher` selection UI plus an authorized AuthKit/app session switch callback; organization creation and app navigation remain custom                                |
| `OrganizationProfile` / members | `UsersManagement` for invitations, removal and role changes, not every organization setting or identical Clerk behavior                                                           |

Load the `workos-widgets` skill and read [component-setup.md](../../workos-widgets/references/component-setup.md) and [token-strategies.md](../../workos-widgets/references/token-strategies.md). Verified examples target `@workos-inc/widgets@1.18.0` and `@workos-inc/node@10.13.0`: use the `WorkOsWidgets` configuration provider, put `authToken` on components, and destructure `const { token } = await workos.widgets.createToken(...)` on the server. Bind issuance to the authenticated user and authorized organization; never expose the API secret or accept arbitrary caller identities/scopes. `UsersManagement` and (per current docs) `UserSessions` require `widgets:users-table:manage`. Backend tokens expire after one hour; arrange authenticated renewal. Do not apply these method names blindly to older installed SDKs.

Configure allowed web origins per https://workos.com/docs/widgets/quick-start rather than guessing Dashboard navigation. Widgets do not replace AuthKit session management or migrate data. If the user wants a custom UI using direct Widgets Client API calls, read the Widgets skill's `fetching-apis.md`: current docs describe GraphQL `/client/graphql`, not a universal bundled REST recipe.
