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

## Overview

WorkOS Vault provides secure storage and encryption for sensitive data. The API has two primary namespaces:

- **Key endpoints** — encrypt/decrypt data directly using WorkOS-managed keys
- **Object endpoints** — store encrypted data with metadata, versioning, and retrieval capabilities

## Authentication

All Vault API requests require authentication via API key in the `Authorization` header:

```bash
Authorization: Bearer sk_test_your_api_key_here
```

Get your API key from the WorkOS Dashboard under API Keys. Use `sk_test_*` for testing and `sk_live_*` for production.

## Endpoint Catalog

### Key Operations

| Method | Endpoint                      | Purpose                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| POST   | `/vault/key/create-data-key`  | Generate a new data encryption key (DEK) |
| POST   | `/vault/key/encrypt-data`     | Encrypt plaintext data                   |
| POST   | `/vault/key/decrypt-data`     | Decrypt ciphertext data                  |
| POST   | `/vault/key/decrypt-data-key` | Decrypt an encrypted DEK                 |

### Object Operations

| Method | Endpoint                    | Purpose                        |
| ------ | --------------------------- | ------------------------------ |
| POST   | `/vault/object/create`      | Create a new encrypted object  |
| GET    | `/vault/object/get`         | Retrieve object by ID          |
| GET    | `/vault/object/get-by-name` | Retrieve object by name        |
| PUT    | `/vault/object/update`      | Update an existing object      |
| DELETE | `/vault/object/delete`      | Delete an object               |
| GET    | `/vault/object/list`        | List all objects (paginated)   |
| PUT    | `/vault/object/metadata`    | Update object metadata only    |
| GET    | `/vault/object/version`     | Get a specific object version  |
| GET    | `/vault/object/versions`    | List all versions of an object |

## Operation Decision Tree

**Choose between Key operations and Object operations:**

```
Need to store data with metadata/versioning?
├─ YES → Use Object endpoints (create, get, update, delete)
└─ NO → Need just encryption/decryption? Use Key endpoints (encrypt-data, decrypt-data)

Creating encrypted data?
├─ With metadata/name/versioning → POST /object/create
├─ Just encrypt bytes → POST /key/encrypt-data
└─ Need your own key → POST /key/create-data-key

Retrieving encrypted data?
├─ By object ID → GET /object/get
├─ By name → GET /object/get-by-name
├─ Specific version → GET /object/version
└─ List all → GET /object/list

Modifying existing data?
├─ Update data + metadata → PUT /object/update
├─ Update metadata only → PUT /object/metadata
└─ Delete → DELETE /object/delete

Need to decrypt?
├─ Object stored in Vault → GET /object/get (returns decrypted data)
├─ Ciphertext from key/encrypt-data → POST /key/decrypt-data
└─ Encrypted DEK → POST /key/decrypt-data-key
```

## Request/Response Patterns

### Encrypt Data (Key Operation)

**Request:**

```bash
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "sensitive-value-to-encrypt"
  }'
```

**Response:**

```json
{
  "ciphertext": "encrypted_base64_string",
  "key_id": "key_01H1234567890ABCDEFGHIJK"
}
```

### Decrypt Data (Key Operation)

**Request:**

```bash
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "ciphertext": "encrypted_base64_string"
  }'
```

**Response:**

```json
{
  "data": "sensitive-value-to-encrypt"
}
```

### Create Object

**Request:**

