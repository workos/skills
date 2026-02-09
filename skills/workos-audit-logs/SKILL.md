---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for implementation:

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with the documentation, follow the documentation.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access at `https://dashboard.workos.com/`
- Confirm Organization is created in Dashboard

### Environment Variables

Check for required variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Detect package manager and verify WorkOS SDK is installed:

```bash
# Check if SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || \
ls node_modules/workos 2>/dev/null
```

If missing, install SDK per detected package manager.

## Step 3: Configuration Decision Tree

```
What are you configuring?
  |
  +-- Event Schema with Metadata Validation
  |     |
  |     +-- Go to Step 4
  |
  +-- Log Stream to SIEM/Storage
  |     |
  |     +-- Go to Step 5
  |
  +-- Programmatic Event Creation/Export
        |
        +-- Go to Step 6
```

## Step 4: Configure Event Schema with Metadata (Dashboard)

**Location:** WorkOS Dashboard → Audit Logs → Events

### Create New Event

1. Navigate to Events configuration
2. Click "Add Event" or edit existing event
3. Check "Require metadata schema validation" checkbox
4. Define JSON Schema for metadata objects

### Metadata Schema Rules (ENFORCED)

- **Limit:** 50 keys maximum per metadata object
- **Key names:** 40 characters maximum
- **Values:** 500 characters maximum

### Schema Locations

Define schemas for three metadata locations:

1. **Root event metadata** - `event.metadata`
2. **Actor metadata** - `event.actor.metadata`
3. **Target metadata** - `event.targets[].metadata`

**Example schema structure:**

```json
{
  "type": "object",
  "properties": {
    "ip_address": { "type": "string" },
    "user_agent": { "type": "string" }
  },
  "required": ["ip_address"]
}
```

Reference: https://json-schema.org/ for schema syntax.

**Verification:** Emit a test event with invalid metadata. Should return validation error.

## Step 5: Configure Log Streams (Decision Tree)

```
Log Stream destination?
  |
  +-- Datadog          --> Step 5.1
  |
  +-- Splunk           --> Step 5.2
  |
  +-- AWS S3           --> Step 5.3
  |
  +-- Google Cloud     --> Step 5.4
  |
  +-- Generic HTTP     --> Step 5.5
```

**Configuration method:**

```
Who configures?
  |
  +-- You (developer)         --> Use WorkOS Dashboard
  |
  +-- Customer IT admin       --> Enable Admin Portal access
```

### IP Allowlist (CRITICAL for restricted hosts)

If streaming to a host with IP restrictions, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

Reference: https://workos.com/docs/audit-logs/log-streams

### Step 5.1: Datadog Configuration

**Endpoint:** Datadog HTTP Log Intake API (regional)

Navigate to Dashboard → Audit Logs → Log Streams → Add Stream → Datadog

Required fields:

- **API Key:** Datadog API key
- **Region:** US1, US3, US5, EU, etc.
- **Service:** (optional) Service name tag
- **Source:** (optional) Source name tag

**Payload format:** Events sent as JSON array with `message` wrapper. See WebFetch docs for exact schema.

**Verification:**

```bash
# Check Datadog Logs Explorer for events with source:workos
# Events should appear within 60 seconds
```

### Step 5.2: Splunk Configuration

**Endpoint:** Splunk HTTP Event Collector (HEC)

Navigate to Dashboard → Audit Logs → Log Streams → Add Stream → Splunk

Required fields:

- **HEC Token:** Splunk HTTP Event Collector token
- **HEC Endpoint:** Full URL to HEC endpoint
- **Index:** (optional) Splunk index name
- **Source Type:** (optional) Source type tag

**Payload format:** Events sent as JSON array with `event` wrapper. See WebFetch docs for exact schema.

**Verification:**

```bash
# Check Splunk search: source="workos" OR sourcetype="workos"
# Events should appear within 60 seconds
```

### Step 5.3: AWS S3 Configuration

**Authentication:** Cross-account IAM role with external ID

Navigate to Dashboard → Audit Logs → Log Streams → Add Stream → AWS S3

#### Step 5.3a: Create IAM Role in AWS

1. AWS Console → IAM → Roles → Create Role
2. Select "Another AWS Account"
3. Enter WorkOS Account ID (from Dashboard instructions)
4. Check "Require external ID"
5. Enter External ID (from Dashboard instructions)
6. Attach policy with S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

7. Copy Role ARN

#### Step 5.3b: Configure Stream in Dashboard

Required fields:

- **Bucket Name:** S3 bucket name
- **Region:** AWS region (e.g., us-east-1)
- **Role ARN:** From Step 5.3a
- **Path Prefix:** (optional) Prefix for object keys

**File format:** Individual JSON files per event, uploaded with `ContentMD5` header (required for Object Lock enabled buckets).

**Verification:**

```bash
# List recent objects in bucket
aws s3 ls s3://YOUR-BUCKET-NAME/PREFIX/ --recursive | tail -20

# Download and inspect an event file
aws s3 cp s3://YOUR-BUCKET-NAME/PREFIX/event_01HY123456.json - | jq .
```

Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html

### Step 5.4: Google Cloud Storage Configuration

Navigate to Dashboard → Audit Logs → Log Streams → Add Stream → Google Cloud Storage

