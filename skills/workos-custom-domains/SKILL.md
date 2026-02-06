---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- generated -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Account Requirements

- Confirm WorkOS account is in **production environment** (staging does not support custom domains)
- Confirm account is on a paid plan (check pricing page - custom domains are a paid feature)
- Access to DNS provider for domain configuration

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### DNS Provider Access

- Confirm ability to create CNAME records
- If using Cloudflare: Confirm ability to disable proxy (DNS-only mode required)

## Step 3: Domain Type Selection (Decision Tree)

```
What domain type?
  |
  +-- Email Domain
  |     |
  |     +-- Used for: Magic Auth emails, password resets, email verification, invitations
  |     +-- Result: Emails sent from no-reply@your-domain.com
  |     +-- DNS Records: 3 CNAME records required
  |
  +-- AuthKit Domain
  |     |
  |     +-- Used for: AuthKit UI hosting
  |     +-- Result: Replace youthful-ginger-43.authkit.app with auth.your-domain.com
  |     +-- DNS Records: 1 CNAME record required
  |     +-- Cloudflare users: MUST disable proxy (DNS-only)
  |
  +-- Admin Portal Domain
        |
        +-- Used for: Admin Portal hosting
        +-- DNS Records: See docs for requirements
```

## Step 4: Configure Email Domain (If Selected)

### Navigate to Dashboard

1. Open WorkOS Dashboard at https://dashboard.workos.com/
2. **CRITICAL:** Switch to **Production** environment (top-right selector)
3. Navigate to _Domains_ section in sidebar

### Add Domain

1. Click _Add Domain_ button
2. Enter domain: `your-domain.com` (not `mail.your-domain.com` - WorkOS will use `no-reply@` prefix)
3. Dashboard will generate 3 CNAME records

### Create DNS Records

**Copy exact values from dashboard.** Example format (values will differ):

```
Record 1: em1234._domainkey.your-domain.com → em1234.dkim.workos.dev
Record 2: s1._domainkey.your-domain.com → s1.domainkey.workos.dev
Record 3: s2._domainkey.your-domain.com → s2.domainkey.workos.dev
```

**Add these CNAME records to your DNS provider.**

### Verify Domain

1. Click _Verify now_ in dashboard
2. **Expected:** Verification may take time (DNS propagation)
3. WorkOS will auto-retry verification for 72 hours

**Do not delete CNAME records after verification** - WorkOS needs them permanently for mail delivery.

## Step 5: Configure AuthKit Domain (If Selected)

### Navigate to Dashboard

1. Open WorkOS Dashboard at https://dashboard.workos.com/
2. **CRITICAL:** Switch to **Production** environment
3. Navigate to _Domains_ section

### Add AuthKit Domain

1. Click _Configure AuthKit domain_ button
2. Enter subdomain: `auth.your-domain.com` (or preferred subdomain)
3. Dashboard will generate 1 CNAME record

### Create DNS Record

**Cloudflare users - CRITICAL:**
- Set CNAME to **DNS-only** mode (disable proxy/orange cloud)
- Proxied CNAMEs will fail verification (Cloudflare policy)

**Copy exact value from dashboard.** Example format:

```
auth.your-domain.com → <unique-id>.authkit.workos.dev
```

Add this CNAME record to your DNS provider.

### Verify Domain

1. Wait for DNS propagation (check with `dig` or `nslookup`)
2. Dashboard will show verification status
3. Once verified, AuthKit will be accessible at `auth.your-domain.com`

## Step 6: Update Application Configuration

### Update Redirect URIs

If using AuthKit domain, update OAuth callback URLs:

```bash
# Old callback (staging or default)
WORKOS_REDIRECT_URI=https://youthful-ginger-43.authkit.app/callback

# New callback (custom domain)
WORKOS_REDIRECT_URI=https://auth.your-domain.com/callback
```

Update in:
1. `.env` or `.env.local`
2. WorkOS Dashboard → Redirects section
3. Any hardcoded URLs in application

### Update Email From Address (If Email Domain Configured)

After email domain verification, emails automatically send from `no-reply@your-domain.com`.

**No code changes required** - WorkOS handles this automatically.

## Verification Checklist (ALL MUST PASS)

Run these commands and checks:

```bash
# 1. Verify DNS records are created (replace with your domain)
dig CNAME em1234._domainkey.your-domain.com +short
dig CNAME auth.your-domain.com +short

# 2. Check dashboard verification status
# Navigate to Dashboard → Domains → Check status is "Verified"

# 3. Test AuthKit domain (if configured)
curl -I https://auth.your-domain.com
# Expected: 200 or redirect, not DNS error

# 4. Test email sending (if configured)
# Trigger a Magic Auth or password reset
# Expected: Email from no-reply@your-domain.com
```

**Dashboard verification:**
- [ ] Domain shows "Verified" status in dashboard
- [ ] No error messages or warnings
- [ ] CNAME records remain in DNS (do not delete)

**For Cloudflare users:**
- [ ] CNAME record is DNS-only (proxy disabled)
- [ ] Orange cloud icon is NOT present on CNAME

## Error Recovery

### "Domain verification failed"

**Root cause:** DNS records not propagated or incorrect values.

**Fix:**
1. Run `dig CNAME <record-name> +short` to check DNS
2. Compare output to dashboard values exactly
3. Wait 10-15 minutes for propagation
4. Click _Verify now_ again
5. WorkOS will auto-retry for 72 hours

### "Cloudflare CNAME verification fails"

**Root cause:** CNAME is proxied (orange cloud enabled).

**Fix:**
1. Open Cloudflare DNS settings
2. Find the AuthKit CNAME record
3. Click orange cloud to disable proxy (turn grey)
4. Wait for DNS update
5. Retry verification in WorkOS dashboard

### "Emails still sent from workos.dev"

**Root cause:** Email domain not verified, or environment is staging.

**Fix:**
1. Check dashboard shows "Verified" for email domain
2. Confirm you're in **Production** environment (not staging)
3. CNAME records must remain in DNS permanently
4. Check spam folder (first emails may be flagged)

### "AuthKit still uses authkit.app domain"

**Root cause:** Redirect URI not updated, or domain not verified.

**Fix:**
1. Check dashboard shows "Verified" for AuthKit domain
2. Update `WORKOS_REDIRECT_URI` to new domain
3. Update redirect URI in WorkOS Dashboard → Redirects
4. Clear browser cache / test in incognito
5. Check DNS propagation with `dig` or `nslookup`

### "DNS propagation taking too long"

**Expected behavior:** DNS can take 5 minutes to 48 hours.

**Check propagation status:**
```bash
# Check from your machine
dig CNAME auth.your-domain.com +short

# Check from external resolver
dig @8.8.8.8 CNAME auth.your-domain.com +short
```

**Fix:**
- WorkOS auto-retries for 72 hours - no action needed
- If urgent, reduce TTL on DNS records (requires DNS provider support)
- Do NOT delete and recreate records while verification pending

### "no-reply@your-domain.com in spam"

**Root cause:** New domain needs email reputation building.

**Fix:**
1. Confirm CNAME records are present (required for SPF/DKIM)
2. Add SPF record if not auto-generated: `v=spf1 include:_spf.workos.dev ~all`
3. Test with email testing tools (mail-tester.com)
4. Reputation builds over time with consistent sending

## Related Skills

- **workos-authkit-nextjs** - AuthKit integration with custom domains
- **workos-magic-auth** - Email-based authentication using custom email domain
- **workos-admin-portal** - Admin Portal with custom domain configuration
