---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Choose Email Delivery Strategy (Decision Tree)

WorkOS offers three email delivery options. Choose based on your requirements:

```
Email delivery needs?
  |
  +-- Quick setup, no customization needed
  |   --> Option A: WorkOS email domain (workos-mail.com)
  |       - Zero configuration
  |       - Limited control over deliverability
  |       - Users see emails from workos-mail.com
  |
  +-- Brand consistency, better deliverability
  |   --> Option B: Your email domain (RECOMMENDED)
  |       - Users see emails from your domain
  |       - Better domain reputation control
  |       - Requires DNS configuration
  |       - Uses welcome@<your-domain> and access@<your-domain>
  |
  +-- Full control over email provider/templates
      --> Option C: Self-managed (webhook-based)
          - WorkOS emits events, you send email
          - Complete customization
          - You handle deliverability
          - Requires webhook setup (see workos-webhooks skill)
```

**For most production apps:** Choose Option B (your email domain).

## Step 3: Domain Configuration (Option B Only)

### Navigate to Dashboard

1. Open WorkOS Dashboard: `https://dashboard.workos.com`
2. Navigate to Email settings section

### Add DNS Records

You will need to configure **3 CNAME records** with your domain provider:

1. **Ownership verification** - One CNAME to verify you own the domain
2. **SPF authentication** - One CNAME for SPF (Sender Policy Framework)
3. **DKIM authentication** - One CNAME for DKIM (DomainKeys Identified Mail)

**The exact record values are provided in the dashboard.** Copy them character-for-character.

**Common DNS providers:**
- Cloudflare: DNS tab → Add record → CNAME
- Route53: Hosted zones → Records → Create record
- Namecheap: Advanced DNS → Add New Record
- GoDaddy: DNS Management → Add → CNAME

**Wait time:** DNS propagation takes 5 minutes to 48 hours. Use `dig` or `nslookup` to verify:

```bash
# Check if CNAME exists (replace with your record name)
dig CNAME em1234.yourdomain.com +short

# Should return a SendGrid domain like:
# u1234567.wl123.sendgrid.net
```

### Set Up Email Inboxes (REQUIRED)

**CRITICAL:** Email providers check if sender addresses have real inboxes.

Create these two inboxes with your email host:
- `welcome@<your-domain>`
- `access@<your-domain>`

**Verification:**
```bash
# Send test emails to both addresses
echo "Test" | mail -s "Inbox test" welcome@yourdomain.com
echo "Test" | mail -s "Inbox test" access@yourdomain.com

# Verify they arrive (do not bounce)
```

### Configure DMARC (HIGHLY RECOMMENDED)

**What it does:** Tells receiving servers how to handle emails that fail authentication.

**Why it matters:** Google, Yahoo, and Apple require DMARC for bulk senders. Without it, your emails may be rejected.

Add a DNS TXT record:

```
Name: _dmarc.yourdomain.com
Type: TXT
Value: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

**Policy options:**
- `p=none` - Monitor only (good for testing)
- `p=quarantine` - Send to spam folder
- `p=reject` - Reject email entirely (RECOMMENDED for production)

**Verification:**
```bash
# Check DMARC record exists
dig TXT _dmarc.yourdomain.com +short

# Should return something like:
# "v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com"
```

## Step 4: Domain and Organization Naming

**CRITICAL:** Spam filters flag certain words. Avoid these in:
- WorkOS team account name
- Organization names in your app

**Common spam trigger words to avoid:**
- "Free", "Win", "Cash", "Prize", "Earn", "Money"
- "Click here", "Act now", "Limited time"
- ALL CAPS text
- Excessive punctuation!!!

**Good examples:**
- "Acme Corp"
- "Contoso Engineering Team"

**Bad examples:**
- "FREE Trial Team!!!"
- "Click Here For ACCESS"

**Verification:**
```bash
# Check your WorkOS team name in dashboard settings
# Manually review for spam words from the list above
```

## Step 5: Prevent Unsolicited Email (CRITICAL)

**Rule:** Only send email when a user explicitly requests it.

**Allowed patterns:**
✅ User clicks "Send invitation" button for specific email
✅ User clicks "Reset password" for their own account
✅ User requests Magic Auth link for themselves

**Prohibited patterns:**
❌ Bulk importing email list and sending invites to all
❌ Sending invites to users who didn't request access
❌ Marketing/promotional emails through WorkOS

**Why this matters:** Unsolicited email triggers spam filters and damages domain reputation, even if your DNS is configured perfectly.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm email delivery is configured correctly:

```bash
# 1. Check DNS records are propagated (Option B only)
dig CNAME em1234.yourdomain.com +short  # Replace with your record
dig TXT _dmarc.yourdomain.com +short

