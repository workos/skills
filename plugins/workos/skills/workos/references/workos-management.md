# WorkOS Management: MCP Server and CLI

Docs: https://workos.com/docs/authkit/cli-installer and https://workos.com/docs/authkit/sessions#sign-out-uris

If this file conflicts with fetched docs, follow the docs. For installed CLI commands and flags, verify live help as described below.

Two agent-friendly surfaces can manage WorkOS resources: the **WorkOS MCP server** and the **`workos` CLI**. They coexist — choose per task, not per session.

## Choosing a surface: MCP server vs CLI (READ THIS FIRST)

**If the session has WorkOS MCP tools connected** (a server exposing `whoami`, `list_operations`, `query`, and `mutate` — tool names may carry a client-specific prefix), **prefer the MCP for reading and changing workspace resources.** It runs as the signed-in dashboard user via OAuth — no CLI install, no API key — and covers ~350 operations, including several that are not in the CLI (see the surface tables at the bottom of this file). Discover operations with `list_operations`, run reads with `query` and writes with `mutate`. Permanent deletions and billing-affecting changes require an explicit confirmation step; role-forbidden operations return `Forbidden` at execution.

**Use the CLI when the task is one of its specialties:**

- **Bootstrapping from nothing.** `workos install` sets up AuthKit in a project and can provision working credentials without an existing WorkOS account; `workos env claim` links the environment to an account later. The MCP requires a browser OAuth login to an existing signed-in user before it can do anything.
- **Seeding and declarative setup**: `workos seed --file=workos-seed.yml` / `workos seed --clean`.
- **Application config** during integration work: redirect URIs, CORS, Sign-out URIs, homepage URL (`workos config ...` and `workos authkit ...`). These change saved WorkOS settings, not just local files.
- **CI and scripts** using API-key-backed commands such as `workos api`. Dashboard-session commands do not accept an API key as a substitute.
- **Diagnostics**: `workos doctor`, `workos debug-sso`, `workos debug-sync`.
- **No WorkOS MCP server is connected.** Read `workos-mcp.md` before changing client configuration. It covers client and scope selection, OAuth recovery, and host-shell trust boundaries. The CLI can configure the server in Claude Code, Codex, and Cursor with `workos mcp`.

Admin Portal setup links exist on both surfaces: `workos portal generate-link` on the CLI, `generatePortalSetupLink` on the MCP.

**Do not** walk a user through CLI install + `workos auth login` for a one-off management operation that connected MCP tools can already perform. Conversely, do not tell a user something is "Dashboard-only" without checking the MCP column in the tables at the bottom of this file.

## CLI usage

Use `WORKOS_MODE=agent` in coding-agent sessions and `--json` when parsing output. Authentication depends on the command:

- **Dashboard session:** `whoami`, `environment`, `authkit`, `branding`, `config`, and migrated resource commands such as `organization`, `user`, `role`, `permission`, `membership`, `invitation`, `session`, `event`, `feature-flag`, `webhook`, `portal`, and `org-domain` require `workos auth login`. `WORKOS_API_KEY` alone does not authenticate these commands. An `auth_required` error is not a reason to request another API key; follow its recovery hints in the user's trusted host shell. A `forbidden` error may indicate missing team access or an unavailable capability.
- **API key:** `workos api` and remaining REST-backed commands such as `connection`, `directory`, `audit-log`, and `vault` use API-key authentication. Verify the installed command's flags before recommending `--api-key`.

Before changing environment-scoped settings, run `workos environment list --json`, choose the intended project/environment, then run `workos whoami --environment-id "$ENVIRONMENT_ID" --json`. Confirm the team, environment, and client ID match the app. Pass that `--environment-id` explicitly on scoped reads and writes that support it. Never infer the dashboard command's target from `WORKOS_API_KEY` or change production to fix local setup. Stop on `environment_unresolved` or `environment_stale` and resolve the target rather than guessing.

Obtain approval for destructive or privilege-changing actions before passing `--yes` or `--force`. Role/permission writes and membership role updates require `--yes` in agent mode; inspect live help for other commands. A confirmation flag does not authorize an unrequested change.

