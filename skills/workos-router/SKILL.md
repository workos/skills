---
name: workos-router
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, FGA, migrations, and all API references.
---

<!-- generated -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

**Rule Priority (highest to lowest):**

1. **Explicit API reference requests** — If the user says "API docs," "API reference," "endpoints," "request format," or "response schema," route to `workos-api-*` skills regardless of other keywords.

2. **Migration intent** — If the user says "migrate from," "switching from," or "coming from" another service, route to the appropriate `workos-migrate-*` skill immediately.

3. **Specific feature by name** — If the user mentions SSO, MFA, RBAC, Directory Sync, Audit Logs, etc. by name, route to that feature skill even if they also mention authentication.

4. **AuthKit installation** — If the user wants to "set up auth," "add login," "install AuthKit," or similar, detect framework and route to the appropriate AuthKit skill.

5. **AuthKit architecture** — If the user asks "how AuthKit works," "AuthKit concepts," or "AuthKit overview" without installation intent, route to `workos-authkit-base`.

**When multiple features are mentioned:**
- Route to the MOST SPECIFIC skill first (e.g., "SSO" beats "auth")
- The user can request additional skills afterward
- If equal specificity, choose the skill that appears first in their question

**When framework cannot be detected:**
- For AuthKit installation, default to `workos-authkit-vanilla-js` and explain it's the universal fallback
- Suggest the user specify their framework if they're using one

**When the request is vague:**
- Ask for clarification: "Are you trying to [install AuthKit / configure SSO / use the API / migrate]?"
- Do NOT guess — disambiguation must be explicit

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
| Set up Pipes connections                      | workos-pipes                        | workos.com/docs/pipes/providers |
| Add Multi-Factor Auth                         | workos-mfa                          | workos.com/docs/mfa/index |
| Implement Magic Link auth                     | workos-magic-link                   | workos.com/docs/magic-link/launch-checklist |
| Set up IdP integration                        | workos-integrations                 | workos.com/docs/integrations/xero-oauth |
| Configure Feature Flags                       | workos-feature-flags                | workos.com/docs/feature-flags/slack-notifications |
| Handle WorkOS Events / webhooks               | workos-events                       | workos.com/docs/events/index |
| Verify a domain                               | workos-domain-verification          | workos.com/docs/domain-verification/index |
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

When the user wants to install AuthKit, detect their framework using this priority-ordered check (first match wins):

```
1. Check for @tanstack/start in package.json dependencies
   → workos-authkit-tanstack-start

2. Check for react-router or react-router-dom in package.json dependencies
   → workos-authkit-react-router

3. Check for next.config.js, next.config.mjs, or next.config.ts
   → workos-authkit-nextjs

4. Check for vite.config.* AND react in package.json dependencies
   → workos-authkit-react

5. No framework detected OR user explicitly says "vanilla" or "no framework"
   → workos-authkit-vanilla-js
```

**Detection notes:**
- Check framework-specific dependencies BEFORE generic ones to avoid misrouting hybrid projects
- If multiple frameworks are detected (e.g., both Next.js and React Router), use the FIRST match in priority order
- If framework detection is ambiguous, ask: "I see [Framework A] and [Framework B]. Which one are you using for this project?"

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Says "API reference" / "API docs" / "endpoints"?
  |   → Load workos-api-* skill for that domain
  |
  +-- Says "migrate from" [service]?
  |   → Load workos-migrate-* skill for that service
  |
  +-- Mentions specific feature by name (SSO, MFA, RBAC, etc.)?
  |   → Load that feature skill (workos-sso, workos-mfa, etc.)
  |
  +-- Wants to install/set up AuthKit?
  |   → Detect framework → Load appropriate workos-authkit-* skill
  |
  +-- Asks about AuthKit architecture/concepts?
  |   → Load workos-authkit-base
  |
  +-- Wants integration setup?
  |   → Load workos-integrations
  |
  +-- Vague or unclear request?
  |   → Ask for clarification: "Are you trying to [install AuthKit / configure a feature / use the API / migrate]?"
  |
  +-- No skill matches?
  |   → WebFetch https://workos.com/docs/llms.txt
  |   → Find relevant section → WebFetch that section URL
```

## Edge Cases

**User mentions multiple features:**
- Route to the most specific skill mentioned
- Example: "Set up SSO with MFA" → Load `workos-sso` first (more specific than generic auth)

**User's framework is not supported:**
- If they ask for a framework not in the AuthKit skill list, respond: "AuthKit doesn't have a dedicated guide for [framework]. Use `workos-authkit-vanilla-js` as the base implementation, then adapt it to your framework."

**User asks a question spanning multiple domains:**
- Route to the PRIMARY domain
- Example: "How do I set up SSO and use the API?" → Load `workos-sso` (primary action), mention API reference is available separately

**User asks about WorkOS but not a specific feature:**
- Prompt: "What WorkOS feature are you working with? (e.g., AuthKit, SSO, Directory Sync, etc.)"

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.
