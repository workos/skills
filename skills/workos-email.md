---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Delivery Strategy (Decision Tree)

WorkOS offers three email delivery options. Choose based on your requirements:

```
Email delivery strategy?
  |
  +-- Quick start / POC
  |     --> (A) WorkOS email domain (workos-mail.com)
  |
  +-- Production / branded experience
  |     --> (B) Your email domain (your-domain.com)
  |
  +-- Custom provider / existing email infrastructure
        --> (C) Event-driven (WorkOS emits events, you send)
```

**Strategy A** is ready immediately but emails come from `workos-mail.com`.  
**Strategy B** requires DNS setup but emails come from your domain.  
**Strategy C** requires webhook handling and your own email provider integration.

## Step 3: Configure Email Domain (Strategy A or B)

### Strategy A: WorkOS Email Domain (Default)

No configuration needed. WorkOS sends from `workos-mail.com`.

**Skip to Step 4.**

### Strategy B: Your Email Domain (Recommended for Production)

Navigate to [WorkOS Dashboard → Email Settings](https://dashboard.workos.com).

#### 3.1: Add Domain

1. Enter your domain (e.g., `example.com`)
2. WorkOS generates three CNAME records:
   - Domain verification record
   - SPF/DKIM authentication record #1
   - SPF/DKIM authentication record #2

#### 3.2: Configure DNS Records

Add all three CNAME records with your DNS provider (Cloudflare, Route53, etc.):

```
Record Type: CNAME
Name: <value from dashboard>
Target: <value from dashboard>
TTL: 3600 (or default)
```

**Critical:** All three records are required. Missing authentication records will cause delivery failures.

#### 3.3: Verify Domain

Back in WorkOS dashboard, click "Verify Domain". DNS propagation can take 1-48 hours.

**Verification command:**

```bash
# Check if CNAME records are propagated
dig +short <name-from-dashboard> CNAME
```

Expected: Returns the target value from dashboard. If empty, DNS not propagated yet.

#### 3.4: Create Email Inboxes (REQUIRED)

WorkOS sends from these addresses when using your domain:

- `welcome@yourdomain.com` - For invitations, onboarding
- `access@yourdomain.com` - For password resets, Magic Auth

**Action required:** Create real inboxes for both addresses with your email provider. Email providers check if sender addresses have valid inboxes — missing inboxes trigger spam filters.

**Verification:**

```bash
# Test that inboxes exist by sending test emails
echo "Test" | mail -s "Inbox test" welcome@yourdomain.com
echo "Test" | mail -s "Inbox test" access@yourdomain.com
```

Check that both emails are received without bounce.

#### 3.5: Configure DMARC (REQUIRED for Gmail/Yahoo)

Google and Yahoo require DMARC for bulk senders. Add this TXT record to your DNS:

```
Record Type: TXT
Name: _dmarc.yourdomain.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com
TTL: 3600
```

**Policy options:**

- `p=none` - Monitor only (start here)
- `p=quarantine` - Mark suspicious emails as spam
- `p=reject` - Block emails failing DMARC (production setting)

**Start with `p=none`** to monitor reports before enforcing. After 1-2 weeks with no false positives, upgrade to `p=quarantine` or `p=reject`.

**Verification:**

```bash
dig +short _dmarc.yourdomain.com TXT
```

Expected: Returns the DMARC policy record.

## Step 4: Team and Organization Naming (CRITICAL)

Email content includes your WorkOS team name and organization names. Avoid [spam trigger words](https://mailtrap.io/blog/email-spam-words/) like:

- Financial terms: "free money", "cash bonus", "refinance"
- Urgency: "act now", "urgent", "limited time"
- Marketing: "click here", "buy now", "order now"

**Action:** Review team/org names in [WorkOS Dashboard](https://dashboard.workos.com):

```bash
# Check team name
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.[].name'
```

**If names contain spam words:** Rename in dashboard before sending email.

## Step 5: Anti-Spam Policy Enforcement (MANDATORY)

**CRITICAL:** Do NOT allow unsolicited email through WorkOS. This will blacklist your domain.

### Allowed use cases:

- User explicitly requested account access
- User requested password reset
- User requested Magic Auth login
- Admin invited specific user by email

### PROHIBITED use cases:

- Bulk invites from marketing lists
- Cold outreach campaigns
- Email verification for newsletter signups
- Any unsolicited contact

**Enforcement pattern:**

```typescript
// CORRECT - User-initiated action
async function sendInvitation(email: string, requestedByUserId: string) {
  // Verify requesting user has permission to invite
  if (!canInvite(requestedByUserId)) {
    throw new Error("Unauthorized");
  }

  // WorkOS sends invitation
  await workos.userManagement.inviteUser({ email });
}

// WRONG - Bulk invite from list
async function bulkInvite(emailList: string[]) {
  // DO NOT DO THIS - will trigger spam filters
  for (const email of emailList) {
    await workos.userManagement.inviteUser({ email });
  }
}
```

## Step 6: Event-Driven Email (Strategy C Only)

If you chose Strategy C in Step 2, configure webhooks to handle email events.

**Webhook setup:** See `workos-webhooks.rules.yml` for webhook endpoint implementation.

**Email events to handle:**

- `user.created` - Send welcome email
- `authentication.email_verification_succeeded` - Send confirmation
- `password_reset.created` - Send reset link

WorkOS emits the event with email parameters. Your app sends via your own provider (SendGrid, AWS SES, etc.).

## Verification Checklist (ALL MUST PASS)

Run these checks before considering email delivery configured:

```bash
# 1. Verify DNS records are propagated (Strategy B only)
dig +short _dmarc.yourdomain.com TXT
dig +short <verification-cname> CNAME
dig +short <auth-cname-1> CNAME
dig +short <auth-cname-2> CNAME

# 2. Check domain verification status (Strategy B only)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/email_domains | jq '.data[].verified'
# Expected: true

# 3. Test that sender inboxes exist (Strategy B only)
echo "Test" | mail -s "Test" welcome@yourdomain.com
echo "Test" | mail -s "Test" access@yourdomain.com
# Expected: Both received without bounce

# 4. Check team/org names for spam words
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | \
  jq -r '.[].name' | grep -iE "(free|cash|urgent|click here)"
# Expected: No matches (empty output)

# 5. Verify DMARC policy is active (Strategy B only)
dig +short _dmarc.yourdomain.com TXT | grep "v=DMARC1"
# Expected: Returns DMARC record
```

**If check #2 fails:** DNS propagation incomplete. Wait up to 48 hours and re-verify.  
**If check #3 fails:** Inboxes not created. Create them with your email provider.  
**If check #4 returns matches:** Rename organizations in dashboard.  
**If check #5 fails:** DMARC record missing or malformed. Fix DNS configuration.

## Error Recovery

### Emails not reaching users (ALL users affected)

**Root cause:** Domain reputation issue or missing DNS records.

**Diagnosis:**

```bash
# Check domain verification status
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/email_domains | jq '.data[]'
```

If `verified: false` → DNS records not propagated. Wait and re-verify.

**Fix for Strategy B:**

1. Use [Google Postmaster Tools](https://www.gmail.com/postmaster/) to check domain reputation
2. Use [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/pm/) for Outlook delivery
3. Verify all three CNAME records exist: `dig +short <name> CNAME`
4. Confirm DMARC policy is active: `dig +short _dmarc.yourdomain.com TXT`
5. Check that sender inboxes (`welcome@`, `access@`) exist and receive mail

If reputation is damaged, consider Strategy A (WorkOS domain) temporarily while fixing reputation.

### Emails not reaching users (SUBSET of users affected)

**Root cause:** Email provider-specific spam filters or corporate IT policies.

**Common culprits:**

- Google Workspace with Enhanced Pre-delivery Message Scanning enabled
- Microsoft 365 with aggressive spam filters
- Corporate firewalls blocking external email domains

**Diagnosis tools:**

- [Google Postmaster Tools](https://www.gmail.com/postmaster/) - For Gmail/Workspace
- [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/pm/) - For Outlook/M365
- [Litmus Email Testing](https://www.litmus.com/email-testing) - Cross-provider testing
- [Warmy.io Deliverability Test](https://www.warmy.io/free-tools/email-deliverability-test/) - Spam score

**Fix:**

1. Ask affected users to check spam/junk folders
2. Ask users to whitelist your domain in their email client
3. For corporate users, request IT whitelist your domain
4. Use diagnostic tools above to identify specific filter triggers

### "Domain verification failed"

**Root cause:** DNS CNAME records not propagated or incorrect.

**Fix:**

```bash
# Check each CNAME record
dig +short <verification-name> CNAME
dig +short <auth-name-1> CNAME
dig +short <auth-name-2> CNAME
```

If any return empty:

1. Verify record was added correctly in DNS provider (no typos)
2. Wait 1-4 hours for propagation (can take up to 48 hours)
3. Try flushing DNS cache: `sudo dscacheutil -flushcache` (macOS) or `ipconfig /flushdns` (Windows)
4. Check with alternative DNS: `dig @8.8.8.8 +short <name> CNAME`

### Emails delayed (hours not minutes)

**Root cause:** Email provider pre-delivery scanning or rate limiting.

Google Enhanced Pre-delivery Message Scanning can delay emails 1-2 hours while scanning for malware/spam.

**Fix:**

1. This is expected behavior for security-focused email providers
2. Cannot be bypassed — it's receiver-side setting
3. Consider showing users "Email may take up to 2 hours to arrive" message
4. Implement retry mechanism in your UI (e.g., "Resend verification email" button)

### DMARC policy causing rejections

**Root cause:** DMARC policy set to `p=reject` before validating legitimate traffic.

**Fix:**

1. Change DMARC policy to `p=none` temporarily:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com
   ```
2. Monitor DMARC reports for 1-2 weeks
3. Identify any false positives (legitimate emails failing DMARC)
4. Fix SPF/DKIM issues causing failures
5. Gradually increase policy: `p=none` → `p=quarantine` → `p=reject`

### Sender inbox missing/bouncing

**Root cause:** `welcome@` or `access@` email addresses not created.

**Fix:**

1. Create both inboxes with your email provider (Google Workspace, Microsoft 365, etc.)
2. Send test emails to verify they're working:
   ```bash
   echo "Test" | mail -s "Test" welcome@yourdomain.com
   echo "Test" | mail -s "Test" access@yourdomain.com
   ```
3. Check both inboxes receive the test emails
4. If bouncing, check MX records are configured: `dig +short yourdomain.com MX`

## Related Skills

- `workos-authkit-nextjs` - For implementing Magic Auth (uses email delivery)
- `workos-authkit-react` - For implementing Magic Auth in React apps
- `workos-directory-sync.rules.yml` - For org invitations (uses email delivery)
