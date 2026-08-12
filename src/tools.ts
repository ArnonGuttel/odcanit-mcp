// MVP read-only tools for Odcanit MCP
// Backed by the read-only export views (vwExportToOuterSystems_*)

export const tools = [
  {
    name: 'get_case_details',
    description: 'Get details for a specific case from vwExportToOuterSystems_Files (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        tikNumber: {
          type: 'string',
          description: 'Case number (TikNumber)'
        }
      },
      required: ['tikNumber']
    }
  },
  {
    name: 'get_client_details',
    description: 'Get details for a specific client from vwExportToOuterSystems_Clients (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        visualID: {
          type: 'string',
          description: 'Client visual ID (VisualID)'
        }
      },
      required: ['visualID']
    }
  }
];
