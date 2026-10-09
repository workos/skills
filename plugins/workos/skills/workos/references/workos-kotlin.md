# WorkOS AuthKit for Kotlin (Spring Boot)

## Docs

Fetch the README first — it's the source of truth:

- SDK README: `https://raw.githubusercontent.com/workos/workos-kotlin/main/README.md`

If this file conflicts with fetched docs, follow the docs.

## Setup

Order matters: add dependency → config bean → application properties → auth controller → build.

1. **Install:** add `com.workos:workos` to `build.gradle.kts` dependencies (there is no `workos-kotlin` artifact). Use the version from the README; the shapes below match 7.x.
2. **Application properties** (`src/main/resources/application.properties`, or the YAML equivalent):
   ```properties
   workos.api-key=${WORKOS_API_KEY}
   workos.client-id=${WORKOS_CLIENT_ID}
   workos.redirect-uri=http://localhost:8080/auth/callback
   ```
3. **Config bean:** initialize the client with `WorkOS(apiKey = apiKey, clientId = clientId)` as a `@Bean`.
4. **Auth controller** (`@RestController`):
   - `GET /auth/login` → `workos.userManagement.getAuthorizationUrl(AuthKitAuthorizationUrlOptions(redirectUri = uri, provider = "authkit"))` returns a URL string (`clientId` falls back to the client's); redirect to it.
   - `GET /auth/callback` → read the `code` query param, `workos.userManagement.authenticateWithCode(code = code)`, store the user in `HttpSession`, redirect home.
   - `GET /auth/logout` → invalidate `HttpSession`, redirect.
5. **Build:** `./gradlew build`.

## Gotchas

- Callback path must equal `WORKOS_REDIRECT_URI` exactly.
- Ensure `jvmTarget` (and `jvmToolchain` if set) matches the installed JDK — check `java -version`; common values are `17` and `21`.

## Existing auth

If Spring Security is configured, permit the WorkOS routes through the filter chain (`.requestMatchers("/auth/workos/**").permitAll()`) and integrate with the existing chain rather than replacing it; use `/auth/workos/login` if `/login` is taken.
