---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- generated -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Setup

Check environment variables exist:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify WorkOS SDK installed:
```bash
# One of these should exist
grep "@workos-inc/node" package.json
grep "workos" requirements.txt
grep "workos" Gemfile
```

### Stytch Access

Required credentials:
- `STYTCH_PROJECT_ID` 
- `STYTCH_SECRET`

**Password Migration:** If users sign in with passwords, contact Stytch support (support@stytch.com) BEFORE starting. Password hash export can take days to weeks.

## Step 3: Export Stytch Data

### Decision Tree: User Type

```
Stytch User Type?
  |
  +-- B2B Users --> Use Search Organizations + Search Members APIs (this skill)
  |
  +-- Consumer Users --> Use Stytch export utility: 
                         https://github.com/stytchauth/stytch-node-export-users
```

This skill covers B2B migration only.

### Export Organizations

API: `https://stytch.com/docs/b2b/api/search-organizations`

Rate limit: 100 requests/minute. Supports pagination for 1000+ records.

Create export script:
1. Install Stytch SDK if not present
2. Call Search Organizations with pagination
3. Save to `stytch-orgs.json`

**Verify:**
```bash
# Check export has data
jq 'length' stytch-orgs.json
# Should output number > 0
```

### Export Members

API: `https://stytch.com/docs/b2b/api/search-members`

For EACH organization from previous step:
1. Call Search Members with `organization_id`
2. Append to `stytch-members.json`

**Rate limit handling:** Add 600ms delay between requests (100/min = 1 per 600ms).

**Verify:**
```bash
# Check member count matches Stytch dashboard
jq 'length' stytch-members.json
```

### Export Passwords (BLOCKING if password auth enabled)

**If Stytch users sign in with passwords:**

1. Email support@stytch.com requesting password hash export
2. Specify hash format needed (WorkOS supports: scrypt, bcrypt, argon2)
3. Wait for export file (timeline varies - can be days)
4. **STOP MIGRATION** until password hashes received

Stytch uses `scrypt` algorithm. Verify export format when received.

## Step 4: Import Organizations to WorkOS

API: `/organizations` (Create Organization)

Mapping table:
```
Stytch Field              --> WorkOS Field
organization_name         --> name
email_allowed_domains[]   --> domainData[].domain
(set state to 'verified' for allowed domains)
```

**Domain state logic:**
- If domain was in Stytch `email_allowed_domains` --> `state: 'verified'`
- Otherwise --> `state: 'pending'` or omit

Create import script to loop through `stytch-orgs.json`:
1. For each org, call WorkOS Create Organization API
2. Store mapping: `stytch_org_id` -> `workos_org_id` in `org-mapping.json`
3. Handle API errors (rate limits, duplicates)

**Verify:**
```bash
# Count imported orgs
jq 'length' org-mapping.json
# Should match stytch-orgs.json count
```

Check WorkOS Dashboard: Organizations count matches export.

## Step 5: Import Users and Memberships

### Filter Members by Status

Decision tree for each member:
```
Member status?
  |
  +-- "active" --> Import user + create membership
  |
  +-- "invited" / "pending" --> (Optional) Send fresh WorkOS invitation
  |
  +-- other --> Skip (log for review)
```

Only import `active` members to avoid orphaned accounts.

### Import Users

API: `/user_management/users` (Create User)

**Name parsing logic:**
```
Stytch "name" field --> Split on space
  first word  --> firstName
  remaining   --> lastName (joined)
```

Mapping:
```
Stytch Field              --> WorkOS Field
email_address             --> email
email_address_verified    --> emailVerified
name (parsed)             --> firstName + lastName
```

**With passwords (if available):**
```
(from Stytch export)      --> passwordHash
"scrypt"                  --> passwordHashType
```

For each member in `stytch-members.json`:
1. Parse name into firstName/lastName
2. Call Create User API
3. Store mapping: `stytch_member_id` -> `workos_user_id` in `user-mapping.json`

**Verify user creation:**
```bash
# Check user import count
jq 'length' user-mapping.json
# Should match active member count from Stytch
```

### Create Organization Memberships

API: `/user_management/organization_memberships` (Create Organization Membership)

For each imported user:
1. Look up `workos_user_id` from user-mapping.json
2. Look up `workos_organization_id` from org-mapping.json using member's `organization_id`
3. Call Create Organization Membership API with both IDs

**Handle role mapping:**
- Stytch roles may not map 1:1 to WorkOS roles
- Default to `member` role if unclear
- Log role mismatches for manual review

**Verify memberships:**
```bash
# Count memberships via WorkOS API
# Should match user count (or more if users in multiple orgs)
```

Check WorkOS Dashboard: Organization member counts match Stytch.

## Step 6: Configure Authentication Methods

### Password Authentication

**If passwords were imported:**

In WorkOS Dashboard:
1. Navigate to Configuration → Authentication
2. Enable "Password" authentication
3. Configure password strength requirements
4. Save settings

**Test:** Attempt login with known Stytch credentials (use test account from Stytch export).

### Magic Auth (replaces Stytch Magic Links/Email OTP)

