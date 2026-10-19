# WorkOS AuthKit for Node.js

## Docs

Fetch the README first — it's the source of truth for SDK patterns:

- SDK README: `https://raw.githubusercontent.com/workos/workos-node/main/README.md`
- AuthKit quickstart: `https://workos.com/docs/authkit/vanilla/nodejs`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → init client → login/callback/logout routes → `.env` → build.

1. **Install:** `@workos-inc/node dotenv cookie-parser` (add `@types/cookie-parser` for TypeScript).
2. **Init client:**
   ```typescript
   import { WorkOS } from '@workos-inc/node';
   const workos = new WorkOS(process.env.WORKOS_API_KEY, {
     clientId: process.env.WORKOS_CLIENT_ID,
   });
   ```
   (CJS: `const { WorkOS } = require('@workos-inc/node');`)
3. **Routes**, adapted to the framework's router + cookie API:
   - `/login` — `workos.userManagement.getAuthorizationUrl({ provider: 'authkit', redirectUri })`, then redirect.
   - `/callback` — `workos.userManagement.authenticateWithCode({ code, session: { sealSession: true, cookiePassword } })`, store `sealedSession` in a cookie.
   - `/logout` — get the AuthKit logout URL from the sealed session, clear the cookie, then redirect to that URL (ends the WorkOS session too).
4. **`.env`** (don't overwrite existing values; keep it in `.gitignore`):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:3000/callback
   WORKOS_COOKIE_PASSWORD=<generate with openssl rand -base64 32>
   ```
5. **Build:** `npx tsc --noEmit` (TS) or `node --check <entry-file>` (JS).

## Call shapes

Verified against `@workos-inc/node@11.0.0`.

```typescript
import { WorkOS } from '@workos-inc/node';
const workos = new WorkOS(process.env.WORKOS_API_KEY, { clientId: process.env.WORKOS_CLIENT_ID });
const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD!;

// /login
const url = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  redirectUri: process.env.WORKOS_REDIRECT_URI!,
});

// /callback?code=...
const { user, sealedSession } = await workos.userManagement.authenticateWithCode({
  code,
  session: { sealSession: true, cookiePassword },
});
// set cookie 'wos-session' = sealedSession

// protected routes
const session = workos.userManagement.loadSealedSession({ sessionData: cookie, cookiePassword });
const auth = await session.authenticate(); // { authenticated: true, user, sessionId, ... } | { authenticated: false, reason }
// if !authenticated: const r = await session.refresh(); r.authenticated ? set cookie r.sealedSession : redirect to /login

// /logout
const logoutUrl = await session.getLogoutUrl({ returnTo: 'http://localhost:3000' });
// clear cookie, then redirect to logoutUrl
```

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Sealed sessions (recommended): pass `session: { sealSession: true, cookiePassword }` to `authenticateWithCode` (not a top-level `sealSession`), store `sealedSession` in a cookie, and verify with `loadSealedSession(...).authenticate()`. Set the cookie `httpOnly`, `sameSite: 'lax'`, and `secure` in production.
- `clientId` is optional on `getAuthorizationUrl`/`authenticateWithCode`; it falls back to the constructor value (or `WORKOS_CLIENT_ID`).
- `session.getLogoutUrl()` throws if the session is no longer valid; in that case just clear the cookie and redirect home.
- With `express-session` instead, register the session middleware before the auth routes or the session won't persist.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`); if `express-session` is already configured, reuse it rather than adding a second session middleware.
