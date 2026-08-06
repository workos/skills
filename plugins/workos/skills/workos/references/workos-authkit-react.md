# WorkOS AuthKit for React (SPA)

## Decision Tree

```
START
  │
  ├─► Fetch README (BLOCKING)
  │   raw.githubusercontent.com/workos/authkit-react/main/README.md
  │   README is source of truth. Stop if fetch fails.
  │
  ├─► Detect Build Tool
  │   ├─ vite.config.ts exists? → Vite
  │   └─ otherwise → Create React App
  │
  ├─► Set Env Var Prefix
  │   ├─ Vite → VITE_WORKOS_CLIENT_ID
  │   └─ CRA  → REACT_APP_WORKOS_CLIENT_ID
  │
  └─► Implement per README
```

## Critical: Build Tool Detection

| Marker File               | Build Tool | Env Prefix   | Access Pattern            |
| ------------------------- | ---------- | ------------ | ------------------------- |
| `vite.config.ts`          | Vite       | `VITE_`      | `import.meta.env.VITE_*`  |
| `craco.config.js` or none | CRA        | `REACT_APP_` | `process.env.REACT_APP_*` |

**Wrong prefix = undefined values at runtime.** This is the #1 integration failure.

## Critical: Redirect URI — No Callback Path

The React SDK handles the OAuth redirect **internally** via AuthKitProvider.

- **No callback route** — do not create a `/callback` route; the SPA has no server
- **No callback path** — the redirect URI is the app **origin** (e.g., `http://localhost:5173`), NOT `http://localhost:5173/callback`
- SDK intercepts the redirect client-side; token exchange happens automatically

The `/callback` convention comes from Next.js — it does not apply to SPAs.

In the WorkOS Dashboard:

- Add the redirect URI (app origin, no path) on the **Redirects** page
- Add the app origin to the **allowed origins** list on the **Authentication** page (required for client-side token exchange)

Redirect URI env var must match the Dashboard value exactly.

## Required Environment Variables

```
{PREFIX}WORKOS_CLIENT_ID=client_...
{PREFIX}WORKOS_REDIRECT_URI=http://localhost:5173
```

Redirect URI = app origin, **no path**. No `WORKOS_API_KEY` needed. Client-side only SDK.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration. **Do not mark complete until all pass:**

```bash
# 1. Check env var prefix matches build tool
grep -E "VITE_WORKOS_CLIENT_ID|REACT_APP_WORKOS_CLIENT_ID" .env .env.local 2>/dev/null

# 2. Check AuthKitProvider wraps app root
grep "AuthKitProvider" src/main.tsx src/index.tsx 2>/dev/null || echo "FAIL: AuthKitProvider missing"

# 3. Check redirect URI has no callback path (SDK handles redirect internally)
grep -E "WORKOS_REDIRECT_URI=.*/(callback|auth)" .env .env.local 2>/dev/null && echo "FAIL: redirect URI must be the app origin, no path"

# 4. Check no server framework present (wrong skill if found)
grep -E '"next"|"react-router"' package.json && echo "WARN: Server framework detected"

# 5. Build succeeds
pnpm build
```

**If check #2 fails:** AuthKitProvider must wrap the app root in main.tsx/index.tsx. This is required for useAuth() to work.

## Error Recovery

### "clientId is required"

**Cause:** Env var inaccessible (wrong prefix)

Check: Does prefix match build tool? Vite needs `VITE_`, CRA needs `REACT_APP_`.

### Auth state lost on refresh

**Cause:** Token persistence issue

Check: Browser dev tools → Application → Local Storage. SDK stores tokens here automatically.

### useAuth returns undefined

**Cause:** Component outside provider tree

Check: Entry file (`main.tsx` or `index.tsx`) wraps `<App />` in `<AuthKitProvider>`.

### Redirect fails after sign-in

**Cause:** Redirect URI has a path (e.g., `/callback`) or mismatches the Dashboard

Check: Env var redirect URI is the app origin with no path and exactly matches WorkOS Dashboard → Redirects configuration. If a `/callback` route was created, delete it — the SDK handles the redirect internally.
