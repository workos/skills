# WorkOS Single Sign-On

## Docs

- https://workos.com/docs/sso/guide
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/reference/sso/get-authorization-url
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/launch-checklist
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Use exactly ONE connection selector (connection, organization, or provider) in getAuthorizationUrl — never combine them, causes error
- domain_hint and login_hint are UX params, NOT connection selectors — they pre-fill fields but don't route the request
- IdP-initiated flow sends state="" (empty string, not missing) — skip CSRF verification for empty string, reject for null/missing
- Auth codes expire in 10 min and are single-use — exchange immediately in callback, never store or retry
- signin_consent_denied means user clicked Cancel at IdP — check req.query.error BEFORE attempting code exchange
- Email domain does NOT auto-resolve to organization — YOUR app must map email domain → org_id via your DB or the Organizations API
- Redirect URI must match EXACTLY including trailing slash — mismatch causes invalid_grant
- Use getProfileAndToken (not getProfile) to exchange code — returns both profile and access token

## Endpoints

| Endpoint                              | Description                       |
| ------------------------------------- | --------------------------------- |
| `/sso`                                | SSO overview                      |
| `/connection`                         | SSO connection management         |
| `/connection/delete`                  | Delete a connection               |
| `/connection/get`                     | Get a connection                  |
| `/connection/list`                    | List connections                  |
| `/get-authorization-url`              | Generate authorization URL        |
| `/get-authorization-url/error-codes`  | Authorization error codes         |
| `/get-authorization-url/redirect-uri` | Redirect URI configuration        |
| `/logout`                             | SSO logout                        |
| `/logout/authorize`                   | Authorize logout                  |
| `/logout/redirect`                    | Logout redirect                   |
| `/profile`                            | User profile                      |
| `/profile/get-profile-and-token`      | Exchange code for profile + token |
| `/profile/get-user-profile`           | Get user profile by ID            |