## Verifying a CLI command exists

**If a user asks whether the CLI supports operation X, or if you're about to suggest a `workos ...` command, verify it first.** The authoritative, machine-readable command tree is:

```bash
WORKOS_MODE=agent workos --help --json
WORKOS_MODE=agent workos api ls --json
```

The first lists registered commands and flags. If a named command is absent, do not invent it. The second lists REST endpoints from the installed OpenAPI spec that can be called through `workos api`, even without a dedicated command. Inspect the endpoint's docs/schema for method, parameters, and request body before calling it. A GraphQL operation name is not a REST endpoint.

Before declaring an operation unsupported, check both outputs, then discover connected WorkOS MCP operations with `list_operations`. If you cannot run discovery, say what remains unverified instead of claiming the operation does not exist.

**The tables below are a snapshot and may lag the published CLI.** Live `--help --json` and `api ls --json` are the CLI sources of truth. Do not assume `create` or `update` exists because a resource has `list`, `get`, or `delete`.

## Detecting and recommending CLI upgrades

If `workos --help --json` is missing a command you expected, or the user reports `unknown command: <something>` for a command that exists in the latest release, **the user is likely on an outdated CLI** rather than encountering a bug. Before suggesting a workaround:

1. Ask the user to run `workos --version`.
2. Compare against the latest published version with `npm view workos version` (do NOT guess the latest version from memory — it moves frequently).
3. If the user is behind, send them to `references/workos-cli-upgrade.md` for the upgrade command for their package manager (npm/pnpm) and the no-install `npx workos@latest` fallback.

## Quick Reference

`ENVIRONMENT_ID` must contain the environment ID confirmed with `whoami` above. Keep it explicit in copied commands; `--yes` confirms an approved write but does not select its environment.

| Task                   | Command                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| List organizations     | `workos organization list --environment-id "$ENVIRONMENT_ID"`                                                     |
| Create organization    | `workos organization create "Acme Corp" acme.com:verified --environment-id "$ENVIRONMENT_ID"`                     |
| List users             | `workos user list --email=alice@acme.com --environment-id "$ENVIRONMENT_ID"`                                      |
| Create permission      | `workos permission create --slug=read-users --name="Read Users" --yes --environment-id "$ENVIRONMENT_ID"`         |
| Create role            | `workos role create --slug=admin --name=Admin --yes --environment-id "$ENVIRONMENT_ID"`                           |
| Assign perms to role   | `workos role set-permissions admin --permissions=read-users,write-users --yes --environment-id "$ENVIRONMENT_ID"` |
| Create org-scoped role | `workos role create --slug=admin --name=Admin --org=org_xxx --yes --environment-id "$ENVIRONMENT_ID"`             |
| Add user to org        | `workos membership create --org=org_xxx --user=user_xxx --environment-id "$ENVIRONMENT_ID"`                       |
| Send invitation        | `workos invitation send --email=alice@acme.com --org=org_xxx --environment-id "$ENVIRONMENT_ID"`                  |
| Revoke session         | `workos session revoke <sessionId> --environment-id "$ENVIRONMENT_ID"`                                            |
| Add redirect URI       | `workos config redirect add http://localhost:3000/callback --environment-id "$ENVIRONMENT_ID"`                    |
| Add CORS origin        | `workos config cors add http://localhost:3000 --environment-id "$ENVIRONMENT_ID"`                                 |
| Set homepage URL       | `workos config homepage-url set http://localhost:3000 --environment-id "$ENVIRONMENT_ID"`                         |
| Inspect sign-out URLs  | `workos authkit logout-uris list --environment-id "$ENVIRONMENT_ID" --json`                                       |
| Inspect callback URLs  | `workos authkit redirect-uris list --environment-id "$ENVIRONMENT_ID" --json`                                     |
| Upload branding logo   | `workos branding set --logo ./logo.png --environment-id "$ENVIRONMENT_ID"`                                        |
| Change membership role | `workos membership update <membershipId> --role=admin --yes --environment-id "$ENVIRONMENT_ID"`                   |
| Create webhook         | `workos webhook create --url=https://example.com/hook --events=user.created --environment-id "$ENVIRONMENT_ID"`   |
| List SSO connections   | `workos connection list --org=org_xxx`                                                                            |
| List directories       | `workos directory list`                                                                                           |
| Toggle feature flag    | `workos feature-flag enable my-flag --environment-id "$ENVIRONMENT_ID"`                                           |
| Store a secret         | `workos vault create --name=api-secret --value=sk_xxx --org=org_xxx`                                              |
| Generate portal link   | `workos portal generate-link --intent=sso --org=org_xxx --environment-id "$ENVIRONMENT_ID"`                       |
| Seed environment       | `workos seed --file=workos-seed.yml`                                                                              |
| Debug SSO              | `workos debug-sso conn_xxx`                                                                                       |
| Debug directory sync   | `workos debug-sync directory_xxx`                                                                                 |
| Set up an org          | `workos setup-org "Acme Corp" --domain=acme.com --roles=admin,viewer`                                             |
| Onboard a user         | `workos onboard-user alice@acme.com --org=org_xxx --role=admin`                                                   |

