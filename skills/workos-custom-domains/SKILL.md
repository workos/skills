---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- generated -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs in order. They are the source of truth:
- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Detection

Determine which environment you're working in:

```bash
# Check WorkOS Dashboard or environment config
echo $WORKOS_ENVIRONMENT  # Should be 'production' or 'staging'
```

**Decision point:**

```
Environment?
  |
  +-- Staging   --> STOP: Custom domains not available
  |                 (uses workos.dev for email, authkit.app for auth)
  |
  +-- Production --> Continue to Step 3
```

Custom domains are production-only. If in staging, exit this skill.

### Account Prerequisites

- [ ] WorkOS account is on a paid plan (check pricing page or dashboard)
- [ ] Production environment exists and is accessible
- [ ] Dashboard access: https://dashboard.workos.com/

**Verify:** Log into dashboard, confirm "Domains" section exists in left nav. If not visible, plan upgrade required.

## Step 3: Domain Type Selection (Decision Tree)

Determine which custom domain(s) you need:

```
What services need custom domains?
  |
  +-- Email only (Magic Auth, password resets, invites)
  |     └─> Go to Step 4
  |
  +-- AuthKit only (hosted login/signup UI)
  |     └─> Go to Step 5
  |
  +-- Admin Portal only (SSO configuration UI)
  |     └─> Go to Step 6
  |
  +-- Multiple services
        └─> Complete Steps 4, 5, 6 as needed
```

Each domain type requires separate DNS configuration. You can configure multiple in parallel.

## Step 4: Email Domain Configuration

**Purpose:** Send AuthKit emails from `no-reply@yourdomain.com` instead of `no-reply@workos.dev`

### (A) Add Domain in Dashboard

1. Navigate to: https://dashboard.workos.com/ → Domains section
2. Click "Add Domain" under Email section
3. Enter your email domain (e.g., `company.com` for `no-reply@company.com`)
4. Click "Add"

### (B) Configure DNS Records

Dashboard will display 3 CNAME records. Create ALL three with your DNS provider:

```
Record 1: [subdomain1].[yourdomain] → [workos-target1]
Record 2: [subdomain2].[yourdomain] → [workos-target2]
Record 3: [subdomain3].[yourdomain] → [workos-target3]
```

**DNS Provider Instructions:**

- Cloudflare: DNS → Add record → Type: CNAME → Name: [subdomain] → Target: [workos-target]
- Route53: Hosted zones → Create record → CNAME → [subdomain] → Value: [workos-target]
- Others: Consult provider docs for CNAME creation

**CRITICAL:** Copy exact values from dashboard. Do NOT guess or modify.

### (C) Trigger Verification

1. After creating all 3 CNAME records, click "Verify now" in dashboard
2. Wait up to 5 minutes for DNS propagation
3. If verification fails, WorkOS auto-retries for 72 hours

**Verify DNS before clicking "Verify now":**

```bash
# Check CNAME records are live (replace with your actual subdomains)
dig CNAME subdomain1.yourdomain.com +short
dig CNAME subdomain2.yourdomain.com +short
dig CNAME subdomain3.yourdomain.com +short

# Each should return a WorkOS target hostname
```

### (D) Confirm Active

Dashboard should show "Verified" status next to email domain. Test by triggering a Magic Auth email.

## Step 5: AuthKit Domain Configuration

**Purpose:** Host AuthKit UI at `auth.yourdomain.com` instead of `random-phrase.authkit.app`

### (A) Add Domain in Dashboard

1. Navigate to: https://dashboard.workos.com/ → Domains section
2. Click "Configure AuthKit domain"
3. Enter subdomain (e.g., `auth.company.com`)
4. Click "Configure"

**Naming conventions:**
- Common: `auth.yourdomain.com`, `login.yourdomain.com`, `sso.yourdomain.com`
- Must be a subdomain (not root domain)

### (B) Configure DNS Record

Dashboard will display 1 CNAME record:

```
CNAME: auth.yourdomain.com → [workos-authkit-target].authkit.app
```

**Cloudflare users (CRITICAL):**
- Set CNAME to "DNS only" (gray cloud icon)
- Do NOT proxy (orange cloud) — causes verification failure
- WorkOS uses Cloudflare; proxied domains conflict

**Verify DNS:**

```bash
dig CNAME auth.yourdomain.com +short
# Should return [something].authkit.app
```

### (C) Update Redirect URIs

After domain verification, update your app's AuthKit configuration:

```
Old: NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://random-phrase.authkit.app/callback
New: NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback
```

