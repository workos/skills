---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- generated -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch all these URLs — they are the source of truth:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Check

Verify production environment:

```bash
# Custom domains only available in production
echo $WORKOS_API_KEY | grep -q "^sk_prod_" || echo "FAIL: Must use production API key (sk_prod_*)"
```

**CRITICAL:** Custom domains are a paid feature and only work in production. Staging always uses WorkOS defaults (`workos.dev` for email, `*.authkit.app` for AuthKit).

### Account Status

Check WorkOS Dashboard:

1. Navigate to https://dashboard.workos.com/
2. Confirm production environment is selected (top navigation)
3. Check billing page for Custom Domains entitlement

**If not enabled:** Contact WorkOS sales or upgrade plan before proceeding.

## Step 3: Domain Selection (Decision Tree)

Determine which domain(s) to configure:

```
Which WorkOS services need custom domains?
  |
  +-- Email (Magic Auth, password resets, invites)
  |     --> Configure email domain (Step 4)
  |
  +-- AuthKit (hosted auth UI)
  |     --> Configure AuthKit domain (Step 5)
  |
  +-- Admin Portal (SSO configuration UI)
        --> Configure Admin Portal domain (Step 6)
```

You can configure one, two, or all three. Steps are independent.

## Step 4: Email Domain Configuration

### (A) Add Domain in Dashboard

1. Open https://dashboard.workos.com/ (production environment)
2. Navigate to **Domains** section
3. Click **Add Domain**
4. Enter your sending domain (e.g., `yourdomain.com`)
5. Click **Add**

**Result:** Dashboard displays 3 CNAME records to create.

### (B) Create DNS Records

Add these 3 CNAME records with your DNS provider:

| Record Name | Points To |
|-------------|-----------|
| `_dmarc.yourdomain.com` | (provided by dashboard) |
| `workos._domainkey.yourdomain.com` | (provided by dashboard) |
| `workos-mail.yourdomain.com` | (provided by dashboard) |

**Critical:** Copy values EXACTLY from dashboard — they are unique to your account.

### (C) Verify Domain

In WorkOS Dashboard:

1. Click **Verify Now**
2. Wait for verification (instant to 72 hours depending on DNS propagation)
3. Confirm status shows **Verified**

**Verification command:**

```bash
# Check DNS propagation (replace with your actual record)
dig +short _dmarc.yourdomain.com CNAME
# Should return WorkOS-provided target
```

**After verification:** Emails send from `no-reply@yourdomain.com`. Do NOT delete the CNAME records.

### (D) Update Application Configuration (if needed)

**No code changes required.** WorkOS automatically uses verified domain for:

- Magic Auth emails
- Email verification links
- Password reset emails
- Admin Portal invitations

**Optional:** If you reference the sending domain in UI text, update to match your domain.

## Step 5: AuthKit Domain Configuration

### (A) Add Domain in Dashboard

1. Open https://dashboard.workos.com/ (production environment)
2. Navigate to **Domains** section
3. Click **Configure AuthKit domain**
4. Enter your AuthKit subdomain (e.g., `auth.yourdomain.com`)
5. Click **Configure**

**Result:** Dashboard displays 1 CNAME record to create.

### (B) Create DNS Record

Add this CNAME record with your DNS provider:

| Record Name | Points To |
|-------------|-----------|
| `auth.yourdomain.com` | (provided by dashboard) |

**Cloudflare users:** Set CNAME to **DNS-only** mode, NOT proxied. WorkOS uses Cloudflare and proxy conflicts cause verification failure.

### (C) Verify Domain

In WorkOS Dashboard:

1. DNS propagation completes automatically
2. Confirm status shows **Verified**
3. Note the new AuthKit URL displayed

**Verification command:**

```bash
# Check DNS propagation
dig +short auth.yourdomain.com CNAME
# Should return WorkOS Cloudflare target

# Test AuthKit endpoint
curl -I https://auth.yourdomain.com/.well-known/jwks.json
# Should return 200 OK
```

### (D) Update Application Configuration (REQUIRED)

**CRITICAL:** Update environment variables in your application:

```bash
# Before (default WorkOS domain)
WORKOS_REDIRECT_URI=https://random-phrase-42.authkit.app/callback

# After (your custom domain)
WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback
```

**For Next.js AuthKit integration:**

Update `.env.local`:

```bash
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback
```

**Verification:**

```bash
# Check environment variable is updated
grep "auth.yourdomain.com" .env.local || echo "FAIL: WORKOS_REDIRECT_URI not updated"
```

**Redeploy application** after environment variable changes.

## Step 6: Admin Portal Domain Configuration

### (A) Add Domain in Dashboard

1. Open https://dashboard.workos.com/ (production environment)
2. Navigate to **Domains** section
3. Click **Configure Admin Portal domain**
4. Enter your Admin Portal subdomain (e.g., `admin.yourdomain.com`)
5. Click **Configure**

**Result:** Dashboard displays 1 CNAME record to create.

### (B) Create DNS Record

Add this CNAME record with your DNS provider:

