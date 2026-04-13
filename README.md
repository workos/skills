# @workos/skills

WorkOS skills for AI coding agents. Two skills and 40 reference files covering AuthKit, SSO, Directory Sync, RBAC, Vault, Migrations, backend SDKs, and more.

## Install as Claude Code Plugin

```bash
npx skills add workos/skills
```

This installs two skills: `workos` and `workos-widgets`. The `workos` skill acts as a router that automatically loads the right reference for your task (AuthKit setup, SSO, migrations, etc.) so you don't need to install references individually.

Works with Claude Code, Codex, Goose, and any agent that supports the skills.sh format.

## Install as Cursor Plugin

Install from the [Cursor Marketplace](https://cursor.com/marketplace) (search "WorkOS"), or clone and symlink locally — see [Local Development](#local-cursor-development) below.

## Install as npm Package

For programmatic access to skill/reference content (e.g., from the WorkOS CLI):

```bash
npm install @workos/skills
```

```typescript
import { getReference, getSkill } from '@workos/skills';

// Read reference content directly
const content = await getReference('workos-authkit-nextjs');

// Read a skill's SKILL.md content
const router = await getSkill('workos');
```

Path helpers are also available for consumers that need file paths (e.g., skill discovery):

```typescript
import { getReferencePath, getSkillsDir, getSkillPath } from '@workos/skills';

const refPath = getReferencePath('workos-authkit-nextjs'); // absolute path to .md file
const skillsDir = getSkillsDir(); // directory containing workos/ and workos-widgets/
const skillPath = getSkillPath('workos'); // absolute path to SKILL.md
```

### Exports

| Function                  | Returns                                        |
| ------------------------- | ---------------------------------------------- |
| `getReference(name)`      | `Promise<string>` — reference file content     |
| `getSkill(skillName)`     | `Promise<string>` — skill SKILL.md content     |
| `getReferencePath(name)`  | Absolute path to `references/{name}.md`        |
| `getSkillsDir()`          | Absolute path to the `skills/` directory       |
| `getSkillPath(skillName)` | Absolute path to `skills/{skillName}/SKILL.md` |

## Skills

Two registered skills:

| Skill            | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `workos`         | Router — identifies which reference to load based on the user's task    |
| `workos-widgets` | Multi-framework widget integration with on-demand OpenAPI spec querying |

Everything else is a **reference file** under `references/`. The router dispatches to the right reference via progressive disclosure.

### References

> **Note:** References are not standalone skills. They are loaded automatically by the `workos` skill based on your task. You do not need to install them individually.

<details>
<summary>Full reference list (40+ files)</summary>

#### AuthKit Installation

| Reference                       | Description                    |
| ------------------------------- | ------------------------------ |
| `workos-authkit-nextjs`         | Next.js App Router integration |
| `workos-authkit-react`          | React SPA integration          |
| `workos-authkit-react-router`   | React Router v6/v7 integration |
| `workos-authkit-tanstack-start` | TanStack Start integration     |
| `workos-authkit-sveltekit`      | SvelteKit integration          |
| `workos-authkit-vanilla-js`     | Vanilla JS integration         |
| `workos-authkit-base`           | AuthKit architecture reference |

#### Backend SDK Installation

| Reference            | Description                        |
| -------------------- | ---------------------------------- |
| `workos-node`        | Node.js (Express/Fastify/Hono/Koa) |
| `workos-python`      | Python (Django/Flask/FastAPI)      |
| `workos-dotnet`      | .NET (ASP.NET Core)                |
| `workos-go`          | Go                                 |
| `workos-ruby`        | Ruby (Rails)                       |
| `workos-php`         | PHP                                |
| `workos-php-laravel` | PHP Laravel                        |
| `workos-kotlin`      | Kotlin                             |
| `workos-elixir`      | Elixir                             |

#### Features

| Reference               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `workos-sso`            | Single Sign-On with SAML/OIDC                  |
| `workos-directory-sync` | User directory sync from IdPs                  |
| `workos-rbac`           | Role-based access control                      |
| `workos-vault`          | Encrypted data storage                         |
| `workos-events`         | Webhook event handling                         |
| `workos-audit-logs`     | Compliance audit logging                       |
| `workos-admin-portal`   | Self-service admin portal                      |
| `workos-mfa`            | Multi-factor authentication                    |
| `workos-custom-domains` | Custom domain configuration                    |
| `workos-email`          | Email delivery configuration                   |
| `workos-integrations`   | Provider lookup table for 60+ IdP integrations |

#### Migrations

| Reference                               | Description                       |
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

#### API References

| Reference                 | Description                           |
| ------------------------- | ------------------------------------- |
| `workos-api-authkit`      | AuthKit/User Management API endpoints |
| `workos-api-organization` | Organizations API endpoints           |

#### Management

| Reference           | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `workos-management` | CLI resource management (orgs, users, roles, webhooks, seeding) |

</details>

## Development

```bash
pnpm test          # vitest
pnpm lint          # oxlint
pnpm format        # oxfmt
```

### Local Cursor development

Cursor loads local plugins from `~/.cursor/plugins/local/`. Symlink this repo's plugin directory, then reload Cursor:

```bash
ln -s "$(pwd)/plugins/workos" ~/.cursor/plugins/local/workos
```

Then in Cursor: **Cmd+Shift+P → Developer: Reload Window** (or fully quit and relaunch Cursor if the reload doesn't pick up new skills).

### Eval framework

Measures whether skills improve agent-generated code. Each case runs the same prompt with and without the skill, scores both outputs, and reports the delta.

```bash
pnpm eval -- --dry-run                        # verify cases load
pnpm eval -- --no-cache                       # full run (42 cases, ~$1.70)
pnpm eval -- --no-cache --case=sso-node-basic # single case
pnpm eval -- --no-cache --fail-on-regression  # with gates
```

### How it works

Each reference file follows the same pattern:

1. **Doc URLs** — source of truth links (agent fetches these first)
2. **Gotchas** — non-obvious traps the LLM gets wrong from training data
3. **Endpoints** (optional) — API endpoint table for quick reference

AuthKit and backend SDK references are richer — they include step-by-step installation instructions, decision trees, verification checklists, and error recovery.

The router (`workos/SKILL.md`) maps user intent to the right reference file.

## License

MIT
