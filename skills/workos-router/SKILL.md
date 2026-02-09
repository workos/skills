---
name: workos-router
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:94ca3c2fe9ab -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

### Feature Skill vs API Reference
- **Default**: Load the feature skill (e.g., `workos-sso`, `workos-audit-logs`) unless the user explicitly asks about:
  - API endpoints, HTTP methods, or request/response formats
  - "API documentation" or "API reference"
  - SDK method signatures or parameters
- **Example**: "How do I set up SSO?" → `workos-sso` | "What's the SSO API endpoint?" → `workos-api-sso`

### AuthKit vs Feature-Specific Skills
- **AuthKit wins** if the user mentions:
  - Generic authentication/login/sign-up without naming a specific feature
  - "Install AuthKit" or "set up authentication"
  - Framework-specific auth setup (Next.js app, React SPA)
- **Feature skill wins** if the user explicitly names:
  - SSO, MFA, Magic Link, Directory Sync, or other specific WorkOS products
  - "Add SSO to my app" → `workos-sso`, not AuthKit
- **Edge case**: "AuthKit with SSO" → Load `workos-authkit-*` first (AuthKit is the integration layer), then offer `workos-sso` for SSO-specific configuration

### Multiple Features Mentioned
- Load the MOST SPECIFIC skill first based on this priority:
  1. Migration skills (if migrating from another service)
  2. Framework-specific AuthKit skills (if installing auth)
  3. Feature skills (SSO, MFA, Audit Logs, etc.)
  4. API reference skills (if explicitly requested)
- **Example**: "Migrate from Clerk and add SSO" → `workos-migrate-clerk` first, mention `workos-sso` after migration context is loaded

### Ambiguous Framework References
- If the user says "React app" without clarifying SPA vs SSR:
  - Ask: "Are you using Next.js, React Router, TanStack Start, or a plain React SPA?"
  - If they say "just React" or "Vite" → `workos-authkit-react`
- If they mention multiple frameworks (rare): prioritize the one with the most specific skill (TanStack Start > React Router > Next.js > React SPA)

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

If the user wants to install AuthKit, detect their framework using this priority-ordered checklist (first match wins):

```
1. @tanstack/start in package.json deps     → workos-authkit-tanstack-start
2. react-router OR react-router-dom in deps → workos-authkit-react-router
3. next.config.js OR next.config.mjs exists → workos-authkit-nextjs
4. vite.config.* exists AND react in deps   → workos-authkit-react
5. No framework detected OR plain HTML/JS   → workos-authkit-vanilla-js
```

**Detection priority rationale**: TanStack and React Router are specialized frameworks that also use React, so they must be checked BEFORE generic React/Vite detection to avoid false negatives.

**Edge cases**:
- **Monorepo with multiple frameworks**: Ask which package needs AuthKit
- **No package.json found**: Ask "What framework are you using?" and map their answer to the checklist above
- **Framework ambiguity** (e.g., "React with routing"): Ask "Are you using React Router, or something else?"

## General Decision Flow

```
User request about WorkOS?
  |
  ├─ MIGRATION REQUEST?
  │   └─ Identify source service → Load migration skill (e.g., workos-migrate-clerk)
  |
  ├─ AUTHKIT INSTALLATION?
  │   ├─ Framework explicit (e.g., "Next.js")? → Load framework-specific skill
  │   ├─ Framework unclear? → Detect via package.json → Load skill
  │   └─ Detection fails? → Ask user → Map to skill
  |
  ├─ SPECIFIC FEATURE MENTIONED (SSO, MFA, Audit Logs, etc.)?
  │   ├─ Wants setup/configuration? → Load feature skill (e.g., workos-sso)
  │   └─ Wants API reference? → Load API skill (e.g., workos-api-sso)
  |
  ├─ GENERIC AUTH/LOGIN REQUEST (no feature specified)?
  │   └─ Detect framework → Load AuthKit skill
  |
  ├─ API REFERENCE EXPLICITLY REQUESTED?
  │   └─ Identify domain (SSO, Audit Logs, etc.) → Load workos-api-* skill
  |
  ├─ INTEGRATION SETUP (IdP, third-party connectors)?
  │   └─ Load workos-integrations
  |
  ├─ MULTIPLE FEATURES MENTIONED?
  │   └─ Load most specific skill first (see "Multiple Features" rule above)
  |
  └─ VAGUE OR UNMATCHED REQUEST?
      ├─ WebFetch https://workos.com/docs/llms.txt
      ├─ Scan for matching section
      ├─ Found match? → WebFetch specific doc URL → Summarize
      └─ No match? → Ask user to clarify their goal
```

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt  
Then WebFetch the specific section URL for the user's topic.
