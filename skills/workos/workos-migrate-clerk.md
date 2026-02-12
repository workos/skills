---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

This documentation is the source of truth for migration procedures. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Identify Migration Scope

Determine what data exists in Clerk:

```bash
# Use Clerk Backend SDK to audit what you have
# This determines which steps below are required

# Check user count
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/users?limit=1

# Check organization count
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/organizations?limit=1

# Check if organizations have memberships
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/organizations/{org_id}/memberships?limit=1
```

Based on results, create a migration checklist:

```
Data to migrate:
  |
  +-- Users with passwords? --> Export passwords (Step 3A)
  |
  +-- Users with social auth only? --> Skip password export (Step 3B)
  |
  +-- Organizations exist? --> Export orgs (Step 5)
  |
  +-- Users have org memberships? --> Export memberships (Step 6)
  |
  +-- Users with SMS MFA? --> Plan MFA migration (Step 7)
```

**CRITICAL:** Users with SMS-based MFA in Clerk CANNOT migrate their MFA directly — WorkOS does not support SMS for security reasons. Plan to notify these users they must re-enroll using TOTP or email-based Magic Auth.

## Step 3A: Export Password Hashes (If Applicable)

**Only required if:** Users authenticate with passwords (not just social auth).

Use Clerk Backend API to export user data WITH password hashes:

```bash
# Clerk provides password_digest field via API
# Export as CSV using Clerk's export endpoint
# Reference: https://clerk.com/changelog/2024-10-23-export-users
```

**Important:** Clerk uses `bcrypt` hashing algorithm. WorkOS supports bcrypt import — no rehashing needed.

Expected CSV fields:

- `email_addresses` (may contain multiple, pipe-separated)
- `first_name`
- `last_name`
- `password_digest` (bcrypt hash)

**Verify export before proceeding:**

```bash
# Check CSV has password_digest column
head -1 clerk_users.csv | grep "password_digest"

# Check hashes start with $2a$, $2b$, or $2y$ (bcrypt prefixes)
grep -E '\$2[aby]\$' clerk_users.csv | head -1
```

## Step 3B: Export Social Auth Users (If Applicable)

**Only required if:** Users authenticate via Google, Microsoft, or other OAuth providers.

Clerk social auth users can continue using the same providers after migration — WorkOS matches users by email address.

Export user list with provider information:

```bash
# Use Clerk Backend SDK to get users with OAuth identities
# No password export needed for these users
```

## Step 4: Choose Import Method

```
Import approach?
  |
  +-- < 10,000 users --> Use GitHub migration tool (Step 4A)
  |
  +-- > 10,000 users --> Use custom script with rate limiting (Step 4B)
```

## Step 4A: Import with GitHub Tool

WorkOS provides a ready-made import tool: `https://github.com/workos/migrate-clerk-users`

**Setup:**

```bash
git clone https://github.com/workos/migrate-clerk-users
cd migrate-clerk-users

# Configure environment
export WORKOS_API_KEY="sk_..."
export CLERK_DATA_FILE="path/to/clerk_users.csv"

# Run import
npm install
npm start
```

**Verify import progress:**

```bash
# Check WorkOS Dashboard for user count during import
# Tool should log success/failure for each user
```

## Step 4B: Import with Custom Script (Rate-Limited)

**Required for:** Large user bases, custom field mappings, or special requirements.

WorkOS rate limit: Check current limits via WebFetch docs at `/reference/rate-limits`.

### Field Mapping

| Clerk Field       | WorkOS API Parameter | Notes                       |
| ----------------- | -------------------- | --------------------------- |
| `email_addresses` | `email`              | See Step 4C for multi-email |
| `first_name`      | `first_name`         | Direct mapping              |
| `last_name`       | `last_name`          | Direct mapping              |
| `password_digest` | `password_hash`      | bcrypt hash                 |

**Password import parameters (if applicable):**

```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password_hash": "$2b$10$...", // from Clerk password_digest
  "password_hash_type": "bcrypt"
}
```

**Sample import script structure:**

