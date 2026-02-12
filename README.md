# @workos/skills

WorkOS skills for AI coding agents. 39 skills covering AuthKit, SSO, Directory Sync, RBAC, Vault, Migrations, API references, and more.

## Install

```bash
npx skills add workos/skills
```

Works with Claude Code, Cursor, Codex, Goose, and any agent that supports the skills.sh format.

## Skills

### AuthKit

| Skill                           | Description                     |
| ------------------------------- | ------------------------------- |
| `workos-authkit-nextjs`         | Next.js App Router integration  |
| `workos-authkit-react`          | React SPA integration           |
| `workos-authkit-react-router`   | React Router v6/v7 integration  |
| `workos-authkit-tanstack-start` | TanStack Start integration      |
| `workos-authkit-vanilla-js`     | Vanilla JS integration          |
| `workos-authkit-base`           | Framework detection and routing |

### Features

| Skill                   | Description                   |
| ----------------------- | ----------------------------- |
| `workos-sso`            | Single Sign-On with SAML/OIDC |
| `workos-directory-sync` | User directory sync from IdPs |
| `workos-rbac`           | Role-based access control     |
| `workos-vault`          | Encrypted data storage        |
| `workos-events`         | Webhook event handling        |
| `workos-audit-logs`     | Compliance audit logging      |
| `workos-admin-portal`   | Self-service admin portal     |
| `workos-mfa`            | Multi-factor authentication   |
| `workos-custom-domains` | Custom domain configuration   |
| `workos-email`          | Email delivery configuration  |
| `workos-widgets`        | Embeddable UI components      |

### Routers

| Skill                 | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `workos`              | Identify which skill to load based on the user's task |
| `workos-integrations` | Provider lookup table for 60+ IdP integrations        |

### Migrations

| Skill                                   | Description                       |
| --------------------------------------- | --------------------------------- |
| `workos-migrate-auth0`                  | Migrate from Auth0                |
| `workos-migrate-firebase`               | Migrate from Firebase Auth        |
| `workos-migrate-clerk`                  | Migrate from Clerk                |
| `workos-migrate-aws-cognito`            | Migrate from AWS Cognito          |
| `workos-migrate-stytch`                 | Migrate from Stytch               |
| `workos-migrate-supabase-auth`          | Migrate from Supabase Auth        |
| `workos-migrate-descope`                | Migrate from Descope              |
| `workos-migrate-better-auth`            | Migrate from Better Auth          |
| `workos-migrate-other-services`         | Migrate from custom auth          |
| `workos-migrate-the-standalone-sso-api` | Upgrade standalone SSO to AuthKit |

### API References

| Skill                       | Description                           |
| --------------------------- | ------------------------------------- |
| `workos-api-sso`            | SSO API endpoints                     |
| `workos-api-authkit`        | AuthKit/User Management API endpoints |
| `workos-api-directory-sync` | Directory Sync API endpoints          |
| `workos-api-audit-logs`     | Audit Logs API endpoints              |
| `workos-api-organization`   | Organizations API endpoints           |
| `workos-api-events`         | Events/Webhooks API endpoints         |
| `workos-api-vault`          | Vault API endpoints                   |
| `workos-api-roles`          | Roles & Permissions API endpoints     |
| `workos-api-widgets`        | Widgets API endpoints                 |
| `workos-api-admin-portal`   | Admin Portal API endpoints            |

## Development

### Generate skills

```bash
# Generate (skips skills with matching source hash)
bun run generate

# Force regenerate all
bun run generate -- --force

# Generate + AI refinement (requires ANTHROPIC_API_KEY)
bun run generate -- --refine

# Batch refinement (parallel)
bun run scripts/refine-batch.ts --concurrency=6

# Refine specific skills
bun run scripts/refine-batch.ts workos-sso workos-mfa

# Rebuild plugin.json + marketplace.json from SKILL.md frontmatter
bun run scripts/build-plugin-manifests.ts
```

### Test

```bash
bun test
```

### How it works

1. **Fetch** — downloads `llms.txt` (URL index) and `llms-full.txt` (full docs) from workos.com
2. **Parse** — splits docs into sections by `## Name {#anchor}` boundaries
3. **Split** — applies per-section strategies (single, per-subsection, per-api-domain) to produce skill specs
4. **Generate** — transforms specs into SKILL.md scaffolds with frontmatter, doc fetch steps, and source hash
5. **Refine** (optional) — calls Anthropic API to transform doc prose into procedural agent instructions
6. **Quality gate** — automated rubric scoring + domain rules ensure quality thresholds
7. **Write** — skips files with matching source hash (content-addressed locking)

### Content-addressed locking

Each skill has a marker embedding a SHA-256 hash of its source doc content:

```
<!-- generated:sha256:abc123def456 -->   (scaffold)
<!-- refined:sha256:abc123def456 -->     (after refinement)
```

`generate` skips files where the hash matches — only skills whose upstream docs changed get regenerated. Use `--force` to bypass.

### Domain rules

Per-skill `.rules.yml` files encode factual constraints:

```yaml
# skills/workos-directory-sync/.rules.yml
rules:
  - id: dsync-webhooks-mandatory
    severity: error
    promoted: true
    must_contain:
      - pattern: "webhook"
    must_not_contain:
      - pattern: "poll(ing)? for.*(directory|sync).*event"
```

Rules are checked during the quality gate and injected into the refiner prompt so the LLM knows constraints upfront. Promoted rules with `severity: error` block skills from shipping.

### Hand-crafted vs generated

- **Hand-crafted** (6 AuthKit skills) — never overwritten by the generator
- **Generated** (33 skills) — produced by `scripts/generate.ts`, refined via Anthropic API
- **Excluded** (5 skills) — on disk but not shipped: FGA (deprecated), magic-link (deprecated), pipes, domain-verification, feature-flags (too thin)

## License

MIT
