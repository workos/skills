# AuthKit application setup

## Fetch docs first

- Client redirect defaults, allowed origins, and Initiate login: https://github.com/workos/authkit-react/blob/main/README.md
- Initiate login URI and server callback setup: https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri
- Sign-out URIs: https://workos.com/docs/authkit/sessions#sign-out-uris
- CLI setup: https://workos.com/docs/authkit/cli-installer

If this file conflicts with fetched docs, follow the docs.

Read this alongside the framework's SDK README for every new AuthKit integration, including migrations. A successful build does not prove that the WorkOS application is configured.

This reference covers saved settings and verification, not replacement auth code. Leave working routes alone when only configuration is missing. If routes are missing, read the framework reference and SDK README before implementing them. On server frameworks, sign-out must use a POST action with the framework's CSRF protection, not a GET handler. Use the SDK's session/sign-out helpers; never pass an encrypted session cookie as a session ID or build a custom OAuth flow.

## Configure three different URLs

Derive URLs from the app's actual origin, port, and routes. Do not copy example localhost URLs into a deployed environment.

| Setting            | What it points to                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect URI       | The destination where the SDK handles the OAuth response: a browser SDK destination or a server callback handler. Must match the effective SDK redirect URL exactly.                        |
| Sign-out URI       | A public page users land on after their session ends, not the route or action that performs logout. Configure a default; also register any destinations passed as `returnTo` / `return_to`. |
| Initiate login URI | An app route that starts AuthKit sign-in using the SDK. This is not the callback URL, the hosted AuthKit URL, or a page that merely displays a sign-in button.                              |

The Initiate login URI is also called `initiate_login_uri` or, in older docs, the Sign-in endpoint. AuthKit uses it when sign-in starts outside your app, such as a bookmarked hosted sign-in page, password-reset email, or invitation. Follow the SDK README for the route implementation, including client-side SDKs; do not invent a server callback for a SPA. Starting AuthKit sign-in lets the hosted flow preserve password-reset and invitation details.

The dashboard calls the logout destination **Sign-out URI**. The CLI command is still named `logout-uris`. Setting a homepage URL does **not** configure the Initiate login URI.

## Verify the effective redirect, registration, and destination

For React/vanilla browser SDKs, prefer the documented origin default (`window.origin`, e.g. `http://localhost:5173`) without creating an unnecessary `/callback` route. Explicit custom `redirectUri` values are supported; inspect provider/client options and actual env consumption, not only `.env` names. Server SDKs instead require their documented callback handler at the configured path; inspect programmatic overrides as well as env configuration.

Three independent checks are required:

1. **Effective value:** Trace the URL actually supplied to the SDK or its documented default. A variable in `.env` has no effect unless the SDK or application code consumes it.
2. **Registration:** Read back the redirect URLs for the confirmed environment/application and compare the full effective value. Do not silently normalize trailing slashes or ban them universally. `https://app.example.com/auth/complete/` is a supported custom destination shape when configuration and registration agree; a registration of `https://app.example.com/auth/complete` is a mismatch to investigate, not permission to rewrite either value without verification.
3. **Reachability and handling:** Inspect routes, provider/client initialization, static-host rewrites, and deployment at the actual destination. A mounted client SDK may handle a custom path; a 404, missing provider, or guard that navigates away before handling cannot. Neither successful URL parsing, a source grep hit, nor a passing build proves reachability or authentication. When browser testing is unavailable, report this check as unverified.

CORS is separate: register the origin of the app making browser API requests (scheme, hostname, and port), not a callback path. For `https://app.example.com/auth/complete`, that origin is `https://app.example.com`; `http://localhost:5173` and `http://localhost:3000` are different origins. An auth-prefixed hostname such as `https://auth.example.com` is not a forbidden path, but confirm whether it hosts the app or is only an API/custom auth domain.

### Offline comparison aid (not integration validation)

