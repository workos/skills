# WorkOS AuthKit for Elixir (Phoenix)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-elixir/main/README.md`

If this file conflicts with fetched docs, follow the docs.

The app name from `mix.exs` (`app: :my_app`) determines all paths: `lib/my_app_web/router.ex`, `lib/my_app_web/controllers/`.

## Call shapes

Verified against `workos@3.1.0` (Hex). Every function takes a `WorkOS.Client` as its first argument; there is no global config.

```elixir
# Client: reads WORKOS_API_KEY / WORKOS_CLIENT_ID from the env when opts are omitted
client = WorkOS.client()  # or WorkOS.client(api_key: "sk_...", client_id: "client_...")

# Sign in: returns a plain String (not {:ok, url}); client_id is taken from the client
url = WorkOS.UserManagement.get_authorization_url(client, %{provider: "authkit", redirect_uri: redirect_uri})

# Callback: client_id/client_secret are taken from the client
{:ok, %WorkOS.AuthenticateResponse{user: user} = auth} =
  WorkOS.UserManagement.authenticate_with_code(client, %{code: code})

# Sealed session (cookie_password: app secret, e.g. WORKOS_COOKIE_PASSWORD, 64 hex chars ideal)
{:ok, sealed} = WorkOS.Session.seal_session_from_auth_response(auth, cookie_password)
result = WorkOS.Session.authenticate(sealed, cookie_password)
# result.authenticated, result.user, result.needs_refresh, result.reason
{:ok, %{sealed_session: new_sealed}} = WorkOS.Session.refresh_session(client, sealed, cookie_password)

# Sign out: end the AuthKit session, then redirect to the returned URL
session = WorkOS.Session.new(client, sealed, cookie_password)
{:ok, logout_url} = WorkOS.Session.get_logout_url(session, return_to: "http://localhost:4000/")
```

## Setup

Order matters: add dep → build client → auth controller → routes → build.

1. **Install:** add `{:workos, "~> 3.1"}` to `mix.exs` deps (requires Elixir 1.18+), then `mix deps.get`.
2. **Client:** the SDK reads no application config. Build the client at runtime with `WorkOS.client()` (reads `WORKOS_API_KEY` (`sk_`) and `WORKOS_CLIENT_ID` (`client_`) from the environment), or pass `api_key:`/`client_id:` from your own `config/runtime.exs` values.
3. **Auth controller** (`lib/{app}_web/controllers/auth_controller.ex`, `use {AppName}Web, :controller`):
   - `sign_in` → `url = WorkOS.UserManagement.get_authorization_url(client, %{provider: "authkit", redirect_uri: uri})`; `redirect(conn, external: url)`.
   - `callback` (matches `%{"code" => code}`) → `WorkOS.UserManagement.authenticate_with_code(client, %{code: code})` returns `{:ok, auth}`; seal it with `WorkOS.Session.seal_session_from_auth_response/2` and `put_session` the sealed string (or store `auth.user` in the session), redirect home.
   - `sign_out` → build the logout URL with `WorkOS.Session.get_logout_url/2` (or `WorkOS.UserManagement.get_logout_url(client, %{session_id: sid, return_to: url})`, which returns a String), `clear_session()`, then `redirect(conn, external: logout_url)`. If no valid session exists, just clear and redirect home.
4. **Routes** (`lib/{app}_web/router.ex`): scope WorkOS auth under `/auth` through the `:browser` pipeline (`get "/sign-in"`, `get "/callback"`, `post "/sign-out"`).
5. **Build:** `mix compile`.

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly.
- `config :workos, ...` has no effect; the client must be built with `WorkOS.client/1` and passed to every call.
- Minimal Phoenix projects may lack the `{AppName}Web` `:controller` macro that `use {AppName}Web, :controller` depends on — confirm `lib/{app}_web.ex` defines it, and create it if absent.

## Existing auth

If Ueberauth is configured, its `/:provider` wildcard routes conflict with new auth routes — scope WorkOS under a specific path like `/auth/workos`. Reuse existing session infrastructure if compatible.
