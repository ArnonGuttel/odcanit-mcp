# Odcanit MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management software. It lets Claude and other AI tools read data from Odcanit's SQL Server database through its read-only export views (`vwExportToOuterSystems_*`).

## Status

MVP, read-only, two tools:

| Tool | Looks up | Source view |
| --- | --- | --- |
| `get_case_details` | a case, by case number | `vwExportToOuterSystems_Files` |
| `get_client_details` | a client, by visual ID | `vwExportToOuterSystems_Clients` |

## How it works

Odcanit has no REST API — the only integration surface is direct SQL Server access, through a fixed set of read-only views. This server connects to *your* firm's own Odcanit SQL Server instance, so it must run somewhere with network access to it (e.g. inside your office network, or over VPN).

It runs locally as a subprocess that Claude launches itself, over the [stdio transport](https://modelcontextprotocol.io/docs/concepts/transports) — no data or credentials are sent anywhere outside your machine/network.

## Getting started

This setup is a one-time task for whoever administers Odcanit / SQL Server access at your firm (e.g. IT), not something each individual Claude user does.

You'll need:

- Network access to your firm's Odcanit SQL Server instance
- A SQL Server login with read access to the `vwExportToOuterSystems_*` views
- Node.js 18+ — only to build from source. The Windows path below uses a prebuilt binary and needs nothing installed.

### Windows, no Node.js required

Most Odcanit installs run on Windows. Download the latest release zip from the [Releases page](https://github.com/ArnonGuttel/odcanit-mcp/releases) and extract it — it's a single flat folder (`odcanit-mcp.exe`, `Setup.bat`, `Uninstall.bat`, `.mcp.json`), nothing to install.

**Claude Desktop:** double-click `Setup.bat`. It prompts for your SQL Server details, tests the connection, and registers the server in Claude Desktop's config, leaving a console window open to show progress — press any key to close it once it says "Done". (`Setup.bat` is a double-click wrapper around `powershell -ExecutionPolicy Bypass -File setup-windows.ps1`, if you'd rather run it from a terminal.) Restart Claude Desktop when it finishes. To reconfigure against a different database later, double-click `Uninstall.bat` first — it only removes the `odcanit` entry from Claude Desktop's config.

**Claude Code:** edit the `.mcp.json` in the extracted folder — it already points at the `odcanit-mcp.exe` next to it — and fill in your SQL Server details in its `env` block. Then run `claude` from inside that folder and approve the project when prompted.

Neither `odcanit-mcp.exe` nor the setup script is code-signed, so Windows SmartScreen will flag them as being from an unrecognized publisher the first time you run either — click "More info", then "Run anyway".

The SQL Server password you enter ends up stored in plain text, either way — in Claude Desktop's `%APPDATA%\Claude\claude_desktop_config.json`, or in the `.mcp.json` you edited. Treat that file like a password, and only run this setup on a machine you trust.

### From source (macOS, Linux, or Claude Code on Windows)

```bash
npm install
npm run build
```

To build the standalone Windows binary yourself, instead of downloading a release (this needs Node.js on the build machine only, not on the machine that will run the `.exe`):

```bash
npm run build:exe   # -> dist-bin/odcanit-mcp.exe
```

### Configuration

Set your Odcanit SQL Server connection details as environment variables:

```bash
export ODCANIT_DB_HOST="your-sql-server-host"
export ODCANIT_DB_NAME="your-database-name"
export ODCANIT_DB_USER="your-username"
export ODCANIT_DB_PASSWORD="your-password"

# Optional, defaults shown:
export ODCANIT_DB_PORT="1433"
export ODCANIT_DB_ENCRYPT="true"
export ODCANIT_DB_TRUST_CERT="false"
```

If your server is a named instance (written as `HOST\instance`), set `ODCANIT_DB_INSTANCE` to the instance name instead of a port — the port is resolved dynamically via the SQL Server Browser service (UDP 1434), so `ODCANIT_DB_INSTANCE` and `ODCANIT_DB_PORT` are mutually exclusive:

```bash
export ODCANIT_DB_INSTANCE="odcanit"
```

### Connecting to Claude

The Windows setup above handles this for you. Building from source, wire it in by hand, depending on which client you use:

**Claude Code** auto-discovers the [`.mcp.json`](.mcp.json) at this repo's root the first time you run `claude` from inside the project directory, and offers to load the `odcanit` server (a one-time approval prompt). It points at `dist/index.js` by relative path and reads credentials from your shell environment (`${ODCANIT_DB_HOST}`, etc. — see [Configuration](#configuration) above), so nothing in the file itself needs editing.

**Claude Desktop** has no per-project equivalent — it only reads one global config file. Add an entry to it by hand (`claude_desktop_config.json`, typically `%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Restart Claude after saving. It launches the server itself and connects to your Odcanit database with the credentials above.

### Verifying it worked

Ask Claude to look up a case or client you know exists — e.g. "get case details for case 1234". A result back means the connection is working.

## Development

```bash
npm run dev    # tsc --watch, for active development
npm start       # run the built server directly (dist/index.js)
```

## Contributing

Contributions are welcome — feel free to open a Pull Request.

## License

MIT
