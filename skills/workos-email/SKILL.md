---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- generated -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Strategy (Decision Tree)

```
What level of control do you need?
  |
  +-- Quick start, no domain setup
  |   --> (A) Use WorkOS email domain (workos-mail.com)
  |       - No DNS configuration
  |       - Limited customization
  |       - Good for prototyping
  |
  +-- Brand consistency, better deliverability
  |   --> (B) Configure your email domain
  |       - Full DNS setup required
  |       - Emails from your domain (welcome@, access@)
  |       - Better user trust
  |
  +-- Full control over email provider
      --> (C) Event-driven custom email
          - Implement event listeners
          - Use your own email service
          - Maximum flexibility
```

**For most production apps:** Choose option (B) - your email domain.

## Step 3: Implementation Path

### Path A: WorkOS Email Domain (Default)

**No additional setup required.** Skip to Step 6 (Verification).

**Critical constraints:**
- Do NOT send unsolicited email (invitations must be user-initiated)
- Avoid spam trigger words in team/organization names
- Check spam word list: https://mailtrap.io/blog/email-spam-words/

### Path B: Your Email Domain (Recommended)

#### 3.1: Dashboard Configuration

Navigate to WorkOS Dashboard → Email Settings.

**Add your domain:**
1. Enter your domain (e.g., `example.com`)
2. Dashboard will generate 3 CNAME records

#### 3.2: DNS Configuration

Add these CNAME records to your domain provider:

```
Record 1 (Domain Verification):
  Type: CNAME
  Name: <provided-by-dashboard>
  Value: <provided-by-dashboard>

Record 2 (SPF/DKIM - SendGrid Auth):
  Type: CNAME
  Name: <provided-by-dashboard>
  Value: <provided-by-dashboard>

Record 3 (SPF/DKIM - SendGrid Auth):
  Type: CNAME
  Name: <provided-by-dashboard>
  Value: <provided-by-dashboard>
```

**Wait for DNS propagation** (5 minutes to 48 hours depending on TTL).

#### 3.3: Verify Domain in Dashboard

In WorkOS Dashboard, click "Verify Domain" button.

**If verification fails:**
- Check DNS records with: `dig CNAME <record-name>`
- Wait longer for propagation
- Verify exact copy-paste from dashboard (no trailing dots/spaces)

#### 3.4: Create Email Inboxes (CRITICAL)

Email providers check if sender addresses have real inboxes.

**Create these inboxes with your email provider:**
- `welcome@<your-domain>`
- `access@<your-domain>`

These must be actual functioning mailboxes, not aliases or forwarders.

#### 3.5: Set Up DMARC Policy

Add DMARC TXT record to your domain DNS:

```
Type: TXT
Name: _dmarc.example.com
Content: v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com
```

**Policy options:**
- `p=none` - Monitor only (not recommended)
- `p=quarantine` - Send to spam if auth fails
- `p=reject` - Block if auth fails (recommended)

**Verify DMARC setup:**
```bash
dig TXT _dmarc.example.com
```

Expected output should contain your DMARC policy.

### Path C: Custom Email Provider

#### 3.1: Configure Event Webhook

In WorkOS Dashboard → Webhooks:
1. Add endpoint URL (e.g., `https://yourapp.com/api/webhooks/workos`)
2. Subscribe to email events:
   - `user.created`
   - `invitation.sent`
   - `password_reset.requested`
   - `magic_auth.sent`

#### 3.2: Implement Webhook Handler

Create API route to receive events:

```typescript
// Example: app/api/webhooks/workos/route.ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('workos-signature');
  
  // Verify webhook signature
  const event = workos.webhooks.constructEvent({
    payload,
    sigHeader: signature,
    secret: process.env.WORKOS_WEBHOOK_SECRET,
  });
  
  // Route to your email service
  switch (event.event) {
    case 'invitation.sent':
      await sendInvitationEmail(event.data);
      break;
    case 'magic_auth.sent':
      await sendMagicLinkEmail(event.data);
      break;
    // ... other cases
  }
  
  return new Response(null, { status: 200 });
}
```

#### 3.3: Implement Email Service Integration

Connect to your email provider (SendGrid, Postmark, AWS SES, etc.):

