---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- generated -->

# WorkOS Migration: Clerk

## Step 1: Fetch Migration Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Inventory Current Clerk Setup

Run these checks to understand migration scope:

```bash
# Check if Clerk SDK is installed
grep -E '"@clerk/|clerk"' package.json

# List environment variables (do not commit output)
grep CLERK .env.local .env 2>/dev/null | wc -l

# Count components using Clerk hooks (rough estimate)
grep -r "useUser\|useAuth\|useOrganization" --include="*.tsx" --include="*.ts" . 2>/dev/null | wc -l
```

**Record these numbers:**
- Total Clerk users (check Clerk Dashboard)
- Users with passwords vs social auth (check Clerk Dashboard → Users → filter)
- Total organizations (if using Clerk Organizations feature)
- Whether MFA is enabled (Clerk Dashboard → User & Authentication → Multi-factor)

### WorkOS Environment Setup

Check `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` - valid callback URL
- `WORKOS_COOKIE_PASSWORD` - 32+ characters

If missing, create them in WorkOS Dashboard before continuing.

## Step 3: Export User Data from Clerk

### Password Export Decision Tree

```
Do users sign in with passwords?
  |
  +-- YES --> Request CSV export from Clerk Backend API
  |           (Includes password_digest field with bcrypt hashes)
  |
  +-- NO (social auth only) --> Skip to social auth export
```

### Export Methods (Choose One)

**Option A: Clerk Backend API (Recommended)**

Install Clerk Backend SDK if not already present:

```bash
npm install @clerk/backend
# or
pnpm add @clerk/backend
```

Create export script `scripts/export-clerk-users.ts`:

```typescript
import { clerkClient } from '@clerk/backend';
import fs from 'fs';

async function exportUsers() {
  const users = await clerkClient.users.getUserList({
    limit: 500, // Max per page
    // Add pagination logic for > 500 users
  });

  const exportData = users.data.map(user => ({
    id: user.id,
    email_addresses: user.emailAddresses.map(e => e.emailAddress).join('|'),
    primary_email: user.primaryEmailAddress?.emailAddress,
    first_name: user.firstName,
    last_name: user.lastName,
    created_at: user.createdAt,
  }));

  fs.writeFileSync('clerk-users.json', JSON.stringify(exportData, null, 2));
}

exportUsers();
```

**Option B: Contact Clerk Support**

If you need password hashes, email Clerk support requesting:
- User export with `password_digest` field
- Format: CSV or JSON
- Include organization memberships if applicable

**Wait for Clerk support response before Step 4.**

### Export Organizations (If Applicable)

If using Clerk Organizations:

```typescript
import { clerkClient } from '@clerk/backend';

async function exportOrganizations() {
  const orgs = await clerkClient.organizations.getOrganizationList({
    limit: 100,
  });

  // Get memberships for each org
  const orgsWithMembers = await Promise.all(
    orgs.data.map(async org => {
      const memberships = await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: org.id,
      });

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        members: memberships.data.map(m => ({
          userId: m.publicUserData.userId,
          role: m.role,
        })),
      };
    })
  );

  fs.writeFileSync('clerk-organizations.json', JSON.stringify(orgsWithMembers, null, 2));
}
```

**Verify exports exist before continuing:**

```bash
ls -lh clerk-users.json clerk-organizations.json 2>/dev/null
```

## Step 4: Import Users into WorkOS

### Rate Limit Planning

WorkOS user creation is rate-limited. Check current limits:

WebFetch: `https://workos.com/docs/reference/rate-limits`

**Calculate import time:**
- If rate limit is 100 req/min and you have 5000 users → ~50 minutes
- Plan accordingly (run overnight, use batching)

### Field Mapping (CRITICAL)

```
Clerk Field           --> WorkOS API Parameter
-----------------         ---------------------
email_addresses       --> email (primary email only)
first_name            --> first_name
last_name             --> last_name
password_digest       --> password_hash (if migrating passwords)
```

### Import Script Pattern

Create `scripts/import-to-workos.ts`:

