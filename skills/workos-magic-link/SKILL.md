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

If this skill conflicts with the fetched docs, follow the docs.

**CRITICAL DEPRECATION NOTICE:** Check the fetched docs for deprecation warnings. As of last update, WorkOS recommends Magic Auth over Magic Link due to email client security software pre-visiting links. If the docs show Magic Link is deprecated, use the `workos-magic-auth` skill instead.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`
- Optional: `WORKOS_REDIRECT_URI` - the callback URL for your app

**Verify API key validity:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1
# Should return 200 OK, not 401 Unauthorized
```

### WorkOS Dashboard Configuration

Confirm in WorkOS Dashboard:

1. Production environment is unlocked (billing info added) if deploying to prod
2. Redirect URI matches your callback endpoint
3. Magic Link connection exists or will auto-create on first use

## Step 3: Install WorkOS SDK

Detect package manager from lockfile:

```
Lockfile present?
  |
  +-- package-lock.json --> npm install @workos-inc/node
  |
  +-- yarn.lock         --> yarn add @workos-inc/node
  |
  +-- pnpm-lock.yaml    --> pnpm add @workos-inc/node
  |
  +-- bun.lockb         --> bun add @workos-inc/node
```

**Verify installation:**

```bash
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

Check fetched docs for latest SDK package name — it may differ by language (Node.js, Python, Ruby, etc.).

## Step 4: SDK Initialization

Create SDK client with environment variables. Pattern varies by language:

**Node.js example structure:**

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
```

**CRITICAL:** Never initialize SDK at module level in serverless environments — wrap in request handler to avoid stale connections.

## Step 5: Create Callback Route

Determine framework and create appropriate callback endpoint:

```
Framework?
  |
  +-- Next.js (App Router) --> app/auth/callback/route.ts
  |
  +-- Next.js (Pages)      --> pages/api/auth/callback.ts
  |
  +-- Express              --> app.get('/auth/callback', ...)
  |
  +-- Other                --> Check docs for routing pattern
```

**Callback logic (pseudo-code):**

1. Extract `code` parameter from query string
2. Exchange code for user profile: `workos.userManagement.authenticateWithCode({ code, clientId })`
3. Extract user info from profile response
4. Create session (your own session management)
5. Redirect to authenticated area

**Code exchange timeout:** Authorization code expires in **10 minutes**. Handle `invalid_grant` errors.

**Verify callback route exists:**

```bash
# Adjust path based on your framework
find . -path "*/auth/callback*" -o -path "*/api/auth/callback*" | head -1
```

## Step 6: Create Passwordless Session Endpoint

Create endpoint that generates magic link and sends it to user.

### Email Delivery Decision Tree

```
Who sends the email?
  |
  +-- WorkOS (simple, WorkOS-branded)
  |     |
  |     +--> Use workos.userManagement.createPasswordlessSession()
  |          with 'send_email: true'
  |          Done - WorkOS handles delivery
  |
  +-- Custom email service (branded, your SMTP)
        |
        +--> Use workos.userManagement.createPasswordlessSession()
             with 'send_email: false'
        |
        +--> Extract 'link' from response
        |
        +--> Send via your email service (SendGrid, SES, etc.)
```

**Key parameters:**

- `email` (required) - User's email address
- `type: 'MagicLink'` (required)
- `redirect_uri` (optional) - Override default callback URL
- `state` (optional) - Preserve app state across redirect
- `send_email` - `true` for WorkOS delivery, `false` for custom

**Magic Link validity:** Links expire in **15 minutes** and are **single-use**.

### Session Endpoint Pattern (pseudo-code)

```typescript
POST /auth/magic-link
Body: { email: string, redirectTo?: string }

1. Validate email format
2. Call workos.userManagement.createPasswordlessSession({
     email,
     type: 'MagicLink',
     redirect_uri: redirectTo || DEFAULT_CALLBACK,
     send_email: USE_WORKOS_EMAIL // true or false
   })
3. If send_email=false, extract link and send via your email service
4. Return success response (do not leak link in response)
```

**Security:** Never return the magic link in the API response — email only.

## Step 7: Session Management Integration

Magic Link is **authentication only** — you must implement session management.

After successful callback (Step 5), implement:

1. **Create session:** Set secure HTTP-only cookie or JWT
2. **Session duration:** Define your own timeout (e.g., 7 days, 30 days)
3. **Session validation:** Middleware to check session on protected routes
4. **Logout:** Clear session cookie/token

**Example session creation:**

```typescript
// After authenticating with code
const { user } = await workos.userManagement.authenticateWithCode({ code, clientId });

// Your session logic
const sessionToken = createSecureToken(user.id);
response.setCookie('session', sessionToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
```

## Step 8: UI Integration

Add magic link sign-in form to your login page:

1. Email input field
2. Submit button triggers POST to your session endpoint (Step 6)
3. Show "Check your email" success message
4. Handle error states (invalid email, rate limits, API errors)

**Do NOT:**