```bash
curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_ssn",
    "data": "123-45-6789",
    "metadata": {
      "user_id": "user_01H1234567890",
      "purpose": "tax_reporting"
    }
  }'
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890ABCDEFGHIJK",
  "name": "user_ssn",
  "version": 1,
  "metadata": {
    "user_id": "user_01H1234567890",
    "purpose": "tax_reporting"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get Object

**Request:**

```bash
curl -X GET "https://api.workos.com/vault/object/get?id=vault_obj_01H1234567890ABCDEFGHIJK" \
  -H "Authorization: Bearer sk_test_your_api_key"
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890ABCDEFGHIJK",
  "name": "user_ssn",
  "data": "123-45-6789",
  "version": 1,
  "metadata": {
    "user_id": "user_01H1234567890",
    "purpose": "tax_reporting"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

Note: The `data` field is automatically decrypted when retrieved.

### Update Object

**Request:**

```bash
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01H1234567890ABCDEFGHIJK",
    "data": "987-65-4321",
    "metadata": {
      "user_id": "user_01H1234567890",
      "purpose": "tax_reporting",
      "updated_reason": "correction"
    }
  }'
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890ABCDEFGHIJK",
  "name": "user_ssn",
  "version": 2,
  "metadata": {
    "user_id": "user_01H1234567890",
    "purpose": "tax_reporting",
    "updated_reason": "correction"
  },
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T11:45:00.000Z"
}
```

### List Objects (Paginated)

**Request:**

```bash
curl -X GET "https://api.workos.com/vault/object/list?limit=10&after=vault_obj_01H1234567890" \
  -H "Authorization: Bearer sk_test_your_api_key"
```

**Response:**

```json
{
  "data": [
    {
      "id": "vault_obj_01H1234567890ABCDEFGHIJK",
      "name": "user_ssn",
      "version": 2,
      "metadata": {...},
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T11:45:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "vault_obj_01H9999999999ZZZZZZZZZZZ"
  }
}
```

Note: List operations do NOT return the encrypted `data` field — only metadata. Retrieve individual objects to access data.

## Pagination Pattern

The Vault API uses cursor-based pagination for list operations:

1. First request: `GET /vault/object/list?limit=50`
2. Check `list_metadata.after` in response
3. Next page: `GET /vault/object/list?limit=50&after=vault_obj_last_id_from_previous_page`
4. Continue until `list_metadata.after` is null or empty

## Error Codes and Recovery

| Status Code | Cause                                                   | Fix                                                           |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 400         | Missing required field (e.g., `data` in create request) | Check request body includes all required fields per endpoint  |
| 401         | Invalid or missing API key                              | Verify `Authorization: Bearer sk_*` header is set correctly   |
| 403         | API key lacks permission for Vault operations           | Enable Vault in WorkOS Dashboard and regenerate API key       |
| 404         | Object ID or name not found                             | Verify object exists with GET /object/list or check ID format |
| 409         | Object with same name already exists                    | Use a different name or update the existing object            |
| 422         | Invalid data format (e.g., ciphertext corrupted)        | Ensure ciphertext was not modified; re-encrypt if necessary   |
| 429         | Rate limit exceeded                                     | Implement exponential backoff (wait 1s, 2s, 4s, 8s...)        |
| 500/502/503 | WorkOS service error                                    | Retry with exponential backoff; check status.workos.com       |

**Common Debugging Steps:**

- **"Invalid ciphertext" error:** Ciphertext must be decrypted with the same WorkOS environment (test vs live) that encrypted it. Test keys cannot decrypt live ciphertexts.
- **"Object not found" with correct ID:** Object may have been deleted. Check `/object/list` to confirm existence.
- **"Name already exists" on create:** Use `/object/get-by-name` to retrieve existing object, then decide whether to update or choose a different name.

## Rate Limits

The Vault API enforces rate limits to ensure service stability:

- **Key operations:** 1000 requests per minute per API key
- **Object operations:** 500 requests per minute per API key

When you hit a rate limit (HTTP 429), implement exponential backoff:

```bash
# Pseudocode retry logic
retry_count = 0
max_retries = 5

while retry_count < max_retries:
  response = make_api_call()

  if response.status == 429:
    wait_seconds = 2 ** retry_count  # 1s, 2s, 4s, 8s, 16s
    sleep(wait_seconds)
    retry_count += 1
  else:
    break
```

## Versioning

Every update to a Vault object creates a new version. The current version is returned in the `version` field.

**Retrieve a specific version:**

```bash
curl -X GET "https://api.workos.com/vault/object/version?id=vault_obj_01H1234567890&version=1" \
  -H "Authorization: Bearer sk_test_your_api_key"
```

**List all versions:**

```bash
curl -X GET "https://api.workos.com/vault/object/versions?id=vault_obj_01H1234567890" \
  -H "Authorization: Bearer sk_test_your_api_key"
```

**Response:**

```json
{
  "data": [
    {
      "version": 2,
      "data": "987-65-4321",
      "metadata": {...},
      "updated_at": "2024-01-15T11:45:00.000Z"
    },
    {
      "version": 1,
      "data": "123-45-6789",
      "metadata": {...},
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

Versions are immutable. Deleting an object deletes all versions.

## Runnable Verification

### 1. Verify API Key Access

```bash
curl -X GET "https://api.workos.com/vault/object/list?limit=1" \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with empty or populated object list.

### 2. Test Encrypt/Decrypt Cycle

```bash
# Encrypt
ENCRYPTED=$(curl -s -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"data": "test-secret-123"}' | jq -r '.ciphertext')

echo "Encrypted: $ENCRYPTED"

# Decrypt
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"ciphertext\": \"$ENCRYPTED\"}"
```

Expected output: `{"data": "test-secret-123"}`

### 3. Test Object CRUD Flow

```bash
# Create
OBJECT_ID=$(curl -s -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_object_'$(date +%s)'",
    "data": "initial-value",
    "metadata": {"test": "true"}
  }' | jq -r '.id')

echo "Created object: $OBJECT_ID"

# Retrieve
curl -s -X GET "https://api.workos.com/vault/object/get?id=$OBJECT_ID" \
  -H "Authorization: Bearer sk_test_your_api_key" | jq

# Update
curl -s -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$OBJECT_ID\",
    \"data\": \"updated-value\"
  }" | jq

# Delete
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$OBJECT_ID\"}"
```

Expected: Each operation returns HTTP 200 with appropriate response body.

## Related Skills

- workos-api-user-management (for storing sensitive user data like SSNs, passwords, etc.)