This read-only JavaScript snippet compares **already observed, non-secret** values. Run it locally with the effective redirect, saved lists, and the actual browser app URL. It performs no configuration writes or network requests. It deliberately compares the redirect string unchanged; URL parsing is used only to derive the CORS origin. It cannot verify route mounting, SDK initialization, ownership, or a hosted auth flow.

```javascript
function compareAuthKitUrls(effectiveRedirectUri, registeredRedirectUris, appUrl, allowedOrigins) {
  const appOrigin = new URL(appUrl).origin;
  return {
    redirectRegistered: registeredRedirectUris.includes(effectiveRedirectUri),
    appOrigin,
    corsOriginRegistered: allowedOrigins.includes(appOrigin),
  };
}
```

A `true` result is only list agreement, not a valid integration. Resolve missing destinations or mismatched registrations before calling setup complete. Preserve Sign-out URI and the separate SDK-backed Initiate login URI even when no server callback is needed.

## Choose the tool and target

Prefer an already-connected WorkOS MCP server for workspace settings. Discover operations and arguments with `list_operations` before using `query` or `mutate`. If none is connected, use the CLI; do not make MCP installation a prerequisite. Read [workos-management.md](workos-management.md) for command authentication and output shapes.

**Inside the WorkOS installer:** Its agent may be restricted to app-file edits and build/install commands. If the installer says it owns dashboard configuration, implement the required routes and let its native setup step handle the settings. Do not bypass denied shell commands through curl, scripts, another CLI installation, or SDK calls. Treat settings as unverified until the installer reports successful read-back; otherwise retain the explicit manual setup steps. If this reference is already in the prompt, do not try to read a relative copy from the app directory.

Before using CLI commands in a session that permits them, check what the installed version supports:

```bash
WORKOS_MODE=agent workos --help --json
WORKOS_MODE=agent workos api ls --json
```

The first lists named commands; the second lists REST endpoints available through `workos api`. Do not invent a command or endpoint because a similarly named GraphQL operation exists.

`authkit` and `config` commands require a dashboard session from `workos auth login`; `WORKOS_API_KEY` alone is not sufficient. Claiming the environment or signing into the app does not authenticate the CLI. If login is needed, follow the CLI's recovery instructions in the user's trusted host shell. An unclaimed install environment may need to be claimed before these commands can manage it. After authentication, resume configuration and read-back for that same environment; do not assume claiming it saved the URLs or switch environments just to make the command succeed.

```bash
WORKOS_MODE=agent workos environment list --json
WORKOS_MODE=agent workos whoami --environment-id "$ENVIRONMENT_ID" --json
```

Choose `ENVIRONMENT_ID` from the intended project and environment, not from a guessed ID or the first result. Confirm the team and compare `.environment.clientId` with the app's client ID. The CLI's environment-level AuthKit settings target the default application. If the app uses a different application, use application-specific MCP operations discovered at runtime or the dashboard instead. Pass the confirmed `--environment-id` on every scoped read and write. Do not change production settings for a local setup.

## Read, preserve, validate, apply, read back

1. Read existing callback URLs, sign-out URLs, defaults, and CORS origins:

   ```bash
   WORKOS_MODE=agent workos authkit redirect-uris list --environment-id "$ENVIRONMENT_ID" --json
   WORKOS_MODE=agent workos authkit logout-uris list --environment-id "$ENVIRONMENT_ID" --json
   WORKOS_MODE=agent workos authkit cors get --environment-id "$ENVIRONMENT_ID" --json
   ```

2. Here `CALLBACK_URL` means the effective SDK redirect destination, including the origin default for a client SDK; it does not imply a server handler. For a single redirect or CORS addition, use the positional URL argument shown below, not `--uri` or `--origin`. These commands preserve existing entries through read-merge-write, but a concurrent edit can still be overwritten. Configure CORS only when the SDK requires it; never allow wildcard origins.

   ```bash
   WORKOS_MODE=agent workos config redirect add "$CALLBACK_URL" --environment-id "$ENVIRONMENT_ID"
   WORKOS_MODE=agent workos config cors add "$APP_ORIGIN" --environment-id "$ENVIRONMENT_ID"
   ```

