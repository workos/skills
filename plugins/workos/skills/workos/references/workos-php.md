# WorkOS AuthKit for PHP

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-php/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → bootstrap/init client → login/callback/logout files → `.env` → build.

1. **Install:** `composer require workos/workos-php` (requires PHP ≥ 8.2; add `vlucas/phpdotenv` if no dotenv loader is present).
2. **Bootstrap** (`config.php` / `bootstrap.php`): require `vendor/autoload.php`, load `.env` with phpdotenv, then construct `new WorkOS(...)` as below. Don't hardcode credentials.
3. **Endpoint files** (each includes the bootstrap):
   - `login.php` — `getAuthorizationUrl(...)`, redirect to it.
   - `callback.php` — `authenticateWithCode(code: $_GET['code'])`, `session_start()`, store `$auth->user->toArray()` and the session ID, redirect.
   - `logout.php` — build the AuthKit logout URL with `getLogoutUrl(...)`, destroy the local session, redirect to the logout URL (this ends the AuthKit session too).
4. **`.env`** (don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8000/callback.php
   WORKOS_COOKIE_PASSWORD=<base64 of 32 random bytes, e.g. base64_encode(random_bytes(32))>
   ```
5. **Build:** `php -l` each file.

## Call shapes

Verified against `workos/workos-php@9.5.0` (`lib/WorkOS.php`, `lib/Service/UserManagement.php`, `lib/SessionManager.php`).

```php
use WorkOS\WorkOS;
use WorkOS\SessionManager;
use WorkOS\Resource\UserManagementAuthenticationProvider;

// 1. Init. Constructor falls back to getenv(); phpdotenv fills $_ENV, so pass values explicitly.
$workos = new WorkOS(apiKey: $_ENV['WORKOS_API_KEY'], clientId: $_ENV['WORKOS_CLIENT_ID']);

// 2. login.php: returns a string URL
$url = $workos->userManagement()->getAuthorizationUrl(
    redirectUri: $_ENV['WORKOS_REDIRECT_URI'],
    provider: UserManagementAuthenticationProvider::Authkit,
);

// 3. callback.php: AuthenticateResponse with ->user (User), ->accessToken, ->refreshToken
$auth = $workos->userManagement()->authenticateWithCode(code: $_GET['code']);

// 4. Sealed session: seal tokens (cookie-safe string), then validate it / read the session ID
$sealed = SessionManager::sealSessionFromAuthResponse(
    accessToken: $auth->accessToken, refreshToken: $auth->refreshToken,
    cookiePassword: $_ENV['WORKOS_COOKIE_PASSWORD'], user: $auth->user->toArray(),
);
$session = $workos->sessionManager()->authenticate(
    sessionData: $sealed, cookiePassword: $_ENV['WORKOS_COOKIE_PASSWORD'], clientId: $_ENV['WORKOS_CLIENT_ID'],
); // array: 'authenticated' (bool), 'session_id', 'user', or 'reason'; refresh(...) with the same args returns 'sealed_session'

// 5. logout.php: end the AuthKit session, then redirect
$logoutUrl = $workos->userManagement()->getLogoutUrl(sessionId: $_SESSION['workos_session_id'], returnTo: 'http://localhost:8000/');
```

## Gotchas

- Callback file path must equal `WORKOS_REDIRECT_URI` exactly, including any trailing slash.
- Generate the authorization URL with the SDK; don't construct OAuth URLs manually.
- `provider` is an enum (`UserManagementAuthenticationProvider::Authkit`), not the string `'authkit'`.
- The user from `authenticateWithCode` is a `User` object; store `->toArray()` in `$_SESSION` (keys are snake_case: `email`, `first_name`, ...).
- `WORKOS_COOKIE_PASSWORD` must decode (base64) to exactly 32 bytes; it's a sodium secretbox key.
- Store `$session['session_id']` at callback time. `sessionManager()->getLogoutUrl(...)` also exists but throws once the access token in the sealed session has expired, so `userManagement()->getLogoutUrl(sessionId: ...)` with the stored ID is more reliable.

## Existing auth

Add WorkOS on separate files (e.g. `workos-login.php` if `login.php` is taken); if `session_start()` is already used, reuse that session rather than adding a second mechanism.
