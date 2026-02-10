---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Migration Strategy Decision Tree

```
Do you need to disable signups?
  |
  +-- YES (smaller apps, scheduled downtime acceptable)
  |     --> Use "big-bang" migration (Section 3A)
  |     --> Timeline: Hours to 1 day
  |     --> Risk: Brief service interruption
  |
  +-- NO (critical path app, zero downtime required)
        --> Use dual-write strategy (Section 3B)
        --> Timeline: Days to weeks (gradual rollout)
        --> Risk: Temporary data sync complexity
```

**Choose before proceeding.** Your choice affects Steps 4-7.

## Step 3: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run `printenv | grep WORKOS` to confirm vars are loaded.

### SDK Installation

Detect package manager, install WorkOS SDK:

```bash
# Check if SDK already installed
npm list @workos-inc/node || yarn list @workos-inc/node || pnpm list @workos-inc/node

# If not installed, use your package manager:
npm install @workos-inc/node
# or yarn add / pnpm add
```

## Step 4: Export Users from Existing System

**This step is YOUR responsibility** — WorkOS cannot access your database.

Export format (minimum fields):

```json
{
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "email_verified": true,
  "password_hash": "...",  // optional, see Step 5
  "password_algorithm": "bcrypt"  // required if password_hash present
}
```

Save as `users-export.json` or similar.

**Critical:** Email is the primary matching key for social auth linking. Ensure emails are accurate.

## Step 5: Password Handling Decision Tree

```
Can you export password hashes?
  |
  +-- YES --> Which algorithm?
  |     |
  |     +-- bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2
  |     |     --> Include password_hash + algorithm in export
  |     |     --> Proceed to Step 6
  |     |
  |     +-- Other algorithm (md5, sha256, custom)
  |           --> CANNOT import directly
  |           --> Use password reset flow (Step 5B)
  |
  +-- NO (security policy, technical limitation)
        --> Use password reset flow (Step 5B)
```

### 5A: Importing Password Hashes (If Supported Algorithm)

When creating users via API, include:

```json
{
  "email": "user@example.com",
  "password_hash": "$2b$10$...",
  "password_algorithm": "bcrypt"
}
```

**Supported algorithms** (from fetched docs):
- bcrypt
- scrypt
- firebase-scrypt
- ssha
- pbkdf2
- argon2

### 5B: Password Reset Flow (If Cannot Import Hashes)

After creating users WITHOUT passwords, trigger reset:

1. Create user via API (email only, no password fields)
2. Call Password Reset API for each user
3. Users receive email with reset link
4. Users set new password in WorkOS

**API Reference:** Check fetched docs for `/password_reset` endpoint usage.

**Alternative:** If migrating to passwordless (Magic Auth), skip passwords entirely.

## Step 6: Create Users in WorkOS

### Single-Threaded Script (Safe, Slow)

```javascript
const { WorkOS } = require('@workos-inc/node');
const fs = require('fs');

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const users = JSON.parse(fs.readFileSync('users-export.json'));

async function migrateUsers() {
  for (const user of users) {
    try {
      const result = await workos.users.create({
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: user.email_verified,
        ...(user.password_hash && {
          passwordHash: user.password_hash,
          passwordAlgorithm: user.password_algorithm
        })
      });
      
      console.log(`Created: ${user.email} -> ${result.id}`);
      
      // CRITICAL: Store result.id alongside your local user record
      // You need this mapping for future operations
      
    } catch (error) {
      console.error(`Failed: ${user.email}`, error.message);
      // Log failures for manual review
      fs.appendFileSync('migration-errors.log', 
        `${user.email}: ${error.message}\n`);
    }
  }
}

migrateUsers();
```

**Rate Limiting:** WorkOS APIs have rate limits. For large user bases (10k+), add delays or use batching.

### Storing WorkOS User IDs (CRITICAL)

After creating each user, you receive a WorkOS `user_id` like `user_01E4ZCR3C56J083X43JQXF3JK5`.

**You MUST store this** in your database alongside your existing user record:

```sql
ALTER TABLE users ADD COLUMN workos_user_id VARCHAR(255);
UPDATE users SET workos_user_id = ? WHERE email = ?;
```

This mapping is required for:
- Linking social auth accounts
- Future user updates
- Session validation after migration

## Step 7: Cutover Strategy

### Strategy A: Big-Bang Migration (Disable Signups)

**Timeline:** All at once, scheduled downtime

1. **T-1 hour:** Deploy code that disables new signups (feature flag, config change)
2. **T-0:** Run export + import script from Steps 4-6
3. **T+1 hour:** Deploy code that uses WorkOS for authentication
4. **T+2 hours:** Re-enable signups (now pointing to WorkOS)

**Verification:**

```bash
# After cutover, test authentication flow
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=test@example.com" \
  -d "password=test123"
```

### Strategy B: Dual-Write (Zero Downtime)

**Timeline:** Gradual, maintains parallel systems

**Phase 1: Enable Dual-Write (Days 1-7)**

Deploy code that writes to BOTH systems on signup:

```javascript
async function createUser(email, password) {
  // 1. Create in your existing system
  const localUser = await db.users.create({ email, password });
  
  // 2. ALSO create in WorkOS
  try {
    const workosUser = await workos.users.create({
      email,
      passwordHash: hashPassword(password),
      passwordAlgorithm: 'bcrypt'
    });
    
    // 3. Link the two
    await db.users.update(localUser.id, { 
      workos_user_id: workosUser.id 
    });
  } catch (error) {
    // Log but don't block signup
    console.error('WorkOS dual-write failed:', error);
  }
  
  return localUser;
}
```

**Phase 2: Migrate Historical Users (Days 7-14)**

Run Steps 4-6 for users created BEFORE dual-write was enabled.

**Handle duplicates:** Check if `workos_user_id` already exists before creating:

```javascript
if (!user.workos_user_id) {
  // Only create if not already dual-written
  const result = await workos.users.create({...});
}
```

**Phase 3: Switch Authentication (Day 14+)**

Deploy code that reads from WorkOS instead of local system.

**Phase 4: Sunset Dual-Write (Day 30+)**

Remove dual-write code once migration is stable.

## Step 8: Social Auth Provider Configuration

If users previously used Google/Microsoft/etc., configure those providers in WorkOS Dashboard.

**Critical:** Email is the matching key. When a user signs in via social auth, WorkOS will:

1. Extract email from provider (e.g., `user@gmail.com`)
2. Look for existing WorkOS user with that email
3. Auto-link if found

**Email Verification Note:** Some users may need to verify email after social sign-in. This depends on:
- Provider trust level (Gmail auto-trusted, custom domains may require verification)
- Your environment's email verification settings

Check fetched docs for provider-specific guidance.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration completeness:

```bash
# 1. Check environment variables loaded
env | grep WORKOS_API_KEY | grep -q "sk_" && echo "PASS: API key present" || echo "FAIL: API key missing"

# 2. Check SDK installed
npm list @workos-inc/node 2>/dev/null | grep -q "@workos-inc/node" && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Verify WorkOS user IDs stored locally
# (Replace with your actual DB query)
psql -d myapp -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NOT NULL;" | grep -q "[1-9]" && echo "PASS: User IDs stored" || echo "FAIL: No WorkOS IDs found"

# 4. Test authentication endpoint
curl -s -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'$WORKOS_CLIENT_ID'","client_secret":"'$WORKOS_API_KEY'","grant_type":"password","email":"test@example.com","password":"test123"}' \
  | grep -q "access_token" && echo "PASS: Auth working" || echo "FAIL: Auth broken"

# 5. Check migration error log exists and review
if [ -f migration-errors.log ]; then
  echo "WARN: $(wc -l < migration-errors.log) users failed migration - review migration-errors.log"
else
  echo "PASS: No migration errors logged"
fi
```

**Do not mark complete until all checks pass** (except #5, which is a warning).

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in WorkOS (from dual-write or previous migration attempt)

**Fix:**

```javascript
try {
  await workos.users.create({...});
} catch (error) {
  if (error.code === 'user_already_exists') {
    // Look up existing user by email instead
    const existingUsers = await workos.users.list({ email: user.email });
    const workosUserId = existingUsers.data[0].id;
    // Store the existing ID
  } else {
    throw error;
  }
}
```

### "Invalid password_algorithm" error

**Root cause:** Algorithm not in supported list (bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)

**Fix:** Use password reset flow (Step 5B) instead of importing hashes.

### "Rate limit exceeded" during bulk import

**Root cause:** Too many API calls too fast

**Fix:** Add delay between requests:

```javascript
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
```

Or use exponential backoff:

```javascript
async function createWithRetry(userData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.users.create(userData);
    } catch (error) {
      if (error.code === 'rate_limit_exceeded' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### Social auth users not auto-linking

**Root cause 1:** Email mismatch between systems

**Fix:** Verify emails match exactly (case-sensitive). Run query:

```sql
SELECT email, workos_user_id FROM users WHERE workos_user_id IS NULL;
```

**Root cause 2:** Provider not configured in WorkOS Dashboard

**Fix:** Go to WorkOS Dashboard > Integrations, configure Google/Microsoft/etc. with client credentials.

### Dual-write sync issues (updates/deletes)

**Root cause:** Update in one system not reflected in other

**Fix:** Add dual-write to update/delete operations:

```javascript
async function updateUserEmail(userId, newEmail) {
  // 1. Update local system
  await db.users.update(userId, { email: newEmail });
  
  // 2. ALSO update WorkOS
  const user = await db.users.findOne(userId);
  if (user.workos_user_id) {
    await workos.users.update(user.workos_user_id, { email: newEmail });
  }
}
```

**Critical:** This complexity is temporary — remove after full cutover to WorkOS.

### Missing workos_user_id after migration

**Root cause:** Mapping not persisted to database

**Fix:** Re-run import script with ID persistence added:

```javascript
const result = await workos.users.create({...});
await db.query('UPDATE users SET workos_user_id = ? WHERE email = ?', 
  [result.id, user.email]);
```

## Related Skills

- `workos-authkit-nextjs` - Integrate WorkOS authentication UI in Next.js
- `workos-authkit-react` - Integrate WorkOS authentication UI in React
- `workos-magic-link` - Passwordless authentication setup
- `workos-api-authkit` - Low-level AuthKit API usage
- `workos-migrate-auth0` - Migration from Auth0 (similar patterns)
- `workos-migrate-clerk` - Migration from Clerk (similar patterns)
