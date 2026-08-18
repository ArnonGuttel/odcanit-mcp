// Odcanit read-only export view types
// Source: vwExportToOuterSystems_Files
export interface Case {
  tikCounter: number;
  tikNumber: string;
  tikName: string;
  clientVisualID: string;
  clientName: string;
  statusName?: string;
  tikType?: string;
  tikOwner?: number;
  tsCreateDate?: Date;
  tsModifyDate?: Date;
}

// Source: vwExportToOuterSystems_Clients
export interface Client {
  sideCounter: number;
  visualID: string;
  clientName: string;
  fullAddress?: string;
  mobile?: string;
  email?: string;
  owner?: number;
  dateOpen?: Date;
  tsCreateDate?: Date;
  tsModifyDate?: Date;
}

// Source: vwExportToOuterSystems_InvoiceToIncome
export interface InvoicePaymentLink {
  idInvoice: number;
  invoiceCounter: number;
  incomeCounter: number;
  billingCounter: number;
  amountInInoviceCurrencyWithVat?: number;
  amountInIncomeCurrencyWithVat?: number;
  amountInInoviceCurrencyWithoutVat?: number;
  amountInIncomeCurrencyWithoutVat?: number;
}

// Source: vwExportToOuterSystems_EmployeeAbsenceList
export interface EmployeeAbsence {
  counter: number;
  userID: number;
  absenceTypeName?: string;
  dated?: Date;
  startTime?: Date;
  endTime?: Date;
  hourCount?: number;
  isFullDay?: number;
  name?: string;
}

// Source: vwExportToOuterSystems_LoginUsers
export interface OdcanitUser {
  userID: number;
  fullName: string;
  active?: number;
  departmentName?: string;
  duty?: string;
  email?: string;
  employeeID?: string;
  lastLogin?: Date;
  inSystem?: number;
}

// Source: vwExportToOuterSystems_HourlyUserPrices
export interface UserHourlyRate {
  userID: number;
  fromDate?: Date;
  untilDate?: Date;
  pricePerHour?: number;
}

// Source: vwExportToOuterSystems_RegisteredBusinesses
export interface RegisteredBusiness {
  counter: number;
  businessName?: string;
  clcBusinessName?: string;
}

// Source: vwExportToOuterSystems_Courts
export interface Court {
  courtCodeCounter: number;
  courtName?: string;
  courtFullName?: string;
}
