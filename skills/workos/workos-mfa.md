---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

If this skill conflicts with fetched documentation, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check Dashboard at `https://dashboard.workos.com/`:

- Account exists and is accessible
- API keys are generated

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Critical:** MFA API is NOT intended for use with WorkOS SSO. If implementing SSO, use the Identity Provider's native MFA features instead.

### SDK Installation

Verify WorkOS SDK is installed:

```bash
# Check SDK exists in dependencies
grep -E '"@workos-inc/|workos"' package.json || \
grep -E 'workos' requirements.txt || \
grep -E 'workos' Gemfile || \
grep -E 'workos' pom.xml
```

If SDK is missing, install it now (detect package manager from fetched docs).

## Step 3: Factor Type Selection (Decision Tree)

```
User enrollment preference?
  |
  +-- Authenticator app (Google Auth, Authy, etc.)
  |     |
  |     +-- Use factor type: "totp"
  |     +-- Response includes: qr_code (base64 data URI), secret
  |     +-- Display QR code OR allow manual secret entry
  |
  +-- SMS/Text message
        |
        +-- Use factor type: "sms"
        +-- Requires: valid phone number (E.164 format recommended)
        +-- API will reject malformed/invalid numbers
```

## Step 4: Enroll Authentication Factor

Create an authentication factor via SDK. Check fetched docs for exact method signature.

**For TOTP:**

- Response contains `qr_code` (base64 data URI) and `secret`
- QR code: Display using data URI in `<img src="data:...">`
- Secret: Offer as alternative for manual entry into authenticator app

**For SMS:**

- Phone number must be valid E.164 format (e.g., `+14155552671`)
- API returns error for malformed numbers — validate client-side first

**CRITICAL:** Save the returned factor ID immediately. You MUST persist this ID in your user model — it's required for all future challenges.

**Persistence pattern:**

```
User record must store:
  - factor_id (from enrollment response)
  - factor_type ("totp" or "sms")
  - enrolled_at (timestamp)
```

## Step 5: Challenge Creation

When user attempts sign-in after successful primary auth (username/password):

1. Retrieve factor_id from your user model
2. Create a challenge for that factor via SDK
3. Challenge response includes challenge ID — save it for verification

**For TOTP:** User enters code from authenticator app

**For SMS:** SMS is sent automatically, user enters received code

## Step 6: Challenge Verification

Submit the user's code along with challenge ID to verification endpoint.

**Verification response:**

- `valid: true` → Challenge passed, user is authenticated
- `valid: false` → Code incorrect, allow retry (implement rate limiting)

**Store verification result** in session/token to gate protected resources.

## Step 7: Sign-In UX Implementation

After user enters username/password:

1. Check if user has enrolled MFA (factor_id exists in your DB)
2. If yes → Redirect to MFA verification screen
3. If no → Complete sign-in (or prompt enrollment if MFA is mandatory)

**MFA verification screen must:**

- Show input for 6-digit code (TOTP) or SMS code
- Display factor type to user ("Enter code from your authenticator app" vs "Enter code sent to **_-_**-1234")
- Handle "didn't receive code?" for SMS (implement resend with rate limiting)
- Allow fallback methods if user enrolled multiple factors

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env || echo "FAIL: Missing env vars"

# 2. Check SDK import exists in codebase
grep -r "workos" --include="*.{js,ts,py,rb,java}" src/ || echo "FAIL: No SDK imports"

# 3. Check factor persistence in data model
grep -r "factor_id" --include="*.{sql,prisma,rb,py,ts}" . || echo "WARN: Check factor_id persistence"

# 4. Test enrollment endpoint responds (replace URL with your app's endpoint)
curl -X POST http://localhost:3000/api/mfa/enroll -H "Content-Type: application/json" \
  -d '{"type":"totp"}' -w "\nStatus: %{http_code}\n"

# 5. Build succeeds
npm run build || bundle exec rake build || mvn compile
```

If check #3 fails, ensure your user model schema includes factor_id storage.

## Error Recovery

### "Already Verified" Error

**Cause:** Challenge was already successfully verified once.

**Fix:** Challenges are single-use. Create a NEW challenge for the next sign-in attempt. Do not reuse challenge IDs.

**Pattern:**

```
On each sign-in:
  1. Create NEW challenge
  2. Verify code against THAT challenge
  3. Discard challenge after verification
```

### "Expired" Error (SMS only)

**Cause:** SMS challenges expire after 10 minutes.

**Fix:**

1. Check challenge creation timestamp before verification
2. If > 10 minutes old, create a new challenge and resend SMS
3. Inform user: "Code expired. We've sent a new code."

**Rate limiting:** Prevent SMS spam by limiting resends to 1 per minute per user.

### "Invalid Phone Number" Error (SMS enrollment)

**Cause:** Phone number format is invalid or malformed.

**Fix:**

1. Validate phone number client-side BEFORE calling enrollment endpoint
2. Require E.164 format: `+[country code][number]` (e.g., `+14155552671`)
3. Use phone validation library (libphonenumber) to pre-validate

### "Challenge Not Found" Error

**Cause:** Challenge ID doesn't exist or was already verified.

**Fix:**

1. Check: Challenge ID stored correctly in session
2. Check: Not attempting to verify expired challenge
3. Create new challenge if needed

### Factor ID Not Persisted

**Cause:** Factor ID from enrollment response was not saved to database.

**Consequence:** Cannot create challenges for that user — they'll be stuck at enrollment forever.

**Fix:**

1. Immediately after enrollment API call succeeds, INSERT factor_id into user record
2. Use database transaction to ensure atomicity
3. Verify INSERT succeeded before showing "Enrollment complete" message

**Recovery:** User must re-enroll. Previous factor is orphaned but harmless.

### User Enrolled Multiple Factors (Edge Case)

**Scenario:** User enrolled both TOTP and SMS.

**UX decision tree:**

```
Multiple factors enrolled?
  |
  +-- Option A: Let user choose method at sign-in
  |     +-- "Verify with authenticator app" button
  |     +-- "Verify with SMS" button
  |
  +-- Option B: Enforce primary method
        +-- Verify with first enrolled factor
        +-- Offer "Use different method" fallback
```

Store multiple factor_ids with type field to support this.

## Related Skills

- **workos-user-management**: For primary authentication before MFA
- **workos-authkit-nextjs**: If using AuthKit, check whether to use AuthKit MFA or standalone MFA API
- **workos-authkit-react**: Same consideration for React apps
