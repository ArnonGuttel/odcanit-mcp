# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP (Model Context Protocol) server that exposes data from Odcanit — an Israeli legal practice management system — to Claude and other AI tools. Odcanit has no REST API; the only integration surface is direct SQL Server access via a fixed set of read-only views (`vwExportToOuterSystems_*`) plus a fixed set of `Klita_Interface_*` stored procedures for writes (see Odcanit's own "ממשק קליטת נתונים" / data-ingestion API doc, not in this repo). This server connects directly to a firm's own SQL Server instance and runs locally as a stdio subprocess launched by Claude Desktop/Code — no data leaves the local machine/network.

Status: 9 read-only tools + 4 opt-in write tools (`ODCANIT_DB_ENABLE_WRITES`).

## Workflow

Never push directly to `main`. For any change, check out a new branch, commit there, push the branch, and open a PR into `main` — even for small doc/config edits.

Always ask for confirmation before running `git commit` or `git push` — do not commit or push automatically as part of a task, even on a feature branch.

## Commands

```bash
npm install      # install dependencies
npm run build     # compile TypeScript (tsc) -> dist/
npm run dev        # tsc --watch, for active development
npm start           # run the built server (node dist/index.js)
npm run build:exe    # bundle + package a standalone Windows dist-bin/odcanit-mcp.exe (no Node.js needed to run it)
```

There is no test suite and no lint script configured. `index.ts` handles a `--test-connection` flag as a manual DB connectivity check (see Architecture below): it runs a `SELECT 1` via `getPool()` and exits 0/1, printing `OK` on success or the error on failure. For a source build, run `npm run build` first, then:

```bash
node dist/index.js --test-connection
```

The packaged binary exposes the same flag (`dist-bin/odcanit-mcp.exe --test-connection`) — this is what `setup-windows.ps1` uses, since a machine running only the `.exe` has no Node.js to run the source build with.

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

The whole server is five small files in `src/`:

- **`db.ts`** — lazily creates and caches a single `mssql` `ConnectionPool` (module-level singleton, built from `ODCANIT_DB_*` env vars). `queryOdcanit<T>(query, params)` is the only read entry point: it grabs the pool, binds `params` as named SQL parameters via `request.input()`, and returns `result.recordset` typed as `T[]`. All queries are parameterized this way — never interpolate user input into the SQL string directly. `executeOdcanitProcedure(procedureName, inputs, outputs)` is the equivalent single write entry point (see Write operations below): it calls `assertWritesEnabled()` unconditionally, so no write tool can accidentally skip the `ODCANIT_DB_ENABLE_WRITES` gate, and it always adds an `@Error` output param, throwing if the procedure populates it — every `Klita_Interface_*` procedure reports validation failures this way, so this one check covers all of them.
- **`types.ts`** — TypeScript interfaces mirroring the columns of the Odcanit export views, but only for views backing a dedicated tool (single-row lookups and the non-case-scoped, non-user-scoped lists — `Case`, `Client`, `InvoicePaymentLink`, `OdcanitUser`, `RegisteredBusiness`, `Court`). Each interface's doc comment names its source view — keep that pairing when adding new ones. The 19 case-scoped datasets behind `get_case_data` and the 2 user-scoped datasets behind `get_user_data` (see below) are *not* typed here — they're dispatched generically as `Record<string, unknown>`, since a single handler can't bind one static `T` per `dataset` value. Write tools have no equivalent interfaces here either — their shape comes from the Zod `inputSchema` in `tools.ts`, and their procedure output params are read directly off the `Record<string, unknown>` `executeOdcanitProcedure` returns.
- **`tools.ts`** — MCP tool definitions: `description` + a Zod `inputSchema` per tool. Pure metadata, no query logic. Also exports `CASE_DATASETS` and `USER_DATASETS`, the `as const` tuples of dataset keys that the `get_case_data`/`get_user_data` Zod enums and `register.ts`'s query maps are built from.
- **`register.ts`** — exports `registerTools(server)`, which calls `server.registerTool(name, toolDef, handler)` for each tool; each read handler runs a query through `queryOdcanit`, each write handler calls `executeOdcanitProcedure`. Also holds `CASE_DATA_QUERIES` and `USER_DATA_QUERIES`, the dataset → SQL lookup tables backing `get_case_data` and `get_user_data`. This is the file that grows as tools are added — kept separate from `index.ts` so the server's startup/transport lifecycle doesn't get lost in a growing list of tool handlers.
- **`index.ts`** — lifecycle only: constructs the `McpServer`, calls `registerTools(server)` once, then `main()` checks for a `--test-connection` flag first (runs a `SELECT 1` via `getPool()` and exits 0/1 — used by the packaged `.exe`, see below); otherwise it connects the real MCP server over `StdioServerTransport`.

