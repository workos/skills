---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- generated -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The WorkOS migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Setup

Check environment variables:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify WorkOS SDK installed:
```bash
npm list @workos-inc/node || echo "SDK missing - run: npm install @workos-inc/node"
```

### Clerk Data Access

Determine export method:

```
Password users in Clerk?
  |
  +-- YES --> Contact Clerk support for password export
  |           (passwords not available via API)
  |
  +-- NO  --> Use Clerk Backend API directly
```

## Step 3: Export Users from Clerk (Decision Tree)

### Path A: Using Clerk Backend API

Install Clerk SDK if not present:
```bash
npm install @clerk/backend
```

Create export script `scripts/export-clerk-users.ts`:

```typescript
import { clerkClient } from '@clerk/backend';

async function exportUsers() {
  const users = await clerkClient.users.getUserList({ limit: 500 });
  // Paginate through all users
  // Store in JSON format for import
}
```

**Critical fields to capture:**
- `emailAddresses` (array)
- `primaryEmailAddressId` (to identify main email)
- `firstName`
- `lastName`
- `passwordDigest` (if available from support export)

### Path B: From Clerk Support CSV

If you received password export from Clerk support:
- File contains `password_digest` column with bcrypt hashes
- Email addresses may be pipe-separated: `email1@example.com|email2@example.com`

**Parse pipe-separated emails:**
```bash
# Example: Split emails and identify primary
awk -F',' '{split($2, emails, "|"); print emails[1]}' clerk_export.csv
```

## Step 4: Handle Multi-Email Users (CRITICAL)

Clerk users can have multiple emails. WorkOS users have ONE primary email.

**Decision logic:**

```
Multiple emails in Clerk export?
  |
  +-- YES --> Fetch User object from Clerk API
  |           to get primaryEmailAddressId
  |
  +-- NO  --> Use the single email directly
```

**Verification command:**
```bash
# Check for pipe characters in email column
grep -c '|' clerk_export.csv
```

If count > 0, you MUST resolve primary emails before import.

## Step 5: Import Users into WorkOS

### Rate Limit Awareness

WorkOS user creation is rate-limited. Check current limits:
WebFetch: `https://workos.com/docs/reference/rate-limits`

**Batch import pattern:**

```typescript
// scripts/import-to-workos.ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(clerkUser) {
  try {
    const user = await workos.users.create({
      email: clerkUser.primaryEmail,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      // If importing passwords:
      passwordHash: clerkUser.passwordDigest,
      passwordHashType: 'bcrypt',
    });
    console.log(`✓ Imported: ${user.email}`);
  } catch (error) {
    console.error(`✗ Failed: ${clerkUser.primaryEmail}`, error.message);
  }
}
```

### Field Mapping

| Clerk Source | WorkOS API Parameter |
|--------------|----------------------|
| `email_addresses[primary]` | `email` |
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `password_digest` | `passwordHash` |
| (constant: `bcrypt`) | `passwordHashType` |

**Verification after import:**
```bash
# Check import logs for failures
grep "✗ Failed" import.log | wc -l
```

If failures > 0, review error messages for rate limit or validation issues.

## Step 6: Migrate Social Auth Users

### Configure OAuth Providers in WorkOS

For each OAuth provider used in Clerk:

1. Navigate to WorkOS Dashboard → Authentication → Social Connections
2. Add provider credentials (client ID, client secret)
3. Note: WorkOS matches social auth users by **email address**

**Supported providers:**
- Google OAuth
- Microsoft OAuth
- GitHub OAuth
(Check WebFetched docs for full list)

**No code changes needed** - social auth users will auto-link on first sign-in if email matches a WorkOS user.

## Step 7: Migrate Organizations (Optional)

**Skip this step if you don't use Clerk organizations.**

### Export Clerk Organizations

```typescript
import { clerkClient } from '@clerk/backend';

async function exportOrganizations() {
  const orgs = await clerkClient.organizations.getOrganizationList({ limit: 500 });
  // Store org ID, name, and member list
}
```

### Create Organizations in WorkOS

```typescript
const org = await workos.organizations.create({
  name: clerkOrg.name,
  // Optional: map other fields
});
```

### Add Organization Memberships

For each Clerk membership, create WorkOS membership:

```typescript
await workos.organizationMemberships.create({
  organizationId: workosOrg.id,
  userId: workosUser.id,
  // Map role if applicable
});
```

**Verification:**
```bash
# Check membership creation logs
grep "Membership created" import.log | wc -l
```

## Step 8: Handle MFA Migration (BREAKING CHANGE)

**CRITICAL:** Clerk SMS-based MFA is NOT supported by WorkOS.

Users with SMS MFA must re-enroll using:
- TOTP authenticator apps (preferred)
- Email-based Magic Auth (fallback)

**Communication plan:**
1. Identify SMS MFA users in Clerk export
2. Send notification email before migration
3. Provide MFA enrollment instructions after migration

**Check for SMS MFA users:**
```bash
# If Clerk export includes MFA method column
grep -i "sms" clerk_export.csv | wc -l
```

If count > 0, prepare user communication.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Check import completion
[ -f import.log ] && tail -n 1 import.log | grep "Import complete"

# 2. Verify WorkOS user count matches Clerk export
wc -l clerk_export.csv  # Compare with WorkOS Dashboard user count

# 3. Test sample user login
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=test@example.com" \
  -d "password=testpass"

# 4. Check OAuth provider configuration
# (Manual check in WorkOS Dashboard - automation not available)

# 5. Verify organization memberships if migrated
# (Check WorkOS Dashboard - sample 3-5 orgs)
```

**If any check fails:** Review corresponding step before marking migration complete.

## Error Recovery

### "Rate limit exceeded" during user import

**Root cause:** Importing too fast.

**Fix:**
1. Add delay between requests: `await sleep(100)` (100ms)
2. Implement exponential backoff on 429 responses
3. Check rate limit docs for current limits

### "Email already exists" during user creation

**Root cause:** Duplicate emails in Clerk export or previous partial import.

**Fix:**
1. Check if user already exists in WorkOS before creating
2. Use update API instead: `workos.users.update(existingUserId, data)`
3. Deduplicate export file before import

### "Invalid password hash" error

**Root cause:** Password hash format mismatch or missing `passwordHashType`.

**Fix:**
1. Verify `passwordHashType: 'bcrypt'` is set
2. Check that `passwordDigest` from Clerk starts with `$2`
3. Do NOT try to re-hash - use raw digest from Clerk

### Social auth users cannot sign in after migration

**Root cause:** Email mismatch or provider not configured.

**Fix:**
1. Verify OAuth provider credentials in WorkOS Dashboard
2. Check that user email in WorkOS exactly matches OAuth provider email
3. Test OAuth flow with sample user before full migration

### Organization memberships not visible

**Root cause:** Membership created before organization or user exists.

**Fix:**
1. Verify import order: Users → Organizations → Memberships
2. Check that both `userId` and `organizationId` are valid WorkOS IDs
3. Retry membership creation with correct IDs

### "Authentication method not found" for MFA users

**Root cause:** Clerk SMS MFA cannot be migrated.

**Fix:**
1. User must re-enroll in MFA using TOTP or Magic Auth
2. Send enrollment instructions via email
3. Consider temporary MFA bypass for smooth transition (if business allows)

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS authentication
- `workos-sso-setup` - Configure enterprise SSO after migration
