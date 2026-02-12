---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch ALL of these URLs — they are the source of truth:

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (required for Admin Portal integration)

### SDK Installation

Detect package manager, verify WorkOS SDK is installed:

```bash
# Check SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || echo "SDK not found"
```

If not found, install before proceeding.

## Step 3: Implementation Path (Decision Tree)

```
What are you implementing?
  |
  +-- Emitting audit events from app --> Go to Step 4
  |
  +-- Log Streams (SIEM integration) --> Go to Step 5
  |
  +-- Metadata schema validation --> Go to Step 6
  |
  +-- Admin Portal (customer self-service) --> Go to Step 7
```

## Step 4: Emit Audit Events

### Basic Event Emission

Use SDK method to create audit log events. Check fetched docs for exact method signature and parameters.

**Required fields** (verify in fetched docs):

- `organization_id` - WorkOS organization identifier
- `action` - Event action name (e.g., "user.signed_in")
- `occurred_at` - ISO 8601 timestamp
- `actor` - Object with actor details
- `targets` - Array of affected resources

### Event Structure Template

Refer to fetched docs for complete event schema. Typical structure:

- Root `metadata` - arbitrary JSON (up to 50 keys, keys max 40 chars, values max 500 chars)
- `actor.metadata` - actor-specific details
- `targets[].metadata` - per-target details

**CRITICAL:** If metadata schema validation is enabled (Step 6), events MUST match defined JSON Schema or SDK will return error.

### Error Handling Pattern

Wrap event emission in try-catch:

```
Try emit event
  |
  +-- Success --> Log event ID
  |
  +-- Validation error --> Check metadata against schema (Step 6)
  |
  +-- Auth error --> Verify WORKOS_API_KEY (Step 2)
```

## Step 5: Log Streams (SIEM Integration)

### Configuration Path (Decision Tree)

```
Who configures log streams?
  |
  +-- You (via Dashboard) --> Use WorkOS Dashboard
  |
  +-- Customer IT admin --> Enable Admin Portal (Step 7)
```

### Supported Providers

Check fetched docs for current provider list. Known providers:

- **Datadog** - Sends to HTTP Log Intake API (regional endpoints)
- **Splunk** - Sends to HTTP Event Collector (HEC)
- **AWS S3** - Stores as JSON files (requires cross-account IAM role with external ID)
- **Google Cloud Storage** - Object storage
- **HTTP POST** - Generic webhook endpoint

### IP Allowlist (REQUIRED for restricted hosts)

If streaming to IP-restricted endpoint, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Verification:** After configuration, emit test event and verify it appears in SIEM provider.

### AWS S3 Specific Requirements

- Cross-account IAM role with external ID (see [AWS docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html))
- WorkOS uploads with `ContentMD5` header (required for Object Lock buckets)
- Check fetched docs for exact IAM policy permissions

## Step 6: Metadata Schema Validation

### When to Use

Enable if you need:

- Type safety for event metadata
- Consistent data structure across events
- Validation errors for malformed events

### Configuration (WorkOS Dashboard)

1. Navigate to event configuration in Dashboard
2. Check "Require metadata schema validation"
3. Use JSON Schema editor to define schemas

**Three schema locations** (each has separate JSON Schema):

- Root `metadata`
- `actor.metadata`
- `targets[].metadata`

### Schema Constraints (HARD LIMITS)

- Max 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

**If event exceeds limits:** SDK returns validation error before emission.

### Testing Schema Validation

Emit test event with invalid metadata:

```
Expected: SDK error with validation details
Actual: Check error message references schema validation
```

If no error occurs, schema validation may not be enabled — re-check Dashboard config.

## Step 7: Admin Portal (Customer Self-Service)

### Prerequisites

- `WORKOS_CLIENT_ID` configured (Step 2)
- Organization created in WorkOS Dashboard
- Admin Portal enabled for organization

### Integration Pattern

Check fetched Admin Portal docs for:

- Portal URL generation
- Passing organization identifier
- Authentication flow

**Customers can configure:**

- Log stream providers (Datadog, Splunk, S3, etc.)
- Provider credentials (API keys, S3 roles, endpoints)
- Stream activation/deactivation

**You do NOT need to:**

- Build SIEM configuration UI
- Store customer SIEM credentials
- Handle provider-specific auth flows

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env 2>/dev/null || echo "FAIL: Missing env vars"

# 2. Check SDK installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check API key format
grep "WORKOS_API_KEY=sk_" .env || echo "WARN: API key may be invalid"

# 4. Test event emission (run this after implementing Step 4)
# Create test script that emits event, verify no SDK errors

# 5. If using log streams, verify provider access
# Datadog: Check events in Datadog Logs Explorer
# Splunk: Query HEC endpoint for events
# S3: List bucket objects matching event pattern
```

**Manual checks:**

- [ ] Dashboard shows audit log events in Events tab
- [ ] Metadata schema validation (if enabled) rejects invalid events
- [ ] Log stream (if configured) receives events in SIEM provider
- [ ] Admin Portal (if enabled) allows customer to configure log streams

## Error Recovery

### "Invalid API key" or 401 errors

**Root cause:** API key missing, malformed, or lacks permissions.

Fix:

1. Check `WORKOS_API_KEY` starts with `sk_` (Step 2)
2. Verify key exists in WorkOS Dashboard under API Keys
3. Confirm key has "Audit Logs" permissions enabled

### "Metadata validation failed"

**Root cause:** Event metadata doesn't match JSON Schema (Step 6).

Fix:

1. Check Dashboard schema editor for required fields
2. Verify metadata object doesn't exceed 50 keys
3. Confirm key names ≤40 chars, values ≤500 chars
4. Test event emission with minimal metadata first

### Events not appearing in SIEM provider

**Root cause:** Log stream misconfigured or provider credentials invalid.

Fix:

```
Provider type?
  |
  +-- Datadog --> Verify API key, check regional endpoint
  |
  +-- Splunk --> Verify HEC token, check endpoint URL
  |
  +-- S3 --> Verify IAM role ARN, external ID, bucket permissions
  |
  +-- HTTP POST --> Check endpoint returns 2xx, verify IP allowlist
```

**Verification:** Emit test event, check WorkOS Dashboard for stream delivery status.

### "Organization not found"

**Root cause:** Invalid `organization_id` or organization doesn't exist.

Fix:

1. List organizations in WorkOS Dashboard
2. Verify `organization_id` matches exact value from Dashboard
3. Confirm organization has Audit Logs feature enabled

### S3 uploads fail with "Access Denied"

**Root cause:** IAM role missing permissions or external ID mismatch.

Fix:

1. Verify IAM role policy includes `s3:PutObject` permission
2. Check trust policy includes WorkOS account with correct external ID
3. Confirm bucket policy allows cross-account writes
4. Test role assumption manually using AWS CLI

Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html

### Metadata limits exceeded

**Root cause:** Exceeded 50 keys, 40-char key names, or 500-char values.

Fix:

1. Count metadata keys — if >50, split data or remove non-essential fields
2. Truncate key names to 40 chars max
3. Truncate values to 500 chars max (or store full data elsewhere, reference by ID)

**Prevention:** Validate metadata size before emission:

```
Before emit:
  |
  +-- Count keys --> if >50 --> FAIL
  |
  +-- Check key lengths --> if >40 --> FAIL
  |
  +-- Check value lengths --> if >500 --> FAIL
```

## Related Skills

- **workos-authkit-nextjs**: User authentication (provides actor context for audit events)
- **workos-authkit-react**: Client-side auth (actor identification)
