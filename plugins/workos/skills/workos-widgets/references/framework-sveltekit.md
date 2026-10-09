# Framework: SvelteKit

## Guidance

- Follow existing `+page`, `+layout`, and `+server`/`+page.server` conventions.
- Keep token generation in server/load boundaries that already handle auth/session context.
- For JS/TS token strategy details (AuthKit token vs version-checked backend issuance with scopes), follow [token-strategies.md](token-strategies.md).
- Keep frontend data calls aligned with current SvelteKit patterns.
- Published `@workos-inc/widgets` components are React components and cannot render as Svelte components. Use them only through an existing React rendering boundary. If none exists, ask whether to add one or build a custom Svelte UI against the Client API; do not import Widgets into `.svelte` files.
- For a custom Svelte UI, keep it in its own `.svelte` component rather than directly in `+page.svelte`.

## Server Token Pattern (JS/TS)

For the token code pattern, see [Server issuance: Node 10.13.0](token-strategies.md#server-issuance-node-10130). Token generation belongs in a `+page.server.ts`, `+layout.server.ts`, or `+server.ts` boundary.
