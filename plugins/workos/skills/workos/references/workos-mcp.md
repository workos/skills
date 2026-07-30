# WorkOS MCP Setup and Recovery

Canonical documentation:

- https://workos.com/docs/mcp
- https://workos.com/docs/dashboard/authentication

Fetch the canonical MCP documentation before recommending configuration or recovery steps. If this file conflicts with fetched docs, follow the docs.

## Use this reference when

- The user wants to connect the WorkOS MCP server.
- WorkOS MCP tools such as `whoami`, `list_operations`, `query`, or `mutate` are missing.
- An MCP client reports that the `workos` server is configured but unauthenticated, unavailable, or interrupted during startup.
- The user needs to choose between user-global and repository-only MCP configuration.

MCP server instructions and resources are available only after the client initializes the server. They cannot recover a server that failed before initialization, so use this skill, the client CLI, and the canonical docs for bootstrap.

## Protect configuration scope

Determine the requested scope before changing MCP configuration:

- **User-global** makes the server available across the user's projects.
- **Project-only** limits discovery to one trusted repository while Codex operates in that project.

If the user has not chosen a scope, ask before modifying user-global configuration. Do not define the same `workos` server at both scopes unless the user intends a project-level override. If an installed plugin already supplies the WorkOS MCP server, do not add a second manual definition unless the user explicitly wants both.

Project-level server definitions may be committed only when the team intends to share them. Never add OAuth tokens, cookies, authorization headers, or credential-store contents to a repository.

## Codex setup

### User-global

Use this only when the user wants WorkOS available in every Codex project:

```bash
codex mcp add workos --url https://mcp.workos.com/mcp
codex mcp get workos
codex mcp login workos
codex mcp list
```

`codex mcp add` writes the server definition to the user's Codex configuration.

### Project-only

Add this to `<repository-root>/.codex/config.toml`:

```toml
[mcp_servers.workos]
url = "https://mcp.workos.com/mcp"
```

Then run these commands from the repository root:

```bash
codex mcp get workos
codex mcp login workos
codex mcp list
```

Codex loads project `.codex/config.toml` only for trusted projects. Do not treat `codex mcp get workos` failing outside the repository, or while the repository is untrusted, as proof that the definition is invalid.

## Verification boundaries

- `codex mcp get workos` confirms that Codex discovered an effective server definition in the current project context.
- `codex mcp list` confirms the endpoint and advertised authentication type.
- Neither command proves that a stored OAuth credential is present or usable.
- `codex mcp login workos` starts the OAuth flow.
- Restart an already-running Codex session after OAuth completes so it can initialize the server.

Codex stores MCP OAuth credentials separately from `.codex/config.toml` according to the user's credential-store settings. Do not inspect, copy, print, or commit those credentials.

## Recover an interrupted Codex server

For `MCP startup interrupted. The following servers were not initialized: workos`:

1. Run `codex mcp get workos` from the project where the server should be active.
2. If it is not found, verify the intended scope, current repository, and project trust.
3. Run `codex mcp login workos` in the user's normal host shell and complete the browser consent flow.
4. Run `codex mcp list` to verify the endpoint and OAuth authentication type.
5. Restart Codex.
6. If OAuth succeeds but WorkOS access remains disabled, route the user to https://workos.com/docs/dashboard/authentication so a team admin can check the WorkOS MCP controls.

Browser, keyring, and certificate-sensitive authentication must run in the normal host shell. A failure seen only in a sandboxed agent shell is not authoritative. Do not repeatedly retry OAuth from the sandbox or conclude that the WorkOS server is down.

## WorkOS CLI boundary

`workos mcp install --agent codex` configures Codex at the CLI's default user scope. Use it only after the user has chosen user-global setup. For project-only setup, follow the canonical `.codex/config.toml` path instead.

The WorkOS CLI can confirm that a server definition is configured, but it cannot prove that Codex's OAuth credential is usable. Treat “configured” and “authenticated” as separate states.
