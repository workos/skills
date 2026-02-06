---
name: workos-magic-link
description: Implement passwordless authentication via Magic Link.
---

<!-- generated -->

# WorkOS Magic Link

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/magic-link/launch-checklist
- https://workos.com/docs/magic-link/index
- https://workos.com/docs/magic-link/example-apps

If this skill conflicts with documentation, follow documentation.

**IMPORTANT DEPRECATION NOTICE:** Check docs for current recommendation. Magic Link may be deprecated in favor of Magic Auth due to email client security software invalidating links. If docs recommend Magic Auth instead, use the `workos-magic-auth` skill.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access at https://dashboard.workos.com/
- Confirm Production environment is unlocked (billing info added) if deploying to production

### Environment Variables

Check for these secrets (names may vary by framework):

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify immediately:**
```bash
# Check secrets exist (adjust for your env var loading method)
printenv | grep WORKOS_API_KEY | grep -q "^WORKOS_API_KEY=sk_" && echo "PASS: API key" || echo "FAIL: API key missing or invalid"
printenv | grep WORKOS_CLIENT_ID | grep -q "^WORKOS_CLIENT_ID=client_" && echo "PASS: Client ID" || echo "FAIL: Client ID missing or invalid"
```

## Step 3: Install SDK

Detect package manager and language from project structure:

```
Project structure?
  |
  +-- package.json exists --> Node.js
  |     |
  |     +-- Detect: npm, yarn, pnpm, or bun
  |     +-- Install: @workos-inc/node
  |
  +-- requirements.txt exists --> Python
  |     |
  |     +-- Install: workos
  |
  +-- go.mod exists --> Go
  |     |
  |     +-- Install: github.com/workos/workos-go/v4
  |
  +-- Gemfile exists --> Ruby
        |
        +-- Install: workos
```

**Check SDK docs for exact package names** — above are examples only.

**Verify installation:**
```bash
# Node.js example
ls node_modules/@workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK not found"
```

## Step 4: SDK Configuration

Initialize SDK with credentials. Pattern varies by language:

**Node.js example pattern** (check docs for exact syntax):
```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
```

**Critical:** Never hardcode credentials. Always load from environment.

## Step 5: Create Callback Endpoint

### Determine Framework Pattern

```
Framework?
  |
  +-- Express.js --> app.get('/auth/callback', ...)
  |
  +-- Next.js (App Router) --> app/auth/callback/route.ts
  |
  +-- Next.js (Pages) --> pages/api/auth/callback.ts
  |
  +-- Flask --> @app.route('/auth/callback')
  |
  +-- Rails --> routes.rb + controller
```

### Callback Logic (Universal Pattern)

The callback endpoint must:

1. Extract `code` parameter from query string
2. Call SDK method to exchange code for user profile (code valid 10 minutes)
3. Create/update user session (YOUR session management)
4. Redirect to application route

**Check docs** for SDK method name — typically `getUserProfile`, `authenticateWithCode`, or similar.

**Example verification:**
```bash
# Check callback endpoint exists (adjust path for your framework)
grep -r "code.*query\|params" app/auth/callback pages/api/auth/callback 2>/dev/null && echo "PASS: Callback extracts code" || echo "FAIL: Callback missing"
```

## Step 6: Create Passwordless Session Endpoint

### Endpoint Requirements

This endpoint generates the magic link. Must accept:

- `email` (required) - user email address
- `redirect_uri` (optional) - override default from dashboard
- `state` (optional) - encode application state for restoration

### Email Delivery Decision Tree

```
Who sends email?
  |
  +-- WorkOS --> Use SDK method with send_email: true
  |              WorkOS-branded email sent automatically
  |              No SMTP configuration needed
  |
  +-- Custom --> Use SDK method with send_email: false
                 Extract link from response
                 Send via your email service (SendGrid, etc.)
                 Use your branded template
```

**Check docs** for SDK method name — typically `createPasswordlessSession` or similar.

**Critical:** Magic Link connection auto-created for email domain if none exists.

## Step 7: Configure Redirect URI

### In WorkOS Dashboard

1. Navigate to Configuration > Redirect URIs
2. Add your callback URL (e.g., `https://yourdomain.com/auth/callback`)
3. For local dev, add `http://localhost:3000/auth/callback` (adjust port)

**Production checklist:**
- Production redirect URI configured
- Uses HTTPS (not HTTP)
- Matches your deployed callback endpoint exactly

## Step 8: Session Management (YOUR RESPONSIBILITY)

