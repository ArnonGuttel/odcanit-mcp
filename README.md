# Odcanit MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management software.

This MCP server enables Claude and other AI tools to read data from Odcanit's SQL Server database via its read-only export views (`vwExportToOuterSystems_*`).

## Status

MVP — read-only, two tools:

- `get_case_details` — look up a case by number (`vwExportToOuterSystems_Files`)
- `get_client_details` — look up a client by visual ID (`vwExportToOuterSystems_Clients`)

## How it works

Odcanit has no REST API — external systems connect directly to its SQL Server database and query a fixed set of read-only views (for exporting data) or call stored procedures (for writing data). This server connects to *your* Odcanit SQL Server instance directly, so it must run somewhere with network access to it (e.g. inside your office network, or over VPN).

This server runs locally as a subprocess that Claude launches itself (via the [stdio transport](https://modelcontextprotocol.io/docs/concepts/transports)) — no data or credentials are sent anywhere outside your machine/network.

## Getting Started

This setup is meant to be done once, by whoever administers Odcanit / SQL Server access at your firm (e.g. IT) — not by each individual user of Claude.

### Prerequisites

- Node.js 18+
- Network access to your firm's Odcanit SQL Server instance
- A SQL Server login with read access to the `vwExportToOuterSystems_*` views

### Windows: automated setup

Most Odcanit installs run on Windows. If that's you, run the setup script instead of the manual steps below — it installs dependencies, builds the server, prompts for your SQL Server details, tests the connection, and registers the server with Claude Desktop automatically:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

Restart Claude Desktop when it finishes. The steps below are what that script automates, and are still the path for macOS/Linux or Claude Code.

To remove the server from Claude Desktop later (e.g. to reconfigure it against a different database), run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Uninstall
```

This only removes the `odcanit` entry from Claude Desktop's config — it doesn't touch your SQL Server or delete the repo.

### Installation

```bash
npm install
npm run build
```

### Configuration

Set your Odcanit SQL Server connection details as environment variables:

```bash
export ODCANIT_DB_HOST="your-sql-server-host"
export ODCANIT_DB_NAME="your-database-name"
export ODCANIT_DB_USER="your-username"
export ODCANIT_DB_PASSWORD="your-password"
# Optional (defaults shown):
export ODCANIT_DB_PORT="1433"
export ODCANIT_DB_ENCRYPT="true"
export ODCANIT_DB_TRUST_CERT="false"
# If your server is a named instance (e.g. written as HOST\odcanit), set the
# instance name instead of a port -- the port is resolved dynamically via the
# SQL Server Browser service (UDP 1434), so ODCANIT_DB_INSTANCE and
# ODCANIT_DB_PORT are mutually exclusive:
export ODCANIT_DB_INSTANCE="odcanit"
```

### Usage

```bash
npm start
```

### Connecting to Claude

Add an entry to your Claude Desktop or Claude Code MCP config (e.g. `claude_desktop_config.json` or `.mcp.json`):

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

Restart Claude after saving the config. It will launch the server locally and connect to your Odcanit database using the credentials above.

## Development

```bash
npm run dev  # Watch mode TypeScript compilation
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