```typescript
async function sendInvitationEmail(data: any) {
  // Extract data from event
  const { email, invitation_url, organization_name } = data;
  
  // Send via your email service
  await yourEmailService.send({
    to: email,
    from: 'welcome@yourdomain.com',
    subject: `You've been invited to ${organization_name}`,
    html: `<a href="${invitation_url}">Accept invitation</a>`,
  });
}
```

**Critical:** Your webhook handler must respond with 200 status within 5 seconds, or WorkOS will retry.

## Step 4: Test Email Delivery

### Basic Send Test

Trigger an email through your WorkOS feature (invitation, magic link, etc.).

**Check:**
1. Email arrives in inbox (not spam)
2. From address matches expected domain
3. Links in email are functional
4. Email renders correctly in multiple clients

### Spam Filter Testing

Use these tools to test deliverability:

```bash
# Check SPF record
dig TXT example.com | grep "v=spf1"

# Check DKIM record
dig TXT default._domainkey.example.com

# Check DMARC record
dig TXT _dmarc.example.com
```

**Online testing services:**
- Google Postmaster Tools: https://postmaster.google.com/
- Microsoft Sender Support: https://sendersupport.olc.protection.outlook.com/pm/
- Mail-tester.com: Send test to provided address for spam score
- Litmus: https://www.litmus.com/email-testing (paid)

## Step 5: Production Monitoring

### Set Up DMARC Reports

In your DMARC record, configure reporting:

```
v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com; ruf=mailto:dmarc-forensic@example.com
```

**Monitor these reports for:**
- Authentication failures (SPF/DKIM issues)
- Spoofing attempts
- Misconfigurations

### Monitor Bounce Rates

High bounce rates hurt domain reputation.

**Check WorkOS Dashboard for:**
- Hard bounces (bad email addresses)
- Soft bounces (temporary failures)
- Spam complaints

**If bounce rate >5%:** Investigate email validation in your signup flow.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm setup:

```bash
# 1. Check DNS records exist (for option B)
dig CNAME <your-verification-cname> +short
dig TXT _dmarc.<your-domain> +short

# 2. Verify WorkOS dashboard shows domain as verified
# (Manual check in dashboard)

# 3. Send test email and check inbox arrival
# (Trigger invite/magic link and verify receipt)

# 4. Check spam score
# Visit mail-tester.com, send test email to provided address
# Score must be 8/10 or higher

# 5. Verify webhook endpoint responds (for option C)
curl -X POST https://yourapp.com/api/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 200 status
```

## Error Recovery

### "Email not received" (all users affected)

**Root cause:** Domain reputation issue or DNS misconfiguration.

**Fix:**
1. Check DNS propagation: `dig TXT <your-domain>` must show SPF record
2. Verify DMARC policy exists: `dig TXT _dmarc.<your-domain>`
3. Check WorkOS dashboard for domain verification status
4. Test with mail-tester.com for spam score
5. If spam score low, review team/organization names for spam trigger words

### "Email not received" (specific email provider only)

**Root cause:** Provider-specific spam filtering or security settings.

**Fix for Gmail/Google Workspace:**
1. Register domain with Google Postmaster Tools
2. Check domain reputation score
3. Review spam rate metrics
4. If issues persist, user must whitelist sender

**Fix for Microsoft/Outlook:**
1. Register with Microsoft Sender Support
2. Request delisting if blocked
3. Check for IP/domain blocks

### "Email delayed by hours"

**Root cause:** Enhanced pre-delivery scanning or greylisting.

**Fix:**
1. This is normal for some enterprise email systems
2. Inform users to wait up to 1 hour
3. Provide manual alternative (e.g., copy magic link from dashboard)
4. Cannot be fully prevented - it's a security feature

### "DMARC verification failed"

**Root cause:** SPF/DKIM not aligned with From domain.

**Fix:**
1. Ensure all 3 CNAME records are added (not just verification record)
2. Check SendGrid authentication: `dig CNAME <sendgrid-cname>`
3. Wait 24 hours after DNS changes
4. Use DMARC analyzer tool to check alignment

### "Webhook endpoint timing out" (option C)

**Root cause:** Handler takes >5 seconds to respond.

**Fix:**
1. Return 200 immediately, process email asynchronously:
```typescript
export async function POST(request: Request) {
  const payload = await request.text();
  
  // Queue for background processing
  await queueEmailJob(payload);
  
  // Return immediately
  return new Response(null, { status: 200 });
}
```
2. Verify handler responds in <3 seconds: `time curl -X POST <webhook-url>`

### "High bounce rate"

**Root cause:** Invalid email addresses in your database.

**Fix:**
1. Implement email validation at signup: use regex + DNS MX check
2. Add email verification step (send confirmation link)
3. Clean existing database: remove emails with repeated bounces
4. Never bulk import unverified email lists

## Related Skills

- `workos-authkit-nextjs` - Magic Auth email integration
- `workos-user-management` - User invitation emails
