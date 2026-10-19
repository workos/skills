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
   - `/callback` — `WorkOS.client.user_management.authenticate_with_code(code: ...)`, seal the tokens into a `wos-session` cookie (or store the user in the framework session).
   - `/logout` — build the AuthKit logout URL from the sealed session, delete the cookie/local session, then redirect to that URL so the AuthKit session ends too.

4. **`.env`** (don't overwrite existing values):

   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:3000/callback
   WORKOS_COOKIE_PASSWORD=<at least 32 bytes, e.g. SecureRandom.base64(32)>
   ```

5. **Build:** Rails `bundle exec rails routes | grep auth`; Sinatra `ruby -c server.rb`.

## Call shapes

Verified against `workos` gem 10.5.0.

```ruby
WorkOS.configure do |config|
  config.api_key = ENV.fetch("WORKOS_API_KEY")
  config.client_id = ENV.fetch("WORKOS_CLIENT_ID")
end
um = WorkOS.client.user_management
sm = WorkOS.client.session_manager
pw = ENV.fetch("WORKOS_COOKIE_PASSWORD") # >= 32 bytes or ArgumentError

# /login
url = um.get_authorization_url(provider: "authkit", redirect_uri: ENV.fetch("WORKOS_REDIRECT_URI"))

# /callback
auth = um.authenticate_with_code(code: params[:code]) # => WorkOS::AuthenticateResponse
sealed = sm.seal_session_from_auth_response(
  access_token: auth.access_token, refresh_token: auth.refresh_token,
  user: auth.user.to_h, cookie_password: pw
)
cookies["wos-session"] = sealed # httponly, secure, same_site: :lax

# protected request
session = sm.load(seal_data: cookies["wos-session"], cookie_password: pw)
result = session.authenticate # AuthSuccess (.authenticated, .user, .session_id) or AuthError (.reason)
result = session.refresh unless result.authenticated # RefreshSuccess: write .sealed_session back to the cookie

# /logout
logout_url = session.get_logout_url(return_to: "http://localhost:3000") # raises WorkOS::Error if session invalid
cookies.delete("wos-session") # then redirect to logout_url
```

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- `Session#get_logout_url` re-authenticates the cookie and raises when the access token is expired or invalid; refresh first, or on failure just clear the cookie and redirect home. `user_management.get_logout_url(session_id:, return_to:)` is the lower-level form.
- `result.user` from `session.authenticate` is the Hash you sealed (string keys, e.g. `["email"]`), not a `WorkOS::User`.
- Sinatra: sessions are off by default — add `enable :sessions` (or use `rack-session`) or the session won't persist.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`). Devise runs on Warden; integrate WorkOS at the Warden strategy level, and keep Rack middleware ordering intact.
