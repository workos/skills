---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- generated -->

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

All requests require an API key in the Authorization header:

```
Authorization: Bearer sk_live_your_api_key_here
```

Set your API key as an environment variable:
```bash
export WORKOS_API_KEY='sk_live_your_api_key_here'
```

## Endpoint Catalog

### Data Encryption Key Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/key/create-data-key` | Generate a new data encryption key (DEK) |
| POST | `/vault/key/encrypt-data` | Encrypt data using a DEK |
| POST | `/vault/key/decrypt-data` | Decrypt data using a DEK |
| POST | `/vault/key/decrypt-data-key` | Decrypt an encrypted DEK |

### Vault Object Operations (CRUD)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/vault/object/create` | Store sensitive data as a new object |
| GET | `/vault/object/get` | Retrieve object by ID |
| GET | `/vault/object/get-by-name` | Retrieve object by name |
| PUT | `/vault/object/update` | Update existing object data |
| DELETE | `/vault/object/delete` | Delete a vault object |
| GET | `/vault/object/list` | List all vault objects (paginated) |
| GET | `/vault/object/metadata` | Retrieve object metadata only |
| GET | `/vault/object/version` | Get specific version of object |
| GET | `/vault/object/versions` | List all versions of object |

## Operation Decision Tree

**Choose your endpoint based on your use case:**

### Encryption Operations (Client-Side Control)
- **Need to encrypt data yourself?** → Use `/vault/key/create-data-key` + `/vault/key/encrypt-data`
- **Need to decrypt encrypted data?** → Use `/vault/key/decrypt-data`
- **Need to decrypt a DEK?** → Use `/vault/key/decrypt-data-key`

### Vault Object Operations (Server-Side Storage)
- **First time storing data?** → Use `POST /vault/object/create`
- **Updating existing data?** → Use `PUT /vault/object/update` (if you have object ID)
- **Don't know if object exists?** → Try `GET /vault/object/get-by-name`, then create or update
- **Retrieving data by ID?** → Use `GET /vault/object/get`
- **Retrieving data by name?** → Use `GET /vault/object/get-by-name`
- **Removing data?** → Use `DELETE /vault/object/delete`
- **Need all objects?** → Use `GET /vault/object/list` (with pagination)
- **Need only metadata?** → Use `GET /vault/object/metadata`
- **Working with versioning?** → Use `GET /vault/object/version` or `/vault/object/versions`

## Request/Response Patterns

### Create Data Encryption Key

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/create-data-key \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "key_id": "key_01HXYZ...",
  "plaintext_key": "base64_encoded_key",
  "ciphertext_key": "encrypted_key_material"
}
```

### Encrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "key_id": "key_01HXYZ...",
    "plaintext": "sensitive data to encrypt"
  }'
```

**Response:**
```json
{
  "ciphertext": "encrypted_base64_data",
  "key_id": "key_01HXYZ..."
}
```

### Decrypt Data

**Request:**
```bash
curl -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ciphertext": "encrypted_base64_data",
    "key_id": "key_01HXYZ..."
  }'
```

**Response:**
```json
{
  "plaintext": "decrypted data",
  "key_id": "key_01HXYZ..."
}
```

### Create Vault Object

**Request:**
```bash
curl -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer_ssn",
    "data": {
      "ssn": "123-45-6789",
      "customer_id": "cust_12345"
    }
  }'
```

**Response:**
```json
{
  "id": "vault_obj_01HXYZ...",
  "name": "customer_ssn",
  "version": 1,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### Get Vault Object by ID

**Request:**
```bash
curl -X GET "https://api.workos.com/vault/object/get?id=vault_obj_01HXYZ..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "id": "vault_obj_01HXYZ...",
  "name": "customer_ssn",
  "version": 1,
  "data": {
    "ssn": "123-45-6789",
    "customer_id": "cust_12345"
  },
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### Get Vault Object by Name

**Request:**
```bash
curl -X GET "https://api.workos.com/vault/object/get-by-name?name=customer_ssn" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:** Same as Get by ID

### Update Vault Object

**Request:**
```bash
curl -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01HXYZ...",
    "data": {
      "ssn": "987-65-4321",
      "customer_id": "cust_12345"
    }
  }'
```

**Response:**
```json
{
  "id": "vault_obj_01HXYZ...",
  "name": "customer_ssn",
  "version": 2,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T11:30:00.000Z"
}
```

### Delete Vault Object

**Request:**
```bash
curl -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vault_obj_01HXYZ..."
  }'
