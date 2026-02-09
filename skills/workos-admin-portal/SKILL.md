---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- generated -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow the docs.

## Step 2: Pre-Flight Validation

### API Credentials

Check environment variables or secrets manager for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both variables are accessible to your application runtime.

### Project Structure

- Confirm WorkOS SDK package exists in `package.json` or equivalent dependency file
- Confirm authentication middleware/guards exist (portal links should only be accessible to authenticated IT admins)

## Step 3: Workflow Selection (Decision Tree)

Determine integration pattern based on requirements:

```
Admin Portal access method?
  |
  +-- Dashboard-generated link (email/Slack distribution)
  |     |
  |     +-- Go to Step 4 (Dashboard Setup)
  |
  +-- In-app integration (seamless UX)
        |
        +-- Go to Step 5 (SDK Integration)
```

**Choose dashboard workflow when:**
- Initial customer onboarding outside your app
- Sending setup links via external channels
- Testing/preview before building in-app flow

**Choose SDK integration when:**
- Building self-service enterprise settings page
- Providing in-app SSO/Directory Sync configuration
- Maintaining complete control over UX flow

## Step 4: Dashboard Setup (Link Distribution Pattern)

### A. Configure Redirect URIs

1. Navigate to WorkOS Dashboard → Redirects
2. Set **Default Return URI** (where users land after portal session)
3. Optionally set **Success URIs** for:
   - SSO setup completion
   - Directory Sync setup completion
   - Log Streams setup completion

**CRITICAL:** All URIs must use HTTPS in production.

### B. Create Organization

1. Dashboard → Organizations → Create New
2. Note the organization ID (format: `org_XXXXXXXXXX`)
3. Store mapping: `{customer_id: organization_id}` in your database

### C. Generate Setup Link

1. Select organization → "Invite admin"
2. Choose features (SSO, Directory Sync, etc.)
3. Either:
   - Enter IT admin email for automatic delivery
   - Copy link for manual distribution

**Link lifecycle:** Only one link active at a time. Links expire after 5 minutes or first use.

**Stop here if using dashboard workflow.** Skip to Step 7 for verification.

## Step 5: SDK Integration (In-App Pattern)

### A. Install SDK

Detect package manager from lockfile presence:

```bash
# Determine package manager
if [ -f "package-lock.json" ]; then PKG_MGR="npm"
elif [ -f "yarn.lock" ]; then PKG_MGR="yarn"
elif [ -f "pnpm-lock.yaml" ]; then PKG_MGR="pnpm"
elif [ -f "bun.lockb" ]; then PKG_MGR="bun"
fi

# Install based on language (check docs for exact package names)
# Node.js example:
$PKG_MGR install @workos-inc/node
```

**Verify:** SDK package exists in node_modules (or equivalent) before continuing.

### B. Initialize SDK Client

Pattern varies by language. Check fetched docs for exact initialization. General structure:

```
Language detection?
  |
  +-- Node.js/TypeScript --> Import WorkOS, init with API key
  |
  +-- Python --> Import workos, configure client
  |
  +-- Ruby --> Require workos, set credentials
  |
  +-- Go --> Import workos-go, create client
```

**Environment variable pattern:**
- Read `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` from env
- Never hardcode credentials in source

### C. Create Organization Resource

For each customer that needs Admin Portal access:

1. Call organization creation endpoint when onboarding new customer
2. Required fields (check docs for exact schema):
   - Organization name
   - Domain(s) - optional but recommended for domain verification
3. Store organization ID in customer record:
   ```sql
   -- Example schema
   customers table: add column organization_id VARCHAR(255)
   ```

**Critical:** One organization per customer. One connection per organization.

### D. Generate Portal Link Endpoint

Create authenticated endpoint (e.g., `/api/admin-portal/link`) that:

1. Verifies requester is IT admin for their organization
2. Looks up organization ID from authenticated user's customer record
3. Generates portal link with intent parameter

**Intent selection (choose one per link):**
- `sso` - SSO connection setup/management
- `dsync` - Directory Sync setup/management
- `audit_logs` - Audit log configuration
- `log_streams` - Log streaming setup
- `domain_verification` - Domain ownership verification
- `certificate_renewal` - SAML certificate renewal

**Code structure pattern (language-agnostic):**

```
1. Auth guard: Verify user role = IT admin
2. Fetch: organization_id = get_org_from_user(authenticated_user_id)
3. SDK call: portal_link = workos.generate_portal_link({
     organization: organization_id,
     intent: "sso",  // or other intent
     return_url: "https://yourapp.com/settings/sso"  // optional
   })
4. Return: { link: portal_link }
```

**Link expiration:** 5 minutes from generation. Generate fresh links on each request, never cache.

**return_url parameter:**
- If provided: Overrides dashboard-configured default return URI for this specific link
- If omitted: Uses dashboard default return URI
- Must be HTTPS
- Should redirect to relevant settings page in your app

### E. Frontend Integration

Add UI trigger in your app's settings/admin section:

1. Button/link labeled "Configure SSO", "Setup Directory Sync", etc.
2. Click handler:
   - Calls `/api/admin-portal/link` endpoint
   - Redirects user to returned portal link
   - Do NOT display link to user (immediate redirect only)

**Security note:** Portal links are single-use and short-lived. Never:
- Email portal links to users
- Display links in UI for copy/paste
- Cache links for reuse

## Step 6: Optional - Custom Branding

Check fetched custom branding doc for:
- Logo upload requirements (dimensions, file types)
- Color theme customization
- Dashboard configuration location

Apply branding in WorkOS Dashboard → Branding section.

