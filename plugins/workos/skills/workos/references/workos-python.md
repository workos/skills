# WorkOS AuthKit for Python

## Docs

Fetch the README first — it's the source of truth for SDK API usage:

- SDK README: `https://raw.githubusercontent.com/workos/workos-python/main/README.md`
- AuthKit quickstart: `https://workos.com/docs/authkit/vanilla/python`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → init client → login/callback/logout routes → `.env` → build.

1. **Install:** `workos python-dotenv` (append to `requirements.txt` if the project uses one).
2. **Init client:**
   ```python
   from workos import WorkOSClient
   workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))
   ```
3. **Routes/views**, adapted to the framework (Django views + `urls.py`, Flask/FastAPI routes):
   - `/login` — `workos.user_management.get_authorization_url(provider="authkit", redirect_uri=...)`, redirect.
   - `/callback` — `workos.user_management.authenticate_with_code(code=code)`, store user in the session.
   - `/logout` — clear/flush session, redirect.
4. **`.env`** (don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   ```
5. **Build:** `python -c "import workos"`, then the framework check (`python manage.py check`, or `python -m py_compile <entry>`).

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Django: the callback receives a GET from WorkOS. Use a GET view, or mark it `@csrf_exempt`, to avoid CSRF failures.
- Flask: set `app.secret_key` or sessions won't persist.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`); if `flask-login` is present, reuse its session (`login_user()`) rather than raw session management.
