# WorkOS AuthKit API Reference

## Docs

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

(none yet — add as discovered)

## Endpoints

WebFetch the reference URLs above for the full endpoint list, schemas, and parameters. These endpoints carry a purpose beyond their path:

| Endpoint                         | Description                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `/api-keys/validate`             | Validate an API key and retrieve associated metadata.                            |
| `/cli-auth/device-authorization` | Initiate the CLI Auth flow by obtaining a device code and verification URLs.     |
| `/cli-auth/device-code`          | Exchange a device code for access and refresh tokens during the CLI Auth flow.   |
| `/mfa`                           | Enroll users in multi-factor authentication for an additional layer of security. |
