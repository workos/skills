---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- generated -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs. They are the source of truth. If this skill conflicts with docs, follow docs.

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**If missing:** User must obtain from https://dashboard.workos.com/api-keys

### SDK Detection

Check if WorkOS SDK is already installed:

```bash
# Node.js
npm list @workos-inc/node 2>/dev/null | grep @workos-inc/node

# Python
pip show workos 2>/dev/null | grep Name

# Ruby
gem list workos 2>/dev/null | grep workos
```

If not found, proceed to Step 3. If found, skip to Step 4.

## Step 3: Install SDK

Detect package manager and install appropriate SDK:

```
Language/Framework?
  |
  +-- Node.js --> npm install @workos-inc/node
  |
  +-- Python --> pip install workos
  |
  +-- Ruby --> gem install workos
  |
  +-- Go --> go get github.com/workos/workos-go/v4
```

**Verify:** Re-run detection command from Step 2. Must pass before continuing.

## Step 4: MFA Type Decision (Decision Tree)

Determine which authentication factor type(s) to implement:

```
MFA Type?
  |
  +-- TOTP (Authenticator App)
  |     |
  |     +-- Use Case: Google Authenticator, Authy, 1Password
  |     +-- Returns: QR code (base64 data URI) + secret string
  |     +-- No expiry on challenges
  |
  +-- SMS (Text Message)
        |
        +-- Use Case: Phone number verification
        +-- Returns: 6-digit code via SMS
        +-- Challenge expires: 10 minutes
```

**Note:** You can implement both. Each user chooses their preferred method at enrollment.

## Step 5: Create Factor Enrollment Flow

### 5A: Initialize SDK Client

Create WorkOS client with API key:

```javascript
// Node.js example - adapt to your language
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### 5B: Enroll TOTP Factor (if selected)

**Endpoint pattern:** Call SDK's enroll method with type `totp`:

```javascript
const factor = await workos.mfa.enrollFactor({
  type: 'totp',
  totp_issuer: 'YourAppName',
  totp_user: user.email, // or username
});
```

**Critical response fields:**
- `factor.id` - **MUST persist in your user model** (needed for all future challenges)
- `factor.qr_code` - Base64 data URI for QR display (`<img src={qr_code}>`)
- `factor.secret` - Manual entry alternative to QR scan

**Display both:** Show QR code AND secret text. Some authenticator apps prefer manual entry.

### 5C: Enroll SMS Factor (if selected)

**Endpoint pattern:** Call SDK's enroll method with type `sms`:

```javascript
const factor = await workos.mfa.enrollFactor({
  type: 'sms',
  phone_number: '+15555551234', // E.164 format required
});
```

**Phone validation:** Must be valid E.164 format (`+[country_code][number]`). SDK returns error for invalid numbers.

**Critical response field:**
- `factor.id` - **MUST persist in your user model**

### 5D: Persist Factor ID (REQUIRED)

The `factor.id` is the permanent identifier for this authentication method. Store in your user model:

```
user_table schema:
  - mfa_factor_id (string, nullable)
  - mfa_factor_type (enum: 'totp', 'sms', nullable)
```

**Do NOT** lose this ID. You need it to create challenges at sign-in.

## Step 6: Create Challenge Flow (Sign-In Time)

When user attempts sign-in with MFA enabled:

```
Standard auth (username/password) passes?
  |
  +-- YES --> Check if user.mfa_factor_id exists?
  |             |
  |             +-- YES --> Create MFA challenge (Step 6A)
  |             |
  |             +-- NO --> Complete sign-in (no MFA)
  |
  +-- NO --> Reject sign-in (wrong password)
```

### 6A: Create Challenge

**Endpoint pattern:** Use the stored `factor.id`:

```javascript
const challenge = await workos.mfa.challengeFactor({
  authentication_factor_id: user.mfa_factor_id,
});
```

**Critical response field:**
- `challenge.id` - **Needed for verification step**

For SMS factors, this call triggers the SMS send. No SMS is sent for TOTP factors.

### 6B: Display Verification Prompt

**UI Requirements:**
- Input field for 6-digit code
- Clear label: "Enter code from authenticator app" (TOTP) or "Enter code from SMS" (SMS)
- Form submits to verification endpoint (Step 7)

**Timeout for SMS:** User has 10 minutes to enter code. After that, challenge expires.

## Step 7: Verify Challenge

When user submits verification code:

```javascript
const verification = await workos.mfa.verifyChallenge({
  authentication_challenge_id: challenge.id,
  code: userInputCode, // 6-digit string
});
```

**Response decision tree:**

```
verification.valid?
  |
  +-- true --> Grant session, redirect to dashboard
  |
  +-- false --> Show error, allow retry
                (max retries: check docs for rate limits)
