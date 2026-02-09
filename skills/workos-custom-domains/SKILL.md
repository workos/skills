---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

```
Environment?
  |
  +-- Staging --> WorkOS domains used by default (workos.dev for email, *.authkit.app for AuthKit)
  |               Custom domains NOT available in staging
  |
  +-- Production --> Custom domains configurable (PAID FEATURE)
                     Check pricing: https://workos.com/pricing
```

**CRITICAL:** Custom domains are a paid production-only feature. Staging environments always use WorkOS defaults.

### Prerequisites

Confirm these exist before proceeding:

```bash
# 1. Check environment variables
grep "WORKOS_API_KEY" .env* || echo "FAIL: WORKOS_API_KEY missing"
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: WORKOS_CLIENT_ID missing"

# 2. Verify production environment is selected
# (This check must be done via WorkOS Dashboard - no CLI command)

# 3. Confirm WorkOS SDK installed
npm list | grep workos || echo "FAIL: WorkOS SDK not installed"
```

**STOP:** If any checks fail, resolve before continuing.

## Step 3: Domain Type Selection (Decision Tree)

Custom domains can be configured for three services:

```
What service needs custom domain?
  |
  +-- Email (Magic Auth, verification, resets, invites)
  |   --> Go to Step 4: Configure Email Domain
  |
  +-- AuthKit (hosted auth UI)
  |   --> Go to Step 5: Configure AuthKit Domain
  |
  +-- Admin Portal (enterprise self-serve)
  |   --> WebFetch https://workos.com/docs/custom-domains/admin-portal
  |       (Follow Admin Portal-specific instructions)
```

## Step 4: Configure Email Domain

**When:** Needed for Magic Auth, email verification, password resets, or invitations.

**Default behavior:**
- Staging: emails from `no-reply@workos.dev`
- Production (before custom domain): emails from `no-reply@workos.dev`
- Production (after custom domain): emails from `no-reply@your-domain.com`

### (A) Dashboard Setup

1. Log into https://dashboard.workos.com/
2. **CRITICAL:** Ensure Production environment is selected (check environment selector)
3. Navigate to _Domains_ section
4. Click _Add Domain_ button
5. Enter your desired email domain (e.g., `example.com` for `no-reply@example.com`)

### (B) DNS Configuration (BLOCKING)

You will receive 3 CNAME records. Create all three with your DNS provider:

```
CNAME Type    | Host                          | Value
--------------+-------------------------------+---------------------------
Record 1      | [provided by dashboard]       | [provided by dashboard]
Record 2      | [provided by dashboard]       | [provided by dashboard]
Record 3      | [provided by dashboard]       | [provided by dashboard]
```

**CRITICAL:** Copy exact values from dashboard. Do NOT guess or modify.

### (C) Verification

1. After creating DNS records, click _Verify now_ in dashboard
2. **Wait time:** DNS propagation can take 5-60 minutes
3. **Auto-retry:** WorkOS will retry verification for 72 hours if initial attempt fails
4. **Monitor:** Check dashboard for verification status

**STOP:** Do not proceed to testing until dashboard shows "Verified" status.

### (D) DNS Record Persistence

**CRITICAL:** Do NOT delete CNAME records after verification. WorkOS requires them for ongoing email delivery.

If records are removed:
- Email delivery will fail
- Users won't receive auth emails
- Magic Auth will break

## Step 5: Configure AuthKit Domain

**When:** Needed to white-label the hosted authentication UI.

**Default behavior:**
- Staging: random domain like `youthful-ginger-43.authkit.app`
- Production (before custom domain): random domain like `youthful-ginger-43.authkit.app`
- Production (after custom domain): your domain like `auth.example.com`

### (A) Dashboard Setup

1. Log into https://dashboard.workos.com/
2. **CRITICAL:** Ensure Production environment is selected
3. Navigate to _Domains_ section
4. Click _Configure AuthKit domain_ button
5. Enter your desired AuthKit subdomain (e.g., `auth.example.com`)

### (B) DNS Configuration (BLOCKING)

You will receive 1 CNAME record:

```
CNAME | Host                      | Value
------+---------------------------+---------------------------
      | [provided by dashboard]   | [provided by dashboard]
```

**Cloudflare users (CRITICAL):**
- Set CNAME to "DNS-only" mode
- Do NOT enable proxy (orange cloud icon)
- Reason: WorkOS uses Cloudflare internally; cross-account proxying is prohibited

### (C) Verification

1. After creating DNS record, dashboard will auto-verify
2. **Wait time:** DNS propagation can take 5-60 minutes
3. **Monitor:** Check dashboard for verification status

**STOP:** Do not update application code until dashboard shows "Verified" status.

### (D) Update Application Configuration

After verification completes, update your app's AuthKit redirect URI:

```
Old redirect URI: https://youthful-ginger-43.authkit.app/callback
New redirect URI: https://auth.example.com/callback
```

**Where to update:**
- Environment variables (`WORKOS_REDIRECT_URI`)
- WorkOS Dashboard redirect URI configuration
- Any hardcoded URLs in application code

