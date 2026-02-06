---
name: workos-router
description: Route WorkOS requests to the right skill. Load this first for any WorkOS task.
---

<!-- generated -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

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

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework:

```
next.config.* → workos-authkit-nextjs
vite.config.* + react → workos-authkit-react
react-router in deps → workos-authkit-react-router
@tanstack/start in deps → workos-authkit-tanstack-start
No framework detected → workos-authkit-vanilla-js
```

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Mentions specific feature? → Load that feature skill
  |
  +-- Wants AuthKit/auth setup? → Detect framework → Load AuthKit skill
  |
  +-- Wants integration setup? → Load workos-integrations
  |
  +-- Wants to migrate? → Identify source → Load migration skill
  |
  +-- Not sure? → WebFetch llms.txt → Find matching section
```
