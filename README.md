# @workos-inc/skills

WorkOS Skills for AI coding agents. 44 skills covering AuthKit, SSO, Directory Sync, RBAC, Vault, Migrations, API references, and more.

## Install

```bash
npx skills add workos/skills
```

Works with Claude Code, Cursor, Codex, Goose, and any agent that supports the skills.sh format.

## Skills

### AuthKit (hand-crafted)

| Skill | Description |
|-------|-------------|
| `workos-authkit-nextjs` | Next.js App Router integration |
| `workos-authkit-react` | React SPA integration |
| `workos-authkit-react-router` | React Router v6/v7 integration |
| `workos-authkit-tanstack-start` | TanStack Start integration |
| `workos-authkit-vanilla-js` | Vanilla JS integration |
| `workos-authkit-base` | Architecture reference |

### Features (generated)

| Skill | Description |
|-------|-------------|
| `workos-sso` | Single Sign-On with SAML/OIDC |
| `workos-directory-sync` | User directory sync from IdPs |
| `workos-rbac` | Role-based access control |
| `workos-fga` | Fine-grained authorization |
| `workos-vault` | Encrypted data storage |
| `workos-events` | Webhook event handling |
| `workos-audit-logs` | Compliance audit logging |
| `workos-admin-portal` | Self-service admin portal |
| `workos-mfa` | Multi-factor authentication |
| `workos-magic-link` | Passwordless email auth |
| `workos-feature-flags` | Feature flag management |
| `workos-domain-verification` | Domain ownership verification |
| `workos-custom-domains` | Custom domain configuration |
| `workos-email` | Email delivery configuration |
| `workos-pipes` | Third-party service connections |
| `workos-widgets` | Embeddable UI components |

### Routers

| Skill | Description |
|-------|-------------|
| `workos-router` | Master dispatcher — load this first for any WorkOS task |
| `workos-integrations` | Provider lookup table for 60+ IdP integrations |

### Migrations

| Skill | Description |
|-------|-------------|
| `workos-migrate-auth0` | Migrate from Auth0 |
| `workos-migrate-firebase` | Migrate from Firebase Auth |
| `workos-migrate-clerk` | Migrate from Clerk |
| `workos-migrate-aws-cognito` | Migrate from AWS Cognito |
| `workos-migrate-stytch` | Migrate from Stytch |
| `workos-migrate-supabase-auth` | Migrate from Supabase Auth |
| `workos-migrate-descope` | Migrate from Descope |
| `workos-migrate-better-auth` | Migrate from Better Auth |
| `workos-migrate-other-services` | Migrate from custom auth |
| `workos-migrate-the-standalone-sso-api` | Upgrade standalone SSO to AuthKit |

### API References

| Skill | Description |
|-------|-------------|
| `workos-api-sso` | SSO API endpoints |
| `workos-api-authkit` | AuthKit/User Management API endpoints |
| `workos-api-directory-sync` | Directory Sync API endpoints |
| `workos-api-audit-logs` | Audit Logs API endpoints |
| `workos-api-organization` | Organizations API endpoints |
| `workos-api-events` | Events/Webhooks API endpoints |
| `workos-api-vault` | Vault API endpoints |
| `workos-api-roles` | Roles & Permissions API endpoints |
| `workos-api-widgets` | Widgets API endpoints |
| `workos-api-admin-portal` | Admin Portal API endpoints |

## Development

### Generate skills

```bash
# Scaffold only (fast, deterministic)
bun run scripts/generate.ts

# Scaffold + AI refinement (requires ANTHROPIC_API_KEY)
bun run scripts/generate.ts --refine

# Parallel batch refinement
bun run scripts/refine-batch.ts --concurrency=6

# Refine specific skills
bun run scripts/refine-batch.ts workos-sso workos-mfa
```

### Test

```bash
bun test
```

### How it works

1. **Fetch** — downloads `llms.txt` (URL index) and `llms-full.txt` (full docs) from workos.com
2. **Parse** — splits docs into sections by `## Name {#anchor}` boundaries
3. **Split** — applies per-section strategies (single, per-subsection, per-api-domain) to produce skill specs
4. **Generate** — transforms specs into SKILL.md scaffolds with frontmatter, doc fetch steps, and templates
5. **Refine** (optional) — calls Anthropic API to transform doc prose into procedural agent instructions using the AuthKit skill as a gold-standard example
6. **Quality gate** — automated rubric scoring ensures all skills meet structural quality thresholds

Hand-crafted AuthKit skills are never overwritten. Generated skills include a `<!-- generated -->` marker.

## License

MIT
