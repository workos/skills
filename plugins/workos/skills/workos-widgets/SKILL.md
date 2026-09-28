---
name: workos-widgets
description: Use for WorkOS Widgets or Clerk-style UserButton, profile/account, security/session, organization-switcher and member-management UI requests. Recommend published React components without drop-in parity claims; detect the stack and wire version-checked token issuance. Also handles direct Widgets Client API requests as a separate docs-first path, and @workos-inc/widgets imports.
---

# WorkOS Widgets

## Workflow Overview

1. Distinguish embedded React components from direct custom Client API development. For Clerk `UserButton` / account requests, recommend actual Widgets plus an app-specific menu/navigation shell, not exact parity. Identify the target (`user-management`, `user-profile`, `user-security`, `user-sessions`, `organization-switcher`, or Admin Portal widgets).
2. Scan project files in this order:
   - package/dependency manifests
   - framework/router entrypoints
   - auth/token utilities
   - styling/component patterns
3. Detect stack, data-layer style, styling, component system, and package manager using [references/detection.md](references/detection.md).
4. Check for AuthKit/WorkOS presence:
   - if detected, continue;
   - if not detected, ask the user to run `WORKOS_MODE=agent npx workos@latest install`. Wait for confirmation, then continue.
5. If detection is ambiguous or conflicting, ask one focused question, then continue.
6. Load only the relevant reference files for the detected stack and widget.
7. Implement integration based on stack shape:
   - frontend route/page + widget component when widget UI lives in the same app
   - token endpoint/service + client integration surface when backend-first/multi-app architecture is detected
8. Validate routing/wiring, imports, and token/API usage before finishing.

## Canonical Inputs

Accept these inputs from the user request when available:

- widget type (or infer from request intent)
- optional component path
- optional page/route path
- optional token endpoint/service preference
- optional constraints (for example: avoid broad refactors)

When input is missing, infer from existing project conventions and detected stack.

## Detection and Ambiguity Protocol

- Apply detection heuristics from [references/detection.md](references/detection.md).
- Explore before asking. Ask only when ambiguity remains after checking manifests and route/auth entrypoints.
- Ask a single concrete question that resolves one decision.
- Default to the strongest detected ownership signals when no user response is available.
- When installs are required, use the package manager detected from project files/lockfiles.

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

For profile/security/sessions/organization selection, use `component-setup.md`. Additionally load the relevant widget reference when applicable (these describe desired behavior, not a mandate to rebuild published components):

- User Management: [references/widget-user-management.md](references/widget-user-management.md)
- User Profile: [references/widget-user-profile.md](references/widget-user-profile.md)
- Admin Portal SSO Connection: [references/widget-admin-portal-sso-connection.md](references/widget-admin-portal-sso-connection.md)
- Admin Portal Domain Verification: [references/widget-admin-portal-domain-verification.md](references/widget-admin-portal-domain-verification.md)

## Global Widget Guidance

- Embed published components using [references/component-setup.md](references/component-setup.md); they own their internal API calls. `WorkOsWidgets` configures theme/query context, while component-level `authToken` provides authorization.
- For direct custom Client API work, fetch https://workos.com/docs/widgets-api first: current docs use GraphQL `POST /client/graphql`. Read [references/fetching-apis.md](references/fetching-apis.md) for the boundary. The bundled REST spec is a legacy snapshot, not authoritative for all current requests; do not regenerate or migrate API layers just to add a component.
- Keep loading, empty, and error states explicit and user-visible.
- Keep mutation outcomes visible and refresh/reload affected data after successful changes.
- Align table/list/action UI with existing project conventions.
- Keep behavior resilient for partial/optional data and avoid brittle UI assumptions.

## Core Guidelines

- Reuse host-project types and the installed package's public declarations; avoid duplicating model definitions.
- Only custom API integrations need direct `fetch`/HTTP calls or a GraphQL client; verify operation schemas using current docs via [references/fetching-apis.md](references/fetching-apis.md).
- Implement a consistent authorization layer for widget requests, including elevated-token handling for sensitive endpoints when required.
- If the app already uses React Query or SWR, use them as orchestration/cache layers around those direct calls.
- For React/TypeScript widget code quality expectations, follow [references/react-ts-standards.md](references/react-ts-standards.md).
- If AuthKit/WorkOS is missing, prompt the user to run `WORKOS_MODE=agent npx workos@latest install` before continuing. `WORKOS_MODE=agent` keeps the installer deterministic (no prompts, no browser, no host-trust); pass `--json` when you need to parse the output.
- Install additional dependencies only when strictly necessary, using the detected package manager/tooling.
- Keep server-state handling aligned with the selected data-layer approach.
- Use local state/reducers for UI interaction state as needed.
- Prefer existing design system and styling conventions.
- Avoid broad unrelated refactors and global style rewrites.

## Completion Requirements

Before finishing, verify all relevant items:

1. Imports/props match installed declarations. For Widgets 1.18.0 use component `authToken`, never a provider token prop; check `UserSessions`' string/getter union and `OrganizationSwitcher`'s callback.
2. Route/page wiring is complete when route integration is in scope.
3. Token source matches existing app architecture (AuthKit client flow or backend WorkOS token flow).
4. Node 10.13.0 token issuance uses `createToken` and `{ token }`, bound to the authenticated user and authorized organization. Other installed versions/languages are checked independently.
5. Loading and error branches exist for required query/mutation flows.

## Validation Checklist

1. For direct API work, confirm endpoint and operation schemas against current official docs, not assumed legacy REST paths.
2. Confirm component/provider props and token response shape against the exact installed versions; respect permission and renewal requirements.
3. Confirm query/mutation invalidation/refetch is applied after successful mutations where required.
4. Confirm empty/error/loading states are explicit and user-visible.
5. Confirm package installs (if any) used the detected package manager/tooling.
6. Confirm implementation stays aligned with existing codebase conventions.
7. Confirm no existing component has been passed `className` or `style` props to override its built-in styling. Use each component as-is or via its own props API (`variant`, `size`, etc.).
