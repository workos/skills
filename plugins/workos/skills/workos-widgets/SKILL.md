---
name: workos-widgets
description: Use when the user is implementing, embedding, or debugging a WorkOS Widget — specifically the User Management, User Profile, Admin Portal SSO Connection, or Admin Portal Domain Verification widgets. Handles the full stack — detecting the frontend (Next.js, React, React Router, TanStack Start, Vite, SvelteKit), generating access tokens via the backend SDK in use (Node, Python, Go, Ruby, PHP, Java, .NET), and wiring up the widget component correctly per the bundled OpenAPI spec. Also use when code imports from @workos-inc/widgets or the user pastes <UsersManagement /> or <UserProfile /> JSX.
---

# WorkOS Widgets

## Workflow Overview

1. Identify the widget target (`user-management`, `user-profile`, `admin-portal-sso-connection`, `admin-portal-domain-verification`).
2. Detect the stack and whether AuthKit/WorkOS is already present ([references/detection.md](references/detection.md)).
3. If AuthKit/WorkOS is not present, ask the user to run `WORKOS_MODE=agent npx workos@latest install`, wait for confirmation, then continue.
4. Load the relevant reference files for the detected stack and widget.
5. Implement: a frontend route/page + widget component when the UI lives in the same app, or a token endpoint/service when a backend-first/multi-app architecture is detected.

## Reference Loading Map

Always load these core references:

- [references/detection.md](references/detection.md)
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

Then load exactly one widget reference:

- User Management: [references/widget-user-management.md](references/widget-user-management.md)
- User Profile: [references/widget-user-profile.md](references/widget-user-profile.md)
- Admin Portal SSO Connection: [references/widget-admin-portal-sso-connection.md](references/widget-admin-portal-sso-connection.md)
- Admin Portal Domain Verification: [references/widget-admin-portal-domain-verification.md](references/widget-admin-portal-domain-verification.md)

## Global Widget Guidance

- Implement widget operations using endpoint paths/methods from [references/fetching-apis.md](references/fetching-apis.md). When building request bodies or parsing responses, query the OpenAPI spec for the relevant widget's schemas:
  ```bash
  node references/scripts/query-spec.cjs --widget <widget-name>
  ```
  Use `--list` to see available widget groups.
- If the project renders the packaged `@workos-inc/widgets` components (`UsersManagement`, `UserProfile`, `AdminPortalSsoConnection`, ...), they must sit inside `<WorkOsWidgets>`, need the peer deps `@radix-ui/themes` and `@tanstack/react-query`, and take `authToken` (a string or `() => Promise<string>`), not `accessToken`.
- Reuse existing domain types and OpenAPI schemas rather than duplicating model definitions.
- Implement an authorization layer for widget requests, including elevated-token handling for sensitive endpoints ([references/token-strategies.md](references/token-strategies.md)).
- For React/TypeScript widget code conventions, follow [references/react-ts-standards.md](references/react-ts-standards.md).
- `WORKOS_MODE=agent` keeps the installer deterministic (no prompts, no browser, no host-trust); pass `--json` when you need to parse its output.

## Completion Requirements

- Token source matches the existing app architecture (AuthKit client flow or backend WorkOS token flow).
- Endpoint paths, methods, and request/response handling match the bundled OpenAPI spec.
- Loading, empty, and error branches are explicit and user-visible; affected data is refreshed after successful mutations.
- Packaged components are used as-is or via their own props API (`variant`, `size`, etc.), not overridden with `className`/`style`.
