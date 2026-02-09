---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- generated -->

# WorkOS Email Delivery

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The WorkOS docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env.local` or `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys present before continuing. If missing, user must obtain from WorkOS dashboard.

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package.json for WorkOS SDK
grep -E '"@workos-inc/(node|nextjs|react)"' package.json
```

If not found, install appropriate SDK:
- Node.js backend: `@workos-inc/node`
- Next.js: `@workos-inc/authkit-nextjs`
- React (client): `@workos-inc/react`

**Verify:** SDK package exists in node_modules before continuing.

## Step 3: Email Delivery Strategy (Decision Tree)

WorkOS offers three email delivery options. Choose based on requirements:

```
Email delivery strategy?
  |
  +-- A) WorkOS email domain (workos-mail.com)
  |     └--> Fastest setup, lowest customization
  |     └--> Go to Step 4A
  |
  +-- B) Your own email domain
  |     └--> Better UX, more control over deliverability
  |     └--> Requires DNS configuration
  |     └--> Go to Step 4B
  |
  +-- C) Send your own email (event-driven)
        └--> Maximum control, use your own provider
        └--> Requires webhook listener + email provider
        └--> Go to Step 4C
```

**Decision factors:**

- **Use A** if: Prototyping, internal tools, fast MVP
- **Use B** if: Production app, branded experience, domain reputation matters
- **Use C** if: Existing email infrastructure, need custom templates/logic, compliance requirements

## Step 4A: WorkOS Email Domain Setup

**This option requires no code changes.** WorkOS automatically sends emails from `workos-mail.com`.

### Anti-Spam Requirements (CRITICAL)

To prevent deliverability issues:

1. **Validate invitation sources** - Only send invitations when users explicitly request access
2. **No bulk imports** - Never send unsolicited invites from marketing lists
3. **Clean organization names** - Avoid [spam trigger words](https://mailtrap.io/blog/email-spam-words/) in:
   - WorkOS team name (dashboard settings)
   - Organization names (passed in API calls)

**Bad examples:** "FREE", "URGENT", "Click here", "$$$", "Limited time"

### Verification

Test email delivery with a sandbox invitation:

```bash
# Example: Send test magic auth email
curl https://api.workos.com/user_management/magic_auth/send \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check recipient inbox. If delivered, skip to Step 5.

## Step 4B: Your Own Email Domain Setup

### Dashboard Configuration

1. Navigate to: https://dashboard.workos.com/configuration/email
2. Click "Add Email Domain"
3. Enter your domain (e.g., `app.example.com`)

### DNS Configuration (BLOCKING)

**STOP. DNS changes required before WorkOS can send email.**

WorkOS dashboard will display 3 CNAME records. Add these to your DNS provider:

```
# 1. Domain verification
CNAME: <unique-id>.workos.<your-domain>
Target: verify.workos.com

# 2. SPF authentication (SendGrid)
CNAME: em<random>.<your-domain>
Target: u<id>.wl<id>.sendgrid.net

# 3. DKIM authentication (SendGrid)
CNAME: s1._domainkey.<your-domain>
Target: s1.domainkey.u<id>.wl<id>.sendgrid.net
```

**Verify DNS propagation:**

```bash
# Check verification record
dig CNAME <unique-id>.workos.<your-domain>

# Check SPF record
dig CNAME em<random>.<your-domain>

# Check DKIM record
dig CNAME s1._domainkey.<your-domain>
```

All three must resolve before proceeding. DNS propagation typically takes 5-60 minutes.

### Email Inbox Setup (REQUIRED)

WorkOS sends from two addresses on your domain:

- `welcome@<your-domain>` - Account invitations, welcome emails
- `access@<your-domain>` - Password resets, magic links

**Create actual inboxes for both addresses.** Email providers check if sender addresses are real. Missing inboxes trigger spam filters.

**Verify inboxes:**

```bash
# Test that inboxes are reachable
# Method depends on email provider - check admin panel for both addresses
```

### DMARC Configuration (HIGHLY RECOMMENDED)

