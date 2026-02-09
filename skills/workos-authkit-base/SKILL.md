---
name: workos-authkit-base
description: Architectural reference for WorkOS AuthKit integrations. Fetch README first for implementation details.
---

# WorkOS AuthKit Integration

## Step 1: Fetch AuthKit Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/user-management/authkit`

This page is the source of truth for AuthKit concepts, supported frameworks, and setup requirements. If this skill conflicts with the docs, follow the docs.

## Step 2: Detect User's Framework

Run these commands to identify the project's framework. Check each in order; use the first match.

```bash
# Next.js
grep -q '"next"' package.json 2>/dev/null && echo "DETECTED: nextjs"

# React Router / Remix
grep -qE '"react-router"|"@remix-run"' package.json 2>/dev/null && echo "DETECTED: react-router"

# TanStack Start
grep -q '"@tanstack/start"' package.json 2>/dev/null && echo "DETECTED: tanstack-start"

# React (standalone SPA — check AFTER framework-specific entries)
grep -q '"react"' package.json 2>/dev/null && echo "DETECTED: react"
```

If none match, check for a plain HTML/JS project:

```bash
# Vanilla JS — no package.json or no framework dependency
[ ! -f package.json ] && echo "DETECTED: vanilla-js"
ls index.html 2>/dev/null && echo "DETECTED: vanilla-js"
```

## Step 3: Route to Framework-Specific Skill

Use the detection result from Step 2 to select the correct skill. **Do not continue past this step if a framework matched — switch to the matching skill immediately.**

```
Detection result         -->  Skill to invoke
─────────────────────────────────────────────
nextjs                   -->  workos-authkit-nextjs
react-router             -->  workos-authkit-react-router
tanstack-start           -->  workos-authkit-tanstack-start
react                    -->  workos-authkit-react
vanilla-js               -->  workos-authkit-vanilla-js
```

**If a framework is detected:** Stop here. The framework-specific skill handles everything from install through verification.

**If no framework is detected:** Continue to Step 4 for universal fallback setup.

## Step 4: Universal AuthKit Setup (Fallback)

Use this only when no framework-specific skill applies (custom server, edge runtime, non-standard stack).

### 4a. Environment Variables

Create or update `.env` with these values. All four are required for server-side AuthKit.

```
WORKOS_API_KEY=sk_...          # From WorkOS Dashboard > API Keys
WORKOS_CLIENT_ID=client_...    # From WorkOS Dashboard > API Keys
WORKOS_REDIRECT_URI=           # Must match Dashboard redirect URI exactly
WORKOS_COOKIE_PASSWORD=        # 32+ character random string
```

Generate a cookie password:

```bash
openssl rand -base64 32
```

### 4b. Install the WorkOS SDK

Detect the package manager and install:

```bash
# Detect package manager
if [ -f pnpm-lock.yaml ]; then PM="pnpm add"
elif [ -f yarn.lock ]; then PM="yarn add"
elif [ -f bun.lockb ] || [ -f bun.lock ]; then PM="bun add"
else PM="npm install"; fi

$PM @workos-inc/node
```

Verify install succeeded:

```bash
ls node_modules/@workos-inc/node/package.json && echo "OK" || echo "FAIL: SDK not installed"
```

### 4c. Initialize the WorkOS Client

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### 4d. Create the Auth Redirect

Build the authorization URL using the SDK. Do not construct OAuth URLs manually.

```typescript
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  clientId: process.env.WORKOS_CLIENT_ID,
});
// Redirect the user to authorizationUrl
```

### 4e. Handle the Callback

At the route matching `WORKOS_REDIRECT_URI`, exchange the authorization code:

```typescript
const { user, accessToken, refreshToken } = await workos.userManagement.authenticateWithCode({
  code: requestCode,       // from query param ?code=...
  clientId: process.env.WORKOS_CLIENT_ID,
});
// Store tokens securely (httpOnly cookie, session store, etc.)
```

## Verification

Run all checks. **Do not mark complete until every check passes.**

```bash
# 1. All four env vars present
for var in WORKOS_API_KEY WORKOS_CLIENT_ID WORKOS_REDIRECT_URI WORKOS_COOKIE_PASSWORD; do
  grep -q "$var" .env .env.local 2>/dev/null && echo "OK: $var" || echo "FAIL: $var not found"
done

# 2. SDK installed
ls node_modules/@workos-inc/*/package.json 2>/dev/null && echo "OK: SDK installed" || echo "FAIL: No WorkOS SDK"

# 3. WorkOS imports exist in source
grep -rl "@workos-inc" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | head -3 || echo "FAIL: No WorkOS imports"

# 4. Build succeeds
npm run build 2>&1 | tail -3
```

## Error Recovery

| Error | Cause | Fix |
|---|---|---|
| `Module not found: @workos-inc/*` | SDK not installed | Re-run install from Step 4b; verify `node_modules/@workos-inc` exists |
| `WORKOS_API_KEY is required` | Missing env var | Add `WORKOS_API_KEY=sk_...` to `.env` / `.env.local` |
| `Invalid API key` | Wrong key or environment mismatch | Confirm key from Dashboard matches environment (staging vs production) |
| `Redirect URI mismatch` | Callback URL differs between code and Dashboard | Compare `WORKOS_REDIRECT_URI` in `.env` to Dashboard > Redirects exactly |
| `Cookie password must be 32+ characters` | Password too short | Run `openssl rand -base64 32` and update `WORKOS_COOKIE_PASSWORD` |
| `invalid_grant` or `code expired` | Authorization code used twice or callback too slow | Check callback handler runs only once per code; remove duplicate route handlers |
| `Cannot read properties of undefined (reading 'user')` | Auth response not awaited | Add `await` to `authenticateWithCode()` call |

## Related Skills

- **workos-authkit-nextjs** — Next.js App Router (13+), server-side rendering
- **workos-authkit-react** — React SPA with client-side AuthKit
- **workos-authkit-react-router** — React Router / Remix integration
- **workos-authkit-tanstack-start** — TanStack Start framework
- **workos-authkit-vanilla-js** — Plain HTML/JS without a framework
