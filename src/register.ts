import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import sql from 'mssql';
import { readFile, writeFile } from 'node:fs/promises';
import {
  getCaseDetailsTool,
  getClientDetailsTool,
  listCasesTool,
  CASE_DATASETS,
  getCaseDataTool,
  getInvoicePaymentLinksTool,
  getUserDetailsTool,
  USER_DATASETS,
  getUserDataTool,
  getRegisteredBusinessTool,
  getCourtTool,
  createOrUpdateCaseTool,
  createOrUpdateBillingChargeTool,
  createDocumentTool,
  createAttachmentTool,
} from './tools.js';
import { queryOdcanit, queryOdcanitPage, executeOdcanitProcedure } from './db.js';
import { Case, Client, InvoicePaymentLink, OdcanitUser, RegisteredBusiness, Court } from './types.js';

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

const USER_DATA_QUERIES: Record<(typeof USER_DATASETS)[number], string> = {
  absences: 'SELECT * FROM vwExportToOuterSystems_EmployeeAbsenceList WHERE UserID = @userID',
  hourly_rates: 'SELECT * FROM vwExportToOuterSystems_HourlyUserPrices WHERE UserID = @userID',
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

  server.registerTool(
    'list_cases',
    listCasesTool,
    async ({
      status,
      clientVisualID,
      clientName,
      tikName,
      tikType,
      tikOwner,
      createdFrom,
      createdTo,
      modifiedFrom,
      modifiedTo,
      limit,
      offset,
    }) => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = {};

      if (status !== undefined) {
        conditions.push('StatusName = @status');
        params.status = status;
      }
      if (clientVisualID !== undefined) {
        conditions.push('ClientVisualID = @clientVisualID');
        params.clientVisualID = clientVisualID;
      }
      if (clientName !== undefined) {
        conditions.push('ClientName LIKE @clientName');
        params.clientName = `%${clientName}%`;
      }
      if (tikName !== undefined) {
        conditions.push('TikName LIKE @tikName');
        params.tikName = `%${tikName}%`;
      }
      if (tikType !== undefined) {
        conditions.push('TikType = @tikType');
        params.tikType = tikType;
      }
      if (tikOwner !== undefined) {
        conditions.push('TikOwner = @tikOwner');
        params.tikOwner = tikOwner;
      }
      if (createdFrom !== undefined) {
        conditions.push('TsCreateDate >= @createdFrom');
        params.createdFrom = createdFrom;
      }
      if (createdTo !== undefined) {
        conditions.push('TsCreateDate <= @createdTo');
        params.createdTo = createdTo;
      }
      if (modifiedFrom !== undefined) {
        conditions.push('TsModifyDate >= @modifiedFrom');
        params.modifiedFrom = modifiedFrom;
      }
      if (modifiedTo !== undefined) {
        conditions.push('TsModifyDate <= @modifiedTo');
        params.modifiedTo = modifiedTo;
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM vwExportToOuterSystems_Files ${where} ORDER BY TikNumber`;
      const page = await queryOdcanitPage<Case>(query, params, { limit, offset });
      return {
        content: [{ type: 'text', text: JSON.stringify(page) }],
      };
    }
  );

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

  server.registerTool('get_user_details', getUserDetailsTool, async ({ userID }) => {
    const rows = await queryOdcanit<OdcanitUser>(
      'SELECT * FROM vwExportToOuterSystems_LoginUsers WHERE UserID = @userID',
      { userID }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(rows[0] ?? null) }],
    };
  });

  server.registerTool('get_user_data', getUserDataTool, async ({ userID, dataset }) => {
    const rows = await queryOdcanit<Record<string, unknown>>(USER_DATA_QUERIES[dataset], { userID });
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

  server.registerTool(
    'create_or_update_case',
    createOrUpdateCaseTool,
    async ({
      tikCounter,
      clientNum,
      tikNum,
      tiuk,
      openDate,
      tikName,
      tikTypeName,
      tikOwner,
      tikStage,
      tikNotes,
      tikStatus,
      tiukUserName,
      additional,
      courtCodeCounter,
      psakDinDate,
      globalCourtNum,
      closeReason,
      judge,
    }) => {
      const output = await executeOdcanitProcedure(
        'Klita_Interface_TikDetails',
        {
          ClientNum: { type: sql.VarChar(20), value: clientNum ?? null },
          TikNum: { type: sql.Int, value: tikNum ?? null },
          Tiuk: { type: sql.VarChar(200), value: tiuk ?? null },
          OpenDate: { type: sql.DateTime, value: openDate ?? null },
          TikName: { type: sql.VarChar(200), value: tikName ?? null },
          TikTypeName: { type: sql.VarChar(100), value: tikTypeName ?? null },
          TikOwner: { type: sql.VarChar(60), value: tikOwner ?? null },
          TikStage: { type: sql.VarChar(100), value: tikStage ?? null },
          TikNotes: { type: sql.VarChar(sql.MAX), value: tikNotes ?? null },
          TikStatus: { type: sql.VarChar(100), value: tikStatus ?? null },
          TiukUserName: { type: sql.VarChar(50), value: tiukUserName ?? null },
          TikCounter: { type: sql.Int, value: tikCounter ?? null },
          Additional: { type: sql.VarChar(200), value: additional ?? null },
          CourtCodeCounter: { type: sql.Int, value: courtCodeCounter ?? null },
          PsakDinDate: { type: sql.DateTime, value: psakDinDate ?? null },
          GlobalCourtNum: { type: sql.VarChar(25), value: globalCourtNum ?? null },
          CloseReason: { type: sql.VarChar(1000), value: closeReason ?? null },
          Judge: { type: sql.VarChar(50), value: judge ?? null },
        },
        { NewTikvisualID: sql.VarChar(sql.MAX) }
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ newTikVisualID: output.NewTikvisualID ?? null }) }],
      };
    }
  );

  server.registerTool(
    'create_or_update_billing_charge',
    createOrUpdateBillingChargeTool,
    async ({
      tikVisualID,
      billDate,
      workerName,
      actDisplayID,
      billDescription,
      unit,
      categoryName,
      unitCount,
      unitPrice,
      isVat,
      discountAmount,
      workHours,
      reference,
      isRetainer,
      noCharge,
      calcDetailsFromAgreements,
      billingCounterForUpdate,
    }) => {
      const toTinyInt = (value: boolean | undefined) => (value === undefined ? null : value ? 1 : 0);
      const output = await executeOdcanitProcedure(
        'Klita_Interface_BillingDetails',
        {
          TikVisualID: { type: sql.VarChar(50), value: tikVisualID },
          BillDate: { type: sql.DateTime, value: billDate },
          WorkerName: { type: sql.VarChar(100), value: workerName },
          ActDisplayID: { type: sql.Int, value: actDisplayID },
          BillDescription: { type: sql.VarChar(8000), value: billDescription },
          Unit: { type: sql.VarChar(50), value: unit },
          CategoryName: { type: sql.VarChar(50), value: categoryName },
          UnitCount: { type: sql.Float, value: unitCount ?? null },
          UnitPrice: { type: sql.Float, value: unitPrice ?? null },
          IsVat: { type: sql.TinyInt, value: toTinyInt(isVat) },
          DiscountAmount: { type: sql.Float, value: discountAmount ?? null },
          WorkHours: { type: sql.Float, value: workHours ?? null },
          Reference: { type: sql.VarChar(100), value: reference ?? null },
          IsRetainer: { type: sql.TinyInt, value: toTinyInt(isRetainer) },
          NoCharge: { type: sql.TinyInt, value: toTinyInt(noCharge) },
          CalcDetailsFromAgreements: { type: sql.TinyInt, value: toTinyInt(calcDetailsFromAgreements) },
          BillingCounterForUpdate: { type: sql.Int, value: billingCounterForUpdate ?? null },
        },
        { NewBillingCounter: sql.Int }
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ newBillingCounter: output.NewBillingCounter ?? null }) }],
      };
    }
  );

  server.registerTool(
    'create_document',
    createDocumentTool,
    async ({
      tikVisualID,
      docName,
      fileExt,
      writerName,
      summary,
      category,
      subCategory,
      createDate,
      sourceFilePath,
      fileContentBase64,
    }) => {
      if (Boolean(sourceFilePath) === Boolean(fileContentBase64)) {
        throw new Error('Provide exactly one of sourceFilePath or fileContentBase64.');
      }
      const fileBytes = sourceFilePath ? await readFile(sourceFilePath) : Buffer.from(fileContentBase64!, 'base64');

      const output = await executeOdcanitProcedure(
        'Klita_Interface_DocDetails',
        {
          TikVisualID: { type: sql.VarChar(50), value: tikVisualID },
          DocName: { type: sql.VarChar(200), value: docName },
          FileExt: { type: sql.VarChar(20), value: fileExt },
          summary: { type: sql.VarChar(5000), value: summary ?? null },
          Category: { type: sql.VarChar(50), value: category ?? null },
          SubCategory: { type: sql.VarChar(100), value: subCategory ?? null },
          CreateDate: { type: sql.DateTime, value: createDate ?? null },
          WriterName: { type: sql.VarChar(100), value: writerName },
        },
        { Path: sql.VarChar(sql.MAX) }
      );

      const path = output.Path as string;
      await writeFile(path, fileBytes);

      return {
        content: [{ type: 'text', text: JSON.stringify({ path }) }],
      };
    }
  );

  server.registerTool('create_attachment', createAttachmentTool, async ({ tikVisualID, info, nispahTypeName }) => {
    await executeOdcanitProcedure('Klita_Interface_NispahDetails', {
      TikVisualID: { type: sql.VarChar(50), value: tikVisualID },
      Info: { type: sql.VarChar(sql.MAX), value: info ?? null },
      NispahTypeName: { type: sql.VarChar(50), value: nispahTypeName ?? null },
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
    };
  });
}
