---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Inventory What You're Migrating

Check your Auth0 tenant for:

```bash
# Count active users (requires Auth0 Management API token)
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/users?fields=user_id&include_fields=true" | jq '. | length'

# Check if Organizations are in use
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/organizations" | jq '. | length'
```

Decision tree for migration scope:

```
What are you migrating?
  |
  +-- Password users only --> Export users → import to WorkOS
  |
  +-- Social auth users only --> Configure OAuth providers → users auto-link on first sign-in
  |
  +-- Both password + social --> Export users → configure OAuth → import users with hashes
  |
  +-- Organizations in use --> Export orgs → create in WorkOS → export memberships → add to WorkOS
```

### WorkOS Prerequisites

Verify in WorkOS Dashboard before starting:

- API key exists (starts with `sk_`)
- Client ID exists (starts with `client_`)
- Environment is provisioned (production or staging)

## Step 3: Export Auth0 Data

### User Data Export (REQUIRED)

Auth0 provides bulk export via their [User Import/Export Extension](https://auth0.com/docs/customize/extensions/user-import-export-extension).

**Process:**

1. Install extension in Auth0 Dashboard
2. Run "Export Users" job
3. Download newline-delimited JSON file

**Critical fields to verify in export:**

```bash
# Check export has required fields
head -1 users_export.ndjson | jq 'has("email") and has("email_verified")'
# Should output: true
```

### Password Hashes Export (CONDITIONAL)

**Only required if:** Users sign in with passwords AND you want seamless migration (no password reset).

**Process:**

1. Open Auth0 support ticket requesting password hash export
2. Wait 5-10 business days for approval and processing
3. Receive separate NDJSON file with `passwordHash` field

**Verify password export:**

```bash
# Check first entry has password hash
head -1 password_export.ndjson | jq 'has("passwordHash")'
# Should output: true

# Confirm hash is bcrypt format (starts with $2a$ or $2b$)
head -1 password_export.ndjson | jq -r '.passwordHash' | grep -E '^\$2[ab]\$'
```

**If password export is not available:** Users will need to reset passwords after migration. Plan for email notifications.

### Organizations Export (CONDITIONAL)

**Only required if:** Using Auth0 Organizations feature.

Use Auth0 Management API to paginate through organizations:

```bash
# Export all organizations
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/organizations?per_page=100" > auth0_orgs.json

# Export organization memberships (per org)
ORG_ID="org_xxxxx"
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/organizations/$ORG_ID/members" > org_members_$ORG_ID.json
```

## Step 4: Import Users to WorkOS

### Decision: Migration Tool vs API

```
How many users?
  |
  +-- < 10,000 users --> Use WorkOS import tool (GitHub repo)
  |
  +-- > 10,000 users --> Use WorkOS APIs with batching
```

### Option A: WorkOS Import Tool

**Repository:** https://github.com/workos/migrate-auth0-users

**Process:**

1. Clone repository
2. Set environment variables: `WORKOS_API_KEY`
3. Place Auth0 export files in designated directory
4. Run import script

WebFetch the repository README for exact usage — configuration may change.

### Option B: WorkOS API Direct Import

**Field mapping from Auth0 to WorkOS Create User API:**

| Auth0 field      | WorkOS API parameter |
|------------------|---------------------|
| `email`          | `email`             |
| `email_verified` | `email_verified`    |
| `given_name`     | `first_name`        |
| `family_name`    | `last_name`         |

**With password hashes:**

```typescript
// Example API call structure (fetch SDK docs for exact method)
await workos.user.create({
  email: auth0User.email,
  email_verified: auth0User.email_verified,
  first_name: auth0User.given_name,
  last_name: auth0User.family_name,
  password_hash: auth0User.passwordHash,  // From password export
  password_hash_type: 'bcrypt'             // Auth0 uses bcrypt
});
```

**Critical:** `password_hash_type` MUST be `'bcrypt'` for Auth0 imports. Other values will fail.

**Batching strategy for large imports:**

```bash
# Split export into batches of 1000 users
split -l 1000 users_export.ndjson batch_

# Process each batch with error logging
for batch in batch_*; do
  node import_batch.js $batch 2>> import_errors.log
done
```

**Verify import progress:**

```bash
# Check imported user count in WorkOS
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" | jq '.list_metadata.total'
```

## Step 5: Configure Social Auth Providers (CONDITIONAL)

**Only required if:** Users sign in via Google, Microsoft, or other OAuth providers.

**Process:**

1. Navigate to WorkOS Dashboard → Authentication → Social Auth
2. Configure each provider used in Auth0 (check Auth0 Dashboard → Authentication → Social)
3. Obtain client credentials from provider (Google Cloud Console, Azure Portal, etc.)

**Provider configuration URLs (WebFetch for current setup steps):**

- Google: https://workos.com/docs/integrations/google-oauth
- Microsoft: https://workos.com/docs/integrations/microsoft-oauth

**Automatic user linking:**

WorkOS matches users by email address. When a user signs in via social auth:

1. WorkOS checks if user with matching email exists
2. If exists, links social auth profile to existing user
3. If not exists, creates new user

**Email verification behavior:**

- Trusted domains (e.g., `gmail.com` via Google OAuth) → No additional verification
- Untrusted domains → May require email verification if enabled in WorkOS environment settings

Check WorkOS Dashboard → Settings → Authentication → Email Verification for current policy.

## Step 6: Migrate Organizations (CONDITIONAL)

**Only required if:** Using Auth0 Organizations.

### Create Organizations in WorkOS

**Field mapping:**

| Auth0 Organization field | WorkOS API parameter |
|--------------------------|---------------------|
| `name`                   | `name`              |
| `display_name`           | `name` (use display_name if available) |
| `id`                     | Store as `external_id` for reference |

```bash
# Example: Create org via API
curl -X POST "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "domains": ["acme.com"]
  }'
```

**Verify organization creation:**

```bash
# List all WorkOS organizations
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations" | jq '.data | length'
```

### Add Organization Memberships

**Process:**

1. Match Auth0 user ID to WorkOS user ID (store mapping during user import)
2. Match Auth0 org ID to WorkOS org ID (store mapping during org creation)
3. Call WorkOS Organization Membership API for each user-org pair

```bash
# Add user to organization
curl -X POST "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H...",
    "organization_id": "org_01H..."
  }'
```

## Step 7: Handle MFA Migration

**CRITICAL LIMITATION:** WorkOS does not support SMS-based MFA due to security vulnerabilities.

### MFA Strategy Decision Tree

```
What MFA methods are Auth0 users using?
  |
  +-- TOTP (Google Authenticator, etc.) --> Users re-enroll in WorkOS MFA
  |
  +-- SMS --> Notify users to switch to email Magic Auth or TOTP
  |
  +-- Email --> Configure WorkOS email provider, users continue using email
```

**User communication required:**

1. Notify users before migration that SMS MFA will not transfer
2. Provide instructions for enrolling in WorkOS MFA post-migration
3. Send re-enrollment instructions after migration completes

**WorkOS MFA enrollment URL:**

Users can enroll at: `https://[your-app].workos.com/mfa/enroll` (exact URL depends on AuthKit integration).

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm successful migration:

```bash
# 1. User count matches (allow for duplicates/disabled accounts)
AUTH0_USERS=$(curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/users?fields=user_id&include_fields=true" | jq '. | length')
WORKOS_USERS=$(curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" | jq '.list_metadata.total')
echo "Auth0: $AUTH0_USERS, WorkOS: $WORKOS_USERS"

# 2. Sample user can authenticate
# (Test in staging environment first)
# Attempt sign-in via WorkOS AuthKit with known user credentials

# 3. Organizations migrated (if applicable)
AUTH0_ORGS=$(curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  "https://$AUTH0_DOMAIN/api/v2/organizations" | jq '. | length')
WORKOS_ORGS=$(curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations" | jq '.data | length')
echo "Auth0 orgs: $AUTH0_ORGS, WorkOS orgs: $WORKOS_ORGS"

# 4. Social auth providers configured (check Dashboard manually)
# WorkOS Dashboard → Authentication → Social Auth
# Verify each provider from Auth0 is enabled

# 5. Password authentication works (if passwords migrated)
# Test sign-in with known password user credentials
```

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate emails in Auth0 export or re-running import.

**Fix:**

1. Check if user already exists in WorkOS before creating
2. Use update API instead of create for existing users
3. Deduplicate Auth0 export file by email before importing

```bash
# Deduplicate by email
jq -s 'unique_by(.email)' users_export.ndjson > users_deduplicated.ndjson
```

### "Invalid password hash" error

**Root cause:** Incorrect `password_hash_type` or malformed hash.

**Fix:**

1. Verify `password_hash_type` is exactly `'bcrypt'` (lowercase)
2. Check hash format starts with `$2a$` or `$2b$`
3. Ensure hash was not truncated during export/transfer

```bash
# Validate hash format
echo "$HASH" | grep -E '^\$2[ab]\$[0-9]{2}\$.{53}$'
```

### Social auth users cannot sign in

**Root cause:** OAuth provider not configured in WorkOS or incorrect redirect URIs.

**Fix:**

1. Check WorkOS Dashboard → Authentication → Social Auth for provider status
2. Verify redirect URI matches AuthKit callback URL
3. Test provider OAuth flow independently using WorkOS test button

### Organization memberships not created

**Root cause:** User ID or organization ID not found (bad mapping).

**Fix:**

1. Verify user exists in WorkOS before adding membership
2. Verify organization exists in WorkOS
3. Check user ID/org ID mapping table for correct IDs

```bash
# Verify user exists
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users/$USER_ID" | jq '.id'

# Verify org exists  
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations/$ORG_ID" | jq '.id'
```

### Rate limiting during bulk import

**Root cause:** Exceeding WorkOS API rate limits.

**Fix:**

1. Implement exponential backoff and retry logic
2. Reduce batch size (e.g., 100 users per batch instead of 1000)
3. Add delays between API calls (e.g., 100ms)

```bash
# Example: Add delay between requests
for batch in batch_*; do
  node import_batch.js $batch
  sleep 1  # 1 second delay between batches
done
```

## Post-Migration Steps

1. **Update application code** to use WorkOS AuthKit instead of Auth0 SDK (see related skills below)
2. **Notify users** of migration and any action items (e.g., MFA re-enrollment)
3. **Monitor authentication metrics** in WorkOS Dashboard for failed sign-ins
4. **Keep Auth0 tenant active** for 30+ days as fallback (configurable grace period)
5. **Decommission Auth0** after confirming all users migrated successfully

## Related Skills

- **workos-authkit-nextjs** - Integrate WorkOS AuthKit into Next.js applications
- **workos-authkit-react** - Integrate WorkOS AuthKit into React applications  
- **workos-mfa** - Configure and manage Multi-Factor Authentication in WorkOS
- **workos-api-organization** - Manage organizations via WorkOS API
- **workos-api-authkit** - User management API reference