```

**Response:**
```json
{
  "success": true
}
```

### List Vault Objects

**Request:**
```bash
curl -X GET "https://api.workos.com/vault/object/list?limit=10&before=vault_obj_01ABC..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "data": [
    {
      "id": "vault_obj_01HXYZ...",
      "name": "customer_ssn",
      "version": 1,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "list_metadata": {
    "before": "vault_obj_01ABC...",
    "after": "vault_obj_01XYZ..."
  }
}
```

### Get Object Metadata Only

**Request:**
```bash
curl -X GET "https://api.workos.com/vault/object/metadata?id=vault_obj_01HXYZ..." \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Response:**
```json
{
  "id": "vault_obj_01HXYZ...",
  "name": "customer_ssn",
  "version": 1,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

## Pagination Handling

The `/vault/object/list` endpoint uses cursor-based pagination:

1. **Initial request:** `GET /vault/object/list?limit=10`
2. **Response includes cursors:**
   ```json
   {
     "data": [...],
     "list_metadata": {
       "before": "vault_obj_01ABC...",
       "after": "vault_obj_01XYZ..."
     }
   }
   ```
3. **Next page:** Use `before` cursor: `GET /vault/object/list?limit=10&before=vault_obj_01ABC...`
4. **Previous page:** Use `after` cursor: `GET /vault/object/list?limit=10&after=vault_obj_01XYZ...`
5. **End of list:** When `before` is `null`, you've reached the end

## Error Code Mapping

### 400 Bad Request
- **Cause:** Invalid request body or missing required fields
- **Fix:** Check request JSON matches the expected schema from docs
- **Example:** Missing `name` field in object creation

### 401 Unauthorized
- **Cause:** Missing or invalid API key
- **Fix:** Verify `Authorization: Bearer sk_live_...` header is present and key is valid
- **Check:** API key should start with `sk_live_` or `sk_test_`

### 403 Forbidden
- **Cause:** API key lacks permissions for this operation
- **Fix:** Check API key permissions in WorkOS Dashboard
- **Note:** Ensure Vault feature is enabled for your environment

### 404 Not Found
- **Cause:** Object ID or name doesn't exist
- **Fix:** Verify the object ID/name is correct; use `/vault/object/list` to check available objects
- **Note:** Objects are environment-specific (test vs production)

### 409 Conflict
- **Cause:** Object name already exists (when creating)
- **Fix:** Use `/vault/object/update` instead, or choose a different name
- **Pattern:** Check with `/vault/object/get-by-name` first

### 422 Unprocessable Entity
- **Cause:** Invalid data format or constraint violation
- **Fix:** Validate data types and value constraints before sending
- **Example:** Data field exceeds maximum size limit

### 429 Too Many Requests
- **Cause:** Rate limit exceeded
- **Fix:** Implement exponential backoff: wait 1s, 2s, 4s, 8s between retries
- **Pattern:** Check `Retry-After` header if present

### 500 Internal Server Error
- **Cause:** WorkOS service issue
- **Fix:** Retry with exponential backoff; check status.workos.com
- **Pattern:** Safe to retry idempotent operations (GET, DELETE)

### 503 Service Unavailable
- **Cause:** Temporary service outage or maintenance
- **Fix:** Retry after delay; check status.workos.com
- **Pattern:** Implement circuit breaker after 3 consecutive failures

## Rate Limits

WorkOS Vault applies rate limits per API key. When approaching limits:

1. **Monitor response headers:**
   - `X-RateLimit-Limit`: Total requests allowed per window
   - `X-RateLimit-Remaining`: Requests remaining in current window
   - `X-RateLimit-Reset`: Unix timestamp when window resets

2. **Implement retry strategy:**
   ```bash
   # Example retry with exponential backoff
   for i in {1..5}; do
     response=$(curl -w "%{http_code}" -s -o response.json \
       -X GET "https://api.workos.com/vault/object/get?id=vault_obj_01HXYZ..." \
       -H "Authorization: Bearer ${WORKOS_API_KEY}")
     
     if [ $response -eq 429 ]; then
       wait_time=$((2 ** i))
       echo "Rate limited. Waiting ${wait_time}s..."
       sleep $wait_time
     else
       break
     fi
   done
   ```

3. **Best practices:**
   - Batch operations when possible (use list endpoints)
   - Cache metadata responses (they change less frequently)
   - Implement client-side request queuing

## Runnable Verification Commands

### Verify Authentication
```bash
# Should return 401 with invalid key
curl -X GET "https://api.workos.com/vault/object/list" \
  -H "Authorization: Bearer invalid_key" \
  -w "\nHTTP Status: %{http_code}\n"

