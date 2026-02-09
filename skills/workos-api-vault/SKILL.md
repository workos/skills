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

## Authentication Setup

Set the `Authorization` header on all requests:

```
Authorization: Bearer sk_your_api_key
```

Your API key must start with `sk_` and be obtained from the WorkOS Dashboard.

## Operation Decision Tree

**To encrypt sensitive data:**
- Use `POST /vault/key/encrypt-data` for data you control
- Use `POST /vault/key/create-data-key` for client-side encryption (returns encrypted key)

**To decrypt data:**
- Use `POST /vault/key/decrypt-data` for data encrypted by WorkOS
- Use `POST /vault/key/decrypt-data-key` for data keys (returns plaintext key for client-side decryption)

**To store encrypted objects:**
- Use `POST /vault/object/create` to create a new vault object
- Use `PUT /vault/object/update` to update an existing object (requires `id`)

**To retrieve encrypted objects:**
- Use `GET /vault/object/get` when you have the object `id`
- Use `GET /vault/object/get-by-name` to retrieve by a custom name field
- Use `GET /vault/object/list` to paginate through all objects

**To manage object metadata:**
- Use `GET /vault/object/metadata` to retrieve metadata without decrypting the object
- Use `GET /vault/object/versions` to list all versions of an object
- Use `GET /vault/object/version` to retrieve a specific version

**To remove objects:**
- Use `DELETE /vault/object/delete` to delete an object (requires `id`)

## Endpoint Catalog

### Key Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/key/encrypt-data` | Encrypt plaintext data |
| POST | `/vault/key/decrypt-data` | Decrypt encrypted data |
| POST | `/vault/key/create-data-key` | Generate an encrypted data key |
| POST | `/vault/key/decrypt-data-key` | Decrypt a data key |

### Object Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/object/create` | Create a new vault object |
| PUT | `/vault/object/update` | Update an existing object |
| GET | `/vault/object/get` | Retrieve object by ID |
| GET | `/vault/object/get-by-name` | Retrieve object by name |
| GET | `/vault/object/list` | List all objects (paginated) |
| GET | `/vault/object/metadata` | Get object metadata only |
| GET | `/vault/object/version` | Get a specific object version |
| GET | `/vault/object/versions` | List all object versions |
| DELETE | `/vault/object/delete` | Delete an object |

## Request/Response Patterns

### Encrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "sensitive-value",
    "key_id": "key_01234567890abcdef"
  }'
```

**Response:**
```json
{
  "encrypted_data": "AQIDAHi...",
  "key_id": "key_01234567890abcdef"
}
```

### Decrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_data": "AQIDAHi...",
    "key_id": "key_01234567890abcdef"
  }'
```

**Response:**
```json
{
  "data": "sensitive-value"
}
```

### Create Vault Object

**Request:**
```bash
curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-123-ssn",
    "data": {
      "ssn": "123-45-6789",
      "passport": "AB1234567"
    },
    "metadata": {
      "user_id": "user_123",
      "category": "pii"
    }
  }'
```

**Response:**
```json
{
  "id": "vault_obj_01234567890abcdef",
  "name": "user-123-ssn",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "version": 1
}
```

### Get Vault Object

