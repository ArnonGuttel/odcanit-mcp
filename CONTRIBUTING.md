# Contributing

Thanks for your interest in improving Odcanit MCP.

## Getting set up

```bash
npm install
npm run build
```

You'll need network access to an Odcanit SQL Server instance to actually run the server against real data (see the README's [Configuration](README.md#configuration) section for the env vars). There's no mock/fixture database, so most contributors will be working on the code without a live connection — that's fine for anything that doesn't need `npm start` or `node dist/index.js --test-connection`-style verification; just make sure `npm run build` still compiles cleanly.

There's no test suite or lint script configured in this repo currently.

## Making a change

1. Fork the repo and create a branch off `main`.
2. Make your change. If you're adding a new read-only tool or a new write tool, see `CLAUDE.md` in the repo root — it documents the tool patterns (single-row lookup, dataset-dispatched list, etc.) and where each piece goes (`tools.ts`, `register.ts`, `types.ts`).
3. Run `npm run build` and confirm it compiles.
4. Open a pull request into `main`. CI (`.github/workflows/build-exe.yml`) builds the project and the standalone Windows binary on every PR — it must pass before merging, along with one approving review.

## Reporting bugs / requesting features

Open a GitHub issue. Since this server talks directly to a firm's SQL Server instance, please don't include real connection details, hostnames, or data from your Odcanit database in issue reports or PRs.

## Scope

This server only wraps Odcanit's fixed integration surface: the read-only `vwExportToOuterSystems_*` views and the `Klita_Interface_*` write stored procedures. It can't add functionality Odcanit itself doesn't expose through those.
