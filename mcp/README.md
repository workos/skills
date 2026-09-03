# WorkOS MCP Server

Manage your WorkOS workspace with AI agents. The WorkOS MCP server is a remote
[Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP client
can use it to manage organizations, users, SSO connections, directories,
branding, and more, by calling the WorkOS API on your behalf.

- **Server URL:** `https://mcp.workos.com/mcp`
- **Transport:** Streamable HTTP
- **Auth:** OAuth 2.1 with Dynamic Client Registration (WorkOS Connect). No API keys to paste.
- **Docs:** https://workos.com/docs/mcp

This folder holds the registry metadata (`server.json`) for the server. The
server runs as a hosted service at WorkOS. Its source is not published here.
The rest of this repository holds WorkOS skills for AI coding agents.

The server acts as **you**. It inherits your WorkOS dashboard role and can only
do what your account can do.

## Connect a client

The first time you connect, your client opens a WorkOS consent screen. Sign in
and approve access. After that the agent is connected as your account.

### WorkOS CLI (Claude Code, Codex, Cursor)

```bash
workos mcp install
```

The CLI detects installed clients. Use `--agent claude-code`, `--agent codex`,
or `--agent cursor` to target one. `workos mcp status` shows what is installed
and signed in.

### GitHub Copilot / VS Code

Add the server to `.vscode/mcp.json`:

```json
{
  "servers": {
    "workos": {
      "type": "http",
      "url": "https://mcp.workos.com/mcp"
    }
  }
}
```

Start the server from the `mcp.json` editor, or run **MCP: List Servers** from
the Command Palette.

### Claude Code

```bash
claude mcp add --transport http workos https://mcp.workos.com/mcp
```

Use `/mcp` inside Claude Code to check status or sign in again.

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "workos": { "url": "https://mcp.workos.com/mcp" }
  }
}
```

Open **Settings → MCP** and click **Login** next to WorkOS.

### Codex CLI

```bash
codex mcp add workos --url https://mcp.workos.com/mcp
codex mcp login workos
```

### Claude Desktop, ChatGPT

Open **Settings → Connectors**, click **Add custom connector**, name it
`WorkOS`, and enter `https://mcp.workos.com/mcp`.

### Other clients

Add a remote MCP server with the URL `https://mcp.workos.com/mcp`. Setup steps
for Antigravity, Factory, Goose, OpenCode, Windsurf, and Zed are in the
[docs](https://workos.com/docs/mcp#connect-a-client).

## Tools

| Tool | What it does |
| --- | --- |
| `whoami` | Returns your identity, role, and the environments you can reach. |
| `list_operations` | Lists the WorkOS operations available to the agent, with parameters. |
| `query` | Runs a read-only operation from the catalog, such as listing organizations or users. |
| `mutate` | Runs a write operation from the catalog, such as creating an organization or inviting a user. |
| `setup_account` | Provisions a WorkOS workspace for a first-time user. |

Operations cover organizations, users, SSO connections, Directory Sync, AuthKit
branding, webhooks, feature flags, and more.

## Example prompts

- "Set up a new organization for Acme Corp and invite everyone in `acme_employees.csv`."
- "Help me understand why `org_123` is having trouble signing in with SSO."
- "Invite `bob@example.com` to `org_123` as an admin."
- "List every organization with a draft SSO connection, and flag any directories that haven't synced in 24 hours."
- "Here's a screenshot of our marketing site. Make our AuthKit sign-in page match it."
- "Set up a Datadog audit log stream for our production environment."

## Permissions and safety

- **Role inheritance.** The agent runs every operation through the same access
  controls as the dashboard. A read-only role cannot make changes.
- **Environment scope.** The agent works in one environment at a time. It
  defaults to a sandbox environment and only touches production when you say so.
- **Destructive confirmation.** Irreversible operations, such as deleting an
  organization, connection, or directory, return a description of what will be
  destroyed and require an explicit confirmation step before they run.
- **Secrets.** API keys, client secrets, and similar values are stripped from
  responses before they reach the agent.
- **Admin controls.** Team admins can disable MCP access, block production
  access, or make MCP read-only for the whole team from the team authentication
  settings.

## Limitations

- No user impersonation.
- The most sensitive dashboard actions are not exposed: changing MCP access
  settings, minting or rotating credentials, and deleting your WorkOS team.
- One team at a time. The agent is scoped to the team you authenticate with.

## Support

- Docs: https://workos.com/docs/mcp
- Support: support@workos.com
- Status: https://status.workos.com

## Listings

`server.json` here is the source of truth for the `com.workos/mcp` entry in the
[MCP Registry](https://registry.modelcontextprotocol.io). Other directories are
tracked in [LISTINGS.md](./LISTINGS.md).