Stytch magic links → WorkOS Magic Auth codes (6-digit, 10-minute expiry)

In WorkOS Dashboard:
1. Navigate to Configuration → Authentication
2. Enable "Magic Auth"
3. Configure email template (optional)

**No code changes needed if migrating from Stytch Email OTP** (functionally identical).

### OAuth Providers

If Stytch users sign in with Google/Microsoft/GitHub:

In WorkOS Dashboard:
1. Navigate to Configuration → Authentication → OAuth
2. For each provider used in Stytch:
   - Click provider (Google, Microsoft, GitHub, etc.)
   - Enter OAuth client credentials
   - Save
3. Enable "Auto-linking by email" to match existing users

**Critical:** OAuth auto-linking requires email match between provider and WorkOS user record.

**Verify OAuth:**
```bash
# Check OAuth config exists
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/sso/connections | jq '.data[].type'
# Should include enabled OAuth types
```

## Step 7: Update Application Code

### Install WorkOS SDK

Detect language/framework from project:
```bash
# Node.js
npm install @workos-inc/node

# Python
pip install workos

# Ruby
bundle add workos
```

### Replace Stytch SDK Calls

Decision tree by auth method:
```
Auth method?
  |
  +-- Password --> Replace Stytch authenticate() with WorkOS signInWithPassword()
  |
  +-- Magic Link/OTP --> Replace with WorkOS Magic Auth flow
  |
  +-- OAuth --> Replace with WorkOS OAuth redirect URLs
  |
  +-- Session Management --> Replace Stytch sessions with WorkOS session handling
```

See WebFetched migration guide for language-specific code examples.

**Do not write authentication from scratch** - use WorkOS SDK functions.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Check all export files exist
ls stytch-orgs.json stytch-members.json org-mapping.json user-mapping.json

# 2. Verify import counts match
echo "Orgs: $(jq 'length' stytch-orgs.json) exported, $(jq 'length' org-mapping.json) imported"
echo "Users: $(jq 'map(select(.status == "active")) | length' stytch-members.json) active, $(jq 'length' user-mapping.json) imported"

# 3. Test API connectivity
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Should show imported org count

# 4. Test password authentication (if applicable)
# Use test account credentials from Stytch export to sign in via WorkOS

# 5. Verify application builds
npm run build  # or equivalent for your stack
```

**All checks must pass before marking migration complete.**

## Error Recovery

### "Organization already exists" during import

**Cause:** Duplicate organization names or domains.

**Fix:**
1. Check if organization was already imported (query WorkOS API by name)
2. If duplicate from previous run, use existing org ID
3. If legitimate duplicate, append identifier to name: `"Acme Corp (2)"`

### "Invalid password hash format"

**Cause:** Password hash from Stytch doesn't match WorkOS expected format for specified algorithm.

**Fix:**
1. Verify `passwordHashType` matches Stytch export algorithm (should be `scrypt`)
2. Check hash string format in Stytch export - may need encoding adjustment
3. Contact WorkOS support with hash sample if format unclear

### Users cannot sign in after migration

**Decision tree:**

```
Auth method?
  |
  +-- Password --> Check password hashes imported? (Step 3)
  |                 |
  |                 +-- No --> Passwords not imported, users need reset
  |                 +-- Yes --> Check passwordHashType matches Stytch algorithm
  |
  +-- OAuth --> Check provider enabled in Dashboard? (Step 6)
  |              Check user email matches OAuth provider email?
  |
  +-- Magic Auth --> Check Magic Auth enabled? (Step 6)
                     Check email delivery working?
```

### Rate limit errors during import

**Cause:** Exceeded WorkOS API rate limits (varies by plan).

**Fix:**
1. Add exponential backoff to import scripts
2. Reduce concurrent requests
3. Batch operations where possible
4. Contact WorkOS support for rate limit increase if needed

### Member count mismatch after import

**Cause:** Members in non-active status were not imported, or import script failed partway.

**Fix:**
1. Check filter logic only imports `status: 'active'` members
2. Verify `user-mapping.json` has entries for all active members
3. Re-run import for missing members (check for errors in logs)
4. Compare Dashboard counts to Stytch export counts for reconciliation

### OAuth auto-linking not working

**Cause:** Email mismatch between WorkOS user record and OAuth provider email.

**Fix:**
1. Verify `emailVerified: true` set during user import (Step 5)
2. Check OAuth provider returns email in claims
3. Confirm "Auto-link by email" enabled in Dashboard
4. Test with known user - check error message for specific mismatch

### Missing password hashes

**Cause:** Stytch support export not received or not included in import script.

**Fix:**
1. If export pending, wait for Stytch support response
2. If export received, verify format and run update script:
   ```typescript
   // Update existing users with password hashes
   await workos.userManagement.updateUser(userId, {
     passwordHash: stytchHash,
     passwordHashType: 'scrypt'
   });
   ```
3. Users without imported passwords must do password reset flow

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS AuthKit in Next.js
- `workos-sso-setup` - Configure SSO connections for enterprise customers
- `workos-user-management` - Manage users and organizations via WorkOS API
