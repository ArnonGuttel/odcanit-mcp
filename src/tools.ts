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

// Write tools (require ODCANIT_DB_ENABLE_WRITES=true) — each calls a Klita_Interface_*
// stored procedure. Field-level validation (required combinations, foreign-key-style
// existence checks) is done by the procedure itself, which reports failures via its
// @Error output param; the schemas below only mark fields optional/required per the
// procedure doc and describe when a "required" field is actually needed.

export const createOrUpdateCaseTool = {
  description:
    'Create a new case or update an existing one, via Klita_Interface_TikDetails (write, requires ' +
    'ODCANIT_DB_ENABLE_WRITES=true). To update, pass `tikCounter` — every other field left unset is ' +
    'kept unchanged. To create, omit `tikCounter` and provide clientNum, tikNum, openDate, and tikName.',
  inputSchema: {
    tikCounter: z
      .number()
      .int()
      .optional()
      .describe('Internal case ID — provide to update an existing case; omit to create a new one'),
    clientNum: z.string().optional().describe('Client visual ID the case belongs to (required when creating)'),
    tikNum: z
      .number()
      .int()
      .optional()
      .describe(
        'Case number to create under the client, up to 7 digits, or -1 to auto-assign the next number ' +
          '(required when creating)'
      ),
    tiuk: z.string().optional().describe('Filing location — must already exist in the system'),
    openDate: z.coerce.date().optional().describe('Case open date (required when creating)'),
    tikName: z.string().optional().describe('Case name (required when creating)'),
    tikTypeName: z.string().optional().describe('Case type — must already exist in the system'),
    tikOwner: z.string().optional().describe("Username of the case's primary handler"),
    tikStage: z.string().optional().describe('Case stage — must already exist in the system'),
    tikNotes: z.string().optional().describe('Free-text case notes'),
    tikStatus: z
      .string()
      .optional()
      .describe('Case status — must already exist in the system; defaults to open when creating'),
    tiukUserName: z.string().optional().describe('Username the physical file is held by'),
    additional: z.string().optional().describe('Additional case identifier'),
    courtCodeCounter: z.number().int().optional().describe('Court code — see get_court'),
    psakDinDate: z.coerce.date().optional().describe('Judgment (פס"ד) date'),
    globalCourtNum: z.string().optional().describe('National court case number'),
    closeReason: z.string().optional().describe('Case close reason'),
    judge: z.string().optional().describe('Judge name'),
  },
};

export const createOrUpdateBillingChargeTool = {
  description:
    'Create a new billing charge or replace an existing one, via Klita_Interface_BillingDetails (write, ' +
    'requires ODCANIT_DB_ENABLE_WRITES=true). "Update" deletes the charge named by billingCounterForUpdate ' +
    'and creates a new one in its place — only open charges can be updated this way, and all the normal ' +
    'create fields must still be supplied.',
  inputSchema: {
    tikVisualID: z.string().describe('Case number the charge is billed to'),
    billDate: z.coerce.date().describe('Charge date'),
    workerName: z.string().describe('Full name of the employee — must match a user in the system exactly'),
    actDisplayID: z.number().int().describe('Billing item code — must already exist in the system'),
    billDescription: z.string().describe('Charge description'),
    unit: z.string().describe('Unit name — must already exist in the system'),
    categoryName: z.string().describe('Billing category — must already exist in the system'),
    unitCount: z.number().optional().describe('Quantity'),
    unitPrice: z.number().optional().describe('Price per unit'),
    isVat: z.boolean().optional().describe('Whether the charge is subject to VAT'),
    discountAmount: z.number().optional().describe('Discount amount'),
    workHours: z.number().optional().describe('Work hours'),
    reference: z.string().optional().describe('Reference note'),
    isRetainer: z.boolean().optional().describe('Whether this is a retainer charge'),
    noCharge: z.boolean().optional().describe('Whether this charge should not actually be billed'),
    calcDetailsFromAgreements: z
      .boolean()
      .optional()
      .describe(
        'If true, the system computes unit price, category, VAT, unit, and discount from actDisplayID ' +
          "and the client's price list/retainer agreement, ignoring those fields if supplied"
      ),
    billingCounterForUpdate: z
      .number()
      .int()
      .optional()
      .describe('ID of an existing open charge to replace — provide to update, omit to create'),
  },
};

export const createDocumentTool = {
  description:
    'Create a document record on a case, via Klita_Interface_DocDetails (write, requires ' +
    'ODCANIT_DB_ENABLE_WRITES=true), and copy the file itself into the path Odcanit assigns it. The MCP ' +
    "server process needs filesystem access to Odcanit's document store for the copy to succeed. Provide " +
    'the source file as exactly one of sourceFilePath or fileContentBase64.',
  inputSchema: {
    tikVisualID: z.string().describe('Case number to attach the document to'),
    docName: z.string().describe('Document name'),
    fileExt: z.string().describe('File extension including the leading dot, e.g. ".pdf"'),
    writerName: z.string().describe('Full name of the employee — must match a user in the system exactly'),
    summary: z.string().optional().describe('Document summary'),
    category: z.string().optional().describe('Document category — must already exist in the system'),
    subCategory: z.string().optional().describe('Document sub-category — must already exist in the system'),
    createDate: z.coerce.date().optional().describe('Document date'),
    sourceFilePath: z
      .string()
      .optional()
      .describe(
        'Absolute path to the file, readable by the machine running this MCP server. Mutually exclusive ' +
          'with fileContentBase64 — provide exactly one.'
      ),
    fileContentBase64: z
      .string()
      .optional()
      .describe(
        'Base64-encoded file content, e.g. a file attached in the Claude session. Mutually exclusive ' +
          'with sourceFilePath — provide exactly one.'
      ),
  },
};

export const createAttachmentTool = {
  description:
    'Create an attachment/appendix (נספח) record on a case, via Klita_Interface_NispahDetails (write, ' +
    'requires ODCANIT_DB_ENABLE_WRITES=true).',
  inputSchema: {
    tikVisualID: z.string().describe('Case number to attach the record to'),
    info: z.string().optional().describe('Description'),
    nispahTypeName: z.string().optional().describe('Attachment type — must already exist in the system'),
  },
};