- Display the magic link in the UI
- Allow unauthenticated users to generate links without rate limiting

## Step 9: Email Client Security Workaround

**CRITICAL ISSUE:** Email security software may pre-visit links, expiring them before users click.

### Mitigation Strategies

1. **User education:** Document that users should allowlist your magic link emails
2. **Link design:** Use obvious "Sign In" buttons, not naked URLs
3. **Logging:** Track link visits to detect pre-fetching patterns
4. **Consider Magic Auth:** Check docs — WorkOS now recommends Magic Auth over Magic Link

**Detection pattern:**

```typescript
// In callback handler
const timestamp = Date.now();
const codeAge = timestamp - extractTimestampFromCode(code);

if (codeAge < 1000) {
  // Code used within 1 second - likely pre-fetch
  logger.warn('Possible email security pre-fetch detected');
}
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables exist
[ -n "$WORKOS_API_KEY" ] && echo "✓ API key set" || echo "✗ API key missing"
[ -n "$WORKOS_CLIENT_ID" ] && echo "✓ Client ID set" || echo "✗ Client ID missing"

# 2. SDK installed
npm list @workos-inc/node 2>/dev/null && echo "✓ SDK installed" || echo "✗ SDK missing"

# 3. Callback route exists (adjust path for your framework)
find . -type f -name "*callback*" | grep -q . && echo "✓ Callback found" || echo "✗ No callback"

# 4. API key valid
curl -sf -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1 >/dev/null \
  && echo "✓ API key valid" || echo "✗ API key invalid"

# 5. Build succeeds
npm run build && echo "✓ Build passed" || echo "✗ Build failed"
```

**Manual verification:**

- [ ] Can generate magic link via your endpoint
- [ ] Email delivers (WorkOS or custom)
- [ ] Clicking link redirects to callback
- [ ] Callback exchanges code successfully
- [ ] Session is created after auth
- [ ] Protected routes require session

## Error Recovery

### "Invalid authorization code" / "invalid_grant"

**Root cause:** Code expired (10min timeout) or already used.

**Fix:**

1. Check code is exchanged immediately in callback, not stored/delayed
2. Check for email security pre-fetching (see Step 9)
3. Implement expiration handling: prompt user to request new link

**Code:**

```typescript
try {
  await workos.userManagement.authenticateWithCode({ code, clientId });
} catch (error) {
  if (error.code === 'invalid_grant') {
    return redirect('/login?error=link_expired');
  }
  throw error;
}
```

### "Unauthorized" (401) on API calls

**Root cause:** Invalid API key or wrong environment.

**Fix:**

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check using correct environment key (test vs. prod)
3. Regenerate key in WorkOS Dashboard if compromised

### Magic link expires immediately

**Root cause:** Email security software pre-visiting links.

**Fix:**

1. Advise users to allowlist sending domain
2. Check WorkOS docs for Magic Auth migration (better security model)
3. Implement detection logging (see Step 9)

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match WorkOS Dashboard configuration.

**Fix:**

1. Check `redirect_uri` parameter matches Dashboard exactly (including protocol, port)
2. Ensure no trailing slashes mismatch
3. For localhost testing, add `http://localhost:3000/auth/callback` in Dashboard

**Verify configuration:**

```bash
echo $WORKOS_REDIRECT_URI
# Should match WorkOS Dashboard Redirect URI field exactly
```

### Emails not sending (WorkOS delivery)

**Root cause:** Connection not created or email provider issues.

**Fix:**

1. Check WorkOS Dashboard for Magic Link connection status
2. Verify email domain doesn't block WorkOS sender
3. Check WorkOS status page for service issues
4. Review API response for error details

### Session not persisting after login

**Root cause:** Session logic not implemented (Magic Link is auth only).

**Fix:**

1. Implement session creation in callback handler (Step 7)
2. Verify session cookie is secure, HTTP-only, and has correct domain
3. Check session middleware is applied to protected routes

### Rate limiting errors

**Root cause:** Too many passwordless session requests.

**Fix:**

1. Implement client-side rate limiting (e.g., 1 request per 60 seconds per email)
2. Add backend rate limiting by IP or email
3. Show user-friendly "Please wait" message

## Production Checklist

Before going live:

- [ ] Billing information added to WorkOS Dashboard (unlocks Production environment)
- [ ] Production `WORKOS_API_KEY` replaced (not test key)
- [ ] Production redirect URI configured in Dashboard
- [ ] Production API key stored in secure secrets manager (not committed to git)
- [ ] IP allowlist configured if needed (Cloudflare IP ranges)
- [ ] Email deliverability tested with production email service
- [ ] Session security reviewed (secure cookies, HTTPS only)
- [ ] Error handling covers all API failure modes
- [ ] Monitoring added for link expiration rates

## Related Skills

- **workos-magic-auth**: Recommended replacement for Magic Link (better security)
- **workos-sso**: Share same redirect URI / profile handling pattern
- **workos-mfa**: Add MFA to passwordless authentication flows
