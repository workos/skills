# WorkOS AuthKit for Python

## Docs

Fetch the README first — it's the source of truth for SDK API usage:

- SDK README: `https://raw.githubusercontent.com/workos/workos-python/main/README.md`
- AuthKit quickstart: `https://workos.com/docs/authkit/vanilla/python`

If this file conflicts with fetched docs, follow the docs.

## Call shapes

Verified against `workos@10.6.0` (PyPI; requires Python 3.10+). Sync client shown; `AsyncWorkOSClient` mirrors it with `await`.

```python
import os
from workos import WorkOSClient
from workos.session import seal_session_from_auth_response

workos = WorkOSClient(api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID"))
cookie_password = os.getenv("WORKOS_COOKIE_PASSWORD")  # must be a Fernet key

# /login
url = workos.user_management.get_authorization_url(provider="authkit", redirect_uri=os.getenv("WORKOS_REDIRECT_URI"))

# /callback?code=...
auth = workos.user_management.authenticate_with_code(code=code)  # auth.user, auth.access_token, auth.refresh_token
sealed = seal_session_from_auth_response(
    access_token=auth.access_token, refresh_token=auth.refresh_token,
    user=auth.user.to_dict(), cookie_password=cookie_password,
)  # set as an HttpOnly cookie, e.g. "wos_session"

# protected request
session = workos.user_management.load_sealed_session(session_data=cookie_value, cookie_password=cookie_password)
result = session.authenticate()  # result.authenticated, result.user (dict), result.session_id
if not result.authenticated:
    result = session.refresh()  # on success, re-set cookie to result.sealed_session

# /logout: delete the cookie, then redirect to the AuthKit logout URL
logout_url = session.get_logout_url(return_to="http://localhost:8000/")
```

## Setup

Order matters: install SDK → init client → login/callback/logout routes → `.env` → build.

1. **Install:** `workos python-dotenv` (append to `requirements.txt` if the project uses one).
2. **Init client:** `WorkOSClient(...)` as above (it also falls back to `WORKOS_API_KEY` / `WORKOS_CLIENT_ID` from the environment).
3. **Routes/views**, adapted to the framework (Django views + `urls.py`, Flask/FastAPI routes):
   - `/login` — `get_authorization_url(provider="authkit", redirect_uri=...)`, redirect.
   - `/callback` — `authenticate_with_code(code=code)`, seal the response into a session cookie (or store the user in the framework session).
   - `/logout` — get `session.get_logout_url(return_to=...)` (or `workos.user_management.get_logout_url(session_id=..., return_to=...)`), clear the cookie/local session, then redirect to that URL so the AuthKit session ends too.
4. **`.env`** (don't overwrite existing values):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8000/callback
   WORKOS_COOKIE_PASSWORD=<Fernet key>
   ```
5. **Build:** `python -c "import workos"`, then the framework check (`python manage.py check`, or `python -m py_compile <entry>`).

## Gotchas

- Callback route path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Django: the callback receives a GET from WorkOS. Use a GET view, or mark it `@csrf_exempt`, to avoid CSRF failures.
- Flask: set `app.secret_key` or sessions won't persist.
- `WORKOS_COOKIE_PASSWORD` is used as a Fernet key (32 url-safe base64 bytes, e.g. from `cryptography.fernet.Fernet.generate_key()`); an arbitrary string raises an error when sealing.
- `session.get_logout_url()` raises `ValueError` if the session no longer authenticates; fall back to just clearing the cookie and redirecting home.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`); if `flask-login` is present, reuse its session (`login_user()`) rather than raw session management.