**Critical:** WorkOS authenticates users but does NOT manage sessions. You must:

1. Store user identifier from profile in session/JWT/cookie
2. Set session expiration policy
3. Implement session validation middleware
4. Handle session invalidation/logout

**Common patterns:**
- Signed cookies with expiration
- JWT tokens with refresh strategy
- Server-side session store (Redis, database)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK missing"

# 2. Check environment variables set
printenv | grep -E "WORKOS_(API_KEY|CLIENT_ID)" | wc -l | grep -q "2" && echo "PASS: Env vars set" || echo "FAIL: Missing env vars"

# 3. Check callback endpoint exists (adjust path)
find . -type f \( -name "*callback*" -o -path "*/auth/callback/*" \) | grep -v node_modules | head -1 || echo "FAIL: No callback endpoint"

# 4. Check callback extracts code parameter
grep -r "code.*query\|code.*params" --include="*.js" --include="*.ts" --include="*.py" app pages src 2>/dev/null | head -1 || echo "FAIL: Code extraction missing"

# 5. Build succeeds
npm run build || python -m py_compile app.py || go build || bundle exec rake assets:precompile
```

**Manual verification:**
- [ ] WorkOS Dashboard shows correct redirect URI
- [ ] Test magic link flow end-to-end in development
- [ ] Email delivery works (WorkOS or custom)
- [ ] Session persists across page loads
- [ ] Logout invalidates session

## Error Recovery

### "Invalid authorization code" / 401 on callback

**Root cause:** Code already used (single-use) or expired (10 min).

**Common trigger:** Email security software pre-clicks links before user sees email.

**Fix:**
1. Check if this is production: Add Magic Link sender to email allowlist in corporate email settings
2. Consider migrating to Magic Auth (check Step 1 docs for recommendation)
3. Verify callback isn't being called twice (check middleware/logging)

**Diagnostic:**
```bash
# Check for duplicate callback invocations
grep "auth/callback" logs/*.log | wc -l
```

### "Missing or invalid API key"

**Root cause:** `WORKOS_API_KEY` not set or wrong format.

**Fix:**
```bash
# Verify key format
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "Format OK" || echo "Key should start with sk_"

# Check key in Dashboard
# 1. Go to WorkOS Dashboard > API Keys
# 2. Verify key matches and is not revoked
# 3. Regenerate if necessary
```

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match Dashboard configuration.

**Fix:**
1. Print actual callback URL from request in your logs
2. Compare exact string to Dashboard Redirect URI setting
3. Check for trailing slashes, HTTP vs HTTPS, port numbers

**Diagnostic:**
```bash
# Log full callback URL
# Add this temporarily to callback handler:
# console.log("Callback URL:", req.protocol + "://" + req.get("host") + req.originalUrl)
```

### "Session not persisting"

**Root cause:** Session management not implemented or misconfigured.

**Fix:**
1. Verify session creation code runs after successful authentication
2. Check cookie settings (httpOnly, secure, sameSite)
3. Test cookie storage in browser DevTools > Application > Cookies
4. For JWT: verify token is in Authorization header or cookie

### Magic link expires before user clicks

**Root cause:** Email security system visits link (15 min expiration, single use).

**Fixes in priority order:**
1. **Immediate:** Add sender to email allowlist (corporate IT)
2. **Short term:** Increase user instructions: "Click link immediately, don't forward"
3. **Long term:** Migrate to Magic Auth with code input (not link-based)

### SDK import fails

**Root cause:** Package not installed or wrong import path.

**Fix:**
```bash
# Reinstall SDK
npm install @workos-inc/node  # or appropriate package

# Check SDK version in package.json matches docs
grep "@workos-inc/node" package.json

# Verify import path from SDK docs (may use subpath exports)
```

## Production Deployment Checklist

Before going live:

- [ ] Production environment unlocked in WorkOS Dashboard (billing added)
- [ ] Production redirect URI configured (HTTPS)
- [ ] Production API key secured (not in version control)
- [ ] HTTPS enforced on callback endpoint
- [ ] Session expiration policy implemented
- [ ] Error logging configured for failed authentications
- [ ] Rate limiting on passwordless session creation endpoint
- [ ] Email allowlist instructions documented for enterprise users

## Related Skills

- **workos-magic-auth**: Recommended alternative to Magic Link (code input vs link click)
- **workos-sso**: Add SSO alongside passwordless auth
- **workos-mfa**: Add MFA requirement to authenticated sessions
- **workos-authkit-nextjs**: Full auth solution for Next.js (includes Magic Auth)
