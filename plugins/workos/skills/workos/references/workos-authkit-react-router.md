# WorkOS AuthKit for React Router

## Fetch docs first

- Framework SDK: https://github.com/workos/authkit-react-router/blob/main/README.md
- Client SDK: https://github.com/workos/authkit-react/blob/main/README.md
- Router modes: https://reactrouter.com/start/modes
- Framework SPA deployment: https://reactrouter.com/how-to/spa
- Sign-out URIs: https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the selected SDK README. Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment.

## Detect execution and deployment, not just dependencies

Neither `react-router` nor `react-router-dom` proves server/framework mode. A browser loader does not establish a server. Inspect scripts, router config (including `ssr`), route registration, SDK imports, server entry/adapter, and the deployed runtime before choosing:

| Project evidence                                                                                                      | Guidance                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<BrowserRouter>` with client rendering and static hosting (v6 or v7 declarative/library use)                         | Use `@workos-inc/authkit-react`; read [workos-authkit-react.md](workos-authkit-react.md).                                                                                                                                 |
| `createBrowserRouter` with browser loaders and static hosting (data/library use)                                      | Use React client guidance; browser loaders are not server callback handlers.                                                                                                                                              |
| `react-router.config.ts` with `ssr: false`, deployed as `build/client` static files                                   | Framework SPA mode: use React client guidance. Build-time pre-rendering/root loaders and `@react-router/node` do not prove a request-time server. Initialize browser-only auth after hydration, not during pre-rendering. |
| React Router framework config, registered server routes, and a deployed request-time server running the framework SDK | Use the server callback-loader setup below. Confirm installed SDK support in its README.                                                                                                                                  |
| Next.js config plus a React Router dependency, or server SDK imports with static-only deployment                      | Inspect the active app/workspace and execution path. If evidence is contradictory, ask which runtime/deployment is intended; do not choose by dependency priority or mandate a migration.                                 |

Modes alone do not establish all deployment behavior: inspect custom servers or hybrid arrangements rather than forcing them into the table. If a framework config is present but deployment is unknown, ask. A grep hit for a loader or provider is only a lead, not proof it runs at the callback destination.

## Server framework SDK setup

Only for confirmed supported server use of `@workos-inc/authkit-react-router`: fetch its README before coding. It requires a registered callback route whose server loader uses `authLoader()`:

```ts
import { authLoader } from '@workos-inc/authkit-react-router';

export const loader = authLoader();
```

Register this module in the project's actual route config at the path from the effective redirect URL. For example, `http://localhost:3000/auth/callback` requires `/auth/callback`; a file named `callback.ts` alone does not establish a mounted route. The route, effective SDK configuration, and saved WorkOS registration must agree.

| Function        | Purpose                   | Where to use                    |
| --------------- | ------------------------- | ------------------------------- |
| `authLoader`    | OAuth callback handler    | Server callback route           |
| `authkitLoader` | Read/refresh session data | Server routes needing auth data |

Use `authkitLoader` on the relevant routes (root if sharing root loader data); do not confuse it with `authLoader` or assume a browser provider replaces a server callback. Follow the README for the separate SDK-backed sign-in route and its required response headers, and register it as Initiate login URI. Use the SDK sign-out action and shared Sign-out URI guidance.

### Server configuration

The framework SDK supports `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_REDIRECT_URI`, and `WORKOS_COOKIE_PASSWORD` (32+ characters). Its explicit `configure({ redirectUri, ... })` values take priority over environment variables. Inspect programmatic configuration and runtime env loading before claiming an `.env` value is effective.

Keep API keys and cookie secrets server-only: never add public prefixes or send configuration objects containing secrets to the browser. These server requirements do not apply to client-only React Router apps; those use the React client ID/provider options instead.

## Verification Checklist (ALL MUST PASS)

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md).
- [ ] SDK selection follows actual execution/deployment evidence; unresolved mixed signals are clarified with the user.
- [ ] For client-only apps, use the React checklist and origin default or verified explicit custom redirect; do not add a server callback handler.
- [ ] For framework/server apps, inspect route registration and server execution of `authLoader()`, and compare the full effective redirect URL with saved registration. Check `configure()` overrides, not just env files.
- [ ] Inspect session loader usage and server-only secret boundaries; run the build. Source searches/builds do not prove a mounted route or successful authentication.
- [ ] Verify reachable destinations and sign-in, sign-out, and externally initiated login when browser/account access permits; otherwise report them as unverified.

## Error Recovery

- **Server SDK in a static app:** Recheck intended architecture; use React client guidance for genuinely client-only projects. Do not expose secrets or prescribe a framework migration to make the server SDK work.
- **Callback 404:** Inspect actual route registration and deployment rewrites against the effective URL, not just filenames.
- **Missing auth data:** Inspect `authkitLoader` use and data consumption on the server routes, or provider mounting for the separate client SDK.

## Source baseline

Server requirements and configuration precedence verified against [AuthKit React Router README at 78f8e4366abbc2d3b7061a24a3635f9beb71256a](https://github.com/workos/authkit-react-router/blob/78f8e4366abbc2d3b7061a24a3635f9beb71256a/README.md). That revision focuses on framework mode; do not invent library-mode sections or APIs. Recheck installed SDK support and the router's deployment docs before implementation.
