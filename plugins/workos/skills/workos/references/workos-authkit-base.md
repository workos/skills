# WorkOS AuthKit Base Template

Docs: https://workos.com/docs/authkit/vanilla/nodejs and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md). Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment. Complete its flow checks before declaring the integration complete.

Fetch the framework-specific SDK README (npmjs.com or GitHub) before implementing. It is the source of truth for install commands, imports, API usage, and code patterns.

Task order where it matters: install the SDK → wire the callback (server SDK: callback handler; client SDK: a reachable redirect destination) → set up the auth provider/middleware → add sign-in/out UI → verify settings, flows, and build.

## Server-Side Auth Flow

For server-rendered apps (Rails, Flask, Sinatra, Express, etc.): configure the SDK, generate the authorization URL, redirect to it, handle the callback by exchanging `code` via the SDK, and store the profile in the app session. Logout must use the SDK to end the AuthKit session, clear the app session, then redirect to the configured Sign-out URI.

## Redirect Destination vs Server Callback Handler

A redirect URI is where WorkOS returns the browser after authentication. It is not necessarily a server callback handler.

- **React SPA / AuthKit JS:** The browser SDK handles the callback. Recommend its documented `window.origin` default (e.g., `http://localhost:5173`) without adding an unnecessary `/callback` route. Explicit `redirectUri` options are supported: the effective SDK value, saved registration, and reachable destination where the provider/client initializes must agree. An env variable alone does not configure the client SDK. See the React or vanilla JS reference for wiring and source citations.
- **Server SDKs:** Use the SDK callback handler at the configured route. Extract the path from the effective SDK redirect URL (including programmatic overrides), and register that full URL. For supported React Router framework/server use, this is a server loader with `authLoader()`; React Router dependencies or browser loaders alone do not imply server execution.

Do not reject custom paths or trailing slashes universally, silently normalize them, or treat a parseable URL as proof of correct setup. Follow [workos-authkit-setup.md](workos-authkit-setup.md) for exact registration, CORS origin, and reachability checks.

## Environment Variables

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

| Variable                 | Purpose                           | When Required         |
| ------------------------ | --------------------------------- | --------------------- |
| `WORKOS_API_KEY`         | Server authentication             | Server SDKs           |
| `WORKOS_CLIENT_ID`       | Client identification             | All SDKs              |
| `WORKOS_REDIRECT_URI`    | Server SDK redirect configuration | Per server SDK README |
| `WORKOS_COOKIE_PASSWORD` | Session encryption (32+ chars)    | Server SDKs           |

These are SDK configuration concepts, not universal env names. Browser SDKs require a public client ID passed in code; an explicit redirect option is optional. Inspect the actual build tool and consumption (`VITE_` / `import.meta.env` for Vite, `REACT_APP_` / `process.env` for CRA). Missing config files do not establish an env-prefix rule. Never expose API keys or cookie secrets through public prefixes or client bundles.

## Verification Checklists

- Effective SDK redirect URL agrees with saved registration; compare the full URL without silently normalizing trailing slashes.
- Client SDK: the destination serves the app and initializes the provider/client to handle the callback; no server handler required. Server SDK: the registered route runs the SDK callback handler (not a custom OAuth flow).
- A file or grep hit alone does not prove reachability or successful authentication; inspect routing and deployment.
- Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md), and the build completes cleanly.

Use SDK functions for sign-in/out URLs; never construct OAuth URLs manually. Match redirect guidance to the SDK and runtime — client origin default or verified explicit custom destination; server callback handler at the effective configured route. Don't hardcode `/auth/callback`.