```javascript
// Pseudocode - adapt to your language/SDK
const BATCH_SIZE = 50; // Adjust based on rate limits
const DELAY_MS = 1000; // Adjust based on rate limits

for (const batch of chunked(clerkUsers, BATCH_SIZE)) {
  await Promise.all(
    batch.map((user) =>
      workos.createUser({
        email: user.email_addresses.split("|")[0], // See Step 4C
        first_name: user.first_name,
        last_name: user.last_name,
        password_hash: user.password_digest,
        password_hash_type: "bcrypt",
      }),
    ),
  );
  await sleep(DELAY_MS);
}
```

## Step 4C: Handle Multi-Email Users (CRITICAL DECISION)

Clerk exports multiple emails pipe-separated: `john@example.com|john.doe@example.com`

**Problem:** WorkOS users have ONE primary email. Clerk export does NOT indicate which is primary.

**Decision tree:**

```
Multiple emails detected?
  |
  +-- Can query Clerk API for primary? --> Use Clerk API to fetch User object
  |                                         (https://clerk.com/docs/references/javascript/user/user#properties)
  |
  +-- Cannot query API? --> Use FIRST email in pipe-separated list
  |                         (Document assumption in migration log)
  |
  +-- Emails belong to different domains? --> Manual review required
                                              (May indicate org vs personal emails)
```

**If using Clerk API for primary email:**

```bash
# For each user with multiple emails
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/users/{user_id}

# Response includes primary_email_address_id
```

## Step 5: Create Organizations (If Applicable)

**Only required if:** Clerk organizations exist.

Clerk organizations map 1:1 to WorkOS organizations (both represent B2B customers).

### Export Organizations

```bash
# Use Clerk Backend SDK to paginate through all orgs
# Example using Clerk SDK:
const orgs = await clerkClient.organizations.getOrganizationList({ limit: 100 });
```

### Import to WorkOS

Use WorkOS Create Organization API for each Clerk org:

```javascript
// Map Clerk org --> WorkOS org
await workos.createOrganization({
  name: clerkOrg.name,
  // Add custom domains if relevant
  domains: clerkOrg.domains || [],
});
```

**Verify org creation:**

```bash
# Check WorkOS Dashboard shows correct org count
# Or via API:
curl -H "Authorization: Bearer sk_..." \
  https://api.workos.com/organizations?limit=1
```

## Step 6: Migrate Organization Memberships (If Applicable)

**Only required if:** Users belong to organizations.

### Export Memberships from Clerk

```bash
# For each organization, get member list
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/organizations/{org_id}/memberships
```

### Import to WorkOS

**CRITICAL:** User must exist in WorkOS before adding to organization.

```javascript
// For each membership:
await workos.createOrganizationMembership({
  user_id: workosUserId, // Mapped from Clerk user
  organization_id: workosOrgId, // Mapped from Clerk org
  role: membership.role, // Map Clerk roles to WorkOS roles
});
```

**Role mapping:**

Clerk roles may not match WorkOS roles. Define mapping:

```
Clerk role    --> WorkOS role
admin         --> admin
member        --> member
(custom role) --> (map to closest WorkOS equivalent)
```

## Step 7: Handle MFA Migration (IMPORTANT LIMITATION)

**CRITICAL:** WorkOS does NOT support SMS-based MFA due to security issues.

### Identify SMS MFA Users

```bash
# Check if Clerk users have SMS second factors
# Use Clerk API to list MFA methods per user
```

### Migration Plan

```
User has MFA?
  |
  +-- SMS-based MFA --> User MUST re-enroll in WorkOS using TOTP or email
  |                     (Send notification before migration)
  |
  +-- TOTP (authenticator app) --> May be re-enrollable via WorkOS MFA API
  |                                (Check fetched docs for TOTP migration)
  |
  +-- No MFA --> No action needed
```

**Pre-migration communication template:**

```
Subject: Action Required - Security Update

We're upgrading our authentication system. If you currently use SMS
for two-factor authentication, you'll need to set up a new method
(authenticator app or email) after [migration date].

Steps after migration:
1. Sign in with your password
2. Go to Security Settings
3. Enroll in MFA using authenticator app or email
```

