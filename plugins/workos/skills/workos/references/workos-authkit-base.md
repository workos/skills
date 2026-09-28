# WorkOS AuthKit Base Template

Docs: https://workos.com/docs/authkit/vanilla/nodejs and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md). Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment. Complete its flow checks before declaring the integration complete.

## First Action: Fetch README

Before any implementation, fetch the framework-specific README:

```
WebFetch: {sdk-package-name} README from npmjs.com or GitHub
```

README is the source of truth for: install commands, imports, API usage, code patterns.

## Task Structure (Required)

| Phase | Task      | Blocked By         | Purpose                                                                  |
| ----- | --------- | ------------------ | ------------------------------------------------------------------------ |
| 1     | preflight | -                  | Verify env vars, detect framework                                        |
| 2     | install   | preflight          | Install SDK package                                                      |
| 3     | callback  | install            | Server SDK: callback handler; client SDK: reachable redirect destination |
| 4     | provider  | install            | Setup auth context/middleware                                            |
| 5     | ui        | callback, provider | Add sign-in/out UI                                                       |
| 6     | verify    | ui                 | Settings, auth flows, and build                                          |

## Server-Side Auth Flow

For Rails, Flask, Sinatra, Express, or any other server-rendered app, keep this order explicit:

This is the runtime login sequence inside the `callback` and `provider` implementation phases above; it does not replace the task order table.

1. Configure the WorkOS SDK with `WORKOS_API_KEY` and `WORKOS_CLIENT_ID`.
2. Generate the authorization URL for login with the AuthKit provider and `redirect_uri`.
3. Redirect the user to that authorization URL.
4. Handle the callback route by exchanging `code` with the SDK.
5. Store the returned user profile in the app session.
6. Implement logout using the SDK to end the AuthKit session and clear the app session, then redirect to the configured Sign-out URI.

## Decision Trees

### Package Manager Detection

```
pnpm-lock.yaml? → pnpm
yarn.lock? → yarn
bun.lockb? → bun
else → npm
```

### Provider vs Middleware

```
Client-side framework? → AuthKitProvider wraps app
Server-side framework? → Middleware handles sessions
Hybrid (Next.js)? → Both may be needed
```

### Redirect Destination vs Server Callback Handler

A redirect URI is where WorkOS returns the browser after authentication. It is not necessarily a server callback handler.

- **React SPA / AuthKit JS:** The browser SDK handles the callback. Recommend its documented `window.origin` default (e.g., `http://localhost:5173`) without adding an unnecessary `/callback` route. Explicit `redirectUri` options are supported: the effective SDK value, saved registration, and reachable destination where the provider/client initializes must agree. An env variable alone does not configure the client SDK. See the React or vanilla JS reference for wiring and source citations.
- **Server SDKs:** Use the SDK callback handler at the configured route. Extract the path from the effective SDK redirect URL (including programmatic overrides), and register that full URL. For supported React Router framework/server use, this is a server loader with `authLoader()`; React Router dependencies or browser loaders alone do not imply server execution.

Do not reject custom paths or trailing slashes universally, silently normalize them, or treat a parseable URL as proof of correct setup. Follow [workos-authkit-setup.md](workos-authkit-setup.md) for exact registration, CORS origin, and reachability checks.

## Environment Variables

| Variable                 | Purpose                           | When Required         |
| ------------------------ | --------------------------------- | --------------------- |
| `WORKOS_API_KEY`         | Server authentication             | Server SDKs           |
| `WORKOS_CLIENT_ID`       | Client identification             | All SDKs              |
| `WORKOS_REDIRECT_URI`    | Server SDK redirect configuration | Per server SDK README |
| `WORKOS_COOKIE_PASSWORD` | Session encryption (32+ chars)    | Server SDKs           |

These are SDK configuration concepts, not universal env names. Browser SDKs require a public client ID passed in code; an explicit redirect option is optional. Inspect the actual build tool and consumption (`VITE_` / `import.meta.env` for Vite, `REACT_APP_` / `process.env` for CRA). Missing config files do not establish an env-prefix rule. Never expose API keys or cookie secrets through public prefixes or client bundles.

## Verification Checklists

### After Install

- [ ] SDK package installed in node_modules
- [ ] No install errors in output

### After Redirect Setup

- [ ] Effective SDK redirect URL agrees with saved registration for the confirmed environment/application.
- [ ] Client SDK: destination serves the app and initializes the provider/client to handle the callback; no server handler required.
- [ ] Server SDK: actual route registration runs the SDK callback handler at the configured path (not custom OAuth).
- [ ] Inspect routing/deployment; a file or grep hit alone does not prove reachability or successful authentication.

### After Provider/Middleware

- [ ] Provider wraps entire app (client-side)
- [ ] Middleware configured in correct location (server-side)

### After UI

- [ ] Home page shows conditional auth state
- [ ] Uses SDK functions for sign-in/out URLs

### Final Verification

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)
- [ ] Build completes with exit code 0
- [ ] No import resolution errors

## Error Recovery

### Module not found

- [ ] Verify install completed successfully
- [ ] Verify SDK exists in node_modules
- [ ] Re-run install if missing

### Build import errors

- [ ] Delete `node_modules`, reinstall
- [ ] Verify package.json has SDK dependency

### Invalid redirect URI

- [ ] Compare the full effective SDK redirect URL with saved registration, without silently normalizing trailing slashes.
- [ ] Verify the destination mounts the client SDK or executes the server callback handler, as appropriate.

### Cookie password error

- [ ] Verify `WORKOS_COOKIE_PASSWORD` is 32+ characters
- [ ] Generate new: `openssl rand -base64 32`

### Auth state not persisting

- [ ] Verify provider wraps entire app
- [ ] Check middleware is in correct location

## Critical Rules

1. **Install SDK before writing imports** - never create import statements for uninstalled packages
2. **Use SDK functions** - never construct OAuth URLs manually
3. **Follow README patterns** - SDK APIs change between versions
4. **Match redirect guidance to SDK and runtime** - client origin default or verified explicit custom destination; server callback handler at the effective configured route. Don't hardcode `/auth/callback`.