# Should return 200 with valid key
curl -X GET "https://api.workos.com/vault/object/list" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -w "\nHTTP Status: %{http_code}\n"
```

### End-to-End Encryption Flow
```bash
# 1. Create a data encryption key
DEK_RESPONSE=$(curl -s -X POST https://api.workos.com/vault/key/create-data-key \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json")

KEY_ID=$(echo $DEK_RESPONSE | jq -r '.key_id')
echo "Created key: $KEY_ID"

# 2. Encrypt some data
ENCRYPT_RESPONSE=$(curl -s -X POST https://api.workos.com/vault/key/encrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"key_id\": \"$KEY_ID\",
    \"plaintext\": \"Secret data to encrypt\"
  }")

CIPHERTEXT=$(echo $ENCRYPT_RESPONSE | jq -r '.ciphertext')
echo "Encrypted data: $CIPHERTEXT"

# 3. Decrypt the data
DECRYPT_RESPONSE=$(curl -s -X POST https://api.workos.com/vault/key/decrypt-data \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"key_id\": \"$KEY_ID\",
    \"ciphertext\": \"$CIPHERTEXT\"
  }")

PLAINTEXT=$(echo $DECRYPT_RESPONSE | jq -r '.plaintext')
echo "Decrypted data: $PLAINTEXT"
```

### End-to-End Vault Object Flow
```bash
# 1. Create a vault object
CREATE_RESPONSE=$(curl -s -X POST https://api.workos.com/vault/object/create \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_object_'$(date +%s)'",
    "data": {
      "field1": "value1",
      "field2": "value2"
    }
  }')

OBJECT_ID=$(echo $CREATE_RESPONSE | jq -r '.id')
OBJECT_NAME=$(echo $CREATE_RESPONSE | jq -r '.name')
echo "Created object: $OBJECT_ID (name: $OBJECT_NAME)"

# 2. Retrieve by ID
curl -s -X GET "https://api.workos.com/vault/object/get?id=$OBJECT_ID" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.'

# 3. Retrieve by name
curl -s -X GET "https://api.workos.com/vault/object/get-by-name?name=$OBJECT_NAME" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.'

# 4. Update the object
curl -s -X PUT https://api.workos.com/vault/object/update \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$OBJECT_ID\",
    \"data\": {
      \"field1\": \"updated_value\",
      \"field2\": \"value2\",
      \"field3\": \"new_field\"
    }
  }" | jq '.'

# 5. Get metadata only
curl -s -X GET "https://api.workos.com/vault/object/metadata?id=$OBJECT_ID" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.'

# 6. List all objects
curl -s -X GET "https://api.workos.com/vault/object/list?limit=5" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" | jq '.'

# 7. Delete the object
curl -s -X DELETE https://api.workos.com/vault/object/delete \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$OBJECT_ID\"
  }" | jq '.'

echo "Verification complete!"
```

## SDK Usage Patterns

### Node.js
```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create vault object
const vaultObject = await workos.vault.createObject({
  name: 'user_payment_info',
  data: {
    cardNumber: '4111111111111111',
    cvv: '123'
  }
});

// Retrieve by ID
const retrieved = await workos.vault.getObject({
  id: vaultObject.id
});

// Retrieve by name
const byName = await workos.vault.getObjectByName({
  name: 'user_payment_info'
});

// Update
await workos.vault.updateObject({
  id: vaultObject.id,
  data: {
    cardNumber: '4111111111111111',
    cvv: '456'
  }
});

// List with pagination
const objects = await workos.vault.listObjects({
  limit: 10
});

// Delete
await workos.vault.deleteObject({
  id: vaultObject.id
});
```

### Python
```python
from workos import WorkOSClient

client = WorkOSClient(api_key=os.getenv('WORKOS_API_KEY'))

# Create vault object
vault_object = client.vault.create_object(
    name='user_payment_info',
    data={
        'card_number': '4111111111111111',
        'cvv': '123'
    }
)

# Retrieve by ID
retrieved = client.vault.get_object(id=vault_object.id)

# Retrieve by name
by_name = client.vault.get_object_by_name(name='user_payment_info')

# Update
client.vault.update_object(
    id=vault_object.id,
    data={
        'card_number': '4111111111111111',
        'cvv': '456'
    }
)

# List with pagination
objects = client.vault.list_objects(limit=10)

# Delete
client.vault.delete_object(id=vault_object.id)
```

## Related Skills

- **workos-vault** - Feature overview and use cases for WorkOS Vault (encryption, key management, compliance)
