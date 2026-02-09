---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

This documentation is the source of truth for email delivery options and configuration. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Choose Email Delivery Strategy (Decision Tree)

WorkOS offers three email delivery options. Choose based on your requirements:

```
Email delivery strategy?
  |
  +-- Quick start / testing --> (A) WorkOS email domain
  |                              - Zero setup
  |                              - Sends from workos-mail.com
  |                              - Limited control over deliverability
  |
  +-- Production apps --> (B) Your email domain
  |                        - Requires DNS configuration
  |                        - Sends from your domain
  |                        - Better user trust and deliverability control
  |
  +-- Full control / existing email provider --> (C) Send your own email
                                                   - Listen to WorkOS events
                                                   - Use your own email service
                                                   - Complete control over delivery
```

**Default recommendation:** Option B (Your email domain) for production applications.

## Step 3: Implementation Path

### Path A: WorkOS Email Domain (Zero Config)

**No implementation required.** WorkOS sends email automatically from `workos-mail.com`.

**Critical constraints:**
- Do NOT send unsolicited email (e.g., bulk invites from marketing lists)
- Only send invitation email if a user explicitly requests access
- Ensure team and organization names avoid common spam words (WebFetch docs for spam word list reference)

**Verification:** Trigger an auth flow (password reset, magic link, invitation). Check that email arrives from `@workos-mail.com`.

Proceed to Step 4 (Verification).

### Path B: Your Email Domain (Recommended)

#### B1: Domain Configuration in WorkOS Dashboard

Navigate to: `https://dashboard.workos.com` → Email settings

**Required DNS records (3 total):**

1. **Domain ownership verification** - 1 CNAME record
2. **SPF/DKIM authentication** - 2 CNAME records (SendGrid automated security)

**Exact record values:** Provided in dashboard after domain entry.

**IMPORTANT:** Email will be sent from these addresses:
- `welcome@<your-domain>`
- `access@<your-domain>`

#### B2: Email Provider Setup (CRITICAL)

**Create inboxes for both sender addresses:**

```bash
# Action required with your email provider:
# 1. Create inbox: welcome@<your-domain>
# 2. Create inbox: access@<your-domain>
```

Why: Email providers check if sender addresses have real inboxes. Missing inboxes harm deliverability.

#### B3: DMARC Setup (REQUIRED for Gmail/Yahoo senders)

Add DNS TXT record with your domain provider:

**Record template:**
```
Type: TXT
Name: _dmarc.<your-domain>
Value: v=DMARC1; p=reject; rua=mailto:dmarc-reports@<your-domain>
```

**Policy options:**
- `p=none` - Monitor only (testing)
- `p=quarantine` - Send to spam if auth fails
- `p=reject` - Reject if auth fails (recommended for production)

**Why required:** Google/Yahoo/Apple require DMARC for bulk senders. Without it, email may not reach recipients.

#### B4: DNS Propagation Wait

**Run this command to verify DNS records are live:**

```bash
# Check CNAME records
dig CNAME <verification-cname-from-dashboard> +short

# Check DMARC record
dig TXT _dmarc.<your-domain> +short
```

**Expected:** Non-empty output for all records.

**If empty:** DNS not propagated yet. Wait 5-60 minutes, retry.

#### B5: Verify in WorkOS Dashboard

Return to WorkOS dashboard email settings. Click "Verify Domain".

**Success:** Dashboard shows "Verified" status.

**Failure:** Check DNS records with dig commands above. Ensure exact values from dashboard.

Proceed to Step 4 (Verification).

### Path C: Send Your Own Email (Event-Driven)

**This path requires event integration.** See related skill for events setup.

**Pattern:**

1. Enable WorkOS Events (see `workos-api-events` skill)
2. Subscribe to email-related event types (WebFetch docs for event type list)
3. When event received, extract email payload
4. Send via your email provider (SendGrid, Postmark, etc.)

**Critical:** WorkOS will NOT send email automatically. Your event handler MUST send it, or users receive nothing.

**Event types to subscribe to:** WebFetch `https://workos.com/docs/email` for current list of email-related events.

This is an advanced pattern. Only use if you have strong requirements for email customization or existing email infrastructure.

Proceed to Step 4 (Verification).

## Step 4: End-to-End Verification

Run these tests to confirm email delivery works:

### Test 1: Trigger Email Flow

```bash
# Example: Trigger password reset via AuthKit
# (Exact method depends on your auth setup - see workos-authkit-* skills)

# Expected: Email sent within 60 seconds
```

### Test 2: Check Email Headers (Path B only)

**Verify SPF/DKIM pass:**

1. Receive test email in Gmail
2. View message source (three-dot menu → "Show original")
3. Check authentication results:

```
Expected in headers:
spf=pass
dkim=pass
dmarc=pass
```

**If any fail:** DNS records not configured correctly. Re-run DNS verification commands from B4.

### Test 3: Spam Filter Check

Send test email to multiple providers:
- Gmail account
- Outlook/Microsoft account
- Yahoo account (if targeting consumers)

**Expected:** Email in inbox (not spam folder) for all providers.

**If in spam:** See Error Recovery section.

## Step 5: Production Hardening (Path B only)

### Monitor Domain Reputation

Set up monitoring with these free tools:

1. **Google Postmaster Tools** - https://postmaster.google.com
   - Add your domain
   - Monitor spam rate, domain reputation, authentication

