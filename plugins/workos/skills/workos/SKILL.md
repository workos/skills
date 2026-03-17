---
name: workos
description: Use when the user is implementing, debugging, or asking about WorkOS in any way — authentication, login, sign-up, sessions, access tokens, organization-scoped tokens, device authorization, SSO, SAML, SCIM, Directory Sync, RBAC, roles, permissions, FGA, MFA, Vault, Audit Logs, Admin Portal, webhooks, events, user management, email, custom domains, AuthKit (any framework), backend SDKs, migrations from Auth0/Clerk/Cognito/Firebase/Supabase/Stytch, or WorkOS API references. Routes to the right reference and gotchas.
---

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult the tables below to route to the right reference.

## Loading References

**All references** are topic files in the `references/` directory. Read the file and follow its instructions (fetch docs first, then use gotchas to avoid common traps).

**Exception**: Widget requests use the `workos-widgets` skill via the Skill tool — it has its own multi-framework orchestration.

## Topic → Reference Map

### AuthKit Installation (Read `references/{name}.md`)

| User wants to...                    | Read file                                         |
| ----------------------------------- | ------------------------------------------------- |
| Install AuthKit in Next.js          | `references/workos-authkit-nextjs.md`              |
| Install AuthKit in React SPA        | `references/workos-authkit-react.md`               |
| Install AuthKit with React Router   | `references/workos-authkit-react-router.md`        |
| Install AuthKit with TanStack Start | `references/workos-authkit-tanstack-start.md`      |
| Install AuthKit with SvelteKit      | `references/workos-authkit-sveltekit.md`           |
| Install AuthKit in vanilla JS       | `references/workos-authkit-vanilla-js.md`          |
| AuthKit architecture reference      | `references/workos-authkit-base.md`                |
| Add WorkOS Widgets                  | Load `workos-widgets` skill via Skill tool         |

### Backend SDK Installation (Read `references/{name}.md`)

| User wants to...                     | Read file                              |
| ------------------------------------ | -------------------------------------- |
| Install AuthKit in Node.js backend   | `references/workos-node.md`            |
| Install AuthKit in Python            | `references/workos-python.md`          |
| Install AuthKit in .NET              | `references/workos-dotnet.md`          |
| Install AuthKit in Go                | `references/workos-go.md`              |
| Install AuthKit in Ruby              | `references/workos-ruby.md`            |
| Install AuthKit in PHP               | `references/workos-php.md`             |
| Install AuthKit in PHP Laravel       | `references/workos-php-laravel.md`     |
| Install AuthKit in Kotlin            | `references/workos-kotlin.md`          |
| Install AuthKit in Elixir            | `references/workos-elixir.md`          |

### Features (Read `references/{name}.md`)

| User wants to...                | Read file                             |
| ------------------------------- | ------------------------------------- |
| Configure Single Sign-On        | `references/workos-sso.md`            |
| Set up Directory Sync           | `references/workos-directory-sync.md` |
| Implement RBAC / roles          | `references/workos-rbac.md`           |
| Encrypt data with Vault         | `references/workos-vault.md`          |
| Handle WorkOS Events / webhooks | `references/workos-events.md`         |
| Set up Audit Logs               | `references/workos-audit-logs.md`     |
| Enable Admin Portal             | `references/workos-admin-portal.md`   |
| Add Multi-Factor Auth           | `references/workos-mfa.md`            |
| Configure email delivery        | `references/workos-email.md`          |
| Set up Custom Domains           | `references/workos-custom-domains.md` |
| Set up IdP integration          | `references/workos-integrations.md`   |

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

### Management (Read `references/{name}.md`)

| User wants to...                         | Read file                          |
| ---------------------------------------- | ---------------------------------- |
| Manage WorkOS resources via CLI commands | `references/workos-management.md`  |

## Routing Decision Tree

Apply these rules in order. First match wins.

### 1. Migration Context

**Triggers**: User mentions migrating FROM another provider (Auth0, Clerk, Cognito, Firebase, Supabase, Stytch, Descope, Better Auth, standalone SSO API).

**Action**: Read `references/workos-migrate-[provider].md` where `[provider]` matches the source system. If provider is not in the table, read `references/workos-migrate-other-services.md`.

**Why this wins**: Migration context overrides feature-specific routing because users need provider-specific data export and transformation steps.

---

### 2. API Reference Request

**Triggers**: User explicitly asks about "API endpoints", "request format", "response schema", "API reference", or mentions inspecting HTTP details.

