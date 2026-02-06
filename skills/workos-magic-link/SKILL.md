---
name: workos-magic-link
description: Implement passwordless authentication via Magic Link.
---

<!-- generated -->

# WorkOS Magic Link

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
1. `https://workos.com/docs/magic-link/launch-checklist`
2. `https://workos.com/docs/magic-link/index`
3. `https://workos.com/docs/magic-link/example-apps`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

**DEPRECATION WARNING:** The docs may indicate Magic Link is deprecated in favor of Magic Auth. If so:
- Check if the project requires Magic Link specifically (legacy reasons, backward compatibility)
- If no hard requirement exists, recommend upgrading to Magic Auth instead
- If proceeding with Magic Link, note the security limitation: email clients may pre-visit links and invalidate them

## Step 2: Pre-Flight Validation

### WorkOS Account & Credentials

Check environment variables or secrets store for:
- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Verify:** Both values are present before continuing. Magic Link cannot function without them.

### Production Readiness (Decision Tree)

```
Environment?
  |
  +-- Development --> Continue to Step 3
  |
  +-- Production  --> STOP. Complete launch checklist:
                       1. Add billing info to WorkOS Dashboard
                       2. Configure production redirect URI in Dashboard
                       3. Rotate API key for production environment
                       4. (Optional) Create IP allowlist using Cloudflare IPs:
                          https://www.cloudflare.com/ips/
```

**Critical for Production:** Magic Link connections are free, but enterprise SSO connections will be charged. Unlock Production environment in Dashboard before deploying.

## Step 3: Install WorkOS SDK

Detect package manager from lock files:
- `package-lock.json` → npm
- `yarn.lock` → yarn
- `pnpm-lock.yaml` → pnpm
- `bun.lockb` → bun

Install SDK for detected language/framework. Check docs for exact package name (e.g., `@workos-inc/node` for Node.js).

**Verify:** SDK package exists in dependencies before continuing.

```bash
# Node.js example
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 4: Configure SDK Client

Initialize WorkOS client with API key and client ID. Pattern varies by language:

```
Language?
  |
  +-- Node.js/TypeScript --> Import WorkOS, create client instance
  |
  +-- Python --> from workos import WorkOSClient
  |
  +-- Ruby --> require 'workos'
  |
  +-- Go --> import "github.com/workos/workos-go/v4/pkg/workos"
