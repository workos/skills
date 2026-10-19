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
   - `/login` — `workos.userManagement.getAuthorizationUrl({ provider: 'authkit', redirectUri, clientId })`, then redirect.
   - `/callback` — `workos.userManagement.authenticateWithCode({ code, clientId })`, store session.
   - `/logout` — clear session cookie, redirect.
4. **`.env`** (don't overwrite existing values; keep it in `.gitignore`):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:3000/callback
   WORKOS_COOKIE_PASSWORD=<generate with openssl rand -base64 32>
   ```
5. **Build:** `npx tsc --noEmit` (TS) or `node --check <entry-file>` (JS).

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Sealed sessions (recommended): pass `sealSession: true` to `authenticateWithCode`, store the sealed cookie, and verify with `loadSealedSession`. Set the cookie `httpOnly`, `sameSite: 'lax'`, and `secure` in production.
- With `express-session` instead, register the session middleware before the auth routes or the session won't persist.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`); if `express-session` is already configured, reuse it rather than adding a second session middleware.
