import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';
import { queryOdcanit } from './db.js';
import { Case, Client } from './types.js';

const server = new Server(
  {
    name: 'odcanit-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_case_details') {
      const tikNumber = String(args?.tikNumber ?? '');
      const rows = await queryOdcanit<Case>(
        'SELECT * FROM vwExportToOuterSystems_Files WHERE TikNumber = @tikNumber',
        { tikNumber }
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
      };
    }

    if (name === 'get_client_details') {
      const visualID = String(args?.visualID ?? '');
      const rows = await queryOdcanit<Client>(
        'SELECT * FROM vwExportToOuterSystems_Clients WHERE VisualID = @visualID',
        { visualID }
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odcanit MCP server running on stdio');
}

main().catch(console.error);
