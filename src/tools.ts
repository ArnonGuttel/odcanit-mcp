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

export const getEmployeeAbsencesTool = {
  description:
    'List absence entries for a specific staff member, from vwExportToOuterSystems_EmployeeAbsenceList (read-only)',
  inputSchema: {
    userID: z.number().describe('Staff user ID (UserID)'),
  },
};

export const getUserDetailsTool = {
  description: 'Get details for a specific firm user, from vwExportToOuterSystems_LoginUsers (read-only)',
  inputSchema: {
    userID: z.number().describe('User ID (UserID)'),
  },
};

export const getUserHourlyRatesTool = {
  description:
    'List hourly billing rate history for a specific user, from vwExportToOuterSystems_HourlyUserPrices (read-only)',
  inputSchema: {
    userID: z.number().describe('User ID (UserID)'),
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
