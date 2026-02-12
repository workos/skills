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

Authenticate all requests with your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_test_1234567890
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_test_1234567890"
```

## Endpoint Catalog

### Data Key Management

| Method | Endpoint                      | Purpose                                             |
| ------ | ----------------------------- | --------------------------------------------------- |
| POST   | `/vault/key/create-data-key`  | Generate a new data encryption key (DEK)            |
| POST   | `/vault/key/encrypt-data`     | Encrypt plaintext data with WorkOS-managed keys     |
| POST   | `/vault/key/decrypt-data`     | Decrypt ciphertext data                             |
| POST   | `/vault/key/decrypt-data-key` | Decrypt an encrypted DEK for client-side operations |

### Vault Object Storage

| Method | Endpoint                    | Purpose                            |
| ------ | --------------------------- | ---------------------------------- |
| POST   | `/vault/object/create`      | Store encrypted data in Vault      |
| GET    | `/vault/object/get`         | Retrieve an object by ID           |
| GET    | `/vault/object/get-by-name` | Retrieve an object by name         |
| GET    | `/vault/object/list`        | List all vault objects (paginated) |
| PUT    | `/vault/object/update`      | Update an existing vault object    |
| DELETE | `/vault/object/delete`      | Delete a vault object              |
| GET    | `/vault/object/metadata`    | Get object metadata without data   |
| GET    | `/vault/object/version`     | Retrieve a specific object version |
| GET    | `/vault/object/versions`    | List all versions of an object     |

## Operation Decision Tree

### Choosing the Right Endpoint

**Need to encrypt data?**

- Store AND encrypt → `POST /vault/object/create`
- Just encrypt (no storage) → `POST /vault/key/encrypt-data`
- Client-side encryption → `POST /vault/key/create-data-key` then encrypt locally

**Need to decrypt data?**

- Stored in Vault → `GET /vault/object/get` (returns decrypted data automatically)
- Have ciphertext → `POST /vault/key/decrypt-data`
- Have encrypted DEK → `POST /vault/key/decrypt-data-key` then decrypt locally

**Need to manage stored data?**

- Create new → `POST /vault/object/create`
- Update existing → `PUT /vault/object/update`
- Read by ID → `GET /vault/object/get`
- Read by name → `GET /vault/object/get-by-name`
- Search/browse → `GET /vault/object/list`
- Delete → `DELETE /vault/object/delete`

**Need version history?**

- List versions → `GET /vault/object/versions`
- Get specific version → `GET /vault/object/version?version={id}`

## Request/Response Patterns

### Encrypt Data (Server-Side)

**Request:**

```bash
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "plaintext": "sensitive-data-to-encrypt"
  }'
```

**Response:**

```json
{
  "ciphertext": "encrypted_base64_string",
  "key_id": "key_01H1234567890"
}
```

### Decrypt Data (Server-Side)

**Request:**

```bash
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ciphertext": "encrypted_base64_string"
  }'
