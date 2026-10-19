# Framework: SvelteKit

Token generation belongs in a `+page.server.ts`, `+layout.server.ts`, or `+server.ts` boundary. For the token code pattern, see [Server issuance: Node 10.13.0](token-strategies.md#server-issuance-node-10130).

Published `@workos-inc/widgets` components are React components and cannot render as Svelte components. Use them only through an existing React rendering boundary. If none exists, ask whether to add one or build a custom Svelte UI against the Client API; do not import Widgets into `.svelte` files.
