---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- generated -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order. They are the source of truth:

1. `https://workos.com/docs/mfa/index`
2. `https://workos.com/docs/mfa/example-apps`
3. `https://workos.com/docs/mfa/ux/sign-in`
4. `https://workos.com/docs/mfa/ux/enrollment`

If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard (`https://dashboard.workos.com/`):

- Confirm API key exists and starts with `sk_`
- Confirm Client ID exists and starts with `client_`
- Note: MFA API is independent — does NOT require SSO configuration

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - API key from dashboard
- `WORKOS_CLIENT_ID` - Client ID from dashboard (required for some SDK methods)

**Critical:** Do NOT use MFA API with WorkOS SSO. If implementing SSO, use the Identity Provider's native MFA features instead.

## Step 3: SDK Installation

Detect language/framework from project:

```
Project type detection:
  |
  +-- package.json with "next" --> Node.js (npm/yarn/pnpm)
  |
  +-- requirements.txt or pyproject.toml --> Python (pip/poetry)
  |
  +-- Gemfile --> Ruby (bundle)
  |
  +-- go.mod --> Go (go get)
  |
  +-- *.csproj --> .NET (dotnet add)
```

Install SDK for detected language. See docs for package name (typically `@workos-inc/node`, `workos`, etc.).

**Verify:** SDK import succeeds before continuing.

## Step 4: Factor Type Selection (Decision Tree)

User chooses MFA method. Two supported types:

```
Which MFA factor?
  |
  +-- TOTP (Time-based OTP)
  |     |
  |     +-- User has authenticator app (Google Authenticator, Authy, 1Password, etc.)
  |     +-- Returns QR code + secret for enrollment
  |     +-- No expiration on challenges
  |     |
  |     --> Go to Step 5A
  |
  +-- SMS (Text message OTP)
        |
        +-- User has mobile phone
        +-- Phone number validation required
        +-- Challenges expire after 10 minutes
        |
        --> Go to Step 5B
```

## Step 5A: TOTP Enrollment Flow

### Create TOTP Factor

Call SDK method to enroll TOTP factor (exact method name in docs — typically `mfa.enrollFactor()` or similar).

**Response contains:**

- `id` - Factor ID (persist this in your user model)
- `qr_code` - Base64 data URI for QR code display
- `secret` - Manual entry code (fallback for QR scanning issues)

### Display QR Code

The `qr_code` is a data URI. Render it directly in an `<img>` tag:

```html
<img src="{qr_code}" alt="Scan with authenticator app" />
```

Also display the `secret` as text for manual entry option.

### Challenge Flow (Authentication)

1. User enters code from authenticator app (6 digits)
2. Create challenge: Call SDK method with `authentication_factor_id`
3. Response contains `challenge.id`
4. Verify challenge immediately: Call verify method with `challenge.id` and user's code
5. Check `valid` property in response

**Decision:**

```
valid === true?
  |
  +-- YES --> User authenticated, proceed to app
  |
  +-- NO  --> Show error, allow retry (challenge still active)
```

## Step 5B: SMS Enrollment Flow

### Create SMS Factor

Call SDK method to enroll SMS factor with phone number parameter.

**Phone number format:** Must be valid E.164 format (e.g., `+1234567890`).

**Response contains:**

- `id` - Factor ID (persist this in your user model)

### Challenge Flow (Authentication)

1. Create challenge: Call SDK method with `authentication_factor_id`
2. Response contains `challenge.id`
3. SMS sent automatically to enrolled phone
4. User enters code from SMS (6 digits)
5. Verify challenge: Call verify method with `challenge.id` and user's code
6. Check `valid` property in response

**Critical timing:** SMS challenges expire after 10 minutes. If expired, create new challenge.

**Decision:**

```
valid === true?
  |
  +-- YES --> User authenticated, proceed to app
  |
  +-- NO  --> Show error, allow retry (if challenge not expired)
```

## Step 6: Persistence Strategy

**REQUIRED:** Store factor ID in your user database.

Schema recommendation:

```
users table:
  - user_id (primary key)
  - email
  - password_hash
  - mfa_factor_id (nullable) --> Store WorkOS factor ID here
  - mfa_type (nullable) --> "totp" or "sms"
```

**Critical:** Factor IDs are permanent until explicitly deleted. Reuse same ID for subsequent challenges.

## Step 7: Sign-In UX Integration

Modify existing authentication flow:

```
Standard login flow:
  |
  +-- User enters username + password
  |
  +-- Verify credentials
  |
  +-- Check: user.mfa_factor_id exists?
        |
        +-- NO  --> Grant access (standard flow)
        |
        +-- YES --> Redirect to MFA verification screen
                     |
                     +-- Create challenge with stored factor ID
                     +-- User enters OTP code
                     +-- Verify challenge
                     +-- If valid === true, grant access
```

**UX note:** Show different UI for TOTP vs SMS:

- TOTP: "Enter code from authenticator app"
- SMS: "Enter code sent to ***-***-1234"

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node 2>/dev/null || \
pip show workos 2>/dev/null || \
bundle show workos 2>/dev/null || \
echo "FAIL: SDK not found"

# 2. Check environment variables set
env | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"

# 3. Check factor ID persistence (example for SQL)
echo "SELECT COUNT(*) FROM users WHERE mfa_factor_id IS NOT NULL;" | \
  sqlite3 your_database.db || echo "SKIP: Check your DB manually"

# 4. Test factor enrollment (manual)
curl -X POST https://api.workos.com/user_management/authentication_factors \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"totp"}' | grep '"id"' || echo "FAIL: API call failed"

# 5. Application builds/runs without errors
npm run build || yarn build || bundle exec rails server -e production || echo "FAIL: Build failed"
```

**Manual verification steps:**

1. Create test user account
2. Enroll MFA factor (scan QR or enter phone)
3. Log out, log back in
4. Verify MFA prompt appears
5. Complete MFA challenge successfully
6. Confirm access granted

## Error Recovery

### "Invalid phone number" (SMS enrollment)

**Root cause:** Phone number not in E.164 format.

**Fix:**

1. Strip all non-digit characters from user input
2. Prepend country code if missing (e.g., `+1` for US)
3. Validate format: `^\+[1-9]\d{1,14}$`

Example transformation: `(555) 123-4567` → `+15551234567`

### "Challenge already verified" (status 400)

**Root cause:** Attempting to verify a challenge that already returned `valid: true`.

**Fix:**

1. Do NOT reuse challenge IDs after successful verification
2. For each authentication attempt, create a NEW challenge
3. Pattern:

```
User clicks "Send code" --> Create challenge --> Get new challenge.id
User enters code       --> Verify with that challenge.id
User enters wrong code --> Create NEW challenge (don't retry old ID)
```

### "Challenge expired" (status 400, SMS only)

**Root cause:** SMS challenges expire after 10 minutes.

**Fix:**

1. Show user-friendly message: "Code expired. Request a new one."
2. Provide "Resend code" button
3. Button creates NEW challenge (do not retry expired challenge.id)
4. Reset input field when resending

### "Factor not found" (status 404)

**Root cause:** Stored `mfa_factor_id` does not exist in WorkOS (user may have deleted via different device).

**Fix:**

1. Clear the stored factor ID from user record
2. Show message: "MFA setup expired. Please set up again."
3. Redirect to enrollment flow
4. Re-enroll factor and persist new ID

### "Unauthorized" (status 401)

**Root cause:** Invalid or missing API key.

**Fix:**

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Verify key is from correct environment (test vs production)
3. Check WorkOS Dashboard for key validity
4. Regenerate key if compromised

### "verify method returns valid: false"

**Root cause:** User entered incorrect code or code expired (SMS).

**Fix:**

1. Show error: "Incorrect code. Please try again."
2. Allow retry with same challenge if not expired
3. After 3-5 failed attempts, create new challenge (rate limiting best practice)
4. For SMS: Check challenge age, create new challenge if > 9 minutes old

### QR code not displaying (TOTP)

**Root cause:** Data URI not rendered correctly.

**Fix:**

1. Verify `qr_code` field exists in API response
2. Check data URI format: `data:image/png;base64,...`
3. Use correct HTML: `<img src="${qr_code}" />`
4. If still failing, display `secret` as fallback: "Can't scan? Enter this code: {secret}"

### Build fails with SDK import errors

**Root cause:** SDK not installed or wrong import path.

**Fix:**

1. Re-run SDK installation command
2. Check docs for correct import statement (varies by language)
3. For TypeScript: Ensure `@types` package installed if needed
4. Clear node_modules and reinstall if corrupted

## Related Skills

- **workos-authkit-nextjs**: Full authentication system with MFA built-in
- **workos-sso**: Enterprise SSO (use IdP MFA, not this API)