# 2. Verify email inboxes exist (Option B only)
# Manually send test emails to welcome@ and access@ addresses
# Confirm they arrive and don't bounce

# 3. Check team/org names for spam words
# Manually review in WorkOS dashboard - no automated check available

# 4. Test email delivery (send actual invitation)
# Trigger an invite/reset in your app
# Check spam folder AND inbox
# Verify email arrives within 2 minutes
```

**All DNS checks should return valid records.** If `dig` returns empty, wait longer or check your DNS provider for errors.

## Error Recovery

### Email not arriving at all

**Diagnosis tree:**

```
Email missing?
  |
  +-- All users affected?
  |     |
  |     +-- YES --> Domain reputation issue
  |           - Check: DMARC record exists
  |           - Check: SPF/DKIM records exist
  |           - Check: welcome@ and access@ inboxes exist
  |           - Check: No unsolicited emails were sent
  |           - Check: Team/org names don't contain spam words
  |
  +-- Only some users affected?
        |
        +-- Check spam folder first
        |
        +-- Still missing --> Email provider-specific filtering
              - Google Workspace: Enhanced Pre-delivery Message Scanning may delay
              - Corporate IT: May have strict spam filters
              - Solution: User must whitelist sender domain
```

### Email arriving in spam folder

**Most common causes:**
1. DMARC not configured or set to `p=none`
2. welcome@ and access@ inboxes don't exist
3. Team/organization name contains spam trigger words
4. Recent unsolicited emails damaged domain reputation

**Fix priority:**
1. Set DMARC to `p=reject` (if currently `p=none`)
2. Create missing inboxes
3. Rename team/orgs to remove spam words
4. Wait 7-14 days for reputation to improve

### DNS records not propagating

```bash
# Check DNS provider directly (not cached nameservers)
dig @<your-dns-provider-ns> CNAME em1234.yourdomain.com

# Common nameserver IPs:
# Cloudflare: @1.1.1.1
# Google: @8.8.8.8
# Quad9: @9.9.9.9
```

If still not appearing after 48 hours:
- Check for typos in CNAME values
- Verify you added records to correct hosted zone
- Contact DNS provider support

### Email delayed (arrives after 10+ minutes)

**Cause:** Enhanced Pre-delivery Message Scanning (Gmail) or similar security feature.

**This is normal** for:
- First email to new domain
- High-security corporate environments
- Accounts flagged for suspicious activity

**Not fixable on your end.** Wait times reduce as domain reputation builds (2-4 weeks of consistent sending).

### Domain reputation damaged

**Recovery steps:**
1. **STOP** sending email immediately if bounce rate >5%
2. Audit recent sends - identify unsolicited emails
3. Wait 14-30 days before resuming
4. Use Google Postmaster Tools: `https://postmaster.google.com`
5. Use Microsoft Sender Support: `https://sendersupport.olc.protection.outlook.com/pm/`
6. Test deliverability: `https://www.warmy.io/free-tools/email-deliverability-test/`

**If reputation doesn't improve after 30 days:** Contact WorkOS support at `support@workos.com` with:
- Domain name
- Timeline of issues
- Postmaster Tools screenshots
- Confirmation you stopped unsolicited sends

## Related Skills

- `workos-webhooks` - For Option C (self-managed email via events)
- `workos-magic-auth` - Requires email delivery for passwordless login
- `workos-user-management` - Invitation emails rely on delivery
