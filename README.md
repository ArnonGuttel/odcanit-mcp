# Odcanit MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management software. It lets Claude and other AI tools read data from Odcanit's SQL Server database through its read-only export views (`vwExportToOuterSystems_*`).

## Status

MVP, read-only, 9 tools:

| Tool | Looks up | Source view |
| --- | --- | --- |
| `get_case_details` | a case, by case number | `vwExportToOuterSystems_Files` |
| `list_cases` | cases, optionally filtered by status/client/type/owner/create/modify date, paginated | `vwExportToOuterSystems_Files` |
| `get_case_data` | one dataset scoped to a case, by case number + `dataset` (see below) | 19 views, one per `dataset` |
| `get_client_details` | a client, by visual ID | `vwExportToOuterSystems_Clients` |
| `get_invoice_payment_links` | payments reconciled against an invoice, by invoice number | `vwExportToOuterSystems_InvoiceToIncome` |
| `get_user_details` | a firm user, by user ID | `vwExportToOuterSystems_LoginUsers` |
| `get_user_data` | one dataset scoped to a user, by user ID + `dataset` (see below) | 2 views, one per `dataset` |
| `get_registered_business` | a registered business entity, by business ID | `vwExportToOuterSystems_RegisteredBusinesses` |
| `get_court` | a court, by court code | `vwExportToOuterSystems_Courts` |

`get_case_data`'s `dataset` parameter picks which case-scoped list to fetch:

| `dataset` | Returns |
| --- | --- |
| `handlers` | Users assigned to handle the case |
| `actions` | Logged actions/activity entries |
| `debtors` | Debtors named on the case |
| `trust_funds` | Trust/principal fund entries |
| `parties` | Parties beyond the primary client |
| `linked_cases` | Other cases linked to this one |
| `expenses` | Expenses recorded on the case |
| `billing` | Billing line items |
| `invoice_summary` | Invoice summaries by category and VAT |
| `receipts_and_payments` | Receipts, tax invoices, and linked payments |
| `calendar_events` | Calendar events (hearings/meetings) |
| `tasks` | Tasks linked to the case |
| `custom_fields` | Custom form/tab field values |
| `change_log` | Change-log audit trail |
| `documents` | Documents linked to the case |
| `attachments` | Appendix/attachment log entries |
| `hybrid_mail` | Physical mail/print jobs sent |
| `web_forms` | Digital questionnaires sent |
| `phone_calls` | Phone call log entries |

`get_user_data`'s `dataset` parameter picks which user-scoped list to fetch:

| `dataset` | Returns |
| --- | --- |
| `absences` | Leave/absence entries for the user |
| `hourly_rates` | Hourly billing rate history for the user |

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

Most Odcanit installs run on Windows. Download the latest release zip from the [Releases page](https://github.com/ArnonGuttel/odcanit-mcp/releases) and extract it — it's a single flat folder (`odcanit-mcp.exe`, `Setup.bat`, `Uninstall.bat`), nothing to install.

Double-click `Setup.bat`. It prompts for your SQL Server details, tests the connection, and registers the server in Claude Desktop's config, leaving a console window open to show progress — press any key to close it once it says "Done". (`Setup.bat` is a double-click wrapper around `powershell -ExecutionPolicy Bypass -File setup-windows.ps1`, if you'd rather run it from a terminal.) Restart Claude Desktop when it finishes. To reconfigure against a different database later, double-click `Uninstall.bat` first — it only removes the `odcanit` entry from Claude Desktop's config.

Neither `odcanit-mcp.exe` nor the setup script is code-signed, so Windows SmartScreen will flag them as being from an unrecognized publisher the first time you run either — click "More info", then "Run anyway".

The SQL Server password you enter is saved in plain text in Claude Desktop's own config file — the same as any other MCP server's credentials. That's normally `%APPDATA%\Claude\claude_desktop_config.json`, but if Claude Desktop was installed from the Microsoft Store it sandboxes its config to `%LOCALAPPDATA%\Packages\Claude_<hash>\LocalCache\Roaming\Claude\claude_desktop_config.json` instead; the setup script detects which applies and prints the exact path it's about to write to before asking you to confirm. Treat that file with the same care as a password, and only run this setup on a machine you trust.

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

The Windows setup above handles this for you. Building from source, add an entry to your Claude Desktop or Claude Code MCP config by hand (e.g. `claude_desktop_config.json`, typically `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS; or a project's `.mcp.json` for Claude Code):

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
