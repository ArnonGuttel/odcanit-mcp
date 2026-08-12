import { z } from 'zod';

// MVP read-only tool definitions for Odcanit MCP
// Backed by the read-only export views (vwExportToOuterSystems_*)

export const getCaseDetailsTool = {
  description: 'Get details for a specific case from vwExportToOuterSystems_Files (read-only)',
  inputSchema: {
    tikNumber: z.string().describe('Case number (TikNumber)'),
  },
};

export const getClientDetailsTool = {
  description: 'Get details for a specific client from vwExportToOuterSystems_Clients (read-only)',
  inputSchema: {
    visualID: z.string().describe('Client visual ID (VisualID)'),
  },
};
