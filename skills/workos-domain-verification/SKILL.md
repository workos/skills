---
name: workos-domain-verification
description: Verify organization domains for SSO and directory sync.
---

<!-- generated -->

# WorkOS Domain Verification

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch the following docs — they are the source of truth:

- https://workos.com/docs/domain-verification/index
- https://workos.com/docs/domain-verification/api

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Verify WorkOS Setup

Check environment variables:

- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Critical:** Domain Verification requires an existing Organization. Do NOT proceed without one.

### Confirm Organization Exists

Run this to verify Organization is created:

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  grep -q "id" && echo "PASS: Org exists" || echo "FAIL: Create org first"
```

If FAIL: Use `workos-organizations` skill to create one.

### Verify SDK Installation

Check SDK is installed:

```bash
# Node.js
npm list @workos-inc/node || echo "FAIL: Install SDK"

# Python
pip show workos || echo "FAIL: Install SDK"

# Ruby
gem list workos || echo "FAIL: Install SDK"
```

## Step 3: Choose Implementation Path (Decision Tree)

```
Implementation approach?
  |
  +-- Self-serve (recommended) --> Use Admin Portal flow (Step 4)
  |                                Customer adds DNS TXT themselves
  |
  +-- Programmatic --> Use API flow (Step 5)
                       You manage DNS verification loop
```

**Self-serve is recommended** for production apps — customers verify their own domains through Admin Portal UI.

## Step 4: Self-Serve Flow (Admin Portal)

This flow gives IT admins a UI to add DNS TXT records themselves.

### 4A: Generate Admin Portal Link

Create a Portal Link for the Organization:

```javascript
// Node.js example
const { link } = await workos.portal.generateLink({
  organization: 'org_123',
  intent: 'domain_verification',
  return_url: 'https://yourapp.com/settings',
});
```

**Verify:** `link` starts with `https://id.workos.com/portal/launch?`

### 4B: Redirect Customer

Send the IT admin to the Portal Link. They will:

1. See their organization's existing domains (if any)
2. Click "Add Domain" to claim a new domain
3. Get DNS TXT record instructions specific to their domain
4. Add the TXT record to their DNS provider
5. Click "Verify" in the Portal

**Important:** Portal links expire after 5 minutes. Generate a new link each time.

### 4C: Monitor Verification Status

Poll domain verification status:

```bash
curl https://api.workos.com/organization_domains/$DOMAIN_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.verification_state'
```

**States:**

- `pending` - TXT record not found yet
- `verified` - Domain ownership confirmed
- `failed` - Verification failed (wrong TXT record or timeout)

You can also listen for `domain.verified` webhook events (recommended).

## Step 5: Programmatic Flow (API Direct)

Use this only if you need to manage the verification loop yourself.

### 5A: Create Organization Domain

```bash
curl -X POST https://api.workos.com/organization_domains \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "domain": "example.com"
  }'
```

**Expected response:**

```json
{
  "id": "org_domain_123",
  "domain": "example.com",
  "verification_state": "pending",
  "verification_token": "workos-verification-abc123xyz"
}
```

### 5B: Display Verification Instructions

Show the IT admin these exact instructions:

```
Add this DNS TXT record to example.com:

Name: _workos-challenge.example.com
Value: workos-verification-abc123xyz
TTL: 300 (or default)
```

**Critical:** The TXT record name MUST include `_workos-challenge.` prefix.

### 5C: Trigger Verification Attempt

After the IT admin confirms DNS is updated, trigger verification:

```bash
curl -X POST https://api.workos.com/organization_domains/$DOMAIN_ID/verify \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

WorkOS will query DNS and update `verification_state`.

### 5D: Poll Verification Status

```bash
# Check status every 10-30 seconds (don't hammer)
while true; do
  STATE=$(curl -s https://api.workos.com/organization_domains/$DOMAIN_ID \
    -H "Authorization: Bearer $WORKOS_API_KEY" | \
    jq -r '.verification_state')
  
  echo "Status: $STATE"
  [ "$STATE" = "verified" ] && break
  sleep 10
done
```

**Timeout:** If still `pending` after 5 minutes, DNS propagation may be slow. Check DNS with `dig`:

```bash
dig _workos-challenge.example.com TXT +short
```

Should return `"workos-verification-abc123xyz"`.

## Step 6: List Organization Domains

Get all domains for an organization:

```bash
curl "https://api.workos.com/organization_domains?organization_id=org_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Use this to show existing verified domains in your UI.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables set
[ -n "$WORKOS_API_KEY" ] && echo "PASS: API key set" || echo "FAIL: Missing WORKOS_API_KEY"

# 2. Organization exists
curl -s https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  grep -q '"id"' && echo "PASS: Org exists" || echo "FAIL: Create org first"

# 3. Can create organization domain
curl -X POST https://api.workos.com/organization_domains \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"org_test","domain":"test.example"}' 2>&1 | \
  grep -q '"verification_token"' && echo "PASS: API working" || echo "FAIL: Check API key"

# 4. SDK imports correctly (Node.js example)
node -e "const WorkOS = require('@workos-inc/node').WorkOS; console.log('PASS: SDK imports')" || echo "FAIL: Install SDK"
```

## Error Recovery

### "organization not found" on domain creation

**Root cause:** Organization ID is invalid or doesn't exist.

**Fix:**

1. List organizations: `curl https://api.workos.com/organizations -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Use correct `organization_id` from response
3. If no orgs exist, create one first (see `workos-organizations` skill)

### "domain already exists"

**Root cause:** Domain is already claimed by this or another organization.

**Fix:**

1. Check if domain belongs to your org: `curl https://api.workos.com/organization_domains?organization_id=org_123`
2. If it's yours, proceed to verification
3. If it's another org's, you cannot claim it — domains are globally unique

### Verification stays "pending" forever

**Root causes:**

1. TXT record not added to DNS
2. Wrong DNS record name (missing `_workos-challenge.` prefix)
3. Wrong TXT record value (typo in verification token)
4. DNS propagation delay (can take 5-60 minutes)

**Fix:**

```bash
# Check DNS actually has the record
dig _workos-challenge.example.com TXT +short

# Expected output:
# "workos-verification-abc123xyz"

# If missing or wrong:
# - Verify DNS provider settings
# - Wait for propagation (check with multiple DNS servers)
# - Re-check TXT record syntax
```

### "unauthorized" API errors

**Root cause:** API key is invalid or doesn't have permission.

**Fix:**

1. Check API key starts with `sk_` (not `pk_` — that's publishable key)
2. Verify key is for correct environment (test vs production)
3. Regenerate key in WorkOS Dashboard if needed

### Portal Link returns 404

**Root cause:** Link expired (5 minute TTL).

**Fix:** Generate a fresh Portal Link — never cache or reuse them.

### DNS verification fails after TXT record confirmed

**Root causes:**

1. TXT record has quotes when it shouldn't (some DNS providers auto-add)
2. Multiple TXT records with same name (DNS provider limitation)
3. TTL is too high causing old cached values

**Fix:**

```bash
# Check raw DNS response
dig _workos-challenge.example.com TXT

# Value should be EXACTLY:
# workos-verification-abc123xyz
# No extra quotes, no spaces, no other records
```

If your DNS provider adds quotes, some accept escaped format: `\"workos-verification-abc123xyz\"`. Check provider docs.

## Related Skills

- **workos-organizations** - Create organizations before adding domains
- **workos-sso** - SSO requires verified domains for security
- **workos-directory-sync** - Directory Sync requires verified domains
- **workos-admin-portal** - Portal Link generation patterns
