---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

These docs are the source of truth. If this skill conflicts with docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Verify environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "MISSING"
```

Required format:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Source:** https://workos.com/docs/mfa/index

### Project Dependencies

Confirm WorkOS SDK is installed:

```bash
# Check if SDK exists in package.json or requirements.txt
grep -E "workos|@workos" package.json requirements.txt Gemfile pom.xml 2>/dev/null
```

If not found, install SDK for your language (see fetched docs for SDK installation).

## Step 3: Factor Type Selection (Decision Tree)

WorkOS MFA supports two factor types. Choose based on user preference:

```
Factor Type?
  |
  +-- TOTP (Authenticator App) --> Generates QR code for Google Authenticator, Authy, etc.
  |                                 |
  |                                 +-- Returns: qr_code (base64 data URI) + secret (manual entry)
  |
  +-- SMS (Text Message)        --> Sends OTP to phone number
                                    |
                                    +-- Requires: Valid phone number (E.164 format recommended)
```

**CRITICAL:** Do NOT use MFA API with WorkOS SSO. Use the Identity Provider's MFA instead.

**Source:** https://workos.com/docs/mfa/index

## Step 4: Enroll Authentication Factor

### For TOTP Enrollment

Call SDK method to create TOTP factor (exact method name in fetched docs):

```
Parameters: user identifier
Returns: 
  - factor_id (persist this in your user model)
  - qr_code (base64 data URI for display)
  - secret (manual entry alternative)
```

**Display Pattern:**
```html
<!-- QR code display - data URI format -->
<img src="{qr_code}" alt="Scan with authenticator app" />
<p>Or enter manually: {secret}</p>
```

### For SMS Enrollment

Call SDK method to create SMS factor (exact method name in fetched docs):

```
Parameters: phone_number (must be valid format)
Returns:
  - factor_id (persist this in your user model)
```

**Validation:** SDK will return error for malformed/invalid phone numbers. Validate format client-side first.

**CRITICAL:** Persist the returned `factor_id` in your user database. You will need it for verification challenges.

**Source:** https://workos.com/docs/mfa/index

## Step 5: Challenge Creation

When user attempts sign-in after primary authentication (username/password):

1. Retrieve user's persisted `factor_id` from your database
2. Create a challenge using SDK method (exact method name in fetched docs)
3. Return challenge to user based on factor type:
   - **TOTP:** Prompt user to enter code from authenticator app
   - **SMS:** Code is sent automatically to registered phone number

**SMS Challenge Expiry:** Challenges expire after 10 minutes. Must create new challenge if expired.

**Source:** https://workos.com/docs/mfa/index

## Step 6: Verify Challenge

Call SDK verification method with:
- `challenge_id` (from Step 5)
- `code` (user-entered OTP)

**Response Pattern:**

```
valid: true   --> Challenge verified, proceed with authentication
valid: false  --> Invalid code, allow retry (with rate limiting recommended)
```

**CRITICAL:** A successfully verified challenge CANNOT be reused. Create new challenge for next sign-in.

**Source:** https://workos.com/docs/mfa/index

## Step 7: Sign-In Flow Integration

Modify your existing authentication flow:

```
User enters credentials
  |
  +--> Primary auth valid?
         |
         +--> YES --> Check: MFA enrolled?
                        |
                        +--> YES --> Step 5: Create challenge
                        |            |
                        |            +--> Present verification UI
                        |            |
                        |            +--> Step 6: Verify code
                        |            |
                        |            +--> valid: true --> Grant access
                        |            |
                        |            +--> valid: false --> Retry (max 3-5 attempts)
                        |
                        +--> NO --> Grant access (no MFA)
         |
         +--> NO --> Reject
```

**UX Requirement:** After primary authentication succeeds, immediately show MFA verification screen. Do not redirect to application first.

**Source:** https://workos.com/docs/mfa/ux/sign-in

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables configured
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key configured" || echo "FAIL: API key missing or invalid format"

# 2. SDK installed and importable
# Node.js
node -e "require('@workos-inc/node')" 2>/dev/null && echo "PASS: SDK imported" || echo "FAIL: SDK not found"
# Python
python -c "import workos" 2>/dev/null && echo "PASS: SDK imported" || echo "FAIL: SDK not found"
# Ruby
ruby -e "require 'workos'" 2>/dev/null && echo "PASS: SDK imported" || echo "FAIL: SDK not found"

# 3. Database schema includes factor_id storage
# Check your user model/schema for factor_id field
grep -r "factor_id\|mfa_factor" models/ app/models/ src/models/ 2>/dev/null || echo "WARN: factor_id storage not found in models"

# 4. Application builds successfully
npm run build || yarn build || echo "Build check skipped"
```

## Error Recovery

### "Invalid phone number" during SMS enrollment

**Root cause:** Phone number format rejected by SMS provider.

**Fix:**
1. Validate phone number format before API call (E.164 recommended: +[country code][number])
2. Check if number is mobile (landlines cannot receive SMS)
3. Verify country code is supported (check WorkOS docs)

### "Challenge already verified" error

**Root cause:** Attempting to reuse a successfully verified challenge.

**Fix:**
1. **Never** cache challenge IDs for reuse
2. Create fresh challenge for each verification attempt
3. Pattern:
   ```
   Sign-in attempt --> Create challenge --> Verify --> Grant access
   Next sign-in    --> Create NEW challenge --> Verify --> Grant access
   ```

**Source:** https://workos.com/docs/mfa/index

### "Challenge expired" error

**Root cause:** SMS challenge is older than 10 minutes.

**Fix:**
1. Check challenge creation timestamp before prompting user
2. If >9 minutes old, create new challenge automatically
3. Show "Code expired, new code sent" message to user
4. Consider adding countdown timer in UI (10:00 → 0:00)

**Note:** TOTP challenges do not expire (they are time-synced with authenticator app).

**Source:** https://workos.com/docs/mfa/index

### "Authentication factor not found"

**Root cause:** `factor_id` not persisted or user record missing MFA data.

**Fix:**
1. Check database query returning user's `factor_id`
2. Verify enrollment flow successfully saved `factor_id` to user record
3. Check for column naming mismatch (factor_id vs mfa_factor_id vs authentication_factor_id)
4. If factor_id is null, redirect user to MFA enrollment flow

### SDK Import Errors

**Root cause:** SDK package not installed or wrong package name.

**Fix:**
1. Check package name in fetched documentation (varies by language)
2. Verify installation command completed successfully
3. Clear package cache if needed (npm cache clean, pip cache purge, etc.)
4. Check for version compatibility with your language/framework version

### Rate Limiting on Verification Attempts

**Root cause:** User made too many failed verification attempts.

**Recommended mitigation:**
1. Implement client-side rate limiting (max 3-5 attempts per challenge)
2. After max attempts, require new challenge creation
3. Consider adding exponential backoff or account lockout for security
4. Log failed attempts for monitoring/alerting

**Note:** WorkOS API may have its own rate limits (check fetched docs).

## Related Skills

- **workos-sso**: For primary authentication (do NOT combine MFA API with SSO - use IdP's MFA)
- **workos-authkit-nextjs**: If building auth UI in Next.js (AuthKit may include MFA flows)
