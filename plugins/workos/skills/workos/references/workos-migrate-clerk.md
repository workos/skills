# WorkOS Migration: Clerk

## Docs

- https://workos.com/docs/migrate/clerk
- https://workos.com/docs/widgets
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Clerk exports multiple emails pipe-separated (e.g., `john@example.com|john.doe@example.com`) and does NOT indicate which is the primary email. If you can't call the Clerk API per user to resolve `primary_email_address_id`, you must pick the first email and document the choice.
- Clerk does NOT provide plaintext passwords. Password hashes are only available via the Clerk Backend API export, not the standard dashboard export.
- WorkOS users have a single primary email. You must pick ONE from Clerk's pipe-separated list.
- Clerk export may include deleted/suspended users. Filter these before import or you'll get count mismatches.
- Duplicate emails in the Clerk export will cause WorkOS rejections — deduplicate before importing.
- WorkOS has an official migration tool at https://github.com/workos/migrate-clerk-users that handles rate limits and retries.
- Clerk ships pre-built UI components (`<UserButton />`, `<UserProfile />`, `<OrganizationSwitcher />`) and users WILL ask for the WorkOS equivalent. WorkOS has one: WorkOS Widgets (`@workos-inc/widgets`). Do NOT claim WorkOS lacks pre-built account/profile UI, and do NOT tell users they must rebuild that UI from scratch — map each Clerk component using the table below.

## Replacing Clerk UI components

| Clerk component                             | WorkOS equivalent                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `<SignIn />` / `<SignUp />`                 | AuthKit hosted sign-in page (redirect-based, not an embeddable component); brand it in the Dashboard                                  |
| `<UserButton />`                            | The account UI behind it maps to the `<UserProfile />` and `<UserSecurity />` widgets; sign-out is handled by AuthKit session helpers |
| `<UserProfile />`                           | `<UserProfile />`, `<UserSecurity />`, and `<UserSessions />` widgets (profile info, password/MFA, active sessions)                   |
| `<OrganizationSwitcher />`                  | `<OrganizationSwitcher />` widget                                                                                                     |
| `<OrganizationProfile />` / member admin UI | `<UsersManagement />` widget (invite/remove members, change roles)                                                                    |

Setup basics for any widget: install `@workos-inc/widgets`, render the `WorkOsWidgets` provider at the app root, configure your app as an allowed web origin (Dashboard → Applications → Sessions tab) so widget requests pass CORS, and supply each widget an authorization token — the AuthKit access token when using `authkit-js`/`authkit-react`, or a backend-generated token via `workos.widgets.createToken({ userId, organizationId, scopes })` (expires after one hour; the User Management widget requires the `widgets:users-table:manage` scope).

For widget implementation work, load the `workos-widgets` skill — it owns the per-framework integration workflow. Full widget catalog: https://workos.com/docs/widgets