## Step 7: Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables are set
env | grep WORKOS_API_KEY | grep -q "sk_" && echo "PASS: API key set" || echo "FAIL: API key missing or invalid"
env | grep WORKOS_CLIENT_ID | grep -q "client_" && echo "PASS: Client ID set" || echo "FAIL: Client ID missing"

# 2. Check SDK package installed (Node.js example - adapt for your language)
ls node_modules/@workos-inc 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Test organization creation (replace with your test script)
# Should return organization ID starting with "org_"
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org"}' | grep -q "org_" && echo "PASS: Org creation works" || echo "FAIL: Org creation failed"

# 4. If SDK integrated: Check portal link endpoint exists
# Adapt to your framework's route listing command
# Node.js/Express example:
grep -r "admin-portal" src/ app/ routes/ 2>/dev/null && echo "PASS: Portal endpoint found" || echo "WARN: Portal endpoint not detected"

# 5. Build/compile succeeds
# Run your framework's build command
npm run build  # or: python setup.py build, go build, bundle exec rails assets:precompile, etc.
```

**Manual verification:**

1. Dashboard workflow:
   - [ ] Create test organization in dashboard
   - [ ] Generate setup link
   - [ ] Open link in incognito window
   - [ ] Verify Admin Portal loads with correct organization name
   - [ ] Complete a test SSO setup
   - [ ] Verify redirect lands on configured return URI

2. SDK workflow:
   - [ ] Authenticate as test IT admin user
   - [ ] Navigate to enterprise settings page
   - [ ] Click "Configure SSO" (or similar trigger)
   - [ ] Verify immediate redirect to Admin Portal
   - [ ] Verify organization context is correct
   - [ ] Complete test setup flow
   - [ ] Verify return_url redirects correctly

## Error Recovery

### "Invalid API key" / 401 Unauthorized

**Root cause:** API key missing, malformed, or wrong environment (test vs. prod).

**Fix:**
1. Check key format: Must start with `sk_test_` (test) or `sk_live_` (prod)
2. Verify key copied completely (no truncation)
3. Check WorkOS Dashboard → API Keys for valid key
4. Ensure environment variable is loaded: `echo $WORKOS_API_KEY`
5. Restart application after setting environment variables

### "Organization not found" / 404

**Root cause:** Organization ID doesn't exist or typo in ID.

**Fix:**
1. Verify organization ID format: `org_XXXXXXXXXX` (no spaces, exact case)
2. Check organization exists: Dashboard → Organizations or API query
3. Verify database mapping: `customer_id` → `organization_id` is correct
4. Ensure organization wasn't deleted

### Portal link returns 404 or "Link expired"

**Root cause:** Link expired (5 min) or already used (single-use).

**Fix:**
1. Generate fresh link immediately before redirect
2. Never cache portal links
3. If user navigates away, generate new link on return
4. Check link generation timestamp vs. current time
5. Verify no accidental double-redirects consuming the link

### "Redirect URI not allowed"

**Root cause:** return_url parameter doesn't match configured allowed URIs in dashboard.

**Fix:**
1. Dashboard → Redirects → Check allowed URI list
2. Ensure exact match including protocol (https://) and path
3. Add return_url to allowed list if needed
4. Check for typos: `https://app.example.com` ≠ `https://app.example.com/`
5. Verify HTTPS (HTTP not allowed in production)

### Portal loads but wrong organization context

**Root cause:** Passing incorrect organization ID in link generation.

**Fix:**
1. Add logging: Log organization ID before generating link
2. Verify database query: Ensure `WHERE customer_id = ?` returns correct org
3. Check for organization ID reuse across customers (should be 1:1 mapping)
4. Test with known organization: Hardcode test org ID temporarily to isolate issue

### SDK import errors

**Root cause:** Package not installed, wrong import path, or version mismatch.

**Fix:**
1. Check package.json (or equivalent): SDK should be in dependencies, not devDependencies
2. Verify import path matches SDK docs (may vary by version)
3. Clear package cache: `rm -rf node_modules && npm install` (or equivalent)
4. Check SDK version compatibility with your language runtime version
5. Inspect node_modules structure: `ls node_modules/@workos-inc` to verify installation

### "Unauthorized" when accessing portal link endpoint

**Root cause:** Auth guard not recognizing user as IT admin or missing auth entirely.

**Fix:**
1. Verify user role in database: Should have admin/owner role for their organization
2. Check auth middleware: Ensure it runs before portal link generation
3. Add role check: `if (user.role !== 'admin') return 403`
4. Test with known admin user
5. Log user object to verify role claim is present

### Portal completes setup but redirect fails

**Root cause:** return_url or default return URI misconfigured or app not handling return properly.

**Fix:**
1. Check return URI in dashboard matches live application URL
2. Verify return URI endpoint exists and is publicly accessible
3. Add logging at return URI endpoint to confirm it's being hit
4. Check for redirect loops: Return URI shouldn't trigger another portal flow
5. Test return URI directly in browser (should load without auth errors)

### Multiple organizations for same customer

**Root cause:** Creating new organization instead of reusing existing one.

**Fix:**
1. Add uniqueness constraint: `UNIQUE(customer_id, organization_id)` in schema
2. Query before create: Check if organization exists for customer
3. Store organization ID on first creation, reuse for subsequent portal access
4. If multiple orgs exist: Delete duplicates, keep oldest, update customer references

## Related Skills

- **workos-sso**: Implement SSO authentication flow after portal setup
- **workos-directory-sync**: Sync user directories after portal configuration
- **workos-authkit-nextjs**: Full auth solution including portal access patterns
- **workos-audit-logs**: Configure audit logging via Admin Portal
- **workos-domain-verification**: Domain verification flows via portal
