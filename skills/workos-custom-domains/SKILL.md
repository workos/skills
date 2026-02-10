---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

These docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Environment Validation (Decision Tree)

```
What environment?
  |
  +-- Staging --> Custom domains NOT available
  |               (uses workos.dev for email, authkit.app for AuthKit)
  |               SKIP to Step 8 (verification only)
  |
  +-- Production --> Custom domains available (paid feature)
                     CONTINUE to Step 3
```

**Critical:** Custom domains are a production-only, paid feature. Check your WorkOS plan on [pricing page](https://workos.com/pricing) before proceeding.

## Step 3: Determine Domain Scope (Decision Tree)

```
Which WorkOS services need custom domains?
  |
  +-- Email (Magic Auth, verification, password reset, invites)
  |     --> Configure Email Domain (Step 4)
  |
  +-- AuthKit (hosted auth UI)
  |     --> Configure AuthKit Domain (Step 5)
  |
  +-- Admin Portal (self-service SSO/Directory Sync UI)
  |     --> Configure Admin Portal Domain (Step 6)
  |
  +-- Multiple services
        --> Configure each domain type separately
```

Each service type requires separate DNS configuration. **You cannot use the same domain for multiple services** — they use different CNAME patterns.

## Step 4: Email Domain Configuration

### (4A) Add Email Domain in Dashboard

1. Log in to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Select **Production** environment (top-right environment switcher)
3. Navigate to **Domains** section (left sidebar)
4. Click **Add Domain** button
5. Enter your domain (e.g., `example.com`)
6. Click **Add**

**Checkpoint:** Dashboard displays 3 CNAME records to create.

### (4B) Create DNS Records

You will see 3 CNAME records like:

```
Name: em1234._domainkey.example.com
Value: em1234.dkim.workosmail.com

Name: workos._domainkey.example.com  
Value: workos.dkim.workosmail.com

Name: bounce.example.com
Value: bounce.workosmail.com
```

**Action:** Create these exact records in your DNS provider (Route53, Cloudflare, Namecheap, etc.).

**Critical DNS Rules:**
- Use **CNAME** record type, not A or TXT
- Copy values exactly — trailing periods matter on some providers
- Do NOT add `http://` or `https://` prefixes
- Records must be public (not internal DNS)

### (4C) Verify Domain

1. After creating DNS records, click **Verify now** in dashboard
2. If verification fails: WorkOS retries automatically for 72 hours
3. DNS propagation can take 5 minutes to 48 hours (varies by provider)

**Success indicator:** Domain status shows "Verified" in dashboard.

**Post-verification behavior:** 
- Emails send from `no-reply@yourdomain.com`
- Magic Auth links use your domain
- Password reset emails use your domain

**Critical:** Keep CNAME records in place permanently. Deleting them breaks email delivery.

## Step 5: AuthKit Domain Configuration

### (5A) Add AuthKit Domain in Dashboard

1. In WorkOS Dashboard, navigate to **Domains** section
2. Click **Configure AuthKit domain** button
3. Enter subdomain (e.g., `auth.example.com`)
4. Click **Add**

**Checkpoint:** Dashboard displays 1 CNAME record to create.

### (5B) Create DNS Record

You will see a CNAME like:

```
Name: auth.example.com
Value: <random-phrase>.authkit.app
```

**Action:** Create this CNAME in your DNS provider.

**Cloudflare Users (CRITICAL):**
- Set CNAME to **DNS-only** mode (gray cloud icon)
- Do NOT enable proxy (orange cloud icon)
- WorkOS uses Cloudflare — proxied CNAMEs across accounts fail

**Other DNS Providers:**
- Create standard CNAME record
- No special configuration needed

### (5C) Verify Domain

Click **Verify now** in dashboard. DNS propagation applies (see 4C).

**Success indicator:** AuthKit hosted UI now loads at `https://auth.example.com`

**Post-verification behavior:**
- Sign-in/sign-up UI appears on your domain
- OAuth callbacks reference your domain
- Session cookies use your domain

## Step 6: Admin Portal Domain Configuration

**BLOCKING:** WebFetch https://workos.com/docs/custom-domains/admin-portal for exact steps.

Configuration process mirrors Step 5 (AuthKit), but:
- Uses different CNAME target
- Applies to Admin Portal UI only (not AuthKit)
- Requires separate domain or subdomain (e.g., `admin.example.com`)

**Do NOT reuse the AuthKit domain** — each service needs its own.

## Step 7: Application Integration (Decision Tree)

```
SDK changes needed?
  |
  +-- Email domain --> NO code changes required
  |                    (WorkOS handles email routing automatically)
  |
  +-- AuthKit domain --> UPDATE auth flow URLs
  |                      (redirect URIs, sign-in URLs, etc.)
  |
  +-- Admin Portal domain --> UPDATE Admin Portal links
                              (if embedding portal in app)
```

### For AuthKit Custom Domain

**Required environment variable changes:**

```bash
# OLD (default authkit.app domain)
WORKOS_REDIRECT_URI=https://youthful-ginger-43.authkit.app/callback

# NEW (your custom domain)
WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback
```

**Update locations:**
- `.env.local` or production env vars
- WorkOS Dashboard → AuthKit → Redirect URIs configuration
- Any hardcoded auth URLs in app code

**Verification command:**

```bash
# Check redirect URI uses custom domain
grep -r "authkit.app" .env* && echo "FAIL: Still using default domain"
```

### For Admin Portal Custom Domain

If you generate Admin Portal links programmatically, update the base URL:

```javascript
// OLD
const portalLink = workos.portal.generateLink({...});

// NEW - check docs for exact API
const portalLink = workos.portal.generateLink({
  customDomain: 'admin.yourdomain.com',
  ...
});
```

**Check fetched docs for exact SDK method** — API may vary by SDK version.

## Step 8: Verification Checklist (ALL MUST PASS)

Run these checks in order. **Do not mark complete until all pass:**

### DNS Verification

```bash
# Check email domain CNAME (replace example.com)
dig +short em1234._domainkey.example.com CNAME
# Expected: em1234.dkim.workosmail.com

# Check AuthKit domain CNAME
dig +short auth.example.com CNAME
# Expected: <phrase>.authkit.app

# Check DNS propagation (if using Cloudflare)
dig @1.1.1.1 +short auth.example.com CNAME
```

### Dashboard Verification

1. Open WorkOS Dashboard → Domains
2. All configured domains show "Verified" status
3. No pending verification warnings

### Email Domain Test

**If using Magic Auth or email verification:**

```bash
# Trigger test email via your app
# Then check email headers for:
From: no-reply@yourdomain.com
```

**Manual test:**
1. Trigger password reset or magic link
2. Check email "From" address matches your domain
3. Click link → should work without CORS errors

### AuthKit Domain Test

```bash
# Test custom domain loads AuthKit UI
curl -I https://auth.yourdomain.com
# Expected: HTTP 200, HTML content

# Check SSL certificate
openssl s_client -connect auth.yourdomain.com:443 -servername auth.yourdomain.com | grep "Verify return code"
# Expected: "Verify return code: 0 (ok)"
```

**Browser test:**
1. Navigate to `https://auth.yourdomain.com`
2. Should see WorkOS AuthKit UI, not DNS error
3. Check browser address bar for valid SSL (padlock icon)

### Application Integration Test

```bash
# Build succeeds with new env vars
npm run build || yarn build

# Auth flow works end-to-end
# 1. Click sign-in link
# 2. Redirects to auth.yourdomain.com
# 3. Complete auth
# 4. Callback returns to app successfully
```

## Error Recovery

### "Domain verification failed after 72 hours"

**Root causes:**
1. CNAME record typo in DNS provider
2. DNS provider hasn't propagated changes
3. CNAME record deleted before verification

**Fix:**
```bash
# Check actual DNS record
dig +short <your-cname-name> CNAME

# Compare to expected value in dashboard
# If mismatch: update DNS record, click "Verify now" again
```

**If using Cloudflare:** Ensure CNAME is DNS-only (see Step 5B).

### "AuthKit domain shows SSL error in browser"

**Root cause:** DNS record not pointing to correct WorkOS target, or SSL provisioning incomplete.

**Fix:**
1. Verify CNAME points to exact value from dashboard (check for trailing periods)
2. Wait 15 minutes for SSL provisioning (WorkOS auto-provisions via Let's Encrypt)
3. If error persists after 1 hour, contact WorkOS support

### "Emails still sending from workos.dev in production"

**Root causes:**
1. Environment switcher in dashboard set to Staging
2. Email domain not verified yet
3. DNS records deleted after initial verification

**Fix:**
```bash
# Check dashboard environment (top-right)
# Must be "Production"

# Check domain status in dashboard
# Must show "Verified", not "Pending"

# Re-verify DNS records exist
dig +short em1234._domainkey.yourdomain.com CNAME
```

### "Cloudflare CNAME verification fails"

**Root cause:** CNAME proxied (orange cloud) instead of DNS-only (gray cloud).

**Fix:**
1. Log in to Cloudflare DNS settings
2. Find your AuthKit/Admin Portal CNAME
3. Click orange cloud icon → turns gray (DNS-only)
4. Wait 5 minutes, retry verification

**Why this matters:** WorkOS and your Cloudflare account cannot both proxy the same domain.

### "Callback fails with 'redirect_uri_mismatch' error"

**Root cause:** `WORKOS_REDIRECT_URI` still uses old `authkit.app` domain.

**Fix:**
```bash
# Update env vars to use custom domain
WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback

# Update in WorkOS Dashboard too:
# Dashboard → AuthKit → Redirect URIs → Add new URI → Save

# Restart dev server to load new env vars
```

### "Admin Portal links return 404"

**Root cause:** Admin Portal custom domain configured, but SDK still generates default domain links.

**Fix:** Check Step 7 application integration. Update Admin Portal link generation to use `customDomain` parameter (exact API in fetched docs).

## Related Skills

- **workos-authkit-nextjs** — Integrate AuthKit with custom domain in Next.js apps
- **workos-authkit-react** — React-specific AuthKit integration with custom domains
- **workos-email** — Email configuration and Magic Auth setup
- **workos-admin-portal** — Self-service SSO/Directory Sync portal configuration
- **workos-domain-verification** — Domain ownership verification for SSO connections
