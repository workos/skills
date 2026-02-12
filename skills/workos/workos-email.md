---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth for email delivery configuration and best practices.

## Step 2: Understand Email Delivery Options (Decision Tree)

WorkOS provides three email delivery modes. Choose based on your requirements:

```
Email delivery strategy?
  |
  +-- WorkOS domain (workos-mail.com)
  |     - Zero configuration
  |     - Limited customization
  |     - Shared domain reputation
  |     --> Proceed to Step 3
  |
  +-- Your domain (your-domain.com)
  |     - Better user trust (recognizable sender)
  |     - Full deliverability control
  |     - Requires DNS configuration
  |     --> Proceed to Step 4
  |
  +-- Self-managed (your email provider)
        - Maximum control
        - Listen to WorkOS webhook events
        - Implement your own sending logic
        --> See workos-webhooks skill
```

**Critical:** The WorkOS domain option sends from `workos-mail.com`. Your domain option sends from `welcome@your-domain.com` and `access@your-domain.com`.

## Step 3: WorkOS Domain Configuration (Option A)

This is the default mode — no configuration required.

### Sender Guidelines (MANDATORY)

**STOP violations immediately. These cause deliverability failures.**

1. **No unsolicited email** — Only send when a user explicitly requests (e.g., self-signup, invitation request). Never bulk-invite from marketing lists.
2. **Avoid spam trigger words** in team/organization names — Check names in WorkOS Dashboard against [common spam words](https://mailtrap.io/blog/email-spam-words/)

**Verification:**

```bash
# Check organization names in dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq -r '.data[].name'

# Manually review: Do names contain "free", "click here", "act now", etc.?
```

**If violations found:** Update organization names in WorkOS Dashboard before sending email.

Skip to Step 6 (Verification).

## Step 4: Your Domain Configuration (Option B — RECOMMENDED)

### DNS Records Setup (BLOCKING)

**Prerequisites:** Access to your domain's DNS provider (Cloudflare, Route53, etc.)

Navigate to: [WorkOS Dashboard → Email Delivery](https://dashboard.workos.com)

Configure DNS records in this exact order:

#### Record 1: Domain Verification (CNAME)

Purpose: Prove domain ownership

```
Type: CNAME
Name: [value from WorkOS dashboard]
Target: [value from WorkOS dashboard]
TTL: 3600
```

**Wait:** Propagation takes 5-60 minutes. Dashboard shows "Verified" when complete.

#### Record 2: SPF Authentication (CNAME)

Purpose: Authorize SendGrid to send on your behalf

```
Type: CNAME
Name: [value from WorkOS dashboard]
Target: [SendGrid SPF record from dashboard]
TTL: 3600
```

#### Record 3: DKIM Signing (CNAME)

Purpose: Cryptographic email signing

```
Type: CNAME
Name: [value from WorkOS dashboard]
Target: [SendGrid DKIM record from dashboard]
TTL: 3600
```

**Verification command:**

```bash
# Check CNAME records propagated
dig CNAME [name-from-dashboard].[your-domain.com] +short
# Should return SendGrid target
```

**If dig returns empty:** DNS not propagated yet. Wait 10 minutes, retry.

## Step 5: Enhanced Deliverability (Your Domain Only)

### Action 1: Create Email Inboxes (REQUIRED)

Email providers check if sender addresses are real. Create these inboxes with your email hosting:

- `welcome@your-domain.com`
- `access@your-domain.com`

**Do not skip this.** Missing inboxes trigger spam filters.

### Action 2: Configure DMARC Policy (REQUIRED for 5000+ emails/day)

DMARC tells receiving servers what to do with failed authentication.

**Add this TXT record with your DNS provider:**

```
Type: TXT
Name: _dmarc.your-domain.com
Value: v=DMARC1; p=reject; rua=mailto:dmarc@your-domain.com; ruf=mailto:dmarc@your-domain.com; pct=100
TTL: 3600
```

**Policy options:**

- `p=none` — Monitor only (testing phase)
- `p=quarantine` — Send to spam folder
- `p=reject` — Block delivery (production recommendation)

**Verification:**

```bash
dig TXT _dmarc.your-domain.com +short
# Should return: "v=DMARC1; p=reject; ..."
```

**If policy is too aggressive:** Start with `p=none`, monitor reports at `dmarc@your-domain.com`, then escalate to `p=reject`.

### Action 3: Warm Up Domain (New Domains)

**If domain is new (<30 days old):**

1. Start with low email volume (<100/day)
2. Gradually increase over 2-4 weeks
3. Monitor bounce rates (<2% is healthy)

**Skip this** if domain has existing email history.

## Step 6: Verification Checklist (ALL MUST PASS)

Run these checks to confirm email delivery is configured correctly:

```bash
# 1. Check WorkOS API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq -r '.data[0].name'
# Should return: Organization name

# 2. If using your domain: Check DNS records
dig CNAME [verification-name].[your-domain.com] +short
dig TXT _dmarc.[your-domain.com] +short

# 3. Check dashboard verification status
echo "Check: https://dashboard.workos.com/email-delivery"
echo "Status should show: 'Verified' with green checkmark"

# 4. Test email delivery (if using AuthKit/User Management)
# Trigger a test invitation or magic link
# Check recipient inbox within 2 minutes
```

**All checks must pass before going to production.**

## Step 7: Deliverability Monitoring

### Troubleshooting Decision Tree

```
Email not reaching users?
  |
  +-- All users affected?
  |     - Likely: Poor domain reputation
  |     - Check: Postmaster Tools (see below)
  |     - Fix: Review sender guidelines (Step 3)
  |
  +-- Only some users (specific domains)?
        - Likely: Provider-specific spam filter
        - Check: Spam testing tools (see below)
        - Fix: Contact recipient IT department
```

### Monitoring Tools

**For Gmail/Google Workspace issues:**

1. Register domain at: [Google Postmaster Tools](https://www.gmail.com/postmaster/)
2. Check domain reputation score (should be "High" or "Medium")
3. Review spam rate (should be <0.1%)

**For Outlook/Microsoft 365 issues:**

1. Check sender reputation: [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/pm/)
2. Submit delisting request if domain is blocked

**General spam testing:**

```bash
# Test email against major spam filters
# Use services like:
# - https://www.litmus.com/email-testing
# - https://www.warmy.io/free-tools/email-deliverability-test/
```

## Error Recovery

### "Email delayed 30+ minutes"

**Cause:** Enhanced Pre-delivery Message Scanning (Google) or similar provider security features

**Fix:**

1. This is normal for first-time senders to a domain
2. Domain reputation improves over 2-4 weeks
3. No action required unless delays persist >1 week

### "Email goes to spam folder"

**Most common causes:**

1. **No DMARC policy** — Add TXT record from Step 5
2. **Missing sender inboxes** — Create `welcome@` and `access@` mailboxes
3. **Spam trigger words** — Review organization names in dashboard
4. **New domain** — Implement domain warm-up (Step 5, Action 3)

**Verification:**

```bash
# Check spam score with manual test
# Send test email to: check-auth@verifier.port25.com
# Reply will contain authentication results
```

### "DNS records not verifying"

**Propagation timeout:**

```bash
# Check propagation status
dig CNAME [name-from-dashboard].[your-domain.com] @8.8.8.8
# Try different DNS servers: @1.1.1.1, @8.8.8.8
```

**If still failing after 2 hours:**

- Check: Record name matches dashboard exactly (common typo: missing subdomain)
- Check: No conflicting records exist (`dig CNAME` should return ONLY the target)
- Check: DNS provider supports CNAME flattening (Cloudflare does, some don't)

### "WorkOS dashboard shows 'Error' status"

**Contact WorkOS support with:**

```bash
# Collect diagnostic info
dig CNAME [verification-name].[your-domain.com] +trace > dns-trace.txt
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations > orgs.json

# Email to: support@workos.com
# Attach: dns-trace.txt, orgs.json, screenshot of dashboard error
```

## Related Skills

- **workos-webhooks** — Required if using self-managed email (Option C)
- **workos-authkit-base** — Email delivery used for Magic Auth and password resets
- **workos-user-management** — Email delivery used for invitations and notifications
