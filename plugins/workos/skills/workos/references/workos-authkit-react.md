# WorkOS AuthKit for React (SPA)

## Fetch docs first

- SDK README: https://github.com/workos/authkit-react/blob/main/README.md
- Build-tool environment variables: https://vite.dev/guide/env-and-mode and https://create-react-app.dev/docs/adding-custom-environment-variables/
- Sign-out URIs: https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README. Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment.

## Choose the client SDK from runtime evidence

Fetch the README before writing code; stop if it is unavailable. This reference uses `@workos-inc/authkit-react`, including client-only React Router library/data/declarative apps and statically deployed framework SPA mode. A `react-router` dependency or browser loader does not establish a server. Inspect router configuration, SDK imports, entry points, and deployment; if server/client evidence conflicts, ask before choosing an SDK. See [workos-authkit-react-router.md](workos-authkit-react-router.md) for the mode checks. Do not mandate a framework migration.

## Redirect destination, not a server callback handler

`AuthKitProvider` initializes the browser SDK and handles the OAuth response. **No server-side callback route is needed.** Recommend the documented origin default, such as `http://localhost:5173`: omit `redirectUri` and register the actual app origin. Do not add an unnecessary `/callback` route or redirect env variable.

Explicit custom redirect URLs are supported. The provider forwards `redirectUri` to AuthKit JS. If a project deliberately uses `https://app.example.com/auth/complete`, require all three:

1. The effective `AuthKitProvider` prop is that URL (not merely an unused `.env` entry).
2. The same URL is registered for the confirmed WorkOS environment/application.
3. Direct navigation to that destination serves the app and mounts the provider so the SDK handles the callback before a route guard or navigation removes its parameters. Inspect routes and static-host rewrites; a grep hit does not prove this.

A path is not invalid merely because it exists, and parsing a URL does not validate the integration. Do not delete a working custom destination. Check trailing slashes through effective-value/registration agreement, not a universal ban or silent normalization. See the shared setup comparison and reachability checks.

Register CORS allowed origins separately: `https://app.example.com`, not `https://app.example.com/auth/complete`. Use the application's redirect settings and authentication allowed-origin settings described in the README, not an invented Dashboard click-path. A hostname such as `https://auth.example.com` is not itself a callback path (nor necessarily the app's origin); verify where the app actually runs.

## Build-tool environment variables and consumption

Inspect `package.json` scripts, dependencies, build config, and existing access patterns. A missing `vite.config.ts` does not imply CRA. Vite supports other config extensions and can run without a config file.

| Confirmed build tool                                        | Public env default  | Consumption                                                     |
| ----------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| Vite (`vite` scripts/config)                                | `VITE_`             | `import.meta.env.VITE_*`; inspect custom `envPrefix` if present |
| Create React App (`react-scripts`, or verified CRACO setup) | `REACT_APP_`        | `process.env.REACT_APP_*`                                       |
| Other/custom bundler                                        | No universal prefix | Inspect its explicit env injection; ask if unknown              |

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

Only the public client ID is required by the client SDK. Never put `WORKOS_API_KEY` or `WORKOS_COOKIE_PASSWORD` in a client bundle or public-prefixed env variable. The SDK does not automatically read an env variable named `WORKOS_REDIRECT_URI`.

### Vite origin default

Set `VITE_WORKOS_CLIENT_ID=client_...` and register the actual origin, e.g. `http://localhost:5173`. No redirect variable is required:

```jsx
import { AuthKitProvider } from '@workos-inc/authkit-react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <AuthKitProvider clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}>
    <App />
  </AuthKitProvider>,
);
```

### CRA explicit custom redirect

Only when `/auth/complete` is an intentional, reachable SPA destination mounting the provider, set `REACT_APP_WORKOS_REDIRECT_URI=https://app.example.com/auth/complete` and register that full URL. Wire the option explicitly:

```jsx
import { AuthKitProvider } from '@workos-inc/authkit-react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <AuthKitProvider
    clientId={process.env.REACT_APP_WORKOS_CLIENT_ID}
    redirectUri={process.env.REACT_APP_WORKOS_REDIRECT_URI}
  >
    <App />
  </AuthKitProvider>,
);
```

For a custom Vite redirect, explicitly pass `redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI}`. For other bundlers, pass the value from their verified configuration mechanism. An env prefix alone does not wire any SDK option.

## Verification Checklist (ALL MUST PASS)

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md).
- [ ] Confirm the app's runtime mode and build-tool env consumption, including any explicit redirect prop; inspect the effective non-secret values.
- [ ] Confirm `AuthKitProvider` wraps the app and initializes at the registered destination, including direct navigation after deployment. A string search or passing build is not proof of a mounted route or authentication.
- [ ] Confirm the separate SDK-backed `/login` route from the README is registered as Initiate login URI; it starts sign-in, not callback handling. Preserve Sign-out URI setup too.
- [ ] Run the project's build, then test flows when access permits. For framework SPA pre-rendering, initialize browser-only auth after hydration, following the framework docs; do not call browser APIs during build-time rendering.

## Error Recovery

- **Missing client ID:** Check the actual build tool, variable access, and provider prop, not just `.env` presence.
- **Redirect fails:** Compare the effective SDK URL with saved registration, then inspect destination mounting, host rewrites, route guards, and CORS origin. A custom path alone is not an error.
- **Missing auth context:** Check that consumers are inside `AuthKitProvider`.
- **Session lost on refresh:** Follow the README's development/production session configuration. Local storage is a dev-mode behavior, not a universal production token store.

## Source baseline

Verified against React [README](https://github.com/workos/authkit-react/blob/4602e49b13d3677e7cc37602318a8e4833498bae/README.md) and [provider option forwarding](https://github.com/workos/authkit-react/blob/4602e49b13d3677e7cc37602318a8e4833498bae/src/provider.tsx), plus AuthKit JS [origin default and callback initialization](https://github.com/workos/authkit-js/blob/220f46557dd89401036cd0dbed01bded391d1788/src/create-client.ts). Recheck the installed SDK version before applying custom options.
