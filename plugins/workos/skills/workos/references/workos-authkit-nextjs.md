# WorkOS AuthKit for Next.js

Docs: https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README below. Configure and verify the callback, Sign-out URI, and Initiate login URI for the target environment.

SDK README (source of truth): `https://raw.githubusercontent.com/workos/authkit-nextjs/main/README.md`

## Step 1: Environment Variables

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

`.env.local` needs:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` — valid callback URL
- `WORKOS_COOKIE_PASSWORD` — 32+ characters

## Step 2: Install SDK and middleware/proxy

Install the SDK package named in the README, then add the middleware/proxy file by Next.js version:

- **Next.js 16+** → `proxy.ts` (preferred convention). `middleware.ts` still works but warns; Next.js 16 throws **error E900** if both files exist at the same level.
- **Next.js 15** → `middleware.ts` (`cookies()` is async)
- **Next.js 13–14** → `middleware.ts` (`cookies()` is sync)

The file must sit in the parent directory of `app/` — so `src/middleware.ts` (or `src/proxy.ts`) for a `src/app/` project, root-level otherwise. At the wrong level it is silently ignored — no error, it just never runs. See README for the `authkitMiddleware()` export.

### Composing with existing middleware

If `middleware.ts` already has custom logic (rate limiting, logging, headers), use the `authkit()` composable instead of `authkitMiddleware`:

```typescript
import { authkit, handleAuthkitProxy } from '@workos-inc/authkit-nextjs';

export default async function middleware(request: NextRequest) {
  const { session, headers, authorizationUrl } = await authkit(request);
  // ...your existing logic...
  if (needsAuth && !session.user && authorizationUrl) {
    return handleAuthkitProxy(request, headers, { redirect: authorizationUrl });
  }
  return handleAuthkitProxy(request, headers); // passes AuthKit headers through so withAuth() works in pages
}
```

`handleAuthkitProxy()` is the current name; `handleAuthkitHeaders` is a deprecated alias of the same function and still works — use whichever the installed version exports. For rewrites, compose `partitionAuthkitHeaders()` and `applyResponseHeaders()` (see README).

## Step 3: Create Callback Route

Parse `NEXT_PUBLIC_WORKOS_REDIRECT_URI` for the route path (e.g. `/auth/callback` → `app/auth/callback/route.ts`), then export `handleAuth()` — do not write custom OAuth logic:

```typescript
export const GET = handleAuth();
```

If the build fails with "cookies was called outside a request scope", a custom wrapper is calling `cookies()` outside a request handler; export `handleAuth()` directly. This error expires the OAuth code (`invalid_grant`), so fix the handler first.

## Step 4: Create the initiate-login route (REQUIRED)

The OAuth callback cannot start a new sign-in. Create a separate public `/sign-in` route at `app/sign-in/route.ts` (`src/app/sign-in/route.ts` for a `src/` project):

```typescript
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export async function GET() {
  return redirect(await getSignInUrl());
}
```

Set the Initiate login URI to the app's actual origin and port, e.g. `http://localhost:3000/sign-in`. Never set it to the callback URL or use `handleAuth()` in this route. Keep `/sign-in` reachable without an existing session. A client-side `refreshAuth()` button does not replace this endpoint — password-reset emails, invitations, and other externally started flows need a URL they can visit directly.

## Step 5: Provider Setup (REQUIRED)

Wrap the app in `AuthKitProvider` in `app/layout.tsx`, even when using server-side auth elsewhere — it powers `useAuth()` and consistent client/server auth UX:

```tsx
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
// <AuthKitProvider>{children}</AuthKitProvider> inside <body>
```

## Step 6: UI Integration and auth URL gotchas

Use server helpers for read-only auth checks in Server Components; use client helpers for interactive auth UI (nav/header buttons).

- **Read auth state** with `withAuth()` / `getUser()` in pages, layouts, and route handlers. The SDK renamed `getUser` to `withAuth` in newer versions — use whichever the installed version exports; do not rename working imports.
- **`getSignInUrl()` / `getSignUpUrl()` set PKCE cookies via `cookies()`**, so they throw if called during Server Component render. Call them only in a Server Action or Route Handler, or from a client component use `refreshAuth({ ensureSignedIn: true })` in a click handler.
- **Do not use raw `getAuthorizationUrl()` for AuthKit UI flows.** It returns `{ url, sealedState }`, not a URL string — assigning it to `window.location.href` navigates to `/[object Object]`, and discarding `sealedState` means the PKCE cookie is never set (`OAuth state mismatch` on callback). Use `getSignInUrl()` / `getSignUpUrl()` instead.

Client nav button:

```tsx
'use client';
import { useAuth } from '@workos-inc/authkit-nextjs/components'; // verify import path in README

export function NavAuth() {
  const { user, isLoading, refreshAuth } = useAuth();
  if (isLoading) return null;
  if (user) return <a href="/dashboard">Dashboard</a>;
  return <button onClick={() => void refreshAuth({ ensureSignedIn: true })}>Sign in</button>;
}
```

### Sign out with a POST server action, never a GET route

Sign-out clears the session, so it must be a POST, never a `GET` route handler: a `GET /auth/signout` is triggerable by `<Link>` prefetch on hover and CSRF-exposable via `<img src="/auth/signout">`. `workos doctor` flags this as `SIGNOUT_GET_HANDLER`. If a generated `GET` sign-out route exists, delete it rather than converting it, to remove the extra logout surface.

In a Server Component, an inline action works:

```tsx
<form
  action={async () => {
    'use server';
    await signOut();
  }}
>
  <button type="submit">Sign out</button>
</form>
```

A client component (e.g. a nav using `useAuth()`) cannot define an inline `'use server'` action — put it in a separate server-action module and import it:

```tsx
// app/auth/actions.ts
'use server';
import { signOut } from '@workos-inc/authkit-nextjs'; // verify export path in README
export async function signOutAction() {
  await signOut();
}
```

`signOut()` accepts an optional `{ returnTo }`; with none it redirects to the default Sign-out URI from your WorkOS dashboard.

## Verification Checklist

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)
- [ ] `AuthKitProvider` wraps the app in `app/layout.tsx`, callback route and middleware/proxy file exist, and `npm run build` succeeds
- [ ] No `getSignInUrl()` / `getSignUpUrl()` in Server Component render (`page.tsx`, `layout.tsx`, async server-rendered nav); no raw `getAuthorizationUrl()` in sign-in/sign-up paths; no `GET` sign-out route
- [ ] Visit `/sign-in` directly without a session — it starts AuthKit sign-in and returns through the callback without a loop, `OAuth state mismatch`, or `/[object Object]`. The configured Initiate login URI points to `/sign-in`, never the callback.
