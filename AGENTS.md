# WorkOS Skills

A collection of 39 task-based skills that help AI agents implement WorkOS features. Skills encode procedural knowledge — decision trees, verification commands, error recovery — not documentation.

## How to Use

**Start with the router.** Load `skills/workos/SKILL.md` for any WorkOS task. It maps user intent to the right skill.

```
User Request
    │
    ├─ "Add authentication"        → skills/workos-authkit-{framework}/
    ├─ "Configure SSO"             → skills/workos-sso/
    ├─ "Set up Directory Sync"     → skills/workos-directory-sync/
    ├─ "Add RBAC / roles"          → skills/workos-rbac/
    ├─ "Encrypt data with Vault"   → skills/workos-vault/
    ├─ "Handle webhooks / events"  → skills/workos-events/
    ├─ "Set up Audit Logs"         → skills/workos-audit-logs/
    ├─ "Add MFA"                   → skills/workos-mfa/
    ├─ "Set up IdP integration"    → skills/workos-integrations/
    ├─ "Migrate from Auth0/etc"    → skills/workos-migrate-{provider}/
    ├─ "API reference for X"       → skills/workos-api-{domain}/
    └─ "Not sure"                  → WebFetch https://workos.com/docs/llms.txt
```

## Directory Structure

```
skills/
├── workos/                     # Master dispatcher — start here
├── workos-integrations/        # Provider lookup table (60+ IdPs)
│
├── workos-authkit-nextjs/      # AuthKit framework skills (hand-crafted)
├── workos-authkit-react/
├── workos-authkit-react-router/
├── workos-authkit-tanstack-start/
├── workos-authkit-vanilla-js/
├── workos-authkit-base/
│
├── workos-sso/                 # Feature skills (generated + refined)
├── workos-directory-sync/
├── workos-rbac/
├── workos-vault/
├── workos-events/
├── workos-audit-logs/
├── workos-admin-portal/
├── workos-mfa/
├── workos-custom-domains/
├── workos-email/
├── workos-widgets/
│
├── workos-migrate-auth0/       # Migration skills
├── workos-migrate-firebase/
├── workos-migrate-clerk/
├── workos-migrate-aws-cognito/
├── workos-migrate-stytch/
├── workos-migrate-supabase-auth/
├── workos-migrate-descope/
├── workos-migrate-better-auth/
├── workos-migrate-other-services/
├── workos-migrate-the-standalone-sso-api/
│
├── workos-api-sso/             # API reference skills
├── workos-api-authkit/
├── workos-api-directory-sync/
├── workos-api-audit-logs/
├── workos-api-organization/
├── workos-api-events/
├── workos-api-vault/
├── workos-api-roles/
├── workos-api-widgets/
└── workos-api-admin-portal/
```

## Skill Pattern

Every skill follows the same structure:

1. **YAML frontmatter** — `name` and `description` for agent matching
2. **Step 1: Fetch Documentation (BLOCKING)** — WebFetch doc URLs before proceeding
3. **Pre-flight validation** — check env vars, SDK installation, project structure
4. **Decision trees** — conditional flows for implementation choices
5. **Numbered implementation steps** — imperative, concrete actions
6. **Verification checklist** — runnable bash commands to confirm success
7. **Error recovery** — specific error messages mapped to root causes and fixes
8. **Related skills** — cross-references to other WorkOS skills

## Key Principle

Skills reference doc URLs for **runtime WebFetch** — they don't paste documentation content. The agent fetches the latest docs when executing the skill. If a skill conflicts with fetched docs, follow the docs.