Reference WorkOS MFA guide for enrollment: `/authkit/mfa` (check via WebFetch if needed).

## Step 8: Configure Social Auth Providers (If Applicable)

**Only required if:** Users sign in via Google, Microsoft, GitHub, etc.

WorkOS matches social auth users by email address — no manual linking needed.

### Provider Setup

For each social provider used in Clerk:

1. Check WorkOS integrations page: `https://workos.com/docs/integrations`
2. Configure provider client credentials in WorkOS Dashboard
3. Test sign-in flow with test user

**Example providers:**

- Google OAuth: `/integrations/google-oauth`
- Microsoft OAuth: `/integrations/microsoft-oauth`

**Verification:**

```bash
# Test social sign-in redirects to provider
# User signs in with Google/Microsoft
# WorkOS automatically matches user by email to migrated account
```

## Verification Checklist (ALL MUST PASS)

Run these checks post-migration:

```bash
# 1. User count matches
clerk_count=$(curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/users | jq '.total_count')
workos_count=$(curl -H "Authorization: Bearer sk_..." \
  https://api.workos.com/users | jq '.total_count')
echo "Clerk: $clerk_count, WorkOS: $workos_count"

# 2. Organization count matches (if applicable)
clerk_orgs=$(curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.com/v1/organizations | jq '.total_count')
workos_orgs=$(curl -H "Authorization: Bearer sk_..." \
  https://api.workos.com/organizations | jq '.total_count')
echo "Clerk orgs: $clerk_orgs, WorkOS orgs: $workos_orgs"

# 3. Sample user can sign in with password
# (Manual test in WorkOS AuthKit)

# 4. Sample user can sign in with social auth
# (Manual test with Google/Microsoft/etc.)

# 5. Sample user's org membership is correct
# (Check WorkOS Dashboard shows correct org association)
```

## Error Recovery

### "Rate limit exceeded" during import

**Cause:** Importing too many users too quickly.

**Fix:**

1. Check current rate limits via WebFetch: `https://workos.com/docs/reference/rate-limits`
2. Increase delay between batches
3. Reduce batch size
4. Consider using GitHub migration tool (has built-in rate limiting)

### "User already exists" error

**Cause:** Duplicate import or user already migrated.

**Fix:**

1. Check if user exists in WorkOS before creating: `GET /users?email={email}`
2. If user exists, skip creation or use Update User API instead
3. Log skipped users for audit trail

### "Invalid password hash" error

**Cause:** Password hash is not bcrypt or is malformed.

**Fix:**

1. Verify hash starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
2. Check Clerk export included `password_digest` field
3. If hash is missing, user may have social-auth-only account (no password import needed)

### Social auth user cannot sign in after migration

**Cause:** Provider not configured in WorkOS or email mismatch.

**Fix:**

1. Verify provider (Google, Microsoft, etc.) is configured in WorkOS Dashboard
2. Check provider's client ID/secret are correct
3. Verify user's email in WorkOS matches email from OAuth provider
4. Test OAuth flow returns email claim

### User's organization membership missing

**Cause:** Membership not imported or user created after membership API call.

**Fix:**

1. Verify user exists in WorkOS before creating membership
2. Re-run membership import for affected users
3. Check WorkOS Dashboard shows user in organization

### Multi-email user signs in with wrong email

**Cause:** Primary email detection failed, user used non-primary email.

**Fix:**

1. If user cannot sign in, they may need to use the email you chose as primary during migration
2. Consider adding secondary emails as verified email addresses (check WorkOS API for multi-email support)
3. Document which email was chosen for each multi-email user

### SMS MFA users locked out

**Cause:** SMS MFA not supported by WorkOS, user has not re-enrolled.

**Fix:**

1. User must reset MFA via account recovery flow
2. Send password reset link if needed
3. After sign-in, user must enroll in TOTP or email-based MFA
4. Reference WorkOS MFA guide: `/authkit/mfa`

## Related Skills

- workos-authkit-nextjs - Integrate WorkOS AuthKit in Next.js after migration
- workos-authkit-react - Integrate WorkOS AuthKit in React apps after migration