**Verify redirect URI update:**

```bash
# Check environment variables
grep "WORKOS_REDIRECT_URI" .env* | grep "your-domain.com" || echo "FAIL: Redirect URI not updated"

# Check code for old domain
grep -r "authkit.app" . --exclude-dir=node_modules || echo "PASS: No old domain references"
```

## Step 6: Environment Variable Sync (Decision Tree)

```
Do you use multiple environments (dev/staging/prod)?
  |
  +-- Yes --> Map domains to environments:
  |           - Staging: Always use WorkOS defaults (custom domains not available)
  |           - Production: Use custom domains configured above
  |           
  |           Environment variable pattern:
  |           # .env.staging
  |           WORKOS_REDIRECT_URI=https://[random].authkit.app/callback
  |           
  |           # .env.production
  |           WORKOS_REDIRECT_URI=https://auth.example.com/callback
  |
  +-- No --> Single production environment only
              Use custom domain values from Steps 4-5
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm configuration. **Do not mark complete until all pass:**

```bash
# 1. Verify production environment is selected in dashboard
# (Manual check - no CLI command available)
echo "CHECK: Dashboard shows Production environment selected"

# 2. Verify domain verification status in dashboard
# (Manual check - no CLI command available)
echo "CHECK: Email domain shows Verified status"
echo "CHECK: AuthKit domain shows Verified status"

# 3. Check DNS records exist
dig CNAME your-email-domain.com | grep -i cname || echo "FAIL: Email CNAME missing"
dig CNAME auth.your-domain.com | grep -i cname || echo "FAIL: AuthKit CNAME missing"

# 4. Verify redirect URI updated
grep "your-domain.com" .env* || echo "FAIL: Environment variables not updated"

# 5. Test email sending (if using email features)
# Trigger a test email via your app (e.g., password reset)
# Verify email arrives from no-reply@your-domain.com

# 6. Test AuthKit loading (if using AuthKit)
curl -I https://auth.your-domain.com | grep "200" || echo "FAIL: AuthKit domain not resolving"
```

**If any check fails:** Return to relevant configuration step and fix before proceeding.

## Error Recovery

### "Domain verification failed"

**Root causes:**
- DNS records not created or incorrect values
- DNS propagation not complete (wait longer)
- CNAME pointing to wrong target

**Fix:**
1. Verify CNAME records exist: `dig CNAME your-domain.com`
2. Compare dig output to dashboard values exactly
3. Wait 15-60 minutes for DNS propagation
4. Click "Verify now" again in dashboard
5. If fails after 72 hours, contact WorkOS support

### "Cloudflare proxy error" (AuthKit domain)

**Root cause:** CNAME record set to "Proxied" mode in Cloudflare

**Fix:**
1. Log into Cloudflare dashboard
2. Find the CNAME record for AuthKit domain
3. Click the orange cloud icon to disable proxy (gray cloud = DNS-only)
4. Wait 5-10 minutes for change to propagate
5. Retry verification in WorkOS dashboard

### "Email not sent from custom domain"

**Root causes:**
- Domain verification not complete
- CNAME records were deleted after verification
- Email feature not configured to use custom domain

**Fix:**
1. Check dashboard shows "Verified" status for email domain
2. Verify CNAME records still exist: `dig CNAME your-email-domain.com`
3. If records missing, recreate them (WorkOS still needs them)
4. Trigger test email and check headers for From address

### "AuthKit shows old domain in browser"

**Root causes:**
- Application not updated with new redirect URI
- Browser cache showing old URL
- Environment variable not loaded

**Fix:**
1. Verify `WORKOS_REDIRECT_URI` updated: `echo $WORKOS_REDIRECT_URI`
2. Clear browser cache and cookies
3. Restart application server to reload env vars
4. Check WorkOS Dashboard redirect URI configuration matches

### "Custom domain shows 'Not available in staging'"

**Root cause:** Attempting to configure custom domain in staging environment

**Fix:**
This is expected behavior. Custom domains are production-only. Either:
- Switch to production environment in dashboard, OR
- Use WorkOS default domains in staging (workos.dev, *.authkit.app)

### "DNS propagation taking too long"

**Root cause:** DNS changes can take up to 48 hours to propagate globally

**Fix:**
1. Check local DNS: `dig @8.8.8.8 CNAME your-domain.com` (Google DNS)
2. Check authoritative DNS: `dig @[your-dns-provider] CNAME your-domain.com`
3. If authoritative shows record but local doesn't, wait for propagation
4. If authoritative doesn't show record, CNAME wasn't created correctly

## Related Skills

- **workos-authkit-nextjs** - Integrate AuthKit with Next.js (will use custom AuthKit domain if configured)
- **workos-authkit-react** - Integrate AuthKit with React apps (will use custom AuthKit domain if configured)
- **workos-magic-link** - Magic Auth implementation (uses custom email domain if configured)
- **workos-admin-portal** - Admin Portal can also use custom domains (see admin-portal-specific docs)
