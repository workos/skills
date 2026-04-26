# WorkOS Management Commands

Use these commands to manage WorkOS resources directly from the terminal. The CLI must be authenticated via `workos auth login` or `WORKOS_API_KEY` env var.

All commands support `--json` for structured output. Use `--json` when you need to parse output (e.g., extract an ID).

## Checking what the CLI can do (READ THIS FIRST)

**If a user asks whether the CLI supports operation X, or if you're about to suggest a `workos ...` command, verify it first.** The authoritative, machine-readable command tree is:

```bash
workos --help --json
```

This emits a complete JSON tree of every registered command, subcommand, and flag. If a command or subcommand is not in that output, **it does not exist** — do not invent it, do not suggest it, do not assume "it must be there." Common agent failure mode: seeing that `workos <resource>` supports `list/get/delete` and assuming `create` / `update` also exist when they don't.

**Rule**: Before suggesting any `workos` command not listed in the Quick Reference table below, either (a) run `workos --help --json` and confirm the command exists, or (b) tell the user "this doesn't appear to be in the CLI — verify with `workos --help --json`." Never guess.

**The tables below are a snapshot and may lag the published CLI.** The live `--help --json` output is the source of truth.

## Detecting and recommending CLI upgrades

If `workos --help --json` is missing a command you expected, or the user reports `unknown command: <something>` for a command that exists in the latest release, **the user is likely on an outdated CLI** rather than encountering a bug. Before suggesting a workaround:

1. Ask the user to run `workos --version`.
2. Compare against the latest published version with `npm view workos version` (do NOT guess the latest version from memory — it moves frequently).
3. If the user is behind, send them to `references/workos-cli-upgrade.md` for the upgrade command for their package manager (npm/pnpm) and the no-install `npx workos@latest` fallback.

## Quick Reference

| Task                   | Command                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| List organizations     | `workos organization list`                                                   |
| Create organization    | `workos organization create "Acme Corp" acme.com:verified`                   |
| List users             | `workos user list --email=alice@acme.com`                                    |
| Create permission      | `workos permission create --slug=read-users --name="Read Users"`             |
| Create role            | `workos role create --slug=admin --name=Admin`                               |
| Assign perms to role   | `workos role set-permissions admin --permissions=read-users,write-users`     |
| Create org-scoped role | `workos role create --slug=admin --name=Admin --org=org_xxx`                 |
| Add user to org        | `workos membership create --org=org_xxx --user=user_xxx`                     |
| Send invitation        | `workos invitation send --email=alice@acme.com --org=org_xxx`                |
| Revoke session         | `workos session revoke <sessionId>`                                          |
| Add redirect URI       | `workos config redirect add http://localhost:3000/callback`                  |
| Add CORS origin        | `workos config cors add http://localhost:3000`                               |
| Set homepage URL       | `workos config homepage-url set http://localhost:3000`                       |
| Create webhook         | `workos webhook create --url=https://example.com/hook --events=user.created` |
| List SSO connections   | `workos connection list --org=org_xxx`                                       |
| List directories       | `workos directory list`                                                      |
| Toggle feature flag    | `workos feature-flag enable my-flag`                                         |
| Store a secret         | `workos vault create --name=api-secret --value=sk_xxx --org=org_xxx`         |
| Generate portal link   | `workos portal generate-link --intent=sso --org=org_xxx`                     |
| Seed environment       | `workos seed --file=workos-seed.yml`                                         |
| Debug SSO              | `workos debug-sso conn_xxx`                                                  |
| Debug directory sync   | `workos debug-sync directory_xxx`                                            |
| Set up an org          | `workos setup-org "Acme Corp" --domain=acme.com --roles=admin,viewer`        |
| Onboard a user         | `workos onboard-user alice@acme.com --org=org_xxx --role=admin`              |

## Workflows

### Setting up RBAC

When you see permission checks in the codebase (e.g., `hasPermission('read-users')`), create the matching WorkOS resources:

