# WorkOS AuthKit for TanStack Start

Docs: https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README below. Configure and verify the callback, Sign-out URI, and Initiate login URI for the target environment.

Fetch the SDK README first; it overrides this file on conflict: `https://raw.githubusercontent.com/workos/authkit-tanstack-react-start/main/README.md`. The package is `@workos/authkit-tanstack-react-start` — use that exact name for all imports.

Modern TanStack Start (v1.132+) uses `src/`; legacy vinxi-based projects use `app/`.

## Environment Variables

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

| Variable                 | Format       | Required |
| ------------------------ | ------------ | -------- |
| `WORKOS_API_KEY`         | `sk_...`     | Yes      |
| `WORKOS_CLIENT_ID`       | `client_...` | Yes      |
| `WORKOS_REDIRECT_URI`    | Full URL     | Yes      |
| `WORKOS_COOKIE_PASSWORD` | 32+ chars    | Yes      |

Generate the password if missing: `openssl rand -base64 32`. Default redirect URI: `http://localhost:3000/api/auth/callback`.

## Install order

1. Install `@workos/authkit-tanstack-react-start`.
2. Add `authkitMiddleware()` to `start.ts`.
3. Add the callback route matching `WORKOS_REDIRECT_URI`.
4. Regenerate the route tree and build.

## Middleware

`authkitMiddleware` runs as server middleware or auth fails silently. It belongs in `start.ts` via `requestMiddleware`, not in `createRouter()` (that is client-side TanStack Router). If `start.ts` exists, add `authkitMiddleware()` to its `requestMiddleware` array and keep the existing export style. Otherwise create `src/start.ts` (`app/start.ts` in legacy `app/`-rooted projects):

```typescript
import { createStart } from '@tanstack/react-start';
import { authkitMiddleware } from '@workos/authkit-tanstack-react-start';

export const startInstance = createStart(() => ({
  requestMiddleware: [authkitMiddleware()],
}));
```

Two gotchas: the export must be the named `startInstance` (the build plugin imports that name; a `default` export breaks the build), and `createStart` takes a function returning the options, not the options object directly.

## Callback route

Path must match `WORKOS_REDIRECT_URI`. For `/api/auth/callback`: `src/routes/api.auth.callback.tsx` (flat routes) or `app/routes/api/auth/callback.tsx` (legacy nested). Use `handleCallbackRoute()` as the server `GET` handler — it is a server-only route with no component:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/api/auth/callback')({
  server: { handlers: { GET: handleCallbackRoute() } },
});
```

## Auth in routes

Use `getAuth()` in route loaders (server-side, preferred for most cases); redirect to `getSignInUrl()` when there is no user. `signOut()` handles sign-out.

```typescript
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-react-start';
// loader: const { user } = await getAuth(); if (!user) throw redirect({ href: await getSignInUrl() });
```

For reactive client auth state, wrap the root in `AuthKitProvider` and read `useAuth()` from the `/client` subpath.

## Finalize

- Adding route files makes `routeTree.gen.ts` stale; the build regenerates it, or run `npx tsr generate`.
- TanStack Start imports CSS as `import styles from './styles.css?url'`. If `src/vite-env.d.ts` (or `app/vite-env.d.ts`) is missing, create it with `/// <reference types="vite/client" />` before building, or TypeScript errors on those imports.

## Verification Checklist

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)
- [ ] `authkitMiddleware()` is in the `start.ts` `requestMiddleware` array (not `createRouter()`); without it, auth fails silently.

## SDK Exports

**Server (main export):** `authkitMiddleware`, `handleCallbackRoute`, `getAuth`, `signOut`, `getSignInUrl` / `getSignUpUrl`, `switchToOrganization`.

**Client (`/client` subpath):** `AuthKitProvider`, `useAuth`, `useAccessToken`.
