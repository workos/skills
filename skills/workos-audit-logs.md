---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs before implementing any audit log features:

- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (required for Admin Portal integration)

### SDK Installation

Verify WorkOS SDK is installed:

```bash
# Check package.json for SDK
grep "@workos-inc" package.json || echo "SDK not installed"

# Verify SDK in node_modules
ls node_modules/@workos-inc/node 2>/dev/null || echo "SDK missing from node_modules"
```

If SDK is missing, install it before proceeding (npm/pnpm/yarn detection in fetched docs).

## Step 3: Event Schema Design (Decision Tree)

Decide whether events need metadata validation:

```
Does event metadata need strict validation?
  |
  +-- YES --> Define JSON Schema in WorkOS Dashboard
  |           |
  |           +-- Root event metadata
  |           +-- Actor metadata
  |           +-- Target metadata
  |
  +-- NO  --> Use arbitrary metadata (default behavior)
```

**Metadata limits (enforced by API):**

- Maximum 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

### JSON Schema Configuration

If validation required, configure in WorkOS Dashboard:

1. Navigate to event configuration
2. Check "Require metadata schema validation" checkbox
3. Use schema editor to define JSON Schema for each metadata object
4. Test schema with sample events before deploying

**Critical:** Schema validation is optional. Only enable if you need type safety. Invalid events will return errors if schema is enforced.

## Step 4: Implement Event Emission

Use SDK methods from fetched docs to emit audit log events. Typical pattern:

```typescript
// Example structure - exact method names in fetched docs
await workos.auditLogs.createEvent({
  organizationId: "org_123",
  event: {
    action: "user.signed_in",
    actor: {
      id: "user_456",
      type: "user",
      metadata: {
        /* follows schema if enabled */
      },
    },
    targets: [
      {
        id: "resource_789",
        type: "document",
        metadata: {
          /* follows schema if enabled */
        },
      },
    ],
    metadata: {
      /* root metadata - follows schema if enabled */
    },
  },
});
```

**Check fetched docs for:**

- Exact method name (`createEvent`, `create`, or similar)
- Required vs optional fields
- Supported action naming conventions

## Step 5: Configure Log Streams (Optional)

Log Streams enable customers to export audit logs to SIEM providers. Configuration can be:

- Admin-configured via WorkOS Dashboard (you set up)
- Customer-configured via Admin Portal (they set up)

```
Who configures Log Streams?
  |
  +-- Your team --> Configure in WorkOS Dashboard
  |                 (centralized control)
  |
  +-- Customers  --> Enable Admin Portal
                     (self-service)
```

### Supported Stream Destinations

From fetched docs:

1. **Datadog** - Uses HTTP Log Intake API with regional endpoints
2. **Splunk** - Uses HTTP Event Collector (HEC)
3. **AWS S3** - Individual JSON files per event (uses cross-account IAM role with external ID)
4. **Google Cloud Storage** - Object storage
5. **HTTP POST (Generic)** - Any custom endpoint

### IP Allowlist (CRITICAL for Restricted Hosts)

If streaming to IP-restricted endpoints, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Reference:** https://workos.com/docs/audit-logs/log-streams (IP allowlist section)

### AWS S3 Configuration Notes

- WorkOS uses cross-account IAM role authentication
- External ID required (see https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)
- Objects uploaded with `ContentMD5` header for Object Lock support
- Check fetched docs for exact IAM policy requirements

## Step 6: Admin Portal Integration (Optional)

If customers need self-service audit log management:

1. Enable Admin Portal for your WorkOS application
2. Generate Admin Portal link with appropriate scopes
3. Include `audit_logs` scope in portal configuration

**Check fetched docs for:**

- Exact scope names
- Portal link generation method
- Allowed customer actions (viewing, exporting, stream configuration)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" .env* 2>/dev/null || echo "FAIL: Missing env vars"

# 2. Verify SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check for audit log event emission code
grep -r "auditLogs\|audit.*log.*event" src/ app/ 2>/dev/null || echo "WARNING: No audit log code found"

# 4. Test API connectivity (requires valid API key)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/audit_logs/events \
     -s -o /dev/null -w "%{http_code}\n" | grep -E "^(200|401)$" || echo "FAIL: API unreachable"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**All checks must return success or pass silently.** Investigate any FAIL messages before marking complete.

## Error Recovery

### "Invalid metadata schema" / 422 Unprocessable Entity

**Root cause:** Event metadata doesn't match configured JSON Schema.

Fix:

1. Check WorkOS Dashboard → Event Configuration → Schema Editor
2. Verify metadata structure matches schema (root, actor, targets)
3. Check metadata limits: 50 keys max, 40 char keys, 500 char values
4. Test with sample event in Dashboard before deploying
5. **If schema not needed:** Disable "Require metadata schema validation" in Dashboard

### "Unauthorized" / 401 when creating events

**Root cause:** Invalid API key or insufficient permissions.

Fix:

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is not expired in WorkOS Dashboard → API Keys
3. Verify key has "Audit Logs" permission enabled
4. **Never** use client ID (`client_*`) for server-side API calls

### Log Stream events not appearing in SIEM

**Decision tree for debugging:**

```
Events created successfully?
  |
  +-- NO --> Fix event creation first (see 401 error above)
  |
  +-- YES --> Is Log Stream configured?
              |
              +-- NO --> Configure stream in Dashboard or Admin Portal
              |
              +-- YES --> Check destination-specific settings:
                          |
                          +-- Datadog: Verify API key and regional endpoint
                          +-- Splunk: Verify HEC token and endpoint
                          +-- S3: Verify IAM role trust policy and external ID
                          +-- HTTP: Check endpoint responds to POST with 2xx
```

**For IP-restricted endpoints:** Verify WorkOS IPs are allowlisted (see Step 5).

### "SDK method not found" when emitting events

**Root cause:** SDK version mismatch or incorrect import.

Fix:

1. Check SDK version: `npm list @workos-inc/node`
2. Update SDK if outdated: `npm update @workos-inc/node`
3. Verify import path matches SDK version (check fetched docs)
4. **Common mistake:** Mixing client-side and server-side SDK imports

### Events missing required fields

**Root cause:** Omitted required properties in event structure.

Fix from fetched docs:

1. Check required fields: `organizationId`, `action`, `actor.id`, `actor.type`
2. Verify `targets` array structure if provided
3. Check `occurred_at` timestamp format (ISO 8601 if provided)
4. **Reference:** https://workos.com/docs/audit-logs/index (event structure section)

### AWS S3 stream "Access Denied"

**Root cause:** IAM role trust policy or permissions misconfigured.

Fix:

1. Verify IAM role ARN in WorkOS Dashboard matches created role
2. Check trust policy allows WorkOS account with correct external ID
3. Verify role has `s3:PutObject` permission on target bucket
4. Check bucket policy doesn't block cross-account access
5. **Reference:** Fetched docs for exact IAM policy template

## Related Skills

- **workos-admin-portal**: Self-service portal for customer audit log management
- **workos-organizations**: Organization setup required for multi-tenant audit logs
