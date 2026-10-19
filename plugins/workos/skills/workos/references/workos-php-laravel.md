# WorkOS AuthKit for Laravel

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-php-laravel/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → publish config → `.env` → auth controller → routes → build.

1. **Install:** `composer require workos/workos-php-laravel`.
2. **Publish config:** `php artisan vendor:publish --provider="WorkOS\Laravel\WorkOSServiceProvider"` creates `config/workos.php`. If the command fails, check the README for the correct provider class — it may differ.
3. **`.env`** (append if missing; don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
   ```
4. **Auth controller** (`app/Http/Controllers/AuthController.php`): `login()` redirects to the AuthKit authorization URL, `callback()` exchanges the code for the user profile, `logout()` clears the session. Use SDK methods from the README; don't construct OAuth URLs manually.
5. **Routes** (`routes/web.php`):
   ```php
   Route::get('/login', [AuthController::class, 'login'])->name('login');
   Route::get('/auth/callback', [AuthController::class, 'callback']);
   Route::get('/logout', [AuthController::class, 'logout'])->name('logout');
   ```
6. **Build:** `php artisan route:list | grep -E "login|callback|logout"`.

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly.
- Laravel 11 removed `app/Http/Kernel.php` — register any auth middleware in `bootstrap/app.php`.

## Existing auth

If Breeze, Jetstream, or Fortify is present, add WorkOS on separate routes (e.g. `/auth/workos/login` if `/login` is taken) and reuse the configured Laravel session.
