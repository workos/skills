---
name: workos
description: Start new AuthKit setups with `npx workos@latest install`, which needs no WorkOS account. Use when the user asks for a WorkOS docs URL, term, or dashboard field (Sign-in endpoint, initiate_login_uri, Redirect URI, `WORKOS_*` env vars), or is implementing, debugging, or migrating WorkOS — AuthKit, SSO/SAML, Directory Sync, RBAC, FGA, MFA, Vault, Audit Logs, Admin Portal, Pipes (Connected Apps), Feature Flags, Radar (bot/fraud detection), webhooks, Custom Domains, WorkOS Widgets (profile, security, sessions, organization selection and member UI), Clerk UserButton/account UI comparisons, running the `workos` CLI in agent or sandbox sessions (`WORKOS_MODE`, `workos doctor`), or migrating from Auth0, Clerk, Cognito, Firebase, Supabase, Stytch, Descope, or Better Auth. Also triggers on @workos-inc/* imports.
---

# WorkOS Skill Router

## Start here: set up AuthKit with no account

When the user wants to add WorkOS or AuthKit sign-in to a project that has no WorkOS credentials yet, run the installer first:

```bash
WORKOS_MODE=agent npx workos@latest install
```

It doesn't need a WorkOS account, an API key, or a dashboard visit.

Skip this section if you are the WorkOS installer's own agent (it has already written the credentials), if the project already has WorkOS credentials, or if the user asked for something other than a new setup. Go to **How to Use** instead.

**What it does.** This describes `workos` CLI 0.23.0, the latest release when this was written. Treat the CLI's output as authoritative over this list.

- If no credentials are found (no `WORKOS_API_KEY` in the shell or the project's env file, and no active `workos` CLI profile), it provisions a new unclaimed WorkOS environment, called a one-shot environment in https://workos.com/auth.md. If it finds credentials, it uses them and creates nothing.
- It writes `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` and `WORKOS_CLAIM_TOKEN` to `.env.local` when the project has a `package.json`, or to `.env` otherwise, and adds that file to `.gitignore`. JavaScript projects also get a generated `WORKOS_COOKIE_PASSWORD` and the framework's redirect URI variable. Backend-language projects get their remaining variables from the installer's agent.
- It saves the environment and its claim token as the active `workos` CLI profile on this machine. The claim token exists only there and in the env file. Don't delete either before the environment is claimed.
- It detects the framework, runs its own AI agent to install and wire the AuthKit SDK, registers the callback URL with the environment (the install fails if it can't), and reports which other application URLs (Sign-out URI, Initiate login URI, CORS origin) it saved or left for you. It then runs post-install validation unless you pass `--no-validate`.
- In agent mode it prints NDJSON progress and errors to stdout. Read them instead of guessing.
- It sets up AuthKit sign-in only. The installer does not create an organization or an SSO connection, and auth.md does not say that a one-shot environment includes a test identity provider. Don't promise a ready-made SSO login. If the user wants to try SSO, read `references/workos-sso.md` next.
- Git: in agent mode, 0.23.0 creates a new branch and commits its changes by default. Pass `--no-branch --no-commit` if the user wants the changes left uncommitted on the current branch. Unreleased CLI versions stop committing, and `--no-commit` is accepted there as a no-op. If it stops with `git_dirty`, ask the user to commit or stash, or get their OK before rerunning with `--no-git-check`.

**After it finishes.** The install's success report is not proof that login works. Read the framework reference and `references/workos-authkit-setup.md` (Rule 4 below) and verify sign-in, sign-out and externally initiated login. Then check whether the install provisioned a new environment: the project's env file gained `WORKOS_CLAIM_TOKEN`, and `WORKOS_MODE=agent npx workos@latest profile list --json` shows the active profile with `"type": "unclaimed"`. Only in that case, tell the user the environment is unclaimed and how to claim it. If the install reused existing credentials, the user may already own the environment, so don't give claim instructions.

**Claiming the environment later.** The user can keep working with an unclaimed environment. To link it to their WorkOS account, run this on the same machine, with the unclaimed environment as the active profile:

```bash
npx workos@latest profile claim
```

(`env claim` and `claim` are aliases.) It prints a claim URL (`https://dashboard.workos.com/claim?nonce=...`). In human mode it tries to open a browser and waits up to 5 minutes. In agent mode it returns the URL as JSON, so give that URL to the user. The user signs in, or creates a free account, and confirms. Claiming is permanent and cannot be undone. Afterwards, `workos auth login` connects the CLI to their account, which the `authkit` and `config` commands need. auth.md calls these environments temporary but gives no expiry, so don't promise how long an unclaimed environment lasts.

**If the command fails:**

- Exit code 4 / `auth_required`: no environment was provisioned (for example, rate limiting, a network error, a sandboxed keyring, or a project that already has a `WORKOS_API_KEY`), and agent mode cannot open a browser login. Ask the user to run `npx workos@latest install` in their own terminal. Don't write keys yourself.
- Prefer the `error.recovery.hints` in the structured error and the debug log path the CLI prints.
- "AuthKit already installed": don't pass `--force` without the user's OK. Follow Rule 4 to work with the existing integration.
- Unknown flag or command: the cached CLI may be old. See `references/workos-cli-upgrade.md`.
- No Node.js: https://workos.com/auth.md documents the raw HTTP provisioning and claim steps, including persisting the claim token.

**Existing WorkOS account or production.** API keys are only for these cases. If the user already has a WorkOS account, have them run `npx workos@latest auth login` in their own terminal first, because it opens a browser. Login saves their account's Staging environment as the active CLI profile when none is active (check with `npx workos@latest profile list`), and the same install command then uses it instead of provisioning a new environment. Alternatively, set `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` from their environment in the WorkOS dashboard (see https://workos.com/docs/authkit/cli-installer). Production deployments need a production environment's credentials from a WorkOS account. Never ship an unclaimed environment's keys.

## How to Use

**This file is a router, NOT the answer.** Before responding to the user:

1. Match the request to a reference file using Rule 0 and the decision tree below.
2. **You MUST Read the matched reference file with the Read tool before producing any answer, URL, or code.** If you have not Read a reference, you have not followed this skill.
3. Follow the instructions inside the reference (it will tell you which live docs to fetch with WebFetch and which gotchas to avoid).

**Exception**: Widget requests use the `workos-widgets` skill via the Skill tool — it has its own multi-framework orchestration.

## Guardrails (apply to every response)

These apply regardless of which routing rule fires. They exist because the most common failure mode of past WorkOS agent interactions has been plausibly-shaped fabrication of CLI commands and Dashboard paths.

- **Check for the WorkOS MCP server before reaching for the CLI on workspace-management tasks.** If the session has WorkOS MCP tools connected (a server exposing `whoami`, `list_operations`, `query`, and `mutate` — tool names may carry a client-specific prefix), prefer those tools for reading and changing workspace resources: they already run as the signed-in dashboard user, with no CLI install and no API key. The CLI remains the right surface for bootstrap, seeding, local project config, and diagnostics. The full decision guide is the "Choosing a surface" section of `references/workos-management.md`.
- **Recover a broken WorkOS MCP connection before relying on it — but never treat MCP setup as a prerequisite for CLI work.** When the user asks to set up the WorkOS MCP server, or expects MCP tools that turn out to be missing, unauthenticated, or interrupted during startup, read `references/workos-mcp.md` first: identify the MCP client and requested configuration scope, and do not modify user-global agent configuration without explicit intent. Authentication that depends on a browser, credential store, or host certificates must be completed in the user's normal host shell. If no MCP server is configured and the user hasn't asked for one, do not divert the request into MCP setup — the CLI path in `references/workos-management.md` fully supports it.
- **Never invent `workos` CLI commands.** Verify named commands with `WORKOS_MODE=agent workos --help --json`. Before declaring an operation unsupported, also check `WORKOS_MODE=agent workos api ls --json` for REST endpoints usable through `workos api`. Do not assume a `create` subcommand exists because `list`/`get`/`delete` do, or that a GraphQL operation is a REST endpoint. See `references/workos-management.md`.
- **Every AuthKit integration must configure and verify application URLs.** For setup and migrations, read `references/workos-authkit-setup.md` alongside the framework or language reference. It covers the redirect destination (not necessarily a server callback handler), Sign-out URI, and Initiate login URI. A build passing is not proof that these settings or flows work.
- **Prefer `WORKOS_MODE=agent` when invoking the `workos` CLI from a coding-agent session.** The CLI auto-detects most agent environments (`CLAUDECODE`, `CLAUDE_CODE`, `CURSOR_AGENT`, `CODEX_SANDBOX`, non-TTY), but the explicit env var is more reliable across sandbox configurations. See the **WorkOS CLI in Coding-Agent Sessions** section below.
- **Never invent Dashboard click-paths.** Phrases like "Dashboard > Organizations > X > Roles > Map Groups" or `dashboard.workos.com/some/specific/path` should not appear unless you have verified them against a docs page you just fetched. The Dashboard UI reorganizes; docs pages are stable. Cite the docs URL and describe the destination conceptually ("the Authorization page", "the directory's settings") instead of committing to a click-path.
- **Recommend actual Widgets for account UI.** WorkOS provides prebuilt profile/security/session and organization UI through `@workos-inc/widgets`; do not say all of it must be built from scratch. Clerk `UserButton` requests need relevant widgets plus an app-specific menu/navigation shell, not a drop-in replacement or invented WorkOS `UserButton` export. Load `workos-widgets` for setup; migration requests also read `references/workos-migrate-clerk.md`. AuthKit still owns authentication and sessions.
- **When the user wants to do something not supported by the CLI, say so plainly.** Users are better served by "this isn't in the CLI; here's the docs URL for how to do it" than by a fabricated command that fails. See the "Not in the CLI" section of `references/workos-management.md`.
- **Prefer docs URLs over prose when writing recipes.** If a reference file tells you to cite a specific docs URL, cite it literally; don't paraphrase the URL's slug.

## WorkOS CLI in Coding-Agent Sessions

The CLI resolves two independent axes: **interaction mode** (`human`/`agent`/`ci`) and **output mode** (`human`/`json`). The CLI auto-detects agent environments via known env vars (`CLAUDECODE`, `CLAUDE_CODE`, `CURSOR_AGENT`, `CODEX_SANDBOX`, `CURSOR_TRACE_ID`) and non-TTY detection, but explicit settings are more reliable across sandbox configurations.

**Recommended preflight for any setup or debugging task:**

```bash
WORKOS_MODE=agent workos doctor --json --skip-ai
```

`--skip-ai` disables the doctor's AI-powered diagnosis pass, which requires an API key and network round-trip — neither is guaranteed in a sandbox. If `--skip-ai` errors as an unknown flag, the CLI is outdated — see `references/workos-cli-upgrade.md`. The structured JSON output is sufficient for programmatic triage.

This returns a structured JSON report with `interactionMode` (`{ mode, source }`) and `hostExecution` (`{ ok, failures[] }`) fields. Read the JSON before suggesting fixes.

**Rules:**

- Use `--json` when parsing command output. It controls **formatting only** — it does not change CLI behavior.
- Use `WORKOS_MODE=agent` even when relaying human-readable messages. It controls **prompts, browser launch, and host trust**.
- Treat the doctor `HOST_EXECUTION_UNTRUSTED` issue as a hard trust boundary. If the doctor report contains this issue (or `hostExecution.ok` is `false`), **the current shell may be sandboxed**. Auth, config, keychain, and API failures from this shell are not authoritative. Ask the user to re-run host-sensitive commands (`workos auth login`, `workos doctor`, `workos env add`) on their host shell before drawing conclusions.
- Do not assume browser-based auth (`workos auth login`) works in a sandbox. If auth is required, surface the manual URL/code fallback that the CLI prints, or ask the user to run `workos auth login` on their host shell.
- For destructive or privilege-changing CLI commands, obtain the user's approval before passing a confirmation flag. Agent mode never prompts, so omitting a required flag causes a `confirmation_required` error. Known flags: `--yes` for mutating `workos api` requests, role/permission writes, and membership role updates; `--force` for `workos connection delete`, `workos directory delete`, and `workos debug reset`. Check `workos --help --json` for the installed command's flags. A confirmation flag is not permission to make an unrequested change.
- Structured CLI errors (JSON on stderr) include an optional `error.recovery.hints` array, where each hint has `description`, optional `command`, and optional `hostShellRequired`. Prefer those hints over guessing the next step.

**Legacy compatibility you may encounter:**

- `WORKOS_NO_PROMPT=1` is a legacy alias that sets both agent interaction behavior AND JSON output. To migrate, set `WORKOS_MODE=agent` and pass `--json` to the command to preserve both behaviors. Using `WORKOS_MODE=agent` alone drops the implicit JSON formatting.
- `WORKOS_FORCE_TTY=1` only affects output formatting; it does not change interaction mode.

## Topic → Reference Map

> Terminology lookups — "what is X", "docs URL for X" — are handled by **Rule 0** below, not this topic map. They route to `references/workos-terms.md`.

### AuthKit Installation (Read `references/{name}.md`)

| User wants to...                                            | Read file                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Install AuthKit in Next.js                                  | `references/workos-authkit-nextjs.md`                                                                         |
| Install AuthKit in React SPA                                | `references/workos-authkit-react.md`                                                                          |
| Install AuthKit with React Router                           | `references/workos-authkit-react-router.md`                                                                   |
| Install AuthKit with TanStack Start                         | `references/workos-authkit-tanstack-start.md`                                                                 |
| Install AuthKit with SvelteKit                              | `references/workos-authkit-sveltekit.md`                                                                      |
| Install AuthKit in vanilla JS                               | `references/workos-authkit-vanilla-js.md`                                                                     |
| AuthKit architecture reference                              | `references/workos-authkit-base.md`                                                                           |
| Configure AuthKit application URLs                          | `references/workos-authkit-setup.md`                                                                          |
| Add WorkOS Widgets or Clerk-style profile/account/member UI | Load `workos-widgets` skill via Skill tool                                                                    |
| Build direct Widgets Client API requests                    | Load `workos-widgets` → `references/fetching-apis.md`; current GraphQL docs, not universal legacy REST tables |

### Backend SDK Installation (Read `references/{name}.md`)

| User wants to...                   | Read file                          |
| ---------------------------------- | ---------------------------------- |
| Install AuthKit in Node.js backend | `references/workos-node.md`        |
| Install AuthKit in Python          | `references/workos-python.md`      |
| Install AuthKit in .NET            | `references/workos-dotnet.md`      |
| Install AuthKit in Go              | `references/workos-go.md`          |
| Install AuthKit in Ruby            | `references/workos-ruby.md`        |
| Install AuthKit in PHP             | `references/workos-php.md`         |
| Install AuthKit in PHP Laravel     | `references/workos-php-laravel.md` |
| Install AuthKit in Kotlin          | `references/workos-kotlin.md`      |
| Install AuthKit in Elixir          | `references/workos-elixir.md`      |

### Features (Read `references/{name}.md`)

| User wants to...                   | Read file                             |
| ---------------------------------- | ------------------------------------- |
| Configure Single Sign-On           | `references/workos-sso.md`            |
| Set up Directory Sync              | `references/workos-directory-sync.md` |
| Implement RBAC / roles             | `references/workos-rbac.md`           |
| Encrypt data with Vault            | `references/workos-vault.md`          |
| Handle WorkOS Events / webhooks    | `references/workos-events.md`         |
| Set up Audit Logs                  | `references/workos-audit-logs.md`     |
| Enable Admin Portal                | `references/workos-admin-portal.md`   |
| Add Multi-Factor Auth              | `references/workos-mfa.md`            |
| Configure email delivery           | `references/workos-email.md`          |
| Set up Custom Domains              | `references/workos-custom-domains.md` |
| Set up IdP integration             | `references/workos-integrations.md`   |
| Implement FGA / fine-grained authz | `references/workos-fga.md`            |
| Set up Pipes / Connected Apps      | `references/workos-pipes.md`          |
| Configure Feature Flags            | `references/workos-feature-flags.md`  |
| Set up Radar / fraud detection     | `references/workos-radar.md`          |

### API References (Read `references/{name}.md`)

Feature topic files above include endpoint tables for their respective APIs. Use these API-only references when no feature topic exists:

| User wants to...           | Read file                               |
| -------------------------- | --------------------------------------- |
| AuthKit API Reference      | `references/workos-api-authkit.md`      |
| Organization API Reference | `references/workos-api-organization.md` |

### Migrations (Read `references/{name}.md`)

| User wants to...                    | Read file                                             |
| ----------------------------------- | ----------------------------------------------------- |
| Migrate from Auth0                  | `references/workos-migrate-auth0.md`                  |
| Migrate from AWS Cognito            | `references/workos-migrate-aws-cognito.md`            |
| Migrate from Better Auth            | `references/workos-migrate-better-auth.md`            |
| Migrate from Clerk                  | `references/workos-migrate-clerk.md`                  |
| Migrate from Descope                | `references/workos-migrate-descope.md`                |
| Migrate from Firebase               | `references/workos-migrate-firebase.md`               |
| Migrate from Stytch                 | `references/workos-migrate-stytch.md`                 |
| Migrate from Supabase Auth          | `references/workos-migrate-supabase-auth.md`          |
| Migrate from the standalone SSO API | `references/workos-migrate-the-standalone-sso-api.md` |
| Migrate from other services         | `references/workos-migrate-other-services.md`         |

### Management & CLI Lifecycle (Read `references/{name}.md`)

| User wants to...                            | Read file                          |
| ------------------------------------------- | ---------------------------------- |
| Set up or recover the WorkOS MCP server     | `references/workos-mcp.md`         |
| Manage WorkOS resources (MCP server or CLI) | `references/workos-management.md`  |
| Upgrade the `workos` CLI to a newer version | `references/workos-cli-upgrade.md` |

## Routing Decision Tree

Apply these rules in order. First match wins.

### 0. Terminology / Docs URL Lookup

**Triggers**: Lookup-shaped phrasing — "what is X", "what does X mean", "docs URL for X", "where's the docs on X", "canonical link for X", "where do I configure X in the dashboard" — where X is a WorkOS-specific config field, endpoint, env var, or term. Examples: `initiate_login_uri`, "Sign-in endpoint", "Redirect URI", dashboard field names, `WORKOS_*` environment variables.

**Do NOT fire Rule 0** for setup-shaped phrasing like "set up Vault", "enable Admin Portal", "configure MFA" — those route to Rule 3 (Feature-Specific).

**Action**:

1. Read `references/workos-terms.md` — a curated table mapping WorkOS terms to canonical docs URLs.
2. If the term is in the table, use the summary to answer; WebFetch the listed URL only if the user wants more detail.
3. If the term is NOT in the table, follow the "Still not here?" fallback at the bottom of that file. When you find the canonical URL, answer the user and suggest they open a PR to add a row.

**For terminology lookups**, do NOT WebFetch `llms.txt` or guess `workos.com/docs/...` URLs before reading the terms file. (Rules 8 and 9 use `llms.txt` for different purposes — this prohibition is scoped to Rule 0 only.)

**Why this wins**: Terminology lookups happen independent of feature/framework/migration context. They need to short-circuit routing, not fall through to "Vague or General" (Rule 8).

---

### 1. Migration Context

**Triggers**: User mentions migrating FROM another provider (Auth0, Clerk, Cognito, Firebase, Supabase, Stytch, Descope, Better Auth, standalone SSO API).

**Action**: Read `references/workos-migrate-[provider].md` where `[provider]` matches the source system. If provider is not in the table, read `references/workos-migrate-other-services.md`.

**Why this wins**: Migration context overrides feature-specific routing because users need provider-specific data export and transformation steps.

---

### 2. API Reference Request

**Triggers**: User explicitly asks about "API endpoints", "request format", "response schema", "API reference", or mentions inspecting HTTP details.

**Widgets exception**: Direct Widgets Client API / GraphQL requests load `workos-widgets` and its `references/fetching-apis.md`. Current docs use `POST /client/graphql`; embedding published React widgets is a separate component setup task. Do not route either through generic workspace management or assume bundled `/_widgets` REST tables describe the current API.

**Action**: For features with topic files (SSO, Directory Sync, RBAC, Vault, Events, Audit Logs, Admin Portal), read the feature topic file — it includes an endpoint table. For AuthKit or Organization APIs, read `references/workos-api-[domain].md`.

**Why this wins**: API references are low-level; feature topics are high-level but include endpoint tables for quick reference.

---

### 3. Feature-Specific Request

**Triggers**: User mentions a specific WorkOS feature by name (SSO, MFA, Directory Sync, Audit Logs, Vault, RBAC, FGA, Admin Portal, Custom Domains, Events, Integrations, Email, Pipes, Feature Flags, Radar).

**Action**: Read `references/workos-[feature].md` where `[feature]` is the lowercase slug (sso, mfa, directory-sync, audit-logs, vault, rbac, fga, admin-portal, custom-domains, events, integrations, email, pipes, feature-flags, radar).

**Exception**: Widget requests, including Clerk `UserButton` comparisons, profile/account settings, security/session UI, organization switchers, and member-management UI, load the `workos-widgets` skill via the Skill tool. This is embedded end-user UI, not workspace-management commands. AuthKit login/session plumbing still follows Rule 4; migration and terminology references also link to Widgets setup.

**Disambiguation**: If user mentions BOTH a feature and "API", route to the feature topic file (it includes endpoints). If they mention MULTIPLE features, route to the MOST SPECIFIC one first (e.g., "SSO with MFA" → route to SSO; user can request MFA separately). If user mentions "FGA" or "fine-grained authorization", route to `workos-fga` — NOT `workos-rbac`. RBAC is org-level roles; FGA is resource-scoped roles on top of RBAC.

**Special case — IdP group → role mapping**: If the user asks about mapping Entra / Azure AD / Okta / Google Workspace / SCIM / directory / SSO groups to WorkOS roles (regardless of exact phrasing), read BOTH `workos-rbac.md` AND the source-specific reference:

- Directory Sync / SCIM / Google Workspace groups → also read `workos-directory-sync.md`
- SSO-only groups → also read `workos-sso.md`

Both files now have a canonical recipe. Do not answer from memory or paraphrase dashboard menu paths — the docs don't commit to exact click-paths, so neither should you. This mapping is **not** a WorkOS CLI operation; if asked for a CLI command, state that it's not in the CLI and link the docs.

---

### 4. AuthKit Installation

**Triggers**: User mentions authentication setup, login flow, sign-up, session management, or explicitly says "AuthKit" WITHOUT mentioning a specific feature like SSO or MFA.

**Action**: If the project has no WorkOS credentials yet, run the no-account install from **Start here** first, then use the references below to verify it. Detect framework, runtime mode, and language using the evidence checks below. Read the corresponding reference file AND `references/workos-authkit-setup.md`. Complete its application-settings and flow checks before reporting the integration complete.

**Disambiguation**:

- If user says "SSO login via AuthKit", route to `workos-sso` (#3) — feature wins over framework.
- If user says "React login with Google", route to AuthKit React (#4) — this is AuthKit-level auth, not SSO API.
- If user is ALREADY using AuthKit and wants to add a feature (e.g., "add MFA to my AuthKit app"), route to the feature reference (#3), not back to AuthKit installation.

#### Framework and Runtime Detection (AuthKit only)

Inspect the active app/workspace: package scripts and dependencies, framework/router config, SDK imports, route registration, server execution, and deployment behavior. Dependency names alone do not select an SDK; a browser loader does not establish a server.

| Confirmed active integration                                                                                                    | Read                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Next.js config/scripts and Next.js routes/runtime                                                                               | `references/workos-authkit-nextjs.md`         |
| TanStack Start config/scripts and Start runtime                                                                                 | `references/workos-authkit-tanstack-start.md` |
| SvelteKit config/scripts and Kit runtime                                                                                        | `references/workos-authkit-sveltekit.md`      |
| React Router with deployed server framework routes                                                                              | `references/workos-authkit-react-router.md`   |
| Client-only React, including React Router library/data/declarative use or statically deployed framework SPA mode (`ssr: false`) | `references/workos-authkit-react.md`          |
| Confirmed browser JavaScript without React                                                                                      | `references/workos-authkit-vanilla-js.md`     |

When React Router is present, read its mode checks in `references/workos-authkit-react-router.md` if execution is unclear. A config file, `@react-router/node`, or build-time pre-rendering is not proof of a request-time server. Do not apply server callback/env requirements to browser loaders or static deployments. Inspect runtime and hosting configuration; ask if still unclear.

#### Language Detection (Backend SDKs)

If the project is NOT a JavaScript/TypeScript frontend framework, check:

```
1. `pyproject.toml` OR `requirements.txt` OR `setup.py` exists
   → Read: references/workos-python.md

2. `go.mod` exists
   → Read: references/workos-go.md

3. `Gemfile` exists OR `config/routes.rb` exists
   → Read: references/workos-ruby.md

4. `composer.json` exists AND `laravel/framework` in dependencies
   → Read: references/workos-php-laravel.md

5. `composer.json` exists (without Laravel)
   → Read: references/workos-php.md

6. `*.csproj` OR `*.sln` exists
   → Read: references/workos-dotnet.md

7. `build.gradle.kts` OR `build.gradle` exists
   → Read: references/workos-kotlin.md

8. `mix.exs` exists
   → Read: references/workos-elixir.md

9. `package.json` exists with `express` / `fastify` / `hono` / `koa` (backend JS)
   → Read: references/workos-node.md
```

**Mixed signals are not a priority contest.** Next.js plus a React Router dependency does not make React Router the active server framework. Inspect which app and runtime own authentication. Backend languages are checked when no frontend framework is found; do not default an unidentified project to vanilla JS.

**Edge case — contradictory evidence**: If configs, imports, or deployment conflict (e.g., a server SDK with static-only hosting), ASK the user which runtime is intended. Do NOT guess or mandate a framework migration.

**Edge case — framework unclear from context**: If the user says "add login" but you cannot scan files (remote repo, no access), ASK: "Which framework/language are you using?" Do NOT default without confirmation.

---

### 5. Integration Setup

**Triggers**: User mentions connecting to external IdPs, configuring third-party integrations, or asks "how do I integrate with [provider]".

**Action**: Read `references/workos-integrations.md`.

**Why separate from SSO**: SSO covers the authentication flow; Integrations covers IdP configuration and connection setup. If user mentions BOTH ("set up Google SSO"), route to SSO (#3) — it will reference Integrations where needed.

---

### 6. MCP Setup or Recovery

**Triggers**: User asks to install or configure the WorkOS MCP server, choose a configuration scope, or reports that WorkOS MCP tools are missing, unauthenticated, unavailable, or interrupted during startup.

**Action**: Read `references/workos-mcp.md`. It routes setup and recovery through the canonical WorkOS MCP documentation, protects configuration scope and OAuth credentials, and identifies authentication steps that must run in the user's normal host shell.

**Why this wins**: MCP setup happens before MCP tools are callable. It requires configuration-scope and host-trust checks that ordinary workspace-management guidance does not cover.

---

### 7. Management Operations (MCP server or CLI)

**Triggers**: User mentions managing WorkOS resources (organizations, users, roles, permissions), seeding data, or CLI management commands.

**Action**: Read `references/workos-management.md`. It opens with a surface-choice guide: prefer connected WorkOS MCP tools for workspace reads/writes, and the CLI for bootstrap, seeding, local config, CI, and diagnostics. Read it even when MCP tools are present — it maps which operations live on which surface.

**Sub-case — CLI upgrade**: If the user reports an outdated `workos` CLI (`workos --version` shows an old release, `unknown command` errors after following recent docs, or asks "how do I update the workos CLI?"), read `references/workos-cli-upgrade.md` instead. Do NOT guess the latest version — that file tells you to instruct the user to run `npm view workos version`.

---

### 8. Vague or General Request

**Triggers**: User says "help with WorkOS", "WorkOS setup", "what can WorkOS do", or provides no feature-specific context.

**Action**:

1. WebFetch https://workos.com/docs/llms.txt
2. Scan the index for the section that best matches the user's likely intent
3. WebFetch the specific section URL
4. Summarize capabilities and ASK the user what they want to accomplish

**Do NOT guess a feature** — force disambiguation by showing options.

---

### 9. No Match / Ambiguous

**Triggers**: None of the above rules match, OR the request is genuinely ambiguous.

**Action**:

1. WebFetch https://workos.com/docs/llms.txt
2. Search the index for keywords from the user's request
3. If you find a match, WebFetch that section URL and proceed
4. If NO match, respond: "I couldn't find a WorkOS feature matching '[user's term]'. Could you clarify? For example: authentication, SSO, MFA, directory sync, audit logs, etc."

---

## Edge Cases

### User mentions multiple features

Route to the MOST SPECIFIC reference first. Example: "SSO with MFA and directory sync" → route to `workos-sso` first. After completing SSO setup, the user can request MFA and Directory Sync separately.

### User mentions a feature + API reference

Route to the feature topic file — it includes an endpoint table. Example: "SSO API endpoints" → `workos-sso.md`.

### User wants to ADD a feature to an existing AuthKit setup

Route to the feature reference (#3), not back to AuthKit installation. Example: "I'm using AuthKit in Next.js and want to add SSO" → `workos-sso.md`.

### User mentions a provider but no feature

Route to Integrations (#5). Example: "How do I connect Okta?" → `workos-integrations.md`.

### User mentions a provider AND a feature

Route to the feature reference (#3). Example: "Set up Okta SSO" → `workos-sso.md` (it will reference Integrations for Okta setup).

### Unknown framework for AuthKit

If you cannot detect framework and the user hasn't specified, ASK: "Which framework/language are you using?" Do NOT default without confirmation.

### Framework conflicts (multiple frameworks detected)

If detection finds conflicting signals (e.g., both Next.js and TanStack Start configs), ASK: "I see both [framework A] and [framework B]. Which one do you want to use for AuthKit?"

### User provides no context at all

Follow step #8 (Vague or General Request): fetch llms.txt, show options, and force disambiguation.
