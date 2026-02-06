---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- generated -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The migration guide is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/users` returns 200, not 401.

### Clerk Environment

You need ONE of these to export data:

- **Option A:** Active Clerk Backend API access (faster, self-service)
- **Option B:** Contact Clerk support for data export (slower, requires ticket)

**Decision:** Ask user which option they have access to before proceeding.

## Step 3: Export Clerk Data (Decision Tree)

```
Export method?
  |
  +-- Backend API Access
  |     |
  |     +-- Export users: Use Clerk Backend SDK getUser() + pagination
  |     |   Output: users.json with email_addresses, first_name, last_name, password_digest
  |     |
  |     +-- Export passwords: Use Clerk /users/:id endpoint to get password_digest
  |     |   Output: Include in users.json (bcrypt format)
  |     |
  |     +-- Export organizations: Use getOrganizationList() + pagination
  |     |   Output: orgs.json with organization data
  |     |
  |     +-- Export memberships: Use getOrganizationMembershipList() per org
  |         Output: memberships.json with user_id + org_id pairs
  |
  +-- Clerk Support
        |
        +-- Open ticket requesting CSV export
        +-- Wait for orgs.csv and users.csv
        +-- Convert CSV to JSON for processing
```

**Output format for processing:**

```json
{
  "users": [
    {
      "email_addresses": "john@example.com|john.doe@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "password_digest": "$2a$10$..." // bcrypt hash if available
    }
  ],
  "organizations": [...],
  "memberships": [...]
}
```

**CRITICAL:** Clerk `email_addresses` field uses pipe `|` separator for multiple emails. You MUST parse this.

## Step 4: Handle Multi-Email Users (BLOCKING)

**Problem:** Clerk allows multiple emails per user. WorkOS requires ONE primary email.

**Strategy:**

1. Split `email_addresses` on `|` character
2. **If multiple emails exist:** Use Clerk User API to fetch primary email flag
3. **If Clerk API unavailable:** Prompt user to choose email selection strategy:
   - Take first email (default)
   - Manual review via CSV output for multi-email users
   - Skip users with multiple emails (log for manual import)

**Code pattern for parsing:**

```javascript
const emails = user.email_addresses.split('|');
const primaryEmail = emails.length === 1 ? emails[0] : await fetchPrimaryFromClerk(user.id);
```

**Verification:** Log count of multi-email users before import starts.

## Step 5: Import Users to WorkOS

**Rate Limit Warning:** WorkOS user creation is rate-limited. Check `/reference/rate-limits` in docs.

**Implementation options:**

```
Import method?
  |
  +-- WorkOS Migration Tool (Recommended)
  |     |
  |     +-- Clone: git clone https://github.com/workos/migrate-clerk-users
  |     +-- Install: npm install
  |     +-- Configure: Set WORKOS_API_KEY in .env
  |     +-- Run: npm run import -- --users users.json
  |
  +-- Custom Script (API Direct)
        |
        +-- For each user in export:
              |
              +-- POST /users with:
                    email: parsed primary email
                    first_name: first_name
                    last_name: last_name
                    password_hash: password_digest (if exists)
                    password_hash_type: "bcrypt" (if password exists)
              |
              +-- Store mapping: clerk_user_id -> workos_user_id
              +-- Handle 429 rate limit: exponential backoff
```

**Field mapping:**

| Clerk Field         | WorkOS API Parameter  | Notes                          |
| ------------------- | --------------------- | ------------------------------ |
| `email_addresses`   | `email`               | Parse pipe-separated, pick one |
| `first_name`        | `first_name`          | Direct copy                    |
| `last_name`         | `last_name`           | Direct copy                    |
| `password_digest`   | `password_hash`       | Only if password exists        |
| N/A                 | `password_hash_type`  | Set to `"bcrypt"`              |

**CRITICAL:** Save Clerk→WorkOS user ID mapping to JSON file. You need this for organization memberships.

## Step 6: Configure Social Auth Providers

**If you have social auth users (Google, Microsoft, etc.):**

1. Go to WorkOS Dashboard → Authentication → Social Connections
2. For each provider Clerk used:
   - Click provider (e.g., Google OAuth)
   - Add OAuth client credentials (from provider console)
   - Set redirect URI to your app's callback URL
3. **Do NOT manually link users** — WorkOS auto-links by email on first sign-in

**Verification:**

```bash
# Check provider config exists in dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/authentication_methods | \
  jq '.data[] | select(.type == "GoogleOAuth")'
