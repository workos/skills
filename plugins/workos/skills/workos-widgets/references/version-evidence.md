# Widgets verification evidence

## Docs

- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/organization-switcher
- https://workos.com/docs/widgets-api

If this file conflicts with fetched docs, follow the docs. Resolve code-example discrepancies using the **installed release declarations**, not an assumed universal method name.

## Observation: 2026-09-28 (UTC)

Read-only npm metadata and tarballs were inspected; SHA-512 digests were recomputed and matched registry integrity. No downloaded package code or install scripts were executed, no tokens issued, and no live components/model recommendations tested. Official docs were fetched using their `.md` representations (HTML requests returned 403).

### Published Widgets 1.18.0

- Metadata: https://registry.npmjs.org/@workos-inc/widgets/1.18.0
- Tarball: https://registry.npmjs.org/@workos-inc/widgets/-/widgets-1.18.0.tgz
- Integrity: `sha512-ZMmSt5dJAEROXAP9YIQRAz9P0+wg9XNvFS9zt9cTXcyK9kPsnZ3laRhZNM25KcTDLa+O78sHEABsR0PP3I+BCg==`
- Registry signature key ID: `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. Metadata has no `gitHead` or provenance attestation. Registry signatures were recorded, not cryptographically verified.
- Public exports: `package/dist/esm/index.d.ts`; component declarations: `package/dist/esm/{workos-widgets,user-profile,user-security,user-sessions,users-management,organization-switcher}.client.d.ts`.
- `WorkOsWidgetsProps`: theme/elements/query/client configuration, no authentication token prop.
- Profile/security/member components: required `authToken: AuthToken`; `package/dist/esm/api/api-provider.d.ts` defines `AuthToken = string | (() => Promise<string>)`.
- Sessions: string `authToken` requires `currentSessionId: string`; getter `authToken` has `currentSessionId?: never`.
- Switcher: required `authToken`; `package/dist/esm/lib/organization-switcher.d.ts` requires `switchToOrganization: ({ organizationId }: { organizationId: string }) => void | Promise<void>`.
- Peer declarations in `package/package.json`: Radix Themes `^3.3.0`, TanStack Query `^5.0.0`, React/React DOM `>=18`, optional SWR `^2.0.0`. These ranges are metadata, not a runtime compatibility test matrix.
- Related source inspected at https://github.com/workos/widgets/tree/61aa0c91d2fe99611f038d78e90ac9102b12183d, notably `packages/widgets/src/api/api-provider.tsx` and `packages/widgets/src/user-sessions.client.tsx`. **Do not equate this source snapshot with the published tarball**: npm metadata does not establish that provenance. Public declarations above anchor the examples.

### Published Node 10.13.0

- Metadata: https://registry.npmjs.org/@workos-inc/node/10.13.0
- Tarball: https://registry.npmjs.org/@workos-inc/node/-/node-10.13.0.tgz
- Integrity: `sha512-xPtcziTjN1irPiZ4niTaulYvRMs6D+Fz5E54GGHVOxNi0PV2/Ws1g/cx3q9oMvMhnINkva5iZ2T5aS6yLzdCWA==`
- Registry `gitHead`: `183714bb0d7dbf706cb72208d0aa6daada2f718e`; source: https://github.com/workos/workos-node/blob/v10.13.0/src/widgets/widgets.ts.
- Published `package/lib/factory-C4y25QQJ.d.cts` declares `Widgets.createToken(options: CreateTokenOptions): Promise<WidgetSessionTokenResponse>` and `WidgetSessionTokenResponse { token: string }`. `organizationId` is required, `userId` optional at the API level; these user-facing examples deliberately always bind `userId` to the authenticated user. Scope union includes `widgets:users-table:manage`, `widgets:sso:manage`, and `widgets:domain-verification:manage`.
- Registry signature key ID matches the one above. Metadata links https://registry.npmjs.org/-/npm/v1/attestations/@workos-inc%2fnode@10.13.0. Its decoded SLSA v1 payload identifies the same git revision, `.github/workflows/release-please.yml`, and https://github.com/workos/workos-node/actions/runs/33426340663/attempts/1. The subject SHA-512 matches the tarball. This is **inspection**, not independent cryptographic verification of the attestation/signatures.

## Documentation discrepancies and boundaries

- Tokens docs call the operation “get token” in prose but show JS `createToken`. The example assigns the whole response to `authToken`; Node 10.13.0 declarations require destructuring **`{ token }`** before using the string. Historical PR42's blanket `createToken` blacklist is stale for this target.
- Docs verify the five component capabilities used here. Profile/security/switcher need no special widget permission. Member management and, explicitly in current session docs, sessions require `widgets:users-table:manage`. Do not automatically grant broader privileges to satisfy UI requirements; verify the deployment's permission policy.
- The switcher docs' backend illustration uses positional arguments; the published 1.18.0 callback instead takes `{ organizationId }`. Prefer the published signature. The callback still needs a real authorized session-switch flow.
- Quick start verifies provider, peer/style imports, and allowed web origins. Describe that configuration conceptually rather than freezing Dashboard navigation.
- Widgets API docs explicitly document GraphQL `POST https://api.workos.com/client/graphql`. Published components and direct custom Client API work are different integration paths; the bundled legacy REST snapshot is not a universal authority. Schema regeneration/migration is outside this change (DAAP-3221).

Recommendations and Clerk mapping adapt Nick Nisi's PR42 (https://github.com/workos/skills/pull/42, head `17eeaa3dce4f095226d9875c788aef95d77c38d7`, historical base `de1ed17cf03fce2b53973247361a1a47719b528c`). Its review comments were read; parity wording, stale method correction/blacklist, and broad negation matching were not replayed. This verification supports only the exact target releases, not older-version guidance or a future range.