## Workflows

### Setting up RBAC

When setting up RBAC, propose resources matching the permission checks in the codebase, such as `hasPermission('read-users')`. After the user approves the permissions and target environment:

```bash
workos permission create --slug=read-users --name="Read Users" --yes --environment-id "$ENVIRONMENT_ID"
workos permission create --slug=write-users --name="Write Users" --yes --environment-id "$ENVIRONMENT_ID"
workos role create --slug=admin --name=Admin --yes --environment-id "$ENVIRONMENT_ID"
workos role set-permissions admin --permissions=read-users,write-users --yes --environment-id "$ENVIRONMENT_ID"
workos role create --slug=viewer --name=Viewer --yes --environment-id "$ENVIRONMENT_ID"
workos role set-permissions viewer --permissions=read-users --yes --environment-id "$ENVIRONMENT_ID"
```

For organization-scoped roles, add `--org=org_xxx` to role commands.

### Organization Onboarding

One-shot setup with the compound command:

```bash
workos setup-org "Acme Corp" --domain=acme.com --roles=admin,viewer
```

Or step by step:

```bash
ORG_ID=$(workos organization create "Acme Corp" --environment-id "$ENVIRONMENT_ID" --json | jq -er '.organization.id')
workos org-domain create acme.com --org=$ORG_ID --environment-id "$ENVIRONMENT_ID"
workos role create --slug=admin --name=Admin --org=$ORG_ID --yes --environment-id "$ENVIRONMENT_ID"
workos portal generate-link --intent=sso --org=$ORG_ID --environment-id "$ENVIRONMENT_ID"
```

### User Onboarding

```bash
workos onboard-user alice@acme.com --org=org_xxx --role=admin
```

Or step by step:

```bash
workos invitation send --email=alice@acme.com --org=org_xxx --role=admin --environment-id "$ENVIRONMENT_ID"
workos membership create --org=org_xxx --user=user_xxx --role=admin --environment-id "$ENVIRONMENT_ID"
```

### Local Development Setup

Read [workos-authkit-setup.md](workos-authkit-setup.md) for the required callback, Sign-out URI, and Initiate login URI workflow. Use actual app URLs and the confirmed development environment. For a single addition:

```bash
workos config redirect add "$CALLBACK_URL" --environment-id "$ENVIRONMENT_ID"
# Only when the SDK needs browser API access:
workos config cors add "$APP_ORIGIN" --environment-id "$ENVIRONMENT_ID"
```

The `config ... add` commands merge existing values, but concurrent edits can still be overwritten. The `authkit ... set` commands replace entire lists: read all existing entries and defaults, preserve them, validate with `--dry-run`, apply, then read back. Do not overwrite a potentially truncated list.

