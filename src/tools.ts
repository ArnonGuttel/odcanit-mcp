import { z } from 'zod';

// MVP read-only tool definitions for Odcanit MCP
// Backed by the read-only export views (vwExportToOuterSystems_*)

// Shared by every paginated list/search tool — one definition for the limit/offset
// contract so it stays consistent (and the cap stays enforced) across tools.
export const paginationSchema = {
  limit: z.number().int().min(1).max(100).default(25).describe('Max rows to return (default 25, max 100)'),
  offset: z.number().int().min(0).default(0).describe('Rows to skip, for paging past the first `limit` results'),
};

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

export const listCasesTool = {
  description:
    'List cases from vwExportToOuterSystems_Files (read-only), optionally filtered by status, client, ' +
    'type, owner, or create/modify date range. Returns at most `limit` results (default 25, max 100) ' +
    'plus whether more match — pass `offset` or narrow the filters to page through the rest.',
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe('Filter by exact case status (StatusName) — omit to list cases in any status'),
    clientVisualID: z
      .string()
      .optional()
      .describe('Filter by exact client visual ID (ClientVisualID)'),
    clientName: z
      .string()
      .optional()
      .describe('Filter by client name (ClientName), partial match'),
    tikName: z.string().optional().describe('Filter by case name (TikName), partial match'),
    tikType: z.string().optional().describe('Filter by exact case type (TikType)'),
    tikOwner: z.number().optional().describe('Filter by exact case owner user ID (TikOwner)'),
    createdFrom: z.coerce.date().optional().describe('Only cases created on or after this date (TsCreateDate)'),
    createdTo: z.coerce.date().optional().describe('Only cases created on or before this date (TsCreateDate)'),
    modifiedFrom: z.coerce.date().optional().describe('Only cases modified on or after this date (TsModifyDate)'),
    modifiedTo: z.coerce.date().optional().describe('Only cases modified on or before this date (TsModifyDate)'),
    ...paginationSchema,
  },
};

export const CASE_DATASETS = [
  'handlers',
  'actions',
  'debtors',
  'trust_funds',
  'parties',
  'linked_cases',
  'expenses',
  'billing',
  'invoice_summary',
  'receipts_and_payments',
  'calendar_events',
  'tasks',
  'custom_fields',
  'change_log',
  'documents',
  'attachments',
  'hybrid_mail',
  'web_forms',
  'phone_calls',
] as const;

export const getCaseDataTool = {
  description:
    'Get one dataset scoped to a specific case (read-only). `dataset` selects what to fetch: ' +
    'handlers (assigned users), actions (activity log), debtors, trust_funds, parties, linked_cases, ' +
    'expenses, billing (line items), invoice_summary, receipts_and_payments, calendar_events, tasks, ' +
    'custom_fields, change_log, documents, attachments, hybrid_mail, web_forms, phone_calls.',
  inputSchema: {
    tikNumber: z.string().describe('Case number (TikNumber)'),
    dataset: z.enum(CASE_DATASETS).describe('Which case-scoped dataset to fetch'),
  },
};

export const getInvoicePaymentLinksTool = {
  description:
    'List the payments reconciled against a specific invoice, from vwExportToOuterSystems_InvoiceToIncome (read-only)',
  inputSchema: {
    idInvoice: z.number().describe('Invoice number (IDinvoice)'),
  },
};

export const getUserDetailsTool = {
  description: 'Get details for a specific firm user, from vwExportToOuterSystems_LoginUsers (read-only)',
  inputSchema: {
    userID: z.number().describe('User ID (UserID)'),
  },
};

export const USER_DATASETS = ['absences', 'hourly_rates'] as const;

export const getUserDataTool = {
  description:
    'Get one dataset scoped to a specific user (read-only). `dataset` selects what to fetch: ' +
    'absences (leave/absence entries), hourly_rates (hourly billing rate history).',
  inputSchema: {
    userID: z.number().describe('User ID (UserID)'),
    dataset: z.enum(USER_DATASETS).describe('Which user-scoped dataset to fetch'),
  },
};

export const getRegisteredBusinessTool = {
  description:
    'Get details for a specific registered business entity, from vwExportToOuterSystems_RegisteredBusinesses (read-only)',
  inputSchema: {
    counter: z.number().describe('Business ID (Counter)'),
  },
};

export const getCourtTool = {
  description: 'Get details for a specific court, from vwExportToOuterSystems_Courts (read-only)',
  inputSchema: {
    courtCodeCounter: z.number().describe('Court code (CourtCodeCounter)'),
  },
};
