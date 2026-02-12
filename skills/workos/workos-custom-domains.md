---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Environment Detection (Decision Tree)

Custom domains are **production-only**. Check environment first:

```
WorkOS environment?
  |
  +-- Staging --> STOP: Custom domains not available
  |               Use default workos.dev / authkit.app domains
  |
  +-- Production --> Continue to Step 3
```

**How to check:**

- Look at `WORKOS_API_KEY` — staging keys start with `sk_test_`, production with `sk_live_`
- Check WorkOS Dashboard environment selector (top-right)

## Step 3: Domain Type Selection (Decision Tree)

```
What needs custom domain?
  |
  +-- Email sending (Magic Auth, password resets, invites)
  |   --> Go to Step 4: Email Domain Setup
  |
  +-- AuthKit UI (hosted login/signup pages)
  |   --> Go to Step 5: AuthKit Domain Setup
  |
  +-- Admin Portal
  |   --> Check fetched docs for Admin Portal config
  |
  +-- Multiple
      --> Configure each separately (can use same base domain)
```

## Step 4: Email Domain Setup

### Prerequisites Check

Confirm these exist before starting:

- Access to DNS provider for target domain (must be able to create CNAME records)
- Production WorkOS environment access

### (1) Navigate to Dashboard

1. Log into [dashboard.workos.com](https://dashboard.workos.com/)
2. **Verify production environment is selected** (top-right dropdown)
3. Navigate to **Domains** section (left sidebar)

### (2) Add Email Domain

1. Click **Add Domain** button
2. Enter domain for email (e.g., `yourbrand.com`)
3. **Do NOT include subdomain** — WorkOS will send from `no-reply@yourdomain.com`

### (3) DNS Configuration (BLOCKING)

**You will be shown 3 CNAME records.** Write them down:

```
Record 1: [name] --> [value]
Record 2: [name] --> [value]
Record 3: [name] --> [value]
```

Create these CNAME records with your DNS provider **exactly as shown**.

### (4) Verification

1. Click **Verify now** in dashboard
2. **If verification fails immediately:** DNS propagation not complete
   - WorkOS will auto-retry for 72 hours
   - Check DNS propagation: `dig [record-name] CNAME` or use [dnschecker.org](https://dnschecker.org)

**Success indicator:** Dashboard shows domain status as "Verified"

### Post-Setup Validation

Test email sending:

1. Trigger a Magic Auth flow or password reset in your app
2. Check email headers — sender should be `no-reply@yourdomain.com`
3. **If still seeing workos.dev:** Clear cache, wait 5 minutes for propagation

**CRITICAL:** Do NOT delete the CNAME records after verification — they must remain for WorkOS to deliver mail.

## Step 5: AuthKit Domain Setup

### Prerequisites Check

Confirm these exist:

- Access to DNS provider for target domain
- Production WorkOS environment access
- **Cloudflare users:** Ensure you can set DNS-only (non-proxied) records

### (1) Navigate to Dashboard

1. Log into [dashboard.workos.com](https://dashboard.workos.com/)
2. **Verify production environment is selected**
3. Navigate to **Domains** section

### (2) Add AuthKit Domain

1. Click **Configure AuthKit domain** button
2. Enter subdomain for AuthKit UI (e.g., `auth.yourbrand.com`)
3. **Must be a subdomain** — bare domains not supported

### (3) DNS Configuration (BLOCKING)

**You will be shown 1 CNAME record:**

```
[subdomain] CNAME [target].cdn.cloudflare.net
```

**Cloudflare users (CRITICAL):**

- Set record as **DNS-only** (gray cloud icon)
- **Do NOT proxy** (orange cloud) — this will fail verification
- WorkOS uses Cloudflare; cross-account proxying is prohibited

**Other DNS providers:**

- Create CNAME record as shown

### (4) Verification

1. Click **Verify now** in dashboard
2. Check DNS propagation: `dig auth.yourdomain.com CNAME`
3. **If verification fails:**
   - Cloudflare: Confirm DNS-only mode (no proxy)
   - All providers: Wait for propagation (up to 72 hours auto-retry)

### Post-Setup Validation

Test AuthKit domain:

```bash
# Check DNS resolution
dig auth.yourdomain.com CNAME

# Check HTTPS works (should return 200 or redirect)
curl -I https://auth.yourdomain.com
```

**Update redirect URIs:**

After verification, update your OAuth config:

```
Old: https://youthful-ginger-43.authkit.app/callback
New: https://auth.yourdomain.com/callback
```

**Where to update:**

- WorkOS Dashboard → Redirects section
- Your app's `WORKOS_REDIRECT_URI` environment variable
- Any hardcoded callback URLs in code

## Step 6: Code Changes (if needed)

Custom domains typically require **no code changes** — WorkOS SDK handles domain resolution automatically.

**Verify SDK behavior:**

```bash
# Check SDK fetches domain config at runtime
# No hardcoded authkit.app URLs should exist in your code
grep -r "authkit\.app" src/
```

**If matches found:** These may be old comments or docs — verify they're not used at runtime.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm setup:

```bash
# 1. Check environment is production
echo $WORKOS_API_KEY | grep "sk_live_" || echo "FAIL: Not production key"

# 2. DNS verification (email domain)
dig no-reply.yourdomain.com CNAME | grep -q "workos" && echo "PASS" || echo "FAIL"

# 3. DNS verification (AuthKit domain)
dig auth.yourdomain.com CNAME | grep -q "cloudflare" && echo "PASS" || echo "FAIL"

# 4. HTTPS works (AuthKit domain)
curl -I https://auth.yourdomain.com 2>/dev/null | head -1 | grep -q "200\|301\|302" && echo "PASS" || echo "FAIL"

# 5. No hardcoded authkit.app in code
! grep -r "authkit\.app" src/ && echo "PASS" || echo "Check: may be false positive"
```

## Error Recovery

### "Domain verification failed"

**Root cause:** DNS records not propagated or incorrect

**Fix:**

1. Verify CNAME records match dashboard exactly: `dig [record-name] CNAME`
2. Check for typos — trailing dots matter: `example.com.` vs `example.com`
3. Wait 24-48 hours for full propagation
4. WorkOS auto-retries for 72 hours — do not re-add domain

### "Cloudflare proxy error" / "CNAME conflict"

**Root cause:** CNAME record is proxied (orange cloud in Cloudflare)

**Fix:**

1. Go to Cloudflare DNS settings
2. Find the CNAME record for AuthKit domain
3. Click orange cloud to disable proxy (should turn gray)
4. Wait 5 minutes, retry verification in WorkOS Dashboard

### "Email still shows workos.dev sender"

**Root cause:** Email domain not verified OR cache/propagation delay

**Fix:**

1. Check WorkOS Dashboard — domain status must be "Verified"
2. If verified, wait 5-10 minutes for cache clear
3. Test with fresh email (not cached client)
4. Verify CNAME records still exist: `dig [record-name] CNAME`

### "AuthKit callback fails after domain change"

**Root cause:** Redirect URI not updated in dashboard

**Fix:**

1. WorkOS Dashboard → Redirects section
2. Add new redirect URI: `https://auth.yourdomain.com/callback`
3. Update `WORKOS_REDIRECT_URI` in your app's `.env`
4. Restart app to pick up new env var
5. **Keep old URI for 24h** during migration, then remove

### "DNS propagation taking too long"

**Workaround:** Use `8.8.8.8` (Google DNS) or `1.1.1.1` (Cloudflare DNS) to check propagation faster:

```bash
dig @8.8.8.8 auth.yourdomain.com CNAME
dig @1.1.1.1 auth.yourdomain.com CNAME
```

If it resolves on public DNS but not locally, clear local DNS cache:

- macOS: `sudo dscacheutil -flushcache`
- Linux: `sudo systemd-resolve --flush-caches`
- Windows: `ipconfig /flushdns`

## Related Skills

For integrating AuthKit with custom domains:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
