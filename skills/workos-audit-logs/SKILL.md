---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs before writing ANY code:

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

These docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Verify API key exists and has correct prefix
grep -E "WORKOS_API_KEY.*sk_" .env* || echo "FAIL: API key missing or invalid format"

# Optional: Client ID for certain configurations
grep "WORKOS_CLIENT_ID" .env* || echo "WARNING: Client ID not found (may be required for Admin Portal)"
```

### Project Dependencies

Detect and verify SDK installation:

```bash
# Check if SDK is installed
npm list @workos-inc/node 2>/dev/null || \
  yarn list --pattern @workos-inc/node 2>/dev/null || \
  pnpm list @workos-inc/node 2>/dev/null || \
  echo "FAIL: WorkOS SDK not installed"
```

If SDK missing, install based on detected package manager.

## Step 3: Implementation Path (Decision Tree)

Determine your integration approach:

```
Integration goal?
  |
  +-- Emit audit events from backend
  |     |
  |     +-- Define event schema in Dashboard --> Step 4
  |     +-- Integrate SDK in application code --> Step 5
  |
  +-- Enable customer self-service Log Streams
  |     |
  |     +-- Configure Admin Portal --> Step 6
  |     +-- Document IP allowlist for customers --> Step 7
  |
  +-- Direct Log Stream configuration (admin-managed)
        |
        +-- Choose provider (Datadog/Splunk/S3/HTTP) --> Step 8
        +-- Configure via Dashboard --> Step 9
```

## Step 4: Define Event Schema in Dashboard

**Navigate to:** WorkOS Dashboard → Audit Logs → Events

### Create Event Definition

1. Click "Create Event"
2. Set event name (e.g., `user.signed_in`, `document.downloaded`)
3. **Metadata Schema (Optional but Recommended):**
   - Check "Require metadata schema validation" for type safety
   - Opens JSON Schema editor with three metadata locations:
     - Root event metadata
     - Actor metadata
     - Target metadata
   - Click "+" to add properties to each metadata object

### Schema Constraints (CRITICAL)

From docs - these are hard limits:

- Maximum 50 keys per metadata object
- Key names: 40 characters max
- Values: 500 characters max

Exceeding these limits causes API errors at emission time.

### Verification

```bash
# Confirm event exists in Dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/audit_logs/events | \
  jq '.data[] | select(.action=="user.signed_in")' || \
  echo "FAIL: Event not found in Dashboard"
```

## Step 5: Emit Audit Events from Code

Check fetched docs for exact SDK method signature. Typical pattern:

```bash
# Verify SDK can be imported
node -e "require('@workos-inc/node')" 2>&1 | grep -q Error && \
  echo "FAIL: SDK import error" || echo "PASS: SDK imports correctly"
```

**Implementation pattern** (check docs for exact method name):

- Initialize WorkOS client with API key
- Call audit log emission method with:
  - `organization_id` (required)
  - `event` object containing:
    - `action` (matches Dashboard event name)
    - `occurred_at` (ISO 8601 timestamp)
    - `actor` (who performed action)
    - `targets` (what was affected)
    - `metadata` (must validate against schema if defined)

### Metadata Validation Errors

If "Require metadata schema validation" was checked:

- API returns validation error if payload doesn't match JSON Schema
- Error response includes which property failed validation
- **Fix:** Update payload to match schema OR update schema in Dashboard

## Step 6: Admin Portal Configuration (Customer Self-Service)

**Use case:** Let customer IT admins configure their own Log Streams.

### Setup Steps

1. Enable Admin Portal for organization (see `workos-admin-portal` skill)
2. Grant customer admin access to organization
3. Customer navigates to Admin Portal → Log Streams
4. Customer selects provider and enters credentials

**Providers available:**

- Datadog (requires API key + regional endpoint selection)
- Splunk (requires HEC token + endpoint URL)
- AWS S3 (requires bucket name + IAM role ARN + external ID)
- Google Cloud Storage (requires bucket name + service account key)
- HTTP POST (generic webhook - requires endpoint URL + optional auth header)

## Step 7: IP Allowlist Documentation

**CRITICAL for customers with IP-restricted endpoints.**

If customer streams to firewalled host, they MUST allowlist these IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

Provide this list in:

- Customer onboarding docs
- Admin Portal guidance text
- Support articles

**Verification for customers:**

```bash
# Test connectivity from WorkOS IPs (customer runs from allowed host)
curl -I https://their-siem-endpoint.example.com/intake
```

If returns 403/401 from WorkOS IPs but 200 from their network, IP allowlist is missing.

## Step 8: Provider-Specific Configuration (Decision Tree)

**Only if configuring Log Streams via Dashboard** (not Admin Portal):

```
Provider?
  |
  +-- Datadog
  |     |
  |     +-- Get Datadog API key from customer
  |     +-- Select region (US1/US3/US5/EU1/AP1/US1-FED)
  |     +-- Events sent to HTTP Log Intake API
  |     +-- Payload format: Array of {"message": {...event...}}
  |
  +-- Splunk
  |     |
  |     +-- Get HEC token + endpoint URL from customer
  |     +-- Verify endpoint accepts HTTPS POST
  |     +-- Payload format: Array of {"event": {...event...}}
  |
  +-- AWS S3
  |     |
  |     +-- Get bucket name from customer
  |     +-- Create IAM role with PutObject permission (customer side)
  |     +-- Generate external ID (WorkOS provides)
  |     +-- Events stored as individual JSON files
  |     +-- CRITICAL: Uses ContentMD5 header (required for Object Lock buckets)
  |
  +-- Google Cloud Storage
  |     |
  |     +-- Get bucket name + service account key from customer
  |     +-- Verify service account has storage.objects.create permission
  |
  +-- HTTP POST (Generic)
        |
        +-- Get webhook endpoint URL from customer
        +-- Optional: Authentication header (Bearer token, API key)
        +-- Verify endpoint returns 2xx for test POST
