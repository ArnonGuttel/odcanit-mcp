# Odcanit MCP

[Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management system. Lets Claude and other AI tools read case and client data from Odcanit's SQL Server database via its read-only export views (`vwExportToOuterSystems_*`) — the only integration surface Odcanit exposes, since it has no REST API.

Runs locally as a stdio subprocess launched by Claude itself. No data or credentials leave your machine/network.

## Status

MVP, read-only, two tools:

| Tool | Looks up | Source view |
| --- | --- | --- |
| `get_case_details` | a case, by case number | `vwExportToOuterSystems_Files` |
| `get_client_details` | a client, by visual ID | `vwExportToOuterSystems_Clients` |

## Requirements

- Network access to your firm's Odcanit SQL Server
- A SQL Server login with read access to the `vwExportToOuterSystems_*` views
- Node.js 18+ — only needed to build from source; the Windows install below uses a prebuilt binary

This is a one-time setup for whoever administers Odcanit / SQL Server access at your firm (e.g. IT), not something each Claude user does individually.

## Install

### Windows (no Node.js required)

1. Download the latest release zip from [Releases](https://github.com/ArnonGuttel/odcanit-mcp/releases) and extract it.
2. Double-click `Setup.bat`. It prompts for your SQL Server details, tests the connection, and registers the server in Claude Desktop's config.
3. Restart Claude Desktop.

To reconfigure against a different database, run `Uninstall.bat` first — it only removes the `odcanit` entry from Claude Desktop's config.

> **Note:** `odcanit-mcp.exe` and the setup script are unsigned, so Windows SmartScreen will flag them on first run — click "More info" → "Run anyway". The SQL Server password you enter is stored in plaintext in Claude Desktop's config (`%APPDATA%\Claude\claude_desktop_config.json`), same as any other MCP server's credentials — treat that file accordingly.

### From source (macOS, Linux, or Claude Code on Windows)

```bash
npm install
npm run build
```

To build the standalone Windows binary yourself instead of downloading a release:

```bash
npm run build:exe   # -> dist-bin/odcanit-mcp.exe
```

## Configuration

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ODCANIT_DB_HOST` | yes | — | |
| `ODCANIT_DB_NAME` | yes | — | |
| `ODCANIT_DB_USER` | yes | — | |
| `ODCANIT_DB_PASSWORD` | yes | — | |
| `ODCANIT_DB_PORT` | no | `1433` | Mutually exclusive with `ODCANIT_DB_INSTANCE` |
| `ODCANIT_DB_INSTANCE` | no | — | For named instances (host written as `HOST\instance`); the port is resolved dynamically via SQL Server Browser (UDP 1434) |
| `ODCANIT_DB_ENCRYPT` | no | `true` | |
| `ODCANIT_DB_TRUST_CERT` | no | `false` | |

The Windows installer sets these for you. Building from source, add them to your MCP client config:

```json
{
  "mcpServers": {
    "odcanit": {
      "command": "node",
      "args": ["/absolute/path/to/odcanit-mcp/dist/index.js"],
      "env": {
        "ODCANIT_DB_HOST": "your-sql-server-host",
        "ODCANIT_DB_NAME": "your-database-name",
        "ODCANIT_DB_USER": "your-username",
        "ODCANIT_DB_PASSWORD": "your-password"
      }
    }
  }
}
```

Config file location: `%APPDATA%\Claude\claude_desktop_config.json` (Windows), `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), or `.mcp.json` for a Claude Code project.

## Verify

Ask Claude to look up a case or client you know exists, e.g. "get case details for case 1234." A result back means the connection is working.

## Development

```bash
npm run dev    # tsc --watch, for active development
npm start      # run the built server directly (dist/index.js)
```

## Contributing

Contributions are welcome — feel free to open a Pull Request.

## License

MIT
