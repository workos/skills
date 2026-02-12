---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest configuration details:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Requirements

- Confirm you have Production environment access (custom domains NOT available in staging)
- Confirm custom domains are included in your WorkOS plan (see pricing page if unsure)
- Confirm you have DNS provider credentials with ability to create CNAME records

### Environment Check

Custom domains are **Production-only**:

```
Environment?
  |
  +-- Staging --> STOP. Custom domains not available. Default WorkOS domains will be used:
  |                - Emails from workos.dev
  |                - AuthKit at {random-phrase}.authkit.app
  |
  +-- Production --> Continue with configuration
```

## Step 3: Domain Type Decision Tree

Determine which custom domain(s) you need:

```
Which domains to configure?
  |
  +-- Email only --> Go to Step 4
  |
  +-- AuthKit only --> Go to Step 5
  |
  +-- Admin Portal only --> WebFetch admin-portal docs for specific steps
  |
  +-- Multiple --> Configure in order: Email (Step 4), AuthKit (Step 5), Admin Portal (docs)
```

**Note:** Each domain type has independent DNS requirements. You can configure one without the others.

## Step 4: Email Domain Configuration

### (A) Dashboard Setup

1. Navigate to WorkOS Dashboard → Domains section (Production environment must be selected)
2. Click "Add Domain" button
3. Enter the domain for sending emails (e.g., `example.com` to send from `no-reply@example.com`)

### (B) DNS Record Creation (CRITICAL)

**You will receive 3 CNAME records to create.** Example format:

```
Host                          Points To
-------------------------------------------------------------------
em1234._domainkey.example.com → em1234.dkim.workosmail.com
workos._domainkey.example.com → workos.dkim.workosmail.com
bounce.example.com            → bounce.workosmail.com
```

**Action:** Create ALL 3 CNAME records with your DNS provider before proceeding.

**DNS Provider-Specific Notes:**

- **Cloudflare:** Records must be DNS-only, NOT proxied (orange cloud OFF)
- **Route53/GoDaddy/Namecheap:** Use exact Host values, including subdomain parts
- **Root domain providers:** Some providers require `@` instead of domain name for root records

### (C) Verification

After creating DNS records:

1. Click "Verify now" in WorkOS Dashboard
2. If verification fails initially, WorkOS will retry for 72 hours (DNS propagation delay)
3. Check verification status in Dashboard → Domains

**Verification command (optional):**

```bash
# Check if CNAME records are live
dig +short em1234._domainkey.example.com CNAME
dig +short workos._domainkey.example.com CNAME
dig +short bounce.example.com CNAME
```

All three should return the `workosmail.com` targets.

### (D) Post-Verification

Once verified:

- AuthKit emails (magic links, password resets, invitations) send from `no-reply@your-domain.com`
- Admin Portal invites use the same sender
- **CRITICAL:** Do NOT delete the CNAME records — emails will fail if removed

## Step 5: AuthKit Domain Configuration

### (A) Dashboard Setup

1. Navigate to WorkOS Dashboard → Domains section (Production environment selected)
2. Click "Configure AuthKit domain" button
3. Enter subdomain for AuthKit UI (e.g., `auth.example.com`)

**Domain Choice:**

- Use a subdomain you control (e.g., `auth.example.com`, `login.example.com`)
- This replaces the default `{random-phrase}.authkit.app` domain
- SSL certificate is provisioned automatically by WorkOS

### (B) DNS Record Creation (CRITICAL)

**You will receive 1 CNAME record to create.** Example format:

```
Host               Points To
-----------------------------------------
auth.example.com → {unique-id}.authkit.app
```

**Cloudflare Users (CRITICAL):**

If your DNS provider is Cloudflare:

```
Cloudflare proxy setting?
  |
  +-- Proxied (orange cloud ON) --> FAIL. WorkOS uses Cloudflare and prohibits proxy-to-proxy.
  |                                  Turn OFF proxy (gray cloud) before verification.
  |
  +-- DNS-only (gray cloud) --> Correct. Proceed with verification.
```

**Action:** Create the CNAME record with your DNS provider.

### (C) Verification

After creating DNS record:

1. Click verify button in WorkOS Dashboard
2. If Cloudflare, ensure proxy is OFF before clicking verify

**Verification command (optional):**

```bash
# Check if CNAME is live and points correctly
dig +short auth.example.com CNAME
```

Should return `{unique-id}.authkit.app`.

### (D) Post-Verification

Once verified:

- AuthKit UI will be accessible at `https://auth.example.com`
- Update `WORKOS_REDIRECT_URI` in your app to use new domain:
  ```
  Old: https://youthful-ginger-43.authkit.app/callback
  New: https://auth.example.com/callback
  ```
