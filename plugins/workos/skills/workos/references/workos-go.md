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
   - `/auth/login` — `usermanagement.GetAuthorizationURL()` with `ClientID`, `RedirectURI`, and `Provider: "authkit"`, redirect to the returned URL.
   - `/auth/callback` — read the `code` query param, `usermanagement.AuthenticateWithCode()` with `Code` and `ClientID`, store the returned user (and access/refresh tokens) in the framework session/cookie (or return JSON for API-first apps).
   - `/auth/logout` — read the `sid` claim from the stored access token, clear the local session, then redirect to `usermanagement.GetLogoutURL()` to end the AuthKit session.
4. **Wire** these routes alongside existing ones, matching the framework's handler signature (Gin `*gin.Context` vs stdlib `http.ResponseWriter, *http.Request`).
5. **`.env`** (development only):
   ```
   WORKOS_API_KEY=sk_...
   WORKOS_CLIENT_ID=client_...
   WORKOS_REDIRECT_URI=http://localhost:8080/auth/callback
   ```
6. **Build:** `go mod tidy && go build ./...`.

## Call shapes

Verified against `github.com/workos/workos-go/v6@v6.5.0` (`pkg/usermanagement`). The SDK has no sealed-session helper: store the returned user in the framework session.

```go
import "github.com/workos/workos-go/v6/pkg/usermanagement"

usermanagement.SetAPIKey(os.Getenv("WORKOS_API_KEY"))
clientID := os.Getenv("WORKOS_CLIENT_ID")

// Login: redirect to AuthKit
u, err := usermanagement.GetAuthorizationURL(usermanagement.GetAuthorizationURLOpts{
    ClientID:    clientID,
    Provider:    "authkit",
    RedirectURI: os.Getenv("WORKOS_REDIRECT_URI"),
})
// http.Redirect(w, r, u.String(), http.StatusFound)

// Callback: exchange code
res, err := usermanagement.AuthenticateWithCode(ctx, usermanagement.AuthenticateWithCodeOpts{
    ClientID: clientID,
    Code:     r.URL.Query().Get("code"),
})
// res.User (ID, Email, FirstName, LastName), res.AccessToken, res.RefreshToken -> store in your session

// Refresh: usermanagement.AuthenticateWithRefreshToken(ctx, usermanagement.AuthenticateWithRefreshTokenOpts{ClientID: clientID, RefreshToken: rt})

// Logout: SessionID is the `sid` claim of res.AccessToken (a JWT; verify with usermanagement.GetJWKSURL(clientID))
logoutURL, err := usermanagement.GetLogoutURL(usermanagement.GetLogoutURLOpts{
    SessionID: sid,
    ReturnTo:  "http://localhost:8080/",
})
// clear local session, then http.Redirect(w, r, logoutURL.String(), http.StatusFound)
```

## Gotchas

- Callback handler path must equal `WORKOS_REDIRECT_URI` exactly, or the callback 404s.
- Set `Provider` to the string `"authkit"` — it's a plain string, not a constant.
- `GetLogoutURL` errors if `SessionID` is empty; the SDK has no JWT decoder, so parse the `sid` claim from the access token yourself (base64url payload, or a JWT library against `GetJWKSURL`).
- Go has no built-in `.env` convention: `.env` is for development. In production set real OS environment variables (or load `.env` with `github.com/joho/godotenv`).

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login`) and leave existing auth middleware running on its own routes.
