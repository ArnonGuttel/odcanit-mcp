import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getCaseDetailsTool,
  getClientDetailsTool,
  CASE_DATASETS,
  getCaseDataTool,
  getInvoicePaymentLinksTool,
  getEmployeeAbsencesTool,
  getUserDetailsTool,
  getUserHourlyRatesTool,
  getRegisteredBusinessTool,
  getCourtTool,
} from './tools.js';
import { queryOdcanit } from './db.js';
import {
  Case,
  Client,
  InvoicePaymentLink,
  EmployeeAbsence,
  OdcanitUser,
  UserHourlyRate,
  RegisteredBusiness,
  Court,
} from './types.js';

const CASE_DATA_QUERIES: Record<(typeof CASE_DATASETS)[number], string> = {
  handlers: 'SELECT * FROM vwExportToOuterSystems_TikMetaplim WHERE TikNumber = @tikNumber',
  actions: 'SELECT * FROM vwExportToOuterSystems_TikActions WHERE TikNumber = @tikNumber',
  debtors: 'SELECT * FROM vwExportToOuterSystems_TikDebtors WHERE TikNumber = @tikNumber',
  trust_funds: 'SELECT * FROM vwExportToOuterSystems_TikKeren WHERE TikNumber = @tikNumber',
  parties: 'SELECT * FROM vwExportToOuterSystems_vwSides WHERE TikNumber = @tikNumber',
  linked_cases: `SELECT lt.* FROM vwExportToOuterSystems_Files f
     CROSS APPLY dbo.udfExportToOuterSystems_GetLinkedMainTiks(f.TikCounter) lt
     WHERE f.TikNumber = @tikNumber`,
  expenses: 'SELECT * FROM vwExportToOuterSystems_Expenses WHERE TikNumber = @tikNumber',
  billing: 'SELECT * FROM vwExportToOuterSystems_Billing WHERE TikVisualID = @tikNumber',
  invoice_summary: 'SELECT * FROM vwExportToOuterSystems_InvoiceByCategoryAndVat WHERE TikVisualID = @tikNumber',
  receipts_and_payments: 'SELECT * FROM vwExportToOuterSystems_ReceiptAndIncome WHERE TikVisualID = @tikNumber',
  calendar_events: `SELECT y.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_YomanData y ON y.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  tasks: `SELECT t.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_Tasks t ON t.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  custom_fields: `SELECT u.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_UserData u ON u.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  change_log: `SELECT a.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_ActionLog a ON a.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  documents: 'SELECT * FROM vwExportToOuterSystems_Documents WHERE TikVisualID = @tikNumber',
  attachments: 'SELECT * FROM vwExportToOuterSystems_Nispah WHERE TikNumber = @tikNumber',
  hybrid_mail: `SELECT h.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_HybridMail h ON h.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  web_forms: `SELECT w.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_WebForms w ON w.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
  phone_calls: `SELECT p.* FROM vwExportToOuterSystems_Files f
     JOIN vwExportToOuterSystems_vwPhoneCenterCallsInfo p ON p.TikCounter = f.TikCounter
     WHERE f.TikNumber = @tikNumber`,
};

export function registerTools(server: McpServer) {
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

  server.registerTool('get_case_data', getCaseDataTool, async ({ tikNumber, dataset }) => {
    const rows = await queryOdcanit<Record<string, unknown>>(CASE_DATA_QUERIES[dataset], { tikNumber });
    return {
      content: [{ type: 'text', text: JSON.stringify(rows) }],
    };
  });

  server.registerTool('get_invoice_payment_links', getInvoicePaymentLinksTool, async ({ idInvoice }) => {
    const rows = await queryOdcanit<InvoicePaymentLink>(
      'SELECT * FROM vwExportToOuterSystems_InvoiceToIncome WHERE IDinvoice = @idInvoice',
      { idInvoice }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows) }],
    };
  });

  server.registerTool('get_employee_absences', getEmployeeAbsencesTool, async ({ userID }) => {
    const rows = await queryOdcanit<EmployeeAbsence>(
      'SELECT * FROM vwExportToOuterSystems_EmployeeAbsenceList WHERE UserID = @userID',
      { userID }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows) }],
    };
  });

  server.registerTool('get_user_details', getUserDetailsTool, async ({ userID }) => {
    const rows = await queryOdcanit<OdcanitUser>(
      'SELECT * FROM vwExportToOuterSystems_LoginUsers WHERE UserID = @userID',
      { userID }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
    };
  });

  server.registerTool('get_user_hourly_rates', getUserHourlyRatesTool, async ({ userID }) => {
    const rows = await queryOdcanit<UserHourlyRate>(
      'SELECT * FROM vwExportToOuterSystems_HourlyUserPrices WHERE UserID = @userID',
      { userID }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows) }],
    };
  });

  server.registerTool('get_registered_business', getRegisteredBusinessTool, async ({ counter }) => {
    const rows = await queryOdcanit<RegisteredBusiness>(
      'SELECT * FROM vwExportToOuterSystems_RegisteredBusinesses WHERE Counter = @counter',
      { counter }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
    };
  });

  server.registerTool('get_court', getCourtTool, async ({ courtCodeCounter }) => {
    const rows = await queryOdcanit<Court>(
      'SELECT * FROM vwExportToOuterSystems_Courts WHERE CourtCodeCounter = @courtCodeCounter',
      { courtCodeCounter }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
    };
  });
}