```typescript
import { WorkOS } from '@workos-inc/node';
import clerkUsers from './clerk-users.json';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUsers() {
  for (const clerkUser of clerkUsers) {
    try {
      // Handle multiple email addresses - use primary or first
      const email = clerkUser.primary_email || clerkUser.email_addresses.split('|')[0];

      const payload: any = {
        email,
        first_name: clerkUser.first_name,
        last_name: clerkUser.last_name,
        email_verified: true, // Clerk users are already verified
      };

      // Add password hash if present
      if (clerkUser.password_digest) {
        payload.password_hash = clerkUser.password_digest;
        payload.password_hash_type = 'bcrypt'; // Clerk uses bcrypt
      }

      const workosUser = await workos.userManagement.createUser(payload);
      console.log(`Imported: ${email} -> ${workosUser.id}`);

      // Rate limit handling - sleep 600ms between requests if limit is 100/min
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (error) {
      console.error(`Failed to import ${clerkUser.email_addresses}:`, error);
      // Log failures to separate file for retry
    }
  }
}

importUsers();
```

**Run with monitoring:**

```bash
# Dry run first (comment out actual API calls)
npx tsx scripts/import-to-workos.ts | tee import.log

# Check for errors
grep "Failed to import" import.log | wc -l
```

### Multiple Email Handling

If Clerk export shows pipe-separated emails (`john@example.com|john.doe@example.com`):

1. **Option A (Recommended):** Fetch primary email from Clerk API:
   ```typescript
   const user = await clerkClient.users.getUser(clerkUser.id);
   const primaryEmail = user.primaryEmailAddress?.emailAddress;
   ```

2. **Option B:** Use first email in pipe-separated list (less reliable)

**Do NOT** import duplicate users with different emails. WorkOS uses email as unique identifier.

## Step 5: Configure Social Auth Providers

### Provider Inventory

Check which Clerk social providers are active:

```bash
# In Clerk Dashboard, go to:
# User & Authentication → Social Connections
# Note which providers are enabled
```

### WorkOS Provider Setup

For each active Clerk provider, configure in WorkOS Dashboard:

```
Provider --> WorkOS Integration Page
--------     -----------------------
Google   --> https://workos.com/docs/integrations/google-oauth
Microsoft --> https://workos.com/docs/integrations/microsoft-oauth
GitHub   --> https://workos.com/docs/integrations/github-oauth
```

**Critical:** Use the SAME client IDs/secrets, or users will not auto-link.

**Auto-linking mechanism:** WorkOS matches users by email address from the social provider. No code changes needed.

### Verification Command

Test social auth after setup:

```bash
# Start dev server
npm run dev

# In browser, test sign-in with each provider
# User should be recognized if email matches imported user
```

## Step 6: Import Organizations (If Applicable)

Skip this step if you did not use Clerk Organizations.

### Organization Creation

```typescript
import { WorkOS } from '@workos-inc/node';
import clerkOrgs from './clerk-organizations.json';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importOrganizations() {
  const orgMapping = new Map(); // Clerk ID -> WorkOS ID

  for (const clerkOrg of clerkOrgs) {
    try {
      const workosOrg = await workos.organizations.createOrganization({
        name: clerkOrg.name,
        // Optional: Set custom domain if available
        domains: clerkOrg.slug ? [`${clerkOrg.slug}.example.com`] : [],
      });

      orgMapping.set(clerkOrg.id, workosOrg.id);
      console.log(`Created org: ${clerkOrg.name} -> ${workosOrg.id}`);
    } catch (error) {
      console.error(`Failed to create org ${clerkOrg.name}:`, error);
    }
  }

  // Save mapping for next step
  fs.writeFileSync('org-mapping.json', JSON.stringify(Array.from(orgMapping.entries())));
}
```

### Add Organization Memberships

```typescript
async function importMemberships() {
  const orgMapping = new Map(JSON.parse(fs.readFileSync('org-mapping.json')));
  const userMapping = new Map(JSON.parse(fs.readFileSync('user-mapping.json'))); // From Step 4

  for (const clerkOrg of clerkOrgs) {
    const workosOrgId = orgMapping.get(clerkOrg.id);

    for (const member of clerkOrg.members) {
      const workosUserId = userMapping.get(member.userId);

      if (!workosUserId) {
        console.warn(`User ${member.userId} not found in mapping`);
        continue;
      }

      try {
        await workos.userManagement.createOrganizationMembership({
          userId: workosUserId,
          organizationId: workosOrgId,
          roleSlug: member.role === 'admin' ? 'admin' : 'member',
        });
      } catch (error) {
        console.error(`Failed to add ${workosUserId} to org ${workosOrgId}:`, error);
      }
    }
  }
}
```

## Step 7: Handle MFA Migration