Add DMARC policy to DNS to comply with [Google](https://support.google.com/a/answer/81126) / Yahoo / Apple requirements:

```
TXT Record
Name: _dmarc.<your-domain>
Content: v=DMARC1; p=reject; rua=mailto:dmarc@<your-domain>; pct=100; adkim=s; aspf=s
```

**Policy meanings:**

- `p=reject` - Reject emails failing authentication
- `p=quarantine` - Send to spam folder
- `p=none` - Monitor only (not recommended for production)

**Verify DMARC:**

```bash
dig TXT _dmarc.<your-domain>
```

### Dashboard Verification

Return to WorkOS dashboard. Once DNS records are verified:

- Status changes to "Verified" with green checkmark
- "Send test email" button becomes active

Click "Send test email" and confirm receipt.

## Step 4C: Custom Email Provider Setup

**This requires webhook listener and email provider integration.**

### Enable Event Webhooks

1. Navigate to: https://dashboard.workos.com/webhooks
2. Click "Add Endpoint"
3. Enter your webhook URL: `https://your-app.com/webhooks/workos`
4. Subscribe to email-related events:
   - `magic_auth.created`
   - `invitation.created`
   - `password_reset.created`

### Create Webhook Endpoint

**Signature verification pattern (CRITICAL for security):**

```typescript
// Example: Next.js API route
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('workos-signature');
  const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET;

  // CRITICAL: Verify signature before processing
  const event = workos.webhooks.verifyEvent({
    payload,
    signature,
    secret: webhookSecret,
  });

  // Route to email provider based on event type
  switch (event.event) {
    case 'magic_auth.created':
      await sendMagicAuthEmail(event.data);
      break;
    case 'invitation.created':
      await sendInvitationEmail(event.data);
      break;
    case 'password_reset.created':
      await sendPasswordResetEmail(event.data);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

**DO NOT skip signature verification** - webhooks are public URLs.

### Email Provider Integration

Choose your provider and implement send functions:

**SendGrid example:**

```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendMagicAuthEmail(data: MagicAuthData) {
  await sgMail.send({
    to: data.email,
    from: 'access@your-domain.com',
    subject: 'Sign in to your account',
    html: `<a href="${data.link}">Click here to sign in</a>`,
  });
}
```

**Other providers:** Mailgun, Postmark, AWS SES - follow provider SDK docs.

### Webhook Testing

Use WorkOS CLI or dashboard to trigger test events:

```bash
# Install WorkOS CLI
npm install -g @workos-inc/workos-cli

# Trigger test webhook
workos webhooks trigger magic_auth.created --endpoint https://your-app.com/webhooks/workos
```

**Verify webhook logs** - check your server logs for incoming POST requests.

## Step 5: Production Readiness Checklist

Run these commands to confirm setup. **All must pass:**

```bash
# 1. Check environment variables are set
[ -n "$WORKOS_API_KEY" ] && [ -n "$WORKOS_CLIENT_ID" ] && echo "PASS: Env vars set" || echo "FAIL: Missing env vars"

# 2. Check WorkOS SDK is installed
npm list @workos-inc/node @workos-inc/authkit-nextjs @workos-inc/react 2>/dev/null | grep -q workos && echo "PASS: SDK installed" || echo "FAIL: SDK missing"

# 3. If using custom domain (Option B), verify DNS
# dig CNAME <your-verification-record> | grep -q verify.workos.com && echo "PASS: DNS verified" || echo "FAIL: DNS not propagated"

# 4. If using webhooks (Option C), test endpoint reachability
# curl -X POST https://your-app.com/webhooks/workos -H "Content-Type: application/json" -d '{}' && echo "PASS: Webhook reachable" || echo "FAIL: Webhook unreachable"

# 5. Test email delivery (manual step)
# Use WorkOS dashboard "Send test email" or trigger real auth flow
```

**If any check fails,** revisit corresponding step before deploying.

## Error Recovery

### Email not delivered (all users affected)

**Root cause:** Domain reputation issue or DNS misconfiguration.

**Fixes:**

1. Check DNS records are correct and propagated (Step 4B)
2. Verify DMARC policy is set (Step 4B)
3. Confirm email addresses (`welcome@`, `access@`) have real inboxes
4. Review [Google Postmaster Tools](https://www.gmail.com/postmaster/) for domain reputation
5. Check [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/pm/) for delivery issues

### Email not delivered (specific users/domains)

**Root cause:** Recipient email provider settings or spam filters.

**Fixes:**

1. Ask users to check spam/junk folders
2. Ask users to whitelist sender domain
3. For corporate users: IT department may block external domains
4. Google Workspace users: Check if [Enhanced Pre-delivery Scanning](https://support.google.com/a/answer/7380368) is causing delays
5. Run spam test: https://www.warmy.io/free-tools/email-deliverability-test/

### Webhook signature verification fails (Option C)

**Root cause:** Incorrect secret or payload tampering.

**Fixes:**

1. Verify `WORKOS_WEBHOOK_SECRET` matches dashboard value
2. Check that you're passing raw request body to `verifyEvent()`, not parsed JSON
3. Confirm `workos-signature` header is present in logs
4. Use WorkOS CLI to test with known-good signature

### "Organization name contains spam keywords" warning

**Root cause:** Organization names in WorkOS dashboard contain spam triggers.

**Fixes:**

1. Navigate to: https://dashboard.workos.com/organizations
2. Edit organization names to remove spam words
3. Avoid: FREE, URGENT, LIMITED TIME, $$$, CLICK HERE, etc.
4. Test with [spam keyword checker](https://mailtrap.io/blog/email-spam-words/)

### DMARC policy too strict (emails rejected)

**Root cause:** `p=reject` policy before SPF/DKIM fully configured.

**Temporary fix:**

```
# Use monitoring mode during setup
v=DMARC1; p=none; rua=mailto:dmarc@<your-domain>
```

**Permanent fix after DNS verified:**

```
# Switch to enforcement mode
v=DMARC1; p=reject; rua=mailto:dmarc@<your-domain>; pct=100
```

### Email delayed (30+ minutes)

**Root cause:** Email provider pre-delivery scanning or greylisting.

**Fixes:**

1. No action needed - this is normal security behavior
2. For consistent delays: Contact WorkOS support with SPF/DKIM records
3. Check [Litmus deliverability test](https://www.litmus.com/email-testing) for issues

## Related Skills

- `workos-authkit-nextjs` - Authentication integration that uses email delivery
- `workos-user-management` - User invitation flows that trigger emails