3. **`authkit redirect-uris set`, `authkit logout-uris set`, and `authkit cors set` replace the full list.** Include every existing entry that must remain. Preserve the existing default unless the user intends to change it; if none exists, choose a valid default for this integration. For URI setters, `--default` must match one of the supplied `--uri` values. Do not reconstruct a list from a potentially truncated read. URI list commands expose `--limit` but not pagination metadata; if completeness is uncertain, use a tool that can retrieve the complete list or ask the user to configure it in the dashboard.

4. For sign-out setup, construct `authkit logout-uris set` with repeated `--uri` flags for the **complete merged list**, the intended `--default`, and the confirmed `--environment-id`. Run it with `--dry-run` first. Inspect the proposed URLs and default, then apply the same command without `--dry-run`. A dry run validates input without saving it; it does not prove the proposed replacement preserves existing configuration. Obtain explicit approval before removing URLs or changing an existing default.

   Example template **only when the complete existing list has two entries, one the default**. Populate the existing URL variables from the read result, not invented placeholders. The default is also included as a `--uri`:

   ```bash
   WORKOS_MODE=agent workos authkit logout-uris set \
     --environment-id "$ENVIRONMENT_ID" \
     --uri "$EXISTING_DEFAULT_URI" \
     --uri "$OTHER_EXISTING_URI" \
     --uri "$NEW_SIGN_OUT_URI" \
     --default "$EXISTING_DEFAULT_URI" \
     --dry-run --json
   ```

   Include another `--uri` for every additional existing entry. For a new empty list, include the new destination as both `--uri` and `--default`. Never supply a separate default URL that is absent from the list.

5. Read the settings back using the same environment ID. Confirm the new URLs and default were saved and existing entries remain. Do not report a successful dry run as completed configuration.

## Configure Initiate login URI

The CLI snapshot used for this guide has no named initiate-login command, and the REST catalog in `@workos/openapi-spec` 0.100.0 has no endpoint for this setting. Re-check live help and `api ls` rather than assuming this remains true in future versions.

If a WorkOS MCP server is connected, discover `initiateLoginUrl` and `UpdateInitiateLoginUrl` with `list_operations`. These are environment/default-application operations; confirm their current arguments and target before reading or changing anything. Read the existing value, set it to the app's SDK-backed sign-in route, then read it back. Do not assume an operation is callable just because it appears in a bundled catalog.

If neither CLI nor connected MCP supports the setting, have the user configure the **Initiate login URI** in the application's Redirects settings in the WorkOS dashboard, following the fetched docs. Give the exact app URL and target environment. Report this as a remaining setup step until it is verified. Do not substitute the callback or `config homepage-url set`, invent a CLI command, or send raw dashboard GraphQL through `workos api`.

## Sign-out configuration error

If SDK sign-out redirects to `https://error.workos.com/user_management/app-homepage-url-not-found`, inspect the application's default **Sign-out URI** before rewriting the sign-out action. Normal sign-in can work while the sign-out list is empty. Configure the missing default, read it back, then sign in again and retry sign-out. The error URL's legacy wording does not mean the app needs a new homepage route.

## Completion checklist

- [ ] Callback, Sign-out URI, and Initiate login URI are configured for the app's actual environment/application, with saved settings verified by read-back or user confirmation.
- [ ] Existing URLs, CORS origins, and intended defaults are preserved.
- [ ] Normal sign-in completes through the callback and creates an app session.
- [ ] Sign-out ends the session, lands on the configured public page, and leaves protected content inaccessible.
- [ ] A sign-in started outside the app, such as a bookmark, password-reset email, or invitation, reaches the Initiate login URI and continues to the correct AuthKit flow without a loop or callback error.
- [ ] The framework build and integration checks pass.

If account access or browser testing is unavailable, distinguish **code implemented**, **settings verified**, and **flows tested** in the completion report. Name each unverified setting or flow and the next action. Never call the integration complete based only on a build, generated routes, or `workos doctor` output.
