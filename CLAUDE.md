# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP (Model Context Protocol) server that exposes read-only data from Odcanit — an Israeli legal practice management system — to Claude and other AI tools. Odcanit has no REST API; the only integration surface is direct SQL Server access via a fixed set of read-only views (`vwExportToOuterSystems_*`) and stored procedures (for writes, not currently used). This server connects directly to a firm's own SQL Server instance and runs locally as a stdio subprocess launched by Claude Desktop/Code — no data leaves the local machine/network.

Status: MVP, read-only, two tools only.

## Commands

```bash
npm install      # install dependencies
npm run build     # compile TypeScript (tsc) -> dist/
npm run dev        # tsc --watch, for active development
npm start           # run the built server (node dist/index.js)
```

There is no test suite and no lint script configured. `scripts/test-connection.mjs` is a manual DB connectivity check — it imports from `../dist/db.js`, so run `npm run build` first, then:

```bash
node scripts/test-connection.mjs
```

It exits 0 and prints `OK` on a successful connection, otherwise prints the error and exits 1.

Windows firms have an interactive one-shot setup that installs deps, builds, prompts for SQL Server credentials, tests the connection, and registers the server in Claude Desktop's config:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Uninstall  # removes the 'odcanit' entry only
```

## Architecture

The whole server is four small files in `src/`:

- **`db.ts`** — lazily creates and caches a single `mssql` `ConnectionPool` (module-level singleton, built from `ODCANIT_DB_*` env vars). `queryOdcanit<T>(query, params)` is the only query entry point: it grabs the pool, binds `params` as named SQL parameters via `request.input()`, and returns `result.recordset` typed as `T[]`. All queries are parameterized this way — never interpolate user input into the SQL string directly.
- **`types.ts`** — TypeScript interfaces (`Case`, `Client`) mirroring the columns of the Odcanit export views. Each interface's doc comment names its source view (`vwExportToOuterSystems_Files`, `vwExportToOuterSystems_Clients`) — keep that pairing when adding new views/interfaces.
- **`tools.ts`** — MCP tool definitions: `description` + a Zod `inputSchema` per tool. Pure metadata, no query logic.
- **`index.ts`** — wires everything together: constructs the `McpServer`, calls `server.registerTool(name, toolDef, handler)` for each tool, and each handler runs a `SELECT * FROM <view> WHERE <key> = @param` through `queryOdcanit`, returning the first row (or `null`) as a JSON text content block. Connects over `StdioServerTransport` in `main()`.

To add a new read-only tool: add a `vwExportToOuterSystems_*`-backed interface to `types.ts`, a tool definition to `tools.ts`, and a `registerTool` call + query in `index.ts` following the existing pattern — one row lookup by a single key parameter, returned as `JSON.stringify(rows[0] ?? null)`.

Module system is ESM throughout (`"type": "module"` in package.json, `NodeNext` module resolution) — relative imports in `.ts` source use explicit `.js` extensions (e.g. `import { queryOdcanit } from './db.js'`), since that's what they resolve to after compilation.

## Configuration

All DB connection config comes from environment variables, read via `requireEnv()` in `db.ts` (throws if missing):

- `ODCANIT_DB_HOST`, `ODCANIT_DB_NAME`, `ODCANIT_DB_USER`, `ODCANIT_DB_PASSWORD` — required
- `ODCANIT_DB_PORT` (default `1433`), `ODCANIT_DB_ENCRYPT` (default `true`), `ODCANIT_DB_TRUST_CERT` (default `false`) — optional

When running under Claude Desktop/Code, these are set in the MCP server config's `env` block (see README for the `mcpServers` JSON shape), not a `.env` file loaded by the server itself.