Configuring a homepage URL is optional and is not a substitute for an Initiate login URI. For that setting, check live CLI/API discovery, then connected MCP operations, then the dashboard. Report any unverified setup step rather than calling the integration complete.

### Environment Seeding

Create a `workos-seed.yml` file in your repo:

```yaml
permissions:
  - name: 'Read Users'
    slug: 'read-users'
  - name: 'Write Users'
    slug: 'write-users'

roles:
  - name: 'Admin'
    slug: 'admin'
    permissions: ['read-users', 'write-users']
  - name: 'Viewer'
    slug: 'viewer'
    permissions: ['read-users']

organizations:
  - name: 'Test Org'
    domains: ['test.com']

config:
  redirect_uris: ['http://localhost:3000/callback']
  cors_origins: ['http://localhost:3000']
  homepage_url: 'http://localhost:3000'
```

Then run:

```bash
workos seed --file=workos-seed.yml   # Create resources
workos seed --clean                  # Tear down seeded resources
```

### Debugging SSO

```bash
workos debug-sso conn_xxx
```

Shows: connection type/state, organization binding, recent auth events, and common issues (inactive connection, org mismatch).

### Debugging Directory Sync

```bash
workos debug-sync directory_xxx
```

Shows: directory type/state, user/group counts, recent sync events, and stall detection.

### Webhook Management

```bash
workos webhook list --environment-id "$ENVIRONMENT_ID"
workos webhook create --url=https://example.com/hook --events=user.created,dsync.user.created --environment-id "$ENVIRONMENT_ID"
workos webhook delete we_xxx --environment-id "$ENVIRONMENT_ID"
```

### Audit Logs

```bash
workos audit-log create-event --org=org_xxx --action=user.login --actor-type=user --actor-id=user_xxx
workos audit-log list-actions
workos audit-log get-schema user.login
workos audit-log export --org=org_xxx --range-start=2024-01-01 --range-end=2024-02-01
workos audit-log get-retention --org=org_xxx
```

## Using --json for Structured Output

All commands support `--json` for machine-readable output. Use this when you need to extract values:

```bash
# Get an organization ID
workos organization list --environment-id "$ENVIRONMENT_ID" --json | jq '.organizations[].id'

# Get a connection's state
workos connection get conn_xxx --json | jq '.state'

# List all role slugs
workos role list --environment-id "$ENVIRONMENT_ID" --json | jq '.roles[].slug'

# Chain commands: create org then add domain
ORG_ID=$(workos organization create "Acme" --environment-id "$ENVIRONMENT_ID" --json | jq -er '.organization.id')
workos org-domain create acme.com --org=$ORG_ID --environment-id "$ENVIRONMENT_ID"
```

JSON shapes differ by command and version. Inspect the actual output before writing a `jq` expression; there is no universal `.data` wrapper.

- Dashboard-backed organization lists return `{ "organizations": [...], "pagination": {...} }`; get/create/update return `{ "organization": {...} }`.
- Role lists return `{ "roles": [...] }`. AuthKit URI lists return `{ "redirectUris": [...] }` or `{ "logoutUris": [...] }`; CORS reads return `{ "origins": [...] }`.
- Remaining REST-backed commands may return `{ "data": [...], "listMetadata": {...} }` for lists and raw objects for gets.
- Errors use `{ "error": { "code": "...", "message": "..." } }` on stderr. Check exit status before using an extracted ID.

## Command Reference

### Resource Commands