- **CRITICAL:** Do NOT delete the CNAME record — AuthKit will break if removed

## Step 6: Application Configuration Update

### Environment Variables

Update these in your application:

```bash
# If using custom AuthKit domain
WORKOS_REDIRECT_URI=https://auth.example.com/callback

# Email domain does NOT require env var changes - it's server-side only
```

### SDK Configuration

**No SDK code changes required.** Custom domains are configured server-side via WorkOS Dashboard. Your SDK calls remain the same:

```javascript
// Email sending (Magic Auth, password reset, etc.) - no code changes
const { user } = await workos.userManagement.authenticateWithMagicAuth({ ... });

// AuthKit - redirect URI updated via env var only
const authUrl = workos.userManagement.getAuthorizationUrl({ ... });
```

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm configuration:

```bash
# 1. Check DNS records are live (replace with your domains)
dig +short em1234._domainkey.example.com CNAME | grep -q workosmail && echo "PASS: Email DNS" || echo "FAIL: Email DNS missing"
dig +short auth.example.com CNAME | grep -q authkit.app && echo "PASS: AuthKit DNS" || echo "FAIL: AuthKit DNS missing"

# 2. Check WorkOS Dashboard shows verified status
# (Manual check - Dashboard → Domains section should show green checkmarks)

# 3. Test email domain (if configured)
# Trigger a magic auth or password reset - check email sender is no-reply@your-domain.com

# 4. Test AuthKit domain (if configured)
curl -I https://auth.example.com | grep -q "200 OK" && echo "PASS: AuthKit accessible" || echo "FAIL: AuthKit not accessible"

# 5. Verify app still builds
npm run build
```

## Error Recovery

### "Domain verification failed"

**Cause:** DNS records not propagated or misconfigured.

**Fix:**

1. Wait 10-60 minutes for DNS propagation (varies by provider)
2. Verify CNAME records with `dig` commands above
3. Check for typos in Host or Points To values
4. If using Cloudflare for AuthKit, ensure proxy is OFF (gray cloud)
5. WorkOS retries verification for 72 hours - no action needed if DNS is correct

### "Cloudflare proxy error" (AuthKit only)

**Cause:** CNAME record has orange cloud (proxied) enabled in Cloudflare.

**Fix:**

1. Log into Cloudflare dashboard
2. Find the AuthKit CNAME record (e.g., `auth.example.com`)
3. Click orange cloud icon to toggle to gray cloud (DNS-only)
4. Wait 5 minutes, then re-verify in WorkOS Dashboard

**Why:** WorkOS uses Cloudflare infrastructure. Cloudflare prohibits proxying across different accounts.

### "Emails still coming from workos.dev"

**Cause 1:** Environment is staging (custom domains production-only).

**Fix:** Switch to production environment or accept WorkOS default sender.

**Cause 2:** Email domain not verified yet.

**Fix:** Check Dashboard → Domains for verification status. Wait for verification to complete.

**Cause 3:** CNAME records deleted after initial verification.

**Fix:** Recreate the 3 CNAME records from Step 4B and re-verify.

### "AuthKit redirects to {random-phrase}.authkit.app instead of custom domain"

**Cause 1:** `WORKOS_REDIRECT_URI` not updated in application environment.

**Fix:** Update env var to use custom domain, redeploy app.

**Cause 2:** Custom domain CNAME deleted after initial verification.

**Fix:** Recreate CNAME record from Step 5B and re-verify.

### "SSL certificate error on AuthKit domain"

**Cause:** Certificate provisioning in progress (can take up to 24 hours).

**Fix:** Wait for SSL provisioning to complete. WorkOS provisions certificates automatically via Let's Encrypt.

**If persistent:** Contact WorkOS support - certificate provisioning may have failed.

### "DNS record not found" errors with dig

**Cause 1:** DNS propagation not complete.

**Fix:** Wait 10-60 minutes, retry.

**Cause 2:** CNAME created at wrong host level.

**Fix:** Some DNS providers require different syntax:

```
Wrong: auth.example.com. (trailing dot)
Right: auth.example.com

Wrong: @.auth.example.com
Right: auth.example.com
```

Consult your DNS provider's documentation for CNAME syntax.

## Related Skills

- workos-authkit-nextjs - Includes `WORKOS_REDIRECT_URI` configuration
- workos-authkit-react - Includes `WORKOS_REDIRECT_URI` configuration
- workos-authkit-vanilla-js - Includes `WORKOS_REDIRECT_URI` configuration
