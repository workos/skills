---
name: workos-magic-link
description: Implement passwordless authentication via Magic Link.
---

<!-- refined:sha256:4f077edd7d90 -->

# WorkOS Magic Link

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:

1. `https://workos.com/docs/magic-link/launch-checklist`
2. `https://workos.com/docs/magic-link/index`
3. `https://workos.com/docs/magic-link/example-apps`

These docs are the source of truth. If this skill conflicts with the documentation, follow the docs.

**CRITICAL DEPRECATION NOTICE:** Magic Link is deprecated by WorkOS due to email security software pre-visiting links and invalidating them. The docs recommend Magic Auth instead. Confirm with stakeholders before implementing Magic Link for new projects.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS account exists at `dashboard.workos.com`
- Navigate to Production environment → Settings → API Keys
- Verify API key starts with `sk_`
- Verify Client ID starts with `client_`

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_` (production or test)
- `WORKOS_CLIENT_ID` - starts with `client_`

**Warning:** Using test environment keys in production will fail. Verify environment matches deployment target.

### Redirect URI Configuration

- Check WorkOS Dashboard → Configuration → Redirect URIs
- Confirm callback URL matches your app's domain
- Format: `https://yourdomain.com/auth/callback` (HTTPS required for production)

## Step 3: SDK Installation (Decision Tree)

Detect project language and install appropriate SDK:

```
Language/Framework?
  |
  +-- Node.js/Express --> npm install @workos-inc/node
  |
  +-- Python/Flask/Django --> pip install workos
  |
  +-- Ruby/Rails --> gem install workos
  |
  +-- Go --> go get github.com/workos/workos-go/v4
  |
  +-- Java --> Maven/Gradle (see example apps URL)
```

**Verify:** SDK package exists in dependencies before continuing.

Check example apps documentation (from Step 1) for language-specific setup if not listed above.

## Step 4: Initialize SDK

Configure SDK with API credentials. Pattern varies by language:

**Node.js:**
```javascript
const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
```

**Python:**
```python
import workos

workos.api_key = os.getenv('WORKOS_API_KEY')
workos.client_id = os.getenv('WORKOS_CLIENT_ID')
```

**Critical:** Never hardcode credentials. Always use environment variables or secret management.

**Verify SDK initialization:**
```bash
# Check SDK import doesn't throw
node -e "require('@workos-inc/node'); console.log('SDK loaded')"
```

## Step 5: Create Callback Endpoint

Add a route to handle the OAuth callback from WorkOS. This endpoint:

1. Receives an authorization `code` parameter (valid 10 minutes)
2. Exchanges code for user Profile
3. Creates application session
4. Redirects to authenticated page

**Route location (by framework):**

```
Framework        --> Route path
Express/Node.js  --> app.get('/auth/callback', ...)
Flask/Django     --> @app.route('/auth/callback')
Rails            --> get '/auth/callback'
```

**Implementation pattern:**

```javascript
// Node.js/Express example - see docs for other languages
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    // Exchange code for user profile
    const profile = await workos.userManagement.authenticateWithCode({
      code,
      clientId,
    });

    // Create your application session
    req.session.userId = profile.user.id;
    req.session.email = profile.user.email;

    // Redirect to app
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect('/login?error=auth_failed');
  }
});
```

**CRITICAL:** The code expires after 10 minutes. Handle expiration errors gracefully.

Check the fetched documentation for exact SDK method names — they may vary by language and SDK version.

## Step 6: Create Passwordless Session Endpoint

Add an endpoint that generates the Magic Link when user submits their email.

**Key parameters:**
- `email` - User's email address (required)
- `redirect_uri` - Override default callback URL (optional)
- `state` - Arbitrary data to preserve between redirects (optional)

**Implementation pattern:**

```javascript
app.post('/auth/magic-link', async (req, res) => {
  const { email } = req.body;

  try {
    const session = await workos.passwordless.createSession({
      email,
      type: 'MagicLink',
      redirectUri: 'https://yourdomain.com/auth/callback',
      state: JSON.stringify({ returnTo: req.body.returnTo }),
    });

    // Decision: WorkOS email or custom email?
    if (useWorkOSEmail) {
      // WorkOS sends branded email automatically
      await workos.passwordless.sendSession(session.id);
    } else {
      // Send via your email service
      await yourEmailService.send({
        to: email,
        subject: 'Sign in to YourApp',
        html: `<a href="${session.link}">Click to sign in</a>`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**Email delivery decision tree:**

```
Email provider?
  |
  +-- Use WorkOS email --> Call sendSession(sessionId)
  |                        (WorkOS branded, no customization)
  |
  +-- Use custom email  --> Send session.link via your service
                            (Full template control, requires email infra)