| Command               | Subcommands                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `workos organization` | `list`, `get`, `create`, `update`, `delete`                                                           |
| `workos user`         | `list`, `get`, `update`, `delete`                                                                     |
| `workos role`         | `list`, `get`, `create`, `update`, `delete`, `set-permissions`, `add-permission`, `remove-permission` |
| `workos permission`   | `list`, `get`, `create`, `update`, `delete`                                                           |
| `workos membership`   | `list`, `get`, `create`, `update`, `delete`, `deactivate`, `reactivate`                               |
| `workos invitation`   | `list`, `get`, `send`, `revoke`, `resend`                                                             |
| `workos session`      | `list`, `revoke`                                                                                      |
| `workos connection`   | `list`, `get`, `create`, `update`, `delete`                                                           |
| `workos directory`    | `list`, `get`, `delete`, `list-users`, `list-groups`                                                  |
| `workos event`        | `list` (`--events` is optional)                                                                       |
| `workos audit-log`    | `create-event`, `export`, `list-actions`, `get-schema`, `create-schema`, `get-retention`              |
| `workos feature-flag` | `list`, `get`, `enable`, `disable`, `add-target`, `remove-target`                                     |
| `workos webhook`      | `list`, `create`, `delete`                                                                            |
| `workos config`       | `redirect add`, `cors add`, `homepage-url set`                                                        |
| `workos authkit`      | `redirect-uris list/set`, `logout-uris list/set`, `cors get/set`                                      |
| `workos branding`     | `get`, `set`                                                                                          |
| `workos environment`  | `list`, `use`, `create`, `rename`                                                                     |
| `workos portal`       | `generate-link`                                                                                       |
| `workos vault`        | `list`, `get`, `get-by-name`, `create`, `update`, `delete`, `describe`, `list-versions`               |
| `workos api-key`      | `list`, `create`, `validate`, `delete`                                                                |
| `workos org-domain`   | `get`, `create`, `verify`, `delete`                                                                   |

### Workflow Commands

| Command                       | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `workos seed --file=<yaml>`   | Declarative resource provisioning from YAML                                                    |
| `workos seed --clean`         | Tear down seeded resources                                                                     |
| `workos setup-org <name>`     | One-shot org onboarding                                                                        |
| `workos onboard-user <email>` | Send invitation + optional wait                                                                |
| `workos debug-sso <connId>`   | SSO connection diagnostics                                                                     |
| `workos debug-sync <dirId>`   | Directory sync diagnostics                                                                     |
| `workos install`              | Install AuthKit into a project (bootstrap; can provision credentials with no existing account) |
| `workos env claim`            | Link an unclaimed environment to your account                                                  |
| `workos mcp`                  | Install/manage the WorkOS MCP server in Claude Code, Codex, and Cursor                         |

### Common Flags

| Flag                                        | Purpose                   | Scope                                                    |
| ------------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `--json`                                    | Structured JSON output    | All commands                                             |
| `--api-key`                                 | Override API key          | REST-backed commands that advertise it in help           |
| `--environment-id`                          | Target an environment     | Dashboard-backed commands that advertise it in help      |
| `--yes`                                     | Confirm an approved write | Required by some destructive/privilege-changing commands |
| `--org`                                     | Organization scope        | Only commands advertising it in help                     |
| `--force`                                   | Skip confirmation prompt  | connection delete, directory delete                      |
| `--limit`, `--before`, `--after`, `--order` | Pagination                | Only commands advertising those flags in help            |

## Not in the CLI (check the MCP server first, then Dashboard, Admin Portal, or API)

These operations have no named CLI command in this snapshot. Check live command help and `workos api ls --json` before concluding that the CLI cannot perform them. Do not invent commands or endpoints. For each, an alternative is listed. **The "MCP operation" column is the connected-MCP alternative** — when WorkOS MCP tools are present, prefer that over sending the user to the Dashboard. Verify the exact operation name and parameters with `list_operations` before calling it.

### Not in the CLI — where each operation lives

