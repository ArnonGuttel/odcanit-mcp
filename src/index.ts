import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getPool } from './db.js';
import { registerTools } from './register.js';

const server = new McpServer({
  name: 'odcanit-mcp',
  version: '0.1.0',
});

registerTools(server);

async function checkConnection() {
  const pool = await getPool();
  await pool.request().query('SELECT 1');
}

function waitForKeyPress(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      resolve();
    });
  });
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
    if (process.stdin.isTTY) {
      console.error('Press any key to exit...');
      await waitForKeyPress();
    }
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Odcanit MCP server running on stdio');
}

main().catch(console.error);
