# WorkOS AuthKit for .NET (ASP.NET Core)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-dotnet/main/README.md`

If this file conflicts with fetched docs, follow the docs.

Where you register the WorkOS client and middleware depends on the project style: Minimal API (`Program.cs` with `WebApplication.CreateBuilder()`, .NET 6+) vs the older Startup pattern (`Startup.cs` with `ConfigureServices()`).

## Call shapes

Verified against `WorkOS.net@6.6.0` (namespace `WorkOS`).

```csharp
using WorkOS;

// 1. Client (ClientId is required for AuthKit; the SDK fills client_id/secret for you)
var workos = new WorkOSClient(new WorkOSOptions {
    ApiKey = Environment.GetEnvironmentVariable("WORKOS_API_KEY"),
    ClientId = Environment.GetEnvironmentVariable("WORKOS_CLIENT_ID"),
});

// 2. Login: build the AuthKit URL (local, no network call), then redirect to it
var url = workos.UserManagement.GetAuthorizationUrl(new UserManagementGetAuthorizationUrlOptions {
    RedirectUri = redirectUri,
    Provider = UserManagementAuthenticationProvider.Authkit,
});

// 3. Callback: exchange ?code= for user + tokens
var auth = await workos.UserManagement.AuthenticateWithCodeAsync(
    new AuthenticateWithCodeOptions { Code = code });
// auth.User, auth.AccessToken, auth.RefreshToken

// 4. Session: seal tokens into a cookie value (static), later validate it
string sealedSession = SessionService.SealSessionFromAuthResponse(auth.AccessToken, auth.RefreshToken, cookiePassword);
SessionAuthResult session = await workos.Session.AuthenticateAsync(sealedSession, cookiePassword);
// session.Authenticated, session.SessionId, session.OrganizationId, session.Reason (no User — store it yourself if needed)

// 5. Logout: delete the cookie, then redirect to the WorkOS logout URL to end the AuthKit session
var logoutUrl = workos.UserManagement.GetLogoutUrl(new UserManagementGetLogoutUrlOptions {
    SessionId = session.SessionId!, ReturnTo = "http://localhost:5000/",
});
```

## Setup

Order matters: install SDK → config → register client → auth endpoints → build.

1. **Install:** `dotnet add package WorkOS.net`.
2. **Config** (env vars, or `appsettings.Development.json` / `dotnet user-secrets` read via `IConfiguration`): `WORKOS_API_KEY` (`sk_...`), `WORKOS_CLIENT_ID` (`client_...`), the redirect URI (e.g. `http://localhost:5000/auth/callback`), and a long random cookie password for sealing sessions. `builder.Configuration["WORKOS_API_KEY"]` reads env vars too.
3. **Register the client** as a singleton `WorkOSClient` in the DI container (constructor-inject it rather than using `WorkOSConfiguration.WorkOSClient`). The constructor throws if `ApiKey` is empty.
4. **Auth endpoints** (`app.MapGet()` for Minimal API, or a Controller):
   - `GET /auth/login` → `GetAuthorizationUrl` with `RedirectUri` and `Provider = UserManagementAuthenticationProvider.Authkit` (client ID comes from `WorkOSOptions`); redirect.
   - `GET /auth/callback` → `AuthenticateWithCodeAsync` with the `code` query param, seal the tokens with `SessionService.SealSessionFromAuthResponse` into an HttpOnly cookie (or store `auth.User` in the framework session), redirect home.
   - `GET /auth/logout` → read `SessionId` from `workos.Session.AuthenticateAsync(cookie, password)`, delete the cookie / clear the session, then redirect to `GetLogoutUrl(...)` so the AuthKit session ends too.
5. **Build:** `dotnet build`.

## Gotchas

- Callback path must equal the configured redirect URI exactly.
- Missing `ClientId` in `WorkOSOptions` makes `GetAuthorizationUrl` / `AuthenticateWithCodeAsync` throw `InvalidOperationException`.
- `SealSessionFromAuthResponse` is static on `SessionService`; `AuthenticateAsync` is on the `workos.Session` instance.
- Keep secrets out of `appsettings.json` (committed to git) — use env vars, `appsettings.Development.json` (gitignored), or `dotnet user-secrets`.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login` if `/login` is taken) and reuse the existing cookie/session middleware rather than adding a second mechanism.
