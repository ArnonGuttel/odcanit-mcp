# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP (Model Context Protocol) server that exposes read-only data from Odcanit — an Israeli legal practice management system — to Claude and other AI tools. Odcanit has no REST API; the only integration surface is direct SQL Server access via a fixed set of read-only views (`vwExportToOuterSystems_*`) and stored procedures (for writes, not currently used). This server connects directly to a firm's own SQL Server instance and runs locally as a stdio subprocess launched by Claude Desktop/Code — no data leaves the local machine/network.

Status: MVP, read-only, two tools only.

## Workflow

Never push directly to `main`. For any change, check out a new branch, commit there, push the branch, and open a PR into `main` — even for small doc/config edits.

## Commands

```bash
npm install      # install dependencies
npm run build     # compile TypeScript (tsc) -> dist/
npm run dev        # tsc --watch, for active development
npm start           # run the built server (node dist/index.js)
npm run build:exe    # bundle + package a standalone Windows dist-bin/odcanit-mcp.exe (no Node.js needed to run it)
```

There is no test suite and no lint script configured. `scripts/test-connection.mjs` is a manual DB connectivity check for source builds — it imports from `../dist/db.js`, so run `npm run build` first, then:

```bash
node scripts/test-connection.mjs
```

It exits 0 and prints `OK` on a successful connection, otherwise prints the error and exits 1. The compiled binary has the equivalent built in as a flag: `dist-bin/odcanit-mcp.exe --test-connection` (also handled by `index.ts`, see Architecture below) — this is what `setup-windows.ps1` uses, since a machine running only the `.exe` has no Node.js to run `test-connection.mjs` with.

Windows firms have an interactive one-shot setup that prompts for SQL Server credentials, tests the connection via the `.exe`, and registers the server in Claude Desktop's config — no Node.js required on the machine running it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Uninstall  # removes the 'odcanit' entry only
```

`scripts\Setup.bat` and `scripts\Uninstall.bat` are thin double-click wrappers around those two invocations (using `%~dp0` so they work regardless of the current directory), for non-technical users who don't know how to open PowerShell in a folder. Keep them in sync if `setup-windows.ps1`'s parameters change, and keep them listed alongside it in the release zip step of `.github/workflows/build-exe.yml`.

`setup-windows.ps1` looks for `odcanit-mcp.exe` in two places, in order: next to itself (the flat layout of the release zip — `odcanit-mcp.exe`, `setup-windows.ps1`, `Setup.bat`, `Uninstall.bat` all in one folder, chosen so a non-technical user extracting the zip sees one obvious thing to double-click rather than a `dist-bin\`/`scripts\` split), then `..\dist-bin\odcanit-mcp.exe` (the source repo's `npm run build:exe` output layout, so the script still works when run directly out of `scripts\` during development). It fails fast with a clear message if neither is found.

### Packaging the standalone binary (`npm run build:exe`, `scripts/build-exe.mjs`)

`dist/index.js` (ESM, depends on `node_modules`) can't run standalone, so `build:exe` produces a self-contained Windows binary via Node's built-in Single Executable Applications (SEA) feature:

1. `esbuild` bundles `dist/index.js` and all dependencies into one CJS file, `build/bundle.cjs`.
2. `node --experimental-sea-config sea-config.json` turns that bundle into a V8 blob, `build/sea-prep.blob`.
3. An official Windows Node.js binary is downloaded from nodejs.org (cached in `.cache/`, version pinned in `scripts/build-exe.mjs`) to use as the base executable — this only works because Node ships the SEA injection point in its official builds; a third-party prebuilt-binary approach (`pkg`) was tried first but abandoned because its hosted Windows base binaries were unavailable (404 from the `pkg-fetch` release host).
4. `postject` injects the blob into that binary with the standard SEA sentinel fuse, producing `dist-bin/odcanit-mcp.exe`.

The result is unsigned, so Windows SmartScreen will flag it as being from an unrecognized publisher on first run — expected, not a build defect. `.cache/`, `build/`, and `dist-bin/` are all gitignored build output, not committed.

`.github/workflows/build-exe.yml` runs this pipeline in CI on every push/PR to `main` (as a build-only sanity check, uploaded as a workflow artifact) and, when a `v*` tag is pushed, additionally flattens `dist-bin/odcanit-mcp.exe`, `scripts/setup-windows.ps1`, `scripts/Setup.bat`, and `scripts/Uninstall.bat` into a single `release/` folder (no subfolders — matching `setup-windows.ps1`'s same-directory lookup above) and publishes the zipped result as a GitHub Release via `softprops/action-gh-release` — this is what end users download per the README's Windows setup instructions.

## Architecture

The whole server is four small files in `src/`:

- **`db.ts`** — lazily creates and caches a single `mssql` `ConnectionPool` (module-level singleton, built from `ODCANIT_DB_*` env vars). `queryOdcanit<T>(query, params)` is the only query entry point: it grabs the pool, binds `params` as named SQL parameters via `request.input()`, and returns `result.recordset` typed as `T[]`. All queries are parameterized this way — never interpolate user input into the SQL string directly.
- **`types.ts`** — TypeScript interfaces (`Case`, `Client`) mirroring the columns of the Odcanit export views. Each interface's doc comment names its source view (`vwExportToOuterSystems_Files`, `vwExportToOuterSystems_Clients`) — keep that pairing when adding new views/interfaces.
- **`tools.ts`** — MCP tool definitions: `description` + a Zod `inputSchema` per tool. Pure metadata, no query logic.
- **`index.ts`** — wires everything together: constructs the `McpServer`, calls `server.registerTool(name, toolDef, handler)` for each tool, and each handler runs a `SELECT * FROM <view> WHERE <key> = @param` through `queryOdcanit`, returning the first row (or `null`) as a JSON text content block. `main()` checks for a `--test-connection` flag first (runs a `SELECT 1` via `getPool()` and exits 0/1 — used by the packaged `.exe`, see below); otherwise it connects the real MCP server over `StdioServerTransport`.

To add a new read-only tool: add a `vwExportToOuterSystems_*`-backed interface to `types.ts`, a tool definition to `tools.ts`, and a `registerTool` call + query in `index.ts` following the existing pattern — one row lookup by a single key parameter, returned as `JSON.stringify(rows[0] ?? null)`.

Module system is ESM throughout (`"type": "module"` in package.json, `NodeNext` module resolution) — relative imports in `.ts` source use explicit `.js` extensions (e.g. `import { queryOdcanit } from './db.js'`), since that's what they resolve to after compilation.

## Configuration

All DB connection config comes from environment variables, read via `requireEnv()` in `db.ts` (throws if missing):

- `ODCANIT_DB_HOST`, `ODCANIT_DB_NAME`, `ODCANIT_DB_USER`, `ODCANIT_DB_PASSWORD` — required
- `ODCANIT_DB_PORT` (default `1433`), `ODCANIT_DB_ENCRYPT` (default `true`), `ODCANIT_DB_TRUST_CERT` (default `false`) — optional
- `ODCANIT_DB_INSTANCE` — optional, for named SQL Server instances (host written as `HOST\instance`). Mutually exclusive with `ODCANIT_DB_PORT`: `db.ts` throws if both are set, since a named instance's TCP port is resolved dynamically via the SQL Server Browser service (UDP 1434) rather than being fixed.

When running under Claude Desktop/Code, these are set in the MCP server config's `env` block (see README for the `mcpServers` JSON shape), not a `.env` file loaded by the server itself.
