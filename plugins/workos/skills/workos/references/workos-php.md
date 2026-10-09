# WorkOS AuthKit for PHP

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-php/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → bootstrap/init client → login/callback/logout files → `.env` → build.

1. **Install:** `composer require workos/workos-php` (and `vlucas/phpdotenv` if no dotenv loader is present).
2. **Bootstrap** (`config.php` / `bootstrap.php`): require `vendor/autoload.php`, load `.env` with phpdotenv, initialize the SDK client with the API key per the README. Don't hardcode credentials.
3. **Endpoint files** (each includes the bootstrap):
   - `login.php` — generate the authorization URL via the SDK, redirect to AuthKit.
   - `callback.php` — exchange `$_GET['code']` for the user profile via the SDK, `session_start()`, store user, redirect.
   - `logout.php` — destroy session, redirect.
4. **`.env`** (don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8000/callback.php
   ```
5. **Build:** `php -l` each file.

## Gotchas

- Callback file path must equal `WORKOS_REDIRECT_URI` exactly, including any trailing slash.
- Generate the authorization URL with the SDK; don't construct OAuth URLs manually.

## Existing auth

Add WorkOS on separate files (e.g. `workos-login.php` if `login.php` is taken); if `session_start()` is already used, reuse that session rather than adding a second mechanism.
