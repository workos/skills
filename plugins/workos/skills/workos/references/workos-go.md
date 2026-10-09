# WorkOS AuthKit for Go

## Docs

Fetch the README first — it's the source of truth for SDK API usage:

- SDK README: `https://raw.githubusercontent.com/workos/workos-go/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: install SDK → init client → login/callback/logout handlers → wire router → `.env` → build.

1. **Install:** `go get github.com/workos/workos-go/v6` (the `/v6` major-version suffix is required; a wrong suffix breaks the build).
2. **Init client** in `init()` or `main()`:

   ```go
   import "github.com/workos/workos-go/v6/pkg/usermanagement"

   func init() {
       usermanagement.SetAPIKey(os.Getenv("WORKOS_API_KEY"))
   }
   ```

3. **Handlers** (read env with `os.Getenv`):
   - `/auth/login` — `usermanagement.GetAuthorizationURL()` with `ClientID` and `RedirectURI`, redirect to the returned URL.
   - `/auth/callback` — read the `code` query param, `usermanagement.AuthenticateWithCode()` with `code` and `ClientID`, store user in session/cookie (or return JSON for API-first apps).
   - `/auth/logout` — clear session, redirect.
4. **Wire** these routes alongside existing ones, matching the framework's handler signature (Gin `*gin.Context` vs stdlib `http.ResponseWriter, *http.Request`).
5. **`.env`** (development only):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8080/auth/callback
   ```
6. **Build:** `go mod tidy && go build ./...`.

## Gotchas

- Callback handler path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Set `Provider` to the string `"authkit"` — it's a plain string, not a constant.
- Go has no built-in `.env` convention: `.env` is for development. In production set real OS environment variables (or load `.env` with `github.com/joho/godotenv`).

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`) and leave existing auth middleware running on its own routes.