### MFA Method Decision Tree

```
Clerk MFA method?
  |
  +-- TOTP (authenticator app) --> Users keep existing TOTP tokens
  |                                 (WorkOS uses same TOTP standard)
  |
  +-- SMS --> UNSUPPORTED by WorkOS
  |           Users must re-enroll using:
  |           - Email-based Magic Auth, OR
  |           - TOTP authenticator app
  |
  +-- Backup codes --> Users must generate new codes in WorkOS
```

### User Communication (CRITICAL)

If ANY users have SMS-based MFA, send email BEFORE migration:

**Subject:** Action Required: Update Two-Factor Authentication

**Body:**
```
We're upgrading our authentication system. If you currently use SMS for
two-factor authentication, you'll need to set up a new method after [DATE]:

Option 1: Authenticator app (Google Authenticator, Authy, 1Password, etc.)
Option 2: Email-based magic links

SMS verification will no longer be available due to security improvements.
```

### Enable MFA in WorkOS Dashboard

Navigate to: Settings → Authentication → Multi-factor Authentication

- Enable TOTP
- Enable Email Magic Auth (optional fallback)
- Set MFA enforcement policy (optional, recommended, required)

## Step 8: Replace Clerk SDK with WorkOS

**See related skill:** `workos-authkit-nextjs` for full integration steps.

Quick reference for common replacements:

```typescript
// Clerk                          // WorkOS
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';
                                  import { useAuth } from '@workos-inc/authkit-nextjs/components';

const { user } = useUser();       const { user } = useAuth();
const { signOut } = useAuth();    // Use signOut from WorkOS SDK

<SignInButton />                  // Use WorkOS AuthKit UI components
```

**Important:** Do not remove Clerk SDK until ALL users are migrated and tested.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Check user import success rate
grep "Imported:" import.log | wc -l
grep "Failed to import" import.log | wc -l

# 2. Verify WorkOS users exist
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'

# 3. Test social auth (manual)
# - Sign in with Google using a migrated user's email
# - Should NOT create duplicate user

# 4. Check organization memberships (if applicable)
curl -X GET "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'

# 5. Verify MFA settings
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[].mfa_factors'
```

**Success criteria:**
- Import success rate > 99%
- Social auth users can sign in without re-registering
- No duplicate users created
- Organization memberships match Clerk counts (if applicable)

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in Clerk export or previous import run.

**Fix:**
```typescript
// Add to import script
try {
  const existingUser = await workos.userManagement.listUsers({
    email: email,
  });

  if (existingUser.data.length > 0) {
    console.log(`Skipping existing user: ${email}`);
    continue;
  }
} catch (error) {
  // Proceed with creation
}
```

### Rate limit exceeded (429 errors)

**Root cause:** Importing too fast.

**Fix:**
```typescript
// Increase sleep time between requests
await new Promise(resolve => setTimeout(resolve, 1200)); // 50 req/min
```

Or use WorkOS batch import tool from GitHub: `https://github.com/workos/migrate-clerk-users`

### Social auth creates duplicate users

**Root cause:** Provider email doesn't match imported user email.

**Fix:**
1. Check Clerk provider returns verified email addresses
2. Verify WorkOS provider config uses same client credentials
3. Manually merge users via WorkOS Dashboard or API

### Password hashes not imported

**Root cause:** Missing `password_hash_type` parameter.

**Fix:**
```typescript
// Must specify hash type explicitly
payload.password_hash = clerkUser.password_digest;
payload.password_hash_type = 'bcrypt'; // Clerk uses bcrypt
```

### MFA users locked out

**Root cause:** SMS-based MFA not supported by WorkOS.

**Fix:**
1. Temporarily disable MFA requirement in WorkOS Dashboard
2. Email affected users with re-enrollment instructions
3. Re-enable MFA requirement after users re-enroll

### Missing primary email in Clerk export

**Root cause:** Clerk CSV export doesn't include primary email flag.

**Fix:**
```typescript
// Fetch primary email from Clerk API
const clerkUserDetail = await clerkClient.users.getUser(clerkUser.id);
const primaryEmail = clerkUserDetail.primaryEmailAddress?.emailAddress;
```

## Related Skills

- `workos-authkit-nextjs` - Complete Next.js integration after migration
- `workos-organizations` - Advanced organization management features
- `workos-mfa` - MFA enrollment and enforcement patterns
