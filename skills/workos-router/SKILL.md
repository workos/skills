---
name: workos-router
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, FGA, migrations, and all API references.
---

<!-- generated -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

### Feature Skills vs API References
- **Default**: Prefer feature skills (e.g., `workos-sso`) for implementation guidance.
- **API Reference**: Load `workos-api-*` skills ONLY when user explicitly:
  - Asks about "API endpoints", "API reference", or "API docs"
  - Requests specific HTTP methods, request/response formats, or payload schemas
  - Mentions rate limits, API versioning, or authentication headers

### AuthKit vs Feature-Specific Skills
- **AuthKit wins when**: User mentions "authentication", "login", "sign-up", "sign-in", "user management", or "session handling" WITHOUT naming another feature.
- **Feature skill wins when**: User explicitly names SSO, MFA, RBAC, Directory Sync, or another specific WorkOS feature.
- **Example**: "add SSO login" → `workos-sso` (explicit feature); "add login" → AuthKit (general auth).

### Multiple Features in One Request
1. Load the MOST SPECIFIC skill first (e.g., "SSO with MFA" → `workos-sso`).
2. After completing that skill, inform the user they can request the other feature separately.
3. If features are equally specific, prioritize in this order:
   - AuthKit → SSO → MFA → RBAC → Directory Sync → Other features

### Migration vs Implementation
- **Migration skill**: Load when user says "migrate from", "switching from", "moving from", or names a competitor service (Auth0, Clerk, etc.).
- **Implementation skill**: Load when user wants to "set up", "configure", "implement", or "add" a feature without mentioning migration.

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
| Set up Fine-Grained Authorization             | workos-fga                          | workos.com/docs/fga/index |
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

When the user wants to install AuthKit, detect their framework using this priority-ordered cascade (first match wins):

```
1. Check package.json for @tanstack/start        → workos-authkit-tanstack-start
2. Check package.json for react-router           → workos-authkit-react-router
3. Check for next.config.js or next.config.mjs   → workos-authkit-nextjs
4. Check for vite.config.* AND react in deps     → workos-authkit-react
5. No framework detected                          → workos-authkit-vanilla-js
```

**Framework Detection Notes**:
- Check framework-specific dependencies (TanStack, React Router) BEFORE generic frameworks (Next.js, Vite+React) to avoid misrouting projects with multiple frameworks.
- If package.json is unavailable, ask the user: "Which framework are you using? Next.js, React (Vite), React Router, TanStack Start, or vanilla JavaScript?"
- If the user's framework isn't listed (e.g., Remix, Astro), load `workos-authkit-base` and note that framework-specific guidance may be limited.

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Explicit feature name (SSO, MFA, RBAC, etc.)? → Load that feature skill
  |
  +-- Says "migrate from [service]"? → Load corresponding migration skill
  |
  +-- Asks for "API reference" or "API docs"? → Load workos-api-* skill for that domain
  |
  +-- Mentions authentication/login (no feature name)? → Detect framework → Load AuthKit skill
  |
  +-- Mentions integration with external service? → Load workos-integrations
  |
  +-- Mentions webhooks or events? → Load workos-events
  |
  +-- Mentions custom domains? → Load workos-custom-domains
  |
  +-- Mentions admin portal? → Load workos-admin-portal
  |
  +-- Request is vague or doesn't match patterns? → WebFetch https://workos.com/docs/llms.txt
       → Search llms.txt for matching section → WebFetch that section URL
```

## Edge Case Handling

### Ambiguous Requests
- **"Set up authentication for my app"**: Ask: "Are you looking for general authentication (AuthKit) or a specific feature like SSO or MFA?"
- **"Add login"**: Default to AuthKit unless context suggests SSO or another feature.
- **"WorkOS setup"**: Ask: "Which WorkOS feature would you like to set up? (e.g., AuthKit, SSO, RBAC, Directory Sync)"

### Multiple Features Mentioned
- **"SSO with MFA"**: Load `workos-sso` first. After completion, say: "SSO setup complete. Would you like help adding MFA next?"
- **"AuthKit and RBAC"**: Load AuthKit first (authentication is foundational). After completion, offer to load RBAC skill.

### Unknown Framework
- If framework detection fails and user doesn't clarify: Load `workos-authkit-base` for architecture overview, then ask user to specify their framework for detailed setup.

### No Matching Skill
1. WebFetch `https://workos.com/docs/llms.txt`
2. Search for relevant section heading
3. WebFetch the specific documentation URL
4. Provide guidance based on that documentation
5. If still unclear, suggest user consult WorkOS support or browse https://workos.com/docs

### API vs SDK Confusion
- If user asks "How do I call the WorkOS API?" without context: Ask: "Are you looking for API endpoint references, or do you want to install a WorkOS SDK (AuthKit, SSO, etc.)?"
- Clarify that feature skills include SDK installation, while `workos-api-*` skills cover raw HTTP API usage.
