---
name: workos-router
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:d9997c682b8e -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

1. **Feature skill vs API reference**: 
   - Load feature skills (e.g., `workos-sso`) for setup, configuration, and "how to" questions
   - Load API reference skills (e.g., `workos-api-sso`) ONLY when user explicitly asks about:
     - API endpoints, request/response formats
     - HTTP methods, headers, or status codes
     - Direct API integration without SDK
     - References "API docs" or "API reference"

2. **AuthKit vs feature-specific skills**:
   - **AuthKit wins** if user mentions: authentication, login, sign-up, sign-in, session management, user management (without mentioning a specific feature)
   - **Feature skill wins** if user explicitly names: SSO, MFA, RBAC, Directory Sync, Audit Logs, etc.
   - **Feature skill wins** if user asks about enterprise features (SAML, SCIM, etc.)
   - **AuthKit wins** for "getting started" or "user authentication basics"

3. **Multiple features mentioned**:
   - Load the MOST SPECIFIC skill first
   - Priority order: Migration > API Reference > Feature Implementation > AuthKit
   - Example: "migrate from Auth0 with SSO" → Load `workos-migrate-auth0` (it covers SSO migration)
   - User can request additional skills after first task completes

4. **Ambiguous authentication requests**:
   - "Add authentication" → AuthKit (detect framework)
   - "Add SSO authentication" → `workos-sso`
   - "Add Google login" → `workos-authkit-*` (social login is part of AuthKit)
   - "Add SAML SSO" → `workos-sso`

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

## Framework Detection for AuthKit

When user wants AuthKit, detect framework using this priority order (first match wins):

**Priority 1 — Framework-specific routers:**
```
1. Check package.json for @tanstack/start        → workos-authkit-tanstack-start
2. Check package.json for react-router-dom       → workos-authkit-react-router
```

**Priority 2 — Full-stack frameworks:**
```
3. Check for next.config.js OR next.config.mjs   → workos-authkit-nextjs
   OR package.json contains "next"
```

**Priority 3 — SPA frameworks:**
```
4. Check for vite.config.* AND react in deps     → workos-authkit-react
   OR package.json contains "react" + "vite"
```

**Priority 4 — Fallback:**
```
5. No framework detected                         → workos-authkit-vanilla-js
```

**Ambiguous cases:**
- Project has both Next.js AND React Router → Load `workos-authkit-nextjs` (framework takes precedence over routing library)
- Project has both Vite AND TanStack Start → Load `workos-authkit-tanstack-start` (more specific framework wins)
- User mentions framework explicitly → Honor user's statement over file detection

**If detection fails:**
- Ask user: "Which framework are you using? Next.js, React (SPA), React Router, TanStack Start, or vanilla JavaScript?"

## Decision Tree

```
1. Is this a migration request?
   YES → Identify source platform → Load workos-migrate-* skill
   NO  → Continue to step 2

2. Does user explicitly mention API endpoints, HTTP methods, or "API reference"?
   YES → Load workos-api-* skill for the relevant domain
   NO  → Continue to step 3

3. Does user mention a SPECIFIC WorkOS feature by name?
   (SSO, SAML, SCIM, Directory Sync, RBAC, MFA, Audit Logs, Vault, Admin Portal, Widgets, Custom Domains, Events)
   YES → Load that feature's skill (e.g., workos-sso, workos-rbac)
   NO  → Continue to step 4

4. Does user mention authentication, login, sign-up, or session management WITHOUT naming a feature?
   YES → Detect framework → Load appropriate workos-authkit-* skill
   NO  → Continue to step 5

5. Does user mention integrations, IdP setup, or third-party connections?
   YES → Load workos-integrations
   NO  → Continue to step 6

6. Does user mention email, email delivery, or transactional email?
   YES → Load workos-email
   NO  → Continue to step 7

7. No clear match found
   → WebFetch https://workos.com/docs/llms.txt
   → Search index for user's keywords
   → WebFetch the most relevant section URL
   → Summarize findings and ask if user wants to load a specific skill
```

## Edge Cases

**Multiple features in one request:**
- "Add SSO and RBAC" → Load `workos-sso` first, inform user they can request `workos-rbac` next
- "Migrate from Auth0 with SSO and MFA" → Load `workos-migrate-auth0` (covers migration strategy for all features)

**Vague requests:**
- "Set up WorkOS" → Ask: "What would you like to set up? Authentication (AuthKit), SSO, RBAC, Directory Sync, or something else?"
- "Add security" → Ask: "Which security feature? SSO, MFA, RBAC, Audit Logs, or Vault?"

**Unknown framework:**
- If AuthKit needed but framework unclear → Ask user directly before guessing
- Do NOT default to vanilla JS without confirming

**Feature vs API conflict:**
- "How do I call the SSO API?" → `workos-api-sso` (explicitly asks about API)
- "How do I set up SSO?" → `workos-sso` (setup question, not API question)

## If No Skill Matches

1. WebFetch the full docs index: `https://workos.com/docs/llms.txt`
2. Search the index for keywords matching the user's request
3. WebFetch the most relevant section URL from the index
4. Summarize the information found
5. If a skill exists for this topic, offer to load it
6. If no skill exists, provide guidance based on fetched documentation
