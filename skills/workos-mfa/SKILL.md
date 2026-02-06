---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- generated -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest API details:
- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

Check WorkOS Dashboard (`https://dashboard.workos.com/`) for:
- API Key exists (starts with `sk_`)
- Client ID exists (starts with `client_`)

### Environment Variables

Check `.env` or `.env.local` for:
- `WORKOS_API_KEY` - Required for all MFA operations
- `WORKOS_CLIENT_ID` - Required for SDK initialization

**Verify:** Both values are non-empty and follow format from Dashboard.

### Project Structure

Confirm SDK package installed:
```bash
# Check package.json for WorkOS SDK
grep -i "workos" package.json || echo "FAIL: WorkOS SDK not installed"
```

If missing, detect package manager and install from docs.

## Step 3: MFA Factor Type Selection (Decision Tree)

```
What authentication method?
  |
  +-- TOTP (Authenticator App)
  |    |
  |    +-- Generate QR code for enrollment
  |    +-- Store factor ID in user model
  |    +-- Verify 6-digit codes
  |
  +-- SMS (Text Message)
       |
       +-- Validate phone number format
       +-- Send challenge via SMS
       +-- Verify 6-digit codes (10min expiry)
```

**Critical:** MFA API is NOT for use with WorkOS SSO. For SSO users, use the Identity Provider's native MFA features instead.

## Step 4: Enrollment Flow Implementation

### TOTP Enrollment Pattern

1. **Create Authentication Factor**
   - Call SDK method to create TOTP factor (check docs for exact method name)
   - Response contains: `id`, `qr_code` (base64 data URI), `secret`

2. **Display Enrollment UI**
   - Render QR code as image: `<img src="{qr_code}" />`
   - Show `secret` as fallback for manual entry
   - Prompt user to scan with authenticator app (Google Authenticator, Authy, etc.)

3. **Persist Factor ID**
   - **CRITICAL:** Save the factor `id` to your user model/database
   - This ID is required for all future challenge/verify operations
   - Do NOT save the secret — only the factor ID

### SMS Enrollment Pattern

1. **Validate Phone Number**
   - Check format before API call (E.164 recommended: +1234567890)
   - Invalid/malformed numbers will return API error

2. **Create Authentication Factor**
   - Call SDK method to create SMS factor with phone number
   - Response contains: `id`

3. **Persist Factor ID**
   - Save factor `id` to user model
   - Associate with user's account for sign-in flow

**Verify Enrollment:**
```bash
# Check that factor ID storage is implemented
grep -r "factor.*id\|authentication_factor" app/ src/ || echo "WARNING: Factor ID persistence not found"
```

## Step 5: Challenge Creation

**When to create challenge:** At sign-in time, AFTER primary authentication (username/password) succeeds.

### Flow Pattern

1. User enters username/password
2. Verify credentials against your auth system
3. If valid AND user has MFA enabled → Create challenge
4. Prompt user for verification code

### Create Challenge (Both TOTP and SMS)

Call SDK method with factor ID from Step 4. Check docs for exact syntax:
- Input: `authentication_factor_id` 
- Output: `challenge_id`, `expires_at` (SMS only)

**SMS-specific:** Challenge expires in 10 minutes. Save `challenge_id` in session.

**TOTP-specific:** Challenge does not expire but can only be verified once.

## Step 6: Code Verification

### Verification Flow

1. User enters 6-digit code from authenticator app or SMS
2. Call verify endpoint with:
   - `authentication_factor_id`
   - `challenge_id` (from Step 5)
   - `code` (user input)

3. Check response:
   - `valid: true` → Sign in user, create session
   - `valid: false` → Show error, allow retry

**Example verification check:**
```typescript
const result = await workos.mfa.verifyChallenge({
  authenticationFactorId: factorId,
  challengeId: challengeId,
  code: userCode
});

if (result.valid) {
  // Complete sign-in, set session
} else {
  // Show "Invalid code" error
}
```

## Step 7: Sign-In UX Modification

**CRITICAL:** Standard sign-in flow must change when user has MFA enabled.

### Modified Flow

```
1. Username/password screen (existing)
   ↓
2. [NEW] Verify credentials
   ↓
3. [NEW] Check if user has MFA factor
   |
   +-- No MFA   → Sign in normally
   |
   +-- Has MFA  → Show verification screen
                   ↓
                  Prompt for code
                   ↓
                  Verify challenge
                   ↓
                  Sign in if valid
```

### UI Implementation Checklist

- [ ] New screen/modal for MFA code entry
- [ ] Display factor type (TOTP vs SMS) to user
- [ ] "Resend code" button for SMS (creates new challenge)
- [ ] Error messages for invalid/expired codes
- [ ] Fallback recovery method (backup codes, support contact)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check WorkOS SDK installed
npm list | grep -i workos || yarn list | grep -i workos || echo "FAIL: SDK not found"

# 2. Check environment variables set
grep WORKOS_API_KEY .env* || echo "FAIL: Missing API key"
grep WORKOS_CLIENT_ID .env* || echo "FAIL: Missing Client ID"

# 3. Check factor ID persistence logic exists
grep -r "factor.*id\|authentication_factor" . --include="*.ts" --include="*.js" || echo "WARNING: No factor storage found"

# 4. Check challenge creation logic exists
grep -r "challenge" . --include="*.ts" --include="*.js" | grep -i "create\|generate" || echo "WARNING: No challenge creation found"

