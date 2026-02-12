---
name: workos
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:d608227a2b5f -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult the tables below to route to the right skill.

## Loading Skills

**AuthKit skills** are registered plugins — load them directly via the Skill tool.

**All other skills** are bundled files. To load one, Read `skills/{name}.md` from this plugin directory and follow its instructions.

## Disambiguation Rules

### Feature Skill vs API Reference

- **Default**: Route to feature skills (e.g., `workos-sso.md`) for implementation guidance.
- **Exception**: Route to API reference skills (e.g., `workos-api-sso.md`) ONLY when the user explicitly asks about:
  - API endpoints, HTTP methods, or request/response formats
  - References "API docs", "API reference", or "REST API"
  - Asks "what parameters does X endpoint take"

### AuthKit vs Specific Features

- **If user mentions**: "authentication", "login", "sign-up", "auth flow", "session management" WITHOUT naming a specific feature → Route to AuthKit (detect framework below).
- **If user mentions**: "SSO", "single sign-on", "SAML", "OIDC", "directory sync", "MFA", "roles", "RBAC" → Route to that feature skill directly, even if they also mention "auth".
- **Rationale**: Specific feature names indicate the user wants that capability, not generic authentication setup.

### Multiple Features Mentioned

- Route to the MOST SPECIFIC skill first.
- If the user says "I need SSO and directory sync", start with `workos-sso.md` (most explicitly requested).
- After completing the first skill, ask: "Would you like to set up directory sync now?"

### Migration Context

- **If user mentions**: "migrate from X", "coming from X", "replace X with WorkOS" → Route to migration skill for provider X.
- **If migration skill doesn't exist**: Route to `workos-migrate-other-services.md` for generic migration guidance.
- **Edge case**: If user says "migrate SSO from Auth0" → Start with `workos-migrate-auth0.md` (migration context takes priority over feature name).

## Topic → Skill Map

### AuthKit (load via Skill tool)

| User wants to...                              | Skill tool name                     |
| --------------------------------------------- | ----------------------------------- |
| Install AuthKit in Next.js                    | workos-authkit-nextjs               |
| Install AuthKit in React SPA                  | workos-authkit-react                |
| Install AuthKit with React Router             | workos-authkit-react-router         |
| Install AuthKit with TanStack Start           | workos-authkit-tanstack-start       |
| Install AuthKit in vanilla JS                 | workos-authkit-vanilla-js           |
| AuthKit architecture reference                | workos-authkit-base                 |

### Features (Read `skills/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Configure email delivery                      | `skills/workos-email.md` |
| Add WorkOS Widgets                            | `skills/workos-widgets.md` |
| Encrypt data with Vault                       | `skills/workos-vault.md` |
| Configure Single Sign-On                      | `skills/workos-sso.md` |
| Implement RBAC / roles                        | `skills/workos-rbac.md` |
| Add Multi-Factor Auth                         | `skills/workos-mfa.md` |
| Set up IdP integration                        | `skills/workos-integrations.md` |
| Handle WorkOS Events / webhooks               | `skills/workos-events.md` |
| Set up Directory Sync                         | `skills/workos-directory-sync.md` |
| Set up Custom Domains                         | `skills/workos-custom-domains.md` |
| Set up Audit Logs                             | `skills/workos-audit-logs.md` |
| Enable Admin Portal                           | `skills/workos-admin-portal.md` |

### API References (Read `skills/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Admin portal API Reference                    | `skills/workos-api-admin-portal.md` |
| Audit logs API Reference                      | `skills/workos-api-audit-logs.md` |
| Authkit API Reference                         | `skills/workos-api-authkit.md` |
| Directory sync API Reference                  | `skills/workos-api-directory-sync.md` |
| Events API Reference                          | `skills/workos-api-events.md` |
| Organization API Reference                    | `skills/workos-api-organization.md` |
| Roles API Reference                           | `skills/workos-api-roles.md` |
| Sso API Reference                             | `skills/workos-api-sso.md` |
| Vault API Reference                           | `skills/workos-api-vault.md` |
| Widgets API Reference                         | `skills/workos-api-widgets.md` |