```

**Response:**

```json
{
  "plaintext": "sensitive-data-to-encrypt"
}
```

### Create Vault Object

**Request:**

```bash
curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_ssn",
    "data": "123-45-6789",
    "metadata": {
      "user_id": "user_123",
      "type": "ssn"
    }
  }'
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890",
  "name": "user_ssn",
  "version": 1,
  "metadata": {
    "user_id": "user_123",
    "type": "ssn"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Retrieve Vault Object

**Request:**

```bash
curl -X GET "https://api.workos.com/vault/object/get?id=vault_obj_01H1234567890" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890",
  "name": "user_ssn",
  "data": "123-45-6789",
  "version": 1,
  "metadata": {
    "user_id": "user_123",
    "type": "ssn"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### List Vault Objects (Paginated)

**Request:**

```bash
curl -X GET "https://api.workos.com/vault/object/list?limit=10&after=vault_obj_01H123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**

```json
{
  "data": [
    {
      "id": "vault_obj_01H1234567890",
      "name": "user_ssn",
      "version": 1,
      "metadata": {...},
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "list_metadata": {
    "after": "vault_obj_01H9999999999"
  }
}
```

### Update Vault Object

**Request:**

```bash
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01H1234567890",
    "data": "987-65-4321",
    "metadata": {
      "user_id": "user_123",
      "type": "ssn",
      "updated_reason": "correction"
    }
  }'
```

**Response:**

```json
{
  "id": "vault_obj_01H1234567890",
  "name": "user_ssn",
  "version": 2,
  "metadata": {...},
  "updated_at": "2024-01-16T14:20:00Z"
}
```

### Delete Vault Object

**Request:**

```bash
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01H1234567890"
  }'
```

**Response:**

```json
{
  "deleted": true
}
```

## Pagination Pattern

The `/vault/object/list` endpoint uses cursor-based pagination:

1. **First request:** Call without `after` parameter
2. **Subsequent requests:** Use `list_metadata.after` value from previous response
3. **End of results:** When `list_metadata.after` is absent or data array is empty

**Example pagination loop:**

```bash
# First page
curl -X GET "https://api.workos.com/vault/object/list?limit=100" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Next page (use 'after' from response)
curl -X GET "https://api.workos.com/vault/object/list?limit=100&after=vault_obj_01H999" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## Error Code Mapping

### 400 Bad Request

**Cause:** Invalid request parameters or missing required fields  
**Fix:** Check request body matches expected schema from fetched docs  
**Example:** Missing `plaintext` field in encrypt request

### 401 Unauthorized

**Cause:** Missing, invalid, or expired API key  
**Fix:** Verify `Authorization: Bearer sk_...` header is present and key is valid  
**Check:** API key starts with `sk_test_` or `sk_live_`

### 403 Forbidden

**Cause:** API key lacks permission for this operation  
**Fix:** Check API key permissions in WorkOS Dashboard under API Keys  
**Note:** Ensure key has Vault read/write permissions enabled

### 404 Not Found

**Cause:** Vault object ID does not exist or was deleted  
**Fix:** Verify object ID is correct; check if object was previously deleted  
**Tip:** Use `/vault/object/list` to find valid object IDs

### 429 Too Many Requests

**Cause:** Rate limit exceeded  
**Fix:** Implement exponential backoff with jitter  
**Retry-After:** Check response header for retry delay (seconds)

**Retry pattern:**

```bash
# Wait for Retry-After seconds, then retry
sleep $RETRY_AFTER_SECONDS
# Retry request
```

### 500 Internal Server Error

**Cause:** WorkOS service error  
**Fix:** Retry with exponential backoff (2s, 4s, 8s)  
**Escalate:** If persists after 3 retries, contact WorkOS support

## Rate Limiting

- **Default limits:** Apply per API key across all Vault endpoints
- **Headers returned:**
  - `X-RateLimit-Limit` — requests allowed per window
  - `X-RateLimit-Remaining` — requests remaining in current window
  - `X-RateLimit-Reset` — Unix timestamp when limit resets

**Retry strategy:**

1. Catch 429 responses
2. Read `Retry-After` header (seconds to wait)
3. Wait specified duration plus 0-1s jitter
4. Retry request
5. If 429 persists after 3 attempts, log error and alert

## Runnable Verification

### Test Encrypt/Decrypt Flow

```bash
# 1. Encrypt data
ENCRYPTED=$(curl -s -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"plaintext": "test-secret-123"}' \
  | jq -r '.ciphertext')

echo "Encrypted: $ENCRYPTED"

# 2. Decrypt data
DECRYPTED=$(curl -s -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"ciphertext\": \"$ENCRYPTED\"}" \
  | jq -r '.plaintext')

echo "Decrypted: $DECRYPTED"

# Expected: "test-secret-123"
```

### Test Vault Object CRUD

```bash
# 1. Create object
OBJECT_ID=$(curl -s -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_object",
    "data": "sensitive-value",
    "metadata": {"test": "true"}
  }' \
  | jq -r '.id')

echo "Created: $OBJECT_ID"

# 2. Retrieve object
curl -s -X GET "https://api.workos.com/vault/object/get?id=$OBJECT_ID" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data'

# Expected: "sensitive-value"

# 3. Update object
curl -s -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$OBJECT_ID\",
    \"data\": \"updated-value\"
  }" \
  | jq '.version'

# Expected: 2

# 4. Delete object
curl -s -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$OBJECT_ID\"}" \
  | jq '.deleted'

# Expected: true
```

### Test Pagination

```bash
# List first page
AFTER=$(curl -s -X GET "https://api.workos.com/vault/object/list?limit=2" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq -r '.list_metadata.after')

echo "Next cursor: $AFTER"

# List next page
curl -s -X GET "https://api.workos.com/vault/object/list?limit=2&after=$AFTER" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq '.data[].id'
```

## Common Integration Patterns

### Pattern 1: Store User PII

**Use Case:** Encrypt and store SSN, credit card, or other regulated data

**Implementation:**

1. Use `POST /vault/object/create` with user identifier in metadata
2. Store returned `object_id` in your database (unencrypted)
3. Retrieve with `GET /vault/object/get` when needed
4. Data is automatically encrypted at rest and in transit

### Pattern 2: Transparent Field Encryption

**Use Case:** Encrypt specific database fields without schema changes

**Implementation:**

1. Before write: Call `POST /vault/key/encrypt-data` with field value
2. Store returned ciphertext in database (string column)
3. Before read: Call `POST /vault/key/decrypt-data` with ciphertext
4. Return decrypted plaintext to application

### Pattern 3: Client-Side Encryption (BYOK)

**Use Case:** Encrypt data in browser/mobile app before sending to server

**Implementation:**

1. Backend generates DEK: `POST /vault/key/create-data-key`
2. Backend sends encrypted DEK to client (safe to transmit)
3. Client decrypts DEK locally with WorkOS SDK
4. Client encrypts data with DEK, sends to backend
5. Backend stores ciphertext (never sees plaintext)

## Related Skills

- workos-authkit-base — Authentication before Vault access
- workos-directory-sync.rules.yml — Sync encrypted user data across directories
