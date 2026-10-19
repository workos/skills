# WorkOS AuthKit for Elixir (Phoenix)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-elixir/main/README.md`

If this file conflicts with fetched docs, follow the docs.

The app name from `mix.exs` (`app: :my_app`) determines all paths: `lib/my_app_web/router.ex`, `lib/my_app_web/controllers/`.

## Setup

Order matters: add dep → configure → auth controller → routes → build.

1. **Install:** add `{:workos, "~> 1.0"}` to `mix.exs` deps, then `mix deps.get`.
2. **Config** (`config/runtime.exs`, so credentials load at runtime, not compiled into the release):
   ```elixir
   config :workos,
     api_key: System.get_env("WORKOS_API_KEY"),
     client_id: System.get_env("WORKOS_CLIENT_ID")
   ```
   Set `WORKOS_API_KEY` (`sk_`) and `WORKOS_CLIENT_ID` (`client_`) in the environment.
3. **Auth controller** (`lib/{app}_web/controllers/auth_controller.ex`, `use {AppName}Web, :controller`):
   - `sign_in` → `WorkOS.UserManagement.get_authorization_url(%{provider: "authkit", client_id: client_id, redirect_uri: uri})` returns `{:ok, url}`; `redirect(conn, external: url)`.
   - `callback` (matches `%{"code" => code}`) → `WorkOS.UserManagement.authenticate_with_code(%{code: code, client_id: client_id})` returns `{:ok, auth_response}`; `put_session(:user, auth_response.user)`, redirect home.
   - `sign_out` → `clear_session()`, redirect home.
4. **Routes** (`lib/{app}_web/router.ex`): scope WorkOS auth under `/auth` through the `:browser` pipeline (`get "/sign-in"`, `get "/callback"`, `post "/sign-out"`).
5. **Build:** `mix compile`.

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly.
- Minimal Phoenix projects may lack the `{AppName}Web` `:controller` macro that `use {AppName}Web, :controller` depends on — confirm `lib/{app}_web.ex` defines it, and create it if absent.

## Existing auth

If Ueberauth is configured, its `/:provider` wildcard routes conflict with new auth routes — scope WorkOS under a specific path like `/auth/workos`. Reuse existing session infrastructure if compatible.
