---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for current API contracts and implementation patterns:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The fetched docs are the source of truth. If this skill conflicts with them, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check your environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** These values exist before making API calls. Missing keys will cause auth failures.

### SDK Installation

Detect package manager, install WorkOS SDK package:

```bash
# Verify installation
npm list @workos-inc/node || yarn list --pattern @workos-inc/node
```

**If not installed:** Install SDK before continuing. Exact package name is language-dependent - check fetched docs for your runtime.

## Step 3: Factor Type Selection (Decision Tree)

```
MFA factor type?
  |
  +-- TOTP (authenticator app)
  |     |
  |     +-- Returns: qr_code (base64 data URI) + secret
  |     +-- User scans QR or enters secret manually
  |     +-- Factor ID persisted to user model
  |
  +-- SMS (text message)
        |
        +-- Requires: valid phone number
        +-- Returns: factor ID
        +-- Factor ID persisted to user model
```

**Critical:** Phone number validation happens server-side. Malformed numbers return an error immediately.

## Step 4: Factor Enrollment

### For TOTP

WebFetch enrollment endpoint from docs (Step 1). Create factor with type `totp`.

Response structure (from docs):
- `qr_code` - Base64 data URI for display: `<img src="{qr_code}" />`
- `secret` - Manual entry alternative for authenticator apps
- `id` - **MUST persist this to your user model**

### For SMS

WebFetch enrollment endpoint from docs (Step 1). Create factor with type `sms` and user's phone number.

**Phone number format:** Check docs for accepted formats. Invalid/malformed numbers fail enrollment.

Response structure:
- `id` - **MUST persist this to your user model**

**Storage requirement:** Factor IDs are needed for future challenges. Do NOT proceed without persisting the ID.

## Step 5: Challenge Creation

When user signs in, create a challenge for their enrolled factor:

```
User sign-in flow:
  |
  1. Verify primary auth (username/password)
  |
  2. Fetch factor ID from user model
  |
  3. Create challenge for that factor
  |
  4. Present verification UI to user
```

WebFetch challenge creation endpoint from docs (Step 1). Use the persisted factor ID.

**For SMS factors:** Challenge expires in 10 minutes. After expiry, must create new challenge.

## Step 6: Challenge Verification

User submits code from authenticator app or SMS message.

WebFetch verification endpoint from docs (Step 1). Send challenge ID and user's code.

**Response interpretation:**

```json
{ "valid": true }  // Success - grant access
{ "valid": false } // Failure - show error, allow retry
```

**Do not implement:** Retry limits or lockout logic unless specified in your security requirements. The API does not enforce these.

## Step 7: Sign-In UX Integration

After primary auth succeeds, redirect to MFA verification screen:

```
Primary auth success?
  |
  +-- No factors enrolled --> Standard sign-in complete
  |
  +-- Factor enrolled --> Redirect to MFA verification page
                          |
                          +-- Display code entry form
                          +-- Submit to challenge verification endpoint
                          +-- If valid: complete sign-in
                          +-- If invalid: show error, allow retry
```

**UI consideration:** Check docs (Step 1, ux/sign-in) for recommended user messaging patterns.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm implementation:

```bash
# 1. Environment variables exist
env | grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID"

# 2. SDK package installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Factor ID persistence (example - adapt to your DB)
# Check your user model has a field for factor_id
grep -r "factor_id\|factorId\|mfa_factor" app/models/ || echo "WARNING: No factor ID field found"

# 4. Application builds
npm run build
```

**If check #3 fails:** Add factor ID storage to your user model. Without this, users cannot complete MFA on subsequent logins.

## Error Recovery

### "Already Verified" Error

**Root cause:** Attempting to verify a challenge that was already successfully verified.

**Fix:** Create a new challenge. Challenges are single-use only.

**Code location:** Challenge creation logic (Step 5).

### "Expired" Error (SMS only)

**Root cause:** Challenge is older than 10 minutes.

**Fix:** Create a new challenge and resend SMS.

**Prevention:** Display countdown timer in UI to indicate expiry.

**Code location:** Challenge creation logic (Step 5).

### "Invalid Phone Number" Error

**Root cause:** Phone number format rejected by WorkOS API.

**Fix:** 
1. Check docs (Step 1) for accepted phone number format
2. Add client-side validation before API call
3. Show clear error message with format example

**Code location:** Factor enrollment for SMS (Step 4).

### "Invalid Code" Error

**Root cause:** User entered wrong verification code.

**Fix:** 
1. Return `{ "valid": false }` to user
2. Allow retry without creating new challenge (unless expired)
3. Do NOT lock out after N attempts unless required by your security policy

**Code location:** Challenge verification (Step 6).

### "Factor ID Not Found"

**Root cause:** Factor ID not persisted to user model, or lookup failed.

**Fix:**
1. Verify factor ID was saved after enrollment (Step 4)
2. Check user model query logic
3. If factor truly missing, re-enroll user

**Code location:** Challenge creation (Step 5) - factor ID retrieval.

### Missing `qr_code` in Response

**Root cause:** Wrong factor type specified (used `sms` instead of `totp`).

**Fix:** Check factor type in enrollment request (Step 4). TOTP returns QR code, SMS does not.

## Integration Patterns

### With Existing Auth Systems

MFA API is composable - it does NOT replace your primary auth:

```
Your existing auth flow:
  |
  1. Verify username/password (YOUR CODE)
  |
  2. Check if user has MFA enrolled (YOUR DATABASE)
  |
  3. If enrolled: Create WorkOS MFA challenge --> Verify code --> Grant access
  |
  4. If not enrolled: Grant access (or require enrollment)
```

**Do not use:** WorkOS MFA with WorkOS SSO. SSO identity providers handle their own MFA. This API is for custom auth systems.

### Factor ID Storage

**Required fields in your user model:**
- `mfa_factor_id` (string, nullable) - WorkOS factor ID from enrollment
- `mfa_factor_type` (string, nullable) - "totp" or "sms" for UI decisions

**Optional fields:**
- `mfa_enrolled_at` (timestamp) - for auditing
- `mfa_phone_number` (string) - if using SMS, for re-enrollment

## Related Skills

- **workos-authkit-nextjs**: Full auth solution including MFA (use this instead for new Next.js apps)
- **workos-authkit-react**: Full auth solution including MFA (use this instead for new React apps)
- **workos-sso**: Single Sign-On (do NOT combine with this MFA API - SSO providers have their own MFA)
- **workos-api-authkit**: AuthKit API reference (higher-level alternative to this MFA API)
