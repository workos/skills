---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The email docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Delivery Strategy (Decision Tree)

WorkOS offers three email delivery options. Choose based on your requirements:

```
Email delivery strategy?
  |
  +-- Need fastest setup, low volume
  |   --> Option A: WorkOS email domain (workos-mail.com)
  |
  +-- Need branded emails, control over deliverability
  |   --> Option B: Your email domain
  |
  +-- Need full control, existing email infrastructure
      --> Option C: Event-driven (send your own email)
```

**Each option requires different implementation steps. Follow the section that matches your choice.**

## Option A: WorkOS Email Domain (Default)

### Step A1: Verify Prerequisites

No configuration required. WorkOS sends email from `workos-mail.com` by default.

### Step A2: Critical Constraints (MUST FOLLOW)

**Do NOT send unsolicited email.** WorkOS may block your account if spam is detected.

Allowed patterns:
- User explicitly requests invitation
- User initiates password reset
- User initiates Magic Auth sign-in

Prohibited patterns:
- Bulk inviting users from marketing lists
- Sending to users who did not request access

### Step A3: Organization Naming Requirements

Check your WorkOS Dashboard for team and organization names that contain [common spam trigger words](https://mailtrap.io/blog/email-spam-words/).

**Avoid terms like:**
- "Free", "Winner", "Cash", "Bonus"
- ALL CAPS organization names
- Excessive punctuation ("!!!!")

These names appear in email content and affect deliverability.

### Verification

```bash
# Check that WorkOS SDK is sending emails
# (No configuration files to verify for default option)
echo "Using WorkOS email domain - no local config required"
```

## Option B: Your Email Domain (Recommended for Production)

### Step B1: Domain Verification in Dashboard

Navigate to WorkOS Dashboard → Email Settings.

**Required DNS records (all 3 must be added):**

1. **Ownership verification CNAME:**
   - Provided by WorkOS Dashboard
   - Verifies you control the domain

2. **SPF/DKIM CNAME #1:**
   - Configures SendGrid automated security
   - See [SendGrid docs](https://support.sendgrid.com/hc/en-us/articles/21415314709147)

3. **SPF/DKIM CNAME #2:**
   - Second authentication record
   - Required for DKIM signing

Add these records with your DNS provider (Cloudflare, Route53, etc.).

**Verify DNS propagation:**

```bash
# Check CNAME records are live (replace example.com with your domain)
dig CNAME em123.example.com
dig CNAME s1._domainkey.example.com
dig CNAME s2._domainkey.example.com
```

All three should return CNAME records pointing to SendGrid infrastructure.

### Step B2: Create Email Inboxes (REQUIRED)

Email providers verify sender addresses have real inboxes. You MUST create:

- `welcome@<your-domain>`
- `access@<your-domain>`

**Example for Google Workspace:**

1. Admin console → Users → Add user
2. Create `welcome` user with mailbox
3. Create `access` user with mailbox

**Example for Microsoft 365:**

1. Admin center → Users → Active users → Add user
2. Create both accounts with Exchange mailboxes

**Verify inboxes exist:**

```bash
# Test inbox by sending email (replace with your domain)
echo "Test" | mail -s "Inbox test" welcome@example.com
# Check if delivery succeeds (no bounce)
```

### Step B3: Configure DMARC (REQUIRED for Google/Yahoo)

**CRITICAL:** Google requires DMARC for senders with 5000+ daily emails. Set this up BEFORE going to production.

Add a DNS TXT record:

```
Type: TXT
Name: _dmarc.example.com
Value: v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com
```

**DMARC policy options:**

- `p=none` - Monitor only (use for testing)
- `p=quarantine` - Mark as spam if fails
- `p=reject` - Reject delivery if fails (recommended for production)

**Verify DMARC record:**

```bash
# Check DMARC TXT record exists
dig TXT _dmarc.example.com

# Should return record starting with "v=DMARC1"
```

### Step B4: Naming Requirements (Same as Option A)

Follow Step A3 constraints for organization names.

### Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify all 3 CNAME records resolve
dig CNAME em123.example.com | grep ANSWER
dig CNAME s1._domainkey.example.com | grep ANSWER  
dig CNAME s2._domainkey.example.com | grep ANSWER

# 2. Verify DMARC record exists
dig TXT _dmarc.example.com | grep "v=DMARC1"

# 3. Test inboxes are reachable
nslookup -type=MX example.com | grep "mail exchanger"

# 4. Check WorkOS Dashboard shows "Verified"
echo "Manually check: dashboard.workos.com → Email Settings → Domain Status = Verified"
```

**Do not send production emails until all 4 checks pass.**

## Option C: Event-Driven (Send Your Own Email)

### Step C1: Configure Event Webhooks

WebFetch: `https://workos.com/docs/events`

Follow the **workos-events** skill to set up webhook endpoints.

### Step C2: Listen for Email Events

WorkOS emits events when email needs to be sent. Your app listens and sends via your provider (SendGrid, Mailgun, AWS SES, etc.).

**Relevant event types (check Events docs for complete list):**

- `authentication.email_verification_sent`
- `user.invitation_sent`
- `user.password_reset_requested`

**Pattern:**

```
WorkOS emits event
  |
  v
Your webhook receives event payload
  |
  v
Extract: user email, template type, magic link/reset token
  |
  v
Call your email provider API
```

### Step C3: Template Mapping

Map WorkOS event types to your email templates:

| WorkOS Event | Your Email Template | Required Data |
|--------------|---------------------|---------------|
| `user.invitation_sent` | `invitation.html` | `invitation_url` |
| `authentication.email_verification_sent` | `verify-email.html` | `verification_url` |
| `user.password_reset_requested` | `password-reset.html` | `reset_url` |

### Step C4: Implement Email Sender

**CRITICAL:** You are responsible for deliverability. Follow Option B best practices:

- Set up SPF/DKIM/DMARC on your sending domain
- Use reputable email provider (SendGrid, Mailgun, AWS SES)
- Monitor bounce rates and unsubscribes

**Example pattern (pseudo-code):**

```
function handleWorkOSEvent(event):
  if event.type == "user.invitation_sent":
    template = loadTemplate("invitation.html")
    sendEmail(
      to: event.data.user.email,
      from: "welcome@yourdomain.com",
      subject: "Join our team",
      body: template.render(invitation_url: event.data.invitation_url)
    )
```

### Verification

```bash
# 1. Webhook endpoint responds 200
curl -X POST https://yourapp.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'

# 2. Email provider credentials configured
env | grep EMAIL_PROVIDER_API_KEY

# 3. Test event triggers email send
# (Send test event from WorkOS Dashboard → Events → Send Test Event)
```

## Error Recovery

### "Emails going to spam" (All Options)

**Root cause analysis (decision tree):**

```
Spam for all users?
  |
  +-- YES --> Domain reputation issue
  |           Fix: Check Postmaster Tools, verify DMARC/SPF/DKIM
  |
  +-- NO  --> Recipient-specific issue
              Fix: Check recipient's spam filter settings
```

**Tools for debugging:**

- Google: [Postmaster Tools](https://www.gmail.com/postmaster/)
- Microsoft: [Sender Support](https://sendersupport.olc.protection.outlook.com/pm/)
- Generic: [Litmus](https://www.litmus.com/email-testing), [Warmly](https://www.warmy.io/free-tools/email-deliverability-test/)

**Common fixes:**

1. **Low domain reputation:**
   - Verify DMARC policy is `p=reject` (not `p=none`)
   - Check SPF/DKIM alignment scores in Postmaster Tools
   - Reduce sending volume temporarily

2. **Aggressive spam filters (Google Workspace):**
   - May delay emails up to 30 minutes with [Enhanced Pre-delivery Message Scanning](https://support.google.com/a/answer/7380368)
   - No fix available - warn users of potential delays

3. **Missing inboxes (Option B only):**
   - Verify `welcome@` and `access@` inboxes exist and receive mail
   - Test by sending email manually to both addresses

### "CNAME records not verifying" (Option B)

**Common causes:**

1. **DNS propagation delay:**
   - Wait 24-48 hours after adding records
   - Check propagation: `dig CNAME <record> @8.8.8.8`

2. **Wrong DNS zone:**
   - Confirm records added to correct domain (not subdomain)
   - Example: `example.com` not `www.example.com`

3. **CNAME vs A record conflict:**
   - Cannot have both CNAME and A record for same name
   - Remove any conflicting A records

**Verify current DNS state:**

```bash
# Check what DNS sees (use Google DNS for accuracy)
dig @8.8.8.8 CNAME em123.example.com +short

# Should return SendGrid domain, e.g., u1234567.wl001.sendgrid.net
```

### "DMARC policy too strict causing rejections" (Option B)

If legitimate emails are being rejected after setting `p=reject`:

1. Check DMARC reports sent to `rua` email address
2. Identify which emails are failing alignment
3. Temporarily set `p=quarantine` while investigating
4. Fix SPF/DKIM alignment issues before returning to `p=reject`

### "Event webhook not triggering emails" (Option C)

**Diagnosis steps:**

```bash
# 1. Check webhook endpoint is reachable
curl -v https://yourapp.com/webhooks/workos

# 2. Check WorkOS Dashboard for webhook failures
# Navigate to: Dashboard → Webhooks → Recent Deliveries

# 3. Check application logs for event receipt
grep "workos.event" /var/log/application.log
```

**Common causes:**

- Webhook signature verification failing (check WORKOS_WEBHOOK_SECRET)
- Event handler throwing exceptions (check error logs)
- Email provider rate limiting (check provider dashboard)

### "Cannot find email configuration in Dashboard"

**Path:** WorkOS Dashboard → Settings → Email Configuration

If not visible:
- Confirm your account has email features enabled
- Contact support@workos.com to enable Email Delivery

## Related Skills

- **workos-events** - Required for Option C event-driven email
- **workos-authkit-nextjs** - Uses WorkOS email for Magic Auth and password resets
- **workos-magic-link** - Relies on WorkOS email delivery