2. **Microsoft Sender Support** - https://sendersupport.olc.protection.outlook.com
   - Similar monitoring for Outlook/Microsoft

**Action threshold:** If spam rate > 0.1% or reputation drops, investigate immediately.

### Set Up DMARC Reports

In your DMARC record, the `rua=` tag specifies where reports go. Set up inbox to receive these reports:

```bash
# Create inbox for DMARC reports
# Email address from rua= tag in DMARC record
```

**Reports frequency:** Daily aggregates from major email providers.

**What to look for:** Failed authentication attempts may indicate domain spoofing or misconfiguration.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify DNS records exist (Path B only)
dig CNAME <verification-record> +short || echo "FAIL: Verification CNAME missing"
dig TXT _dmarc.<your-domain> +short | grep -q "v=DMARC1" || echo "FAIL: DMARC missing"

# 2. Check sender inboxes exist (Path B only)
# Manual check: Send test email TO welcome@<your-domain> and access@<your-domain>
# Both should not bounce

# 3. Trigger email flow and verify receipt
# Manual test: Initiate password reset / invitation / magic link
# Email should arrive in < 60 seconds

# 4. Check spam placement
# Manual test: Check inbox (not spam folder) in Gmail, Outlook, Yahoo

# 5. Verify authentication (Path B only)
# Manual test: View email source, confirm spf=pass, dkim=pass, dmarc=pass
```

**If any check fails:** See Error Recovery section before marking complete.

## Error Recovery

### Email Not Arriving (All Paths)

**Diagnostic steps:**

1. Check WorkOS dashboard logs - was email sent by WorkOS?
2. Check spam folder - filtered as spam?
3. Check email provider settings - aggressive filtering enabled?

**Root causes and fixes:**

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Not sent by WorkOS | Event not triggered | Check application logic triggering email |
| Sent but not received (all users) | Domain reputation issue | Contact WorkOS support, check Postmaster Tools |
| Sent but not received (Gmail only) | Enhanced scanning delay | Wait 5-15 minutes, or reduce attachment size |
| Always in spam | Authentication failure | Check SPF/DKIM/DMARC pass (see Test 2) |
| Bounced | Invalid recipient | Check email address format, typos |

### Authentication Failures (Path B)

**Error:** Email headers show `spf=fail`, `dkim=fail`, or `dmarc=fail`

**Fix sequence:**

1. Re-run DNS verification: `dig TXT _dmarc.<your-domain> +short`
2. Verify CNAME records match dashboard exactly (case-sensitive)
3. Wait for DNS propagation (up to 60 minutes)
4. Clear DNS cache: `sudo dscacheutil -flushcache` (macOS) or `ipconfig /flushdns` (Windows)
5. Re-verify in WorkOS dashboard

**If still failing:** DMARC record may have syntax error. Use DMARC validator tool (WebFetch docs for tool recommendations).

### High Spam Rate (Path B)

**Error:** Google Postmaster Tools shows spam rate > 0.1%

**Root causes:**

1. **Unsolicited email** - users marking as spam because they didn't request it
   - Fix: Only send invitation email when explicitly requested
   - Fix: Add unsubscribe mechanism (if bulk email)

2. **Poor organization/team names** - using spam trigger words
   - Fix: Audit organization names in WorkOS dashboard
   - Fix: Rename to avoid common spam words (WebFetch docs for spam word list)

3. **Low engagement** - users not opening emails
   - Fix: Improve email subject lines
   - Fix: Ensure emails are timely (send immediately when requested)

**Immediate action:** Pause email sends until spam rate drops below 0.1%.

### DMARC Policy Conflicts

**Error:** Email rejected due to DMARC policy mismatch

**Root cause:** Your existing DMARC policy may conflict with WorkOS sending on your behalf.

**Fix:** Ensure your DMARC record allows SendGrid (WorkOS email provider):

```bash
# Check current DMARC policy
dig TXT _dmarc.<your-domain> +short

# Should include:
# p=none (for testing) or p=reject (for production)
# Should NOT include restrictive SPF alignment (aspf=s)
```

If you have `aspf=s` (strict SPF alignment), change to `aspf=r` (relaxed) or remove (defaults to relaxed).

### Delayed Email (Google Enhanced Scanning)

**Symptom:** Email arrives 5-15 minutes late for Google Workspace users

**Root cause:** Enhanced Pre-delivery Message Scanning feature enabled on recipient domain

**This is expected behavior.** No fix on sender side.

**Workaround for users:** Recipient IT admin can whitelist your domain or disable enhanced scanning.

### WorkOS Dashboard Verification Failing

**Error:** "Unable to verify domain" in dashboard

**Diagnostic:**

```bash
# Check if DNS records exist
dig CNAME <cname-from-dashboard> +short

# If empty: DNS not propagated yet - wait 5-60 minutes
# If shows different value: Wrong record - update DNS provider
# If shows correct value: Clear dashboard cache - logout/login
```

**Common mistake:** Adding records to wrong domain (e.g., www subdomain instead of apex domain).

## Related Skills

- `workos-authkit-base` - Authentication flows that trigger email
- `workos-api-events` - Event-driven email pattern (Path C)
- `workos-magic-link` - Email-based passwordless auth
- `workos-admin-portal` - Organization invitations via email
