# WorkOS AuthKit for Ruby

## Docs

Fetch the README first — it's the source of truth for gem API usage:

- SDK README: `https://raw.githubusercontent.com/workos/workos-ruby/main/README.md`
- AuthKit quickstart: `https://workos.com/docs/authkit/vanilla/ruby`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install gem → configure → login/callback/logout routes → `.env` → build.

1. **Install:** `bundle add workos` (and `dotenv-rails` for Rails, or `dotenv` otherwise). On a partial install, `bundle install` rather than `bundle update` to avoid unexpected gem upgrades.

   The examples below are for gem 7+, which calls everything through a client instance (`WorkOS.client.user_management...`). If `Gemfile.lock` already pins `workos` below 7, use that version's module-level methods (`WorkOS::UserManagement.authorization_url`, `config.key`) instead of upgrading.

2. **Configure** (Rails: `config/initializers/workos.rb`; Sinatra: top of `server.rb`):

   ```ruby
   WorkOS.configure do |config|
     config.api_key = ENV.fetch("WORKOS_API_KEY")
     config.client_id = ENV.fetch("WORKOS_CLIENT_ID")
   end
   ```

3. **Routes** (Rails: `AuthController` + `get` routes in `config/routes.rb`; Sinatra: routes in `server.rb`):
   - `/login` — `WorkOS.client.user_management.get_authorization_url(provider: "authkit", redirect_uri: ...)`, redirect.
   - `/callback` — `WorkOS.client.user_management.authenticate_with_code(code: ...)`, store user in session.
   - `/logout` — clear session, redirect.

4. **`.env`** (don't overwrite existing values):

   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   ```

5. **Build:** Rails `bundle exec rails routes | grep auth`; Sinatra `ruby -c server.rb`.

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Sinatra: sessions are off by default — add `enable :sessions` (or use `rack-session`) or the session won't persist.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`). Devise runs on Warden; integrate WorkOS at the Warden strategy level, and keep Rack middleware ordering intact.
