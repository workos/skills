# WorkOS AuthKit for SvelteKit

Docs: https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs.

**Required setup:** Read [workos-authkit-setup.md](workos-authkit-setup.md) alongside the SDK README below. Configure and verify the callback, Sign-out URI, and Initiate login URI for the target environment.

Fetch the SDK README first; it overrides this file on conflict: `https://raw.githubusercontent.com/workos/authkit-sveltekit/main/README.md`. The package is `@workos/authkit-sveltekit`.

## Environment Variables

**Missing credentials:** If the project has no WorkOS credentials yet, get them with the no-account install in [workos-authkit-setup.md](workos-authkit-setup.md#get-credentials) (`npx workos@latest install`). With an existing WorkOS account, use that environment's credentials instead. Skip this inside the WorkOS installer, which writes them before you start.

Set in `.env` (SvelteKit's default) or `.env.local`:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`
- `WORKOS_REDIRECT_URI` — callback URL
- `WORKOS_COOKIE_PASSWORD` — 32+ characters (`openssl rand -base64 32`)

SvelteKit reads these via `$env/static/private` and `$env/dynamic/private`.

If AuthKit is partially present, read the existing files and fill the gaps rather than reinstalling.

## Install order

1. Install `@workos/authkit-sveltekit`.
2. Register the handle in `src/hooks.server.ts`.
3. Create the callback `+server.ts` route.
4. Load the session in `+layout.server.ts`.

## Server hooks

Register the AuthKit handle in `src/hooks.server.ts` (named export `handle`, a SvelteKit requirement). When using SvelteKit's `$env` modules, call `configureAuthKit` as shown in the README before creating the hook.

Compose with existing auth (Lucia, Auth.js, custom session middleware) using `sequence()`, with AuthKit first so it runs before other middleware:

```typescript
import { sequence } from '@sveltejs/kit/hooks';
import { authKitHandle } from '@workos/authkit-sveltekit';

export const handle = sequence(authKitHandle(), existingHandle);
```

Keep existing auth routes, form actions, and session cookies working. Use a separate path like `/auth/callback` if `/callback` or `/login` is already taken.

## Callback route

Create the callback at the path matching `WORKOS_REDIRECT_URI` (e.g. `/callback` → `src/routes/callback/+server.ts`). Use the SDK's callback handler from the README. SvelteKit uses `+server.ts` for API routes, not `+page.server.ts`.

## Layout session

Load the session in `src/routes/+layout.server.ts` and pass it to pages:

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => ({
  user: event.locals.auth.user,
});
```

Augment `App.Locals` in `src/app.d.ts` so `locals.auth` is typed.

## Verification Checklist

- [ ] Application settings and sign-in/sign-out flows pass the completion checklist in [workos-authkit-setup.md](workos-authkit-setup.md)
- [ ] Build and verify the sign-in flow.
