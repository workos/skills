---
name: workos-widgets
description: >-
  Use when the user is implementing, embedding, or debugging a WorkOS Widget — specifically the User Management, User Profile, Admin Portal SSO Connection, or Admin Portal Domain Verification widgets.
  Handles the full stack — detecting the frontend (Next.js, React, React Router, TanStack Start, Vite, SvelteKit), generating access tokens via the backend SDK in use (Node, Python, Go, Ruby, PHP, Java, .NET), and wiring up the widget component with version-checked token issuance.
  Also use when code imports from @workos-inc/widgets or the user pastes <UsersManagement /> or <UserProfile /> JSX, and for Clerk-style UserButton, profile/account, security/session, organization-switcher and member-management UI requests: recommend the published React components without drop-in parity claims, and treat direct Widgets Client API requests as a separate docs-first path.
---

# WorkOS Widgets

## Workflow Overview

1. Distinguish embedded React components from direct custom Client API development. For Clerk `UserButton` / account requests, recommend actual Widgets plus an app-specific menu/navigation shell, not exact parity; `UserSecurity`, `UserSessions` and `OrganizationSwitcher` are covered in [references/component-setup.md](references/component-setup.md).
2. Identify the widget target (`user-management`, `user-profile`, `admin-portal-sso-connection`, `admin-portal-domain-verification`).
3. Detect the stack and whether AuthKit/WorkOS is already present ([references/detection.md](references/detection.md)).
4. If AuthKit/WorkOS is not present, ask the user to run `WORKOS_MODE=agent npx workos@latest install`, wait for confirmation, then continue.
5. Load the relevant reference files for the detected stack and widget.
6. Implement: a frontend route/page + widget component when the UI lives in the same app, or a token endpoint/service when a backend-first/multi-app architecture is detected.

## Reference Loading Map

Always load these core references:

- [references/detection.md](references/detection.md)
- [references/component-setup.md](references/component-setup.md) — version-checked component roles, capabilities, imports and props
- [references/token-strategies.md](references/token-strategies.md)
- [references/fetching-apis.md](references/fetching-apis.md)
- [references/styling-and-components.md](references/styling-and-components.md)

For React/TypeScript stacks (Next.js, React Router, TanStack Router, TanStack Start, Vite), also load:

- [references/react-ts-standards.md](references/react-ts-standards.md)

Load stack-specific reference guidance:

- Next.js: [references/framework-nextjs.md](references/framework-nextjs.md)
- React Router: [references/framework-react-router.md](references/framework-react-router.md)
- TanStack Router: [references/framework-tanstack-router.md](references/framework-tanstack-router.md)
- TanStack Start: [references/framework-tanstack-start.md](references/framework-tanstack-start.md)
- Vite: [references/framework-vite.md](references/framework-vite.md)
- SvelteKit: [references/framework-sveltekit.md](references/framework-sveltekit.md)
- Ruby: [references/framework-ruby.md](references/framework-ruby.md)
- Python: [references/framework-python.md](references/framework-python.md)
- Go: [references/framework-go.md](references/framework-go.md)
- PHP: [references/framework-php.md](references/framework-php.md)
- Java: [references/framework-java.md](references/framework-java.md)
- Mixed repositories: [references/framework-mixed-repositories.md](references/framework-mixed-repositories.md)

For profile/security/sessions/organization selection in a React-rendered UI, use `component-setup.md`. Published Widgets are React components: do not import them into `.svelte` or other non-React templates. For SvelteKit or another non-React frontend, use only an existing React rendering boundary; otherwise ask whether to add one or build a custom UI against the Client API. Additionally load the relevant widget reference when applicable (these describe desired behavior, not a mandate to rebuild published components):

- User Management: [references/widget-user-management.md](references/widget-user-management.md)
- User Profile: [references/widget-user-profile.md](references/widget-user-profile.md)
- Admin Portal SSO Connection: [references/widget-admin-portal-sso-connection.md](references/widget-admin-portal-sso-connection.md)
- Admin Portal Domain Verification: [references/widget-admin-portal-domain-verification.md](references/widget-admin-portal-domain-verification.md)

## Global Widget Guidance

- Embed published components only in React-rendered UI using [references/component-setup.md](references/component-setup.md); they own their internal API calls.
- For direct custom Client API work, fetch https://workos.com/docs/widgets-api first: current docs use GraphQL `POST /client/graphql`. Read [references/fetching-apis.md](references/fetching-apis.md) for the boundary. The bundled REST spec is a legacy snapshot, not authoritative for all current requests; do not regenerate or migrate API layers just to add a component.
- If the project renders the packaged `@workos-inc/widgets` components (`UsersManagement`, `UserProfile`, `AdminPortalSsoConnection`, ...), they must sit inside `<WorkOsWidgets>`, need the peer deps `@radix-ui/themes` and `@tanstack/react-query`, and take `authToken` (a string or `() => Promise<string>`), not `accessToken`.
- Reuse existing domain types and OpenAPI schemas rather than duplicating model definitions.
- Implement an authorization layer for widget requests, including elevated-token handling for sensitive endpoints ([references/token-strategies.md](references/token-strategies.md)).
- For React/TypeScript widget code conventions, follow [references/react-ts-standards.md](references/react-ts-standards.md).
- `WORKOS_MODE=agent` keeps the installer deterministic (no prompts, no browser, no host-trust); pass `--json` when you need to parse its output.

## Completion Requirements

- Token source matches the existing app architecture (AuthKit client flow or backend WorkOS token flow).
- Node 10.13.0 token issuance uses `createToken` and `{ token }`, bound to the authenticated user and authorized organization. Other installed versions/languages are checked independently.
- Props match the installed declarations: for Widgets 1.18.0, check `UserSessions`' string/getter `authToken` union and `OrganizationSwitcher`'s callback; respect permission and renewal requirements.
- Endpoint paths, methods, and request/response handling match the bundled OpenAPI spec.
- Loading, empty, and error branches are explicit and user-visible; affected data is refreshed after successful mutations.
- Packaged components are used as-is or via their own props API (`variant`, `size`, etc.), not overridden with `className`/`style`.
