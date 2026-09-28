# Framework: Next.js

## Guidance

- Detect whether the project uses App Router or Pages Router, then follow that structure.
- Place widget routes/pages where existing route modules live.
- Keep token acquisition in the same server/client boundary already used by the app.
- For JS/TS token strategy details (AuthKit token vs version-checked backend issuance with scopes), follow [token-strategies.md](token-strategies.md).
- Integrate widget components through existing layout and provider patterns.

## Server Token Pattern (JS/TS)

For the token code pattern, see [Server issuance: Node 10.13.0](token-strategies.md#server-issuance-node-10130). Token generation belongs in a Next.js server boundary (Server Component, Route Handler, or `getServerSideProps`).
