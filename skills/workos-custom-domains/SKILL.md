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

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

```bash
# Verify WorkOS environment
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS: API key format" || echo "FAIL: Invalid API key"

# Check if production environment (custom domains only available in production)
# Staging always uses WorkOS domains (workos.dev for email, *.authkit.app for AuthKit)
```

**Critical:** Custom domains are ONLY available in production environments. Staging will always use WorkOS-provided domains regardless of configuration.

### Pricing Confirmation

Custom domains are a **paid service**. Verify your WorkOS plan includes custom domains at https://workos.com/pricing before proceeding.

## Step 3: Domain Type Selection (Decision Tree)

```
What are you customizing?
  |
  +-- Email domain (no-reply@your-domain.com)
  |     |
  |     +-- Used by: Magic Auth, Email Verification, Password Resets, Invitations
  |     +-- Default: workos.dev (staging), no-reply@workos.com (production)
  |     +-- DNS: 3 CNAME records required
  |     +-- Go to Step 4
  |
  +-- AuthKit domain (auth.your-domain.com)
  |     |
  |     +-- Used by: AuthKit UI hosted pages
  |     +-- Default: random-phrase.authkit.app
  |     +-- DNS: 1 CNAME record required
  |     +-- Special: If using Cloudflare, MUST be DNS-only (not proxied)
  |     +-- Go to Step 5
  |
  +-- Admin Portal domain
        |
        +-- Check admin-portal doc URL for configuration
        +-- Go to Step 6
```

## Step 4: Configure Email Domain

### (1) Access Dashboard

Navigate to WorkOS Dashboard with **production** environment selected:

```
Dashboard → Domains section
URL: https://dashboard.workos.com/domains
```

### (2) Add Email Domain

Click "Add Domain" button, enter domain (e.g., `yourdomain.com`).

**Format:** Domain only, no subdomain. WorkOS will send from `no-reply@yourdomain.com`.

### (3) Create DNS Records

Dashboard will display 3 CNAME records. Add ALL THREE to your DNS provider:

```
Record 1: [value shown in dashboard]
Record 2: [value shown in dashboard]  
Record 3: [value shown in dashboard]
```

**Critical:** All 3 records MUST remain in place permanently for email delivery.

### (4) Verify Domain

Click "Verify now" button in dashboard.

**Timing:** DNS propagation can take minutes to hours. WorkOS will retry verification for 72 hours if initial attempt fails.

### Verification Command

```bash
# Check if email domain is active
dig +short no-reply.yourdomain.com CNAME
# Should return WorkOS CNAME targets
```

After successful verification, AuthKit emails will send from `no-reply@yourdomain.com`.

## Step 5: Configure AuthKit Domain

### (1) Access Dashboard

Navigate to WorkOS Dashboard with **production** environment selected:

```
Dashboard → Domains section
URL: https://dashboard.workos.com/domains
```

### (2) Add AuthKit Domain

Click "Configure AuthKit domain" button, enter subdomain (e.g., `auth.yourdomain.com`).

**Format:** Must be a subdomain. Cannot use apex domain for AuthKit.

### (3) Create DNS Record

Dashboard will display 1 CNAME record. Add to your DNS provider:

```
Type: CNAME
Name: auth (or your chosen subdomain)
Value: [target shown in dashboard]
```

**Cloudflare Users (CRITICAL):**

If your DNS provider is Cloudflare, the CNAME record MUST be configured as **DNS-only** (gray cloud icon), NOT proxied (orange cloud).

```
Cloudflare DNS Settings:
  Proxy status: DNS only (gray cloud)
  Reason: WorkOS uses Cloudflare; proxying across Cloudflare accounts is prohibited
```

### Verification Command

```bash
# Check if AuthKit domain is configured
dig +short auth.yourdomain.com CNAME
# Should return WorkOS Cloudflare target

# If using Cloudflare, verify it's not proxied
dig +short auth.yourdomain.com A
# Should return Cloudflare IP (not your origin server)
```

## Step 6: Configure Admin Portal Domain (Optional)

WebFetch: https://workos.com/docs/custom-domains/admin-portal

Follow configuration steps from Admin Portal docs. Pattern should match email/AuthKit domain setup:

1. Add domain in Dashboard
2. Create required DNS records
3. Verify domain

## Step 7: Update Application Configuration

After domain verification, update your application environment:

```bash
# If using AuthKit with custom domain, update redirect URIs
WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback

# No code changes required - WorkOS SDK automatically uses custom domains once configured
```

**Important:** No SDK code changes required. Custom domains are activated at the WorkOS platform level.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment is production
echo "Environment: $(workos-cli env current)" | grep -q production || echo "FAIL: Not in production"

# 2. Verify email domain DNS records (all 3 must resolve)
dig +short [record-1-from-dashboard] CNAME
dig +short [record-2-from-dashboard] CNAME
dig +short [record-3-from-dashboard] CNAME

# 3. Verify AuthKit domain DNS record
dig +short auth.yourdomain.com CNAME

# 4. Check domain status in dashboard
# Navigate to: https://dashboard.workos.com/domains
# Status should show "Verified" for all configured domains

# 5. Test email sending (if email domain configured)
# Trigger password reset or magic link from your app
# Check email headers show "from: no-reply@yourdomain.com"

# 6. Test AuthKit domain (if AuthKit domain configured)
# Visit AuthKit login page
# URL should be https://auth.yourdomain.com/...
```

## Error Recovery

### "Domain verification failed after 72 hours"

**Root cause:** DNS records not created correctly or not propagated.

**Fix:**
1. Verify all CNAME records match dashboard exactly (copy-paste to avoid typos)
2. Check DNS propagation globally: `dig @8.8.8.8 +short [domain] CNAME`
3. Some DNS providers add domain suffix automatically — ensure no duplicate suffixes
4. Contact DNS provider if records show correct locally but don't propagate

### "Cloudflare proxying error" (AuthKit domain)

**Root cause:** CNAME record is proxied (orange cloud) instead of DNS-only (gray cloud).

**Fix:**
1. Log into Cloudflare DNS dashboard
2. Find the AuthKit CNAME record
3. Click the orange cloud icon to toggle to gray (DNS-only)
4. Wait 5 minutes, click "Verify now" in WorkOS dashboard

**Why:** WorkOS uses Cloudflare for custom domains. Cloudflare prohibits proxying across accounts.

### "Emails still sending from workos.com"

**Root cause:** Domain not verified OR environment is staging.

**Fix:**
1. Check WorkOS dashboard shows domain status as "Verified"
2. Confirm you're in production environment (staging always uses workos.dev)
3. Verify all 3 email CNAME records exist: `dig +short [each-record] CNAME`
4. If recently verified, wait up to 10 minutes for propagation

### "AuthKit still using *.authkit.app domain"

**Root cause:** Domain not verified OR redirect URIs not updated.

**Fix:**
1. Check WorkOS dashboard shows AuthKit domain status as "Verified"
2. Update `WORKOS_REDIRECT_URI` in application env to use custom domain
3. Update OAuth redirect URIs in WorkOS dashboard if using Auth API directly
4. Clear browser cache / test in incognito mode

### "Custom domains option not available in dashboard"

**Root cause:** Account is on free plan or not in production environment.

**Fix:**
1. Verify pricing plan at https://workos.com/pricing includes custom domains
2. Upgrade plan if necessary
3. Ensure production environment is selected in dashboard dropdown

## Related Skills

- **workos-authkit-nextjs** — AuthKit integration (requires custom domain for branded auth flows)
- **workos-magic-auth** — Magic link authentication (uses email custom domain)