### Migrations (Read `skills/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Migrate from Supabase Auth                   | `skills/workos-migrate-supabase-auth.md` |
| Migrate from Stytch                          | `skills/workos-migrate-stytch.md` |
| Migrate from the standalone SSO API          | `skills/workos-migrate-the-standalone-sso-api.md` |
| Migrate from other services                  | `skills/workos-migrate-other-services.md` |
| Migrate from Firebase                        | `skills/workos-migrate-firebase.md` |
| Migrate from Descope                         | `skills/workos-migrate-descope.md` |
| Migrate from Clerk                           | `skills/workos-migrate-clerk.md` |
| Migrate from Better Auth                     | `skills/workos-migrate-better-auth.md` |
| Migrate from AWS Cognito                     | `skills/workos-migrate-aws-cognito.md` |
| Migrate from Auth0                           | `skills/workos-migrate-auth0.md` |

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework. Check in this order (first match wins):

```
1. @tanstack/start in package.json      → Skill tool: workos-authkit-tanstack-start
2. react-router-dom in package.json     → Skill tool: workos-authkit-react-router
3. next.config.js OR next.config.mjs    → Skill tool: workos-authkit-nextjs
4. vite.config.* + react in deps        → Skill tool: workos-authkit-react
5. No framework detected                → Skill tool: workos-authkit-vanilla-js
```

**Priority rationale**: TanStack and React Router are specialized frameworks that ALSO use React — check them BEFORE generic React/Vite detection to avoid misrouting.

**Edge case — User has multiple frameworks**: If `package.json` contains both Next.js and React Router, ask the user: "I see both Next.js and React Router in your project. Which framework is this component for?" Then route based on their answer.

**Edge case — No package.json found**: Ask: "What framework are you using?" If they say "none" or "just HTML/JS", route to `workos-authkit-vanilla-js`.

## General Decision Flow

```
User request mentions WorkOS?
  |
  +-- Migration keyword ("migrate from", "coming from", "replace X")?
  |     YES → Read skills/workos-migrate-[provider].md
  |     |     (If provider not in list → workos-migrate-other-services.md)
  |     NO  ↓
  |
  +-- Specific feature keyword ("SSO", "MFA", "directory sync", "audit logs", etc.)?
  |     YES → Feature skill OR API skill?
  |     |       |
  |     |       +-- User says "API", "endpoint", "request/response"?
  |     |       |     YES → Read skills/workos-api-[feature].md
  |     |       |     NO  → Read skills/workos-[feature].md
  |     NO  ↓
  |
  +-- Generic auth keyword ("login", "authentication", "sign-up") AND no feature name?
  |     YES → Detect framework → Skill tool: workos-authkit-[framework]
  |     NO  ↓
  |
  +-- Integration setup keyword ("connect IdP", "third-party integration")?
  |     YES → Read skills/workos-integrations.md
  |     NO  ↓
  |
  +-- Webhook/event handling keyword ("webhook", "event subscription")?
  |     YES → Read skills/workos-events.md
  |     NO  ↓
  |
  +-- Vague or unclear request?
        → WebFetch https://workos.com/docs/llms.txt
        → Parse index, find section matching user intent
        → WebFetch section URL
        → Provide guidance based on fetched content
```

## Edge Case Handling

### Multiple Features in One Request

Example: "I need to add SSO and MFA"

1. Route to `workos-sso.md` first (SSO mentioned first).
2. After completing SSO setup, say: "SSO setup is complete. Would you like to configure MFA now?"
3. If yes, Read `skills/workos-mfa.md`.

### Unknown Framework for AuthKit

If the user wants AuthKit but framework detection fails:

1. Ask: "What framework are you using? (Next.js, React, React Router, TanStack Start, or vanilla JS)"
2. Route based on their answer.
3. If they say "I don't know", inspect `package.json` with them and explain what was found.

### User Asks "What Can WorkOS Do?"

Do NOT route to a specific skill. Instead:

1. WebFetch https://workos.com/docs/llms.txt
2. Summarize WorkOS capabilities (AuthKit, SSO, Directory Sync, MFA, RBAC, Audit Logs, etc.).
3. Ask: "Which of these features would you like to implement?"

### API Reference vs SDK Usage

- **If user asks**: "How do I call the SSO API?" → This is SDK usage, not API reference. Route to `workos-sso.md`.
- **If user asks**: "What's the endpoint for SSO profile lookup?" → This is API reference. Route to `workos-api-sso.md`.

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.
