---
name: workos
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:d9997c682b8e -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

### Feature Skill vs API Reference
- **DEFAULT**: Load feature skills (e.g., `workos-sso`) for implementation questions, setup, configuration, and "how do I..." queries.
- **API reference skills** (`workos-api-*`) are ONLY for:
  - Explicit requests for "API reference", "API docs", "endpoint documentation"
  - Questions about HTTP request/response formats, status codes, error codes
  - Questions about specific API endpoints (e.g., "/sso/authorize")
  - Integration with REST clients or raw HTTP libraries
- **Example**: "How do I set up SSO?" → `workos-sso` (feature). "What's the SSO authorize endpoint?" → `workos-api-sso` (API reference).

### AuthKit vs Feature
- **If user mentions**: "authentication", "login", "sign-up", "user management", "session handling" WITHOUT naming a specific feature → Route to AuthKit (detect framework below).
- **If user explicitly names a feature**: "SSO", "MFA", "Directory Sync", "RBAC", etc. → Route to that feature skill, even if it's auth-related.
- **Example**: "I need authentication" → AuthKit. "I need SSO" → `workos-sso`.

### Multiple Features
- Load the MOST SPECIFIC skill that matches the user's primary intent.
- If the user asks about multiple features in one request, choose based on:
  1. Most frequently mentioned feature
  2. Feature mentioned first
  3. Most complex feature (SSO > MFA > basic auth)
- The user can request additional skills after the first one loads.
- **Example**: "I need SSO and MFA" → Load `workos-sso` first (more complex). User can then ask for `workos-mfa`.

### Migration vs Feature Setup
- If the user mentions "migrate", "moving from", "switching from", or names a source auth provider (Auth0, Clerk, etc.) → Load migration skill for that provider.
- If they ask about a feature WITHOUT mentioning migration → Load the feature skill.
- **Example**: "Moving from Auth0" → `workos-migrate-auth0`. "How do I set up SSO?" → `workos-sso`.

## Topic → Skill Map

| User wants to...                              | Load skill                          | Doc reference |
| --------------------------------------------- | ----------------------------------- | ------------- |
| Install AuthKit in Next.js                    | workos-authkit-nextjs               | workos.com/docs/sdks/authkit-nextjs |
| Install AuthKit in React SPA                  | workos-authkit-react                | workos.com/docs/sdks/authkit-react |
| Install AuthKit with React Router             | workos-authkit-react-router         | workos.com/docs/sdks/authkit-react-router |
| Install AuthKit with TanStack Start           | workos-authkit-tanstack-start       | workos.com/docs/sdks/authkit-tanstack-start |
| Install AuthKit in vanilla JS                 | workos-authkit-vanilla-js           | workos.com/docs/sdks/authkit-js |
| AuthKit architecture reference                | workos-authkit-base                 | workos.com/docs/authkit |
| Configure email delivery                      | workos-email                        | workos.com/docs/email |
| Add WorkOS Widgets                            | workos-widgets                      | workos.com/docs/widgets/user-sessions |
| Encrypt data with Vault                       | workos-vault                        | workos.com/docs/vault/quick-start |
| Configure Single Sign-On                      | workos-sso                          | workos.com/docs/sso/test-sso |
| Implement RBAC / roles                        | workos-rbac                         | workos.com/docs/rbac/quick-start |
| Add Multi-Factor Auth                         | workos-mfa                          | workos.com/docs/mfa/index |
| Set up IdP integration                        | workos-integrations                 | workos.com/docs/integrations/xero-oauth |
| Handle WorkOS Events / webhooks               | workos-events                       | workos.com/docs/events/index |
| Set up Directory Sync                         | workos-directory-sync               | workos.com/docs/directory-sync/understanding-events |
| Set up Custom Domains                         | workos-custom-domains               | workos.com/docs/custom-domains/index |
| Set up Audit Logs                             | workos-audit-logs                   | workos.com/docs/audit-logs/metadata-schema |
| Enable Admin Portal                           | workos-admin-portal                 | workos.com/docs/admin-portal/index |
| Implement Admin Portal API Reference          | workos-api-admin-portal             | workos.com/docs/reference/admin-portal |
| Implement Audit Logs API Reference            | workos-api-audit-logs               | workos.com/docs/reference/audit-logs |
| Implement AuthKit API Reference               | workos-api-authkit                  | workos.com/docs/reference/authkit |
| Implement Directory Sync API Reference        | workos-api-directory-sync           | workos.com/docs/reference/directory-sync |
| Implement Events API Reference                | workos-api-events                   | workos.com/docs/reference/events |
| Implement Organizations API Reference         | workos-api-organization             | workos.com/docs/reference/organization |
| Implement Roles & Permissions API Reference   | workos-api-roles                    | workos.com/docs/reference/roles |
| Implement SSO API Reference                   | workos-api-sso                      | workos.com/docs/reference/sso |
| Implement Vault API Reference                 | workos-api-vault                    | workos.com/docs/reference/vault |
| Implement Widgets API Reference               | workos-api-widgets                  | workos.com/docs/reference/widgets |
| Migrate from Supabase Auth                   | workos-migrate-supabase-auth        | workos.com/docs/migrate/supabase |
| Migrate from Stytch                          | workos-migrate-stytch               | workos.com/docs/migrate/stytch |
| Migrate from the standalone SSO API          | workos-migrate-the-standalone-sso-api | workos.com/docs/migrate/standalone-sso |
| Migrate from other services                  | workos-migrate-other-services       | workos.com/docs/migrate/other-services |
| Migrate from Firebase                        | workos-migrate-firebase             | workos.com/docs/migrate/firebase |
| Migrate from Descope                         | workos-migrate-descope              | workos.com/docs/migrate/descope |
| Migrate from Clerk                           | workos-migrate-clerk                | workos.com/docs/migrate/clerk |
| Migrate from Better Auth                     | workos-migrate-better-auth          | workos.com/docs/migrate/better-auth |
| Migrate from AWS Cognito                     | workos-migrate-aws-cognito          | workos.com/docs/migrate/aws-cognito |
| Migrate from Auth0                           | workos-migrate-auth0                | workos.com/docs/migrate/auth0 |

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework using these checks IN ORDER (first match wins):

