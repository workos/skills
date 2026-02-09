---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/vault
- https://workos.com/docs/reference/vault/key
- https://workos.com/docs/reference/vault/key/create-data-key
- https://workos.com/docs/reference/vault/key/decrypt-data
- https://workos.com/docs/reference/vault/key/decrypt-data-key
- https://workos.com/docs/reference/vault/key/encrypt-data
- https://workos.com/docs/reference/vault/object
- https://workos.com/docs/reference/vault/object/create

## Authentication

All Vault API requests require authentication via `Authorization` header:

```
Authorization: Bearer sk_your_api_key
```

Set your API key as an environment variable:
```bash
export WORKOS_API_KEY=sk_your_api_key
```

## Endpoint Catalog

### Key Management Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/key/create-data-key` | Generate a new data encryption key |
| POST | `/vault/key/encrypt-data` | Encrypt plaintext data with a key |
| POST | `/vault/key/decrypt-data` | Decrypt ciphertext data with a key |
| POST | `/vault/key/decrypt-data-key` | Decrypt an encrypted data key |

### Object Storage Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/object/create` | Create a new vault object |
| GET | `/vault/object/get` | Retrieve object by ID |
| GET | `/vault/object/get-by-name` | Retrieve object by name |
| GET | `/vault/object/list` | List all vault objects |
| PUT | `/vault/object/update` | Update an existing object |
| DELETE | `/vault/object/delete` | Delete a vault object |
| GET | `/vault/object/metadata` | Get object metadata without decrypting |
| GET | `/vault/object/version` | Retrieve specific version of object |
| GET | `/vault/object/versions` | List all versions of an object |

## Operation Decision Tree

Use this tree to determine which endpoint to call:

```
Need to store sensitive data?
├─ First time storing → POST /vault/object/create
├─ Update existing → PUT /vault/object/update
└─ Already have object ID/name?
   ├─ Retrieve by ID → GET /vault/object/get
   ├─ Retrieve by name → GET /vault/object/get-by-name
   └─ Delete → DELETE /vault/object/delete

Need to encrypt/decrypt raw data?
├─ Generate encryption key → POST /vault/key/create-data-key
├─ Encrypt plaintext → POST /vault/key/encrypt-data
├─ Decrypt ciphertext → POST /vault/key/decrypt-data
└─ Decrypt encrypted key → POST /vault/key/decrypt-data-key

Need to browse/audit?
├─ List all objects → GET /vault/object/list
├─ View metadata only → GET /vault/object/metadata
└─ Check version history → GET /vault/object/versions
```

## Request/Response Patterns

### Create Vault Object

**Request:**
```bash
curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_ssn_12345",
    "data": "123-45-6789",
    "metadata": {
      "user_id": "user_12345",
      "field": "ssn"
    }
  }'
```

**Response (200 OK):**
```json
{
  "object": "vault_object",
  "id": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X",
  "name": "user_ssn_12345",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "version": 1
}
```

### Retrieve Vault Object

**Request:**
```bash
curl https://api.workos.com/vault/object/get?id=vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**
```json
{
  "object": "vault_object",
  "id": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X",
  "name": "user_ssn_12345",
  "data": "123-45-6789",
  "metadata": {
    "user_id": "user_12345",
    "field": "ssn"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "version": 1
}
```

### Update Vault Object

**Request:**
```bash
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X",
    "data": "987-65-4321"
  }'
```

**Response (200 OK):**
```json
{
  "object": "vault_object",
  "id": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X",
  "version": 2,
  "updated_at": "2024-01-15T11:00:00.000Z"
}
```

### List Vault Objects

**Request:**
```bash
curl "https://api.workos.com/vault/object/list?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "vault_object",
      "id": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0X",
      "name": "user_ssn_12345",
      "created_at": "2024-01-15T10:30:00.000Z",
      "version": 2
    }
  ],
  "list_metadata": {
    "before": null,
    "after": "vault_obj_01HX8Z9K2N3P4Q5R6S7T8V9W0Y"
  }
}
```

### Encrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "plaintext": "sensitive-value",
    "key_id": "key_01HX8Z9K2N3P4Q5R6S7T8V9W0A"
  }'
```

**Response (200 OK):**
```json
{
  "ciphertext": "AQIDAHj...encrypted-data...==",
  "key_id": "key_01HX8Z9K2N3P4Q5R6S7T8V9W0A"
}
```

### Decrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ciphertext": "AQIDAHj...encrypted-data...==",
    "key_id": "key_01HX8Z9K2N3P4Q5R6S7T8V9W0A"
  }'
```

**Response (200 OK):**
```json
{
  "plaintext": "sensitive-value",
  "key_id": "key_01HX8Z9K2N3P4Q5R6S7T8V9W0A"
}
```

## Pagination

List endpoints use cursor-based pagination with `before` and `after` parameters:

```bash
# First page
curl "https://api.workos.com/vault/object/list?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Next page (using 'after' from list_metadata)
curl "https://api.workos.com/vault/object/list?limit=10&after=vault_obj_01HX..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Previous page (using 'before' from list_metadata)
curl "https://api.workos.com/vault/object/list?limit=10&before=vault_obj_01HX..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Error Code Mapping

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| 400 | `invalid_request` | Missing required field (name, data) | Check request body includes all required fields |
| 401 | `unauthorized` | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is set |
| 403 | `forbidden` | API key lacks vault permissions | Enable Vault in WorkOS Dashboard |
| 404 | `not_found` | Object ID or name doesn't exist | Verify object exists with GET /vault/object/list |
| 409 | `conflict` | Object name already exists | Use unique name or update existing object |
| 422 | `unprocessable_entity` | Invalid data format or metadata | Check data is valid string and metadata is valid JSON object |
| 429 | `rate_limit_exceeded` | Too many requests | Implement exponential backoff (start with 1s delay) |
| 500 | `internal_server_error` | WorkOS service issue | Retry with exponential backoff, contact support if persists |

### Rate Limiting

Vault API enforces rate limits per API key. When you receive a 429 response:

1. Read `Retry-After` header (seconds to wait)
2. Implement exponential backoff: 1s → 2s → 4s → 8s
3. Maximum retry attempts: 5
4. Check https://workos.com/docs/reference/vault for current rate limits

## Runnable Verification

### Test Authentication

```bash
curl https://api.workos.com/vault/object/list?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Expected:** 200 OK with `{"object": "list", "data": [...]}`

### Test Create → Retrieve → Delete Flow

```bash
# 1. Create object
OBJECT_ID=$(curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_object_'$(date +%s)'",
    "data": "test-data"
  }' | jq -r '.id')

echo "Created: $OBJECT_ID"

# 2. Retrieve object
curl https://api.workos.com/vault/object/get?id=$OBJECT_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# 3. Delete object
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$OBJECT_ID\"}"
```

### Test Encryption Flow

```bash
# Create data key (WebFetch docs for current key_id format)
curl -X POST https://api.workos.com/vault/key/create-data-key \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"

# Encrypt data (use key_id from response)
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "plaintext": "test-value",
    "key_id": "key_01HX..."
  }'
```

## Related Skills

- **workos-vault** — Feature overview and integration patterns for WorkOS Vault
- **workos-api-authkit** — Authentication API for user identity management
- **workos-api-organization** — Organization management for multi-tenant data isolation