| Operation                                                       | MCP operation (if connected)                                                                                                      | Otherwise                                                                                                                  | Docs                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Create a Directory Sync connection                              | setup link via `generatePortalSetupLink` (intent `Dsync`); direct `createDirectory` exists but is feature-flag-gated              | Admin Portal (generate via `workos portal generate-link --intent=dsync --org=<org_id> --environment-id "$ENVIRONMENT_ID"`) | https://workos.com/docs/directory-sync/quick-start                          |
| Map IdP (Entra/AD/Okta/Google Workspace) groups to WorkOS roles | `upsertAndDeleteGroupRoleMappings` (mutate; read via `directoryGroupsWithRoleMappings`)                                           | Admin Portal during directory setup, or directory page in Dashboard                                                        | https://workos.com/docs/directory-sync/identity-provider-role-assignment    |
| Map SSO groups to WorkOS roles                                  | `createConnectionGroupWithRoleMapping` (mutate)                                                                                   | Admin Portal during SSO setup, or connection page in Dashboard                                                             | https://workos.com/docs/rbac/idp-role-assignment                            |
| Enable/disable Admin Portal role-assignment step                | —                                                                                                                                 | Authorization page in the WorkOS Dashboard                                                                                 | https://workos.com/docs/directory-sync/identity-provider-role-assignment    |
| Enable/disable authentication methods                           | `updateAuthkitSettings` (mutate)                                                                                                  | Authentication settings in the WorkOS Dashboard                                                                            | https://workos.com/docs/authkit                                             |
| Configure session lifetime                                      | `updateAuthkitSettings` (mutate)                                                                                                  | Authentication settings in the WorkOS Dashboard                                                                            | https://workos.com/docs/user-management/sessions                            |
| Set up social login providers (Google, GitHub, etc.)            | `updateOauthCredentials` (mutate — updates a provider's client credentials and toggles it for AuthKit; not full first-time setup) | Authentication settings in the WorkOS Dashboard                                                                            | https://workos.com/docs/user-management/social-login                        |
| Create feature flags                                            | `createFlag` (mutate; per-env state via `updateFlagEnvironment`)                                                                  | Feature Flags page in the WorkOS Dashboard (toggle/target ops work via CLI)                                                | https://workos.com/docs/feature-flags                                       |
| Configure branding colors                                       | `updateAppBranding` (mutate)                                                                                                      | Branding settings in the WorkOS Dashboard; image uploads use `workos branding set`                                         | https://workos.com/docs/admin-portal/branding                               |
| Configure Initiate login URI                                    | `UpdateInitiateLoginUrl` (mutate), `initiateLoginUrl` (query); discover exact names and arguments first                           | Application Redirects settings in the dashboard; see `workos-authkit-setup.md`                                             | https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri |
| Set up email templates                                          | — (read-only: `authkitEmailSettings`)                                                                                             | Email settings in the WorkOS Dashboard                                                                                     | https://workos.com/docs/emails                                              |
| Manage billing / plan                                           | reads (`workspaceBilling`, invoices) + confirmation-gated address/tax-ID writes; plan changes stay in the Dashboard               | Settings in the WorkOS Dashboard                                                                                           | —                                                                           |

### SDK operations

| Operation                              | MCP operation (if connected) | Otherwise                           | Notes                                                          |
| -------------------------------------- | ---------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Webhook signature verification         | —                            | SDK (`workos.webhooks.verifyEvent`) | CLI can create/list/delete webhooks but does not verify events |
| Session introspection / JWT validation | —                            | SDK                                 | CLI has `workos session list/revoke` only                      |

**Available CLI alternatives:** `workos connection create` and `workos connection update` support SSO connection management; inspect their flags and the connection-type schema before use. Admin Portal setup links remain useful when the customer should configure their own IdP. For an individual user's organization role, use `workos membership update <membershipId> --role=<slug> --yes --environment-id "$ENVIRONMENT_ID"` with the confirmed environment and approval. IdP group mappings can override that role at the next sync/login; see `workos-rbac.md`.

**Rule of thumb:** discover named commands with `workos --help --json`, REST endpoints with `workos api ls --json`, and connected MCP operations with `list_operations`. Check all available options before sending the user to the dashboard.

### Do not invent click-paths in the Dashboard

The paths in the "Otherwise" column above are intentionally described in conceptual terms ("Authentication settings", "directory page") rather than as literal click-paths like "Dashboard > Organizations > X > Y". The docs don't commit to exact menu paths, and the Dashboard UI is re-organized periodically. Link the user to the docs URL and let them navigate. If you see yourself writing `Dashboard > A > B > C` or `dashboard.workos.com/some/path`, stop and link to docs instead.