Refer to WebFetch docs for exact setup steps — authentication uses service account with bucket permissions.

### Step 5.5: Generic HTTP POST Configuration

Navigate to Dashboard → Audit Logs → Log Streams → Add Stream → HTTP POST

Required fields:

- **Endpoint URL:** Full HTTPS URL
- **Headers:** (optional) Custom headers for authentication

**Payload format:** Events sent as JSON array. See WebFetch docs for exact schema.

**Verification:**

```bash
# Check your endpoint logs for POST requests from WorkOS IPs
# Verify payload structure matches expected format
```

## Step 6: Programmatic Event Management

### Step 6.1: Emit Events via SDK

**CRITICAL:** Check WebFetch docs for SDK method names — they vary by language.

Typical pattern (check docs for exact syntax):

```
SDK_CLIENT.auditLogs.createEvent({
  organization_id: "org_123",
  event: {
    action: "user.signed_in",
    occurred_at: "2024-01-15T12:00:00Z",
    actor: {
      id: "user_123",
      type: "user",
      name: "Alice Smith"
    },
    targets: [{
      id: "resource_456",
      type: "document"
    }],
    context: {
      location: "192.0.2.1"
    }
  }
})
```

**Validation:** If metadata schema is enabled (Step 4), events must match schema or will return error.

### Step 6.2: Export Events via API

Reference: https://workos.com/docs/audit-logs/exporting-events

**CRITICAL:** Export methods, pagination, and filtering vary by SDK. Check WebFetch docs before implementing.

Typical pattern:

1. List events with filters (date range, action, actor)
2. Handle pagination if result set is large
3. Parse event objects per schema from docs

### Step 6.3: Admin Portal (Customer Self-Service)

**Use case:** Allow customer IT admins to configure Log Streams themselves.

Enable Admin Portal access per WebFetch docs at:
https://workos.com/docs/audit-logs/admin-portal

**Configuration scope:** Customers can create/edit/delete Log Streams, but cannot modify event schemas (developer-controlled).

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY | grep -q "sk_" && echo "PASS: API key valid" || echo "FAIL: API key missing or invalid"
env | grep WORKOS_CLIENT_ID | grep -q "client_" && echo "PASS: Client ID valid" || echo "FAIL: Client ID missing or invalid"

# 2. Check SDK is installed
ls node_modules/@workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK missing"

# 3. Test event emission (if implemented)
# Run your event emission code with test data
# Verify event appears in Dashboard → Audit Logs → Events

# 4. Test Log Stream (if configured)
# Emit test event, check destination logs within 60 seconds
# For S3: aws s3 ls s3://bucket/prefix/ | tail -1
# For Datadog/Splunk: Check query interface for recent events

# 5. Test metadata validation (if schema configured)
# Emit event with invalid metadata, verify error returned
# Emit event with valid metadata, verify success
```

**Dashboard verification:**

- WorkOS Dashboard → Audit Logs → Events shows emitted events
- WorkOS Dashboard → Audit Logs → Log Streams shows "Active" status

## Error Recovery

### "API key invalid" or "Unauthorized"

**Root cause:** Invalid `WORKOS_API_KEY` or insufficient permissions.

Fix:

1. Verify key starts with `sk_` and has no whitespace
2. Check key status in Dashboard → API Keys
3. Regenerate key if needed and update environment

### "Metadata validation failed"

**Root cause:** Event metadata does not match JSON Schema defined in Dashboard.

Fix:

1. Retrieve schema from Dashboard → Audit Logs → Events → Edit Event → Schema
2. Compare emitted metadata structure against schema
3. Common issues:
   - Missing required field
   - Wrong type (string vs number)
   - Exceeds character limits (40 for keys, 500 for values, 50 keys max)

Reference: https://workos.com/docs/audit-logs/metadata-schema

### "Log Stream not receiving events"

**Root cause:** Configuration error or network issue.

Fix:

1. **Check Stream status:** Dashboard → Audit Logs → Log Streams → Should show "Active"
2. **Test connectivity:**
   - For S3: Verify IAM role trust policy and permissions
   - For HTTP endpoints: Verify endpoint is publicly accessible or WorkOS IPs are allowlisted
   - For Datadog/Splunk: Verify API key/token is valid
3. **Check destination logs:**
   - Events may be delayed up to 60 seconds
   - Some destinations have rate limits
4. **Verify event emission:** Confirm events appear in Dashboard before troubleshooting stream

### "SDK method not found"

**Root cause:** SDK method names vary by language, or SDK version mismatch.

Fix:

1. Check WebFetch docs for correct method names in your language
2. Verify SDK version supports Audit Logs feature
3. Update SDK to latest version if needed

### "Object Lock bucket upload failed"

**Root cause:** S3 bucket has Object Lock enabled, requires `ContentMD5` header.

WorkOS automatically includes `ContentMD5` header. If uploads still fail:

1. Verify IAM role has `s3:PutObject` permission
2. Verify bucket policy allows cross-account PutObject
3. Check CloudTrail logs for specific S3 error

Reference: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html#object-lock-put-object

## Related Skills

- **workos-events**: Webhook event handling for WorkOS platform events
- **workos-directory-sync**: SCIM directory synchronization
- **workos-sso**: Single Sign-On implementation
