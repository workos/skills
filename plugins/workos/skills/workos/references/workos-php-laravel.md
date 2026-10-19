# WorkOS AuthKit for Laravel

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-php-laravel/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → publish config → `.env` → auth controller → routes → build.

1. **Install:** `composer require workos/workos-php-laravel`.
2. **Publish config:** `php artisan vendor:publish --provider="WorkOS\Laravel\WorkOSServiceProvider"` creates `config/workos.php` (tag `workos-config`).
3. **`.env`** (append if missing; don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
   WORKOS_COOKIE_PASSWORD=<base64 of 32 random bytes>
   ```
   The published `config/workos.php` only reads `api_key` and `client_id`. Add `'redirect_uri' => env('WORKOS_REDIRECT_URI')` and `'cookie_password' => env('WORKOS_COOKIE_PASSWORD')` to it so `config()` works after `config:cache`. Generate the cookie password with `base64_encode(random_bytes(32))` (the SDK uses libsodium secretbox, which needs a 32-byte key).
4. **Auth controller** (`app/Http/Controllers/AuthController.php`): `login()` redirects to the AuthKit authorization URL, `callback()` exchanges the code and stores a sealed session, `logout()` clears the local session and redirects to the WorkOS logout URL so the AuthKit session ends too. The package ships no controllers, routes, or middleware; write them using the call shapes below. Don't construct OAuth URLs manually.
5. **Routes** (`routes/web.php`):
   ```php
   Route::get('/login', [AuthController::class, 'login'])->name('login');
   Route::get('/auth/callback', [AuthController::class, 'callback']);
   Route::get('/logout', [AuthController::class, 'logout'])->name('logout');
   ```
6. **Build:** `php artisan route:list | grep -E "login|callback|logout"`.

## Call shapes

Verified against `workos/workos-php-laravel@8.0.1` (requires `workos/workos-php@^7.0.1`; checked `7.3.0`). The service provider is auto-discovered and binds a configured `\WorkOS\WorkOS` singleton; use the `WorkOS` facade, `workos()` helper, or inject `\WorkOS\WorkOS`.

```php
use WorkOS\Laravel\Facades\WorkOS; // client built from WORKOS_API_KEY / WORKOS_CLIENT_ID
use WorkOS\Resource\UserManagementAuthenticationProvider;
use WorkOS\SessionManager;
$pw = config('workos.cookie_password'); $cid = config('workos.client_id');

// login
return redirect()->away(WorkOS::userManagement()->getAuthorizationUrl(
    redirectUri: config('workos.redirect_uri'), provider: UserManagementAuthenticationProvider::Authkit));

// callback: $auth->user (WorkOS\Resource\User), ->accessToken, ->refreshToken
$auth = WorkOS::userManagement()->authenticateWithCode(code: $request->query('code'));
session(['wos_session' => SessionManager::sealSessionFromAuthResponse(accessToken: $auth->accessToken,
    refreshToken: $auth->refreshToken, cookiePassword: $pw, user: $auth->user->toArray())]);

// load (middleware): ['authenticated' => bool, 'user' => ?array, 'session_id' => ..., 'reason' => ...]
$r = WorkOS::sessionManager()->authenticate(sessionData: session('wos_session', ''), cookiePassword: $pw, clientId: $cid);
// on reason 'invalid_jwt' (expired): sessionManager()->refresh(sessionData:, cookiePassword:, clientId:) -> ['authenticated', 'sealed_session', ...]

// logout: end the AuthKit session, clear local session, redirect (throws \InvalidArgumentException if session invalid)
$logoutUrl = WorkOS::sessionManager()->getLogoutUrl(sessionData: session('wos_session', ''),
    cookiePassword: $pw, clientId: $cid, returnTo: url('/'));
session()->forget('wos_session');
return redirect()->away($logoutUrl);
```

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly.
- `workos/workos-php-laravel@8` requires PHP >= 8.2 and Laravel 12 or 13.
- The `returnTo` URL must be configured as a sign-out redirect in the WorkOS dashboard.
- Laravel 11+ has no `app/Http/Kernel.php` — register any auth middleware in `bootstrap/app.php`.

## Existing auth

If Breeze, Jetstream, or Fortify is present, add WorkOS on separate routes (e.g. `/auth/workos/login` if `/login` is taken) and reuse the configured Laravel session.
