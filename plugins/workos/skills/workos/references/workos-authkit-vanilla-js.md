# WorkOS AuthKit for Vanilla JavaScript

Docs: https://github.com/workos/authkit-js/blob/main/README.md and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README below. Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment.

Fetch the SDK README first; it overrides this file on conflict: `https://raw.githubusercontent.com/workos/authkit-js/main/README.md`. Install from npm for bundled projects (Vite, webpack, Parcel) or use the unpkg script tag for CDN/static pages.

## Critical API Quirk

`createClient()` is **async** — it returns a Promise, not a client directly. Always `await` it.

## Redirect destination and explicit options

The browser SDK defaults `redirectUri` to `window.origin`, such as `http://localhost:5173`. Register the app's actual origin for this default; no server-side callback handler or `/callback` route is needed.

```javascript
import { createClient } from '@workos-inc/authkit-js';

const authkit = await createClient('client_example');
```

An explicit custom redirect is supported when the full effective URL is registered and the destination actually initializes the SDK to handle the response:

```javascript
import { createClient } from '@workos-inc/authkit-js';

const authkit = await createClient('client_example', {
  redirectUri: 'https://app.example.com/auth/complete',
});
```

Register the exact effective redirect URL, and verify the destination actually initializes the SDK (a URL that parses is not proof the SDK runs there). If an env variable supplies the redirect, application code must pass its value as `redirectUri` — the SDK does not read `WORKOS_REDIRECT_URI` automatically. Register CORS allowed origins as the origin (`https://app.example.com`), not the full `/auth/complete` URL. Check the installed SDK version before implementation.

## Environment Variables

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

**Bundled projects only:**

- Vite: `VITE_WORKOS_CLIENT_ID`, consumed as `import.meta.env.VITE_WORKOS_CLIENT_ID`; inspect any custom `envPrefix`.
- Webpack: no universal public prefix. Inspect configured injection such as [EnvironmentPlugin](https://webpack.js.org/plugins/environment-plugin/) or DefinePlugin. `REACT_APP_` is a CRA convention, not a webpack default.
- Static/CDN scripts have no automatic `process.env` or `import.meta.env` injection.
- Pass the public client ID and any optional `redirectUri` into `createClient()` explicitly. Never expose `WORKOS_API_KEY` or `WORKOS_COOKIE_PASSWORD` to client bundles.

## Verification Checklist

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)
- [ ] `createClient()` is awaited; without `await` it yields a Promise, not a client.

## Error Recovery

| Error                            | Cause              | Fix                                                                   |
| -------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `WorkOS is not defined`          | CDN not loaded     | Add the script to `<head>` before your code                           |
| `createClient is not a function` | Wrong import       | npm: check import path; CDN: use `WorkOS.createClient`                |
| CORS errors                      | `file://` protocol | Use a local dev server (`npx serve`)                                  |
| Auth state lost                  | Session config     | Follow SDK dev/production guidance; localStorage is dev-mode behavior |
