---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- generated -->

# WorkOS Email Delivery

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Strategy (Decision Tree)

WorkOS offers three email delivery patterns. Select based on your requirements:

```
Email delivery strategy?
  |
  +-- Quick start / prototype
  |   --> Option A: WorkOS email domain (workos-mail.com)
  |       - Zero DNS setup
  |       - Limited customization
  |       - Adequate for testing
  |
  +-- Production app with brand control
  |   --> Option B: Your email domain
  |       - Requires DNS configuration
  |       - Better deliverability
  |       - Users see your brand
  |
  +-- Full control / custom provider
      --> Option C: Event-driven custom email
          - Listen to WorkOS webhooks
          - Use own email provider (SendGrid, Postmark, etc.)
          - Maximum flexibility
```

**For most production apps:** Choose Option B (your email domain).

## Step 3: Configuration by Strategy

### Option A: WorkOS Email Domain (Default)

**No setup required.** WorkOS sends from `workos-mail.com` automatically.

**Constraints:**
- Do NOT send unsolicited email (no bulk invites from marketing lists)
- Use professional team/organization names (avoid spam trigger words)
- See [spam word list](https://mailtrap.io/blog/email-spam-words/) for reference

**Verification:**
```bash
# Test email sending works (example with Magic Auth)
curl -X POST https://api.workos.com/user_management/magic_auth/send \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check response for 201 status
```

### Option B: Your Email Domain (Recommended for Production)

#### Step 3.1: Domain Verification

Navigate to WorkOS Dashboard → Email Settings.

Add your domain and WorkOS will provide 3 CNAME records:

1. **Domain verification** - Proves you own the domain
2. **SPF authentication** - Via SendGrid automated security
3. **DKIM authentication** - Via SendGrid automated security

#### Step 3.2: DNS Configuration

Add these CNAME records with your DNS provider (exact values from dashboard):

```
# Example structure (your actual values will differ)
CNAME _workos-verification.yourdomain.com → verify.workos.com
CNAME em1234.yourdomain.com → u1234.wl.sendgrid.net
CNAME s1._domainkey.yourdomain.com → s1.domainkey.u1234.wl.sendgrid.net
```

**Propagation time:** 15 minutes to 48 hours depending on DNS provider.

#### Step 3.3: Verify DNS Records

```bash
# Check CNAME propagation (replace with your actual records)
dig _workos-verification.yourdomain.com CNAME +short
dig em1234.yourdomain.com CNAME +short
dig s1._domainkey.yourdomain.com CNAME +short

# All should return non-empty results matching dashboard values
```

Return to WorkOS Dashboard and click "Verify Domain". Must show green checkmark.

#### Step 3.4: Create Email Inboxes (REQUIRED)

Email providers verify sender addresses exist. Create these inboxes:

- `welcome@yourdomain.com` - For signup/invitation emails
- `access@yourdomain.com` - For auth-related emails

**Do NOT skip this.** Missing inboxes trigger spam filters.

#### Step 3.5: DMARC Configuration (Strongly Recommended)

Add DMARC DNS TXT record to improve deliverability:

```
TXT Record
name: _dmarc.yourdomain.com
value: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; fo=1
```

**Policy explanation:**
- `p=reject` - Reject unauthenticated email claiming to be from your domain
- `rua=` - Aggregate reports sent here
- `ruf=` - Forensic reports sent here
- `fo=1` - Generate forensic reports for all failures

**Verification:**
```bash
dig _dmarc.yourdomain.com TXT +short
# Should return the DMARC policy string
```

### Option C: Custom Email Provider via Webhooks

#### Step 3.1: Enable Webhook Events

In WorkOS Dashboard → Webhooks, subscribe to email-related events:

- `email.password_reset.created`
- `email.magic_auth.created`
- `email.invitation.created`
- (Check docs for complete event list)

#### Step 3.2: Create Webhook Endpoint

Add route to receive WorkOS events:

```typescript
// app/api/workos-webhooks/route.ts
import { NextRequest } from 'next/server';
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('workos-signature');
  
  // Verify webhook signature
  const event = workos.webhooks.constructEvent({
    payload: body,
    sigHeader: signature!,
    secret: process.env.WORKOS_WEBHOOK_SECRET!,
  });
  
  // Route to your email provider
  switch (event.event) {
    case 'email.magic_auth.created':
      await sendEmailViaSendGrid(event.data);
      break;
    // ... handle other event types
  }
  
  return new Response('OK', { status: 200 });
}
```

#### Step 3.3: Verify Webhook Delivery

```bash
# Check webhook endpoint responds
curl -X POST http://localhost:3000/api/workos-webhooks \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 200 OK (signature verification may fail, that's expected)
```

Configure webhook URL in WorkOS Dashboard. Trigger test event and confirm delivery.

## Step 4: Test Email Delivery

### Trigger Test Email

Use WorkOS feature that sends email (Magic Auth is simplest):

```typescript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

await workos.userManagement.sendMagicAuthCode({
  email: 'your-test-email@example.com',
});
```

### Check Inbox

**Expected:** Email arrives within 30 seconds.

**If delayed (>5 minutes):** See Error Recovery section.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. DNS records propagated (Option B only)
dig _dmarc.yourdomain.com TXT +short | grep -q "v=DMARC1" && echo "PASS" || echo "FAIL"

# 2. WorkOS domain verified in dashboard (Option B only)
# Manual check: Dashboard shows green checkmark

# 3. Email inboxes exist (Option B only)
# Manual check: Send test email to welcome@yourdomain.com

# 4. Webhook endpoint responds (Option C only)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/workos-webhooks
# Should return 200

# 5. Test email delivery
# Trigger Magic Auth code, check inbox within 30 seconds
```

## Error Recovery

### Email Not Arriving (All Users Affected)

**Root cause:** Domain reputation issue.

**Fixes (in order):**

1. **Check spam folder** - Email may be filtered
2. **Verify DMARC policy** - Run `dig _dmarc.yourdomain.com TXT +short`
3. **Check SPF/DKIM records** - All 3 CNAMEs must resolve correctly
4. **Verify inboxes exist** - Send test email to welcome@ and access@ addresses
5. **Review team/org names** - Remove spam trigger words
6. **Use deliverability tools:**
   ```bash
   # Test with Google Postmaster Tools
   # Visit: https://postmaster.google.com/
   
   # Test with Microsoft Sender Support  
   # Visit: https://sendersupport.olc.protection.outlook.com/pm/
   ```

### Email Not Arriving (Specific Users Only)

**Root cause:** Email provider or organizational settings.

**Likely scenarios:**

- **Gmail users:** Enhanced Pre-delivery Message Scanning enabled
  - **Fix:** Users must whitelist your domain or wait 15-30 minutes
  
- **Corporate email:** IT department spam filters
  - **Fix:** Request allowlisting from IT admin
  
- **Yahoo/Outlook aggressive filtering:**
  - **Fix:** Register with Microsoft Sender Support / Yahoo Sender Hub

### Email Delayed (>5 Minutes)

**Root cause:** Email provider security scanning.

**Diagnostic:**
```bash
# Check if emails are queued
# Log into WorkOS Dashboard → Email Logs
# Look for "queued" or "processing" status
```

**Fixes:**
- **Google Workspace:** Enhanced scanning can delay up to 30 minutes (expected)
- **Microsoft 365:** Advanced Threat Protection may delay 10-15 minutes
- **If delayed >1 hour:** Contact WorkOS support with email ID from logs

### CNAME Records Not Resolving

**Root cause:** DNS propagation incomplete or incorrect values.

**Diagnostic:**
```bash
# Check each CNAME individually
for record in "_workos-verification" "em1234" "s1._domainkey"; do
  echo "Checking $record.yourdomain.com"
  dig $record.yourdomain.com CNAME +short
done
```

**Fixes:**
- **Empty result:** DNS not yet propagated (wait 1-4 hours, check with `dig +trace`)
- **Wrong value:** Correct CNAME target in DNS provider dashboard
- **@/root domain issues:** Use subdomain instead (e.g., `mail.yourdomain.com`)

### Webhook Events Not Received (Option C)

**Diagnostic:**
```bash
# Check webhook endpoint is publicly accessible
curl -X POST https://yourapp.com/api/workos-webhooks \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
  
# Should return 200 (even if signature fails)
```

**Fixes:**
- **localhost URL:** Use ngrok or deploy to staging first
- **403/401 errors:** Verify WORKOS_WEBHOOK_SECRET is set correctly
- **Signature verification fails:** Ensure using raw request body (not parsed JSON)
- **No events in dashboard:** Check WorkOS webhook event subscriptions are enabled

### Domain Verification Fails in Dashboard

**Root cause:** CNAME records not matching expected values.

**Diagnostic:**
```bash
# Get expected vs actual values
echo "Expected (from dashboard): <copy from WorkOS>"
echo "Actual:"
dig _workos-verification.yourdomain.com CNAME +short
```

**Fixes:**
- **Trailing dot issue:** Remove trailing dots from CNAME values
- **www vs apex:** Ensure using correct subdomain (verify in dashboard)
- **Proxy/CDN interference:** Bypass CDN for _workos-verification record
- **Still failing after 48 hours:** Contact WorkOS support with dig output

## Related Skills

- `workos-authkit-nextjs` - For Magic Auth implementation
- `workos-user-management` - For invitation workflows
- `workos-organizations` - For organization-scoped emails