```

Expected: Provider object returned, not empty array.

## Step 7: Import Organizations

**Only proceed if you exported Clerk organizations in Step 3.**

For each organization in export:

```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organization Name",
    "domains": ["example.com"]  // if available from Clerk
  }'
```

**Store mapping:** `clerk_org_id -> workos_org_id` in `org_mapping.json`

**Rate limit handling:** Organizations have separate rate limits from users. Check docs for current limits.

## Step 8: Import Organization Memberships

**Prerequisites:** Steps 5 and 7 complete, with user and org mappings saved.

For each membership in export:

1. Look up `workos_user_id` from user mapping (Step 5)
2. Look up `workos_org_id` from org mapping (Step 7)
3. Create membership:

```bash
curl -X POST https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H...",
    "organization_id": "org_01H..."
  }'
```

**CRITICAL:** If user or org not found in mapping, log error but continue (don't fail entire import).

## Step 9: MFA User Communication

**BLOCKING:** You must notify users about MFA changes before they attempt login.

**Changes from Clerk:**

- **Clerk SMS MFA → WorkOS does NOT support SMS** (security reasons)
- Affected users MUST re-enroll using:
  - Email-based Magic Auth, OR
  - TOTP authenticator app (Google Authenticator, Authy, etc.)

**Communication checklist:**

- [ ] Identify users with SMS MFA from Clerk export
- [ ] Send email to affected users explaining:
  - SMS MFA will not work after migration
  - Instructions to set up TOTP or Magic Auth on first login
- [ ] Add banner to app during migration period
- [ ] Prepare support team for MFA setup questions

**Do NOT skip this step.** Silent MFA failures will lock users out.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration success:

```bash
# 1. Verify user import succeeded
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.data | length'
# Expected: Count matches your export (minus skipped users)

# 2. Verify organizations created
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'
# Expected: Count matches Clerk org export

# 3. Verify memberships created
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organization_memberships | jq '.data | length'
# Expected: Count matches Clerk membership export

# 4. Test password auth (if passwords imported)
# Attempt login with known test user credentials

# 5. Test social auth (if configured)
# Attempt Google/Microsoft login with known test user
```

**Manual verification:**

- [ ] Log in to WorkOS Dashboard and spot-check 5 random users
- [ ] Verify user profile data (name, email) matches Clerk
- [ ] Verify organization memberships are correct
- [ ] Test password reset flow for imported users
- [ ] Test MFA enrollment for new authenticator

## Error Recovery

### "User creation failed: email already exists"

**Cause:** User already imported, or duplicate in Clerk export.

**Fix:**

1. Check if user exists: `GET /users?email=user@example.com`
2. If exists with matching data, skip and continue
3. If data differs, use `PATCH /users/{id}` to update
4. Log duplicate count for review

### "Rate limit exceeded (429)"

**Cause:** Importing too fast.

**Fix:**

1. Implement exponential backoff: 1s, 2s, 4s, 8s delays
2. Reduce batch size (import 50 users, pause, repeat)
3. Check `/reference/rate-limits` for current tier limits
4. Consider requesting rate limit increase from WorkOS support

### "Invalid password hash format"

**Cause:** Password hash from Clerk doesn't match bcrypt format.

**Fix:**

1. Verify `password_digest` field exists and starts with `$2a$`, `$2b$`, or `$2y$`
2. If missing, skip password import for that user (they'll use password reset)
3. Do NOT try to re-hash passwords (you don't have plaintext)

### "Organization membership failed: user not found"

**Cause:** User ID mapping lookup failed or user import skipped.

**Fix:**

1. Check user mapping file for `clerk_user_id`
2. If missing, re-run user import for that specific user
3. If user intentionally skipped, document as manual import needed
4. Retry membership creation after user exists

### "Social auth user not auto-linking"

**Cause:** Email from OAuth provider doesn't match WorkOS user email.

**Fix:**

1. Verify OAuth provider returns email in token (check provider docs)
2. Check email matches EXACTLY (case-sensitive, no whitespace)
3. Ensure OAuth provider configured in WorkOS Dashboard
4. Test with `curl` to WorkOS auth endpoint to see error details

### Multi-email users cause import failures

**Cause:** Picked wrong email as primary, or email formatting issue.

**Fix:**

1. Use Clerk API to fetch actual primary email (most reliable)
2. If API unavailable, validate email format before import: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
3. Log all multi-email users to CSV for manual review
4. Consider asking user to manually specify primary email for critical accounts

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit after migration complete
- `workos-directory-sync` - Set up SSO/SCIM for migrated organizations
- `workos-organizations` - Manage organizations post-migration