```

Check docs for exact initialization pattern. **Do not hardcode credentials** — use environment variables or secrets manager.

**Verify:** Client can be instantiated without errors (test import/require).

## Step 5: Create Callback Endpoint

### Determine Redirect URI Pattern

Check existing routes to match convention:
- REST API: `/auth/callback`, `/api/auth/callback`
- Next.js App Router: `app/auth/callback/route.ts`
- Express/Fastify: `app.get('/auth/callback', ...)`

Set this as redirect URI in WorkOS Dashboard under **Redirects** section.

### Implement Callback Handler

The callback handler MUST:
1. Extract `code` parameter from query string
2. Exchange code for user profile using SDK (code valid for 10 minutes)
3. Create application session with user profile data
4. Handle `state` parameter if used (for restoring app state)
5. Redirect user to authenticated route

**Pattern from docs:**

```typescript
// Pseudocode - check docs for exact SDK method names
const { profile } = await workos.userManagement.authenticateWithCode({
  code: request.query.code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// Create your application session
const session = createSession(profile);

// Redirect to app
return redirect('/dashboard');
```

**Critical:** The authorization code expires after 10 minutes. Do NOT cache or reuse codes.

**Error Handling Required:**
- Invalid code → return clear error, do not crash
- Expired code → show "Link expired, request new one"
- Network errors → retry with exponential backoff

## Step 6: Create Passwordless Session Endpoint

### Email Delivery Strategy (Decision Tree)

```
Who sends the email?
  |
  +-- WorkOS (simple, WorkOS-branded) --> Use sendEmail: true in API call
  |
  +-- Custom (branded, your domain) --> Use sendEmail: false, handle email yourself
```

### Implement Session Creation

The session creation endpoint MUST:
1. Accept user email as input
2. Validate email format (basic regex or library)
3. Call WorkOS API to create passwordless session
4. If custom email: extract link, send via your email service
5. Return success (do NOT return the link in API response for security)

**Pattern from docs:**

```typescript
// Pseudocode - check docs for exact method names
const session = await workos.userManagement.createPasswordlessSession({
  email: userEmail,
  redirectUri: process.env.REDIRECT_URI, // Optional: override default
  state: encodeState({ returnTo: '/dashboard' }), // Optional: restore app state
});

// Option 1: WorkOS sends email (WorkOS-branded)
// Done automatically if no custom email logic

// Option 2: Custom branded email
const magicLink = session.link; // Valid for 15 minutes
await sendCustomEmail(userEmail, magicLink);
```

**Security Notes:**
- Magic Links are **single-use** — they invalidate after first click
- Links expire after **15 minutes**
- Email security scanners may pre-visit links and invalidate them (see Error Recovery)

### State Parameter Usage

If your app needs to restore context after auth (e.g., redirect to specific page):

1. Encode state as JSON or JWT
2. Pass state when creating session
3. Decode state in callback handler
4. Redirect to stored location

**Example:**
```typescript
const state = Buffer.from(JSON.stringify({ returnTo: '/pricing' })).toString('base64');
// Pass state to createPasswordlessSession
// In callback: const { returnTo } = JSON.parse(Buffer.from(state, 'base64').toString());
```

## Step 7: UI Integration

Add sign-in form that:
1. Collects user email
2. Calls passwordless session endpoint
3. Shows confirmation: "Check your email for magic link"
4. Handles loading states and errors

**Do NOT:**
- Display the magic link in UI (security risk)
- Auto-submit the form on page load (spam risk)
- Allow multiple rapid submissions (rate limit client-side)

## Step 8: Connection Auto-Creation

**Important:** WorkOS automatically creates a Magic Link Connection when you create a passwordless session for a new domain. You do NOT need to manually create connections in the Dashboard.

**Verify:** After first session creation for a domain, check Dashboard → Connections to see auto-created Magic Link connection.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK is installed
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK missing"

# 2. Check environment variables are set
[ -n "$WORKOS_API_KEY" ] && [ -n "$WORKOS_CLIENT_ID" ] || echo "FAIL: Credentials missing"

# 3. Check callback route exists (adjust path for your framework)
grep -r "authenticateWithCode\|auth.*code" . --include="*.ts" --include="*.js" || echo "FAIL: No callback handler found"

# 4. Check session creation exists
grep -r "createPasswordlessSession\|passwordless.*session" . --include="*.ts" --include="*.js" || echo "FAIL: No session creation found"

# 5. Test callback endpoint responds (adjust URL for your setup)
curl -I http://localhost:3000/auth/callback 2>/dev/null | grep "HTTP" || echo "FAIL: Callback route not responding"

# 6. Build succeeds
npm run build || echo "FAIL: Build failed"
```

**Manual Tests Required:**
1. Submit email → receive email with magic link (or custom email if implemented)
2. Click link → redirected to callback → profile retrieved → session created → redirected to app
3. Click expired link (>15 min old) → error shown
4. Click used link (already clicked once) → error shown

## Error Recovery

### "Magic Link has already been used" or "Link expired"

**Root cause:** Links are single-use and expire after 15 minutes.

**Fix:**
1. Show user-friendly error: "This link has expired. Request a new one."
2. Add "Resend link" button that calls session creation endpoint again
3. **Email security scanners:** If links expire before users see them:
   - Advise users to allowlist your domain in email client
   - Consider custom email with "Click here to get your link" button that fetches a fresh link
   - Document this limitation in user onboarding

### "Invalid authorization code" in callback

**Root cause:** Code expired (10 min limit) or already used.

**Fix:**
1. Check timing: callback should execute immediately after redirect
2. Do NOT cache or log authorization codes
3. Check for duplicate callback requests (browser pre-fetch, double-click)

### "Email not received"

**Root cause:** SPAM filters, WorkOS email domain blocked, or incorrect email.

**Fix:**
1. Check WorkOS Dashboard logs for session creation success
2. If using WorkOS email: users should check SPAM folder, allowlist noreply@workos.com
3. If using custom email: verify your email service logs for delivery
4. Implement "Resend" functionality with rate limiting (max 3 per 5 minutes)

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match Dashboard configuration.

**Fix:**
1. Check WorkOS Dashboard → Configuration → Redirect URIs
2. Add exact callback URL including protocol, domain, port (dev), path
3. For local dev: use `http://localhost:3000/auth/callback`, not `127.0.0.1`
4. For production: use HTTPS, not HTTP

### SDK import errors

**Root cause:** Package not installed or wrong import path.

**Fix:**
1. Verify SDK installed: `npm list @workos-inc/node` (adjust package name)
2. Check docs for correct import path (may vary by SDK version)
3. Clear node_modules and reinstall if corrupted

### API key "invalid" or "unauthorized"

**Root cause:** Wrong key, wrong environment, or revoked key.

**Fix:**
1. Verify key starts with `sk_` (not client ID starting with `client_`)
2. Check environment: dev keys don't work in production, vice versa
3. Rotate key in Dashboard if compromised
4. Check Dashboard → API Keys for key status (active vs revoked)

## Production Considerations

### Session Management

WorkOS Magic Link does **NOT** manage sessions — you must implement:
1. Session storage (cookies, JWT, database)
2. Session expiration (recommended: 7-30 days)
3. Session invalidation (logout endpoint)
4. CSRF protection if using cookies

### Rate Limiting

Implement rate limits on session creation endpoint:
- Per IP: 5 requests per minute
- Per email: 3 requests per 5 minutes

Prevents abuse and email bombing.

### Monitoring

Log these events for debugging:
- Session creation requests (email, success/fail)
- Callback invocations (code received, profile retrieved)
- Link expiration errors (helps detect scanner issues)

**Do NOT log:** Authorization codes, magic links, API keys.

### Email Deliverability (Custom Email)

If using custom email:
1. Configure SPF, DKIM, DMARC records
2. Use reputable email service (SendGrid, Postmark, AWS SES)
3. Monitor bounce rates and adjust
4. Include unsubscribe link (may be legally required)

## Related Skills

- **workos-magic-auth**: Upgraded passwordless flow (recommended over Magic Link)
- **workos-sso**: Enterprise SSO using same callback pattern
- **workos-mfa**: Add MFA to authenticated sessions
- **workos-directory-sync**: Sync user directories after authentication