```bash
workos permission create --slug=read-users --name="Read Users"
workos permission create --slug=write-users --name="Write Users"
workos role create --slug=admin --name=Admin
workos role set-permissions admin --permissions=read-users,write-users
workos role create --slug=viewer --name=Viewer
workos role set-permissions viewer --permissions=read-users
```

For organization-scoped roles, add `--org=org_xxx` to role commands.

### Organization Onboarding

One-shot setup with the compound command:

```bash
workos setup-org "Acme Corp" --domain=acme.com --roles=admin,viewer
```

Or step by step:

```bash
ORG_ID=$(workos organization create "Acme Corp" --json | jq -r '.data.id')
workos org-domain create acme.com --org=$ORG_ID
workos role create --slug=admin --name=Admin --org=$ORG_ID
workos portal generate-link --intent=sso --org=$ORG_ID
```

### User Onboarding

```bash
workos onboard-user alice@acme.com --org=org_xxx --role=admin
```

Or step by step:

```bash
workos invitation send --email=alice@acme.com --org=org_xxx --role=admin
workos membership create --org=org_xxx --user=user_xxx --role=admin
```

### Local Development Setup

Configure WorkOS for local development:

```bash
workos config redirect add http://localhost:3000/callback
workos config cors add http://localhost:3000
workos config homepage-url set http://localhost:3000
```

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
workos webhook list
workos webhook create --url=https://example.com/hook --events=user.created,dsync.user.created
workos webhook delete we_xxx
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
workos organization list --json | jq '.data[0].id'

# Get a connection's state
workos connection get conn_xxx --json | jq '.state'

# List all role slugs
workos role list --json | jq '.data[].slug'