**CRITICAL:** Update redirect URI in:
1. Environment variables (`.env.local`, `.env.production`)
2. WorkOS Dashboard → Redirects configuration
3. Re-deploy app if already in production

## Step 6: Admin Portal Domain Configuration

**Purpose:** Host SSO configuration portal at `portal.yourdomain.com` instead of WorkOS subdomain

Follow same process as Step 5 AuthKit:
1. Dashboard → Domains → "Configure Admin Portal domain"
2. Enter subdomain (e.g., `portal.company.com`)
3. Create CNAME record (DNS only if Cloudflare)
4. Verify in dashboard

**Update Admin Portal links in your app** after verification (consult Admin Portal docs for link generation).

## Verification Checklist (ALL MUST PASS)

Run these checks for each configured domain type:

### Email Domain

```bash
# 1. Verify DNS records exist
dig CNAME [subdomain1].yourdomain.com +short | grep -q workos && echo "PASS" || echo "FAIL"

# 2. Check dashboard shows "Verified"
# (Manual check in dashboard)

# 3. Send test email via AuthKit
# Trigger Magic Auth → Check email from header is no-reply@yourdomain.com
```

### AuthKit Domain

```bash
# 1. Verify DNS record exists
dig CNAME auth.yourdomain.com +short | grep -q authkit.app && echo "PASS" || echo "FAIL"

# 2. Test domain responds
curl -I https://auth.yourdomain.com | head -1 | grep -q "200\|301\|302" && echo "PASS" || echo "FAIL"

# 3. Check redirect URI updated in env
grep "WORKOS_REDIRECT_URI.*auth.yourdomain.com" .env.production && echo "PASS" || echo "FAIL"
```

### Admin Portal Domain

```bash
# 1. Verify DNS record exists
dig CNAME portal.yourdomain.com +short | grep -q workos && echo "PASS" || echo "FAIL"

# 2. Test domain responds
curl -I https://portal.yourdomain.com | head -1 | grep -q "200\|301\|302" && echo "PASS" || echo "FAIL"
```

**Do not mark complete until all relevant checks pass.**

## Error Recovery

### "Domain verification failed" (Email)

**Root cause:** CNAME records not propagated or incorrect values

**Fix:**
1. Verify all 3 CNAME records exist: `dig CNAME [each-subdomain]`
2. Wait 5-10 minutes for DNS propagation
3. Check WorkOS provided exact target values (no trailing dots, no typos)
4. If using Cloudflare, ensure not proxied
5. Click "Verify now" again after confirming DNS

**Still failing after 72 hours?** Contact WorkOS support — may indicate DNS provider issue.

### "Domain verification failed" (AuthKit/Admin Portal)

**Root cause:** Cloudflare proxy enabled or DNS not propagated

**Fix:**
1. If Cloudflare: Disable proxy (set to "DNS only")
2. Verify CNAME: `dig CNAME your-subdomain.com +short`
3. Wait 5-10 minutes, retry verification
4. Check no conflicting DNS records (A, AAAA) for same subdomain

### "Redirect URI mismatch" after AuthKit domain change

**Root cause:** Environment variables not updated or dashboard config stale

**Fix:**
1. Update `NEXT_PUBLIC_WORKOS_REDIRECT_URI` in `.env.production`
2. Update allowed redirect URIs in WorkOS Dashboard → Redirects
3. Re-deploy application
4. Clear browser cache/cookies
5. Test OAuth flow from scratch

### "CNAME record not found"

**Root cause:** DNS not propagated or record created incorrectly

**Fix:**
1. Check DNS provider: Is record saved and published?
2. Test with multiple DNS servers: `dig @8.8.8.8 CNAME your-subdomain.com`
3. Wait up to 1 hour for global DNS propagation
4. Verify no typos in subdomain or target

### "Cloudflare proxy error" (AuthKit domain)

**Root cause:** Orange cloud (proxied) enabled in Cloudflare

**Fix:**
1. Log into Cloudflare DNS management
2. Find CNAME record for auth subdomain
3. Click orange cloud to change to gray cloud (DNS only)
4. Wait 2-3 minutes
5. Retry verification in WorkOS dashboard

### "Email still coming from workos.dev"

**Root cause:** Email domain not verified or not set as active

**Fix:**
1. Check dashboard: Email domain shows "Verified" status?
2. If "Pending", check DNS records and wait for verification
3. If "Verified" but emails still wrong, wait 5 minutes for propagation
4. Test with new Magic Auth request (not cached session)

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit with custom domain in Next.js
- `workos-admin-portal` - Generate Admin Portal links with custom domain
- `workos-magic-auth` - Implement Magic Auth emails from custom domain
