# Framework: TanStack Start

## Guidance

- Follow established Start route/file conventions.
- Keep server/client boundaries consistent with existing auth and data flows.
- Add widget integration with minimal structural changes.
- For JS/TS token strategy details (AuthKit token vs version-checked backend issuance with scopes), follow [token-strategies.md](token-strategies.md).
- Reuse current route and module organization patterns.

## Server Token Pattern (JS/TS)

For the token code pattern, see [Server issuance: Node 10.13.0](token-strategies.md#server-issuance-node-10130). Token generation belongs in a Start server function or server boundary.