```

## Step 9: Dashboard Configuration (Admin-Managed Streams)

**Navigate to:** WorkOS Dashboard → Audit Logs → Log Streams

1. Click "Create Log Stream"
2. Select organization
3. Select provider (see Step 8 decision tree)
4. Enter provider-specific credentials
5. **Test connection** (Dashboard provides test button)
6. Save configuration

### AWS S3 Special Case (Cross-Account Role)

Requires customer to:

1. Create IAM role in their AWS account
2. Add WorkOS account as trusted entity
3. Attach policy allowing `s3:PutObject` on target bucket
4. Enable external ID check (WorkOS provides external ID in Dashboard)

**Verification command** (customer runs):

```bash
# Check role trust policy includes WorkOS account
aws iam get-role --role-name WorkOSAuditLogRole | \
  jq '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.AWS | contains("WorkOS_Account_ID"))'
```

If empty, trust relationship is misconfigured.

## Step 10: End-to-End Verification

### For Event Emission

Run these checks to confirm setup:

```bash
# 1. Verify event schema exists in Dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/audit_logs/events | \
  jq '.data[].action' | grep -q "user.signed_in" || \
  echo "FAIL: Event schema not found"

# 2. Test emit event (replace with actual SDK call)
# Should return 201 or event ID

# 3. Check event appears in Dashboard
# Navigate to Audit Logs → Events → Select organization → View recent events

# 4. If metadata schema validation enabled, test with invalid payload
# Should return 400 with schema validation error
```

### For Log Streams

```bash
# 1. Verify Log Stream is active
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/audit_logs/streams | \
  jq '.data[] | select(.state=="active")' || \
  echo "WARNING: No active streams found"

# 2. Emit test event (use SDK)

# 3. Check destination (provider-specific):
#    - Datadog: Check Logs Explorer for new events
#    - Splunk: Search for `source="workos"` 
#    - S3: Check bucket for new JSON files
#    - HTTP: Check webhook endpoint logs for POST request
```

**Typical latency:** Events appear in SIEM within 1-5 minutes. If >10 minutes, check stream status in Dashboard.

## Error Recovery

### "Schema validation failed" (400 Error)

**Root cause:** Event metadata doesn't match JSON Schema defined in Dashboard.

**Fix steps:**

1. Get schema from Dashboard → Events → Select event → View schema
2. Compare emitted payload structure to schema
3. Common mismatches:
   - Missing required property
   - Wrong data type (string vs number)
   - Value exceeds 500 character limit
   - Extra properties not in schema (if `additionalProperties: false`)

### "Log Stream connection failed"

**Provider-specific diagnostics:**

```
Provider?
  |
  +-- Datadog
  |     +-- Check: API key valid? (test in Datadog UI)
  |     +-- Check: Correct region selected? (US1 vs EU1)
  |     +-- Check: API key has "Logs Write" permission?
  |
  +-- Splunk
  |     +-- Check: HEC endpoint URL reachable? (curl test)
  |     +-- Check: HEC token valid? (test with sample POST)
  |     +-- Check: SSL certificate valid? (some Splunk versions have self-signed certs)
  |
  +-- AWS S3
  |     +-- Check: IAM role exists in customer account?
  |     +-- Check: Role trust policy includes WorkOS account?
  |     +-- Check: External ID matches Dashboard value?
  |     +-- Check: Bucket policy allows PutObject from role?
  |     +-- Check: Object Lock enabled? (requires ContentMD5 header - WorkOS handles automatically)
  |
  +-- HTTP POST
        +-- Check: Endpoint returns 2xx for test POST?
        +-- Check: Endpoint is HTTPS? (HTTP not supported)
        +-- Check: Authentication header correct format?
        +-- Check: WorkOS IPs allowlisted? (see Step 7)
```

### "Events not appearing in SIEM"

**Troubleshooting sequence:**

1. Check WorkOS Dashboard → Log Streams → Stream status (should be "active")
2. Check recent events were emitted (Dashboard → Events → Organization view)
3. Check provider-side ingestion logs:
   - Datadog: Logs Explorer, filter by `source:workos`
   - Splunk: Search `source="workos"` in Search & Reporting
   - S3: Check bucket for new objects (path: `audit-logs/{org_id}/{date}/`)
4. If events >10 minutes old and not appearing, check provider authentication
5. If provider shows "connection refused", verify IP allowlist (Step 7)

### "Metadata too large" (422 Error)

**Root cause:** Exceeded metadata limits (50 keys, 40 char keys, 500 char values).

**Fix:**

- Reduce number of metadata properties
- Truncate long string values
- Move large data to external storage, reference by ID in metadata

### SDK Import Errors

```bash
# Check SDK is actually installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not in node_modules"

# Check package.json lists SDK
grep "@workos-inc/node" package.json || echo "FAIL: SDK not in package.json"

# Reinstall if missing
npm install @workos-inc/node
```

## Admin Portal Access Issues

If customers cannot access Log Streams in Admin Portal:

1. Check: Organization ID matches between Dashboard and customer setup
2. Check: Admin Portal is enabled for organization (see `workos-admin-portal` skill)
3. Check: Customer admin has correct permissions (invite sent/accepted)
4. Check: Browser console for errors (admin portal requires modern browser)

## Related Skills

- **workos-api-audit-logs**: API reference for programmatic access
- **workos-events**: Webhook integration for audit log events
- **workos-admin-portal**: Enabling customer self-service configuration
- **workos-api-organization**: Organization management for multi-tenant audit logs