```
1. Check for @tanstack/start in package.json dependencies
   → MATCH: workos-authkit-tanstack-start

2. Check for react-router OR react-router-dom in package.json dependencies
   → MATCH: workos-authkit-react-router

3. Check for next.config.js OR next.config.mjs OR next.config.ts
   → MATCH: workos-authkit-nextjs

4. Check for vite.config.* AND react in package.json dependencies
   → MATCH: workos-authkit-react

5. No framework detected OR user has plain HTML/JS files
   → MATCH: workos-authkit-vanilla-js
```

**Priority rationale**: TanStack and React Router are checked BEFORE Next.js because some projects use both (e.g., Next.js + React Router for file-based routing). The more specific framework wins.

**Ambiguous cases**:
- If multiple frameworks are detected AND the user hasn't specified which they want to use, ASK: "I see you have [frameworks] in your project. Which one do you want to use for AuthKit?"
- If NO package.json exists, check for framework-specific config files (next.config.*, vite.config.*). If none exist, default to `workos-authkit-vanilla-js`.

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Does it mention "migrate", "moving from", or name a source provider?
  |     YES → Identify source → Load migration skill
  |     NO  → Continue
  |
  +-- Does it mention a specific feature by name (SSO, MFA, Directory Sync, RBAC, etc.)?
  |     YES → Load that feature skill
  |     NO  → Continue
  |
  +-- Does it ask for "API reference", "API docs", or mention specific endpoints/HTTP details?
  |     YES → Identify domain → Load workos-api-* skill
  |     NO  → Continue
  |
  +-- Does it mention "authentication", "login", "sign-up", "user sessions" (generic auth)?
  |     YES → Detect framework → Load AuthKit skill
  |     NO  → Continue
  |
  +-- Does it mention "integration", "connect to [third-party service]", or name an IdP?
  |     YES → Load workos-integrations
  |     NO  → Continue
  |
  +-- Does it mention "event", "webhook", "notification", "callback"?
  |     YES → Load workos-events
  |     NO  → Continue
  |
  +-- Still unclear?
        → WebFetch https://workos.com/docs/llms.txt
        → Scan for relevant section
        → WebFetch that section's URL
        → Answer from fetched content
```

## Edge Cases

### Vague Requests
- "I need WorkOS" / "Help me with WorkOS" → Ask: "What do you want to do with WorkOS? (e.g., add authentication, set up SSO, migrate from another provider)"
- "How do I get started?" → Ask: "Are you setting up a new project or migrating from an existing auth system?"

### Multiple Features in One Request
- "I need SSO and MFA and Directory Sync" → Load `workos-sso` first. After setup is complete, prompt: "SSO is configured. Would you like to add MFA next?"
- If the user insists on all at once, load skills sequentially: SSO → MFA → Directory Sync.

### Unknown Framework
- If the user says "I'm using [framework]" but it's not in the AuthKit framework list → Respond: "AuthKit supports Next.js, React (SPA/Vite), React Router, TanStack Start, and vanilla JavaScript. Your framework isn't directly supported, but you can use the vanilla JS SDK or build a custom integration. Load `workos-authkit-vanilla-js`?"

### Feature Combinations
- "SSO with custom domains" → Load `workos-sso` first. After SSO is configured, load `workos-custom-domains`.
- "RBAC with Admin Portal" → Load `workos-rbac` first. Admin Portal is a separate configuration step.

### If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt  
Then WebFetch the specific section URL for the user's topic.
