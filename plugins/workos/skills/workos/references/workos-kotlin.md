# WorkOS AuthKit for Kotlin (Spring Boot)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-kotlin/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Call shapes

Verified against `com.workos:workos:7.5.0`. `getAuthorizationUrl`, `getLogoutUrl`, and `workos.session` are extension members, so import them explicitly.

```kotlin
import com.workos.WorkOS
import com.workos.session.AuthenticateSessionResult
import com.workos.session.session
import com.workos.usermanagement.AuthKitAuthorizationUrlOptions
import com.workos.usermanagement.getAuthorizationUrl

val workos = WorkOS(apiKey = System.getenv("WORKOS_API_KEY"), clientId = System.getenv("WORKOS_CLIENT_ID"))
val cookiePassword = System.getenv("WORKOS_COOKIE_PASSWORD") // at least 32 chars

// Login: returns a URL String (clientId falls back to the client's)
val url = workos.userManagement.getAuthorizationUrl(AuthKitAuthorizationUrlOptions(redirectUri = redirectUri, provider = "authkit"))

// Callback: returns AuthenticateResponse (user, accessToken, refreshToken, ...)
val auth = workos.userManagement.authenticateWithCode(code = code)
val sealed: String = workos.session.sealAuthResponse(auth, cookiePassword) // store as an HttpOnly cookie

// Per request: validate the cookie
val cookie = workos.session.loadSealedSession(sessionData = sealed, cookiePassword = cookiePassword)
when (val r = cookie.authenticate()) {
  is AuthenticateSessionResult.Success -> r.user // also r.sessionId, r.organizationId
  is AuthenticateSessionResult.Failure -> cookie.refresh() // RefreshSessionResult.Success has a new sealedSession; on failure, re-login
}

// Logout: clear the local cookie/session, then redirect to the AuthKit logout URL
val logoutUrl = cookie.getLogoutUrl(returnTo = "http://localhost:8080/")
```

## Setup

Order matters: add dependency → config bean → application properties → auth controller → build.

1. **Install:** add `com.workos:workos` to `build.gradle.kts` dependencies (there is no `workos-kotlin` artifact). Use the version from the README; the shapes below match 7.x.
2. **Application properties** (`src/main/resources/application.properties`, or the YAML equivalent):
   ```properties
   workos.api-key=${WORKOS_API_KEY}
   workos.client-id=${WORKOS_CLIENT_ID}
   workos.redirect-uri=http://localhost:8080/auth/callback
   workos.cookie-password=${WORKOS_COOKIE_PASSWORD}
   ```
3. **Config bean:** initialize the client with `WorkOS(apiKey = apiKey, clientId = clientId)` as a `@Bean`.
4. **Auth controller** (`@RestController`):
   - `GET /auth/login` → `workos.userManagement.getAuthorizationUrl(AuthKitAuthorizationUrlOptions(redirectUri = uri, provider = "authkit"))` returns a URL string (`clientId` falls back to the client's); redirect to it.
   - `GET /auth/callback` → read the `code` query param, `workos.userManagement.authenticateWithCode(code = code)`, then `workos.session.sealAuthResponse(auth, cookiePassword)` and set it as an HttpOnly cookie, redirect home.
   - `GET /auth/logout` → get the AuthKit logout URL from the sealed cookie (`loadSealedSession(...).getLogoutUrl(returnTo = ...)`), clear the cookie (and `HttpSession` if used), then redirect to that URL so the AuthKit session ends too.
5. **Build:** `./gradlew build`.

## Gotchas

- Callback path must equal `WORKOS_REDIRECT_URI` exactly.
- `WORKOS_COOKIE_PASSWORD` must be at least 32 characters; sealing throws otherwise.
- Ensure `jvmTarget` (and `jvmToolchain` if set) matches the installed JDK — check `java -version`; common values are `17` and `21`.

## Existing auth

If Spring Security is configured, permit the WorkOS routes through the filter chain (`.requestMatchers("/auth/workos/**").permitAll()`) and integrate with the existing chain rather than replacing it; use `/auth/workos/login` if `/login` is taken.
