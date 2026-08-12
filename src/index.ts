import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getCaseDetailsTool, getClientDetailsTool } from './tools.js';
import { queryOdcanit } from './db.js';
import { Case, Client } from './types.js';

const server = new McpServer({
  name: 'odcanit-mcp',
  version: '0.1.0',
});

server.registerTool('get_case_details', getCaseDetailsTool, async ({ tikNumber }) => {
  const rows = await queryOdcanit<Case>(
    'SELECT * FROM vwExportToOuterSystems_Files WHERE TikNumber = @tikNumber',
    { tikNumber }
  );
  return {
    content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
  };
});

server.registerTool('get_client_details', getClientDetailsTool, async ({ visualID }) => {
  const rows = await queryOdcanit<Client>(
    'SELECT * FROM vwExportToOuterSystems_Clients WHERE VisualID = @visualID',
    { visualID }
  );
  return {
    content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odcanit MCP server running on stdio');
}

main().catch(console.error);
