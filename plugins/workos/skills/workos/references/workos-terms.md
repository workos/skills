# WorkOS Terminology → Canonical Docs URLs

If this file conflicts with fetched docs, follow the docs. URLs here are canonical at time of writing; if a user reports a broken link, WebFetch to confirm and update the row.

## How to Use

User asked about a WorkOS term, dashboard field, environment variable, or configuration concept? Look it up here first. The table gives you:

- **Term** — exact name as it appears in the WorkOS Dashboard, SDK, or docs
- **What it is** — one-line definition (enough to answer simple "what is X" questions without a fetch)
- **Canonical URL** — WebFetch this if the user wants the full reference
- **See also** — deeper reference file to Read when the task goes beyond terminology

## Terms

| Term                             | What it is                                                                                                                                                                                                                                                    | Canonical URL                                                                               | See also                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| Redirect URI                     | URL WorkOS redirects to after successful authentication; configured in Dashboard → Redirects. The `redirect_uri` request parameter must match one of the configured values EXACTLY (including trailing slash).                                                | https://workos.com/docs/reference/authkit/authentication/get-authorization-url/redirect-uri | `workos-authkit-base.md`  |
| Initiate login URI               | App route that starts AuthKit sign-in when a request did not originate from the app, such as a bookmark, password-reset email, or invitation. Configure it in the application's Redirects settings in the WorkOS Dashboard. Not the callback or homepage URL. | https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri                 | `workos-authkit-setup.md` |
| Sign-in endpoint                 | Older name for the Initiate login URI above. The app route must start AuthKit sign-in rather than only render a sign-in button.                                                                                                                               | https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri                 | `workos-authkit-setup.md` |
| `initiate_login_uri`             | OIDC client metadata term corresponding to WorkOS's Initiate login URI, formerly Sign-in endpoint.                                                                                                                                                            | https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri                 | `workos-authkit-setup.md` |
| Sign-out URI / sign-out redirect | Public destination after the AuthKit session ends, formerly Logout URI. Set a default in the application's Redirects settings; any `return_to` destination must also be registered. The CLI still uses `authkit logout-uris`.                                 | https://workos.com/docs/authkit/sessions#sign-out-uris                                      | `workos-authkit-setup.md` |
| Organization ID                  | Identifier for a group of users (typically a tenant/customer org). Preferred parameter when initiating SAML/OIDC flows — pass this instead of Connection ID so the org can pick its active connection.                                                        | https://workos.com/docs/sso/overview                                                        | `workos-sso.md`           |
| Connection ID                    | Identifier for a specific SSO connection (auth method) belonging to an Organization. Use when you need to authenticate via a particular connection rather than letting the Org decide.                                                                        | https://workos.com/docs/sso/overview                                                        | `workos-sso.md`           |
| Admin Portal `intent`            | Query parameter on `generateLink` that selects which Admin Portal flow to open. Valid values: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`, `bring_your_own_key`.                                                | https://workos.com/docs/reference/admin-portal/portal-link/generate                         | `workos-admin-portal.md`  |
| JWKS endpoint                    | Public key set endpoint used to verify signatures on AuthKit-issued session access tokens.                                                                                                                                                                    | https://workos.com/docs/reference/authkit/session-tokens/jwks                               | `workos-api-authkit.md`   |
| Sealed session                   | AuthKit session data encrypted and stored in a cookie. "Sealing" = encrypting with the cookie password at sign-in; "unsealing" = decrypting via `loadSealedSession()` / `authenticateWithSessionCookie()` on each request.                                    | https://workos.com/docs/reference/authkit/session-helpers/load-sealed-session               | `workos-node.md`          |
| `WORKOS_COOKIE_PASSWORD`         | 32+ character password used to seal/unseal the AuthKit session cookie. Must be identical across all instances of your app. Generate with `openssl rand -base64 32`.                                                                                           | https://workos.com/docs/authkit/vanilla/nodejs                                              | `workos-authkit-base.md`  |

## Still not here?

1. Check the "See also" column for the closest feature reference and Read it — the term may be covered in context there.
2. If still unclear, WebFetch https://workos.com/docs/llms.txt and search for the term.
3. If you find a canonical URL for a term that wasn't in this table, answer the user, then **suggest they open a PR** adding a row to this file. (This file is human-maintained; you can't reliably persist edits from a user session.)

## Verification

URLs drift when WorkOS reorganizes docs. Verify a URL by WebFetch only when (a) the user reports a broken link, or (b) you're about to write the URL into a file the user will commit. Routine chat answers don't require verification — that wastes tokens.