# Chain commands: create org then add domain
ORG_ID=$(workos organization create "Acme" --json | jq -r '.data.id')
workos org-domain create acme.com --org=$ORG_ID
```

JSON output format:

- **List commands**: `{ "data": [...], "listMetadata": { "before": null, "after": "cursor" } }`
- **Get commands**: Raw object (no wrapper)
- **Create/Update/Delete**: `{ "status": "ok", "message": "...", "data": {...} }`
- **Errors**: `{ "error": { "code": "...", "message": "..." } }` on stderr

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
| `workos connection`   | `list`, `get`, `delete`                                                                               |
| `workos directory`    | `list`, `get`, `delete`, `list-users`, `list-groups`                                                  |
| `workos event`        | `list` (requires `--events` flag)                                                                     |
| `workos audit-log`    | `create-event`, `export`, `list-actions`, `get-schema`, `create-schema`, `get-retention`              |
| `workos feature-flag` | `list`, `get`, `enable`, `disable`, `add-target`, `remove-target`                                     |
| `workos webhook`      | `list`, `create`, `delete`                                                                            |
| `workos config`       | `redirect add`, `cors add`, `homepage-url set`                                                        |
| `workos portal`       | `generate-link`                                                                                       |
| `workos vault`        | `list`, `get`, `get-by-name`, `create`, `update`, `delete`, `describe`, `list-versions`               |
| `workos api-key`      | `list`, `create`, `validate`, `delete`                                                                |
| `workos org-domain`   | `get`, `create`, `verify`, `delete`                                                                   |

### Workflow Commands

| Command                       | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `workos seed --file=<yaml>`   | Declarative resource provisioning from YAML |
| `workos seed --clean`         | Tear down seeded resources                  |
| `workos setup-org <name>`     | One-shot org onboarding                     |
| `workos onboard-user <email>` | Send invitation + optional wait             |
| `workos debug-sso <connId>`   | SSO connection diagnostics                  |
| `workos debug-sync <dirId>`   | Directory sync diagnostics                  |

### Common Flags

| Flag                                        | Purpose                  | Scope                                               |
| ------------------------------------------- | ------------------------ | --------------------------------------------------- |
| `--json`                                    | Structured JSON output   | All commands                                        |
| `--api-key`                                 | Override API key         | Resource commands                                   |
| `--org`                                     | Organization scope       | role, membership, invitation, api-key, feature-flag |
| `--force`                                   | Skip confirmation prompt | connection delete, directory delete                 |
| `--limit`, `--before`, `--after`, `--order` | Pagination               | All list commands                                   |

## Not in the CLI (use Dashboard, Admin Portal, API, or a different workflow)

These operations are commonly asked for but are **not** supported in the WorkOS CLI today. Do not invent commands for them. For each, the right answer is listed.

### Dashboard / Admin Portal only

| Operation                                                       | Where it lives                                                                          | Docs                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Create an SSO connection                                        | Admin Portal (generate via `workos portal generate-link --intent=sso --org=<org_id>`)   | https://workos.com/docs/sso/guide                                        |
| Create a Directory Sync connection                              | Admin Portal (generate via `workos portal generate-link --intent=dsync --org=<org_id>`) | https://workos.com/docs/directory-sync/quick-start                       |
| Map IdP (Entra/AD/Okta/Google Workspace) groups to WorkOS roles | Admin Portal during directory setup, or directory page in Dashboard                     | https://workos.com/docs/directory-sync/identity-provider-role-assignment |
| Map SSO groups to WorkOS roles                                  | Admin Portal during SSO setup, or connection page in Dashboard                          | https://workos.com/docs/rbac/idp-role-assignment                         |
| Enable/disable Admin Portal role-assignment step                | Authorization page in the WorkOS Dashboard                                              | https://workos.com/docs/directory-sync/identity-provider-role-assignment |
| Enable/disable authentication methods                           | Authentication settings in the WorkOS Dashboard                                         | https://workos.com/docs/authkit                                          |
| Configure session lifetime                                      | Authentication settings in the WorkOS Dashboard                                         | https://workos.com/docs/user-management/sessions                         |
| Set up social login providers (Google, GitHub, etc.)            | Authentication settings in the WorkOS Dashboard                                         | https://workos.com/docs/user-management/social-login                     |
| Create feature flags                                            | Feature Flags page in the WorkOS Dashboard (toggle/target ops work via CLI)             | https://workos.com/docs/feature-flags                                    |
| Configure branding (logos, colors)                              | Branding settings in the WorkOS Dashboard                                               | https://workos.com/docs/admin-portal/branding                            |
| Set up email templates                                          | Email settings in the WorkOS Dashboard                                                  | https://workos.com/docs/emails                                           |
| Manage billing / plan                                           | Settings in the WorkOS Dashboard                                                        | —                                                                        |

### API-only (not in CLI, but can be scripted via SDK / REST)

| Operation                              | Where it lives                              | Notes                                                                                                      |
| -------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Assign a role to an individual user    | `updateOrganizationMembership` via SDK/REST | Warning: IdP mapping silently overrides this on next sync/login when mapping exists. See `workos-rbac.md`. |
| Webhook signature verification         | SDK (`workos.webhooks.verifyEvent`)         | CLI can create/list/delete webhooks but does not verify events                                             |
| Session introspection / JWT validation | SDK                                         | CLI has `workos session list/revoke` only                                                                  |

**Rule of thumb**: if a user asks "is there a CLI command for X" and X is not in the Quick Reference table above and is not produced by `workos --help --json`, the answer is **no**. Do not speculate. Point the user at the right surface per this table.

### Do not invent click-paths in the Dashboard

The paths in the "Where it lives" column above are intentionally described in conceptual terms ("Authentication settings", "directory page") rather than as literal click-paths like "Dashboard > Organizations > X > Y". The docs don't commit to exact menu paths, and the Dashboard UI is re-organized periodically. Link the user to the docs URL and let them navigate. If you see yourself writing `Dashboard > A > B > C` or `dashboard.workos.com/some/path`, stop and link to docs instead.
