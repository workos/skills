---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for implementation details:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required secrets in `.env` or `.env.local`:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys exist and have correct prefixes before continuing.

### SDK Installation

Detect package manager, install WorkOS SDK:

```bash
# Detect and install
npm list @workos-inc/node || npm install @workos-inc/node
# OR
yarn list @workos-inc/node || yarn add @workos-inc/node
```

**Verify:** SDK package exists in node_modules before continuing.

### SSO Conflict Check (IMPORTANT)

**CRITICAL:** MFA API is NOT compatible with WorkOS SSO. If your app uses WorkOS SSO, use the Identity Provider's native MFA instead.

Check for SSO usage:

```bash
# Search for SSO imports/usage
grep -r "getAuthorizationUrl\|sso" --include="*.ts" --include="*.js" src/
```

If SSO is detected, STOP and use IdP MFA. Do not proceed with this skill.

## Step 3: Factor Type Selection (Decision Tree)

```
MFA Factor Type?
  |
  +-- TOTP (Authenticator App)
  |     |
  |     +-- User has Google Authenticator, Authy, etc.
  |     +-- Returns QR code + secret for enrollment
  |     +-- No expiration on challenges
  |
  +-- SMS (Text Message)
        |
        +-- User has valid mobile phone number
        +-- Returns 6-digit code via SMS
        +-- Challenges expire after 10 minutes
```

## Step 4: Enroll Authentication Factor

### For TOTP (Authenticator App)

Call SDK method to create TOTP factor:

```typescript
const factor = await workos.mfa.enrollFactor({
  type: "totp",
});
```

Response contains:

- `factor.id` - Persist this in your user model (required for future challenges)
- `factor.qr_code` - Base64 data URI for QR code display
- `factor.secret` - Alternative to QR code (user can type into authenticator)

**Display Pattern:**

```html
<!-- QR Code Display -->
<img src="{factor.qr_code}" alt="Scan with authenticator app" />

<!-- OR Manual Entry -->
<p>Secret: {factor.secret}</p>
```

### For SMS (Text Message)

Call SDK method with phone number:

```typescript
const factor = await workos.mfa.enrollFactor({
  type: "sms",
  phoneNumber: "+15555551234", // Must be E.164 format
});
```

**Phone Number Validation:**

- Format: E.164 (e.g., `+15555551234`, `+442071234567`)
- SDK will reject malformed numbers with error

Response contains:

- `factor.id` - Persist this in your user model (required for future challenges)

**CRITICAL:** Store `factor.id` in your database associated with the user. This ID is required for all future MFA challenges.

## Step 5: Challenge Flow (Sign-In)

### Create Challenge

After user enters username/password, create MFA challenge:

```typescript
const challenge = await workos.mfa.challengeFactor({
  authenticationFactorId: factor.id, // From enrollment step
});
```

Response contains:

- `challenge.id` - Use this for verification
- For SMS: Code is sent immediately to user's phone

### Verify Challenge

Prompt user for code, then verify:

```typescript
const verification = await workos.mfa.verifyChallenge({
  authenticationChallengeId: challenge.id,
  code: userInputCode, // 6-digit code from user
});

if (verification.valid) {
  // MFA passed - proceed with login
} else {
  // MFA failed - show error, allow retry
}
```

**Response Fields:**

- `verification.valid` - `true` if code correct, `false` otherwise
- `verification.challenge.id` - Challenge ID that was verified

## Step 6: UI Integration Pattern

### Enrollment Screen

```
1. User Settings > Security > Enable MFA
2. Choose factor type (TOTP or SMS)
3. Display QR code (TOTP) OR send SMS (SMS)
4. User enters code to confirm enrollment
5. Persist factor.id in user record
```

### Sign-In Screen

```
1. User enters username/password (standard flow)
2. After password validation:
   - Check if user has MFA enabled (factor.id exists)
   - If yes: Create challenge, show code input screen
   - If no: Complete sign-in normally
3. User enters MFA code
4. Verify challenge
5. Complete sign-in on success
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK is installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Check environment variables are set
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env .env.local 2>/dev/null || echo "FAIL: Env vars missing"

# 3. Check factor enrollment code exists
grep -r "enrollFactor" --include="*.ts" --include="*.js" src/ || echo "FAIL: No enrollment code"

# 4. Check challenge/verify code exists
grep -r "challengeFactor\|verifyChallenge" --include="*.ts" --include="*.js" src/ || echo "FAIL: No challenge/verify code"

# 5. Check factor ID persistence (database schema or model)
grep -r "factor.*id\|mfa.*factor" --include="*.ts" --include="*.prisma" --include="*.sql" . || echo "WARN: Factor ID persistence not detected"

# 6. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**If check #5 fails:** Ensure you're storing `factor.id` in your user model. This is required for future challenges.

## Error Recovery

### "Challenge already verified" (challenge_already_verified)

**Root Cause:** Each challenge can only be verified once.

**Fix:**

1. Do NOT reuse challenge IDs
2. Create new challenge for each verification attempt:

```typescript
// WRONG - reusing challenge ID
const challenge = await workos.mfa.challengeFactor({ ... });
await workos.mfa.verifyChallenge({ authenticationChallengeId: challenge.id, code: '123456' });
await workos.mfa.verifyChallenge({ authenticationChallengeId: challenge.id, code: '654321' }); // ERROR