Five tool shapes exist:

- **Single-row lookup** (`get_case_details`, `get_client_details`, `get_user_details`, `get_registered_business`, `get_court`): the key (`TikNumber`, `VisualID`, `UserID`, `Counter`, `CourtCodeCounter`) uniquely identifies one row in that tool's view, so the handler returns `JSON.stringify(rows[0] ?? null)`.
- **Fixed scoped list** (`get_invoice_payment_links`): pinned to one view and one filter key (`IDinvoice`) with no sibling views sharing that same key, so it stays a dedicated tool rather than folding into a dataset-dispatched one. The handler returns the full array as `JSON.stringify(rows)` — never `rows[0]`, which would silently drop every row but the first.
- **`get_case_data(tikNumber, dataset)`** — one tool covering all 19 case-scoped list datasets (`handlers`, `actions`, `debtors`, `trust_funds`, `parties`, `linked_cases`, `expenses`, `billing`, `invoice_summary`, `receipts_and_payments`, `calendar_events`, `tasks`, `custom_fields`, `change_log`, `documents`, `attachments`, `hybrid_mail`, `web_forms`, `phone_calls`) that were previously 19 separate tools (`get_case_handlers`, `get_case_actions`, etc.). The handler looks up `dataset` in `CASE_DATA_QUERIES`, a `Record<(typeof CASE_DATASETS)[number], string>` in `register.ts`, and runs that query. This collapse exists because per-tool schemas are sent to the model on every turn regardless of use, and near-identical single-purpose tools (same input, same list-of-rows shape, differing only in which view) hurt tool-selection accuracy as the tool count grows — collapsing them into one enum-dispatched tool cut the total tool count from 28 to 9.
- **`get_user_data(userID, dataset)`** — same pattern as `get_case_data`, applied to the two user-scoped list datasets (`absences`, `hourly_rates`) that were previously `get_employee_absences` and `get_user_hourly_rates`. Looks up `dataset` in `USER_DATA_QUERIES` in `register.ts`. `get_user_details` (single-row, `rows[0]`) stays a separate tool rather than folding in here, since mixing single-row and list output shapes under one dataset-dispatched tool would break the shape consistency the other two dataset-dispatched tools rely on.
- **Write tools** (`create_or_update_case`, `create_or_update_billing_charge`, `create_document`, `create_attachment`): each calls one `Klita_Interface_*` stored procedure through `executeOdcanitProcedure`, gated by `ODCANIT_DB_ENABLE_WRITES`. See Write operations below.

The views behind `get_case_data` aren't consistent about which case-identifying column they expose, so the query varies by dataset in `CASE_DATA_QUERIES`:

- Some expose `TikNumber` directly (`expenses` → `Expenses`, `attachments` → `Nispah`, plus `handlers`, `actions`, `debtors`, `trust_funds`, `parties`) — filter on it directly.
- Some expose `TikVisualID` instead (`billing` → `Billing`, `invoice_summary` → `InvoiceByCategoryAndVat`, `receipts_and_payments` → `ReceiptAndIncome`, `documents` → `Documents`) — same value, different column name in that view.
- Some expose only the internal `TikCounter`, not `TikNumber` (`calendar_events` → `YomanData`, `tasks` → `Tasks`, `custom_fields` → `UserData`, `change_log` → `ActionLog`, `hybrid_mail` → `HybridMail`, `web_forms` → `WebForms`, `phone_calls` → `vwPhoneCenterCallsInfo`) — the query `JOIN`s through `vwExportToOuterSystems_Files` on `TikCounter`, filtered by `f.TikNumber = @tikNumber`, so the tool's public input still stays `TikNumber` like every other dataset.
- `linked_cases` is the one exception backed by a table-valued function (`dbo.udfExportToOuterSystems_GetLinkedMainTiks`) rather than a view; it only accepts `TikCounter`, so it's resolved the same way via `CROSS APPLY` against `Files`.

