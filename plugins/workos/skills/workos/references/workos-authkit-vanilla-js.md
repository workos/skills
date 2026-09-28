# WorkOS AuthKit for Vanilla JavaScript

Docs: https://github.com/workos/authkit-js/blob/main/README.md and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README below. Configure and verify the redirect destination, Sign-out URI, and Initiate login URI for the target environment.

## Decision Tree

### Step 1: Fetch README (BLOCKING)

WebFetch: `https://raw.githubusercontent.com/workos/authkit-js/main/README.md`

**README is source of truth.** If this skill conflicts, follow README.

### Step 2: Detect Project Type

```
Has package.json with build tool (Vite, webpack, Parcel)?
  YES -> Bundled project (npm install)
  NO  -> CDN/Static project (script tag)
```

### Step 3: Follow README Installation

- **Bundled**: Use package manager install from README
- **CDN**: Use unpkg script tag from README

### Step 4: Implement Per README

Follow README examples for:

- Client initialization
- Sign in/out handlers
- User state management

## Critical API Quirk

`createClient()` is **async** - returns a Promise, not a client directly.

```javascript
// CORRECT
const authkit = await createClient(clientId);
```

## Redirect destination and explicit options

The browser SDK defaults `redirectUri` to `window.origin`, such as `http://localhost:5173`. Register the app's actual origin for this default; no server-side callback handler or unnecessary `/callback` route is needed.

```javascript
import { createClient } from '@workos-inc/authkit-js';

const authkit = await createClient('client_example');
```

An explicit custom redirect is supported when the full effective URL is registered and the destination is reachable and initializes the SDK to handle the response:

```javascript
import { createClient } from '@workos-inc/authkit-js';

const authkit = await createClient('client_example', {
  redirectUri: 'https://app.example.com/auth/complete',
});
```

Replace the example client ID and URL with confirmed app values. Inspect static-host rewrites, route mounting, and initialization before claiming a custom destination works. A URL parsing successfully does not prove the SDK runs there; a path is not invalid merely because it exists. If an env variable supplies the redirect, application code must pass its value as `redirectUri`; the SDK does not read `WORKOS_REDIRECT_URI` automatically.

Register CORS allowed origins separately, e.g. `https://app.example.com`, not the full `/auth/complete` URL. Verify trailing-slash agreement with saved registration rather than banning slashes or silently normalizing values. Preserve the separate SDK-backed Initiate login URI and Sign-out URI requirements in shared setup.

Source baseline: AuthKit JS [constructor/initialization](https://github.com/workos/authkit-js/blob/220f46557dd89401036cd0dbed01bded391d1788/src/create-client.ts) and [optional redirectUri type](https://github.com/workos/authkit-js/blob/220f46557dd89401036cd0dbed01bded391d1788/src/interfaces/create-client-options.interface.ts). Check the installed version before implementation.

## Verification Checklist (ALL MUST PASS)

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)

- [ ] Compare the effective redirect option (or origin default) with saved registration and inspect destination reachability/SDK initialization.

These searches are inspection aids only: a grep hit does not prove a mounted route or successful authentication. Follow the shared flow checks before marking complete.

```bash
# 1. Check SDK is available (bundled or CDN)
grep -r "createClient\|WorkOS" src/ *.html 2>/dev/null || echo "FAIL: SDK not found"

# 2. Check createClient uses await
grep -rn "await createClient" src/ *.js *.html 2>/dev/null || echo "FAIL: createClient must be awaited"

# 3. Inspect normal sign-in and the separate SDK-backed Initiate login route
grep -rn "signIn\|sign_in" src/ *.js *.html 2>/dev/null

# 4. Build succeeds (bundled projects only)
# Run only if the project has a build script; do not suppress failures.
pnpm build
```

**If check #2 fails:** createClient() is async and must be awaited. Using it without await returns a Promise, not a client.

## Environment Variables

**Bundled projects only:**

- Vite: `VITE_WORKOS_CLIENT_ID`, explicitly consumed as `import.meta.env.VITE_WORKOS_CLIENT_ID`; inspect any custom `envPrefix`.
- Webpack: no universal public prefix. Inspect configured injection such as [EnvironmentPlugin](https://webpack.js.org/plugins/environment-plugin/) or DefinePlugin. `REACT_APP_` is a CRA convention, not a webpack default.
- Other bundlers: inspect scripts/config and access patterns; missing files do not imply CRA. Static/CDN scripts have no automatic `process.env` or `import.meta.env` injection.
- Pass the public client ID and any optional `redirectUri` into `createClient()` explicitly. Never expose `WORKOS_API_KEY` or `WORKOS_COOKIE_PASSWORD` to client bundles.

## Error Recovery

| Error                            | Cause                           | Fix                                                                   |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `WorkOS is not defined`          | CDN not loaded                  | Add script to `<head>` before your code                               |
| `createClient is not a function` | Wrong import                    | npm: check import path; CDN: use `WorkOS.createClient`                |
| `clientId is required`           | Undefined env var               | Check env prefix matches build tool                                   |
| CORS errors                      | `file://` protocol              | Use local dev server (`npx serve`)                                    |
| External login fails             | Missing Initiate login handling | Implement the separate SDK-backed sign-in route from shared setup     |
| Auth state lost                  | Session configuration           | Follow SDK dev/production guidance; localStorage is dev-mode behavior |

## Task Flow

1. **preflight**: Fetch README, detect project type, verify env vars
2. **install**: Add SDK per project type
3. **redirect**: SDK handles internally at origin default or verified custom destination (no server callback handler needed)
4. **provider**: Initialize client with `await createClient()`
5. **ui**: Add auth buttons and state display
6. **verify**: Build (if bundled), check console