// CORRECT - create new challenge for retry
const challenge1 = await workos.mfa.challengeFactor({ ... });
const result1 = await workos.mfa.verifyChallenge({ authenticationChallengeId: challenge1.id, code: '123456' });
if (!result1.valid) {
  const challenge2 = await workos.mfa.challengeFactor({ ... }); // New challenge
  const result2 = await workos.mfa.verifyChallenge({ authenticationChallengeId: challenge2.id, code: '654321' });
}
```

### "Challenge expired" (challenge_expired)

**Root Cause:** SMS challenges expire after 10 minutes.

**Fix:**

1. Check timestamp when user submits code
2. If >10 minutes since challenge creation, create new challenge:

```typescript
const challengeAge = Date.now() - challengeCreatedAt;
if (challengeAge > 10 * 60 * 1000) {
  // 10 minutes in milliseconds
  // Create new challenge instead of verifying old one
  const newChallenge = await workos.mfa.challengeFactor({
    authenticationFactorId: factor.id,
  });
  // Inform user new code was sent
}
```

3. TOTP challenges do NOT expire - this error only affects SMS

### "Invalid phone number" (invalid_phone_number)

**Root Cause:** Phone number not in E.164 format or invalid.

**Fix:**

1. Validate phone number before calling SDK:

```typescript
// Must start with + and country code
const e164Regex = /^\+[1-9]\d{1,14}$/;
if (!e164Regex.test(phoneNumber)) {
  throw new Error("Phone number must be in E.164 format (e.g., +15555551234)");
}
```

2. Common mistakes:
   - Missing `+` prefix
   - Including spaces or dashes: `+1 555-555-1234` (WRONG) vs `+15555551234` (CORRECT)
   - Missing country code: `5555551234` (WRONG) vs `+15555551234` (CORRECT)

### "Factor not found" (factor_not_found)

**Root Cause:** Using wrong `authenticationFactorId` or factor was deleted.

**Fix:**

1. Verify factor ID exists in database:

```bash
# Check user record has factor ID
psql -d yourdb -c "SELECT id, mfa_factor_id FROM users WHERE id = 'user_xyz';"
```

2. If NULL, user needs to re-enroll
3. If mismatch, fix ID in challenge call

### "Verification failed" (verification.valid = false)

**Root Cause:** User entered wrong code.

**Fix:**

1. Allow 3-5 retry attempts before locking
2. For SMS: Create new challenge after 2-3 failed attempts (new code)
3. For TOTP: Challenge persists, no need to recreate
4. Show clear error: "Invalid code. X attempts remaining."

### MFA not prompting during sign-in

**Root Cause:** Factor ID not checked after password validation.

**Fix:**

1. Add factor check in login flow:

```typescript
// After password validation
const user = await validatePassword(username, password);
if (user.mfaFactorId) {
  // Redirect to MFA challenge screen
  const challenge = await workos.mfa.challengeFactor({
    authenticationFactorId: user.mfaFactorId,
  });
  return redirectToMfaScreen(challenge.id);
}
// Else: Complete login normally
```

2. Ensure factor ID is stored in user model during enrollment

## Implementation Checklist

Before marking complete, verify:

- [ ] Factor enrollment UI implemented (TOTP or SMS)
- [ ] Factor ID persisted in user database model
- [ ] Sign-in flow checks for MFA before completing login
- [ ] Challenge creation happens after password validation
- [ ] Code verification with retry logic (max 3-5 attempts)
- [ ] New challenge created on "already verified" error
- [ ] Phone number validation for SMS (E.164 format)
- [ ] Challenge expiration handled (SMS only, 10 min)
- [ ] Success state proceeds to authenticated session
- [ ] All verification checklist commands pass

## Related Skills

- **workos-authkit-nextjs**: Primary authentication with AuthKit (can be combined with MFA)
- **workos-authkit-react**: Client-side auth patterns (can trigger MFA flow)
