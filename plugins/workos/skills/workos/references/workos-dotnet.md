# WorkOS AuthKit for .NET (ASP.NET Core)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-dotnet/main/README.md`

If this file conflicts with fetched docs, follow the docs.

Where you register the WorkOS client and middleware depends on the project style: Minimal API (`Program.cs` with `WebApplication.CreateBuilder()`, .NET 6+) vs the older Startup pattern (`Startup.cs` with `ConfigureServices()`).

## Setup

Order matters: install SDK → config → register client → auth endpoints → build.

1. **Install:** `dotnet add package WorkOS.net`.
2. **Config** (`appsettings.Development.json`, with keys read via `IConfiguration`):
   ```json
   {
     "WorkOS": {
       "ApiKey": "sk_...",
       "ClientId": "client_...",
       "RedirectUri": "http://localhost:5000/auth/callback"
     }
   }
   ```
3. **Register the client** from `builder.Configuration["WorkOS:ApiKey"]` / `["WorkOS:ClientId"]` in the DI container. For session storage, `AddDistributedMemoryCache()` + `AddSession()`, and `app.UseSession()` before mapping auth endpoints.
4. **Auth endpoints** (`app.MapGet()` for Minimal API, or a Controller):
   - `GET /auth/login` → generate the authorization URL with `clientId`, `redirectUri`, `provider: "authkit"`; redirect.
   - `GET /auth/callback` → exchange the `code` query param for the user profile, store it in session, redirect home.
   - `GET /auth/logout` → clear the session, redirect.
5. **Build:** `dotnet build`.

## Gotchas

- Callback path must equal the configured `RedirectUri` exactly.
- Keep secrets out of `appsettings.json` (committed to git) — use `appsettings.Development.json` (gitignored) or `dotnet user-secrets`.

## Existing auth

Add WorkOS on separate routes (e.g. `/auth/workos/login` if `/login` is taken) and reuse the existing cookie/session middleware rather than adding a second mechanism.