```

**After successful verification:** Complete your application's session creation (JWT, cookie, etc.).

## Step 8: Build Sign-In Flow Modifications

Update existing sign-in endpoint to branch after password check:

```
POST /sign-in
  |
  1. Validate username/password
  2. Check if user.mfa_factor_id exists
  3. If yes:
     - Create challenge (Step 6A)
     - Return { requires_mfa: true, challenge_id }
     - Frontend shows verification prompt
  4. If no:
     - Create session immediately
     - Return { success: true, session_token }
```

**Frontend flow:**

```
Submit username/password
  |
  +-- Response: requires_mfa = true
  |     |
  |     +-- Show verification prompt (Step 6B)
  |     +-- Submit code --> POST /verify-mfa
  |           |
  |           +-- Success --> Redirect to dashboard
  |           +-- Failure --> Show error, allow retry
  |
  +-- Response: success = true
        |
        +-- Redirect to dashboard (no MFA)
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables are set
env | grep WORKOS_API_KEY || echo "FAIL: API key missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Client ID missing"

# 2. Verify SDK is installed (adapt to your language)
npm list @workos-inc/node 2>/dev/null | grep @workos-inc/node || echo "FAIL: SDK not installed"

# 3. Check database schema has MFA columns
# (Adjust table name and DB command to your setup)
psql -d yourdb -c "\d users" | grep mfa_factor_id || echo "FAIL: Missing mfa_factor_id column"

# 4. Test enrollment endpoint (adapt URL to your app)
curl -X POST http://localhost:3000/api/mfa/enroll \
  -H "Content-Type: application/json" \
  -d '{"type":"totp"}' | grep -q '"id"' && echo "PASS: Enrollment works" || echo "FAIL: Enrollment broken"

# 5. Application builds without errors
npm run build || echo "FAIL: Build errors"
```

**If any check fails:** Return to corresponding step and fix before proceeding.

## Error Recovery

### "Invalid phone number" (SMS enrollment)

**Root cause:** Phone number not in E.164 format.

**Fix pattern:**
1. Validate input matches `^\+[1-9]\d{1,14}$`
2. Common mistakes: Missing `+`, includes spaces/dashes, missing country code
3. Example valid: `+15555551234`, `+442071234567`

**Never** store phone numbers without `+` prefix.

### "Challenge already verified" (HTTP 400)

**Root cause:** Attempting to verify a challenge ID that was already successfully verified.

**Fix pattern:**
1. Each challenge is single-use only
2. If user needs to re-verify (e.g., token expired), create NEW challenge
3. Never reuse `challenge.id` values

**Code pattern:**

```javascript
// WRONG - reusing challenge ID
const challenge = await createChallenge(factorId);
await verifyChallenge(challenge.id, code1); // Success
await verifyChallenge(challenge.id, code2); // ERROR: already verified

// RIGHT - new challenge for each attempt
const challenge1 = await createChallenge(factorId);
await verifyChallenge(challenge1.id, code1); // Success

// Later, user needs to verify again
const challenge2 = await createChallenge(factorId); // New challenge
await verifyChallenge(challenge2.id, code2); // Success
```

### "Challenge expired" (SMS only)

**Root cause:** SMS challenges expire 10 minutes after creation.

**Fix pattern:**
1. Display countdown timer in UI: "Code expires in X minutes"
2. If expired, create NEW challenge (triggers new SMS)
3. TOTP challenges never expire

**User messaging:** "Your code has expired. Click here to send a new code."

### "Invalid code" (verification fails)

**Root cause:** User entered wrong 6-digit code.

**Fix pattern:**
1. Allow 3-5 retry attempts before lockout (check docs for rate limits)
2. For TOTP: Code changes every 30 seconds, user may need to wait for fresh code
3. For SMS: User may be reading old SMS, offer "resend code" option

**Do NOT** reveal whether code format was wrong vs. code value wrong (security).

### "Factor ID not found"

**Root cause:** The `authentication_factor_id` passed to challenge creation doesn't exist in WorkOS.

**Fix pattern:**
1. Check: `user.mfa_factor_id` was actually saved during enrollment
2. Check: User didn't delete their MFA setup in another session
3. Fail gracefully: Treat as "MFA not enrolled" and skip MFA step

### API Key Issues

**Symptom:** HTTP 401 responses from WorkOS API.

**Fix checklist:**
1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is for correct environment (test vs. production)
3. Confirm key hasn't been rotated in WorkOS dashboard
4. Ensure SDK is initialized with correct key

**Test:** Run this curl to validate key:

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/user_management/users
# Should return JSON, not 401
```

## Related Skills

- **workos-authkit-nextjs**: Full authentication including MFA via AuthKit (higher-level alternative)
- **workos-sso**: Enterprise SSO as primary authentication (use IdP's MFA instead of this API)