**Request:**
```bash
curl -X GET https://api.workos.com/vault/object/get?id=vault_obj_01234567890abcdef \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response:**
```json
{
  "id": "vault_obj_01234567890abcdef",
  "name": "user-123-ssn",
  "data": {
    "ssn": "123-45-6789",
    "passport": "AB1234567"
  },
  "metadata": {
    "user_id": "user_123",
    "category": "pii"
  },
  "version": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### List Vault Objects (Paginated)

**Request:**
```bash
curl -X GET "https://api.workos.com/vault/object/list?limit=10&after=vault_obj_abc123" \
  -H "Authorization: Bearer sk_your_api_key"
```

**Response:**
```json
{
  "data": [
    {
      "id": "vault_obj_01234567890abcdef",
      "name": "user-123-ssn",
      "version": 1,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "list_metadata": {
    "after": "vault_obj_xyz789"
  }
}
```

### Update Vault Object

**Request:**
```bash
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01234567890abcdef",
    "data": {
      "ssn": "987-65-4321",
      "passport": "XY9876543"
    }
  }'
```

**Response:**
```json
{
  "id": "vault_obj_01234567890abcdef",
  "name": "user-123-ssn",
  "version": 2,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T11:45:00.000Z"
}
```

### Delete Vault Object

**Request:**
```bash
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01234567890abcdef"
  }'
```

**Response:**
```json
{
  "success": true
}
```

## Pagination Pattern

The `/vault/object/list` endpoint uses cursor-based pagination:

1. **First request:** Omit `after` parameter or set `limit` (default 10, max 100)
2. **Subsequent requests:** Use the `after` value from `list_metadata` in the response
3. **End of results:** `list_metadata.after` is `null` or absent

Example pagination loop:
```bash
# First page
curl -X GET "https://api.workos.com/vault/object/list?limit=50" \
  -H "Authorization: Bearer sk_your_api_key"

# Next page (use 'after' from previous response)
curl -X GET "https://api.workos.com/vault/object/list?limit=50&after=vault_obj_xyz789" \
  -H "Authorization: Bearer sk_your_api_key"
```

## Error Code Mapping

| Status Code | Cause | Fix |
|------------|-------|-----|
| 401 | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header is set correctly |
| 403 | API key lacks required permissions | Check API key permissions in WorkOS Dashboard |
| 404 | Object or key not found | Verify the `id` or `key_id` exists and is not deleted |
| 422 | Invalid request parameters | Check required fields: `data` (encrypt), `encrypted_data` (decrypt), `id` (update/delete) |
| 429 | Rate limit exceeded | Implement exponential backoff with retry after 1s, 2s, 4s, 8s |
| 500 | Internal server error | Retry with exponential backoff; contact support if persists |

### Specific Error Scenarios

**Missing required field:**
```json
{
  "error": "invalid_request",
  "message": "Missing required parameter: data"
}
```
Fix: Include all required fields in request body.

**Invalid object ID:**
```json
{
  "error": "not_found",
  "message": "Vault object not found"
}
```
Fix: Verify the object ID is correct and the object has not been deleted.

**Encryption key not found:**
```json
{
  "error": "not_found",
  "message": "Key not found"
}
```
Fix: Create the encryption key first or use a valid `key_id`.

## Rate Limit Guidance

The Vault API enforces rate limits per API key. When you receive a 429 response:

1. **Wait:** Start with a 1-second delay
2. **Retry:** Exponentially increase delay (1s → 2s → 4s → 8s)
3. **Max retries:** Stop after 5 attempts
4. **Check limits:** Review your plan limits in the WorkOS Dashboard

Example retry logic:
```bash
for i in {1..5}; do
  response=$(curl -X POST https://api.workos.com/vault/key/encrypt-data \
    -H "Authorization: Bearer sk_your_api_key" \
    -H "Content-Type: application/json" \
    -d '{"data": "value", "key_id": "key_123"}')
  
  if [[ $? -eq 0 ]]; then
    echo "$response"
    break
  fi
  
  sleep $((2**i))
done
```

## Runnable Verification

### Step 1: Test Authentication

```bash
curl -X GET https://api.workos.com/vault/object/list \
  -H "Authorization: Bearer sk_your_api_key" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP 200 with object list or empty array.

### Step 2: Test Encryption/Decryption

```bash
# Encrypt data
ENCRYPTED=$(curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"data": "test-value", "key_id": "key_01234567890abcdef"}' | jq -r '.encrypted_data')

echo "Encrypted: $ENCRYPTED"

# Decrypt data
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"encrypted_data\": \"$ENCRYPTED\", \"key_id\": \"key_01234567890abcdef\"}"
```

Expected: Decrypted response shows `"data": "test-value"`.

### Step 3: Test Object CRUD

```bash
# Create
OBJECT_ID=$(curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-object", "data": {"field": "value"}}' | jq -r '.id')

echo "Created: $OBJECT_ID"

# Read
curl -X GET "https://api.workos.com/vault/object/get?id=$OBJECT_ID" \
  -H "Authorization: Bearer sk_your_api_key"

# Update
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$OBJECT_ID\", \"data\": {\"field\": \"updated-value\"}}"

# Delete
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$OBJECT_ID\"}"
```

Expected: All operations return 200 status with appropriate responses.

## Related Skills

- **workos-vault** — Feature overview and implementation patterns for WorkOS Vault (encryption, object storage, versioning)
