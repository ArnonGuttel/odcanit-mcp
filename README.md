# Odcanit MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for [Odcanit](https://www.od.co.il/prod-odcanit/), the Israeli legal practice management software.

This MCP server enables Claude and other AI tools to interact with Odcanit data, including cases, clients, documents, and legal workflows.

## Features

- Query cases and client information
- Access case documents and timelines
- Retrieve calendar and scheduling data
- Manage billing and time tracking
- Integrate with Israeli court systems

## Getting Started

### Installation

```bash
npm install
npm run build
```

### Configuration

Set your Odcanit API credentials:

```bash
export ODCANIT_API_KEY="your_api_key"
export ODCANIT_BASE_URL="https://api.odcanit.co.il"
```

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