**Action**: For features with topic files (SSO, Directory Sync, RBAC, Vault, Events, Audit Logs, Admin Portal), read the feature topic file — it includes an endpoint table. For AuthKit or Organization APIs, read `references/workos-api-[domain].md`.

**Why this wins**: API references are low-level; feature topics are high-level but include endpoint tables for quick reference.

---

### 3. Feature-Specific Request

**Triggers**: User mentions a specific WorkOS feature by name (SSO, MFA, Directory Sync, Audit Logs, Vault, RBAC, Admin Portal, Custom Domains, Events, Integrations, Email).

**Action**: Read `references/workos-[feature].md` where `[feature]` is the lowercase slug (sso, mfa, directory-sync, audit-logs, vault, rbac, admin-portal, custom-domains, events, integrations, email).

**Exception**: Widget requests load the `workos-widgets` skill via the Skill tool — it has its own orchestration.

**Disambiguation**: If user mentions BOTH a feature and "API", route to the feature topic file (it includes endpoints). If they mention MULTIPLE features, route to the MOST SPECIFIC one first (e.g., "SSO with MFA" → route to SSO; user can request MFA separately).

---

### 4. AuthKit Installation

**Triggers**: User mentions authentication setup, login flow, sign-up, session management, or explicitly says "AuthKit" WITHOUT mentioning a specific feature like SSO or MFA.

**Action**: Detect framework and language using the priority-ordered checks below. Read the corresponding reference file.

**Disambiguation**:

- If user says "SSO login via AuthKit", route to `workos-sso` (#3) — feature wins over framework.
- If user says "React login with Google", route to AuthKit React (#4) — this is AuthKit-level auth, not SSO API.
- If user is ALREADY using AuthKit and wants to add a feature (e.g., "add MFA to my AuthKit app"), route to the feature reference (#3), not back to AuthKit installation.

#### Framework Detection Priority (AuthKit only)

Check in this exact order. First match wins:

```
1. `@tanstack/start` in package.json dependencies
   → Read: references/workos-authkit-tanstack-start.md

2. `@sveltejs/kit` in package.json dependencies
   → Read: references/workos-authkit-sveltekit.md

3. `react-router` or `react-router-dom` in package.json dependencies
   → Read: references/workos-authkit-react-router.md

4. `next.config.js` OR `next.config.mjs` OR `next.config.ts` exists in project root
   → Read: references/workos-authkit-nextjs.md

5. (`vite.config.js` OR `vite.config.ts` exists) AND `react` in package.json dependencies
   → Read: references/workos-authkit-react.md

6. NONE of the above detected
   → Read: references/workos-authkit-vanilla-js.md
```

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

**Why this order**: TanStack, SvelteKit, and React Router are MORE specific than Next.js/Vite+React. A project can have both Next.js AND React Router; in that case, React Router wins because it's more specific. Vanilla JS is the fallback when no framework is detected. Backend languages are checked when no frontend framework is found.

**Edge case — multiple frameworks detected**: If you detect conflicting signals (e.g., both `next.config.js` and `@tanstack/start`), ASK the user which one they want to use. Do NOT guess.

**Edge case — framework unclear from context**: If the user says "add login" but you cannot scan files (remote repo, no access), ASK: "Which framework/language are you using?" Do NOT default without confirmation.

---

### 5. Integration Setup

**Triggers**: User mentions connecting to external IdPs, configuring third-party integrations, or asks "how do I integrate with [provider]".

**Action**: Read `references/workos-integrations.md`.

**Why separate from SSO**: SSO covers the authentication flow; Integrations covers IdP configuration and connection setup. If user mentions BOTH ("set up Google SSO"), route to SSO (#3) — it will reference Integrations where needed.

---

### 6. Management / CLI Operations

**Triggers**: User mentions managing WorkOS resources (organizations, users, roles, permissions), seeding data, or CLI management commands.

**Action**: Read `references/workos-management.md`.

---

### 7. Vague or General Request

**Triggers**: User says "help with WorkOS", "WorkOS setup", "what can WorkOS do", or provides no feature-specific context.

**Action**:

1. WebFetch https://workos.com/docs/llms.txt
2. Scan the index for the section that best matches the user's likely intent
3. WebFetch the specific section URL
4. Summarize capabilities and ASK the user what they want to accomplish

**Do NOT guess a feature** — force disambiguation by showing options.

---

### 8. No Match / Ambiguous

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

Follow step #7 (Vague or General Request): fetch llms.txt, show options, and force disambiguation.