```

**CRITICAL - Magic Link expiration:**
- Links expire after 15 minutes
- Links are single-use only
- Email security software may pre-visit links and invalidate them before user clicks
- If using corporate email (Gmail, Outlook), advise users to allowlist sender

Check documentation for exact SDK method names (`createSession`, `sendSession`).

## Step 7: Domain Connection Auto-Creation

**Important:** WorkOS automatically creates a Magic Link Connection when you create a Passwordless Session for a new email domain.

**Verify in Dashboard:**
```
1. Go to WorkOS Dashboard → Connections
2. Find "Magic Link" connection type
3. Confirm domain appears after first session creation
```

No manual connection setup required. If domain doesn't appear, check API key permissions.

## Step 8: Session Management (CRITICAL)

**WorkOS does NOT manage sessions.** You must implement:

1. **Session creation** - After code exchange in callback
2. **Session storage** - Cookie, JWT, database session, etc.
3. **Session validation** - Check on protected routes
4. **Session expiration** - Define timeout policy
5. **Logout** - Clear session data

**Example session middleware:**

```javascript
// Protect routes requiring authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { email: req.session.email });
});
```

**Session duration:** You decide. Common patterns:
- Short (30 min - 1 hour) for high-security apps
- Long (1-7 days) for consumer apps
- Remember me checkbox for user choice

## Step 9: Production Checklist

Before deploying to production, verify ALL items:

**Dashboard Configuration:**
- [ ] Production environment unlocked (billing info added)
- [ ] Production Redirect URI configured with HTTPS
- [ ] Production API key secured (not committed to repo)

**IP Allowlist (if required):**
- [ ] Cloudflare IP ranges allowlisted: https://www.cloudflare.com/ips/

**Code Verification:**
- [ ] Callback endpoint handles code exchange
- [ ] Session creation works after authentication
- [ ] Protected routes validate session
- [ ] Logout clears session data
- [ ] Error messages don't expose sensitive data

**Email Deliverability:**
- [ ] Test email delivery in production domain
- [ ] Configure SPF/DKIM if using custom email
- [ ] Add sender to corporate allowlist (if applicable)

## Verification Checklist (ALL MUST PASS)

Run these commands to verify integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || pip list | grep workos || gem list | grep workos

# 2. Check environment variables set
env | grep WORKOS_API_KEY || echo "FAIL: API key not set"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Client ID not set"

# 3. Check callback route exists
grep -r "auth/callback" . --include="*.js" --include="*.py" --include="*.rb" || echo "FAIL: Callback route not found"

# 4. Check session management exists
grep -r "session" . --include="*.js" --include="*.py" --include="*.rb" | grep -v node_modules || echo "FAIL: No session management found"

# 5. Test endpoint responds (after server start)
curl -X POST http://localhost:3000/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' || echo "FAIL: Magic Link endpoint error"

# 6. Application builds/starts
npm run build || python app.py || rails server
```

**If any check fails:** Review corresponding step before proceeding.

## Error Recovery

### "Invalid authorization code" during callback

**Root cause:** Code expired (10 min limit) or already used.

**Fix:**
1. Check callback executes within 10 minutes of link click
2. Ensure callback doesn't retry/double-submit code
3. Add error handling to redirect user to re-authenticate:
   ```javascript
   catch (error) {
     if (error.code === 'invalid_grant') {
       return res.redirect('/login?error=expired');
     }
   }
   ```

### "Magic Link already used" or link doesn't work

**Root cause:** Email security software pre-visited link.

**Fix:**
1. Confirm with user if they use corporate email (Gmail, Outlook, etc.)
2. Advise user to allowlist sender email
3. Consider switching to Magic Auth (not Magic Link) per WorkOS recommendation
4. Check email client settings for link preview/pre-fetch features

Reference: https://workos.com/docs/magic-link/index (deprecation notice section)

### "Redirect URI mismatch"

**Root cause:** Callback URL doesn't match Dashboard configuration.

**Fix:**
1. Check WorkOS Dashboard → Configuration → Redirect URIs
2. Ensure exact match including protocol (https://) and path
3. If using `redirect_uri` parameter in createSession, verify it's pre-registered
4. Production must use HTTPS, not HTTP

### "Invalid API key"

**Root cause:** Wrong environment key or key doesn't have permissions.

**Fix:**
1. Verify key starts with `sk_test_` (test) or `sk_live_` (production)
2. Check environment matches: test keys don't work in production
3. Regenerate key in Dashboard if compromised

### SDK import errors

**Root cause:** Package not installed or wrong import path.

**Fix by language:**
```bash
# Node.js
npm install @workos-inc/node
# Check: const { WorkOS } = require('@workos-inc/node')

# Python
pip install workos
# Check: import workos

# Ruby
gem install workos
# Check: require 'workos'
```

### Session not persisting after login

**Root cause:** Session middleware not configured or cookies not working.

**Fix:**
1. Verify session middleware initialized (express-session, Flask sessions, etc.)
2. Check cookie settings (httpOnly, secure, sameSite)
3. Ensure HTTPS in production (secure cookies require it)
4. Verify session secret is set

### Email not delivered

**Root cause:** Email provider blocking or SPF/DKIM not configured.

**Fix:**
1. Check spam folder
2. If using WorkOS email: Check Dashboard logs for delivery status
3. If using custom email: Verify email service credentials
4. Configure SPF/DKIM records for custom domain
5. Test with personal email (Gmail) first to isolate corporate email issues

## State Parameter Usage

The optional `state` parameter preserves application context across the auth flow:

**Use cases:**
- Return user to original page after login
- Pass through A/B test variant
- Preserve shopping cart state
- Track referral source

**Pattern:**
```javascript
// Encode state when creating session
const state = JSON.stringify({
  returnTo: '/checkout',
  variant: 'experiment_a',
});

await workos.passwordless.createSession({
  email,
  type: 'MagicLink',
  state,
});

// Decode state in callback
const { state } = req.query;
const { returnTo, variant } = JSON.parse(state);
res.redirect(returnTo || '/dashboard');
```

**Security note:** Don't put sensitive data in state — it's visible in URL. Use it only for non-sensitive routing/tracking.

## Related Skills

- **workos-authkit-nextjs**: Full-featured auth with session management built-in
- **workos-magic-auth**: Recommended replacement for Magic Link (code-based instead of link-based)
- **workos-sso**: Enterprise SSO using same redirect flow as Magic Link
- **workos-mfa**: Add second factor to passwordless flows