To add a new read-only tool: decide first whether it's case-scoped by `TikNumber` — if so, add a new key to `CASE_DATASETS` in `tools.ts` (updating `getCaseDataTool`'s description) and a matching query to `CASE_DATA_QUERIES` in `register.ts`, checking which case-identifying column the view actually exposes before writing the `WHERE`/`JOIN`, per the bullets above. If it's a list scoped by `UserID`, same idea but against `USER_DATASETS`/`USER_DATA_QUERIES` and `getUserDataTool`. If it's scoped by something else entirely (a new key shared by no existing dataset-dispatched tool), add a `vwExportToOuterSystems_*`-backed interface to `types.ts`, a tool definition to `tools.ts`, and a `registerTool` call + query in `register.ts` as a dedicated tool — pick single-row vs. list based on whether the filter key is unique in that view. A new list tool that turns out to share a filter key with an existing dedicated list tool should fold both into a new dataset-dispatched tool rather than staying separate.

### Write operations

Odcanit exposes writes as a fixed set of `Klita_Interface_*` stored procedures (documented in the firm's own "ממשק קליטת נתונים" / data-ingestion API doc, not checked into this repo), each taking named `@Param` inputs and always returning an `@Error` output param (populated on validation failure) plus 0-2 procedure-specific output params. The procedures themselves do all business-rule validation (required-field combinations, foreign-key-style existence checks against names like a court code or username) — the tool layer does not re-implement those rules, it just calls `executeOdcanitProcedure` in `db.ts`, which throws whenever `@Error` comes back non-empty; the MCP SDK auto-wraps a thrown `Error` into an `isError: true` tool result, so no handler needs its own try/catch for this.

Currently implemented: `create_or_update_case` (`Klita_Interface_TikDetails`), `create_or_update_billing_charge` (`Klita_Interface_BillingDetails`), `create_document` (`Klita_Interface_DocDetails`), `create_attachment` (`Klita_Interface_NispahDetails`). Several more `Klita_Interface_*` procedures exist and are undocumented here — add them the same way, mirroring an existing write tool's `tools.ts`/`register.ts` pair.

Two procedures use an "update" mode selected by passing an ID param (`TikCounter` for case, `BillingCounterForUpdate` for billing charge — omit to create, provide to update); every other field is passed as SQL `NULL` when the caller omits it, per each procedure's own "only non-NULL params get updated" contract — `create_or_update_case`'s handler is the reference implementation for this pattern. Note billing charge "update" is actually delete-and-reinsert per the procedure's own behavior, so all the normal create fields must still be supplied even when updating.

`create_document` is the one tool with a side effect outside the database: `Klita_Interface_DocDetails` only creates the document *record* and returns an `@Path` — the directory/file path in Odcanit's own document store — and the caller is responsible for physically copying the file there. The tool does that copy itself rather than just returning the path to the model: it accepts the source file as either `sourceFilePath` (read from the machine running the MCP server) or `fileContentBase64` (decoded in-process, for a file that only exists in the client/chat session), reads the bytes *before* calling the procedure so an unreadable source fails before an orphan DB record is created, then `writeFile`s them to the returned `@Path` after the procedure succeeds. This requires the MCP server process to have filesystem access to Odcanit's document store (e.g. a mounted network share) — a deployment concern for whoever runs the server, not something the tool can paper over.

Module system is ESM throughout (`"type": "module"` in package.json, `NodeNext` module resolution) — relative imports in `.ts` source use explicit `.js` extensions (e.g. `import { queryOdcanit } from './db.js'`), since that's what they resolve to after compilation.

## Configuration

All DB connection config comes from environment variables, read via `requireEnv()` in `db.ts` (throws if missing):

- `ODCANIT_DB_HOST`, `ODCANIT_DB_NAME`, `ODCANIT_DB_USER`, `ODCANIT_DB_PASSWORD` — required
- `ODCANIT_DB_PORT` (default `1433`), `ODCANIT_DB_ENCRYPT` (default `true`), `ODCANIT_DB_TRUST_CERT` (default `false`) — optional
- `ODCANIT_DB_INSTANCE` — optional, for named SQL Server instances (host written as `HOST\instance`). Mutually exclusive with `ODCANIT_DB_PORT`: `db.ts` throws if both are set, since a named instance's TCP port is resolved dynamically via the SQL Server Browser service (UDP 1434) rather than being fixed.
- `ODCANIT_DB_ENABLE_WRITES` (default `false`) — enables the write tools (see Write operations above). `db.ts` exports `assertWritesEnabled()`, which throws unless this is `"true"`; `executeOdcanitProcedure` calls it unconditionally, so every write tool is gated by it automatically.

When running under Claude Desktop/Code, these are set in the MCP server config's `env` block (see README for the `mcpServers` JSON shape), not a `.env` file loaded by the server itself.
