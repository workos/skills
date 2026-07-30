# WorkOS MCP Setup and Recovery

Canonical documentation:

- https://workos.com/docs/mcp
- https://workos.com/docs/dashboard/authentication

Fetch the canonical MCP documentation before recommending configuration or recovery steps. If this file conflicts with fetched docs, follow the docs.

## Use this reference when

- The user wants to connect the WorkOS MCP server.
- WorkOS MCP tools such as `whoami`, `list_operations`, `query`, or `mutate` are missing.
- An MCP client reports that the `workos` server is configured but unauthenticated, unavailable, or interrupted during startup.
- The user needs to choose a client or configuration scope.

MCP server instructions and resources are available only after the client initializes the server. They cannot recover a server that failed before initialization, so use this skill, the client CLI, and the canonical docs for bootstrap.

## Agent guardrails

1. Fetch the canonical MCP documentation and follow its current client-specific setup and recovery steps. Do not reproduce commands or configuration from memory.
2. Identify the user's MCP client and requested configuration scope before changing anything. Do not modify user-global configuration without explicit intent.
3. Check whether an installed plugin already supplies the WorkOS MCP server. Do not add a duplicate manual definition unless the user explicitly wants one.
4. Commit a project-level server definition only when the team intends to share it. Never inspect, print, copy, or commit OAuth tokens, cookies, authorization headers, or credential-store contents.
5. Complete browser, credential-store, and certificate-sensitive authentication in the user's normal host shell. A failure seen only in an isolated agent environment is not authoritative; do not repeatedly retry there or conclude that the WorkOS server is down.
6. Treat configured and authenticated as separate states. Use only the verification steps documented for the user's client; do not infer credential validity from the presence of a server definition.
7. If authentication succeeds but WorkOS access remains disabled, follow the team-control guidance in the canonical authentication documentation.

If no MCP server is configured and the user did not ask to set one up, continue with the supported CLI path instead of making MCP setup a prerequisite.