| Record Name | Points To |
|-------------|-----------|
| `admin.yourdomain.com` | (provided by dashboard) |

**Cloudflare users:** Set CNAME to **DNS-only** mode, NOT proxied.

### (C) Verify Domain

In WorkOS Dashboard:

1. DNS propagation completes automatically
2. Confirm status shows **Verified**

**Verification command:**

```bash
# Check DNS propagation
dig +short admin.yourdomain.com CNAME
# Should return WorkOS Cloudflare target

# Test Admin Portal endpoint
curl -I https://admin.yourdomain.com
# Should return 200 OK or 302 redirect
```

### (D) Update Application Configuration (if applicable)

**No code changes required** if using WorkOS SDK's `getPortalLink()` function — it automatically uses the configured domain.

**If hardcoding portal URLs:** Update references from `https://id.workos.com/*` to `https://admin.yourdomain.com/*`.

## Verification Checklist (ALL MUST PASS)

Run these commands after configuration:

```bash
# 1. Email domain DNS (replace with your domain)
dig +short _dmarc.yourdomain.com CNAME | grep -q "workos" && echo "PASS: Email DNS configured" || echo "FAIL: Email DNS not found"

# 2. AuthKit domain DNS (replace with your domain)
dig +short auth.yourdomain.com CNAME | grep -q "cloudflare" && echo "PASS: AuthKit DNS configured" || echo "FAIL: AuthKit DNS not found"

# 3. AuthKit endpoint responds
curl -s -o /dev/null -w "%{http_code}" https://auth.yourdomain.com/.well-known/jwks.json | grep -q "200" && echo "PASS: AuthKit responding" || echo "FAIL: AuthKit not accessible"

# 4. Environment variables updated (for AuthKit)
grep -q "auth.yourdomain.com" .env* && echo "PASS: Environment updated" || echo "FAIL: Environment not updated"

# 5. Dashboard shows verified status
# (Manual check - open https://dashboard.workos.com/ and verify green checkmarks)
```

## Error Recovery

### "Domain verification failed"

**Symptom:** Dashboard shows "Verification pending" after 72 hours.

**Root causes:**

1. **CNAME records not created** — Check with DNS provider
2. **Typo in CNAME target** — Copy-paste from dashboard, don't type manually
3. **DNS propagation delay** — Check with `dig +trace yourdomain.com` to see authoritative servers

**Fix:**

```bash
# Debug DNS propagation
dig @8.8.8.8 +short _dmarc.yourdomain.com CNAME  # Google DNS
dig @1.1.1.1 +short _dmarc.yourdomain.com CNAME  # Cloudflare DNS

# Compare with authoritative nameserver
dig +short yourdomain.com NS  # Get your nameserver
dig @your.nameserver.com +short _dmarc.yourdomain.com CNAME
```

If records exist but verification fails, contact WorkOS support.

### "Cloudflare proxy conflict" (AuthKit/Admin Portal)

**Symptom:** Verification fails with Cloudflare error message.

**Root cause:** CNAME record has orange cloud (proxied) instead of grey cloud (DNS-only).

**Fix:**

1. Log into Cloudflare dashboard
2. Find the CNAME record for `auth.yourdomain.com` or `admin.yourdomain.com`
3. Click orange cloud icon to toggle to grey (DNS-only)
4. Wait 5 minutes, click "Verify Now" in WorkOS Dashboard

### "AuthKit redirects to old domain"

**Symptom:** Application redirects to `*.authkit.app` instead of custom domain.

**Root cause:** Environment variable not updated or application not redeployed.

**Fix:**

```bash
# 1. Verify environment variable
echo $WORKOS_REDIRECT_URI
# Should show custom domain, not authkit.app

# 2. Check if .env.local was updated
grep REDIRECT_URI .env.local

# 3. Restart development server or redeploy
npm run dev  # or deploy to production
```

### "Emails still send from workos.dev"

**Symptom:** Magic Auth emails show `@workos.dev` sender after configuring custom domain.

**Root cause:** Using staging environment or verification incomplete.

**Fix:**

```bash
# 1. Confirm production API key
echo $WORKOS_API_KEY | grep "^sk_prod_" || echo "ERROR: Using staging key"

# 2. Check Dashboard verification status
# Open https://dashboard.workos.com/ → Domains
# Must show green "Verified" status, not "Pending"

# 3. If verified, wait up to 5 minutes for cache refresh
```

### "Custom domain is a paid feature"

**Symptom:** Dashboard shows upgrade prompt when adding domain.

**Root cause:** Account plan does not include custom domains.

**Fix:**

1. Navigate to https://dashboard.workos.com/billing
2. Upgrade to plan that includes custom domains (see https://workos.com/pricing)
3. Or contact WorkOS sales for enterprise pricing

This is not a configuration issue — custom domains require payment.

## Related Skills

- `workos-authkit-nextjs` — Next.js integration that uses AuthKit custom domain
- `workos-magic-auth` — Magic link authentication that uses email custom domain
- `workos-admin-portal` — Admin Portal integration that uses portal custom domain
