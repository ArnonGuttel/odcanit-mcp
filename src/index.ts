import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getCaseDetailsTool, getClientDetailsTool } from './tools.js';
import { getPool, queryOdcanit } from './db.js';
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

async function checkConnection() {
  const pool = await getPool();
  await pool.request().query('SELECT 1');
}

async function main() {
  if (process.argv.includes('--test-connection')) {
    try {
      await checkConnection();
      console.log('OK');
      process.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  try {
    await checkConnection();
  } catch (error) {
    console.error(
      'Failed to connect to the Odcanit database:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odcanit MCP server running on stdio');
}

main().catch(console.error);