# 5. Build succeeds
npm run build || echo "FAIL: Build failed"
```

## Error Recovery

### "Invalid phone number" (SMS Enrollment)

**Root cause:** Phone number not in valid format or belongs to invalid region.

Fix:
1. Validate format before API call: E.164 (+country_code + number)
2. Strip spaces, dashes, parentheses
3. Confirm country code is supported (check docs)

Example validation:
```typescript
// CORRECT
phone = "+12125551234"

// WRONG
phone = "(212) 555-1234"
phone = "212-555-1234"
```

### "Challenge already verified" Error

**Root cause:** Attempted to verify a challenge that was already successfully used.

Fix:
1. **Never reuse challenge IDs** — each sign-in needs fresh challenge
2. Create new challenge after successful verification if additional verification needed
3. Clear challenge ID from session after verification

Pattern:
```typescript
// WRONG: Reusing challenge
const challenge = await createChallenge(factorId);
sessionStorage.set('challengeId', challenge.id); // Dangerous if kept long-term

// CORRECT: One-time use
const challenge = await createChallenge(factorId);
const result = await verifyChallenge(factorId, challenge.id, code);
if (result.valid) {
  sessionStorage.remove('challengeId'); // Clear immediately
}
```

### "Challenge expired" Error (SMS Only)

**Root cause:** User took longer than 10 minutes to enter SMS code.

Fix:
1. Display countdown timer on verification screen
2. Add "Resend code" button that creates new challenge
3. Clear old challenge ID before creating new one

Example resend flow:
```typescript
async function resendCode(factorId) {
  const newChallenge = await createChallenge(factorId);
  sessionStorage.set('challengeId', newChallenge.id);
  showMessage('New code sent');
}
```

### "Factor ID not found in user model"

**Root cause:** Factor ID was not persisted after enrollment (Step 4).

Fix:
1. Check database/user table has `mfa_factor_id` column or equivalent
2. Confirm enrollment code saves factor ID after creation
3. Add migration if column missing

Verification query:
```sql
-- Check if user has factor ID stored
SELECT mfa_factor_id FROM users WHERE id = ?;
```

### "Authentication factor not found" API Error

**Root cause:** Using wrong factor ID or factor was deleted from WorkOS.

Fix:
1. Confirm factor ID matches exactly from enrollment
2. Check Dashboard for factor existence
3. Re-enroll user if factor was deleted
4. Handle gracefully: prompt re-enrollment instead of error page

### Invalid Code Handling

**Root cause:** User entered wrong 6-digit code.

Best practices:
1. Allow 3-5 retry attempts before lockout
2. Show specific error: "Invalid code. X attempts remaining"
3. Track attempts in session, not just API response
4. After max attempts, require new challenge or temporary lockout

### QR Code Not Displaying (TOTP)

**Root cause:** QR code data URI not properly rendered or base64 decode issue.

Fix:
```typescript
// CORRECT: Direct data URI usage
<img src={factor.qr_code} alt="Scan with authenticator app" />

// If QR code doesn't show, check:
// 1. Response contains qr_code field
// 2. Value starts with "data:image/png;base64,"
// 3. No HTML escaping on the data URI
```

## Integration Patterns

### User Model Schema

Recommended fields for MFA support:

```typescript
interface User {
  id: string;
  email: string;
  // ... other fields
  
  // MFA fields
  mfa_enabled: boolean;
  mfa_factor_id: string | null;  // WorkOS factor ID
  mfa_factor_type: 'totp' | 'sms' | null;
  backup_codes?: string[];  // Optional: recovery codes
}
```

### Session Storage

Store during sign-in flow:
- `challenge_id` (temporary, clear after verification)
- `mfa_verified` (boolean flag for current session)
- `factor_type` (to display correct UI)

**Never store:** Actual codes, secrets, or QR code data.

## Testing Verification

### Manual Testing Flow

1. **Enroll Test Factor:**
   ```bash
   # Use test API key from Dashboard
   curl -X POST https://api.workos.com/mfa/factors \
     -H "Authorization: Bearer sk_test_..." \
     -d type=totp
   ```

2. **Verify Enrollment:**
   - TOTP: Use Google Authenticator with QR code or secret
   - SMS: Use test phone number (check docs for test numbers)

3. **Test Sign-In:**
   - Enter username/password
   - Verify MFA screen appears
   - Enter code from authenticator/SMS
   - Confirm sign-in completes

4. **Test Error Cases:**
   - Wrong code → Shows error, allows retry
   - Expired SMS → Shows "expired" message with resend option
   - Reused challenge → Gracefully handles, creates new challenge

### Automated Testing

```bash
# Check enrollment endpoint responds
curl -f http://localhost:3000/api/mfa/enroll || echo "FAIL: Enrollment endpoint broken"

# Check verification endpoint responds
curl -f http://localhost:3000/api/mfa/verify || echo "FAIL: Verify endpoint broken"

# Check sign-in flow includes MFA check
grep -r "mfa_factor_id\|authentication_factor" app/ src/ || echo "WARNING: MFA check not found in sign-in"
```

## Related Skills

- **workos-authkit-nextjs**: Full auth solution including MFA (alternative approach)
- **workos-sso**: For SSO users (use IdP's MFA, not WorkOS MFA API)
