# Where the WorkOS MCP server is listed

Only the first row is fed by `server.json`. Every other row is its own submission with its own console.

| Directory | Listing | Fed by | How to update |
| --- | --- | --- | --- |
| MCP Registry (registry.modelcontextprotocol.io) | `com.workos/mcp` | `mcp/server.json` in this repo | Bump `version`, merge, then from `mcp/`: `mcp-publisher login dns --domain workos.com --private-key <hex>` and `mcp-publisher publish`. Versions are immutable. |
| GitHub MCP Registry (Copilot, VS Code) | github.com/mcp/com.workos/mcp | Auto-ingested from the MCP Registry. Renders `mcp/README.md`. | Republish `server.json`, then email partnerships@github.com if curated placement changes. |
| Claude connectors directory (Anthropic) | Claude Desktop and claude.ai connectors | Separate Anthropic submission | Anthropic partner console. |
| ChatGPT apps directory (OpenAI) | chatgpt.com/plugins/plugin_asdk_app_6a5d5d38c5648191a54b117a8263505b | OpenAI Apps SDK console | OpenAI Apps SDK console. |
| Cursor Marketplace | cursor.com/marketplace/workos | `plugins/workos/mcp.json` and `.cursor-plugin/` in this repo | Bump plugin version, resubmit at cursor.com/marketplace/publish. Manual review, no auto-sync. |
| PulseMCP, Glama, Zed, JetBrains, Kiro | Aggregators | Auto-ingested from the MCP Registry | Nothing. Republishing `server.json` updates them. |

Server URL for every listing: `https://mcp.workos.com/mcp`. Docs: https://workos.com/docs/mcp
