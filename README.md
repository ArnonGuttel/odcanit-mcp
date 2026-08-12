# Odcanit MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management software.

This MCP server enables Claude and other AI tools to read data from Odcanit's SQL Server database via its read-only export views (`vwExportToOuterSystems_*`).

## Status

MVP — read-only, two tools:

- `get_case_details` — look up a case by number (`vwExportToOuterSystems_Files`)
- `get_client_details` — look up a client by visual ID (`vwExportToOuterSystems_Clients`)

## Getting Started

### Installation

```bash
npm install
npm run build
```

### Configuration

Odcanit is accessed via a direct SQL Server connection (no REST API). Connection/auth details are not yet wired up — TBD.

### Usage

```bash
npm start
```

## Development

```bash
npm run dev  # Watch mode TypeScript compilation
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
